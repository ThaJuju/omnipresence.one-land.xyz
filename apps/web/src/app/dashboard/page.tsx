import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { guildIconUrl } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const discordUserId = session.user.discordId

  const members = await prisma.member.findMany({
    where: {
      discordUserId,
      guild: { isActive: true, isBanned: false },
      panelRole: { not: 'MEMBRE' },
    },
    include: { guild: true },
  })

  const isSuperAdmin = discordUserId === process.env['SUPERADMIN_DISCORD_ID']

  if (members.length === 1 && members[0]) {
    redirect(`/dashboard/${members[0].guild.id}`)
  }

  return (
    <main className="min-h-screen p-6" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text)' }}>Mes serveurs</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Sélectionnez un serveur à gérer</p>
          </div>
          {isSuperAdmin && (
            <Link
              href="/superadmin"
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors hover:bg-white/[0.04]"
              style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              Panel Superadmin
            </Link>
          )}
        </div>

        {members.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-3xl mb-4">🤖</div>
            <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>Aucun serveur accessible</h2>
            <p className="text-xs mb-6" style={{ color: 'var(--text-2)' }}>
              Invitez le bot sur votre serveur Discord pour commencer.
            </p>
            <a
              href={`https://discord.com/api/oauth2/authorize?client_id=${process.env['DISCORD_CLIENT_ID']}&permissions=268585984&scope=bot%20applications.commands`}
              className="px-4 py-2 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-80"
              style={{ background: 'var(--guild-accent, #6366f1)' }}
            >
              Inviter le bot
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {members.map((member) => {
              const iconUrl = guildIconUrl(member.guild.discordGuildId, member.guild.discordGuildIcon)
              return (
                <Link
                  key={member.guild.id}
                  href={`/dashboard/${member.guild.id}`}
                  className="p-4 rounded-md flex items-center gap-3 hover:bg-white/[0.02] transition-colors group"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  {iconUrl ? (
                    <img src={iconUrl} alt={member.guild.discordGuildName} className="w-9 h-9 rounded-md flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'var(--guild-accent, #6366f1)' }}>
                      <span className="text-white font-bold text-sm">{member.guild.discordGuildName[0]}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                      {member.guild.discordGuildName}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{member.panelRole}</p>
                  </div>
                  <ChevronRight size={14} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-3)' }} />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
