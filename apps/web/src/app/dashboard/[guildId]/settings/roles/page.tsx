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

function intToHex(color: number) {
  if (!color) return '#99aab5'
  return `#${color.toString(16).padStart(6, '0')}`
}

async function addBinding(guildId: string, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.discord')

  const discordRoleId = (formData.get('discordRoleId') as string).trim()
  const panelRole = formData.get('panelRole') as string

  if (!discordRoleId || !/^\d+$/.test(discordRoleId)) return

  await prisma.discordRoleBinding.upsert({
    where: { guildId_discordRoleId: { guildId, discordRoleId } },
    update: { panelRole: panelRole as never },
    create: { guildId, discordRoleId, panelRole: panelRole as never },
  })

  revalidatePath(`/dashboard/${guildId}/settings/roles`)
}

async function removeBinding(guildId: string, discordRoleId: string) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'settings.discord')

  await prisma.discordRoleBinding.deleteMany({ where: { guildId, discordRoleId } })
  revalidatePath(`/dashboard/${guildId}/settings/roles`)
}

export default async function RolesSettingsPage({ params }: { params: { guildId: string } }) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params

  const guild = await prisma.guildInstance.findUnique({ where: { id: guildId } })
  if (!guild) redirect('/dashboard')

  const [bindings, discordRoles] = await Promise.all([
    prisma.discordRoleBinding.findMany({ where: { guildId }, orderBy: { panelRole: 'asc' } }),
    fetchDiscordRoles(guild.discordGuildId),
  ])

  const roleMap = new Map(discordRoles.map((r) => [r.id, r]))

  const panelRoleOrder = ['ADMIN', 'DIRECTION', 'RESPONSABLE', 'MODERATEUR', 'MEMBRE']
  const panelRoleColors: Record<string, string> = {
    ADMIN: '#ef4444',
    DIRECTION: '#eab308',
    RESPONSABLE: '#6366f1',
    MODERATEUR: '#22c55e',
    MEMBRE: '#8b8fa8',
  }

  const byRole = panelRoleOrder.reduce(
    (acc, role) => {
      acc[role] = bindings.filter((b) => b.panelRole === role)
      return acc
    },
    {} as Record<string, typeof bindings>
  )

  const addBindingAction = addBinding.bind(null, guildId)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">Binding des rôles</h2>
        <p className="text-[var(--text-2)] text-sm mt-1">Lier les rôles Discord aux rôles panel</p>
      </div>

      <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-4 text-sm text-[var(--text-2)]">
        ℹ️ Le propriétaire du serveur Discord est automatiquement{' '}
        <span className="font-semibold" style={{ color: '#ef4444' }}>ADMIN</span> sans binding.
        Un membre peut avoir plusieurs rôles Discord — le rôle panel le plus élevé s&apos;applique.
      </div>

      <form action={addBindingAction} className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-5 space-y-4">
        <h2 className="font-semibold text-[var(--text)]">Ajouter un binding</h2>

        {discordRoles.length > 0 ? (
          <div className="flex gap-3 flex-wrap sm:flex-nowrap">
            <select
              name="discordRoleId"
              required
              className="flex-1 bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="">— Sélectionner un rôle Discord —</option>
              {discordRoles.map((role) => {
                const alreadyBound = bindings.find((b) => b.discordRoleId === role.id)
                return (
                  <option key={role.id} value={role.id}>
                    {role.name}{alreadyBound ? ` (→ ${alreadyBound.panelRole})` : ''}
                  </option>
                )
              })}
            </select>
            <select
              name="panelRole"
              defaultValue="MODERATEUR"
              className="bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            >
              {panelRoleOrder.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-80 hover:bg-[var(--accent)] transition-colors whitespace-nowrap"
            >
              + Ajouter
            </button>
          </div>
        ) : (
          <div className="flex gap-3 flex-wrap sm:flex-nowrap">
            <input
              name="discordRoleId"
              placeholder="ID du rôle Discord"
              required
              pattern="\d+"
              className="flex-1 bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] font-mono placeholder-[#383865] focus:outline-none focus:border-[var(--accent)]"
            />
            <select
              name="panelRole"
              defaultValue="MODERATEUR"
              className="bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            >
              {panelRoleOrder.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-80 hover:bg-[var(--accent)] transition-colors whitespace-nowrap"
            >
              + Ajouter
            </button>
          </div>
        )}

        {discordRoles.length > 0 && (
          <details className="text-xs text-[var(--text-3)]">
            <summary className="cursor-pointer hover:text-[var(--text-2)]">
              Voir tous les rôles disponibles ({discordRoles.length})
            </summary>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {discordRoles.map((role) => (
                <div key={role.id} className="flex items-center gap-2 px-2 py-1 bg-[var(--bg)] rounded border border-white/[0.07]">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: intToHex(role.color) }}
                  />
                  <span className="text-[var(--text)] truncate">{role.name}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </form>

      <div className="space-y-4">
        {panelRoleOrder.map((panelRole) => (
          <div key={panelRole} className="bg-[var(--surface)] rounded-md border border-white/[0.07] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.07] flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: panelRoleColors[panelRole] }}
              />
              <span className="font-semibold text-[var(--text)]">{panelRole}</span>
              <span className="text-xs text-[var(--text-3)]">{byRole[panelRole]?.length ?? 0} binding(s)</span>
            </div>
            {byRole[panelRole] && byRole[panelRole]!.length > 0 ? (
              <ul className="divide-y divide-[#1a1a40]">
                {byRole[panelRole]!.map((binding) => {
                  const discordRole = roleMap.get(binding.discordRoleId)
                  const remove = removeBinding.bind(null, guildId, binding.discordRoleId)
                  return (
                    <li key={binding.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {discordRole && (
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: intToHex(discordRole.color) }}
                          />
                        )}
                        <span className="text-sm font-medium text-[var(--text)]">
                          {discordRole?.name ?? binding.discordRoleId}
                        </span>
                        <code className="text-xs text-[var(--text-3)] font-mono hidden sm:block">
                          {binding.discordRoleId}
                        </code>
                      </div>
                      <form action={remove}>
                        <button
                          type="submit"
                          className="text-xs text-[#ef4444] hover:text-[#ff6b81] transition-colors px-2 py-1"
                        >
                          Supprimer
                        </button>
                      </form>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-[var(--text-3)]">Aucun rôle Discord bindé.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
