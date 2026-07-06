'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getGuildMember, requirePermission } from '@/lib/api'
import MultiRolePicker from './MultiRolePicker'
import { getLocale } from '@/i18n/server'
import { getT, type Translations } from '@/i18n/translations'

type DiscordRole = { id: string; name: string; color: number; position: number; managed: boolean }
type DiscordChannel = { id: string; name: string; type: number; parent_id: string | null; position: number }

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

async function fetchDiscordChannels(discordGuildId: string): Promise<DiscordChannel[]> {
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${discordGuildId}/channels`, {
      headers: { Authorization: `Bot ${process.env['DISCORD_BOT_TOKEN']}` },
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const channels = await res.json() as DiscordChannel[]
    return channels.filter((c) => c.type === 0 || c.type === 4 || c.type === 5).sort((a, b) => a.position - b.position)
  } catch { return [] }
}

async function callBot(path: string, body: object) {
  const secret = process.env['BOT_INTERNAL_SECRET']!
  const port = process.env['BOT_HTTP_PORT'] ?? '3001'
  const res = await fetch(`http://localhost:${port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function syncMembers(guildId: string) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')
  const guild = await prisma.guildInstance.findUnique({ where: { id: guildId } })
  if (!guild) return
  try { await callBot('/sync-guild', { discordGuildId: guild.discordGuildId }) } catch { /* bot may be offline */ }
  revalidatePath(`/dashboard/${guildId}/settings/bot`)
}

async function triggerPresence(guildId: string) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')
  try { await callBot('/trigger-presence', { guildId }) } catch { /* bot may be offline */ }
  revalidatePath(`/dashboard/${guildId}/settings/bot`)
}

async function triggerReminder(guildId: string) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')
  try { await callBot('/trigger-reminder', { guildId }) } catch { /* bot may be offline */ }
  revalidatePath(`/dashboard/${guildId}/settings/bot`)
}

async function triggerWarning(guildId: string) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')
  try { await callBot('/trigger-warning', { guildId }) } catch { /* bot may be offline */ }
  revalidatePath(`/dashboard/${guildId}/settings/bot`)
}

async function saveEmbedConfig(guildId: string, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')

  // Les titres par défaut FR/EN sont stockés sous forme du sentinel FR (défaut du schéma) :
  // le bot le remplace par sa version localisée selon botLanguage.
  const rawTitle = ((formData.get('embedTitle') as string) || '').trim()
  const isDefaultTitle = !rawTitle || rawTitle === '✅ Confirmation de présence' || rawTitle === '✅ Presence confirmation'

  const data = {
    presenceChannelId: (formData.get('presenceChannelId') as string) || null,
    embedTitle: isDefaultTitle ? '✅ Confirmation de présence' : rawTitle,
    embedDescription: (formData.get('embedDescription') as string) || null,
    embedColor: (formData.get('embedColor') as string) || '#6366f1',
    presencePingRoleIds: formData.getAll('presencePingRoleIds') as string[],
    presenceEmbedTime: (formData.get('presenceEmbedTime') as string) || null,
  }

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: data,
    create: { guildId, ...data },
  })

  const guild = await prisma.guildInstance.findUnique({ where: { id: guildId } })
  if (guild) {
    try { await callBot('/reload-config', { discordGuildId: guild.discordGuildId }) } catch { /* ok */ }
  }

  revalidatePath(`/dashboard/${guildId}/settings/bot`)
}

async function sendMessage(guildId: string, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')

  const channelId = formData.get('channelId') as string
  const content = formData.get('content') as string
  if (!channelId || !content?.trim()) return

  const guild = await prisma.guildInstance.findUnique({ where: { id: guildId } })
  if (!guild) return

  try {
    await callBot('/send-message', { discordGuildId: guild.discordGuildId, channelId, content })
  } catch { /* bot offline or bad channel */ }

  revalidatePath(`/dashboard/${guildId}/settings/bot`)
}

function ChannelSelect({ name, defaultValue, channels, b }: {
  name: string; defaultValue?: string | null; channels: DiscordChannel[]; b: Translations['settingsBot']
}) {
  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5)
  if (textChannels.length === 0) {
    return (
      <input name={name} defaultValue={defaultValue ?? ''} placeholder={b.channelIdPlaceholder}
        className="w-full input px-3 py-2 text-sm font-mono" />
    )
  }
  const categories = new Map(channels.filter((c) => c.type === 4).map((c) => [c.id, c]))
  const uncategorized = textChannels
    .filter((c) => !c.parent_id || !categories.has(c.parent_id))
    .sort((a, b) => a.position - b.position)
  const grouped = [...categories.values()]
    .sort((a, b) => a.position - b.position)
    .map((category) => ({
      category,
      channels: textChannels.filter((c) => c.parent_id === category.id).sort((a, b) => a.position - b.position),
    }))
    .filter((g) => g.channels.length > 0)

  return (
    <select name={name} defaultValue={defaultValue ?? ''}
      className="w-full input px-3 py-2 text-sm">
      <option value="">{b.noneOption}</option>
      {uncategorized.map((ch) => <option key={ch.id} value={ch.id}># {ch.name}</option>)}
      {grouped.map(({ category, channels: chs }) => (
        <optgroup key={category.id} label={category.name}>
          {chs.map((ch) => <option key={ch.id} value={ch.id}># {ch.name}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

export default async function BotSettingsPage({ params }: { params: { guildId: string } }) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params

  const guild = await prisma.guildInstance.findUnique({
    where: { id: guildId },
    include: { config: true, members: { where: { isActive: true } } },
  })
  if (!guild) redirect('/dashboard')

  const [discordRoles, discordChannels] = await Promise.all([
    fetchDiscordRoles(guild.discordGuildId),
    fetchDiscordChannels(guild.discordGuildId),
  ])

  const config = guild.config

  const syncAction = syncMembers.bind(null, guildId)
  const triggerPresenceAction = triggerPresence.bind(null, guildId)
  const triggerReminderAction = triggerReminder.bind(null, guildId)
  const triggerWarningAction = triggerWarning.bind(null, guildId)
  const saveEmbedAction = saveEmbedConfig.bind(null, guildId)
  const sendMessageAction = sendMessage.bind(null, guildId)

  const locale = getLocale()
  const t = getT(locale)
  const b = t.settingsBot

  const presencePingRoleIds = config?.presencePingRoleIds ?? []
  const previewEmbedTime = config?.presenceEmbedTime || config?.presenceMessageTime || '08:00'
  const previewDateStr = b.previewDate
  const isDefaultEmbedTitle = !config?.embedTitle || config.embedTitle === '✅ Confirmation de présence'
  const displayedEmbedTitle = isDefaultEmbedTitle ? b.defaultEmbedTitle : config!.embedTitle

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">{b.title}</h2>
        <p className="text-[var(--text-2)] text-sm mt-1">{b.subtitle}</p>
      </div>

      {/* Infos techniques */}
      <div className="card p-5">
        <h2 className="font-semibold text-[var(--text)] mb-4">{b.infoTitle}</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--text-2)]">{b.guildIdLabel}</span>
            <code className="text-[var(--text)] font-mono text-xs">{guild.discordGuildId}</code>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-2)]">{b.createdAt}</span>
            <span className="text-[var(--text)]">{new Date(guild.createdAt).toLocaleDateString(b.dateLocale)}</span>
          </div>
          {config && (
            <>
              {config.presenceEnabled && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-2)]">{b.presenceMsgLabel}</span>
                  <span className="text-[var(--text)]">{config.presenceMessageTime}</span>
                </div>
              )}
              {config.presenceEnabled && config.reminderEnabled && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-2)]">{b.reminderLabel}</span>
                  <span className="text-[var(--text)]">{config.reminderTime}</span>
                </div>
              )}
              {config.warningEnabled && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-2)]">{b.warningCheckLabel}</span>
                  <span className="text-[var(--text)]">{config.warningCheckTime}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[var(--text-2)]">{b.timezoneLabel}</span>
                <span className="text-[var(--text)]">{config.timezone}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Déclencheurs manuels */}
      <div className="card p-5">
        <h2 className="font-semibold text-[var(--text)] mb-1">{b.manualTriggers}</h2>
        <p className="text-xs text-[var(--text-3)] mb-4">{b.manualTriggersDesc}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {config?.presenceEnabled && (
            <form action={triggerPresenceAction}>
              <button type="submit"
                className="w-full flex flex-col items-start gap-1 bg-[var(--bg)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent)] rounded-md p-4 text-left transition-all group">
                <span className="text-xl">✅</span>
                <span className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">{b.triggerPresence}</span>
                <span className="text-[11px] text-[var(--text-3)]">{b.triggerPresenceDesc}</span>
              </button>
            </form>
          )}
          {config?.presenceEnabled && config?.reminderEnabled && (
            <form action={triggerReminderAction}>
              <button type="submit"
                className="w-full flex flex-col items-start gap-1 bg-[var(--bg)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-[#eab308] rounded-md p-4 text-left transition-all group">
                <span className="text-xl">⏰</span>
                <span className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--warning)] transition-colors">{b.triggerReminder}</span>
                <span className="text-[11px] text-[var(--text-3)]">{b.triggerReminderDesc}</span>
              </button>
            </form>
          )}
          {config?.warningEnabled && (
            <form action={triggerWarningAction}>
              <button type="submit"
                className="w-full flex flex-col items-start gap-1 bg-[var(--bg)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-[#ef4444] rounded-md p-4 text-left transition-all group">
                <span className="text-xl">⚠️</span>
                <span className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--danger)] transition-colors">{b.triggerWarning}</span>
                <span className="text-[11px] text-[var(--text-3)]">{b.triggerWarningDesc}</span>
              </button>
            </form>
          )}
          <form action={syncAction}>
            <button type="submit"
              className="w-full flex flex-col items-start gap-1 bg-[var(--bg)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-[#22c55e] rounded-md p-4 text-left transition-all group">
              <span className="text-xl">🔄</span>
              <span className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--success)] transition-colors">{b.triggerSync}</span>
              <span className="text-[11px] text-[var(--text-3)]">{b.triggerSyncDesc}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Embed de présence */}
      <form action={saveEmbedAction} className="card p-5 space-y-5">
        <div>
          <h2 className="font-semibold text-[var(--text)] mb-1">{b.presenceEmbed}</h2>
          <p className="text-xs text-[var(--text-3)]">
            {b.presenceEmbedDesc} <code className="bg-[var(--bg)] px-1 rounded text-[var(--text-2)]">{'{date}'}</code>, <code className="bg-[var(--bg)] px-1 rounded text-[var(--text-2)]">{'{time}'}</code> et <code className="bg-[var(--bg)] px-1 rounded text-[var(--text-2)]">{'{count}'}</code>.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">{b.destChannel}</label>
          <p className="text-[11px] text-[var(--text-3)] mb-2">{b.destChannelDesc}</p>
          <ChannelSelect name="presenceChannelId" defaultValue={config?.presenceChannelId} channels={discordChannels} b={b} />
        </div>

        {/* Aperçu embed */}
        <div className="rounded-lg overflow-hidden border-l-4 bg-[var(--bg)] border border-[var(--border)]"
          style={{ borderLeftColor: config?.embedColor ?? '#6366f1' }}>
          <div className="px-4 py-3">
            <p className="text-sm font-semibold text-[var(--text)]">{displayedEmbedTitle}</p>
            <p className="text-xs text-[var(--text-2)] mt-1 leading-relaxed">
              {config?.embedDescription
                ? config.embedDescription.replace('{date}', previewDateStr).replace('{time}', previewEmbedTime).replace('{count}', String(guild.members.length))
                : b.previewBody(previewDateStr, previewEmbedTime, guild.members.length)
              }
            </p>
          </div>
          <div className="px-4 pb-2 pt-0">
            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded bg-[#22c55e]/20 text-[var(--success)] text-xs font-medium">{b.previewPresent}</span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded bg-[#ef4444]/20 text-[var(--danger)] text-xs font-medium">{b.previewAbsent}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">{b.embedTitleLabel}</label>
            <input name="embedTitle" defaultValue={displayedEmbedTitle}
              maxLength={200}
              className="w-full input px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">{b.embedColorLabel}</label>
            <div className="flex gap-2">
              <input type="color" name="embedColor" defaultValue={config?.embedColor ?? '#6366f1'}
                className="h-9 w-12 bg-[var(--bg)] border border-[var(--border)] rounded cursor-pointer" />
              <input readOnly value={config?.embedColor ?? '#6366f1'}
                className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-2)] font-mono" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">{b.embedTimeLabel}</label>
          <p className="text-[11px] text-[var(--text-3)] mb-2">{b.embedTimeDesc(config?.presenceMessageTime ?? '08:00')}</p>
          <input type="time" name="presenceEmbedTime" defaultValue={config?.presenceEmbedTime ?? ''}
            className="input px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">{b.customDesc}</label>
          <textarea name="embedDescription" defaultValue={config?.embedDescription ?? ''}
            rows={3} placeholder={b.customDescPlaceholder}
            className="w-full input px-3 py-2 text-sm resize-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">{b.pingRoles}</label>
          <p className="text-[11px] text-[var(--text-3)] mb-2">{b.pingRolesDesc}</p>
          <MultiRolePicker name="presencePingRoleIds" defaultValues={presencePingRoleIds} roles={discordRoles} locale={locale} />
        </div>

        <div className="flex justify-end">
          <button type="submit"
            className="px-4 py-2 btn-primary text-sm">
            {b.saveEmbed}
          </button>
        </div>
      </form>

      {/* Envoyer un message libre */}
      <form action={sendMessageAction} className="card p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-[var(--text)] mb-1">{b.sendMessageTitle}</h2>
          <p className="text-xs text-[var(--text-3)]">{b.sendMessageDesc}</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">{b.channelLabel}</label>
          <ChannelSelect name="channelId" channels={discordChannels} b={b} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">{b.messageLabel}</label>
          <textarea name="content" rows={3} required placeholder={b.messagePlaceholder}
            className="w-full input px-3 py-2 text-sm resize-none" />
        </div>
        <div className="flex justify-end">
          <button type="submit"
            className="px-4 py-2 bg-[#22c55e] text-black rounded-lg text-sm font-medium hover:bg-[#16a34a] transition-colors">
            {b.sendBtn}
          </button>
        </div>
      </form>

    </div>
  )
}
