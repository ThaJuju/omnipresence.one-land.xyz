'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getGuildMember, requirePermission } from '@/lib/api'
import { getLocale } from '@/i18n/server'
import { getT } from '@/i18n/translations'
import LanguageSwitcherSettings from '@/components/LanguageSwitcherSettings'
import ResetGuildButton from '@/components/ResetGuildButton'
import type { Locale } from '@/i18n/translations'

async function saveGeneralConfig(guildId: string, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')

  const panelName = formData.get('panelName') as string
  const accentColor = formData.get('accentColor') as string
  const timezone = formData.get('timezone') as string

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { panelName, accentColor, timezone },
    create: { guildId, panelName, accentColor, timezone },
  })

  revalidatePath(`/dashboard/${guildId}/settings`)
}

async function saveLanguage(guildId: string, locale: Locale) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { botLanguage: locale },
    create: { guildId, botLanguage: locale },
  })

  revalidatePath(`/dashboard/${guildId}/settings`)
}

export default async function SettingsPage({ params }: { params: { guildId: string } }) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params
  const locale = getLocale()
  const tr = getT(locale)

  const guild = await prisma.guildInstance.findUnique({
    where: { id: guildId },
    include: { config: true },
  })
  if (!guild) redirect('/dashboard')

  async function resetGuild() {
    'use server'
    const session2 = await auth()
    if (!session2?.user?.discordId) return
    const member2 = await getGuildMember(guildId, session2.user.discordId)
    requirePermission(member2.panelRole, 'settings.edit')
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
    revalidatePath(`/dashboard/${guildId}/settings`)
  }

  const saveConfig = saveGeneralConfig.bind(null, guildId)
  const saveLang = saveLanguage.bind(null, guildId)

  const timezones = [
    'Europe/Paris', 'Europe/London', 'Europe/Berlin', 'Europe/Madrid',
    'America/New_York', 'America/Los_Angeles', 'America/Chicago',
    'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney',
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">{tr.settings.appearanceTitle}</h2>
        <p className="text-sm text-[var(--text-2)] mt-0.5">{tr.settings.appearanceDesc}</p>
      </div>

      <form action={saveConfig} className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">{tr.settings.panelName}</label>
          <p className="text-xs text-[var(--text-3)] mb-2">{tr.settings.panelNameDesc}</p>
          <input
            name="panelName"
            defaultValue={guild.config?.panelName ?? 'Panel de gestion'}
            maxLength={50}
            className="w-full max-w-sm bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">{tr.settings.accentColor}</label>
          <p className="text-xs text-[var(--text-3)] mb-2">{tr.settings.accentColorDesc}</p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              name="accentColor"
              defaultValue={guild.config?.accentColor ?? '#6366f1'}
              className="h-10 w-14 bg-[var(--bg)] border border-white/[0.07] rounded-lg cursor-pointer p-1"
            />
            <span className="text-sm text-[var(--text-2)] font-mono">
              {guild.config?.accentColor ?? '#6366f1'}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">{tr.settings.timezone}</label>
          <p className="text-xs text-[var(--text-3)] mb-2">{tr.settings.timezoneDesc}</p>
          <select
            name="timezone"
            defaultValue={guild.config?.timezone ?? 'Europe/Paris'}
            className="w-full max-w-sm bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div className="pt-1 border-t border-white/[0.07]">
          <button
            type="submit"
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-80 hover:bg-[var(--accent)] transition-colors"
          >
            {tr.common.save}
          </button>
        </div>
      </form>

      {/* Language settings */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">Langue / Language</h2>
        <p className="text-sm text-[var(--text-2)] mt-0.5">{tr.settings.panelLanguageDesc}</p>
      </div>

      <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-5">
        <label className="block text-sm font-medium text-[var(--text)] mb-1">{tr.settings.panelLanguage}</label>
        <p className="text-xs text-[var(--text-3)] mb-3">{tr.settings.botLanguageDesc}</p>
        <LanguageSwitcherSettings locale={locale} saveAction={saveLang} />
      </div>

      {/* Danger zone */}
      <div>
        <h2 className="text-lg font-semibold text-[#ef4444]">Zone dangereuse</h2>
        <p className="text-sm text-[var(--text-2)] mt-0.5">Ces actions sont irréversibles. Procéder avec précaution.</p>
      </div>

      <div className="bg-[var(--surface)] rounded-md border border-[#ef444430] p-5">
        <p className="text-sm text-[var(--text-2)] mb-4">
          Réinitialise toutes les données opérationnelles de la guild. La configuration, les membres et les grades seront conservés.
        </p>
        <ResetGuildButton guildName={guild.discordGuildName} resetAction={resetGuild} />
      </div>
    </div>
  )
}
