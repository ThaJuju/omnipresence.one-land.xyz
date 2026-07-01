'use client'

import { useState } from 'react'
import Link from 'next/link'
import { avatarUrl, formatDate } from '@/lib/utils'
import type { Member, Grade } from '@repo/db'
import { getT, type Locale } from '@/i18n/translations'

type MemberWithGrade = Member & { grade: Grade | null }

const PANEL_ROLE_COLORS: Record<string, string> = {
  ADMIN: 'text-[var(--danger)]',
  DIRECTION: 'text-[var(--warning)]',
  RESPONSABLE: 'text-[var(--accent)]',
  MODERATEUR: 'text-[var(--success)]',
  MEMBRE: 'text-[var(--text-2)]',
}

export default function MemberList({ members, guildId, locale }: { members: MemberWithGrade[]; guildId: string; locale: Locale }) {
  const tr = getT(locale)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('active')

  const filtered = members.filter((m) => {
    const name = (m.discordNickname ?? m.discordUsername).toLowerCase()
    const matchSearch = !search || name.includes(search.toLowerCase()) || m.discordUsername.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || m.panelRole === roleFilter
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? m.isActive : !m.isActive)
    return matchSearch && matchRole && matchStatus
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr.members.searchPlaceholder}
            className="w-full input pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]">
          <option value="all">{tr.members.allRoles}</option>
          <option value="ADMIN">Admin</option>
          <option value="DIRECTION">Direction</option>
          <option value="RESPONSABLE">Responsable</option>
          <option value="MODERATEUR">Modérateur</option>
          <option value="MEMBRE">Membre</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]">
          <option value="active">{tr.members.activeOnly}</option>
          <option value="inactive">{tr.members.inactiveOnly}</option>
          <option value="all">{tr.members.allStatuses}</option>
        </select>
      </div>

      <p className="text-xs text-[var(--text-3)]">{filtered.length} {tr.members.noResults.toLowerCase()}</p>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-2)]">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm">{tr.members.noResults}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase tracking-wider">{tr.common.member}</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase tracking-wider hidden md:table-cell">Grade</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase tracking-wider hidden lg:table-cell">{tr.common.status}</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase tracking-wider hidden lg:table-cell">{tr.members.joinedOn}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => {
                const avatar = avatarUrl(member.discordUserId, member.discordAvatar)
                return (
                  <tr key={member.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--hover)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={avatar} alt={member.discordUsername} className="w-8 h-8 rounded-full flex-shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-[var(--text)]">
                              {member.discordNickname ?? member.discordUsername}
                            </p>
                            {!member.isActive && (
                              <span className="text-[10px] text-[var(--text-3)] bg-[var(--hover)] px-1.5 py-0.5 rounded">{tr.common.inactive}</span>
                            )}
                          </div>
                          {member.discordNickname && (
                            <p className="text-xs text-[var(--text-2)]">{member.discordUsername}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {member.grade ? (
                        <span className="text-xs font-medium px-2 py-1 rounded-full"
                          style={{ backgroundColor: `${member.grade.color}20`, color: member.grade.color }}>
                          {member.grade.name}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-3)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={`text-xs font-medium ${PANEL_ROLE_COLORS[member.panelRole] ?? 'text-[var(--text-2)]'}`}>
                        {member.panelRole}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-[var(--text-3)]">{formatDate(member.joinedAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/${guildId}/members/${member.id}`}
                        className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors text-lg">
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
