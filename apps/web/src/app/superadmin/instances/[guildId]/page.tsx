'use server'

import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { getSuperAdminAccess } from '@/lib/superadmin-access'
import { formatDateTime } from '@/lib/utils'
import ResetGuildButton from '@/components/ResetGuildButton'
import GuildAbsenceCalendar, { type SAAbsenceItem } from '@/components/superadmin/GuildAbsenceCalendar'
import GuildPresenceHeatmap from '@/components/superadmin/GuildPresenceHeatmap'

async function resetGuild(guildId: string) {
  'use server'
  const session = await auth()
  const access = await getSuperAdminAccess(session?.user?.discordId)
  if (!access?.isDev) return

  await prisma.$transaction([
    prisma.presenceLog.deleteMany({ where: { guildId } }),
    prisma.absence.deleteMany({ where: { guildId } }),
    prisma.warning.deleteMany({ where: { guildId } }),
    prisma.contribution.deleteMany({ where: { guildId } }),
    prisma.accountingEntry.deleteMany({ where: { guildId } }),
    prisma.vdaCard.deleteMany({ where: { guildId } }),
    prisma.notification.deleteMany({ where: { guildId } }),
    prisma.auditLog.deleteMany({ where: { guildId } }),
    prisma.gradeHistory.deleteMany({ where: { member: { guildId } } }),
  ])
  revalidatePath(`/superadmin/instances/${guildId}`)
}

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function pad2(n: number) { return String(n).padStart(2, '0') }

function presenceColor(rate: number) {
  if (rate >= 0.8)  return '#22c55e'
  if (rate >= 0.6)  return '#86efac'
  if (rate >= 0.4)  return '#eab308'
  if (rate >= 0.2)  return '#f97316'
  return '#ef4444'
}

export default async function InstanceDetailPage({
  params,
  searchParams,
}: {
  params: { guildId: string }
  searchParams: { month?: string }
}) {
  const { guildId } = params

  const session = await auth()
  const access = await getSuperAdminAccess(session?.user?.discordId)
  if (!access) redirect('/dashboard')
  if (!access.isDev && !access.guildIds.includes(guildId)) redirect('/superadmin/instances')

  // Parse requested month for the calendar
  const now = new Date()
  let calYear  = now.getFullYear()
  let calMonth = now.getMonth() + 1
  if (searchParams.month) {
    const [y, m] = searchParams.month.split('-').map(Number)
    if (y && m && m >= 1 && m <= 12) { calYear = y; calMonth = m }
  }

  const monthStart = new Date(calYear, calMonth - 1, 1)
  const monthEnd   = new Date(calYear, calMonth, 0, 23, 59, 59)

  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
  thirtyDaysAgo.setUTCHours(0, 0, 0, 0)

  const todayStart = new Date(now); todayStart.setUTCHours(0, 0, 0, 0)
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999)

  const [
    guild,
    absencesMonth,
    presenceGroups,
    warningActive,
    warningAuto,
    topWarnedRaw,
    recentAuditLogs,
    contributionTotal,
    contributionThisMonth,
    accountingStats,
    membersActive,
    membersInactive,
    absencesToday,
    absencesPending,
    vdaCount,
  ] = await Promise.all([
    prisma.guildInstance.findUnique({
      where: { id: guildId },
      include: {
        config: true,
        _count: { select: { members: true, presenceLogs: true, warnings: true, absences: true, contributions: true, auditLogs: true } },
      },
    }),

    // Absences for calendar month
    prisma.absence.findMany({
      where: { guildId, startDate: { lte: monthEnd }, endDate: { gte: monthStart } },
      include: { member: { select: { discordUsername: true, discordNickname: true } } },
      orderBy: { startDate: 'asc' },
    }),

    // Presence logs last 30 days grouped by date+status
    prisma.presenceLog.groupBy({
      by: ['date', 'status'],
      where: { guildId, date: { gte: thirtyDaysAgo } },
      _count: { id: true },
    }),

    // Warning counts
    prisma.warning.count({ where: { guildId, isActive: true } }),
    prisma.warning.count({ where: { guildId, isAuto: true } }),

    // Top 5 most warned members
    prisma.warning.groupBy({
      by: ['memberId'],
      where: { guildId, isActive: true },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),

    // Recent audit logs
    prisma.auditLog.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { admin: { select: { discordUsername: true } } },
    }),

    // Total contributions
    prisma.contribution.aggregate({ where: { guildId }, _sum: { amount: true } }),

    // Contributions this month
    prisma.contribution.aggregate({
      where: { guildId, year: calYear, month: calMonth },
      _sum: { amount: true },
    }),

    // Accounting income vs expense
    prisma.accountingEntry.groupBy({
      by: ['type'],
      where: { guildId },
      _sum: { amount: true },
    }),

    // Members active/inactive
    prisma.member.count({ where: { guildId, isActive: true } }),
    prisma.member.count({ where: { guildId, isActive: false } }),

    // Who is absent today (approved)
    prisma.absence.findMany({
      where: {
        guildId,
        status: 'APPROVED',
        startDate: { lte: todayEnd },
        endDate:   { gte: todayStart },
      },
      include: { member: { select: { discordUsername: true, discordNickname: true } } },
      orderBy: { startDate: 'asc' },
    }),

    // Absences pending approval
    prisma.absence.findMany({
      where: { guildId, status: 'PENDING' },
      include: { member: { select: { discordUsername: true, discordNickname: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),

    // VDA cards
    prisma.vdaCard.count({ where: { guildId, isArchived: false } }),
  ])

  if (!guild) redirect('/superadmin/instances')

  // Resolve top warned member names
  const topWarnedIds = topWarnedRaw.map(r => r.memberId)
  const topWarnedMembers = await prisma.member.findMany({
    where: { id: { in: topWarnedIds } },
    select: { id: true, discordUsername: true, discordNickname: true },
  })
  const memberNameMap = new Map(topWarnedMembers.map(m => [m.id, m.discordNickname ?? m.discordUsername]))

  // Build presence heatmap data for last 30 days
  // pending = membersActive - present - absent (includes members with no log at all,
  // matching what the normal presences dashboard and the click API show)
  type DayStat = { present: number; absent: number; pending: number }
  const heatmap = new Map<string, DayStat>()
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo)
    d.setDate(d.getDate() + i)
    const k = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    heatmap.set(k, { present: 0, absent: 0, pending: 0 })
  }
  for (const g of presenceGroups) {
    const k = new Date(g.date).toISOString().split('T')[0]!
    const entry = heatmap.get(k)
    if (!entry) continue
    if (g.status === 'PRESENT') entry.present += g._count.id
    if (g.status === 'ABSENT')  entry.absent  += g._count.id
    if (g.status === 'PENDING') entry.pending += g._count.id
  }
  // pending = membersActive - present - absent for any day the job ran
  // (detected by at least one log of any status existing)
  // This matches what the click API and normal dashboard show
  const heatmapDays = Array.from(heatmap.entries()).map(([k, v]) => {
    const jobRan = (v.present + v.absent + v.pending) > 0
    return {
      k,
      present: v.present,
      absent:  v.absent,
      pending: jobRan ? Math.max(0, membersActive - v.present - v.absent) : 0,
    }
  })

  // Compute global presence rate over 30 days
  const totalPresent = heatmapDays.reduce((s, d) => s + d.present, 0)
  const totalLogged  = heatmapDays.reduce((s, d) => s + d.present + d.absent, 0)
  const presenceRate = totalLogged > 0 ? totalPresent / totalLogged : null

  // Calendar absences shaped for client component
  const calAbsences: SAAbsenceItem[] = absencesMonth.map(a => ({
    id:         a.id,
    reason:     a.reason,
    startDate:  a.startDate.toISOString().split('T')[0]!,
    endDate:    a.endDate.toISOString().split('T')[0]!,
    status:     a.status as 'PENDING' | 'APPROVED' | 'REJECTED',
    memberName: a.member.discordNickname ?? a.member.discordUsername,
  }))

  const income  = accountingStats.find(r => r.type === 'INCOME')?._sum?.amount  ?? 0
  const expense = accountingStats.find(r => r.type === 'EXPENSE')?._sum?.amount ?? 0

  // Bot health check
  let botOnline = false
  let botUptime: number | null = null
  try {
    const secret = process.env['BOT_INTERNAL_SECRET']!
    const port = process.env['BOT_HTTP_PORT'] ?? '3001'
    const healthRes = await fetch(`http://localhost:${port}/health`, {
      headers: { 'x-internal-secret': secret },
      cache: 'no-store',
    })
    if (healthRes.ok) {
      const data = await healthRes.json() as { status: string; uptime: number }
      botOnline = data.status === 'ok'
      botUptime = data.uptime
    }
  } catch { /* bot offline */ }

  const MODULE_FLAGS = [
    { key: 'presenceEnabled',     label: 'Présences' },
    { key: 'warningEnabled',      label: 'Avertissements' },
    { key: 'absenceEnabled',      label: 'Absences' },
    { key: 'contributionEnabled', label: 'Cotisations' },
    { key: 'accountingEnabled',   label: 'Comptabilité' },
    { key: 'vdaEnabled',          label: 'VDA' },
  ] as const

  const ACTION_LABELS: Record<string, string> = {
    CONFIG_UPDATED: 'Config mise à jour',
    ABSENCE_APPROVED: 'Absence approuvée',
    ABSENCE_REJECTED: 'Absence refusée',
    WARNING_ISSUED: 'Avert. émis',
    WARNING_REVOKED: 'Avert. révoqué',
    MEMBER_GRADE_CHANGED: 'Grade changé',
    CONTRIBUTION_ADDED: 'Cotisation ajoutée',
    ACCOUNTING_ENTRY_ADDED: 'Écriture ajoutée',
    ACCOUNTING_ENTRY_DELETED: 'Écriture supprimée',
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <a href="/superadmin/instances" className="text-xs text-[var(--text-3)] hover:text-[var(--text-2)]">← Instances</a>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{guild.discordGuildName}</h1>
          <p className="text-[var(--text-3)] font-mono text-xs mt-1">{guild.discordGuildId}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {guild.isBanned ? (
            <span className="px-3 py-1 bg-[#ef444420] text-[var(--danger)] rounded-full text-xs font-medium">Banni</span>
          ) : guild.isActive ? (
            <span className="px-3 py-1 bg-[#22c55e20] text-[var(--success)] rounded-full text-xs font-medium">Actif</span>
          ) : (
            <span className="px-3 py-1 bg-[var(--hover)] text-[var(--text-3)] rounded-full text-xs font-medium">Inactif</span>
          )}
          <span className="px-3 py-1 bg-[#5865F220] text-[var(--accent)] rounded-full text-xs font-medium capitalize">{guild.plan}</span>
        </div>
      </div>

      {/* ── KPI Row 1 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider mb-1">Membres</p>
          <p className="text-2xl font-bold tracking-tight text-[var(--text)]">{membersActive}</p>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">{membersInactive} inactif{membersInactive !== 1 ? 's' : ''}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider mb-1">Absents aujourd&apos;hui</p>
          <p className="text-2xl font-bold text-[var(--warning)]">{absencesToday.length}</p>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">{absencesPending.length} en attente</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider mb-1">Avert. actifs</p>
          <p className="text-2xl font-bold text-[var(--danger)]">{warningActive}</p>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">{warningAuto} auto</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider mb-1">Taux présence 30j</p>
          {presenceRate !== null ? (
            <>
              <p className="text-2xl font-bold" style={{ color: presenceColor(presenceRate) }}>
                {Math.round(presenceRate * 100)}%
              </p>
              <p className="text-[11px] text-[var(--text-3)] mt-0.5">{totalLogged} logs total</p>
            </>
          ) : (
            <p className="text-2xl font-bold text-[var(--text-3)]">—</p>
          )}
        </div>
      </div>

      {/* ── KPI Row 2 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider mb-1">Total absences</p>
          <p className="text-2xl font-bold tracking-tight text-[var(--text)]">{guild._count.absences}</p>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">{calAbsences.length} ce mois</p>
        </div>
        <div className="bg-[var(--surface)] rounded-md border border-[#22c55e30] p-4">
          <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider mb-1">Cotisations</p>
          <p className="text-2xl font-bold text-[var(--success)]">
            {(contributionThisMonth._sum?.amount ?? 0).toFixed(0)}{guild.config?.contributionCurrency ? ` ${guild.config.contributionCurrency}` : '€'}
          </p>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">
            Total : {(contributionTotal._sum?.amount ?? 0).toFixed(0)}{guild.config?.contributionCurrency ? ` ${guild.config.contributionCurrency}` : '€'}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider mb-1">Comptabilité</p>
          <p className="text-2xl font-bold text-[var(--success)]">+{income.toFixed(0)}€</p>
          <p className="text-[11px] text-[var(--danger)] mt-0.5">-{expense.toFixed(0)}€ dépenses</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider mb-1">Activité</p>
          <p className="text-2xl font-bold tracking-tight text-[var(--text)]">{guild._count.auditLogs}</p>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">{vdaCount} VDA actives</p>
        </div>
      </div>

      {/* ── Présence heatmap 30 jours ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-[var(--text)]">Présence — 30 derniers jours</h2>
            <p className="text-[11px] text-[var(--text-3)] mt-0.5">Cliquez sur un jour pour voir les membres</p>
          </div>
          {presenceRate !== null && (
            <span className="text-xs font-semibold px-2 py-1 rounded" style={{ background: `${presenceColor(presenceRate)}22`, color: presenceColor(presenceRate) }}>
              {Math.round(presenceRate * 100)}% présence
            </span>
          )}
        </div>
        <GuildPresenceHeatmap
          days={heatmapDays}
          guildId={guildId}
          presenceRate={presenceRate}
          totalLogged={totalLogged}
        />
      </div>

      {/* ── Calendrier des absences ── */}
      <div className="card p-5">
        <h2 className="font-semibold text-[var(--text)] mb-4">Calendrier des absences</h2>
        <GuildAbsenceCalendar
          absences={calAbsences}
          year={calYear}
          month={calMonth}
          guildId={guildId}
        />
      </div>

      {/* ── Deux colonnes : absents aujourd'hui + top avertis ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Absents aujourd'hui */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="font-semibold text-[var(--text)] text-sm">Absents aujourd&apos;hui</h2>
            <span className="text-xs text-[var(--text-3)]">{absencesToday.length} membre{absencesToday.length !== 1 ? 's' : ''}</span>
          </div>
          {absencesToday.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[var(--text-3)]">Aucun membre absent aujourd&apos;hui</div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {absencesToday.map(a => (
                <li key={a.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-[var(--text)]">{a.member.discordNickname ?? a.member.discordUsername}</p>
                  <p className="text-xs text-[var(--text-2)] truncate mt-0.5">{a.reason}</p>
                  <p className="text-xs text-[var(--text-3)] mt-0.5">
                    {a.startDate.toLocaleDateString('fr-FR')} → {a.endDate.toLocaleDateString('fr-FR')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top membres avertis */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h2 className="font-semibold text-[var(--text)] text-sm">Top avertissements actifs</h2>
          </div>
          {topWarnedRaw.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[var(--text-3)]">Aucun avertissement actif</div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {topWarnedRaw.map((r, i) => (
                <li key={r.memberId} className="px-4 py-3 flex items-center gap-3">
                  <span className="text-[11px] text-[var(--text-3)] w-4 text-center font-mono">{i + 1}</span>
                  <span className="flex-1 text-sm text-[var(--text)]">{memberNameMap.get(r.memberId) ?? r.memberId}</span>
                  <span className="text-sm font-bold text-[var(--danger)]">{r._count.id}</span>
                  <span className="text-[10px] text-[var(--text-3)]">avert.</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Absences en attente de validation ── */}
      {absencesPending.length > 0 && (
        <div className="bg-[var(--surface)] rounded-md border border-[#eab30830] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#eab30830] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#eab308]" />
            <h2 className="font-semibold text-[var(--warning)] text-sm">Absences en attente</h2>
            <span className="ml-auto text-xs text-[var(--text-3)]">{absencesPending.length}</span>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {absencesPending.map(a => (
              <li key={a.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)]">{a.member.discordNickname ?? a.member.discordUsername}</p>
                  <p className="text-xs text-[var(--text-2)] truncate">{a.reason}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-[var(--text-3)]">
                    {a.startDate.toLocaleDateString('fr-FR')} → {a.endDate.toLocaleDateString('fr-FR')}
                  </p>
                  <p className="text-[10px] text-[var(--text-3)] mt-0.5">
                    Soumis {a.createdAt.toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Activité récente (Audit log) ── */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--text)]">Activité récente</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">{guild._count.auditLogs} entrées au total</p>
        </div>
        {recentAuditLogs.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[var(--text-3)]">Aucune activité enregistrée</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {recentAuditLogs.map(log => (
              <div key={log.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text)]">{ACTION_LABELS[log.action] ?? log.action}</p>
                  {log.admin && (
                    <p className="text-xs text-[var(--text-3)] mt-0.5">par {log.admin.discordUsername}</p>
                  )}
                </div>
                <span className="text-[11px] text-[var(--text-3)] flex-shrink-0">
                  {formatDateTime(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modules actifs ── */}
      {guild.config && (
        <div className="card p-5">
          <h2 className="font-semibold text-[var(--text)] mb-3">Modules</h2>
          <div className="flex gap-2 flex-wrap">
            {MODULE_FLAGS.map(({ key, label }) => {
              const enabled = guild.config![key as keyof typeof guild.config] as boolean | null
              return (
                <span
                  key={key}
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={enabled
                    ? { background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }
                    : { background: 'var(--surface-2)',  color: 'var(--text-3)', border: '1px solid var(--border)' }
                  }
                >
                  {enabled ? '✓' : '✗'} {label}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Statut bot + Infos ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold text-[var(--text)] mb-3">Statut du bot</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${botOnline ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} />
              <span className={`text-sm font-semibold ${botOnline ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                {botOnline ? 'En ligne' : 'Hors ligne'}
              </span>
              {botOnline && botUptime !== null && (
                <span className="text-xs text-[var(--text-3)] ml-2">uptime {formatUptime(botUptime)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-[var(--text)] mb-3">Informations</h2>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-[var(--text-2)]">Propriétaire</span>
              <code className="text-[var(--text)] font-mono text-xs truncate max-w-32">{guild.ownerId}</code>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[var(--text-2)]">Créé le</span>
              <span className="text-[var(--text)] text-xs">{formatDateTime(guild.createdAt)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[var(--text-2)]">Mis à jour</span>
              <span className="text-[var(--text)] text-xs">{formatDateTime(guild.updatedAt)}</span>
            </div>
            {guild.config && (
              <>
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--text-2)]">Panel</span>
                  <span className="text-[var(--text)]">{guild.config.panelName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--text-2)]">Timezone</span>
                  <span className="text-[var(--text)]">{guild.config.timezone}</span>
                </div>
              </>
            )}
            {guild.isBanned && guild.banReason && (
              <div className="flex justify-between gap-2">
                <span className="text-[var(--text-2)]">Raison ban</span>
                <span className="text-[var(--danger)]">{guild.banReason}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Zone dangereuse ── */}
      {access.isDev && (
        <div className="bg-[var(--surface)] rounded-md border border-[#ef444430] p-5">
          <h2 className="font-semibold text-[var(--danger)] mb-1">Zone dangereuse</h2>
          <p className="text-xs text-[var(--text-2)] mb-4">Ces actions sont irréversibles. Procéder avec précaution.</p>
          <ResetGuildButton
            guildName={guild.discordGuildName}
            resetAction={resetGuild.bind(null, guildId)}
          />
        </div>
      )}
    </div>
  )
}
