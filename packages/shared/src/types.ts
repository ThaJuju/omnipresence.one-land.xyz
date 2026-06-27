export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
}

export interface ApiError {
  message: string
  code?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export interface BotPresencePayload {
  discordUserId: string
  discordGuildId: string
  status: 'PRESENT' | 'ABSENT' | 'LATE'
  date: string
  delayMinutes?: number
}

export interface BotAbsencePayload {
  discordUserId: string
  discordGuildId: string
  reason: string
  startDate: string
  endDate: string
}

export interface BotWarningBulkPayload {
  discordGuildId: string
  memberIds: string[]
  reason: string
  date: string
}

export interface BotMemberSyncPayload {
  discordUserId: string
  discordGuildId: string
  discordUsername: string
  discordAvatar?: string
  discordNickname?: string
  discordRoleIds: string[]
}

export interface BotGuildCreatePayload {
  discordGuildId: string
  discordGuildName: string
  discordGuildIcon?: string
  ownerId: string
}

export interface WebAssignRolePayload {
  discordGuildId: string
  discordUserId: string
  discordRoleId: string
}

export interface WebSendMessagePayload {
  discordGuildId: string
  channelId: string
  content: string
}

export interface WebMentionMembersPayload {
  discordGuildId: string
  channelId: string
  discordUserIds: string[]
  content?: string
}

export interface WebReloadConfigPayload {
  discordGuildId: string
}
