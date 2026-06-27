'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { avatarUrl } from '@/lib/utils'
import { getGuildMember, requirePermission } from '@/lib/api'
import { getLocale } from '@/i18n/server'
import { getT } from '@/i18n/translations'

// ─── Helpers ───────────────────────────────

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  return d.getUTCFullYear()
}

function weekLabel(week: number, year: number, dateLocale = 'fr-FR'): string {
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = (jan4.getDay() + 6) % 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - dayOfWeek + (week - 1) * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })
  return `S${week} · ${fmt(monday)} – ${fmt(sunday)}`
}

// ─── Server actions ─────────────────────────

async function addContribution(guildId: string, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const admin = await getGuildMember(guildId, session.user.discordId)
  requirePermission(admin.panelRole, 'contributions.add')

  const config = await prisma.guildConfig.findUnique({ where: { guildId } })
  const period = config?.contributionPeriod ?? 'monthly'
  const currency = config?.contributionCurrency ?? 'EUR'

  const memberId = formData.get('memberId') as string
  const amount = parseFloat(formData.get('amount') as string)
  if (!memberId || isNaN(amount)) return

  let month: number, year: number, week: number | null, day: number | null

  if (period === 'daily') {
    const dateStr = formData.get('date') as string
    if (!dateStr) return
    const d = new Date(dateStr)
    day = d.getDate()
    month = d.getMonth() + 1
    year = d.getFullYear()
    week = null
  } else if (period === 'weekly') {
    const weekStr = formData.get('week') as string // "2026-W26"
    if (!weekStr) return
    const [yearPart, weekPart] = weekStr.split('-W') as [string, string]
    year = parseInt(yearPart)
    week = parseInt(weekPart)
    month = 1 // placeholder, not used for weekly
    day = null
  } else {
    month = parseInt(formData.get('month') as string)
    year = parseInt(formData.get('year') as string)
    week = null
    day = null
    if (isNaN(month) || isNaN(year)) return
  }

  const existing = await prisma.contribution.findFirst({
    where: {
      guildId,
      memberId,
      periodType: period,
      ...(period === 'daily' ? { day, month, year } : {}),
      ...(period === 'weekly' ? { week, year } : {}),
      ...(period === 'monthly' ? { month, year } : {}),
    },
  })

  if (existing) {
    await prisma.contribution.update({ where: { id: existing.id }, data: { amount, currency } })
  } else {
    await prisma.contribution.create({
      data: { guildId, memberId, amount, currency, periodType: period, month, year, week, day },
    })
  }

  const periodLabel =
    period === 'daily' ? `${day!.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}` :
    period === 'weekly' ? `S${week}/${year}` :
    `${month.toString().padStart(2, '0')}/${year}`

  await prisma.auditLog.create({
    data: {
      guildId,
      adminId: admin.id,
      action: `Cotisation enregistrée ${periodLabel} — ${amount} ${currency}`,
      targetId: memberId,
      targetType: 'Member',
    },
  })
  revalidatePath(`/dashboard/${guildId}/contributions`)
}

async function deleteContribution(guildId: string, contributionId: string) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const admin = await getGuildMember(guildId, session.user.discordId)
  requirePermission(admin.panelRole, 'contributions.delete')
  await prisma.contribution.delete({ where: { id: contributionId, guildId } })
  await prisma.auditLog.create({
    data: { guildId, adminId: admin.id, action: 'Cotisation supprimée', targetType: 'Contribution' },
  })
  revalidatePath(`/dashboard/${guildId}/contributions`)
}

// ─── Page ───────────────────────────────────

export default async function ContributionsPage({ params }: { params: { guildId: string } }) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params
  const locale = getLocale()
  const tr = getT(locale)
  const dateLocale = locale === 'en' ? 'en-US' : 'fr-FR'

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentWeek = getISOWeek(now)
  const currentWeekYear = getISOWeekYear(now)
  const todayStr = now.toISOString().split('T')[0]!
  const todayDay = now.getDate()

  const [contributions, members, config] = await Promise.all([
    prisma.contribution.findMany({
      where: { guildId },
      include: { member: true },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.member.findMany({
      where: { guildId, isActive: true, gradeId: { not: null } },
      orderBy: { discordUsername: 'asc' },
    }),
    prisma.guildConfig.findUnique({ where: { guildId } }),
  ])

  const period = config?.contributionPeriod ?? 'monthly'
  const currency = config?.contributionCurrency ?? 'EUR'
  const defaultAmount = config?.contributionAmount ?? null
  const MONTHS = tr.time.months
  const PERIOD_LABEL: Record<string, string> = {
    daily: tr.contributions.periodDaily,
    weekly: tr.contributions.periodWeekly,
    monthly: tr.contributions.periodMonthly,
  }

  const addAction = addContribution.bind(null, guildId)

  // ─── "Période en cours" payés ───
  const currentPeriodPaid = new Set<string>()
  for (const c of contributions) {
    if (period === 'daily' && c.day === todayDay && c.month === currentMonth && c.year === currentYear) {
      currentPeriodPaid.add(c.memberId)
    } else if (period === 'weekly' && c.week === currentWeek && c.year === currentWeekYear) {
      currentPeriodPaid.add(c.memberId)
    } else if (period === 'monthly' && c.month === currentMonth && c.year === currentYear) {
      currentPeriodPaid.add(c.memberId)
    }
  }

  // ─── Total de l'année ───
  const totalYear = contributions
    .filter((c) => c.year === currentYear)
    .reduce((s, c) => s + c.amount, 0)

  // ─── Current period label ───
  const currentPeriodLabel =
    period === 'daily' ? `${tr.common.today} (${now.toLocaleDateString(dateLocale)})` :
    period === 'weekly' ? weekLabel(currentWeek, currentWeekYear, dateLocale) :
    `${MONTHS[currentMonth - 1]} ${currentYear}`

  // ─── Historique ───
  // For the history grid: build an ordered list of periods in the current year
  type PeriodSlot = { key: string; label: string; check: (c: typeof contributions[0]) => boolean }
  const historySlots: PeriodSlot[] = []

  if (period === 'monthly') {
    for (let m = currentMonth; m >= 1; m--) {
      historySlots.push({
        key: `${m}`,
        label: MONTHS[m - 1]!,
        check: (c) => c.month === m && c.year === currentYear && c.periodType === 'monthly',
      })
    }
  } else if (period === 'weekly') {
    for (let w = currentWeek; w >= 1; w--) {
      const wk = w
      historySlots.push({
        key: `W${w}`,
        label: `S${w}`,
        check: (c) => c.week === wk && c.year === currentWeekYear && c.periodType === 'weekly',
      })
    }
  } else {
    // daily: show current month days (most recent first)
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
    for (let d = todayDay; d >= 1; d--) {
      const dd = d
      historySlots.push({
        key: `${d}`,
        label: `${d}`,
        check: (c) => c.day === dd && c.month === currentMonth && c.year === currentYear && c.periodType === 'daily',
      })
    }
  }

  // Default week value for input
  const weekInputDefault = `${currentWeekYear}-W${currentWeek.toString().padStart(2, '0')}`

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">{tr.contributions.title}</h1>
          <p className="text-[var(--text-2)] text-sm mt-1">
            {PERIOD_LABEL[period]} · {currentYear}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-4 text-center">
          <p className="text-2xl font-bold text-[#22c55e]">{currentPeriodPaid.size}</p>
          <p className="text-xs text-[var(--text-2)] mt-1">{tr.contributions.paidThisPeriod}</p>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5">{tr.contributions.outOf} {members.length} {tr.presences.members}</p>
        </div>
        <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-4 text-center">
          <p className="text-2xl font-bold text-[#ef4444]">{members.length - currentPeriodPaid.size}</p>
          <p className="text-xs text-[var(--text-2)] mt-1">{tr.contributions.pending}</p>
        </div>
        <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-4 text-center">
          <p className="text-2xl font-bold text-[var(--text)]">{totalYear.toFixed(0)} {currency}</p>
          <p className="text-xs text-[var(--text-2)] mt-1">{tr.common.total} {currentYear}</p>
        </div>
      </div>

      {/* Formulaire */}
      <form action={addAction} className="bg-[var(--surface)] rounded-md border border-white/[0.07] p-5">
        <h2 className="font-semibold text-[var(--text)] mb-4">{tr.contributions.recordPayment}</h2>
        <div className="flex gap-3 flex-wrap sm:flex-nowrap items-end">
          {/* Membre */}
          <div className="flex-1 min-w-36">
            <label className="block text-xs text-[var(--text-2)] mb-1.5">{tr.common.member}</label>
            <select
              name="memberId"
              required
              className="w-full bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[#22c55e]"
            >
              <option value="">{tr.contributions.chooseMember}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.discordNickname ?? m.discordUsername}{currentPeriodPaid.has(m.id) ? ' ✓' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Montant */}
          <div className="w-24">
            <label className="block text-xs text-[var(--text-2)] mb-1.5">{tr.contributions.amountLabel}</label>
            <input
              type="number"
              name="amount"
              step="0.01"
              min="0"
              required
              defaultValue={defaultAmount ?? ''}
              placeholder="0.00"
              className="w-full bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[#22c55e]"
            />
          </div>

          {/* Période : Daily = date, Weekly = week input, Monthly = month+year */}
          {period === 'daily' && (
            <div className="w-36">
              <label className="block text-xs text-[var(--text-2)] mb-1.5">{tr.contributions.dateLabel}</label>
              <input
                type="date"
                name="date"
                defaultValue={todayStr}
                className="w-full bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[#22c55e]"
              />
            </div>
          )}

          {period === 'weekly' && (
            <div className="w-44">
              <label className="block text-xs text-[var(--text-2)] mb-1.5">{tr.contributions.weekLabel}</label>
              <input
                type="week"
                name="week"
                defaultValue={weekInputDefault}
                className="w-full bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[#22c55e]"
              />
            </div>
          )}

          {period === 'monthly' && (
            <>
              <div className="w-20">
                <label className="block text-xs text-[var(--text-2)] mb-1.5">{tr.contributions.monthLabel}</label>
                <select
                  name="month"
                  defaultValue={currentMonth}
                  className="w-full bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[#22c55e]"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="block text-xs text-[var(--text-2)] mb-1.5">{tr.contributions.yearLabel}</label>
                <input
                  type="number"
                  name="year"
                  defaultValue={currentYear}
                  min="2020"
                  max="2099"
                  className="w-full bg-[var(--bg)] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[#22c55e]"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="px-4 py-2 bg-[#22c55e] text-black text-sm font-semibold rounded-lg hover:bg-[#16a34a] transition-colors whitespace-nowrap"
          >
            {tr.contributions.recordBtn}
          </button>
        </div>
      </form>

      {/* Tableau période en cours */}
      <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
          <h2 className="font-semibold text-[var(--text)]">{currentPeriodLabel}</h2>
          <span className="text-xs text-[var(--text-3)]">{currentPeriodPaid.size}/{members.length}</span>
        </div>
        <ul className="divide-y divide-[#1a1a40]">
          {members.map((member) => {
            const contrib = contributions.find((c) => {
              if (c.memberId !== member.id) return false
              if (period === 'daily') return c.day === todayDay && c.month === currentMonth && c.year === currentYear
              if (period === 'weekly') return c.week === currentWeek && c.year === currentWeekYear
              return c.month === currentMonth && c.year === currentYear
            })
            const avatar = avatarUrl(member.discordUserId, member.discordAvatar)
            const deleteAction = contrib ? deleteContribution.bind(null, guildId, contrib.id) : null
            return (
              <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                <img src={avatar} alt={member.discordUsername} className="w-7 h-7 rounded-full flex-shrink-0" />
                <span className="flex-1 text-sm text-[var(--text)]">{member.discordNickname ?? member.discordUsername}</span>
                {contrib ? (
                  <>
                    <span className="text-sm font-medium text-[#22c55e]">{contrib.amount} {contrib.currency}</span>
                    {deleteAction && (
                      <form action={deleteAction}>
                        <button type="submit" className="text-xs text-[var(--text-3)] hover:text-[#ef4444] px-1.5 py-0.5 transition-colors">
                          ✕
                        </button>
                      </form>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-[#ef4444]">{tr.contributions.notPaid}</span>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {/* Historique */}
      {historySlots.length > 1 && (
        <div className="bg-[var(--surface)] rounded-md border border-white/[0.07] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.07]">
            <h2 className="font-semibold text-[var(--text)]">
              {tr.contributions.history} {currentYear}
              {period === 'daily' && ` — ${MONTHS[currentMonth - 1]}`}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  <th className="text-left px-4 py-2 text-[var(--text-3)] whitespace-nowrap">{tr.common.member}</th>
                  {historySlots.map((slot) => (
                    <th key={slot.key} className="px-2 py-2 text-center text-[var(--text-3)] min-w-[40px] whitespace-nowrap">
                      {slot.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b border-white/[0.07] last:border-0">
                    <td className="px-4 py-2 text-[var(--text)] font-medium whitespace-nowrap">
                      {member.discordNickname ?? member.discordUsername}
                    </td>
                    {historySlots.map((slot) => {
                      const paid = contributions.some((c) => c.memberId === member.id && slot.check(c))
                      return (
                        <td key={slot.key} className="px-2 py-2 text-center">
                          <span
                            className={`w-5 h-5 rounded inline-flex items-center justify-center font-bold text-[10px] ${
                              paid ? 'text-[#22c55e] bg-[#22c55e20]' : 'text-[var(--text-3)] bg-[#1a1a40]'
                            }`}
                          >
                            {paid ? '✓' : '·'}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {contributions.length === 0 && (
        <div className="text-center py-16 text-[var(--text-3)]">
          <div className="text-4xl mb-3">💰</div>
          <p className="text-[var(--text)] font-medium mb-1">{tr.contributions.noContributions}</p>
          <p className="text-sm">{tr.contributions.noContributionsDesc}</p>
        </div>
      )}
    </div>
  )
}
