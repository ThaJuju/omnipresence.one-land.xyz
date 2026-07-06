'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getGuildMember, requirePermission } from '@/lib/api'
import { botClient } from '@/lib/bot-client'
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
  const t = getT(getLocale())
  const d = t.settingsDiscord

  const channelFields = [
    { key: 'presenceChannelId', label: d.presenceChannel, desc: d.presenceChannelDesc },
    { key: 'warningChannelId', label: d.warningChannel, desc: d.warningChannelDesc },
    { key: 'notificationChannelId', label: d.notificationChannel, desc: d.notificationChannelDesc },
    { key: 'logChannelId', label: d.logChannel, desc: d.logChannelDesc },
    { key: 'reportChannelId', label: d.reportChannel, desc: d.reportChannelDesc },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">{d.title}</h2>
        <p className="text-[var(--text-2)] text-sm mt-1">{d.subtitle}</p>
      </div>

      <form action={saveConfig} className="space-y-6">
        {/* Canaux */}
        <div className="card p-5 space-y-5">
          <h3 className="font-semibold text-[var(--text)]">{d.textChannels}</h3>
          <div className="space-y-4">
            {channelFields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-[var(--text)] mb-0.5">{field.label}</label>
                <p className="text-xs text-[var(--text-3)] mb-2">{field.desc}</p>
                <ChannelSelect
                  name={field.key}
                  defaultValue={config?.[field.key as keyof typeof config] as string}
                  channels={channels}
                  t={t}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Horaires de présence */}
        <div className="card p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-[var(--text)]">{d.presenceSchedules}</h3>
            <p className="text-xs text-[var(--text-3)] mt-0.5">
              {d.schedulesHint}{' '}
              <a href={`/dashboard/${guildId}/settings/modules`} className="text-[var(--accent)] hover:underline">
                Modules
              </a>
              . {d.timezoneLabel} {config?.timezone ?? 'Europe/Paris'}
            </p>
          </div>
          <div className="space-y-3">
            {(
              [
                { key: 'presenceMessageTime', label: d.presenceMessage, defaultTime: '08:00' },
                { key: 'reminderTime', label: d.presenceReminder, defaultTime: '18:00' },
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
            <h3 className="font-semibold text-[var(--text)]">{d.autoReports}</h3>
            <p className="text-xs text-[var(--text-3)] mt-0.5">
              {d.autoReportsDesc}
            </p>
          </div>
          <div className="space-y-3">
            <Toggle
              name="dailyReportEnabled"
              checked={config?.dailyReportEnabled ?? false}
              label={d.dailyReport}
              desc={d.dailyReportDesc}
            />
            <Toggle
              name="weeklyReportEnabled"
              checked={config?.weeklyReportEnabled ?? false}
              label={d.weeklyReport}
              desc={d.weeklyReportDesc}
            />
            <Toggle
              name="monthlyReportEnabled"
              checked={config?.monthlyReportEnabled ?? false}
              label={d.monthlyReport}
              desc={d.monthlyReportDesc}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 btn-primary text-sm"
          >
            {t.common.save}
          </button>
        </div>
      </form>
    </div>
  )
}
