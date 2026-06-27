import type { Channel } from 'discord.js'
import { ChannelType } from 'discord.js'

export function isSendableChannel(channel: Channel | null): channel is Extract<Channel, { send: unknown }> {
  if (!channel) return false
  return [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildVoice,
    ChannelType.GuildStageVoice,
    ChannelType.PublicThread,
    ChannelType.PrivateThread,
    ChannelType.AnnouncementThread,
    ChannelType.DM,
  ].includes(channel.type)
}
