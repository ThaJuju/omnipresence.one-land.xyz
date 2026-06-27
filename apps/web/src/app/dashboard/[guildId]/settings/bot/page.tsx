'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getGuildMember, requirePermission } from '@/lib/api'

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
    return channels.filter((c) => c.type === 0 || c.type === 5).sort((a, b) => a.position - b.position)
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

  const data = {
    presenceChannelId: (formData.get('presenceChannelId') as string) || null,
    embedTitle: (formData.get('embedTitle') as string) || '✅ Confirmation de présence',
    embedDescription: (formData.get('embedDescription') as string) || null,
    embedColor: (formData.get('embedColor') as string) || '#6366f1',
    presencePingRoleId: (formData.get('presencePingRoleId') as string) || null,
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

function RoleSelect({ name, defaultValue, roles, placeholder = '— Aucun —' }: {
  name: string; defaultValue?: string | null; roles: DiscordRole[]; placeholder?: string
}) {
  if (roles.length === 0) {
    return (
      <input name={name} defaultValue={defaultValue ?? ''} placeholder="ID du rôle Discord"
        className="w-full bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] font-mono placeholder-[#383865] focus:outline-none focus:border-[var(--accent)]" />
    )
  }
  return (
    <select name={name} defaultValue={defaultValue ?? ''}
      className="w-full bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]">
      <option value="">{placeholder}</option>
      {roles.map((r) => {
        const color = r.color ? `#${r.color.toString(16).padStart(6, '0')}` : undefined
        return <option key={r.id} value={r.id} style={color ? { color } : undefined}>{r.name}</option>
      })}
    </select>
  )
}

function ChannelSelect({ name, defaultValue, channels }: {
  name: string; defaultValue?: string | null; channels: DiscordChannel[]
}) {
  if (channels.length === 0) {
    return (
      <input name={name} defaultValue={defaultValue ?? ''} placeholder="ID du canal Discord"
        className="w-full bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] font-mono placeholder-[#383865] focus:outline-none focus:border-[var(--accent)]" />
    )
  }
  return (
    <select name={name} defaultValue={defaultValue ?? ''}
      className="w-full bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]">
      <option value="">— Aucun —</option>
      {channels.map((ch) => <option key={ch.id} value={ch.id}># {ch.name}</option>)}
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

  const presencePingRoleName = discordRoles.find((r) => r.id === config?.presencePingRoleId)?.name

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">Gestion du Bot</h2>
        <p className="text-[var(--text-2)] text-sm mt-1">Messages, embeds, déclencheurs manuels et synchronisation</p>
      </div>

      {/* Infos techniques */}
      <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-5">
        <h2 className="font-semibold text-[var(--text)] mb-4">Informations</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--text-2)]">ID Guild Discord</span>
            <code className="text-[var(--text)] font-mono text-xs">{guild.discordGuildId}</code>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-2)]">Créé le</span>
            <span className="text-[var(--text)]">{new Date(guild.createdAt).toLocaleDateString('fr-FR')}</span>
          </div>
          {config && (
            <>
              {config.presenceEnabled && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-2)]">Message présence</span>
                  <span className="text-[var(--text)]">{config.presenceMessageTime}</span>
                </div>
              )}
              {config.presenceEnabled && config.reminderEnabled && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-2)]">Rappel</span>
                  <span className="text-[var(--text)]">{config.reminderTime}</span>
                </div>
              )}
              {config.warningEnabled && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-2)]">Check avert.</span>
                  <span className="text-[var(--text)]">{config.warningCheckTime}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[var(--text-2)]">Timezone</span>
                <span className="text-[var(--text)]">{config.timezone}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Déclencheurs manuels */}
      <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-5">
        <h2 className="font-semibold text-[var(--text)] mb-1">Déclencheurs manuels</h2>
        <p className="text-xs text-[var(--text-3)] mb-4">Lance immédiatement une action sans attendre l&apos;heure planifiée.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {config?.presenceEnabled && (
            <form action={triggerPresenceAction}>
              <button type="submit"
                className="w-full flex flex-col items-start gap-1 bg-[var(--bg)] hover:bg-[#131338] border border-white/[0.07] hover:border-[var(--accent)] rounded-md p-4 text-left transition-all group">
                <span className="text-xl">✅</span>
                <span className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">Message présence</span>
                <span className="text-[11px] text-[var(--text-3)]">Envoie le message de présence du jour</span>
              </button>
            </form>
          )}
          {config?.presenceEnabled && config?.reminderEnabled && (
            <form action={triggerReminderAction}>
              <button type="submit"
                className="w-full flex flex-col items-start gap-1 bg-[var(--bg)] hover:bg-[#131338] border border-white/[0.07] hover:border-[#eab308] rounded-md p-4 text-left transition-all group">
                <span className="text-xl">⏰</span>
                <span className="text-sm font-semibold text-[var(--text)] group-hover:text-[#eab308] transition-colors">Rappel de présence</span>
                <span className="text-[11px] text-[var(--text-3)]">Mentionne les membres en attente</span>
              </button>
            </form>
          )}
          {config?.warningEnabled && (
            <form action={triggerWarningAction}>
              <button type="submit"
                className="w-full flex flex-col items-start gap-1 bg-[var(--bg)] hover:bg-[#131338] border border-white/[0.07] hover:border-[#ef4444] rounded-md p-4 text-left transition-all group">
                <span className="text-xl">⚠️</span>
                <span className="text-sm font-semibold text-[var(--text)] group-hover:text-[#ef4444] transition-colors">Check avertissements</span>
                <span className="text-[11px] text-[var(--text-3)]">Génère les avertissements automatiques</span>
              </button>
            </form>
          )}
          <form action={syncAction}>
            <button type="submit"
              className="w-full flex flex-col items-start gap-1 bg-[var(--bg)] hover:bg-[#131338] border border-white/[0.07] hover:border-[#22c55e] rounded-md p-4 text-left transition-all group">
              <span className="text-xl">🔄</span>
              <span className="text-sm font-semibold text-[var(--text)] group-hover:text-[#22c55e] transition-colors">Sync membres</span>
              <span className="text-[11px] text-[var(--text-3)]">Resynchronise les rôles Discord</span>
            </button>
          </form>
        </div>
      </div>

      {/* Embed de présence */}
      <form action={saveEmbedAction} className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-5 space-y-5">
        <div>
          <h2 className="font-semibold text-[var(--text)] mb-1">Embed de présence</h2>
          <p className="text-xs text-[var(--text-3)]">
            Personnalise le message Discord envoyé chaque jour. Dans la description, utilisez <code className="bg-[var(--bg)] px-1 rounded text-[var(--text-2)]">{'{date}'}</code> et <code className="bg-[var(--bg)] px-1 rounded text-[var(--text-2)]">{'{count}'}</code>.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Canal de destination</label>
          <p className="text-[11px] text-[var(--text-3)] mb-2">Canal Discord où le bot envoie le message de présence quotidien.</p>
          <ChannelSelect name="presenceChannelId" defaultValue={config?.presenceChannelId} channels={discordChannels} />
        </div>

        {/* Aperçu embed */}
        <div className="rounded-lg overflow-hidden border-l-4 bg-[var(--bg)] border border-white/[0.07]"
          style={{ borderLeftColor: config?.embedColor ?? '#6366f1' }}>
          <div className="px-4 py-3">
            <p className="text-sm font-semibold text-[var(--text)]">{config?.embedTitle || '✅ Confirmation de présence'}</p>
            <p className="text-xs text-[var(--text-2)] mt-1 leading-relaxed">
              {config?.embedDescription
                ? config.embedDescription.replace('{date}', 'lundi 24 juin').replace('{count}', String(guild.members.length))
                : `Bonjour ! Veuillez confirmer votre présence pour aujourd'hui.\n\nlundi 24 juin\n\n${guild.members.length} membre(s) à confirmer.`
              }
            </p>
          </div>
          <div className="px-4 pb-2 pt-0">
            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded bg-[#22c55e]/20 text-[#22c55e] text-xs font-medium">✅ Présent</span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded bg-[#ef4444]/20 text-[#ef4444] text-xs font-medium">❌ Absent</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Titre</label>
            <input name="embedTitle" defaultValue={config?.embedTitle ?? '✅ Confirmation de présence'}
              maxLength={200}
              className="w-full bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#383865] focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Couleur de l&apos;embed</label>
            <div className="flex gap-2">
              <input type="color" name="embedColor" defaultValue={config?.embedColor ?? '#6366f1'}
                className="h-9 w-12 bg-[var(--bg)] border border-white/[0.07] rounded cursor-pointer" />
              <input readOnly value={config?.embedColor ?? '#6366f1'}
                className="flex-1 bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text-2)] font-mono" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Description personnalisée (optionnel)</label>
          <textarea name="embedDescription" defaultValue={config?.embedDescription ?? ''}
            rows={3} placeholder={`Laissez vide pour la description par défaut.\nUtilisez {date} et {count} comme variables.`}
            className="w-full bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#383865] focus:outline-none focus:border-[var(--accent)] resize-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">
            Rôle à mentionner
            {presencePingRoleName && (
              <span className="ml-2 text-[var(--accent)]">@{presencePingRoleName}</span>
            )}
          </label>
          <p className="text-[11px] text-[var(--text-3)] mb-2">Rôle Discord pингé en tête du message de présence quotidien.</p>
          <RoleSelect name="presencePingRoleId" defaultValue={config?.presencePingRoleId} roles={discordRoles} placeholder="— Pas de mention —" />
        </div>

        <div className="flex justify-end">
          <button type="submit"
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-80 hover:bg-[var(--accent)] transition-colors">
            Sauvegarder l&apos;embed
          </button>
        </div>
      </form>

      {/* Envoyer un message libre */}
      <form action={sendMessageAction} className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-[var(--text)] mb-1">Envoyer un message</h2>
          <p className="text-xs text-[var(--text-3)]">Envoie un message texte libre dans n&apos;importe quel canal du serveur.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Canal</label>
          <ChannelSelect name="channelId" channels={discordChannels} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Message</label>
          <textarea name="content" rows={3} required placeholder="Contenu du message..."
            className="w-full bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#383865] focus:outline-none focus:border-[var(--accent)] resize-none" />
        </div>
        <div className="flex justify-end">
          <button type="submit"
            className="px-4 py-2 bg-[#22c55e] text-black rounded-lg text-sm font-medium hover:bg-[#16a34a] transition-colors">
            Envoyer
          </button>
        </div>
      </form>

    </div>
  )
}
