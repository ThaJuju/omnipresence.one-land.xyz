'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getGuildMember } from '@/lib/api'
import { AlertTriangle, Bell, CalendarX, CheckCircle2, Wallet } from 'lucide-react'
import { getLocale } from '@/i18n/server'
import { getT, type Translations } from '@/i18n/translations'

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

function typeLabels(t: Translations): Record<string, { label: string; icon: typeof Bell; color: string }> {
  return {
    warning: { label: t.notifications.typeWarning, icon: AlertTriangle, color: 'var(--warning)' },
    absence: { label: t.notifications.typeAbsence, icon: CalendarX, color: 'var(--danger)' },
    presence: { label: t.notifications.typePresence, icon: CheckCircle2, color: 'var(--success)' },
    contribution: { label: t.notifications.typeContribution, icon: Wallet, color: 'var(--accent)' },
    system: { label: t.notifications.typeSystem, icon: Bell, color: 'var(--text-2)' },
  }
}

function formatRelative(date: Date, t: Translations) {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t.time.justNow
  if (mins < 60) return t.time.minAgo(mins)
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t.time.hoursAgo(hrs)
  const days = Math.floor(hrs / 24)
  if (days < 7) return t.time.daysAgo(days)
  return date.toLocaleDateString(t.notifications.dateLocale, { day: 'numeric', month: 'short' })
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
  const t = getT(getLocale())
  const nf = t.notifications
  const TYPE_LABELS = typeLabels(t)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{nf.title}</h1>
          <p className="text-[var(--text-2)] text-sm mt-1">
            {unreadCount > 0 ? nf.unread(unreadCount) : nf.allRead}
          </p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllReadAction}>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium text-[var(--text-2)] border border-[var(--border)] rounded-lg hover:bg-[var(--hover)] hover:text-[var(--text)] transition-colors"
            >
              {nf.markAllRead}
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card text-center py-16 px-6 text-[var(--text-2)]">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            <Bell size={24} strokeWidth={1.8} />
          </div>
          <p className="font-medium text-[var(--text)] mb-1">{nf.noNotifications}</p>
          <p className="text-sm">{nf.noNotificationsDesc}</p>
        </div>
      ) : (
        <div className="card divide-y divide-[var(--border)] overflow-hidden">
          {notifications.map((notif) => {
            const meta = TYPE_LABELS[notif.type] ?? TYPE_LABELS['system']!
            const markReadAction = markRead.bind(null, guildId, notif.id)
            return (
              <div
                key={notif.id}
                className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                  notif.isRead ? 'opacity-60' : 'bg-[var(--surface-2)]'
                }`}
              >
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 12%, transparent)` }}
                >
                  <meta.icon size={16} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ color: meta.color, backgroundColor: `color-mix(in srgb, ${meta.color} 13%, transparent)` }}
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
                    {formatRelative(new Date(notif.createdAt), t)}
                  </span>
                  {!notif.isRead && (
                    <form action={markReadAction}>
                      <button
                        type="submit"
                        className="text-[10px] text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
                      >
                        {nf.markRead}
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
