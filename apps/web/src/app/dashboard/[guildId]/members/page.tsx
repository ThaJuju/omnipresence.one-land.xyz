import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import MemberList from './MemberList'
import { getLocale } from '@/i18n/server'
import { getT } from '@/i18n/translations'

export default async function MembersPage({ params }: { params: { guildId: string } }) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params
  const locale = getLocale()
  const tr = getT(locale)

  const members = await prisma.member.findMany({
    where: { guildId, gradeId: { not: null } },
    include: { grade: true },
    orderBy: [{ isActive: 'desc' }, { discordUsername: 'asc' }],
  })

  const activeCount = members.filter((m) => m.isActive).length

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">{tr.members.title}</h1>
          <p className="text-[var(--text-2)] text-sm mt-1">{activeCount} {tr.common.active.toLowerCase()} · {members.length} {tr.members.total}</p>
        </div>
        <a
          href={`/api/export/${guildId}/members`}
          className="px-3 py-1.5 bg-[var(--surface-2)] border border-white/[0.07] text-[var(--text-2)] hover:text-[var(--text)] hover:border-white/[0.12] text-xs rounded-lg transition-colors flex items-center gap-1.5"
        >
          ⬇ {tr.common.exportCsv}
        </a>
      </div>
      <MemberList members={members} guildId={guildId} locale={locale} />
    </div>
  )
}
