import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { getLocale } from '@/i18n/server'
import { getT } from '@/i18n/translations'

export default async function GuildDashboardPage({ params }: { params: { guildId: string } }) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params
  const locale = getLocale()
  const tr = getT(locale)
  const dateLocale = locale === 'en' ? 'en-US' : 'fr-FR'

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setUTCHours(0, 0, 0, 0)

  const [
    membersCount,
    todayPresences,
    pendingToday,
    pendingAbsences,
    activeWarnings,
    guild,
    recentAuditLogs,
    weekPresences,
    accountingEntries,
    contributionsCount,
  ] = await Promise.all([
    prisma.member.count({ where: { guildId, isActive: true, gradeId: { not: null } } }),
    prisma.presenceLog.count({ where: { guildId, date: today, status: 'PRESENT' } }),
    prisma.presenceLog.count({ where: { guildId, date: today, status: 'PENDING' } }),
    prisma.absence.count({ where: { guildId, status: 'PENDING' } }),
    prisma.warning.count({ where: { guildId, isActive: true } }),
    prisma.guildInstance.findUnique({ where: { id: guildId }, include: { config: true } }),
    prisma.auditLog.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { admin: true },
    }),
    prisma.presenceLog.findMany({
      where: { guildId, date: { gte: sevenDaysAgo } },
      select: { date: true, status: true },
    }),
    prisma.accountingEntry.findMany({ where: { guildId }, select: { type: true, amount: true } }),
    prisma.contribution.count({ where: { guildId } }),
  ])

  const byDay = new Map<string, { present: number; total: number }>()
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setUTCHours(0, 0, 0, 0)
    byDay.set(d.toISOString().split('T')[0]!, { present: 0, total: 0 })
  }
  for (const log of weekPresences) {
    const key = new Date(log.date).toISOString().split('T')[0]!
    const cur = byDay.get(key)
    if (cur) {
      cur.total++
      if (log.status === 'PRESENT') cur.present++
    }
  }
  const sparkBars = [...byDay.entries()].map(([dateStr, stats]) => {
    const d = new Date(dateStr)
    const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
    return {
      label: d.toLocaleDateString(dateLocale, { weekday: 'short' }),
      rate,
      color: rate >= 80 ? '#22c55e' : rate >= 50 ? '#eab308' : stats.total > 0 ? '#ef4444' : 'var(--border)',
    }
  })

  const income = accountingEntries.filter((e) => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0)
  const expense = accountingEntries.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0)
  const balance = income - expense

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>{tr.dashboard.title}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>{formatDate(new Date())}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href={`/dashboard/${guildId}/members`} className="block">
          <StatCard label={tr.dashboard.activeMembers} value={membersCount} accent="#60a5fa" />
        </Link>
        <Link href={`/dashboard/${guildId}/presences`} className="block">
          <StatCard label={tr.dashboard.presentToday} value={todayPresences} accent="var(--success)" sub={`${pendingToday} ${tr.dashboard.pendingPresences}`} />
        </Link>
        <Link href={`/dashboard/${guildId}/absences`} className="block">
          <StatCard label={tr.dashboard.pendingAbsences} value={pendingAbsences} accent={pendingAbsences > 0 ? 'var(--warning)' : undefined} />
        </Link>
        <Link href={`/dashboard/${guildId}/warnings`} className="block">
          <StatCard label={tr.dashboard.activeWarnings} value={activeWarnings} accent={activeWarnings > 0 ? 'var(--danger)' : undefined} />
        </Link>
      </div>

      {guild?.config?.accountingEnabled && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href={`/dashboard/${guildId}/accounting`} className="block">
            <div className="card card-hover p-4 h-full">
              <p className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-3)' }}>{tr.dashboard.accountingBalance}</p>
              <p className="text-2xl font-bold tabular-nums tracking-tight" style={{ color: balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {balance >= 0 ? '+' : ''}{balance.toFixed(2)} €
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>
                +{income.toFixed(2)} / -{expense.toFixed(2)}
              </p>
            </div>
          </Link>
          <Link href={`/dashboard/${guildId}/contributions`} className="block">
            <div className="card card-hover p-4 h-full">
              <p className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-3)' }}>{tr.dashboard.recordedContributions}</p>
              <p className="text-2xl font-bold tabular-nums tracking-tight" style={{ color: 'var(--text)' }}>{contributionsCount}</p>
            </div>
          </Link>
          <Link href={`/dashboard/${guildId}/stats`} className="block">
            <div className="card card-hover p-4 h-full">
              <p className="text-[11px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>{tr.dashboard.presences7days}</p>
              <div className="flex items-end gap-1 h-10">
                {sparkBars.map((bar, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end">
                    <div className="w-full rounded-sm" style={{ height: `${Math.max(bar.rate, 4)}%`, backgroundColor: bar.color }} />
                  </div>
                ))}
              </div>
              <div className="flex gap-1 mt-1">
                {sparkBars.map((bar, i) => (
                  <div key={i} className="flex-1 text-center">
                    <span className="text-[8px]" style={{ color: 'var(--text-3)' }}>{bar.label[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>{tr.dashboard.recentActivity}</p>
          </div>
          <div className="px-5 py-4">
            {recentAuditLogs.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-3)' }}>{tr.dashboard.noRecentActivity}</p>
            ) : (
              <ul className="space-y-3">
                {recentAuditLogs.map((log) => (
                  <li key={log.id} className="flex items-start gap-3">
                    <span className="text-[11px] mt-0.5 shrink-0 tabular-nums" style={{ color: 'var(--text-3)' }}>
                      {new Date(log.createdAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div>
                      <p className="text-sm" style={{ color: 'var(--text)' }}>{log.action}</p>
                      {log.admin && <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{tr.common.by} {log.admin.discordUsername}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>{tr.dashboard.activeModules}</p>
          </div>
          <div className="px-5 py-4 space-y-3">
            <StatusRow label={tr.nav.presences} enabled={guild?.config?.presenceEnabled ?? false} href={`/dashboard/${guildId}/presences`} enabledLabel={tr.common.enabled} disabledLabel={tr.common.disabled} />
            <StatusRow label={tr.nav.warnings} enabled={guild?.config?.warningEnabled ?? false} href={`/dashboard/${guildId}/warnings`} enabledLabel={tr.common.enabled} disabledLabel={tr.common.disabled} />
            <StatusRow label={tr.nav.absences} enabled={guild?.config?.absenceEnabled ?? false} href={`/dashboard/${guildId}/absences`} enabledLabel={tr.common.enabled} disabledLabel={tr.common.disabled} />
            <StatusRow label={tr.nav.contributions} enabled={guild?.config?.contributionEnabled ?? false} href={`/dashboard/${guildId}/contributions`} enabledLabel={tr.common.enabled} disabledLabel={tr.common.disabled} />
            <StatusRow label={tr.nav.accounting} enabled={guild?.config?.accountingEnabled ?? false} href={`/dashboard/${guildId}/accounting`} enabledLabel={tr.common.enabled} disabledLabel={tr.common.disabled} />
            <StatusRow label={tr.nav.vda} enabled={guild?.config?.vdaEnabled ?? false} href={`/dashboard/${guildId}/vda`} enabledLabel={tr.common.enabled} disabledLabel={tr.common.disabled} />
            <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                  {tr.nav.warnings} : <span style={{ color: 'var(--warning)' }}>{activeWarnings}</span>
                </span>
                <Link href={`/dashboard/${guildId}/settings/modules`} className="text-xs transition-opacity hover:opacity-80" style={{ color: 'var(--accent)' }}>
                  {tr.dashboard.manageModules}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string
  value: number
  accent?: string
  sub?: string
}) {
  const tint = accent ?? 'var(--accent)'
  return (
    <div className="card card-hover p-4 flex flex-col gap-3 h-full relative overflow-hidden">
      <span
        className="absolute inset-x-0 top-0 h-[2px] opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${tint}, transparent)` }}
      />
      <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{label}</p>
      <div>
        <p className="text-3xl font-bold tabular-nums tracking-tight" style={{ color: accent ?? 'var(--text)' }}>
          {value}
        </p>
        {sub && <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>{sub}</p>}
      </div>
    </div>
  )
}

function StatusRow({ label, enabled, href, enabledLabel, disabledLabel }: { label: string; enabled: boolean; href: string; enabledLabel: string; disabledLabel: string }) {
  return (
    <Link href={href} className="flex items-center justify-between hover:opacity-80 transition-opacity">
      <span className="text-sm" style={{ color: 'var(--text-2)' }}>{label}</span>
      <span
        className="badge"
        style={enabled
          ? { background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' }
          : { background: 'var(--hover)', color: 'var(--text-3)' }
        }
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
        {enabled ? enabledLabel : disabledLabel}
      </span>
    </Link>
  )
}
