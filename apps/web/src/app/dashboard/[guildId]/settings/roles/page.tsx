'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getGuildMember, requirePermission } from '@/lib/api'
import { getLocale } from '@/i18n/server'
import { getT } from '@/i18n/translations'

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
  const t = getT(getLocale())
  const r = t.settingsRoles

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">{r.title}</h2>
        <p className="text-[var(--text-2)] text-sm mt-1">{r.subtitle}</p>
      </div>

      <div className="card p-4 text-sm text-[var(--text-2)]">
        {r.ownerInfoPrefix}{' '}
        <span className="font-semibold" style={{ color: 'var(--danger)' }}>ADMIN</span> {r.ownerInfoSuffix}
      </div>

      <form action={addBindingAction} className="card p-5 space-y-4">
        <h2 className="font-semibold text-[var(--text)]">{r.addBinding}</h2>

        {discordRoles.length > 0 ? (
          <div className="flex gap-3 flex-wrap sm:flex-nowrap">
            <select
              name="discordRoleId"
              required
              className="flex-1 input px-3 py-2 text-sm"
            >
              <option value="">{r.selectRole}</option>
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
              className="input px-3 py-2 text-sm"
            >
              {panelRoleOrder.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 py-2 btn-primary text-sm whitespace-nowrap"
            >
              {r.addBtn}
            </button>
          </div>
        ) : (
          <div className="flex gap-3 flex-wrap sm:flex-nowrap">
            <input
              name="discordRoleId"
              placeholder={r.roleIdPlaceholder}
              required
              pattern="\d+"
              className="flex-1 input px-3 py-2 text-sm font-mono"
            />
            <select
              name="panelRole"
              defaultValue="MODERATEUR"
              className="input px-3 py-2 text-sm"
            >
              {panelRoleOrder.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 py-2 btn-primary text-sm whitespace-nowrap"
            >
              {r.addBtn}
            </button>
          </div>
        )}

        {discordRoles.length > 0 && (
          <details className="text-xs text-[var(--text-3)]">
            <summary className="cursor-pointer hover:text-[var(--text-2)]">
              {r.seeAllRoles(discordRoles.length)}
            </summary>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {discordRoles.map((role) => (
                <div key={role.id} className="flex items-center gap-2 px-2 py-1 bg-[var(--bg)] rounded border border-[var(--border)]">
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
          <div key={panelRole} className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: panelRoleColors[panelRole] }}
              />
              <span className="font-semibold text-[var(--text)]">{panelRole}</span>
              <span className="text-xs text-[var(--text-3)]">{r.bindingCount(byRole[panelRole]?.length ?? 0)}</span>
            </div>
            {byRole[panelRole] && byRole[panelRole]!.length > 0 ? (
              <ul className="divide-y divide-[var(--border)]">
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
                          className="text-xs text-[var(--danger)] hover:text-[#ff6b81] transition-colors px-2 py-1"
                        >
                          {t.common.delete}
                        </button>
                      </form>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-[var(--text-3)]">{r.noBinding}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
