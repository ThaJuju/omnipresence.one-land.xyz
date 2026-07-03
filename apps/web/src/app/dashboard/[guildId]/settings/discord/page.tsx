'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getGuildMember, requirePermission } from '@/lib/api'
import { botClient } from '@/lib/bot-client'

type DiscordChannel = { id: string; name: string; type: number; parent_id: string | null; position: number }

async function fetchDiscordChannels(discordGuildId: string): Promise<DiscordChannel[]> {
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${discordGuildId}/channels`, {
      headers: { Authorization: `Bot ${process.env['DISCORD_BOT_TOKEN']}` },
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const channels = (await res.json()) as DiscordChannel[]
    return channels
      .filter((c) => c.type === 0 || c.type === 4 || c.type === 5)
      .sort((a, b) => a.position - b.position)
  } catch {
    return []
  }
}

async function saveDiscordConfig(guildId: string, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')

  const data = {
    presenceChannelId: (formData.get('presenceChannelId') as string) || null,
    warningChannelId: (formData.get('warningChannelId') as string) || null,
    notificationChannelId: (formData.get('notificationChannelId') as string) || null,
    logChannelId: (formData.get('logChannelId') as string) || null,
    reportChannelId: (formData.get('reportChannelId') as string) || null,
    presenceMessageTime: (formData.get('presenceMessageTime') as string) || '08:00',
    reminderTime: (formData.get('reminderTime') as string) || '18:00',
    dailyReportEnabled: formData.get('dailyReportEnabled') === 'on',
    weeklyReportEnabled: formData.get('weeklyReportEnabled') === 'on',
    monthlyReportEnabled: formData.get('monthlyReportEnabled') === 'on',
  }

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: data,
    create: { guildId, ...data },
  })

  await botClient.reloadConfig(member.guild.discordGuildId).catch(() => {})

  revalidatePath(`/dashboard/${guildId}/settings/discord`)
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
  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5)
  if (textChannels.length === 0) {
    return (
      <input
        name={name}
        defaultValue={defaultValue ?? ''}
        placeholder="ID du canal Discord"
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
      <option value="">— Aucun —</option>
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

function Toggle({ name, checked, label, desc }: { name: string; checked: boolean; label: string; desc?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
      <div>
        <p className="text-sm text-[var(--text)]">{label}</p>
        {desc && <p className="text-xs text-[var(--text-3)] mt-0.5">{desc}</p>}
      </div>
      <label className="relative cursor-pointer flex-shrink-0">
        <input type="checkbox" name={name} defaultChecked={checked} className="sr-only peer" />
        <div className="relative w-9 h-5 rounded-full bg-[var(--surface-2)] peer-checked:bg-[var(--accent)] transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:rounded-full after:bg-[var(--text-3)] after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-white" />
      </label>
    </div>
  )
}

export default async function DiscordSettingsPage({ params }: { params: { guildId: string } }) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params

  const guild = await prisma.guildInstance.findUnique({ where: { id: guildId } })
  if (!guild) redirect('/dashboard')

  const [config, channels] = await Promise.all([
    prisma.guildConfig.findUnique({ where: { guildId } }),
    fetchDiscordChannels(guild.discordGuildId),
  ])

  const saveConfig = saveDiscordConfig.bind(null, guildId)

  const channelFields = [
    { key: 'presenceChannelId', label: 'Canal de présences', desc: 'Où le bot envoie le message de présence quotidien' },
    { key: 'warningChannelId', label: 'Canal des avertissements', desc: 'Où les avertissements sont publiés' },
    { key: 'notificationChannelId', label: 'Canal de notifications', desc: 'Annonces générales du bot' },
    { key: 'logChannelId', label: 'Canal de logs', desc: 'Journal des actions admin' },
    { key: 'reportChannelId', label: 'Canal des rapports', desc: 'Où les rapports journaliers / hebdomadaires / mensuels sont envoyés (utilise les logs si vide)' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">Canaux &amp; Horaires</h2>
        <p className="text-[var(--text-2)] text-sm mt-1">Canaux Discord du bot et horaires des envois automatiques</p>
      </div>

      <form action={saveConfig} className="space-y-6">
        {/* Canaux */}
        <div className="card p-5 space-y-5">
          <h3 className="font-semibold text-[var(--text)]">Canaux textuels</h3>
          <div className="space-y-4">
            {channelFields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-[var(--text)] mb-0.5">{field.label}</label>
                <p className="text-xs text-[var(--text-3)] mb-2">{field.desc}</p>
                <ChannelSelect
                  name={field.key}
                  defaultValue={config?.[field.key as keyof typeof config] as string}
                  channels={channels}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Horaires de présence */}
        <div className="card p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-[var(--text)]">Horaires de présence</h3>
            <p className="text-xs text-[var(--text-3)] mt-0.5">
              Activez / désactivez ces fonctions dans{' '}
              <a href={`/dashboard/${guildId}/settings/modules`} className="text-[var(--accent)] hover:underline">
                Modules
              </a>
              . Timezone : {config?.timezone ?? 'Europe/Paris'}
            </p>
          </div>
          <div className="space-y-3">
            {(
              [
                { key: 'presenceMessageTime', label: 'Message de présence', defaultTime: '08:00' },
                { key: 'reminderTime', label: 'Rappel de présence', defaultTime: '18:00' },
              ] as const
            ).map(({ key, label, defaultTime }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
              >
                <span className="text-sm text-[var(--text)]">{label}</span>
                <input
                  type="time"
                  name={key}
                  defaultValue={config?.[key] ?? defaultTime}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Rapports automatiques */}
        <div className="card p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-[var(--text)]">Rapports automatiques</h3>
            <p className="text-xs text-[var(--text-3)] mt-0.5">
              Le bot envoie des résumés embed dans le canal des rapports (ou logs si absent)
            </p>
          </div>
          <div className="space-y-3">
            <Toggle
              name="dailyReportEnabled"
              checked={config?.dailyReportEnabled ?? false}
              label="Rapport journalier"
              desc="Envoyé chaque matin à 8h — présences du jour, absences en attente, avertissements actifs"
            />
            <Toggle
              name="weeklyReportEnabled"
              checked={config?.weeklyReportEnabled ?? false}
              label="Rapport hebdomadaire"
              desc="Envoyé chaque lundi à 8h — bilan de la semaine passée avec top présences"
            />
            <Toggle
              name="monthlyReportEnabled"
              checked={config?.monthlyReportEnabled ?? false}
              label="Rapport mensuel"
              desc="Envoyé le 1er du mois à 8h — bilan complet du mois (présences, finances, cotisations)"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 btn-primary text-sm"
          >
            Sauvegarder
          </button>
        </div>
      </form>
    </div>
  )
}
