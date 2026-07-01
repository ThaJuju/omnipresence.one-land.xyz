import { signOut } from '@/lib/auth'
import Link from 'next/link'
import { Bell, LogOut } from 'lucide-react'
import { avatarUrl } from '@/lib/utils'
import { prisma } from '@repo/db'
import type { GuildInstance, GuildConfig, Member } from '@repo/db'
import type { Session } from 'next-auth'
import MobileSidebar from './MobileSidebar'
import GlobalSearch from '@/components/dashboard/GlobalSearch'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import ThemeToggle from '@/components/ThemeToggle'
import type { Locale } from '@/i18n/translations'
import { getT } from '@/i18n/translations'

type Props = {
  guild: GuildInstance & { config: GuildConfig | null }
  member: Member
  session: Session
  locale: Locale
}

export default async function Header({ guild, member, session, locale }: Props) {
  const userAvatar = avatarUrl(member.discordUserId, member.discordAvatar)
  const tr = getT(locale)

  const unreadCount = await prisma.notification.count({
    where: { guildId: guild.id, userId: member.discordUserId, isRead: false },
  })

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
