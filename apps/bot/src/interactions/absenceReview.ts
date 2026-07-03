import { ButtonInteraction, EmbedBuilder } from 'discord.js'
import { prisma } from '@repo/db'
import { hasPermission } from '@repo/shared'
import { logger } from '../logger'

export async function handleAbsenceReviewButton(interaction: ButtonInteraction, action: 'approve' | 'reject', absenceId: string) {
  const absence = await prisma.absence.findUnique({ where: { id: absenceId } })
  if (!absence) {
    await interaction.reply({ content: 'Demande introuvable (peut-être supprimée).', ephemeral: true })
    return
  }

  if (absence.status !== 'PENDING') {
    await interaction.reply({ content: 'Cette demande a déjà été traitée.', ephemeral: true })
    return
  }

  const reviewer = await prisma.member.findUnique({
    where: { guildId_discordUserId: { guildId: absence.guildId, discordUserId: interaction.user.id } },
  })

  if (!reviewer || !hasPermission(reviewer.panelRole, 'absences.approve')) {
    await interaction.reply({ content: "Tu n'as pas la permission de traiter les demandes d'absence.", ephemeral: true })
    return
  }

  const status = action === 'approve' ? 'APPROVED' : 'REJECTED'

  const result = await prisma.absence.updateMany({
    where: { id: absenceId, status: 'PENDING' },
    data: { status, reviewedBy: reviewer.id, reviewedAt: new Date() },
  })

  if (result.count === 0) {
    await interaction.reply({ content: 'Cette demande a déjà été traitée.', ephemeral: true })
    return
  }

  if (status === 'REJECTED') {
    // La déclaration avait marqué le suivi journalier "Absent" : on le repasse en attente
    // puisque la demande est refusée et n'est plus une absence valide.
    await prisma.presenceLog.updateMany({
      where: { memberId: absence.memberId, date: absence.startDate, status: 'ABSENT' },
      data: { status: 'PENDING' },
    })
  }

  try {
    await prisma.auditLog.create({
      data: {
        guildId: absence.guildId,
        adminId: reviewer.id,
        action: status === 'APPROVED' ? 'Absence approuvée (Discord)' : 'Absence refusée (Discord)',
        targetId: absenceId,
        targetType: 'Absence',
      },
    })
  } catch (error) {
    logger.error({ error }, 'Failed to write audit log for absence review')
  }

  const approved = status === 'APPROVED'
  const existingEmbed = interaction.message.embeds[0]
  const embed = existingEmbed ? EmbedBuilder.from(existingEmbed) : new EmbedBuilder()
  embed.setColor(approved ? 0x22c55e : 0xef4444)
  embed.addFields({
    name: 'Statut',
    value: approved
      ? `✅ Approuvée par **${interaction.user.username}**`
      : `❌ Refusée par **${interaction.user.username}**`,
  })

  await interaction.update({ embeds: [embed], components: [] })
}
