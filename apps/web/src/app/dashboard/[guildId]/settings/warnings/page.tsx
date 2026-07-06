'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getGuildMember, requirePermission } from '@/lib/api'
import ResetWarningsButton from './ResetWarningsButton'
import { getLocale } from '@/i18n/server'
import { getT } from '@/i18n/translations'

type DiscordRole = { id: string; name: string; color: number; position: number; managed: boolean }

async function fetchDiscordRoles(discordGuildId: string): Promise<DiscordRole[]> {
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${discordGuildId}/roles`, {
      headers: { Authorization: `Bot ${process.env['DISCORD_BOT_TOKEN']}` },
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const roles = await res.json() as DiscordRole[]
    return roles.filter((r) => r.id !== discordGuildId && !r.managed).sort((a, b) => b.position - a.position)
  } catch { return [] }
}

async function saveWarningConfig(guildId: string, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: {
      warningCheckEnabled: formData.get('warningCheckEnabled') === 'on',
      warningCheckTime: formData.get('warningCheckTime') as string,
    },
    create: {
      guildId,
      warningCheckEnabled: formData.get('warningCheckEnabled') === 'on',
      warningCheckTime: formData.get('warningCheckTime') as string,
    },
  })

  revalidatePath(`/dashboard/${guildId}/settings/warnings`)
}

async function addThreshold(guildId: string, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')

  const threshold = parseInt(formData.get('threshold') as string)
  const discordRoleId = formData.get('discordRoleId') as string
  if (!threshold || threshold < 1 || !discordRoleId) return

  await prisma.warningThreshold.upsert({
    where: { guildId_threshold: { guildId, threshold } },
    update: { discordRoleId },
    create: { guildId, threshold, discordRoleId },
  })
  revalidatePath(`/dashboard/${guildId}/settings/warnings`)
}

async function deleteThreshold(guildId: string, id: string) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')

  await prisma.warningThreshold.delete({ where: { id, guildId } })
  revalidatePath(`/dashboard/${guildId}/settings/warnings`)
}

export default async function WarningsSettingsPage({ params }: { params: { guildId: string } }) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params

  const guild = await prisma.guildInstance.findUnique({
    where: { id: guildId },
    include: { config: true },
  })
  if (!guild) redirect('/dashboard')

  const currentMember = await prisma.member.findUnique({
    where: { guildId_discordUserId: { guildId, discordUserId: session.user.discordId } },
    select: { panelRole: true },
  })
  const isAdmin = currentMember?.panelRole === 'ADMIN'

  const [thresholds, discordRoles] = await Promise.all([
    prisma.warningThreshold.findMany({ where: { guildId }, orderBy: { threshold: 'asc' } }),
    fetchDiscordRoles(guild.discordGuildId),
  ])

  const roleMap = new Map(discordRoles.map((r) => [r.id, r]))
  const addAction = addThreshold.bind(null, guildId)
  const saveConfig = saveWarningConfig.bind(null, guildId)

  const warningEnabled = guild.config?.warningEnabled ?? true
  const locale = getLocale()
  const t = getT(locale)
  const w = t.settingsWarnings

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">{w.title}</h2>
        <p className="text-[var(--text-2)] text-sm mt-1">{w.subtitle}</p>
      </div>

      {!warningEnabled && (
        <div className="bg-[#eab308]/10 border border-[#eab308]/30 rounded-md p-4 text-sm text-[var(--warning)]">
          {w.moduleDisabled}{' '}
          <a href={`/dashboard/${guildId}/settings/modules`} className="underline">{w.enableInModules}</a>
        </div>
      )}

      {/* Rôle immédiat + vérification quotidienne */}
      <form action={saveConfig} className="card p-5 space-y-5">
        <h3 className="font-semibold text-[var(--text)]">{w.generalConfig}</h3>

        {/* Vérification quotidienne */}
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-0.5">{w.dailyCheck}</label>
          <p className="text-xs text-[var(--text-3)] mb-2">{w.dailyCheckDesc}</p>
          <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                name="warningCheckEnabled"
                defaultChecked={guild.config?.warningCheckEnabled ?? true}
                className="sr-only peer"
              />
              <div className="relative w-9 h-5 rounded-full bg-[var(--surface-2)] peer-checked:bg-[var(--accent)] transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:rounded-full after:bg-[var(--text-3)] after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-white" />
            </label>
            <span className="text-sm text-[var(--text)] flex-1">{w.enabledLabel}</span>
            <input
              type="time"
              name="warningCheckTime"
              defaultValue={guild.config?.warningCheckTime ?? '22:00'}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <div className="pt-1 border-t border-[var(--border)]">
          <button
            type="submit"
            className="px-4 py-2 btn-primary text-sm"
          >
            {t.common.save}
          </button>
        </div>
      </form>

      {/* Seuils d'escalade */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="font-semibold text-[var(--text)]">{w.thresholds}</h3>
          <p className="text-xs text-[var(--text-3)] mt-0.5">{w.thresholdsDesc}</p>
        </div>

        {thresholds.length === 0 ? (
          <div className="px-5 py-10 text-center text-[var(--text-3)] text-sm">
            {w.noThresholds}
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {thresholds.map((th) => {
              const role = roleMap.get(th.discordRoleId)
              const roleColor = role?.color ? `#${role.color.toString(16).padStart(6, '0')}` : 'var(--text-2)'
              const deleteAction = deleteThreshold.bind(null, guildId, th.id)
              return (
                <li key={th.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[var(--text-3)] text-xs">{w.atLabel}</span>
                    <span className="text-xl font-bold text-[var(--text)] w-6 text-center">{th.threshold}</span>
                    <span className="text-[var(--text-3)] text-xs">{w.warnAbbrev}</span>
                  </div>
                  <span className="text-[var(--text-3)]">→</span>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: roleColor }} />
                    <span className="text-sm font-medium truncate" style={{ color: roleColor }}>
                      {role?.name ?? th.discordRoleId}
                    </span>
                    {!role && (
                      <span className="text-[10px] text-[var(--danger)] bg-[#ef4444]/10 px-1.5 py-0.5 rounded">{w.roleNotFound}</span>
                    )}
                  </div>
                  <form action={deleteAction} className="flex-shrink-0">
                    <button type="submit" className="text-xs text-[var(--danger)] hover:text-[#ff6b81] px-2 py-1 transition-colors">
                      {t.common.delete}
                    </button>
                  </form>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Ajouter un seuil */}
      <form action={addAction} className="card p-5 space-y-4">
        <h3 className="font-semibold text-[var(--text)]">{w.addThreshold}</h3>
        <p className="text-xs text-[var(--text-3)]">{w.addThresholdDesc}</p>
        <div className="flex gap-3 flex-wrap sm:flex-nowrap items-end">
          <div className="flex-shrink-0">
            <label className="block text-xs text-[var(--text-2)] mb-1.5">{w.warningCountLabel}</label>
            <input
              type="number"
              name="threshold"
              min={1}
              max={99}
              required
              placeholder="1"
              className="w-24 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] text-center focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs text-[var(--text-2)] mb-1.5">{w.roleToAssign}</label>
            {discordRoles.length > 0 ? (
              <select
                name="discordRoleId"
                required
                className="w-full input px-3 py-2 text-sm"
              >
                <option value="">{w.chooseRole}</option>
                {discordRoles.map((r) => {
                  const color = r.color ? `#${r.color.toString(16).padStart(6, '0')}` : undefined
                  return (
                    <option key={r.id} value={r.id} style={color ? { color } : undefined}>
                      {r.name}
                    </option>
                  )
                })}
              </select>
            ) : (
              <input
                name="discordRoleId"
                required
                placeholder={w.roleIdPlaceholder}
                className="w-full input px-3 py-2 text-sm font-mono"
              />
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2 btn-primary text-sm whitespace-nowrap"
          >
            {w.addBtn}
          </button>
        </div>
      </form>

      {/* Zone danger — ADMIN uniquement */}
      {isAdmin && (
        <div className="bg-[var(--surface)] rounded-md border border-[#ef4444]/20 p-5 space-y-3">
          <div>
            <h3 className="font-semibold text-[var(--danger)]">{w.dangerZone}</h3>
            <p className="text-xs text-[var(--text-3)] mt-0.5">
              {w.dangerZoneDesc}
            </p>
          </div>
          <div className="border-t border-[var(--border)] pt-4 space-y-2">
            <p className="text-sm text-[var(--text)]">{w.resetTitle}</p>
            <p className="text-xs text-[var(--text-3)]">
              {w.resetDesc}
            </p>
            <ResetWarningsButton guildId={guildId} locale={locale} />
          </div>
        </div>
      )}
    </div>
  )
}
