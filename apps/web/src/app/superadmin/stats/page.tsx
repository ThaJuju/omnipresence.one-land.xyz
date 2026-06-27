import { prisma } from '@repo/db'

export default async function SuperadminStatsPage() {
  const [
    totalGuilds,
    activeGuilds,
    totalMembers,
    totalPresences,
    totalWarnings,
    totalAbsences,
    totalContributions,
  ] = await Promise.all([
    prisma.guildInstance.count(),
    prisma.guildInstance.count({ where: { isActive: true } }),
    prisma.member.count(),
    prisma.presenceLog.count(),
    prisma.warning.count(),
    prisma.absence.count(),
    prisma.contribution.aggregate({ _sum: { amount: true } }),
  ])

  const stats = [
    { label: 'Instances totales', value: totalGuilds, icon: '🌐' },
    { label: 'Instances actives', value: activeGuilds, icon: '✅', color: 'text-[#22c55e]' },
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
