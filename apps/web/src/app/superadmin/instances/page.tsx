import { prisma } from '@repo/db'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getSuperAdminAccess } from '@/lib/superadmin-access'
import { redirect } from 'next/navigation'

const GRACE_PERIOD_DAYS = 14

export default async function InstancesPage() {
  const session = await auth()
  const access = await getSuperAdminAccess(session?.user?.discordId)
  if (!access) redirect('/dashboard')

  const scopeWhere = access.isDev ? {} : { id: { in: access.guildIds } }

  const guilds = await prisma.guildInstance.findMany({
    where: { ...scopeWhere, isActive: true },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { members: true } } },
  })

  // Serveurs sans le bot, en sursis avant suppression définitive — visible seulement par le dev
  const staleGuilds = access.isDev
    ? await prisma.guildInstance.findMany({
        where: { isActive: false },
        orderBy: { deactivatedAt: 'asc' },
        include: { _count: { select: { members: true } } },
      })
    : []

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

      {access.isDev && staleGuilds.length > 0 && (
        <div className="bg-[var(--surface)] rounded-md border border-[#eab30830] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#eab30830]">
            <h2 className="font-semibold text-[#eab308] text-sm">Serveurs sans le bot — en sursis</h2>
            <p className="text-xs text-[var(--text-2)] mt-0.5">
              Le bot n&apos;est plus sur ces serveurs. Suppression définitive de toutes les données {GRACE_PERIOD_DAYS} jours après le départ du bot.
            </p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase">Serveur</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase hidden md:table-cell">Membres</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase">Bot parti le</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase">Suppression prévue</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {staleGuilds.map((g) => {
                const deactivatedAt = g.deactivatedAt ?? g.updatedAt
                const deleteAt = new Date(deactivatedAt)
                deleteAt.setDate(deleteAt.getDate() + GRACE_PERIOD_DAYS)
                const daysLeft = Math.max(0, Math.ceil((deleteAt.getTime() - Date.now()) / 86_400_000))
                return (
                  <tr key={g.id} className="border-b border-white/[0.07] last:border-0">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-[var(--text)]">{g.discordGuildName}</p>
                      <p className="text-xs text-[var(--text-3)] font-mono">{g.discordGuildId}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-sm text-[var(--text-2)]">{g._count.members}</td>
                    <td className="px-4 py-3 text-xs text-[var(--text-2)]">
                      {new Date(deactivatedAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={daysLeft <= 3 ? 'text-[#ef4444] font-medium' : 'text-[#eab308]'}>
                        {deleteAt.toLocaleDateString('fr-FR')} ({daysLeft}j)
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/superadmin/instances/${g.id}`} className="text-[var(--accent)] text-sm hover:underline">
                        →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
