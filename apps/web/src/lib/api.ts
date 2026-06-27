import { NextResponse } from 'next/server'
import { auth } from './auth'
import { prisma } from '@repo/db'
import { hasPermission } from '@repo/shared'
import type { Permission, PanelRole } from '@repo/shared'

export class ApiError extends Error {
  constructor(
    public message: string,
    public status: number = 400,
    public code?: string
  ) {
    super(message)
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function getSessionOrThrow() {
  const session = await auth()
  if (!session?.user?.discordId) throw new ApiError('Non authentifié', 401)
  return session
}

export async function verifyInternalSecret(req: Request) {
  const secret = req.headers.get('x-internal-secret')
  if (secret !== process.env['BOT_INTERNAL_SECRET']) {
    throw new ApiError('Secret interne invalide', 401)
  }
}

export async function getGuildMember(guildId: string, discordUserId: string) {
  const member = await prisma.member.findUnique({
    where: { guildId_discordUserId: { guildId, discordUserId } },
    include: { guild: { include: { config: true } } },
  })
  if (!member) throw new ApiError('Membre introuvable', 404)
  if (!member.guild.isActive) throw new ApiError('Guild désactivée', 403)
  if (member.guild.isBanned) throw new ApiError('Guild bannie', 403)
  return member
}

export function requirePermission(role: PanelRole, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new ApiError('Permission insuffisante', 403)
  }
}

export function withApiHandler(
  handler: (req: Request, ctx: { params: Record<string, string> }) => Promise<Response>
) {
  return async (req: Request, ctx: { params: Record<string, string> }) => {
    try {
      return await handler(req, ctx)
    } catch (error) {
      if (error instanceof ApiError) {
        return err(error.message, error.status)
      }
      console.error(error)
      return err('Erreur serveur interne', 500)
    }
  }
}
