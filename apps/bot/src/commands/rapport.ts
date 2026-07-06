import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js'
import { prisma } from '@repo/db'
import { logger } from '../logger'
import { isSendableChannel } from '../channel-utils'
import { getBotT } from '../i18n/botTranslations'

export const data = new SlashCommandBuilder()
  .setName('rapport')
  .setDescription('Envoyer un rapport de présences dans le canal log')
  .setDescriptionLocalizations({
    'en-US': 'Send a presence report to the log channel',
    'en-GB': 'Send a presence report to the log channel',
  })
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption((o) =>
    o.setName('date')
      .setDescription('Date du rapport (JJ/MM/AAAA, défaut : aujourd\'hui)')
      .setDescriptionLocalizations({
        'en-US': 'Report date (DD/MM/YYYY, default: today)',
        'en-GB': 'Report date (DD/MM/YYYY, default: today)',
      })
      .setRequired(false)
  )

function parseDate(str: string): Date | null {
  const parts = str.split('/')
  if (parts.length !== 3) return null
  const [day, month, year] = parts
  const d = new Date(`${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`)
  if (isNaN(d.getTime())) return null
  return d
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true })

  let t = getBotT('fr')
  try {
    const guild = await prisma.guildInstance.findUnique({
      where: { discordGuildId: interaction.guildId! },
      include: { config: true },
    })
    t = getBotT(guild?.config?.botLanguage ?? 'fr')

    const dateStr = interaction.options.getString('date')
    let targetDate = new Date()
    if (dateStr) {
      const parsed = parseDate(dateStr)
      if (!parsed) {
        await interaction.editReply(t.absence.errFormat)
        return
      }
      targetDate = parsed
    }
    targetDate.setUTCHours(0, 0, 0, 0)

    if (!guild?.config?.logChannelId) {
      await interaction.editReply(t.report.logNotConfigured)
      return
    }

    const logs = await prisma.presenceLog.findMany({
      where: { guildId: guild.id, date: targetDate },
      include: { member: true },
    })

    const present = logs.filter((l) => l.status === 'PRESENT')
    const absent = logs.filter((l) => l.status === 'ABSENT')
    const pending = logs.filter((l) => l.status === 'PENDING')

    const embed = new EmbedBuilder()
      .setTitle(t.report.title(targetDate.toLocaleDateString(t.presence.dateLocale)))
      .setColor(present.length > absent.length ? 0x23d160 : 0xff3860)
      .addFields(
        {
          name: t.report.presentField(present.length),
          value: present.map((l) => l.member.discordNickname ?? l.member.discordUsername).join(', ') || t.common.none,
        },
        {
          name: t.report.absentField(absent.length),
          value: absent.map((l) => l.member.discordNickname ?? l.member.discordUsername).join(', ') || t.common.none,
        },
        {
          name: t.report.pendingField(pending.length),
          value: pending.map((l) => l.member.discordNickname ?? l.member.discordUsername).join(', ') || t.common.none,
        }
      )
      .setTimestamp()

    const logChannel = await interaction.client.channels.fetch(guild.config.logChannelId)
    if (!isSendableChannel(logChannel)) {
      await interaction.editReply(t.report.logInvalid)
      return
    }

    await logChannel.send({ embeds: [embed] })
    await interaction.editReply(t.report.sent)
  } catch (error) {
    logger.error({ error }, 'rapport command failed')
    await interaction.editReply(t.report.error)
  }
}
