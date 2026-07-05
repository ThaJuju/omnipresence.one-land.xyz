const BOT_URL = `http://localhost:${process.env['BOT_HTTP_PORT'] ?? 3001}`
const SECRET = process.env['BOT_INTERNAL_SECRET']!

async function callBot<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BOT_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': SECRET,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Bot error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

async function callBotGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${BOT_URL}${path}`, {
    headers: { 'x-internal-secret': SECRET },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Bot error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export type BotProfile = {
  username: string | null
  avatarUrl: string | null
  description: string | null
  customStatus: string | null
}

export const botClient = {
  assignRole: (discordGuildId: string, discordUserId: string, discordRoleId: string) =>
    callBot('/assign-role', { discordGuildId, discordUserId, discordRoleId }),

  removeRole: (discordGuildId: string, discordUserId: string, discordRoleId: string) =>
    callBot('/remove-role', { discordGuildId, discordUserId, discordRoleId }),

  sendMessage: (discordGuildId: string, channelId: string, content: string) =>
    callBot('/send-message', { discordGuildId, channelId, content }),

  mentionMembers: (discordGuildId: string, channelId: string, discordUserIds: string[], content?: string) =>
    callBot('/mention-members', { discordGuildId, channelId, discordUserIds, content }),

  reloadConfig: (discordGuildId: string) =>
    callBot('/reload-config', { discordGuildId }),

  notifyAbsence: (params: {
    guildId: string
    absenceId: string
    memberName: string
    memberAvatarUrl?: string | null
    reason: string
    startDate: string
    endDate: string
    source: 'discord' | 'panel'
  }) => callBot('/notify-absence', params),

  getBotProfile: () => callBotGet<BotProfile>('/bot-profile'),

  setBotProfile: (params: {
    description?: string | null
    customStatus?: string | null
  }) => callBot('/bot-profile', params),

  notifyWarning: (params: {
    guildId: string
    action: 'ISSUED' | 'REVOKED'
    memberName: string
    memberAvatarUrl?: string | null
    discordUserId: string
    reason: string
    actorName?: string | null
    note?: string | null
  }) => callBot('/notify-warning', params),

  updateAbsenceStatus: (params: {
    absenceId: string
    status: 'APPROVED' | 'REJECTED'
    reviewerName?: string | null
  }) => callBot('/update-absence-status', params),
}
