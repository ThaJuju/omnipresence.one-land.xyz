import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      discordId: string
      accessToken: string
      isSuperAdmin: boolean
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    discordId?: string
    accessToken?: string
    isSuperAdmin?: boolean
  }
}
