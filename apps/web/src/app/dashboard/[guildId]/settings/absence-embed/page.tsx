'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getGuildMember, requirePermission } from '@/lib/api'
import PublishAbsenceButton from './PublishAbsenceButton'

type DiscordChannel = { id: string; name: string; type: number; position: number }

async function fetchDiscordChannels(discordGuildId: string): Promise<DiscordChannel[]> {
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${discordGuildId}/channels`, {
      headers: { Authorization: `Bot ${process.env['DISCORD_BOT_TOKEN']}` },
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const channels = (await res.json()) as DiscordChannel[]
    return channels.filter((c) => c.type === 0 || c.type === 5).sort((a, b) => a.position - b.position)
  } catch {
    return []
  }
}

async function saveConfig(guildId: string, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: {
      absenceChannelId: (formData.get('absenceChannelId') as string) || null,
      absenceNotifChannelId: (formData.get('absenceNotifChannelId') as string) || null,
      absenceEmbedTitle: (formData.get('absenceEmbedTitle') as string) || null,
      absenceEmbedBody: (formData.get('absenceEmbedBody') as string) || null,
    },
    create: {
      guildId,
      absenceChannelId: (formData.get('absenceChannelId') as string) || null,
      absenceNotifChannelId: (formData.get('absenceNotifChannelId') as string) || null,
      absenceEmbedTitle: (formData.get('absenceEmbedTitle') as string) || null,
      absenceEmbedBody: (formData.get('absenceEmbedBody') as string) || null,
    },
  })

  revalidatePath(`/dashboard/${guildId}/settings/absence-embed`)
}

async function publishEmbed(guildId: string): Promise<{ success: boolean; error?: string }> {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return { success: false, error: 'Non authentifié' }
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')

  const secret = process.env['BOT_INTERNAL_SECRET']!
  const port = process.env['BOT_HTTP_PORT'] ?? '3001'
  try {
    const res = await fetch(`http://localhost:${port}/post-absence-embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
      body: JSON.stringify({ guildId }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      return { success: false, error: body.error ?? 'Erreur inconnue' }
    }
    revalidatePath(`/dashboard/${guildId}/settings/absence-embed`)
    return { success: true }
  } catch {
    return { success: false, error: 'Bot hors ligne' }
  }
}

function ChannelSelect({
  name,
  defaultValue,
  channels,
}: {
  name: string
  defaultValue: string | null | undefined
  channels: DiscordChannel[]
}) {
  if (channels.length === 0) {
    return (
      <input
        name={name}
        defaultValue={defaultValue ?? ''}
        placeholder="ID du canal Discord"
        className="w-full input px-3 py-2 text-sm font-mono"
      />
    )
  }
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ''}
      className="w-full input px-3 py-2 text-sm"
    >
      <option value="">— Aucun —</option>
      {channels.map((ch) => (
        <option key={ch.id} value={ch.id}>
          # {ch.name}
        </option>
      ))}
    </select>
  )
}

export default async function AbsenceEmbedPage({ params }: { params: { guildId: string } }) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params

  const guild = await prisma.guildInstance.findUnique({ where: { id: guildId } })
  if (!guild) redirect('/dashboard')

  const [config, channels] = await Promise.all([
    prisma.guildConfig.findUnique({ where: { guildId } }),
    fetchDiscordChannels(guild.discordGuildId),
  ])

  const lang = config?.botLanguage ?? 'fr'

  const defaultTitle = lang === 'en' ? "📋 Absence Declaration" : "📋 Déclaration d'absence"
  const defaultBody = lang === 'en'
    ? "Would you like to declare an absence?\n\nClick the button below to open the form. Your request will be submitted pending validation by a manager."
    : "Vous souhaitez déclarer une absence ?\n\nCliquez sur le bouton ci-dessous pour ouvrir le formulaire. Votre demande sera soumise en attente de validation par un responsable."

  const saveAction = saveConfig.bind(null, guildId)
  const publishAction = publishEmbed.bind(null, guildId)

  const isPublished = !!config?.absenceEmbedMessageId
  const hasChannel = !!config?.absenceChannelId

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">Embed d&apos;absence</h2>
        <p className="text-[var(--text-2)] text-sm mt-1">
          Publiez un embed permanent dans un canal Discord. Les membres cliquent sur le bouton pour déclarer une absence.
        </p>
      </div>

      {/* Status */}
      <div className={`rounded-md border p-4 flex items-center gap-3 ${isPublished ? 'bg-[#0d1f14] border-[#22c55e30]' : 'bg-[var(--surface)] border-[var(--border)]'}`}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isPublished ? 'bg-[#22c55e]' : 'bg-[var(--text-3)]'}`} />
        <div>
          <p className="text-sm font-medium text-[var(--text)]">
            {isPublished ? 'Embed publié' : 'Embed non publié'}
          </p>
          {isPublished && (
            <p className="text-xs text-[var(--text-2)] mt-0.5 font-mono">{config.absenceEmbedMessageId}</p>
          )}
          {!isPublished && (
            <p className="text-xs text-[var(--text-3)] mt-0.5">
              Configurez un canal et cliquez sur &quot;Publier dans Discord&quot;
            </p>
          )}
        </div>
      </div>

      <form action={saveAction} className="space-y-5">
        {/* Canaux */}
        <div className="card p-5 space-y-5">
          <h3 className="font-semibold text-[var(--text)]">Canaux</h3>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-0.5">Canal de l&apos;embed</label>
            <p className="text-xs text-[var(--text-3)] mb-2">Canal où est posté l&apos;embed persistant avec le bouton (texte ou annonces)</p>
            <ChannelSelect name="absenceChannelId" defaultValue={config?.absenceChannelId} channels={channels} />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-0.5">Canal de notifications</label>
            <p className="text-xs text-[var(--text-3)] mb-2">Canal où le bot envoie un embed à chaque nouvelle demande d&apos;absence (peut être un salon admin)</p>
            <ChannelSelect name="absenceNotifChannelId" defaultValue={config?.absenceNotifChannelId} channels={channels} />
          </div>

          <p className="text-xs text-[var(--text-3)]">
            Langue : <span className="text-[var(--text-2)]">{lang === 'en' ? '🇬🇧 English' : '🇫🇷 Français'}</span> — modifiable dans{' '}
            <a href={`/dashboard/${guildId}/settings`} className="text-[var(--accent)] hover:underline">Paramètres &gt; Apparence</a>
          </p>
        </div>

        {/* Personnalisation */}
        <div className="card p-5 space-y-5">
          <div>
            <h3 className="font-semibold text-[var(--text)]">Personnalisation</h3>
            <p className="text-xs text-[var(--text-3)] mt-0.5">Laissez vide pour utiliser le texte par défaut selon la langue</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Titre (optionnel)</label>
            <input
              name="absenceEmbedTitle"
              defaultValue={config?.absenceEmbedTitle ?? ''}
              placeholder={defaultTitle}
              className="w-full input px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Description (optionnel)</label>
            <textarea
              name="absenceEmbedBody"
              defaultValue={config?.absenceEmbedBody ?? ''}
              placeholder={defaultBody}
              rows={4}
              className="w-full input px-3 py-2 text-sm resize-y"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <PublishAbsenceButton publishAction={publishAction} disabled={!hasChannel} />
          <button
            type="submit"
            className="px-4 py-2 bg-[var(--surface-2)] text-[var(--text)] rounded-lg text-sm font-medium hover:bg-[var(--hover)] transition-colors border border-[var(--border-mid)]"
          >
            Sauvegarder
          </button>
        </div>
      </form>
    </div>
  )
}
