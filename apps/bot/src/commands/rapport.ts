import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js'
import { prisma } from '@repo/db'
import { logger } from '../logger'
import { isSendableChannel } from '../channel-utils'

export const data = new SlashCommandBuilder()
  .setName('rapport')
  .setDescription('Envoyer un rapport de présences dans le canal log')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption((o) =>
    o.setName('date').setDescription('Date du rapport (JJ/MM/AAAA, défaut : aujourd\'hui)').setRequired(false)
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

  const dateStr = interaction.options.getString('date')
  let targetDate = new Date()
  if (dateStr) {
    const parsed = parseDate(dateStr)
    if (!parsed) {
      await interaction.editReply('Format de date invalide. Utilisez JJ/MM/AAAA.')
      return
    }
    targetDate = parsed
  }
  targetDate.setUTCHours(0, 0, 0, 0)

  try {
    const guild = await prisma.guildInstance.findUnique({
      where: { discordGuildId: interaction.guildId! },
      include: { config: true },
    })

    if (!guild?.config?.logChannelId) {
      await interaction.editReply('Le canal de log n\'est pas configuré.')
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
      .setTitle(`Rapport de présences — ${targetDate.toLocaleDateString('fr-FR')}`)
      .setColor(present.length > absent.length ? 0x23d160 : 0xff3860)
      .addFields(
        {
          name: `✅ Présents (${present.length})`,
          value: present.map((l) => l.member.discordNickname ?? l.member.discordUsername).join(', ') || 'Aucun',
        },
        {
          name: `❌ Absents (${absent.length})`,
          value: absent.map((l) => l.member.discordNickname ?? l.member.discordUsername).join(', ') || 'Aucun',
        },
        {
          name: `⏳ En attente (${pending.length})`,
          value: pending.map((l) => l.member.discordNickname ?? l.member.discordUsername).join(', ') || 'Aucun',
        }
      )
      .setTimestamp()

    const logChannel = await interaction.client.channels.fetch(guild.config.logChannelId)
    if (!isSendableChannel(logChannel)) {
      await interaction.editReply('Le canal de log est invalide.')
      return
    }

    await logChannel.send({ embeds: [embed] })
    await interaction.editReply('✅ Rapport envoyé dans le canal de log.')
  } catch (error) {
    logger.error({ error }, 'rapport command failed')
    await interaction.editReply('❌ Erreur lors de la génération du rapport.')
  }
}
