'use server'

import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getSuperAdminAccess } from '@/lib/superadmin-access'
import { autoLinkMatchingGuilds } from '@/lib/superadmin-group-match'

async function createGroup(formData: FormData) {
  'use server'
  const session = await auth()
  const access = await getSuperAdminAccess(session?.user?.discordId)
  if (!access?.isDev) return

  const name = (formData.get('name') as string).trim()
  if (!name) return

  const group = await prisma.superAdminGroup.create({ data: { name } })
  await autoLinkMatchingGuilds(group.id, name)
  revalidatePath('/superadmin/groups')
}

async function deleteGroup(groupId: string) {
  'use server'
  const session = await auth()
  const access = await getSuperAdminAccess(session?.user?.discordId)
  if (!access?.isDev) return

  await prisma.superAdminGroup.delete({ where: { id: groupId } })
  revalidatePath('/superadmin/groups')
}

export default async function SuperAdminGroupsPage() {
  const session = await auth()
  const access = await getSuperAdminAccess(session?.user?.discordId)
  if (!access?.isDev) redirect('/superadmin')

  const groups = await prisma.superAdminGroup.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { guilds: true, members: true } } },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Groupes d&apos;accès</h1>
        <p className="text-[var(--text-2)] text-sm mt-1">
          Donne un accès superadmin en lecture seule, limité à certains serveurs, à d&apos;autres personnes.
        </p>
      </div>

      <form action={createGroup} className="card p-5 space-y-2">
        <div className="flex gap-3">
          <input
            name="name"
            placeholder="Nom du groupe (ex: Omerta)"
            required
            className="flex-1 input px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 btn-primary text-sm whitespace-nowrap"
          >
            + Créer un groupe
          </button>
        </div>
        <p className="text-xs text-[var(--text-3)]">
          Tout serveur Discord dont le nom contient ce mot sera automatiquement ajouté au groupe (à la création, et plus tard s&apos;il rejoint la plateforme).
        </p>
      </form>

      <div className="card overflow-hidden">
        {groups.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[var(--text-3)]">Aucun groupe pour le moment.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase">Nom</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase">Serveurs</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase">Membres</th>
                <th className="w-32"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const remove = deleteGroup.bind(null, g.id)
                return (
                  <tr key={g.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/superadmin/groups/${g.id}`} className="text-sm font-medium text-[var(--accent)] hover:underline">
                        {g.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-2)]">{g._count.guilds}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-2)]">{g._count.members}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={remove}>
                        <button
                          type="submit"
                          className="text-xs text-[var(--danger)] hover:text-[#ff6b81] transition-colors px-2 py-1"
                        >
                          Supprimer
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
