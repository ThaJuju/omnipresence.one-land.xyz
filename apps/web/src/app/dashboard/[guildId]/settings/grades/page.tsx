'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getGuildMember, requirePermission } from '@/lib/api'

type DiscordRole = { id: string; name: string; color: number; position: number; managed: boolean }

async function fetchDiscordRoles(discordGuildId: string): Promise<DiscordRole[]> {
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${discordGuildId}/roles`, {
      headers: { Authorization: `Bot ${process.env['DISCORD_BOT_TOKEN']}` },
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const roles = await res.json() as DiscordRole[]
    return roles
      .filter((r) => r.id !== discordGuildId && !r.managed)
      .sort((a, b) => b.position - a.position)
  } catch {
    return []
  }
}

async function createCategory(guildId: string, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')

  const name = (formData.get('name') as string).trim()
  const color = formData.get('color') as string
  if (!name) return

  const maxPos = await prisma.gradeCategory.aggregate({ where: { guildId }, _max: { position: true } })
  await prisma.gradeCategory.create({
    data: { guildId, name, color: color || '#6366f1', position: (maxPos._max.position ?? 0) + 1 },
  })
  revalidatePath(`/dashboard/${guildId}/settings/grades`)
}

async function deleteCategory(guildId: string, categoryId: string) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')

  await prisma.grade.deleteMany({ where: { categoryId } })
  await prisma.gradeCategory.delete({ where: { id: categoryId, guildId } })
  revalidatePath(`/dashboard/${guildId}/settings/grades`)
}

async function fetchDiscordGuildMembers(discordGuildId: string): Promise<{ userId: string; roles: string[] }[]> {
  const result: { userId: string; roles: string[] }[] = []
  let after = '0'
  for (let i = 0; i < 10; i++) {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${discordGuildId}/members?limit=1000&after=${after}`,
      { headers: { Authorization: `Bot ${process.env['DISCORD_BOT_TOKEN']}` }, cache: 'no-store' }
    )
    if (!res.ok) break
    const chunk = await res.json() as { user: { id: string }; roles: string[] }[]
    if (!chunk.length) break
    for (const m of chunk) result.push({ userId: m.user.id, roles: m.roles })
    if (chunk.length < 1000) break
    after = chunk[chunk.length - 1]!.user.id
  }
  return result
}

async function syncGradesFromDiscord(guildId: string) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const admin = await getGuildMember(guildId, session.user.discordId)
  requirePermission(admin.panelRole, 'settings.edit')

  const guild = await prisma.guildInstance.findUnique({ where: { id: guildId } })
  if (!guild) return

  const grades = await prisma.grade.findMany({
    where: { guildId, discordRoleId: { not: null } },
    orderBy: { position: 'asc' },
  })
  if (!grades.length) return

  const roleToGrade = new Map(grades.map((g) => [g.discordRoleId!, g.id]))
  const discordMembers = await fetchDiscordGuildMembers(guild.discordGuildId)

  for (const dm of discordMembers) {
    // Premier grade trouvé par ordre de position (priorité la plus haute)
    let assignedGradeId: string | null = null
    for (const grade of grades) {
      if (grade.discordRoleId && dm.roles.includes(grade.discordRoleId)) {
        assignedGradeId = grade.id
        break
      }
    }
    if (assignedGradeId) {
      await prisma.member.updateMany({
        where: { guildId, discordUserId: dm.userId },
        data: { gradeId: assignedGradeId },
      })
    }
  }

  await prisma.auditLog.create({
    data: { guildId, adminId: admin.id, action: `Sync grades depuis Discord (${discordMembers.length} membres scannés)` },
  })
  revalidatePath(`/dashboard/${guildId}/settings/grades`)
}

async function createGrade(guildId: string, categoryId: string | null, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')

  const name = (formData.get('name') as string).trim()
  const color = formData.get('color') as string
  const discordRoleId = (formData.get('discordRoleId') as string) || null
  if (!name) return

  const maxPos = await prisma.grade.aggregate({ where: { guildId, categoryId }, _max: { position: true } })
  const grade = await prisma.grade.create({
    data: {
      guildId,
      categoryId: categoryId || null,
      name,
      color: color || '#8b8fa8',
      discordRoleId: discordRoleId || null,
      position: (maxPos._max.position ?? 0) + 1,
    },
  })

  // Auto-sync: assigne ce grade aux membres Discord qui ont le rôle correspondant
  if (discordRoleId) {
    const guild = await prisma.guildInstance.findUnique({ where: { id: guildId } })
    if (guild) {
      const discordMembers = await fetchDiscordGuildMembers(guild.discordGuildId)
      const userIds = discordMembers
        .filter((m) => m.roles.includes(discordRoleId))
        .map((m) => m.userId)
      if (userIds.length) {
        await prisma.member.updateMany({
          where: { guildId, discordUserId: { in: userIds } },
          data: { gradeId: grade.id },
        })
      }
    }
  }

  revalidatePath(`/dashboard/${guildId}/settings/grades`)
}

async function deleteGrade(guildId: string, gradeId: string) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')

  await prisma.grade.delete({ where: { id: gradeId, guildId } })
  revalidatePath(`/dashboard/${guildId}/settings/grades`)
}

function RoleSelect({ name, roles }: { name: string; roles: DiscordRole[] }) {
  if (roles.length === 0) {
    return (
      <input
        name={name}
        placeholder="ID rôle Discord (optionnel)"
        className="flex-1 bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-xs text-[var(--text)] font-mono placeholder-[#383865] focus:outline-none focus:border-[var(--accent)]"
      />
    )
  }
  return (
    <select
      name={name}
      className="flex-1 bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
    >
      <option value="">— Aucun rôle —</option>
      {roles.map((r) => (
        <option key={r.id} value={r.id}>{r.name}</option>
      ))}
    </select>
  )
}

export default async function GradesSettingsPage({ params }: { params: { guildId: string } }) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params

  const guild = await prisma.guildInstance.findUnique({ where: { id: guildId } })
  if (!guild) redirect('/dashboard')

  const [categories, uncategorized, discordRoles] = await Promise.all([
    prisma.gradeCategory.findMany({
      where: { guildId },
      include: { grades: { orderBy: { position: 'asc' } } },
      orderBy: { position: 'asc' },
    }),
    prisma.grade.findMany({ where: { guildId, categoryId: null }, orderBy: { position: 'asc' } }),
    fetchDiscordRoles(guild.discordGuildId),
  ])

  const roleMap = new Map(discordRoles.map((r) => [r.id, r.name]))
  const createCategoryAction = createCategory.bind(null, guildId)
  const createUncategorizedGrade = createGrade.bind(null, guildId, null)
  const syncAction = syncGradesFromDiscord.bind(null, guildId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Grades & Catégories</h2>
          <p className="text-[var(--text-2)] text-sm mt-1">
            Lie chaque grade à un rôle Discord — les membres sont assignés automatiquement
          </p>
        </div>
        <form action={syncAction}>
          <button
            type="submit"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors hover:bg-white/[0.06]"
            style={{ color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync depuis Discord
          </button>
        </form>
      </div>

      {/* Nouvelle catégorie */}
      <form action={createCategoryAction} className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-4">
        <h2 className="font-semibold text-[var(--text)] mb-3">Nouvelle catégorie</h2>
        <div className="flex gap-3">
          <input
            name="name"
            placeholder="Nom de la catégorie"
            required
            maxLength={50}
            className="flex-1 bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#383865] focus:outline-none focus:border-[var(--accent)]"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-2)]">Couleur</label>
            <input
              type="color"
              name="color"
              defaultValue="#5865F2"
              className="h-9 w-10 bg-[var(--bg)] border border-white/[0.07] rounded cursor-pointer"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-80 hover:bg-[var(--accent)] transition-colors whitespace-nowrap"
          >
            + Créer
          </button>
        </div>
      </form>

      {/* Catégories existantes */}
      {categories.map((cat) => {
        const deleteCategoryAction = deleteCategory.bind(null, guildId, cat.id)
        const createGradeInCat = createGrade.bind(null, guildId, cat.id)

        return (
          <div key={cat.id} className="bg-[var(--surface)] rounded-md border border-white/[0.07] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.07] flex items-center gap-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <h2 className="font-semibold text-[var(--text)] flex-1">{cat.name}</h2>
              <span className="text-xs text-[var(--text-3)]">{cat.grades.length} grade(s)</span>
              <form action={deleteCategoryAction}>
                <button type="submit" className="text-xs text-[#ef4444] hover:text-[#ff6b81] px-2 py-1 transition-colors">
                  Supprimer catégorie
                </button>
              </form>
            </div>

            {cat.grades.length > 0 && (
              <ul className="divide-y divide-[#1a1a40]">
                {cat.grades.map((grade) => {
                  const deleteGradeAction = deleteGrade.bind(null, guildId, grade.id)
                  return (
                    <li key={grade.id} className="px-4 py-2.5 flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: grade.color }} />
                      <span className="text-sm text-[var(--text)] flex-1">{grade.name}</span>
                      {grade.discordRoleId && (
                        <span className="text-xs text-[var(--text-2)] hidden sm:block">
                          {roleMap.get(grade.discordRoleId) ?? grade.discordRoleId}
                        </span>
                      )}
                      <form action={deleteGradeAction}>
                        <button type="submit" className="text-xs text-[#ef4444] hover:text-[#ff6b81] px-2 py-1 transition-colors">
                          ✕
                        </button>
                      </form>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Ajouter un grade dans cette catégorie */}
            <form action={createGradeInCat} className="px-4 py-3 border-t border-white/[0.07] bg-[var(--bg)]">
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <input
                  name="name"
                  placeholder="Nom du grade"
                  required
                  maxLength={50}
                  className="flex-1 bg-[var(--surface)] border border-white/[0.07] rounded-lg px-3 py-1.5 text-xs text-[var(--text)] placeholder-[#383865] focus:outline-none focus:border-[var(--accent)]"
                />
                <RoleSelect name="discordRoleId" roles={discordRoles} />
                <input
                  type="color"
                  name="color"
                  defaultValue="#6868a8"
                  className="h-8 w-9 bg-[var(--surface)] border border-white/[0.07] rounded cursor-pointer"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#22c55e] text-black rounded-lg text-xs font-semibold hover:bg-[#16a34a] transition-colors whitespace-nowrap"
                >
                  + Grade
                </button>
              </div>
            </form>
          </div>
        )
      })}

      {/* Sans catégorie */}
      {uncategorized.length > 0 && (
        <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.07]">
            <h2 className="font-semibold text-[var(--text-2)]">Sans catégorie</h2>
          </div>
          <ul className="divide-y divide-[#1a1a40]">
            {uncategorized.map((grade) => {
              const deleteGradeAction = deleteGrade.bind(null, guildId, grade.id)
              return (
                <li key={grade.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: grade.color }} />
                  <span className="text-sm text-[var(--text)] flex-1">{grade.name}</span>
                  {grade.discordRoleId && (
                    <span className="text-xs text-[var(--text-2)]">
                      {roleMap.get(grade.discordRoleId) ?? grade.discordRoleId}
                    </span>
                  )}
                  <form action={deleteGradeAction}>
                    <button type="submit" className="text-xs text-[#ef4444] hover:text-[#ff6b81] px-2 py-1 transition-colors">✕</button>
                  </form>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {categories.length === 0 && uncategorized.length === 0 && (
        <div className="text-center py-16 text-[var(--text-2)]">
          <div className="text-4xl mb-3">🏅</div>
          <p className="font-medium text-[var(--text)] mb-1">Aucun grade configuré</p>
          <p className="text-sm">Crée une catégorie puis ajoute des grades dedans.</p>
        </div>
      )}

      {/* Grades sans catégorie — formulaire d'ajout */}
      <form action={createUncategorizedGrade} className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-4">
        <h2 className="font-semibold text-[var(--text)] mb-3">Ajouter un grade sans catégorie</h2>
        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          <input
            name="name"
            placeholder="Nom du grade"
            required
            maxLength={50}
            className="flex-1 bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#383865] focus:outline-none focus:border-[var(--accent)]"
          />
          <RoleSelect name="discordRoleId" roles={discordRoles} />
          <input
            type="color"
            name="color"
            defaultValue="#6868a8"
            className="h-9 w-10 bg-[var(--bg)] border border-white/[0.07] rounded cursor-pointer"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-80 hover:bg-[var(--accent)] transition-colors whitespace-nowrap"
          >
            + Ajouter
          </button>
        </div>
      </form>
    </div>
  )
}
