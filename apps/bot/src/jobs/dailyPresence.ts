import { prisma } from '@repo/db'
import { client } from '../client'
import { logger } from '../logger'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'
import { isSendableChannel } from '../channel-utils'
import { getBotT } from '../i18n/botTranslations'

export async function runDailyPresence(guildId: string) {
  try {
    const guild = await prisma.guildInstance.findUnique({
      where: { id: guildId },
      include: { config: true },
    })
    if (!guild?.config?.presenceChannelId) return
    if (!guild.config.presenceEnabled) return

    const t = getBotT(guild.config.botLanguage)
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const members = await prisma.member.findMany({
      where: {
        guildId,
        isActive: true,
        grade: { discordRoleId: { not: null } },
      },
    })

    const approvedAbsences = await prisma.absence.findMany({
      where: {
        guildId,
        status: 'APPROVED',
        startDate: { lte: today },
        endDate: { gte: today },
      },
    })

    const absentMemberIds = new Set(approvedAbsences.map((a) => a.memberId))
    const membersToTrack = members.filter((m) => !absentMemberIds.has(m.id))

    await prisma.presenceLog.createMany({
      data: membersToTrack.map((m) => ({
        guildId,
        memberId: m.id,
        date: today,
        status: 'PENDING' as const,
        source: 'discord',
      })),
      skipDuplicates: true,
    })

    const channel = await client.channels.fetch(guild.config.presenceChannelId)
    if (!isSendableChannel(channel)) return

    const dateStr = today.toLocaleDateString(t.presence.dateLocale, { weekday: 'long', day: 'numeric', month: 'long' })
    const defaultDesc = t.presence.embedDesc(dateStr, membersToTrack.length)
    const customDesc = guild.config.embedDescription?.replace('{date}', dateStr).replace('{count}', String(membersToTrack.length))

    const embedColorHex = guild.config.embedColor?.replace('#', '') ?? '5865F2'
    const embedColorNum = parseInt(embedColorHex, 16)

    const embed = new EmbedBuilder()
      .setTitle(guild.config.embedTitle || t.presence.embedTitle)
      .setDescription(customDesc || defaultDesc)
      .setColor(isNaN(embedColorNum) ? 0x5865f2 : embedColorNum)
      .setTimestamp()

    const pingRoleId = guild.config.presencePingRoleId
    const pingContent = pingRoleId ? `<@&${pingRoleId}> ` : ''

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`presence:present:${guildId}`)
        .setLabel(t.presence.btnPresent)
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`presence:late:${guildId}`)
        .setLabel(t.presence.btnLate)
        .setEmoji('⏰')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`presence:absent:${guildId}`)
        .setLabel(t.presence.btnAbsent)
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger),
    )

    // Rend le rôle temporairement mentionnable si nécessaire
    let restoredMentionable = false
    if (pingRoleId) {
      try {
        const discordGuild = await client.guilds.fetch(guild.discordGuildId, )
        const role = await discordGuild.roles.fetch(pingRoleId, )
        if (role && !role.mentionable) {
          await role.setMentionable(true)
          restoredMentionable = true
        }
      } catch (err) {
        logger.warn({ err, guildId, pingRoleId }, 'Could not set role mentionable — bot may lack Manage Roles or role is above bot in hierarchy')
      }
    }

    await channel.send({
      content: pingContent || undefined,
      embeds: [embed],
      components: [row],
      allowedMentions: pingRoleId ? { roles: [pingRoleId] } : undefined,
    })

    if (restoredMentionable && pingRoleId) {
      try {
        const discordGuild = await client.guilds.fetch(guild.discordGuildId, )
        const role = await discordGuild.roles.fetch(pingRoleId, )
        if (role) await role.setMentionable(false)
      } catch (err) {
        logger.warn({ err, guildId, pingRoleId }, 'Could not restore role mentionable state')
      }
    }
    logger.info({ guildId }, 'Daily presence message sent')
  } catch (error) {
    logger.error({ error, guildId }, 'Failed to run daily presence')
  }
}
