'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { formatDate } from '@/lib/utils'
import { getGuildMember, requirePermission } from '@/lib/api'
import { getLocale } from '@/i18n/server'
import { getT } from '@/i18n/translations'

async function addEntry(guildId: string, formData: FormData) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const admin = await getGuildMember(guildId, session.user.discordId)
  requirePermission(admin.panelRole, 'accounting.edit')

  const type = formData.get('type') as 'INCOME' | 'EXPENSE'
  const label = (formData.get('label') as string).trim()
  const amount = parseFloat(formData.get('amount') as string)
  const category = (formData.get('category') as string).trim() || 'Général'
  const date = formData.get('date') as string
  const note = (formData.get('note') as string).trim() || null

  if (!label || isNaN(amount) || !date) return

  await prisma.accountingEntry.create({
    data: { guildId, type, label, amount, category, date: new Date(date), note, currency: 'EUR' },
  })
  await prisma.auditLog.create({
    data: { guildId, adminId: admin.id, action: `Écriture comptable : ${type === 'INCOME' ? '+' : '-'}${amount}€ — ${label}`, targetType: 'AccountingEntry' },
  })
  revalidatePath(`/dashboard/${guildId}/accounting`)
}

async function deleteEntry(guildId: string, entryId: string) {
  'use server'
  const session = await auth()
  if (!session?.user?.discordId) return
  const admin = await getGuildMember(guildId, session.user.discordId)
  requirePermission(admin.panelRole, 'accounting.edit')

  await prisma.accountingEntry.delete({ where: { id: entryId, guildId } })
  await prisma.auditLog.create({
    data: { guildId, adminId: admin.id, action: 'Écriture comptable supprimée', targetType: 'AccountingEntry' },
  })
  revalidatePath(`/dashboard/${guildId}/accounting`)
}

export default async function AccountingPage({ params }: { params: { guildId: string } }) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params
  const locale = getLocale()
  const tr = getT(locale)

  const currentYear = new Date().getFullYear()
  const today = new Date().toISOString().split('T')[0]!

  const entries = await prisma.accountingEntry.findMany({
    where: { guildId },
    orderBy: { date: 'desc' },
    take: 200,
  })

  const yearEntries = entries.filter((e) => new Date(e.date).getFullYear() === currentYear)
  const totalIncome = yearEntries.filter((e) => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0)
  const totalExpense = yearEntries.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0)
  const balance = totalIncome - totalExpense

  const addAction = addEntry.bind(null, guildId)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{tr.accounting.title}</h1>
          <p className="text-[var(--text-2)] text-sm mt-1">{tr.common.year} {currentYear}</p>
        </div>
        <a href={`/api/export/${guildId}/accounting?year=${currentYear}`}
          className="px-3 py-1.5 bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--border-mid)] text-xs rounded-lg transition-colors flex items-center gap-1.5">
          ⬇ {tr.common.exportCsv}
        </a>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--surface)] rounded-md border border-[#22c55e30] p-4 text-center">
          <p className="text-2xl font-bold text-[var(--success)]">+{totalIncome.toFixed(2)} €</p>
          <p className="text-xs text-[var(--text-2)] mt-1">{tr.accounting.income} {currentYear}</p>
        </div>
        <div className="bg-[var(--surface)] rounded-md border border-[#ef444430] p-4 text-center">
          <p className="text-2xl font-bold text-[var(--danger)]">-{totalExpense.toFixed(2)} €</p>
          <p className="text-xs text-[var(--text-2)] mt-1">{tr.accounting.expense} {currentYear}</p>
        </div>
        <div className={`bg-[var(--surface)] rounded-md border p-4 text-center ${balance >= 0 ? 'border-[#22c55e30]' : 'border-[#ef444430]'}`}>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
            {balance >= 0 ? '+' : ''}{balance.toFixed(2)} €
          </p>
          <p className="text-xs text-[var(--text-2)] mt-1">{tr.accounting.balance}</p>
        </div>
      </div>

      <form action={addAction} className="card p-5 space-y-4">
        <h2 className="font-semibold text-[var(--text)]">{tr.accounting.newEntry}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs text-[var(--text-2)] mb-1.5">{tr.accounting.typeLabel}</label>
            <select name="type" required
              className="w-full input px-3 py-2 text-sm">
              <option value="INCOME">{tr.accounting.incomeOption}</option>
              <option value="EXPENSE">{tr.accounting.expenseOption}</option>
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs text-[var(--text-2)] mb-1.5">{tr.accounting.amountLabel}</label>
            <input type="number" name="amount" step="0.01" min="0" required placeholder="0.00"
              className="w-full input px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[var(--text-2)] mb-1.5">{tr.accounting.entryLabel}</label>
            <input name="label" required placeholder={tr.accounting.entryPlaceholder}
              className="w-full input px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-2)] mb-1.5">{tr.accounting.categoryLabel}</label>
            <select name="category"
              className="w-full input px-3 py-2 text-sm">
              {tr.accounting.categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-2)] mb-1.5">{tr.accounting.dateLabel}</label>
            <input type="date" name="date" required defaultValue={today}
              className="w-full input px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[var(--text-2)] mb-1.5">{tr.accounting.noteLabel}</label>
            <input name="note" placeholder={tr.accounting.notePlaceholder}
              className="w-full input px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit"
            className="px-4 py-2 btn-primary text-sm">
            {tr.accounting.addBtn}
          </button>
        </div>
      </form>

      <div className="card overflow-hidden">
        {entries.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-2)]">
            <div className="text-4xl mb-3">📒</div>
            <p className="font-medium text-[var(--text)] mb-1">{tr.accounting.noEntries}</p>
            <p className="text-sm">{tr.accounting.noEntriesDesc}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase">{tr.accounting.colDate}</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase">{tr.accounting.colLabel}</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-3)] uppercase hidden md:table-cell">{tr.accounting.colCategory}</th>
                <th className="text-right px-4 py-3 text-xs text-[var(--text-3)] uppercase">{tr.accounting.colAmount}</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const deleteAction = deleteEntry.bind(null, guildId, entry.id)
                return (
                  <tr key={entry.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors group">
                    <td className="px-4 py-3 text-xs text-[var(--text-3)] whitespace-nowrap">{formatDate(entry.date)}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-[var(--text)]">{entry.label}</p>
                      {entry.note && <p className="text-xs text-[var(--text-3)] mt-0.5">{entry.note}</p>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-[var(--text-2)] bg-[var(--surface-2)] px-2 py-0.5 rounded">{entry.category}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-semibold ${entry.type === 'INCOME' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                        {entry.type === 'INCOME' ? '+' : '-'}{entry.amount.toFixed(2)} {entry.currency}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <form action={deleteAction}>
                        <button type="submit" className="text-[var(--text-3)] hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 transition-all text-xs px-1">✕</button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
