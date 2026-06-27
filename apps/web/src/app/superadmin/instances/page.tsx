import { prisma } from '@repo/db'
import Link from 'next/link'

export default async function InstancesPage() {
  const guilds = await prisma.guildInstance.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { members: true } } },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Instances</h1>
        <p className="text-[var(--text-2)] text-sm mt-1">{guilds.length} instance(s) au total</p>
      </div>

      <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase">Serveur</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase hidden md:table-cell">Membres</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase">Statut</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase hidden lg:table-cell">Plan</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase hidden lg:table-cell">Créé le</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {guilds.map((g) => (
              <tr key={g.id} className="border-b border-white/[0.07] last:border-0">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]">{g.discordGuildName}</p>
                    <p className="text-xs text-[var(--text-3)] font-mono">{g.discordGuildId}</p>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-sm text-[var(--text-2)]">{g._count.members}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${
                    g.isBanned ? 'text-[#ef4444]' : g.isActive ? 'text-[#22c55e]' : 'text-[var(--text-3)]'
                  }`}>
                    {g.isBanned ? 'Banni' : g.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-xs text-[var(--text-2)] capitalize">{g.plan}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-xs text-[var(--text-3)]">
                  {new Date(g.createdAt).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/superadmin/instances/${g.id}`} className="text-[var(--accent)] text-sm hover:underline">
                    →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
