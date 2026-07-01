'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, CheckSquare, CalendarX, AlertTriangle,
  Wallet, BookOpen, FolderKanban, BarChart3, Settings, X, Menu,
} from 'lucide-react'
import { cn, guildIconUrl, avatarUrl } from '@/lib/utils'
import { hasPermission } from '@repo/shared'
import type { PanelRole } from '@repo/shared'
import type { GuildInstance, GuildConfig, Member } from '@repo/db'
import { getT, type Locale } from '@/i18n/translations'

type Props = {
  guild: GuildInstance & { config: GuildConfig | null }
  member: Member
  locale: Locale
}

const NAV_ICON_MAP = {
  '': LayoutDashboard,
  '/members': Users,
  '/presences': CheckSquare,
  '/absences': CalendarX,
  '/warnings': AlertTriangle,
  '/contributions': Wallet,
  '/accounting': BookOpen,
  '/vda': FolderKanban,
  '/stats': BarChart3,
}

export default function MobileSidebar({ guild, member, locale }: Props) {
  const tr = getT(locale)
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const base = `/dashboard/${guild.id}`

  useEffect(() => { setOpen(false) }, [pathname])

  const NAV_ITEMS = [
    { href: '', label: tr.nav.dashboard, permission: null },
    { href: '/members', label: tr.nav.members, permission: 'members.view' as const },
    { href: '/presences', label: tr.nav.presences, permission: 'presences.view' as const, module: 'presenceEnabled' },
    { href: '/absences', label: tr.nav.absences, permission: 'absences.view' as const, module: 'absenceEnabled' },
    { href: '/warnings', label: tr.nav.warnings, permission: 'warnings.view' as const, module: 'warningEnabled' },
    { href: '/contributions', label: tr.nav.contributions, permission: 'contributions.view' as const, module: 'contributionEnabled' },
    { href: '/accounting', label: tr.nav.accounting, permission: 'accounting.view' as const, module: 'accountingEnabled' },
    { href: '/vda', label: tr.nav.vda, permission: 'vda.view' as const, module: 'vdaEnabled' },
  ]

  const filteredItems = NAV_ITEMS.filter((item) => {
    if (item.permission && !hasPermission(member.panelRole as PanelRole, item.permission)) return false
    if (item.module && guild.config) {
      const enabled = guild.config[item.module as keyof GuildConfig]
      if (enabled === false) return false
    }
    return true
  })

  const iconUrl = guildIconUrl(guild.discordGuildId, guild.discordGuildIcon)
  const userAvatar = avatarUrl(member.discordUserId, member.discordAvatar)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden p-2 rounded-md hover:bg-[var(--hover)] transition-colors"
        style={{ color: 'var(--text-2)' }}
        aria-label="Menu"
      >
        <Menu size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside
            className="absolute left-0 top-0 bottom-0 w-[236px] flex flex-col animate-float-in"
            style={{
              background: 'linear-gradient(180deg, color-mix(in srgb, var(--guild-accent) 3%, var(--surface)), var(--surface) 220px)',
              borderRight: '1px solid var(--border)',
              boxShadow: 'var(--shadow-pop)',
            }}
          >
            <div className="px-4 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2.5 min-w-0">
                {iconUrl ? (
                  <img src={iconUrl} alt={guild.discordGuildName} className="w-7 h-7 rounded-md object-cover flex-shrink-0" style={{ outline: '1px solid var(--border)' }} />
                ) : (
                  <div className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ background: 'var(--accent-grad)' }}>
                    {guild.discordGuildName[0]}
                  </div>
                )}
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                  {guild.config?.panelName ?? guild.discordGuildName}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md hover:bg-[var(--hover)] transition-colors flex-shrink-0"
                style={{ color: 'var(--text-3)' }}
              >
                <X size={16} />
              </button>
            </div>

            <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
              {filteredItems.map((item) => {
                const href = `${base}${item.href}`
                const isActive = item.href === '' ? pathname === base : pathname.startsWith(href)
                const Icon = NAV_ICON_MAP[item.href as keyof typeof NAV_ICON_MAP] ?? LayoutDashboard

                return (
                  <Link
                    key={item.href}
                    href={href}
                    className={cn(
                      'group flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 relative',
                      isActive ? '' : 'hover:bg-[var(--hover)]'
                    )}
                    style={isActive
                      ? { background: 'var(--accent-dim)', color: 'var(--guild-accent)' }
                      : { color: 'var(--text-2)' }
                    }
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r"
                        style={{ background: 'var(--guild-accent)', boxShadow: '0 0 10px var(--guild-accent)' }}
                      />
                    )}
                    <Icon size={15} className="flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}

              {hasPermission(member.panelRole as PanelRole, 'settings.view') && (
                <>
                  <div className="mx-1 my-3" style={{ borderTop: '1px solid var(--border)' }} />
                  {(() => {
                    const isActive = pathname.startsWith(`${base}/settings`)
                    return (
                      <Link
                        href={`${base}/settings`}
                        className={cn(
                          'group flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 relative',
                          isActive ? '' : 'hover:bg-[var(--hover)]'
                        )}
                        style={isActive
                          ? { background: 'var(--accent-dim)', color: 'var(--guild-accent)' }
                          : { color: 'var(--text-2)' }
                        }
                      >
                        {isActive && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r"
                            style={{ background: 'var(--guild-accent)', boxShadow: '0 0 10px var(--guild-accent)' }}
                          />
                        )}
                        <Settings size={15} className="flex-shrink-0" />
                        <span>{tr.nav.settings}</span>
                      </Link>
                    )
                  })()}
                </>
              )}
            </nav>

            <div className="p-2" style={{ borderTop: '1px solid var(--border)' }}>
              <Link href="/dashboard" className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-[var(--hover)] transition-colors">
                <img src={userAvatar} alt={member.discordUsername} className="w-7 h-7 rounded-full flex-shrink-0" style={{ outline: '1px solid var(--border)' }} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate leading-tight" style={{ color: 'var(--text)' }}>
                    {member.discordNickname ?? member.discordUsername}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{member.panelRole}</p>
                </div>
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
