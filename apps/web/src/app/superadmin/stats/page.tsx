import { prisma } from '@repo/db'
import { auth } from '@/lib/auth'
import { getSuperAdminAccess } from '@/lib/superadmin-access'
import { redirect } from 'next/navigation'

export default async function SuperadminStatsPage() {
  const session = await auth()
  const access = await getSuperAdminAccess(session?.user?.discordId)
  if (!access) redirect('/dashboard')

  const scopeWhere = access.isDev ? {} : { id: { in: access.guildIds } }
  const guildWhere = { ...scopeWhere, isActive: true }

  const [
    totalGuilds,
    totalMembers,
    totalPresences,
    totalWarnings,
    totalAbsences,
    totalContributions,
  ] = await Promise.all([
    prisma.guildInstance.count({ where: guildWhere }),
    prisma.member.count({ where: { guild: guildWhere } }),
    prisma.presenceLog.count({ where: { guild: guildWhere } }),
    prisma.warning.count({ where: { guild: guildWhere } }),
    prisma.absence.count({ where: { guild: guildWhere } }),
    prisma.contribution.aggregate({ where: { guild: guildWhere }, _sum: { amount: true } }),
  ])

  const stats = [
    { label: 'Instances avec le bot', value: totalGuilds, icon: '🌐' },
    { label: 'Membres', value: totalMembers, icon: '👥' },
    { label: 'Logs présence', value: totalPresences, icon: '📅' },
    { label: 'Avertissements', value: totalWarnings, icon: '⚠️', color: 'text-[#eab308]' },
    { label: 'Absences', value: totalAbsences, icon: '🛌' },
    { label: 'Total cotisations', value: `${(totalContributions._sum.amount ?? 0).toFixed(2)} €`, icon: '💰', color: 'text-[#22c55e]' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Statistiques globales</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-5">
            <div className="flex items-center gap-2 mb-3">
              <span>{s.icon}</span>
              <span className="text-xs text-[var(--text-2)]">{s.label}</span>
            </div>
            <p className={`text-3xl font-bold ${s.color ?? 'text-[var(--text)]'}`}>
              {typeof s.value === 'number' ? s.value.toLocaleString('fr-FR') : s.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
