import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { guildIconUrl } from '@/lib/utils'
import { Bot, ChevronRight } from 'lucide-react'
import { getLocale } from '@/i18n/server'
import { getT } from '@/i18n/translations'

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
  const sp = getT(getLocale()).serverPicker

  if (members.length === 1 && members[0]) {
    redirect(`/dashboard/${members[0].guild.id}`)
  }

  return (
    <main className="min-h-screen p-6" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>{sp.title}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>{sp.subtitle}</p>
          </div>
          {isSuperAdmin && (
            <Link href="/superadmin" className="btn-ghost px-3 py-1.5 text-xs inline-block">
              {sp.superadminPanel}
            </Link>
          )}
        </div>

        {members.length === 0 ? (
          <div className="card text-center py-16 px-6">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
            >
              <Bot size={24} strokeWidth={1.8} />
            </div>
            <h2 className="text-base font-semibold mb-2 tracking-tight" style={{ color: 'var(--text)' }}>{sp.noServers}</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-2)' }}>
              {sp.noServersDesc}
            </p>
            <a
              href={`https://discord.com/api/oauth2/authorize?client_id=${process.env['DISCORD_CLIENT_ID']}&permissions=268585984&scope=bot%20applications.commands`}
              className="btn-primary px-5 py-2.5 text-sm inline-block"
            >
              {sp.inviteBot}
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
                  className="card card-hover p-4 flex items-center gap-3 group"
                >
                  {iconUrl ? (
                    <img src={iconUrl} alt={member.guild.discordGuildName} className="w-10 h-10 rounded-lg flex-shrink-0" style={{ outline: '1px solid var(--border)' }} />
                  ) : (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-grad)' }}>
                      <span className="text-white font-bold text-sm">{member.guild.discordGuildName[0]}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate tracking-tight" style={{ color: 'var(--text)' }}>
                      {member.guild.discordGuildName}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{member.panelRole}</p>
                  </div>
                  <ChevronRight size={15} className="flex-shrink-0 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" style={{ color: 'var(--accent)' }} />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
