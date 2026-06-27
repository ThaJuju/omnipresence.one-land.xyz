'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { avatarUrl, formatDate } from '@/lib/utils'
import { getGuildMember, requirePermission } from '@/lib/api'
import type { PanelRole } from '@repo/shared'

async function setMemberGrade(guildId: string, memberId: string, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const admin = await getGuildMember(guildId, session.user.discordId)
  requirePermission(admin.panelRole, 'members.edit')

  const gradeId = formData.get('gradeId') as string | null
  await prisma.member.update({ where: { id: memberId, guildId }, data: { gradeId: gradeId || null } })
  if (gradeId) {
    await prisma.gradeHistory.create({ data: { memberId, gradeId, assignedBy: admin.id } })
  }
  await prisma.auditLog.create({
    data: { guildId, adminId: admin.id, action: gradeId ? 'Grade assigné' : 'Grade retiré', targetId: memberId, targetType: 'Member' },
  })
  revalidatePath(`/dashboard/${guildId}/members/${memberId}`)
}

async function setMemberPanelRole(guildId: string, memberId: string, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const admin = await getGuildMember(guildId, session.user.discordId)
  requirePermission(admin.panelRole, 'members.edit')

  const panelRole = formData.get('panelRole') as PanelRole
  if (!panelRole) return
  await prisma.member.update({ where: { id: memberId, guildId }, data: { panelRole } })
  await prisma.auditLog.create({
    data: { guildId, adminId: admin.id, action: `Rôle panel changé → ${panelRole}`, targetId: memberId, targetType: 'Member' },
  })
  revalidatePath(`/dashboard/${guildId}/members/${memberId}`)
}

async function toggleMemberActive(guildId: string, memberId: string, currentActive: boolean) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const admin = await getGuildMember(guildId, session.user.discordId)
  requirePermission(admin.panelRole, 'members.edit')

  await prisma.member.update({ where: { id: memberId, guildId }, data: { isActive: !currentActive } })
  await prisma.auditLog.create({
    data: { guildId, adminId: admin.id, action: currentActive ? 'Membre désactivé' : 'Membre réactivé', targetId: memberId, targetType: 'Member' },
  })
  revalidatePath(`/dashboard/${guildId}/members/${memberId}`)
}

async function saveMemberNote(guildId: string, memberId: string, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const admin = await getGuildMember(guildId, session.user.discordId)
  requirePermission(admin.panelRole, 'members.edit')

  const notes = (formData.get('notes') as string) ?? ''
  await prisma.member.update({ where: { id: memberId, guildId }, data: { notes: notes.trim() || null } })
  revalidatePath(`/dashboard/${guildId}/members/${memberId}`)
}

async function revokeWarning(guildId: string, warningId: string, memberId: string) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const admin = await getGuildMember(guildId, session.user.discordId)
  requirePermission(admin.panelRole, 'warnings.revoke')

  await prisma.warning.update({
    where: { id: warningId, guildId },
    data: { isActive: false, revokedBy: admin.id, revokedAt: new Date() },
  })
  await prisma.auditLog.create({
    data: { guildId, adminId: admin.id, action: 'Avertissement révoqué', targetId: memberId, targetType: 'Member' },
  })
  revalidatePath(`/dashboard/${guildId}/members/${memberId}`)
}

const PANEL_ROLES: PanelRole[] = ['ADMIN', 'DIRECTION', 'RESPONSABLE', 'MODERATEUR', 'MEMBRE']
const STATUS_LABEL: Record<string, string> = { PENDING: 'En attente', APPROVED: 'Approuvée', REJECTED: 'Refusée', PRESENT: 'Présent', ABSENT: 'Absent' }
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'text-[#eab308]', APPROVED: 'text-[#22c55e]', REJECTED: 'text-[#ef4444]',
  PRESENT: 'text-[#22c55e]', ABSENT: 'text-[#ef4444]',
}

export default async function MemberDetailPage({ params }: { params: { guildId: string; memberId: string } }) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId, memberId } = params

  const [member, grades] = await Promise.all([
    prisma.member.findFirst({
      where: { id: memberId, guildId },
      include: {
        grade: true,
        warnings: { orderBy: { createdAt: 'desc' }, take: 20 },
        absences: { orderBy: { createdAt: 'desc' }, take: 10 },
        contributions: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 24 },
        gradeHistory: { include: { grade: true }, orderBy: { assignedAt: 'desc' }, take: 10 },
        presenceLogs: { orderBy: { date: 'desc' }, take: 30 },
      },
    }),
    prisma.grade.findMany({ where: { guildId }, orderBy: { position: 'asc' } }),
  ])

  if (!member) redirect(`/dashboard/${guildId}/members`)

  const avatar = avatarUrl(member.discordUserId, member.discordAvatar)
  const activeWarnings = member.warnings.filter((w) => w.isActive)
  const presenceStats = {
    present: member.presenceLogs.filter((p) => p.status === 'PRESENT').length,
    absent: member.presenceLogs.filter((p) => p.status === 'ABSENT').length,
    total: member.presenceLogs.length,
  }
  const presenceRate = presenceStats.total > 0
    ? Math.round((presenceStats.present / presenceStats.total) * 100)
    : null

  const setGradeAction = setMemberGrade.bind(null, guildId, memberId)
  const setRoleAction = setMemberPanelRole.bind(null, guildId, memberId)
  const toggleActiveAction = toggleMemberActive.bind(null, guildId, memberId, member.isActive)
  const saveNoteAction = saveMemberNote.bind(null, guildId, memberId)

  return (
    <div className="space-y-6">
      {/* En-tête membre */}
      <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <img src={avatar} alt={member.discordUsername} className="w-16 h-16 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-[var(--text)]">{member.discordNickname ?? member.discordUsername}</h1>
              {member.grade && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md"
                  style={{ backgroundColor: `${member.grade.color}25`, color: member.grade.color }}>
                  {member.grade.name}
                </span>
              )}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${member.isActive ? 'text-[#22c55e] bg-[#22c55e15]' : 'text-[var(--text-3)] bg-[#38386515]'}`}>
                {member.isActive ? 'Actif' : 'Inactif'}
              </span>
            </div>
            {member.discordNickname && <p className="text-[var(--text-2)] text-xs mt-1">{member.discordUsername}</p>}
            <p className="text-[var(--text-3)] text-xs mt-1.5">
              Rôle : <span className="text-[var(--text-2)]">{member.panelRole}</span>
              {' · '}Rejoint le <span className="text-[var(--text-2)]">{formatDate(member.joinedAt)}</span>
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            <form action={toggleActiveAction}>
              <button type="submit"
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  member.isActive
                    ? 'text-[#ef4444] border-[#ef444430] hover:bg-[#ef444415]'
                    : 'text-[#22c55e] border-[#22c55e30] hover:bg-[#22c55e15]'
                }`}>
                {member.isActive ? 'Désactiver' : 'Réactiver'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Changer le grade */}
        <form action={setGradeAction} className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-4">
          <label className="block text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider mb-2">Grade</label>
          <div className="flex gap-2">
            <select name="gradeId" defaultValue={member.gradeId ?? ''}
              className="flex-1 bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]">
              <option value="">— Aucun grade —</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <button type="submit"
              className="px-3 py-2 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-80 transition-colors">
              Appliquer
            </button>
          </div>
        </form>

        {/* Changer le rôle panel */}
        <form action={setRoleAction} className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-4">
          <label className="block text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider mb-2">Rôle panel</label>
          <div className="flex gap-2">
            <select name="panelRole" defaultValue={member.panelRole}
              className="flex-1 bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]">
              {PANEL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button type="submit"
              className="px-3 py-2 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-80 transition-colors">
              Appliquer
            </button>
          </div>
        </form>
      </div>

      {/* Notes */}
      <form action={saveNoteAction} className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider">Notes internes</label>
          <button type="submit" className="text-xs font-semibold px-3 py-1 bg-[var(--accent)] text-white rounded-lg hover:opacity-80 transition-colors">
            Sauvegarder
          </button>
        </div>
        <textarea
          name="notes"
          defaultValue={member.notes ?? ''}
          rows={3}
          placeholder="Ajouter une note visible uniquement par les admins…"
          className="w-full bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#383865] focus:outline-none focus:border-[var(--accent)] resize-none transition-colors"
        />
      </form>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-4 text-center">
          <p className="text-2xl font-bold text-[#22c55e]">{presenceStats.present}</p>
          <p className="text-xs text-[var(--text-2)] mt-1">Présences (30j)</p>
          {presenceRate !== null && (
            <p className="text-[11px] text-[var(--text-3)] mt-0.5">{presenceRate}% de taux</p>
          )}
        </div>
        <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-4 text-center">
          <p className="text-2xl font-bold text-[#ef4444]">{presenceStats.absent}</p>
          <p className="text-xs text-[var(--text-2)] mt-1">Absences (30j)</p>
        </div>
        <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-4 text-center">
          <p className={`text-2xl font-bold ${activeWarnings.length > 0 ? 'text-[#eab308]' : 'text-[#22c55e]'}`}>
            {activeWarnings.length}
          </p>
          <p className="text-xs text-[var(--text-2)] mt-1">Avertissements actifs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Avertissements */}
        <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.07]">
            <h2 className="font-semibold text-[var(--text)] text-sm">Avertissements</h2>
          </div>
          {member.warnings.length === 0 ? (
            <p className="px-4 py-6 text-[var(--text-3)] text-sm">Aucun avertissement.</p>
          ) : (
            <ul className="divide-y divide-[#1a1a40]">
              {member.warnings.map((w) => {
                const revokeAction = w.isActive ? revokeWarning.bind(null, guildId, w.id, memberId) : undefined
                return (
                  <li key={w.id} className={`px-4 py-3 flex items-start gap-3 ${!w.isActive ? 'opacity-50' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--text)] truncate">{w.reason}</p>
                      <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                        {w.isAuto ? 'Auto' : 'Manuel'} · {formatDate(w.createdAt)}
                        {!w.isActive && ' · Révoqué'}
                      </p>
                    </div>
                    {w.isActive && revokeAction && (
                      <form action={revokeAction}>
                        <button type="submit" className="text-[11px] text-[#ef4444] hover:text-[#ff6b81] px-2 py-0.5 border border-[#ef444430] rounded transition-colors flex-shrink-0">
                          Révoquer
                        </button>
                      </form>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Absences récentes */}
        <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.07]">
            <h2 className="font-semibold text-[var(--text)] text-sm">Absences récentes</h2>
          </div>
          {member.absences.length === 0 ? (
            <p className="px-4 py-6 text-[var(--text-3)] text-sm">Aucune absence enregistrée.</p>
          ) : (
            <ul className="divide-y divide-[#1a1a40]">
              {member.absences.map((a) => (
                <li key={a.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--text)] truncate">{a.reason}</p>
                    <p className="text-[11px] text-[var(--text-3)] mt-0.5">{formatDate(a.startDate)} → {formatDate(a.endDate)}</p>
                  </div>
                  <span className={`text-[10px] font-semibold flex-shrink-0 ${STATUS_COLOR[a.status] ?? 'text-[var(--text-2)]'}`}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Présences récentes */}
        <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.07]">
            <h2 className="font-semibold text-[var(--text)] text-sm">Présences récentes (30j)</h2>
          </div>
          {member.presenceLogs.length === 0 ? (
            <p className="px-4 py-6 text-[var(--text-3)] text-sm">Aucune présence enregistrée.</p>
          ) : (
            <div className="px-4 py-3 flex flex-wrap gap-1.5">
              {member.presenceLogs.map((p) => (
                <span key={p.id} title={formatDate(p.date)}
                  className={`w-7 h-7 rounded-lg text-[10px] font-bold flex items-center justify-center ${
                    p.status === 'PRESENT' ? 'bg-[#22c55e25] text-[#22c55e]' :
                    p.status === 'ABSENT' ? 'bg-[#ef444425] text-[#ef4444]' :
                    'bg-[#eab30815] text-[#eab308]'
                  }`}>
                  {new Date(p.date).getDate()}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Historique grades */}
        <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.07]">
            <h2 className="font-semibold text-[var(--text)] text-sm">Historique des grades</h2>
          </div>
          {member.gradeHistory.length === 0 ? (
            <p className="px-4 py-6 text-[var(--text-3)] text-sm">Aucun changement de grade.</p>
          ) : (
            <ul className="divide-y divide-[#1a1a40]">
              {member.gradeHistory.map((gh) => (
                <li key={gh.id} className="px-4 py-3 flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: gh.grade.color }} />
                  <span className="text-sm text-[var(--text)] flex-1">{gh.grade.name}</span>
                  <span className="text-xs text-[var(--text-3)]">{formatDate(gh.assignedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Cotisations */}
        {member.contributions.length > 0 && (
          <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] overflow-hidden lg:col-span-2">
            <div className="px-4 py-3 border-b border-white/[0.07]">
              <h2 className="font-semibold text-[var(--text)] text-sm">Cotisations</h2>
            </div>
            <div className="px-4 py-3 flex flex-wrap gap-2">
              {member.contributions.map((c) => (
                <span key={c.id} className="text-xs bg-[#22c55e15] text-[#22c55e] px-2.5 py-1 rounded-md">
                  {String(c.month).padStart(2, '0')}/{c.year} — {c.amount} {c.currency}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
