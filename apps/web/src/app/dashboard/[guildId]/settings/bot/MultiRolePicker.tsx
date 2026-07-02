'use client'

import { useState } from 'react'

type DiscordRole = { id: string; name: string; color: number; position: number; managed: boolean }

function roleColor(r: DiscordRole) {
  return r.color ? `#${r.color.toString(16).padStart(6, '0')}` : undefined
}

export default function MultiRolePicker({ name, defaultValues, roles }: {
  name: string; defaultValues: string[]; roles: DiscordRole[]
}) {
  const [selected, setSelected] = useState<string[]>(defaultValues)
  const [pending, setPending] = useState('')

  const available = roles.filter((r) => !selected.includes(r.id))
  const hasRoleList = roles.length > 0

  function addRole() {
    const id = pending.trim()
    if (!id || selected.includes(id)) return
    setSelected((prev) => [...prev, id])
    setPending('')
  }

  function removeRole(id: string) {
    setSelected((prev) => prev.filter((r) => r !== id))
  }

  return (
    <div className="space-y-2">
      {selected.map((id) => {
        const role = roles.find((r) => r.id === id)
        return (
          <div key={id} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
            <input type="hidden" name={name} value={id} />
            <span className="text-sm" style={role && roleColor(role) ? { color: roleColor(role) } : undefined}>
              {role ? `@${role.name}` : id}
            </span>
            <button type="button" onClick={() => removeRole(id)}
              aria-label="Retirer ce rôle"
              className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--text-2)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors">
              −
            </button>
          </div>
        )
      })}

      {hasRoleList ? (
        available.length > 0 && (
          <div className="flex gap-2">
            <select value={pending} onChange={(e) => setPending(e.target.value)}
              className="flex-1 input px-3 py-2 text-sm">
              <option value="">— Choisir un rôle —</option>
              {available.map((r) => (
                <option key={r.id} value={r.id} style={roleColor(r) ? { color: roleColor(r) } : undefined}>{r.name}</option>
              ))}
            </select>
            <button type="button" onClick={addRole} disabled={!pending}
              aria-label="Ajouter ce rôle"
              className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all">
              +
            </button>
          </div>
        )
      ) : (
        <div className="flex gap-2">
          <input value={pending} onChange={(e) => setPending(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRole() } }}
            placeholder="ID du rôle Discord"
            className="flex-1 input px-3 py-2 text-sm font-mono" />
          <button type="button" onClick={addRole} disabled={!pending.trim()}
            aria-label="Ajouter ce rôle"
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all">
            +
          </button>
        </div>
      )}
    </div>
  )
}
