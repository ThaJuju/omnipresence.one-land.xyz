import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { getGuildMember, requirePermission } from '@/lib/api'
import { avatarUrl } from '@/lib/utils'

const TYPE_ICON: Record<string, string> = {
  Member: '👤',
  Absence: '📅',
  Warning: '⚠️',
  Contribution: '💰',
  AccountingEntry: '📒',
  Guild: '⚙️',
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "À l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  const d = Math.floor(h / 24)
  return `il y a ${d}j`
}

export default async function AuditLogPage({ params, searchParams }: {
  params: { guildId: string }
  searchParams: { page?: string; type?: string }
}) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params
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
          <h2 className="text-lg font-semibold text-[var(--text)]">Journal d&apos;activité</h2>
          <p className="text-[var(--text-2)] text-sm mt-1">{total} entrée{total > 1 ? 's' : ''} au total</p>
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
          Tout
        </a>
        {TYPES.map((t) => (
          <a
            key={t}
            href={`/dashboard/${guildId}/settings/audit?type=${t}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              typeFilter === t ? 'bg-[var(--guild-accent)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)]'
            }`}
          >
            {TYPE_ICON[t] ?? '•'} {t}
          </a>
        ))}
      </div>

      {/* Log list */}
      <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] divide-y divide-[#1a1a40] overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-2)]">
            <div className="text-4xl mb-3">📋</div>
            <p>Aucune activité enregistrée.</p>
          </div>
        ) : (
          logs.map((log) => {
            const avatar = log.admin ? avatarUrl(log.admin.discordUserId, log.admin.discordAvatar) : null
            const icon = TYPE_ICON[log.targetType ?? ''] ?? '•'
            return (
              <div key={log.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#131335] transition-colors">
                <span className="text-base w-6 text-center flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text)] truncate">{log.action}</p>
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
                  {timeAgo(new Date(log.createdAt))}
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
              className="px-3 py-1.5 bg-[var(--surface-2)] border border-white/[0.07] text-[var(--text-2)] hover:text-[var(--text)] text-xs rounded-lg transition-colors"
            >
              ← Précédent
            </a>
          )}
          <span className="text-xs text-[var(--text-3)]">Page {page} / {totalPages}</span>
          {page < totalPages && (
            <a
              href={`/dashboard/${guildId}/settings/audit?page=${page + 1}${typeFilter ? `&type=${typeFilter}` : ''}`}
              className="px-3 py-1.5 bg-[var(--surface-2)] border border-white/[0.07] text-[var(--text-2)] hover:text-[var(--text)] text-xs rounded-lg transition-colors"
            >
              Suivant →
            </a>
          )}
        </div>
      )}
    </div>
  )
}
