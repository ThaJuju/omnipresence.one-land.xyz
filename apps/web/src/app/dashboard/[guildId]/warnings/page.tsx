'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { formatDate, avatarUrl } from '@/lib/utils'
import { getGuildMember, requirePermission } from '@/lib/api'
import { getLocale } from '@/i18n/server'
import { getT } from '@/i18n/translations'

async function createWarning(guildId: string, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const admin = await getGuildMember(guildId, session.user.discordId)
  requirePermission(admin.panelRole, 'warnings.issue')

  const memberId = formData.get('memberId') as string
  const reason = (formData.get('reason') as string).trim()
  if (!memberId || !reason) return

  const warning = await prisma.warning.create({
    data: { guildId, memberId, reason, isAuto: false, issuedBy: admin.id },
    include: { member: true },
  })

  const guild = await prisma.guildInstance.findUnique({
    where: { id: guildId },
    include: { warningThresholds: { orderBy: { threshold: 'asc' } }, config: true },
  })
  if (guild) {
    const activeCount = await prisma.warning.count({ where: { memberId, guildId, isActive: true } })
    try {
      const { botClient } = await import('@/lib/bot-client')
      if (guild.warningThresholds.length > 0) {
        for (const t of guild.warningThresholds) {
          if (activeCount >= t.threshold) await botClient.assignRole(guild.discordGuildId, warning.member.discordUserId, t.discordRoleId)
        }
      } else if (guild.config?.warningRoleId) {
        await botClient.assignRole(guild.discordGuildId, warning.member.discordUserId, guild.config.warningRoleId)
      }
    } catch { /* bot offline */ }
  }

  await prisma.auditLog.create({
    data: { guildId, adminId: admin.id, action: `Avertissement créé : ${reason}`, targetId: warning.member.id, targetType: 'Member' },
  })
  revalidatePath(`/dashboard/${guildId}/warnings`)
}

async function revokeWarning(guildId: string, warningId: string) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const admin = await getGuildMember(guildId, session.user.discordId)
  requirePermission(admin.panelRole, 'warnings.revoke')

  const warning = await prisma.warning.update({
    where: { id: warningId, guildId },
    data: { isActive: false, revokedBy: admin.id, revokedAt: new Date() },
    include: { member: true },
  })
  await prisma.auditLog.create({
    data: { guildId, adminId: admin.id, action: 'Avertissement révoqué', targetId: warning.member.id, targetType: 'Member' },
  })
  revalidatePath(`/dashboard/${guildId}/warnings`)
}

export default async function WarningsPage({ params }: { params: { guildId: string } }) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params
  const locale = getLocale()
  const tr = getT(locale)

  const [warnings, members] = await Promise.all([
    prisma.warning.findMany({
      where: { guildId },
      include: { member: true },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    }),
    prisma.member.findMany({
      where: { guildId, isActive: true, gradeId: { not: null } },
      orderBy: { discordUsername: 'asc' },
      select: { id: true, discordUserId: true, discordAvatar: true, discordUsername: true, discordNickname: true },
    }),
  ])

  const active = warnings.filter((w) => w.isActive)
  const revoked = warnings.filter((w) => !w.isActive)
  const createAction = createWarning.bind(null, guildId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{tr.warnings.title}</h1>
        <p className="text-[var(--text-2)] text-sm mt-1">
          {active.length} {tr.warnings.active.toLowerCase()} · {revoked.length} {tr.warnings.revoked.toLowerCase()}
        </p>
      </div>

      <form action={createAction} className="card p-5">
        <h2 className="font-semibold text-[var(--text)] mb-4">{tr.warnings.createManual}</h2>
        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          <select name="memberId" required
            className="w-full sm:w-56 flex-shrink-0 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[#eab308]">
            <option value="">{tr.warnings.chooseMember}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.discordNickname ?? m.discordUsername}</option>
            ))}
          </select>
          <input name="reason" required placeholder={tr.warnings.reasonPlaceholder}
            className="flex-1 min-w-0 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[#eab308]" />
          <button type="submit"
            className="px-4 py-2 bg-[#eab308] text-black text-sm font-semibold rounded-lg hover:bg-[#f0c800] transition-colors whitespace-nowrap flex-shrink-0">
            {tr.warnings.warnBtn}
          </button>
        </div>
      </form>

      {active.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[var(--warning)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#eab308]" /> {tr.warnings.active} ({active.length})
          </h2>
          <div className="card divide-y divide-[var(--border)] overflow-hidden">
            {active.map((w) => {
              const revokeAction = revokeWarning.bind(null, guildId, w.id)
              const avatar = avatarUrl(w.member.discordUserId, w.member.discordAvatar)
              return (
                <div key={w.id} className="flex items-center gap-4 px-4 py-3">
                  <img src={avatar} alt={w.member.discordUsername} className="w-8 h-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[var(--text)]">{w.member.discordNickname ?? w.member.discordUsername}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${w.isAuto ? 'text-[var(--warning)] bg-[#eab30815]' : 'text-[var(--text-2)] bg-[#88888815]'}`}>
                        {w.isAuto ? tr.warnings.auto : tr.warnings.manual}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-2)] mt-0.5 truncate">{w.reason}</p>
                    <p className="text-[11px] text-[var(--text-3)] mt-0.5">{formatDate(w.createdAt)}</p>
                  </div>
                  <form action={revokeAction} className="flex-shrink-0">
                    <button type="submit" className="text-xs text-[var(--danger)] hover:text-[#ff6b81] px-2 py-1 border border-[#ef444430] hover:border-[#ef444460] rounded-lg transition-colors">
                      {tr.warnings.revokeBtn}
                    </button>
                  </form>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {revoked.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--text-3)]" /> {tr.warnings.revoked} ({revoked.length})
          </h2>
          <div className="card divide-y divide-[var(--border)] overflow-hidden opacity-60">
            {revoked.map((w) => {
              const avatar = avatarUrl(w.member.discordUserId, w.member.discordAvatar)
              return (
                <div key={w.id} className="flex items-center gap-4 px-4 py-3">
                  <img src={avatar} alt={w.member.discordUsername} className="w-7 h-7 rounded-full flex-shrink-0" />
                  <span className="flex-1 text-sm text-[var(--text-2)] truncate">{w.member.discordNickname ?? w.member.discordUsername} — {w.reason}</span>
                  <span className="text-[11px] text-[var(--text-3)] flex-shrink-0">{formatDate(w.createdAt)}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {warnings.length === 0 && (
        <div className="text-center py-20 text-[var(--text-2)]">
          <div className="text-5xl mb-4">✅</div>
          <p className="font-medium text-[var(--text)] mb-1">{tr.warnings.noWarnings}</p>
          <p className="text-sm">{tr.warnings.noWarningsDesc}</p>
        </div>
      )}
    </div>
  )
}
