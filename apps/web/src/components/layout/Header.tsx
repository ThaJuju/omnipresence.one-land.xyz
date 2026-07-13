import { signOut, auth } from '@/lib/auth'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { Bell, LogOut } from 'lucide-react'
import { avatarUrl } from '@/lib/utils'
import { prisma } from '@repo/db'
import type { GuildInstance, GuildConfig, Member } from '@repo/db'
import type { Session } from 'next-auth'
import { hasPermission } from '@repo/shared'
import MobileSidebar from './MobileSidebar'
import GlobalSearch from '@/components/dashboard/GlobalSearch'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import ThemeToggle from '@/components/ThemeToggle'
import type { Locale } from '@/i18n/translations'
import { getT } from '@/i18n/translations'
import { getGuildMember, requirePermission } from '@/lib/api'
import { botClient } from '@/lib/bot-client'
import { fetchDiscordChannels } from '@/lib/discord-channels'
import QuickSetupWizard, { type QuickSetupData } from '@/components/quick-setup/QuickSetupWizard'

type Props = {
  guild: GuildInstance & { config: GuildConfig | null }
  member: Member
  session: Session
  locale: Locale
}

async function completeQuickSetup(guildId: string, data: Partial<QuickSetupData> & { markComplete: boolean }) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')

  const { markComplete, ...rest } = data
  const updateData: Record<string, unknown> = { ...rest }
  if (markComplete) updateData['onboardingCompletedAt'] = new Date()

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: updateData,
    create: { guildId, ...updateData },
  })

  await botClient.reloadConfig(member.guild.discordGuildId).catch(() => {})

  await prisma.auditLog.create({
    data: { guildId, adminId: member.id, action: 'QUICK_SETUP_COMPLETED', after: rest as never },
  })

  revalidatePath(`/dashboard/${guildId}`, 'layout')
}

export default async function Header({ guild, member, session, locale }: Props) {
  const userAvatar = avatarUrl(member.discordUserId, member.discordAvatar)
  const tr = getT(locale)

  const canEditSettings = hasPermission(member.panelRole, 'settings.edit')

  const [unreadCount, channels] = await Promise.all([
    prisma.notification.count({
      where: { guildId: guild.id, userId: member.discordUserId, isRead: false },
    }),
    canEditSettings ? fetchDiscordChannels(guild.discordGuildId) : Promise.resolve([]),
  ])

  const quickSetupInitial: QuickSetupData = {
    panelName: guild.config?.panelName ?? 'Panel de gestion',
    accentColor: guild.config?.accentColor ?? '#6366f1',
    presenceChannelId: guild.config?.presenceChannelId ?? null,
    warningChannelId: guild.config?.warningChannelId ?? null,
    notificationChannelId: guild.config?.notificationChannelId ?? null,
    logChannelId: guild.config?.logChannelId ?? null,
    presenceEnabled: guild.config?.presenceEnabled ?? true,
    absenceEnabled: guild.config?.absenceEnabled ?? true,
    warningEnabled: guild.config?.warningEnabled ?? true,
    contributionEnabled: guild.config?.contributionEnabled ?? true,
    accountingEnabled: guild.config?.accountingEnabled ?? true,
    vdaEnabled: guild.config?.vdaEnabled ?? false,
    presenceMessageTime: guild.config?.presenceMessageTime ?? '08:00',
    reminderTime: guild.config?.reminderTime ?? '18:00',
    timezone: guild.config?.timezone ?? 'Europe/Paris',
  }
  const autoOpenQuickSetup = !!guild.config && !guild.config.onboardingCompletedAt

  const quickSetupAction = completeQuickSetup.bind(null, guild.id)

  return (
    <header
      className="h-12 px-5 flex items-center justify-between gap-3 sticky top-0 z-20"
      style={{
        background: 'var(--glass)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-3">
        <MobileSidebar guild={guild} member={member} locale={locale} />
        <span className="text-sm font-medium hidden sm:block truncate max-w-[160px]" style={{ color: 'var(--text-2)' }}>
          {guild.config?.panelName ?? guild.discordGuildName}
        </span>
      </div>

      <GlobalSearch guildId={guild.id} locale={locale} />

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <LocaleSwitcher locale={locale} />

        {canEditSettings && (
          <QuickSetupWizard
            initialData={quickSetupInitial}
            channels={channels}
            autoOpen={autoOpenQuickSetup}
            completeAction={quickSetupAction}
            q={tr.quickSetup}
          />
        )}

        <Link
          href={`/dashboard/${guild.id}/notifications`}
          className="relative w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--hover)] transition-colors"
          style={{ color: 'var(--text-3)' }}
          title={tr.nav.settings}
        >
          <Bell size={15} />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--danger)' }}
            />
          )}
        </Link>

        <div className="flex items-center gap-2 pl-2 ml-1" style={{ borderLeft: '1px solid var(--border)' }}>
          <img src={userAvatar} alt={member.discordUsername} className="w-6 h-6 rounded-full flex-shrink-0" style={{ outline: '1px solid var(--border)' }} />
          <span className="text-sm font-medium hidden md:block" style={{ color: 'var(--text)' }}>
            {member.discordNickname ?? member.discordUsername}
          </span>
        </div>

        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/' })
          }}
        >
          <button
            type="submit"
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--hover)] hover:text-[var(--danger)] transition-colors text-[var(--text-3)]"
            title={tr.common.logout}
          >
            <LogOut size={14} />
          </button>
        </form>
      </div>
    </header>
  )
}
