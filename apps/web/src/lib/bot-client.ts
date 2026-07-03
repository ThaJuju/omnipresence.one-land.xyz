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

  updateAbsenceStatus: (params: {
    absenceId: string
    status: 'APPROVED' | 'REJECTED'
    reviewerName?: string | null
  }) => callBot('/update-absence-status', params),
}
