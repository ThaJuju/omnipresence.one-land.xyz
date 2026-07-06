'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { getGuildMember, requirePermission } from '@/lib/api'
import { botClient } from '@/lib/bot-client'
import type { GuildConfig } from '@repo/db'
import { getLocale } from '@/i18n/server'
import { getT } from '@/i18n/translations'
import { AlertTriangle, BookOpen, CalendarX, CheckSquare, FolderKanban, Wallet } from 'lucide-react'

async function toggleOption(guildId: string, key: keyof GuildConfig, currentValue: boolean) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { [key]: !currentValue },
    create: { guildId, [key]: !currentValue },
  })

  await botClient.reloadConfig(member.guild.discordGuildId).catch(() => {})

  revalidatePath(`/dashboard/${guildId}/settings/modules`)
}

async function saveContribConfig(guildId: string, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')

  const data = {
    contributionPeriod: (formData.get('contributionPeriod') as string) || 'monthly',
    contributionAmount: formData.get('contributionAmount') ? parseFloat(formData.get('contributionAmount') as string) : null,
    contributionCurrency: (formData.get('contributionCurrency') as string) || 'EUR',
  }

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: data,
    create: { guildId, ...data },
  })

  revalidatePath(`/dashboard/${guildId}/settings/modules`)
}

function Toggle({ enabled, action }: { enabled: boolean; action: () => Promise<void> }) {
  return (
    <form action={action}>
      <button
        type="submit"
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
          enabled ? 'bg-[#22c55e]' : 'bg-[var(--surface-2)]'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </form>
  )
}

function SubOption({ label, desc, enabled, action, disabled = false }: {
  label: string; desc: string; enabled: boolean; action: () => Promise<void>; disabled?: boolean
}) {
  return (
    <div className={`flex items-center justify-between py-2.5 pl-4 border-l-2 ${disabled ? 'border-[var(--border)] opacity-40' : 'border-[var(--border)]'}`}>
      <div>
        <p className="text-sm text-[var(--text)]">{label}</p>
        <p className="text-xs text-[var(--text-3)]">{desc}</p>
      </div>
      {disabled ? (
        <div className="relative inline-flex h-5 w-9 items-center rounded-full bg-[var(--surface-2)] opacity-50 cursor-not-allowed">
          <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white translate-x-1" />
        </div>
      ) : (
        <form action={action}>
          <button
            type="submit"
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-[var(--accent)]' : 'bg-[var(--surface-2)]'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : 'translate-x-1'}`} />
          </button>
        </form>
      )}
    </div>
  )
}

export default async function ModulesSettingsPage({ params }: { params: { guildId: string } }) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params

  const t = getT(getLocale())
  const m = t.settingsModules
  const config = await prisma.guildConfig.findUnique({ where: { guildId } })
  const saveContribConfigAction = saveContribConfig.bind(null, guildId)

  const c = {
    presenceEnabled: config?.presenceEnabled ?? true,
    reminderEnabled: config?.reminderEnabled ?? true,
    absenceEnabled: config?.absenceEnabled ?? true,
    warningEnabled: config?.warningEnabled ?? true,
    autoWarningEnabled: config?.autoWarningEnabled ?? true,
    contributionEnabled: config?.contributionEnabled ?? true,
    accountingEnabled: config?.accountingEnabled ?? true,
    vdaEnabled: config?.vdaEnabled ?? false,
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">{m.title}</h2>
        <p className="text-[var(--text-2)] text-sm mt-1">{m.subtitle}</p>
      </div>

      <div className="space-y-3">

        {/* ── PRÉSENCES ── */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}><CheckSquare size={17} /></span>
              <div>
                <p className="font-medium text-[var(--text)]">{m.presences}</p>
                <p className="text-sm text-[var(--text-2)]">{m.presencesDesc}</p>
              </div>
            </div>
            <Toggle enabled={c.presenceEnabled} action={toggleOption.bind(null, guildId, 'presenceEnabled', c.presenceEnabled)} />
          </div>
          {c.presenceEnabled && (
            <div className="px-4 pb-3 space-y-1 border-t border-[var(--border)] pt-3">
              <SubOption
                label={m.reminderLabel}
                desc={m.reminderDesc}
                enabled={c.reminderEnabled}
                action={toggleOption.bind(null, guildId, 'reminderEnabled', c.reminderEnabled)}
              />
            </div>
          )}
        </div>

        {/* ── ABSENCES ── */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}><CalendarX size={17} /></span>
              <div>
                <p className="font-medium text-[var(--text)]">{m.absences}</p>
                <p className="text-sm text-[var(--text-2)]">{m.absencesDesc}</p>
              </div>
            </div>
            <Toggle enabled={c.absenceEnabled} action={toggleOption.bind(null, guildId, 'absenceEnabled', c.absenceEnabled)} />
          </div>
        </div>

        {/* ── AVERTISSEMENTS ── */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}><AlertTriangle size={17} /></span>
              <div>
                <p className="font-medium text-[var(--text)]">{m.warnings}</p>
                <p className="text-sm text-[var(--text-2)]">{m.warningsDesc}</p>
              </div>
            </div>
            <Toggle enabled={c.warningEnabled} action={toggleOption.bind(null, guildId, 'warningEnabled', c.warningEnabled)} />
          </div>
          {c.warningEnabled && (
            <div className="px-4 pb-3 space-y-1 border-t border-[var(--border)] pt-3">
              <SubOption
                label={m.autoWarningLabel}
                desc={m.autoWarningDesc}
                enabled={c.autoWarningEnabled}
                action={toggleOption.bind(null, guildId, 'autoWarningEnabled', c.autoWarningEnabled)}
                disabled={!c.presenceEnabled}
              />
              <div className="pt-1">
                <Link
                  href={`/dashboard/${guildId}/settings/warnings`}
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--accent)] hover:text-[#7289da] transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {m.configureThresholds}
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── COTISATIONS ── */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}><Wallet size={17} /></span>
              <div>
                <p className="font-medium text-[var(--text)]">{m.contributions}</p>
                <p className="text-sm text-[var(--text-2)]">{m.contributionsDesc}</p>
              </div>
            </div>
            <Toggle enabled={c.contributionEnabled} action={toggleOption.bind(null, guildId, 'contributionEnabled', c.contributionEnabled)} />
          </div>
          {c.contributionEnabled && (
            <div className="px-4 pb-4 border-t border-[var(--border)] pt-4">
              <form action={saveContribConfigAction} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">{m.periodicity}</label>
                  <select
                    name="contributionPeriod"
                    defaultValue={config?.contributionPeriod ?? 'monthly'}
                    className="w-full input px-3 py-2 text-sm"
                  >
                    <option value="daily">{m.periodDailyOpt}</option>
                    <option value="weekly">{m.periodWeeklyOpt}</option>
                    <option value="monthly">{m.periodMonthlyOpt}</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">{m.defaultAmount}</label>
                    <input
                      type="number"
                      name="contributionAmount"
                      step="0.01"
                      min="0"
                      defaultValue={config?.contributionAmount ?? ''}
                      placeholder={m.amountPlaceholder}
                      className="w-full input px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">{m.currency}</label>
                    <input
                      name="contributionCurrency"
                      defaultValue={config?.contributionCurrency ?? 'EUR'}
                      maxLength={4}
                      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] uppercase focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 btn-primary text-xs"
                >
                  {t.common.save}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ── COMPTABILITÉ ── */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}><BookOpen size={17} /></span>
              <div>
                <p className="font-medium text-[var(--text)]">{m.accounting}</p>
                <p className="text-sm text-[var(--text-2)]">{m.accountingDesc}</p>
              </div>
            </div>
            <Toggle enabled={c.accountingEnabled} action={toggleOption.bind(null, guildId, 'accountingEnabled', c.accountingEnabled)} />
          </div>
        </div>

        {/* ── VDA ── */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}><FolderKanban size={17} /></span>
              <div>
                <p className="font-medium text-[var(--text)]">VDA</p>
                <p className="text-sm text-[var(--text-2)]">{m.vdaDesc}</p>
              </div>
            </div>
            <Toggle enabled={c.vdaEnabled} action={toggleOption.bind(null, guildId, 'vdaEnabled', c.vdaEnabled)} />
          </div>
        </div>

      </div>
    </div>
  )
}
