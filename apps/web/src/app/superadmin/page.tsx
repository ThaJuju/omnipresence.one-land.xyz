import { prisma } from '@repo/db'

export default async function SuperadminDashboard() {
  const [totalGuilds, activeGuilds, bannedGuilds, totalMembers] = await Promise.all([
    prisma.guildInstance.count(),
    prisma.guildInstance.count({ where: { isActive: true } }),
    prisma.guildInstance.count({ where: { isBanned: true } }),
    prisma.member.count(),
  ])

  const recentGuilds = await prisma.guildInstance.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { _count: { select: { members: true } } },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--text)]">Superadmin Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-4 text-center">
          <p className="text-3xl font-bold text-[var(--text)]">{totalGuilds}</p>
          <p className="text-xs text-[var(--text-2)] mt-1">Instances totales</p>
        </div>
        <div className="bg-[var(--surface)] rounded-md border border-[#22c55e30] p-4 text-center">
          <p className="text-3xl font-bold text-[#22c55e]">{activeGuilds}</p>
          <p className="text-xs text-[var(--text-2)] mt-1">Actives</p>
        </div>
        <div className="bg-[var(--surface)] rounded-md border border-[#ef444430] p-4 text-center">
          <p className="text-3xl font-bold text-[#ef4444]">{bannedGuilds}</p>
          <p className="text-xs text-[var(--text-2)] mt-1">Bannies</p>
        </div>
        <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-4 text-center">
          <p className="text-3xl font-bold text-[var(--text)]">{totalMembers}</p>
          <p className="text-xs text-[var(--text-2)] mt-1">Membres total</p>
        </div>
      </div>

      <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.07]">
          <h2 className="font-semibold text-[var(--text)]">Dernières instances</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase">Serveur</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase">Membres</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase">Statut</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase">Créé le</th>
            </tr>
          </thead>
          <tbody>
            {recentGuilds.map((g) => (
              <tr key={g.id} className="border-b border-white/[0.07] last:border-0">
                <td className="px-4 py-3">
                  <a href={`/superadmin/instances/${g.id}`} className="text-sm text-[var(--accent)] hover:underline">
                    {g.discordGuildName}
                  </a>
                </td>
                <td className="px-4 py-3 text-sm text-[var(--text-2)]">{g._count.members}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${g.isBanned ? 'text-[#ef4444]' : g.isActive ? 'text-[#22c55e]' : 'text-[var(--text-3)]'}`}>
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
