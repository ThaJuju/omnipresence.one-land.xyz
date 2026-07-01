import { prisma } from '@repo/db'
import { auth } from '@/lib/auth'
import { getSuperAdminAccess } from '@/lib/superadmin-access'
import { redirect } from 'next/navigation'

export default async function SuperadminDashboard() {
  const session = await auth()
  const access = await getSuperAdminAccess(session?.user?.discordId)
  if (!access) redirect('/dashboard')

  const scopeWhere = access.isDev ? {} : { id: { in: access.guildIds } }
  const guildWhere = { ...scopeWhere, isActive: true }

  const [totalGuilds, bannedGuilds, totalMembers] = await Promise.all([
    prisma.guildInstance.count({ where: guildWhere }),
    prisma.guildInstance.count({ where: { ...guildWhere, isBanned: true } }),
    prisma.member.count({ where: { guild: guildWhere } }),
  ])

  const recentGuilds = await prisma.guildInstance.findMany({
    where: guildWhere,
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { _count: { select: { members: true } } },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Superadmin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-[var(--text)]">{totalGuilds}</p>
          <p className="text-xs text-[var(--text-2)] mt-1">Instances avec le bot</p>
        </div>
        <div className="bg-[var(--surface)] rounded-md border border-[#ef444430] p-4 text-center">
          <p className="text-3xl font-bold text-[var(--danger)]">{bannedGuilds}</p>
          <p className="text-xs text-[var(--text-2)] mt-1">Bannies</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-[var(--text)]">{totalMembers}</p>
          <p className="text-xs text-[var(--text-2)] mt-1">Membres total</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--text)]">Dernières instances</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase">Serveur</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase">Membres</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase">Statut</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase">Créé le</th>
            </tr>
          </thead>
          <tbody>
            {recentGuilds.map((g) => (
              <tr key={g.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3">
                  <a href={`/superadmin/instances/${g.id}`} className="text-sm text-[var(--accent)] hover:underline">
                    {g.discordGuildName}
                  </a>
                </td>
                <td className="px-4 py-3 text-sm text-[var(--text-2)]">{g._count.members}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${g.isBanned ? 'text-[var(--danger)]' : g.isActive ? 'text-[var(--success)]' : 'text-[var(--text-3)]'}`}>
                    {g.isBanned ? 'Banni' : g.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-3)]">
                  {new Date(g.createdAt).toLocaleDateString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
