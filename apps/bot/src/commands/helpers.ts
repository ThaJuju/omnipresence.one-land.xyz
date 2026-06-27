import { prisma } from '@repo/db'
import type { PanelRole } from '@repo/db'

export async function resolvePanelRole(
  discordUserId: string,
  guildId: string,
  discordRoleIds: string[]
): Promise<PanelRole> {
  const guild = await prisma.guildInstance.findUnique({ where: { id: guildId } })
  if (guild?.ownerId === discordUserId) return 'ADMIN'

  const bindings = await prisma.discordRoleBinding.findMany({ where: { guildId } })

  const priority: PanelRole[] = ['ADMIN', 'DIRECTION', 'RESPONSABLE', 'MODERATEUR']
  for (const role of priority) {
    const bound = bindings.filter((b) => b.panelRole === role)
    if (bound.some((b) => discordRoleIds.includes(b.discordRoleId))) return role
  }

  return 'MEMBRE'
}
