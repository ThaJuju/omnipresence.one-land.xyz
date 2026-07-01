'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getT, type Locale } from '@/i18n/translations'

type ModuleFlags = {
  warningEnabled: boolean
  presenceEnabled: boolean
  contributionEnabled: boolean
  accountingEnabled: boolean
  vdaEnabled: boolean
  absenceEnabled: boolean
}

type NavItem = {
  href: string
  label: string
  icon: string
  module?: keyof ModuleFlags
}

type NavGroup = {
  group: string
  items: NavItem[]
}

export default function SettingsNav({
  guildId,
  modules,
  locale,
}: {
  guildId: string
  modules: ModuleFlags
  locale: Locale
}) {
  const tr = getT(locale)
  const pathname = usePathname()
  const base = `/dashboard/${guildId}/settings`

  const allGroups: NavGroup[] = [
    {
      group: tr.settings.groupGeneral,
      items: [
        { href: base, label: tr.settings.navAppearance, icon: '🎨' },
        { href: `${base}/modules`, label: tr.settings.navModules, icon: '🧩' },
      ],
    },
    {
      group: tr.settings.groupDiscord,
      items: [
        { href: `${base}/discord`, label: tr.settings.navDiscord, icon: '📢' },
        { href: `${base}/roles`, label: tr.settings.navRoles, icon: '🔗' },
        { href: `${base}/warnings`, label: tr.settings.navWarnings, icon: '⚠️', module: 'warningEnabled' },
        { href: `${base}/absence-embed`, label: tr.settings.navAbsenceEmbed, icon: '📋', module: 'absenceEnabled' },
      ],
    },
    {
      group: tr.settings.groupConfig,
      items: [
        { href: `${base}/grades`, label: tr.settings.navGrades, icon: '🏅' },
        { href: `${base}/bot`, label: tr.settings.navBot, icon: '🤖', module: 'presenceEnabled' },
      ],
    },
    {
      group: tr.settings.groupLogs,
      items: [{ href: `${base}/audit`, label: tr.settings.navAudit, icon: '📋' }],
    },
  ]

  const groups = allGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.module || modules[item.module]),
    }))
    .filter((group) => group.items.length > 0)

  const isActive = (href: string) =>
    href === base ? pathname === base : pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="w-full overflow-x-auto">
      <nav className="flex items-center gap-0 border-b border-[var(--border)] min-w-max">
        {groups.map((group, gi) => (
          <div key={group.group} className="flex items-center">
            {gi > 0 && <div className="w-px h-4 bg-[var(--surface-2)] mx-2 flex-shrink-0" />}
            <div className="flex items-center">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors whitespace-nowrap ${
                    isActive(item.href)
                      ? 'text-[var(--text)] font-medium'
                      : 'text-[var(--text-2)] hover:text-[#9898cc]'
                  }`}
                >
                  <span className="text-sm">{item.icon}</span>
                  {item.label}
                  {isActive(item.href) && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--guild-accent)] rounded-t" />
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  )
}
