'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getGuildMember, requirePermission } from '@/lib/api'
import PublishAbsenceButton from './PublishAbsenceButton'
import { getLocale } from '@/i18n/server'
import { getT, type Translations } from '@/i18n/translations'

type DiscordChannel = { id: string; name: string; type: number; parent_id: string | null; position: number }

async function fetchDiscordChannels(discordGuildId: string): Promise<DiscordChannel[]> {
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${discordGuildId}/channels`, {
      headers: { Authorization: `Bot ${process.env['DISCORD_BOT_TOKEN']}` },
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const channels = (await res.json()) as DiscordChannel[]
    return channels.filter((c) => c.type === 0 || c.type === 4 || c.type === 5).sort((a, b) => a.position - b.position)
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
  if (!session?.user?.discordId) return { success: false, error: getT(getLocale()).settingsAbsenceEmbed.notAuthenticated }
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
      return { success: false, error: body.error ?? getT(getLocale()).settingsAbsenceEmbed.unknownError }
    }
    revalidatePath(`/dashboard/${guildId}/settings/absence-embed`)
    return { success: true }
  } catch {
    return { success: false, error: getT(getLocale()).settingsAbsenceEmbed.botOffline }
  }
}

function ChannelSelect({
  name,
  defaultValue,
  channels,
  t,
}: {
  name: string
  defaultValue: string | null | undefined
  channels: DiscordChannel[]
  t: Translations
}) {
  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5)
  if (textChannels.length === 0) {
    return (
      <input
        name={name}
        defaultValue={defaultValue ?? ''}
        placeholder={t.settingsDiscord.channelIdPlaceholder}
        className="w-full input px-3 py-2 text-sm font-mono"
      />
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
    <select
      name={name}
      defaultValue={defaultValue ?? ''}
      className="w-full input px-3 py-2 text-sm"
    >
      <option value="">{t.settingsDiscord.noneOption}</option>
      {uncategorized.map((ch) => (
        <option key={ch.id} value={ch.id}>
          # {ch.name}
        </option>
      ))}
      {grouped.map(({ category, channels: chs }) => (
        <optgroup key={category.id} label={category.name}>
          {chs.map((ch) => (
            <option key={ch.id} value={ch.id}>
              # {ch.name}
            </option>
          ))}
        </optgroup>
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

  const locale = getLocale()
  const t = getT(locale)
  const ae = t.settingsAbsenceEmbed
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
        <h2 className="text-lg font-semibold text-[var(--text)]">{ae.title}</h2>
        <p className="text-[var(--text-2)] text-sm mt-1">
          {ae.subtitle}
        </p>
      </div>

      {/* Status */}
      <div className={`rounded-md border p-4 flex items-center gap-3 ${isPublished ? 'bg-[#0d1f14] border-[#22c55e30]' : 'bg-[var(--surface)] border-[var(--border)]'}`}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isPublished ? 'bg-[#22c55e]' : 'bg-[var(--text-3)]'}`} />
        <div>
          <p className="text-sm font-medium text-[var(--text)]">
            {isPublished ? ae.published : ae.notPublished}
          </p>
          {isPublished && (
            <p className="text-xs text-[var(--text-2)] mt-0.5 font-mono">{config.absenceEmbedMessageId}</p>
          )}
          {!isPublished && (
            <p className="text-xs text-[var(--text-3)] mt-0.5">
              {ae.notPublishedHint}
            </p>
          )}
        </div>
      </div>

      <form action={saveAction} className="space-y-5">
        {/* Canaux */}
        <div className="card p-5 space-y-5">
          <h3 className="font-semibold text-[var(--text)]">{ae.channels}</h3>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-0.5">{ae.embedChannel}</label>
            <p className="text-xs text-[var(--text-3)] mb-2">{ae.embedChannelDesc}</p>
            <ChannelSelect name="absenceChannelId" defaultValue={config?.absenceChannelId} channels={channels} t={t} />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-0.5">{ae.notifChannel}</label>
            <p className="text-xs text-[var(--text-3)] mb-2">{ae.notifChannelDesc}</p>
            <ChannelSelect name="absenceNotifChannelId" defaultValue={config?.absenceNotifChannelId} channels={channels} t={t} />
          </div>

          <p className="text-xs text-[var(--text-3)]">
            {ae.langLabel} <span className="text-[var(--text-2)]">{lang === 'en' ? '🇬🇧 English' : '🇫🇷 Français'}</span> — {ae.langEditable}{' '}
            <a href={`/dashboard/${guildId}/settings`} className="text-[var(--accent)] hover:underline">{ae.langSettingsLink}</a>
          </p>
        </div>

        {/* Personnalisation */}
        <div className="card p-5 space-y-5">
          <div>
            <h3 className="font-semibold text-[var(--text)]">{ae.customization}</h3>
            <p className="text-xs text-[var(--text-3)] mt-0.5">{ae.customizationDesc}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">{ae.titleOptional}</label>
            <input
              name="absenceEmbedTitle"
              defaultValue={config?.absenceEmbedTitle ?? ''}
              placeholder={defaultTitle}
              className="w-full input px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">{ae.descOptional}</label>
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
          <PublishAbsenceButton publishAction={publishAction} disabled={!hasChannel} locale={locale} />
          <button
            type="submit"
            className="px-4 py-2 bg-[var(--surface-2)] text-[var(--text)] rounded-lg text-sm font-medium hover:bg-[var(--hover)] transition-colors border border-[var(--border-mid)]"
          >
            {t.common.save}
          </button>
        </div>
      </form>
    </div>
  )
}
