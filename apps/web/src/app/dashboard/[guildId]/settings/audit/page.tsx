import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { getGuildMember, requirePermission } from '@/lib/api'
import { avatarUrl } from '@/lib/utils'
import { getLocale } from '@/i18n/server'
import { getT, translateAuditAction, type Translations } from '@/i18n/translations'
import { AlertTriangle, BookOpen, CalendarX, CircleDot, ClipboardList, Settings, User, Wallet } from 'lucide-react'

const TYPE_ICON: Record<string, typeof User> = {
  Member: User,
  Absence: CalendarX,
  Warning: AlertTriangle,
  Contribution: Wallet,
  AccountingEntry: BookOpen,
  Guild: Settings,
}

function timeAgo(date: Date, t: Translations): string {
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return t.time.justNow
  if (m < 60) return t.time.minAgo(m)
  const h = Math.floor(m / 60)
  if (h < 24) return t.time.hoursAgo(h)
  const d = Math.floor(h / 24)
  return t.time.daysAgo(d)
}

export default async function AuditLogPage({ params, searchParams }: {
  params: { guildId: string }
  searchParams: { page?: string; type?: string }
}) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params
  const locale = getLocale()
  const t = getT(locale)
  const a = t.settingsAudit
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.view')

  const page = Math.max(1, parseInt(searchParams.page ?? '1'))
  const typeFilter = searchParams.type ?? ''
  const perPage = 50

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        guildId,
        ...(typeFilter ? { targetType: typeFilter } : {}),
      },
      include: { admin: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.auditLog.count({
      where: { guildId, ...(typeFilter ? { targetType: typeFilter } : {}) },
    }),
  ])

  const totalPages = Math.ceil(total / perPage)

  const TYPES = ['Member', 'Absence', 'Warning', 'Contribution', 'AccountingEntry', 'Guild']

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">{a.title}</h2>
          <p className="text-[var(--text-2)] text-sm mt-1">{a.entriesTotal(total)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <a
          href={`/dashboard/${guildId}/settings/audit`}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !typeFilter ? 'bg-[var(--guild-accent)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)]'
          }`}
        >
          {a.allFilter}
        </a>
        {TYPES.map((t) => {
          const Icon = TYPE_ICON[t] ?? CircleDot
          return (
            <a
              key={t}
              href={`/dashboard/${guildId}/settings/audit?type=${t}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === t ? 'bg-[var(--guild-accent)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)]'
              }`}
            >
              <Icon size={12} strokeWidth={2} /> {t}
            </a>
          )
        })}
      </div>

      {/* Log list */}
      <div className="card divide-y divide-[var(--border)] overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-2)]">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
            >
              <ClipboardList size={24} strokeWidth={1.8} />
            </div>
            <p>{a.noActivity}</p>
          </div>
        ) : (
          logs.map((log) => {
            const avatar = log.admin ? avatarUrl(log.admin.discordUserId, log.admin.discordAvatar) : null
            const Icon = TYPE_ICON[log.targetType ?? ''] ?? CircleDot
            return (
              <div key={log.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors">
                <span className="w-6 flex justify-center flex-shrink-0 text-[var(--text-3)]"><Icon size={15} strokeWidth={1.8} /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text)] truncate">{translateAuditAction(log.action, locale)}</p>
                  {log.admin && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {avatar && <img src={avatar} alt="" className="w-3.5 h-3.5 rounded-full" />}
                      <span className="text-xs text-[var(--text-3)]">
                        {log.admin.discordNickname ?? log.admin.discordUsername}
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-xs text-[var(--text-3)] flex-shrink-0 whitespace-nowrap">
                  {timeAgo(new Date(log.createdAt), t)}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <a
              href={`/dashboard/${guildId}/settings/audit?page=${page - 1}${typeFilter ? `&type=${typeFilter}` : ''}`}
              className="px-3 py-1.5 bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] text-xs rounded-lg transition-colors"
            >
              {a.prevPage}
            </a>
          )}
          <span className="text-xs text-[var(--text-3)]">{a.pageOf(page, totalPages)}</span>
          {page < totalPages && (
            <a
              href={`/dashboard/${guildId}/settings/audit?page=${page + 1}${typeFilter ? `&type=${typeFilter}` : ''}`}
              className="px-3 py-1.5 bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] text-xs rounded-lg transition-colors"
            >
              {a.nextPage}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
