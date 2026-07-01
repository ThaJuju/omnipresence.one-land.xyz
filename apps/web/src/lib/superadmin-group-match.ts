import { prisma } from '@repo/db'

/** Lie au groupe tous les serveurs existants dont le nom contient le nom du groupe (insensible à la casse). Additif uniquement — ne retire jamais un serveur déjà lié. */
export async function autoLinkMatchingGuilds(groupId: string, groupName: string) {
  const trimmed = groupName.trim()
  if (!trimmed) return

  const matches = await prisma.guildInstance.findMany({
    where: { discordGuildName: { contains: trimmed, mode: 'insensitive' } },
    select: { id: true },
  })
  if (matches.length === 0) return

  await prisma.superAdminGroupGuild.createMany({
    data: matches.map((g) => ({ groupId, guildId: g.id })),
    skipDuplicates: true,
  })
}

/** Lie un serveur (généralement nouvellement créé) à tous les groupes dont le nom apparaît dans son nom Discord. */
export async function autoLinkGuildToMatchingGroups(guildId: string, discordGuildName: string) {
  const groups = await prisma.superAdminGroup.findMany({ select: { id: true, name: true } })
  const lowerName = discordGuildName.toLowerCase()
  const matches = groups.filter((g) => g.name.trim() && lowerName.includes(g.name.trim().toLowerCase()))
  if (matches.length === 0) return

  await prisma.superAdminGroupGuild.createMany({
    data: matches.map((g) => ({ groupId: g.id, guildId })),
    skipDuplicates: true,
  })
}
