export type DiscordChannel = { id: string; name: string; type: number; parent_id: string | null; position: number }

export async function fetchDiscordChannels(discordGuildId: string): Promise<DiscordChannel[]> {
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
