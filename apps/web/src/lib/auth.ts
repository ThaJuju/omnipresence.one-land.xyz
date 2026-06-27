import NextAuth from 'next-auth'
import DiscordProvider from 'next-auth/providers/discord'
import { prisma } from '@repo/db'
import type { PanelRole } from '@repo/db'

async function resolvePanelRole(
  discordUserId: string,
  guildId: string,
  discordRoleIds: string[],
  isAdministrator?: boolean
): Promise<PanelRole> {
  const guild = await prisma.guildInstance.findUnique({ where: { id: guildId } })
  if (guild?.ownerId === discordUserId) return 'ADMIN'
  if (isAdministrator) return 'ADMIN'

  const bindings = await prisma.discordRoleBinding.findMany({ where: { guildId } })

  const priority: PanelRole[] = ['ADMIN', 'DIRECTION', 'RESPONSABLE', 'MODERATEUR']
  for (const role of priority) {
    const bound = bindings.filter(b => b.panelRole === role)
    if (bound.some(b => discordRoleIds.includes(b.discordRoleId))) return role
  }

  return 'MEMBRE'
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    DiscordProvider({
      clientId: process.env['DISCORD_CLIENT_ID']!,
      clientSecret: process.env['DISCORD_CLIENT_SECRET']!,
      authorization: { params: { scope: 'identify guilds guilds.members.read' } },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'discord') return false
      if (!profile?.id) return false
      return true
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.discordId = token.sub
        session.user.accessToken = token.accessToken as string
        session.user.isSuperAdmin = token.sub === process.env['SUPERADMIN_DISCORD_ID']
      }
      return session
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token
      }
      if (profile) {
        token.sub = (profile as { id: string }).id
      }
      return token
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
})

export { resolvePanelRole }
