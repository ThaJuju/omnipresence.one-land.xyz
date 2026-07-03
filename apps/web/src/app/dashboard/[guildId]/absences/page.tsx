'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { avatarUrl } from '@/lib/utils'
import { getGuildMember, requirePermission } from '@/lib/api'
import { botClient } from '@/lib/bot-client'
import AbsencesView from '@/components/dashboard/AbsencesView'

async function approveAbsence(guildId: string, absenceId: string) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'absences.approve')
  const result = await prisma.absence.updateMany({
    where: { id: absenceId, guildId, status: 'PENDING' },
    data: { status: 'APPROVED', reviewedBy: member.id, reviewedAt: new Date() },
  })
  if (result.count === 0) return
  await prisma.auditLog.create({
    data: { guildId, adminId: member.id, action: 'Absence approuvée', targetId: absenceId, targetType: 'Absence' },
  })
  try {
    await botClient.updateAbsenceStatus({
      absenceId,
      status: 'APPROVED',
      reviewerName: member.discordNickname ?? member.discordUsername,
    })
  } catch { /* bot hors ligne */ }
  revalidatePath(`/dashboard/${guildId}/absences`)
}

async function rejectAbsence(guildId: string, absenceId: string) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await getGuildMember(guildId, session.user.discordId)
  requirePermission(member.panelRole, 'absences.approve')
  const result = await prisma.absence.updateMany({
    where: { id: absenceId, guildId, status: 'PENDING' },
    data: { status: 'REJECTED', reviewedBy: member.id, reviewedAt: new Date() },
  })
  if (result.count === 0) return
  await prisma.auditLog.create({
    data: { guildId, adminId: member.id, action: 'Absence refusée', targetId: absenceId, targetType: 'Absence' },
  })
  try {
    await botClient.updateAbsenceStatus({
      absenceId,
      status: 'REJECTED',
      reviewerName: member.discordNickname ?? member.discordUsername,
    })
  } catch { /* bot hors ligne */ }
  revalidatePath(`/dashboard/${guildId}/absences`)
}

async function declareAbsence(guildId: string, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await prisma.member.findUnique({
    where: { guildId_discordUserId: { guildId, discordUserId: session.user.discordId } },
    select: { id: true, discordUserId: true, discordAvatar: true, discordNickname: true, discordUsername: true },
  })
  if (!member) return
  const reason = (formData.get('reason') as string)?.trim()
  const startDate = formData.get('startDate') as string
  const endDate = formData.get('endDate') as string
  if (!reason || !startDate || !endDate || endDate < startDate) return
  const absence = await prisma.absence.create({
    data: {
      guildId,
      memberId: member.id,
      reason,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: 'PENDING',
      source: 'panel',
    },
  })
  try {
    await botClient.notifyAbsence({
      guildId,
      absenceId: absence.id,
      memberName: member.discordNickname ?? member.discordUsername,
      memberAvatarUrl: avatarUrl(member.discordUserId, member.discordAvatar),
      reason,
      startDate,
      endDate,
      source: 'panel',
    })
  } catch { /* bot hors ligne ou canal non configuré */ }
  revalidatePath(`/dashboard/${guildId}/absences`)
}

function pad2(n: number) { return String(n).padStart(2, '0') }

export default async function AbsencesPage({
  params,
  searchParams,
}: {
  params: { guildId: string }
  searchParams: { view?: string; month?: string; status?: string }
}) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params
  const view = (searchParams.view === 'list' ? 'list' : 'calendar') as 'calendar' | 'list'
  const statusFilter = searchParams.status ?? 'all'

  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1

  if (searchParams.month) {
    const parts = searchParams.month.split('-')
    if (parts.length === 2) {
      const y = parseInt(parts[0]!)
      const m = parseInt(parts[1]!)
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) { year = y; month = m }
    }
  }

  const myMember = await prisma.member.findUnique({
    where: { guildId_discordUserId: { guildId, discordUserId: session.user.discordId } },
    select: { id: true, panelRole: true },
  })
  if (!myMember) redirect('/dashboard')

  const isAdmin = ['ADMIN', 'DIRECTION', 'RESPONSABLE', 'MODERATEUR'].includes(myMember.panelRole)

  let absencesRaw

  if (view === 'calendar') {
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0)
    absencesRaw = await prisma.absence.findMany({
      where: {
        guildId,
        NOT: { status: 'REJECTED' },
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
        member: { gradeId: { not: null } },
      },
      include: { member: { include: { grade: { select: { name: true } } } } },
      orderBy: { startDate: 'asc' },
    })
  } else {
    const whereStatus =
      statusFilter !== 'all'
        ? { status: statusFilter as 'PENDING' | 'APPROVED' | 'REJECTED' }
        : {}
    absencesRaw = await prisma.absence.findMany({
      where: { guildId, ...whereStatus, member: { gradeId: { not: null } } },
      include: { member: { include: { grade: { select: { name: true } } } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    })
  }

  const absences = absencesRaw.map((a) => ({
    id: a.id,
    reason: a.reason,
    startDate: a.startDate.toISOString().split('T')[0]!,
    endDate: a.endDate.toISOString().split('T')[0]!,
    status: a.status as 'PENDING' | 'APPROVED' | 'REJECTED',
    memberName: a.member.discordNickname ?? a.member.discordUsername,
    memberAvatarUrl: avatarUrl(a.member.discordUserId, a.member.discordAvatar),
    memberGradeName: a.member.grade?.name ?? null,
  }))

  return (
    <AbsencesView
      guildId={guildId}
      view={view}
      year={year}
      month={month}
      absences={absences}
      statusFilter={statusFilter}
      isAdmin={isAdmin}
      approveAction={approveAbsence.bind(null, guildId)}
      rejectAction={rejectAbsence.bind(null, guildId)}
      declareAbsenceAction={declareAbsence.bind(null, guildId)}
    />
  )
}
