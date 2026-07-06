import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'
import { getLocale } from '@/i18n/server'
import { getT } from '@/i18n/translations'

export default async function VdaPage({ params }: { params: { guildId: string } }) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params

  const cards = await prisma.vdaCard.findMany({
    where: { guildId, isArchived: false },
    orderBy: { updatedAt: 'desc' },
  })

  const archived = await prisma.vdaCard.count({ where: { guildId, isArchived: true } })
  const v = getT(getLocale()).vda

  const byCategory = cards.reduce(
    (acc, card) => {
      const cat = card.category ?? v.uncategorized
      if (!acc[cat]) acc[cat] = []
      acc[cat]!.push(card)
      return acc
    },
    {} as Record<string, typeof cards>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{v.title}</h1>
          <p className="text-[var(--text-2)] text-sm mt-1">
            {v.counts(cards.length, archived)}
          </p>
        </div>
      </div>

      {Object.entries(byCategory).map(([category, catCards]) => (
        <section key={category}>
          <h2 className="text-sm font-semibold text-[var(--text-2)] uppercase tracking-wider mb-3">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {catCards.map((card) => (
              <div key={card.id} className="card p-4">
                <h3 className="font-semibold text-[var(--text)] mb-2">{card.title}</h3>
                <p className="text-xs text-[var(--text-3)]">{v.modifiedOn} {formatDateTime(card.updatedAt)}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      {cards.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">🗂️</div>
          <p className="text-[var(--text-2)]">{v.noCards}</p>
        </div>
      )}
    </div>
  )
}
