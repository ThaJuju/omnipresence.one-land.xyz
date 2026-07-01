'use server'

import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { getSuperAdminAccess } from '@/lib/superadmin-access'
import { autoLinkMatchingGuilds } from '@/lib/superadmin-group-match'

async function renameGroup(groupId: string, formData: FormData) {
  'use server'
  const session = await auth()
  const access = await getSuperAdminAccess(session?.user?.discordId)
  if (!access?.isDev) return

  const name = (formData.get('name') as string).trim()
  if (!name) return

  await prisma.superAdminGroup.update({ where: { id: groupId }, data: { name } })
  await autoLinkMatchingGuilds(groupId, name)
  revalidatePath(`/superadmin/groups/${groupId}`)
  revalidatePath('/superadmin/groups')
}

async function syncMatchingGuilds(groupId: string, groupName: string) {
  'use server'
  const session = await auth()
  const access = await getSuperAdminAccess(session?.user?.discordId)
  if (!access?.isDev) return

  await autoLinkMatchingGuilds(groupId, groupName)
  revalidatePath(`/superadmin/groups/${groupId}`)
}

async function updateGroupGuilds(groupId: string, formData: FormData) {
  'use server'
  const session = await auth()
  const access = await getSuperAdminAccess(session?.user?.discordId)
  if (!access?.isDev) return

  const guildIds = formData.getAll('guildIds').map(String)

  await prisma.$transaction([
    prisma.superAdminGroupGuild.deleteMany({ where: { groupId } }),
    prisma.superAdminGroupGuild.createMany({
      data: guildIds.map((guildId) => ({ groupId, guildId })),
    }),
  ])
  revalidatePath(`/superadmin/groups/${groupId}`)
  revalidatePath('/superadmin/groups')
}

async function addGroupMember(groupId: string, formData: FormData) {
  'use server'
  const session = await auth()
  const access = await getSuperAdminAccess(session?.user?.discordId)
  if (!access?.isDev) return

  const discordUserId = (formData.get('discordUserId') as string).trim()
  if (!discordUserId || !/^\d+$/.test(discordUserId)) return

  await prisma.superAdminGroupMember.upsert({
    where: { groupId_discordUserId: { groupId, discordUserId } },
    update: {},
    create: { groupId, discordUserId },
  })
  revalidatePath(`/superadmin/groups/${groupId}`)
  revalidatePath('/superadmin/groups')
}

async function removeGroupMember(groupId: string, discordUserId: string) {
  'use server'
  const session = await auth()
  const access = await getSuperAdminAccess(session?.user?.discordId)
  if (!access?.isDev) return

  await prisma.superAdminGroupMember.deleteMany({ where: { groupId, discordUserId } })
  revalidatePath(`/superadmin/groups/${groupId}`)
  revalidatePath('/superadmin/groups')
}

export default async function SuperAdminGroupDetailPage({ params }: { params: { groupId: string } }) {
  const session = await auth()
  const access = await getSuperAdminAccess(session?.user?.discordId)
  if (!access?.isDev) redirect('/superadmin')

  const { groupId } = params

  const [group, allGuilds] = await Promise.all([
    prisma.superAdminGroup.findUnique({
      where: { id: groupId },
      include: { guilds: true, members: { orderBy: { createdAt: 'asc' } } },
    }),
    prisma.guildInstance.findMany({ orderBy: { discordGuildName: 'asc' } }),
  ])

  if (!group) redirect('/superadmin/groups')

  const groupGuildIds = new Set(group.guilds.map((g) => g.guildId))

  const renameAction = renameGroup.bind(null, groupId)
  const updateGuildsAction = updateGroupGuilds.bind(null, groupId)
  const addMemberAction = addGroupMember.bind(null, groupId)
  const syncAction = syncMatchingGuilds.bind(null, groupId, group.name)

  return (
    <div className="space-y-6">
      <div>
        <a href="/superadmin/groups" className="text-xs text-[var(--text-3)] hover:text-[var(--text-2)]">← Groupes</a>
        <h1 className="text-2xl font-bold text-[var(--text)] mt-1">{group.name}</h1>
      </div>

      <form action={renameAction} className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-5 flex gap-3">
        <input
          name="name"
          defaultValue={group.name}
          required
          className="flex-1 bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-80 transition-colors whitespace-nowrap"
        >
          Renommer
        </button>
      </form>

      <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-5">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="font-semibold text-[var(--text)]">Serveurs du groupe</h2>
          <form action={syncAction}>
            <button
              type="submit"
              className="text-xs px-2.5 py-1 border border-white/[0.07] rounded-lg text-[var(--text-2)] hover:text-[var(--text)] hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              🔍 Rechercher les correspondances
            </button>
          </form>
        </div>
        <p className="text-xs text-[var(--text-2)] mb-4">
          Les membres de ce groupe verront uniquement ces serveurs dans le panel superadmin. Tout serveur dont le nom contient
          « {group.name} » est ajouté automatiquement (à la création/au renommage du groupe, à l&apos;arrivée d&apos;un nouveau serveur,
          ou via le bouton ci-dessus pour les serveurs déjà existants).
        </p>
        <form action={updateGuildsAction} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
            {allGuilds.map((g) => (
              <label
                key={g.id}
                className="flex items-center gap-2 px-3 py-2 bg-[var(--bg)] rounded-lg border border-white/[0.07] cursor-pointer"
              >
                <input
                  type="checkbox"
                  name="guildIds"
                  value={g.id}
                  defaultChecked={groupGuildIds.has(g.id)}
                  className="accent-[var(--accent)]"
                />
                <span className="text-sm text-[var(--text)] truncate">{g.discordGuildName}</span>
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-80 transition-colors"
          >
            Mettre à jour les serveurs
          </button>
        </form>
      </div>

      <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-5">
        <h2 className="font-semibold text-[var(--text)] mb-1">Membres autorisés</h2>
        <p className="text-xs text-[var(--text-2)] mb-4">
          Accès en lecture seule au superadmin, limité aux serveurs ci-dessus.
        </p>

        <form action={addMemberAction} className="flex gap-3 mb-4">
          <input
            name="discordUserId"
            placeholder="Discord User ID"
            required
            pattern="\d+"
            className="flex-1 bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] font-mono placeholder-[#383865] focus:outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-80 transition-colors whitespace-nowrap"
          >
            + Ajouter
          </button>
        </form>

        {group.members.length === 0 ? (
          <p className="text-sm text-[var(--text-3)]">Aucun membre pour le moment.</p>
        ) : (
          <ul className="divide-y divide-[#1a1a40]">
            {group.members.map((m) => {
              const remove = removeGroupMember.bind(null, groupId, m.discordUserId)
              return (
                <li key={m.id} className="py-2.5 flex items-center justify-between">
                  <code className="text-sm text-[var(--text)] font-mono">{m.discordUserId}</code>
                  <form action={remove}>
                    <button
                      type="submit"
                      className="text-xs text-[#ef4444] hover:text-[#ff6b81] transition-colors px-2 py-1"
                    >
                      Retirer
                    </button>
                  </form>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
