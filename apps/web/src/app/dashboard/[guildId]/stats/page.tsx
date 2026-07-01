import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { getGuildMember, requirePermission } from '@/lib/api'
import Link from 'next/link'
import { getLocale } from '@/i18n/server'
import { getT } from '@/i18n/translations'

type Period = 'day' | 'week' | 'month'

function BarChart({ bars }: { bars: { label: string; value: number; max: number }[] }) {
  return (
    <div>
      <div className="flex items-end gap-1 h-32">
        {bars.map((b, i) => {
          const rate = b.max > 0 ? Math.round((b.value / b.max) * 100) : 0
          const height = Math.max(rate, 2)
          const color = rate >= 80 ? '#22c55e' : rate >= 50 ? '#eab308' : rate > 0 ? '#ef4444' : 'var(--border)'
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5 group relative">
              <div
                className="w-full rounded-t transition-all"
                style={{ height: `${height}%`, backgroundColor: color }}
              />
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-[10px] text-[var(--text)] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition-opacity">
                {b.label}: {rate}% ({b.value}/{b.max})
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-1 mt-2">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[9px] text-[var(--text-3)] truncate block">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function StatsPage({
  params,
  searchParams,
}: {
  params: { guildId: string }
  searchParams: { period?: string }
}) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params
  const locale = getLocale()
  const tr = getT(locale)
  const dateLocale = locale === 'en' ? 'en-US' : 'fr-FR'

  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'presences.view')

  const period: Period = (searchParams.period as Period) ?? 'week'

  // All date operations in UTC to avoid local-timezone key mismatches
  const todayUTC = new Date()
  todayUTC.setUTCHours(0, 0, 0, 0)

  // End of today (UTC), exclusive upper bound
  const now = new Date(todayUTC)
  now.setUTCDate(now.getUTCDate() + 1)

  let rangeStart: Date
  if (period === 'day') {
    rangeStart = new Date(todayUTC)
  } else if (period === 'week') {
    rangeStart = new Date(todayUTC)
    rangeStart.setUTCDate(rangeStart.getUTCDate() - 6)
  } else {
    rangeStart = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1))
  }

  const [presenceLogs, absences, warnings, membersCount] = await Promise.all([
    prisma.presenceLog.findMany({
      where: { guildId, date: { gte: rangeStart, lte: now } },
      include: { member: { select: { id: true, discordNickname: true, discordUsername: true } } },
    }),
    prisma.absence.findMany({
      where: { guildId, createdAt: { gte: rangeStart } },
      select: { status: true },
    }),
    prisma.warning.findMany({
      where: { guildId, createdAt: { gte: rangeStart } },
      select: { isActive: true, isAuto: true },
    }),
    prisma.member.count({ where: { guildId, isActive: true } }),
  ])

  const totalPresent = presenceLogs.filter((l) => l.status === 'PRESENT').length
  const totalLogs = presenceLogs.length
  const globalRate = totalLogs > 0 ? Math.round((totalPresent / totalLogs) * 100) : 0

  const byDate = new Map<string, { present: number; total: number }>()

  // All keys are UTC date strings (YYYY-MM-DD) — logs are stored as UTC midnight
  const utcDateKey = (d: Date) => d.toISOString().split('T')[0]!

  if (period === 'week') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayUTC)
      d.setUTCDate(d.getUTCDate() - i)
      byDate.set(utcDateKey(d), { present: 0, total: 0 })
    }
  } else if (period === 'month') {
    const daysInMonth = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth() + 1, 0)).getUTCDate()
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), i))
      byDate.set(utcDateKey(d), { present: 0, total: 0 })
    }
  }

  for (const log of presenceLogs) {
    const key = utcDateKey(new Date(log.date))
    const cur = byDate.get(key)
    if (cur) {
      cur.total++
      if (log.status === 'PRESENT' || log.status === 'LATE') cur.present++
    }
  }

  const chartBars = [...byDate.entries()].map(([dateStr, stats]) => {
    // Use noon UTC so the day label is correct in any timezone
    const d = new Date(dateStr + 'T12:00:00Z')
    const label = period === 'week'
      ? d.toLocaleDateString(dateLocale, { weekday: 'short' })
      : String(d.getUTCDate())
    return { label, value: stats.present, max: stats.total }
  })

  const memberStats = new Map<string, { name: string; present: number; absent: number; total: number }>()
  for (const log of presenceLogs) {
    const name = log.member.discordNickname ?? log.member.discordUsername
    const cur = memberStats.get(log.member.id) ?? { name, present: 0, absent: 0, total: 0 }
    cur.total++
    if (log.status === 'PRESENT') cur.present++
    if (log.status === 'ABSENT') cur.absent++
    memberStats.set(log.member.id, cur)
  }
  const ranking = [...memberStats.values()]
    .filter((m) => m.total > 0)
    .sort((a, b) => b.present / b.total - a.present / a.total)
    .slice(0, 10)

  const periodLabel = {
    day: tr.stats.periodToday,
    week: tr.stats.periodWeek,
    month: tr.stats.periodMonth,
  }[period]

  const periodBtnLabel = {
    day: tr.stats.dayBtn,
    week: tr.stats.weekBtn,
    month: tr.stats.monthBtn,
  }

  const rateColor = globalRate >= 80 ? 'text-[var(--success)]' : globalRate >= 50 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{tr.stats.title}</h1>
          <p className="text-[var(--text-2)] text-sm mt-1">{periodLabel}</p>
        </div>
        <div className="flex gap-1">
          {(['day', 'week', 'month'] as const).map((p) => (
            <Link
              key={p}
              href={`/dashboard/${guildId}/stats?period=${p}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-[var(--guild-accent)] text-white'
                  : 'bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)]'
              }`}
            >
              {periodBtnLabel[p]}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className={`text-3xl font-bold ${rateColor}`}>{globalRate}%</p>
          <p className="text-xs text-[var(--text-2)] mt-1">{tr.stats.presenceRate}</p>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">{totalPresent}/{totalLogs} {tr.stats.expected}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-[var(--text)]">{membersCount}</p>
          <p className="text-xs text-[var(--text-2)] mt-1">{tr.stats.activeMembers}</p>
        </div>
        <div className="card p-4 text-center">
          <p className={`text-3xl font-bold ${absences.filter((a) => a.status === 'PENDING').length > 0 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
            {absences.filter((a) => a.status === 'PENDING').length}
          </p>
          <p className="text-xs text-[var(--text-2)] mt-1">{tr.stats.pendingAbsences}</p>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">{absences.length} {tr.members.total}</p>
        </div>
        <div className="card p-4 text-center">
          <p className={`text-3xl font-bold ${warnings.length > 0 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
            {warnings.length}
          </p>
          <p className="text-xs text-[var(--text-2)] mt-1">{tr.stats.warningsIssued}</p>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">{warnings.filter((w) => w.isAuto).length} {tr.stats.autoLabel}</p>
        </div>
      </div>

      {period !== 'day' && chartBars.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-[var(--text)] mb-4">
            {period === 'week' ? tr.stats.byDay : tr.stats.byDate}
          </h2>
          <BarChart bars={chartBars} />
          <div className="flex items-center gap-4 mt-4 text-[11px] text-[var(--text-3)]">
            <span><span className="inline-block w-3 h-2 rounded-sm bg-[#22c55e] mr-1" />{tr.stats.legendGood}</span>
            <span><span className="inline-block w-3 h-2 rounded-sm bg-[#eab308] mr-1" />{tr.stats.legendOk}</span>
            <span><span className="inline-block w-3 h-2 rounded-sm bg-[#ef4444] mr-1" />{tr.stats.legendBad}</span>
          </div>
        </div>
      )}

      {ranking.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-semibold text-[var(--text)]">{tr.stats.ranking}</h2>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {ranking.map((m, i) => {
              const rate = Math.round((m.present / m.total) * 100)
              const color = rate >= 80 ? '#22c55e' : rate >= 50 ? '#eab308' : '#ef4444'
              return (
                <li key={i} className="px-5 py-3 flex items-center gap-4">
                  <span className="text-sm font-bold text-[var(--text-3)] w-5 text-center">#{i + 1}</span>
                  <span className="flex-1 text-sm text-[var(--text)]">{m.name}</span>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:block w-24 bg-[var(--surface-2)] rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${rate}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-sm font-medium" style={{ color }}>{rate}%</span>
                    <span className="text-xs text-[var(--text-3)]">{m.present}/{m.total}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {totalLogs === 0 && (
        <div className="text-center py-16 text-[var(--text-3)]">
          <div className="text-4xl mb-3">📊</div>
          <p>{tr.stats.noData}</p>
        </div>
      )}
    </div>
  )
}
