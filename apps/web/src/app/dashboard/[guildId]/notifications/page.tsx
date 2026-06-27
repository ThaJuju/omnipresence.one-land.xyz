'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getGuildMember } from '@/lib/api'

async function markAllRead(guildId: string, userId: string) {
  'use server'
  await prisma.notification.updateMany({
    where: { guildId, userId, isRead: false },
    data: { isRead: true },
  })
  revalidatePath(`/dashboard/${guildId}/notifications`)
}

async function markRead(guildId: string, notifId: string) {
  'use server'
  await prisma.notification.update({
    where: { id: notifId },
    data: { isRead: true },
  })
  revalidatePath(`/dashboard/${guildId}/notifications`)
}

const TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  warning: { label: 'Avertissement', icon: '⚠️', color: '#eab308' },
  absence: { label: 'Absence', icon: '📅', color: '#ef4444' },
  presence: { label: 'Présence', icon: '✅', color: '#22c55e' },
  contribution: { label: 'Cotisation', icon: '💰', color: 'var(--accent)' },
  system: { label: 'Système', icon: '🔔', color: 'var(--text-2)' },
}

function formatRelative(date: Date) {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "À l'instant"
  if (mins < 60) return `Il y a ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Il y a ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `Il y a ${days}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default async function NotificationsPage({ params }: { params: { guildId: string } }) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params
  const member = await getGuildMember(guildId, session.user.discordId)

  const notifications = await prisma.notification.findMany({
    where: { guildId, userId: member.discordUserId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const markAllReadAction = markAllRead.bind(null, guildId, member.discordUserId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Notifications</h1>
          <p className="text-[var(--text-2)] text-sm mt-1">
            {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est à jour'}
          </p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllReadAction}>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium text-[var(--text-2)] border border-white/[0.07] rounded-lg hover:bg-[#1a1a40] hover:text-[var(--text)] transition-colors"
            >
              Tout marquer comme lu
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20 text-[var(--text-2)]">
          <div className="text-5xl mb-4">🔔</div>
          <p className="font-medium text-[var(--text)] mb-1">Aucune notification</p>
          <p className="text-sm">Vous serez notifié ici des événements importants.</p>
        </div>
      ) : (
        <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] divide-y divide-[#1a1a40] overflow-hidden">
          {notifications.map((notif) => {
            const meta = TYPE_LABELS[notif.type] ?? TYPE_LABELS['system']!
            const markReadAction = markRead.bind(null, guildId, notif.id)
            return (
              <div
                key={notif.id}
                className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                  notif.isRead ? 'opacity-60' : 'bg-[#131338]'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5 text-xl">{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ color: meta.color, backgroundColor: `${meta.color}22` }}
                    >
                      {meta.label}
                    </span>
                    {!notif.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-[var(--text)] leading-snug">{notif.title}</p>
                  <p className="text-xs text-[var(--text-2)] mt-0.5 leading-relaxed">{notif.body}</p>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  <span className="text-[11px] text-[var(--text-3)] whitespace-nowrap">
                    {formatRelative(new Date(notif.createdAt))}
                  </span>
                  {!notif.isRead && (
                    <form action={markReadAction}>
                      <button
                        type="submit"
                        className="text-[10px] text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
                      >
                        Marquer lu
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
