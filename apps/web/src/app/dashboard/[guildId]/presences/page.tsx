'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { avatarUrl } from '@/lib/utils'
import { botClient } from '@/lib/bot-client'
import PresencesDayView from '@/components/dashboard/PresencesDayView'
import { getLocale } from '@/i18n/server'

async function markPresent(guildId: string, date: string) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const member = await prisma.member.findUnique({
    where: { guildId_discordUserId: { guildId, discordUserId: session.user.discordId } },
    select: { id: true },
  })
  if (!member) return
  const dateObj = new Date(date)
  await prisma.presenceLog.upsert({
    where: { memberId_date: { memberId: member.id, date: dateObj } },
    update: { status: 'PRESENT', delayMinutes: null, source: 'panel' },
    create: { guildId, memberId: member.id, date: dateObj, status: 'PRESENT', source: 'panel' },
  })
  revalidatePath(`/dashboard/${guildId}/presences`)
}

async function markLate(guildId: string, date: string, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const delayMinutes = parseInt(formData.get('delayMinutes') as string, 10)
  if (isNaN(delayMinutes) || delayMinutes <= 0) return
  const member = await prisma.member.findUnique({
    where: { guildId_discordUserId: { guildId, discordUserId: session.user.discordId } },
    select: { id: true },
  })
  if (!member) return
  const dateObj = new Date(date)
  await prisma.presenceLog.upsert({
    where: { memberId_date: { memberId: member.id, date: dateObj } },
    update: { status: 'LATE', delayMinutes, source: 'panel' },
    create: { guildId, memberId: member.id, date: dateObj, status: 'LATE', delayMinutes, source: 'panel' },
  })
  revalidatePath(`/dashboard/${guildId}/presences`)
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
  revalidatePath(`/dashboard/${guildId}/presences`)
}

export default async function PresencesPage({
  params,
  searchParams,
}: {
  params: { guildId: string }
  searchParams: { date?: string }
}) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params
  const todayStr = new Date().toISOString().split('T')[0]!
  const dateStr = searchParams.date ?? todayStr

  const myMember = await prisma.member.findUnique({
    where: { guildId_discordUserId: { guildId, discordUserId: session.user.discordId } },
    select: { id: true },
  })
  if (!myMember) redirect('/dashboard')

  const dateObj = new Date(dateStr)

  const members = await prisma.member.findMany({
    where: { guildId, isActive: true, gradeId: { not: null } },
    select: {
      id: true,
      discordUserId: true,
      discordUsername: true,
      discordNickname: true,
      discordAvatar: true,
      grade: { select: { name: true, color: true } },
      presenceLogs: {
        where: { date: dateObj },
        select: { status: true, delayMinutes: true },
        take: 1,
      },
    },
    orderBy: { discordUsername: 'asc' },
  })

  const stats = { present: 0, absent: 0, pending: 0, late: 0 }
  const membersData = members.map((m) => {
    const log = m.presenceLogs[0]
    const status = (log?.status ?? 'PENDING') as 'PRESENT' | 'ABSENT' | 'PENDING' | 'LATE'
    if (status === 'PRESENT') stats.present++
    else if (status === 'ABSENT') stats.absent++
    else if (status === 'LATE') stats.late++
    else stats.pending++
    return {
      id: m.id,
      name: m.discordNickname ?? m.discordUsername,
      avatarUrl: avatarUrl(m.discordUserId, m.discordAvatar),
      gradeName: m.grade?.name ?? null,
      gradeColor: m.grade?.color ?? null,
      status,
      delayMinutes: log?.delayMinutes ?? null,
      isMe: m.id === myMember.id,
    }
  })

  const myPresence = membersData.find((m) => m.isMe)?.status ?? null

  return (
    <PresencesDayView
      locale={getLocale()}
      guildId={guildId}
      date={dateStr}
      today={todayStr}
      members={membersData}
      stats={stats}
      myPresence={myPresence}
      markPresentAction={markPresent.bind(null, guildId, dateStr)}
      markLateAction={markLate.bind(null, guildId, dateStr)}
      declareAbsenceAction={declareAbsence.bind(null, guildId)}
    />
  )
}
