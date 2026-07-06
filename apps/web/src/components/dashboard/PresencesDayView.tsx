'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, UserX } from 'lucide-react'
import AbsenceDeclareModal from '@/components/presences/AbsenceDeclareModal'
import LateDeclareModal from '@/components/presences/LateDeclareModal'
import { getT, type Locale } from '@/i18n/translations'

type MemberPresence = {
  id: string
  name: string
  avatarUrl: string
  gradeName: string | null
  gradeColor: string | null
  status: 'PRESENT' | 'ABSENT' | 'PENDING' | 'LATE'
  delayMinutes: number | null
  isMe: boolean
}

export default function PresencesDayView({
  guildId,
  date,
  today,
  members,
  stats,
  myPresence,
  markPresentAction,
  markLateAction,
  declareAbsenceAction,
  locale = 'fr',
}: {
  guildId: string
  date: string
  today: string
  members: MemberPresence[]
  stats: { present: number; absent: number; pending: number; late: number }
  myPresence: 'PRESENT' | 'ABSENT' | 'PENDING' | 'LATE' | null
  markPresentAction: () => Promise<void>
  markLateAction: (fd: FormData) => Promise<void>
  declareAbsenceAction: (fd: FormData) => Promise<void>
  locale?: Locale
}) {
  const t = getT(locale)
  const pd = t.presences
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showAbsenceModal, setShowAbsenceModal] = useState(false)
  const [showLateModal, setShowLateModal] = useState(false)

  const isToday = date === today

  const changeDate = (delta: number) => {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    const next = d.toISOString().split('T')[0]!
    router.push(`/dashboard/${guildId}/presences?date=${next}`)
  }

  const handleMarkPresent = () => {
    startTransition(async () => {
      await markPresentAction()
      router.refresh()
    })
  }

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString(pd.dateLocale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{pd.title}</h1>
          <p className="text-[var(--text-2)] text-sm mt-1">{pd.daySubtitle}</p>
        </div>
        <a
          href={`/api/export/${guildId}/presences`}
          className="px-3 py-1.5 bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--border-mid)] text-xs rounded-lg transition-colors flex items-center gap-1.5"
        >
          {pd.exportCsv}
        </a>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => changeDate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--border-mid)] transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => router.push(`/dashboard/${guildId}/presences?date=${e.target.value}`)}
          className="h-8 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] [color-scheme:dark]"
        />
        <button
          onClick={() => changeDate(1)}
          disabled={isToday}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--border-mid)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={14} />
        </button>
        {!isToday && (
          <button
            onClick={() => router.push(`/dashboard/${guildId}/presences`)}
            className="h-8 px-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--border-mid)] transition-colors"
          >
            {t.common.today}
          </button>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { label: pd.statPresent, value: stats.present, Icon: CheckCircle2, color: 'text-[var(--success)]', bg: 'bg-[#22c55e]/10' },
          { label: pd.statLate,    value: stats.late,    Icon: Clock,        color: 'text-[var(--warning)]', bg: 'bg-[#eab308]/10' },
          { label: pd.statAbsent,  value: stats.absent,  Icon: XCircle,      color: 'text-[var(--danger)]', bg: 'bg-[#ef4444]/10' },
          { label: pd.statPending, value: stats.pending, Icon: Clock,        color: 'text-[var(--text-2)]', bg: 'bg-[var(--hover)]' },
        ]).map(({ label, value, Icon, color, bg }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-md ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--text)]">{value}</p>
              <p className="text-xs text-[var(--text-2)]">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* My presence (today only) */}
      {isToday && (
        <div className="card p-4">
          <p className="text-sm font-semibold text-[var(--text)] mb-3">{pd.myPresence}</p>
          {myPresence === 'PRESENT' ? (
            <div className="flex items-center gap-2 text-[var(--success)] text-sm">
              <CheckCircle2 size={15} />
              <span className="font-medium">{pd.markedPresent}</span>
            </div>
          ) : myPresence === 'LATE' ? (
            <div className="flex items-center gap-2 text-[var(--warning)] text-sm">
              <Clock size={15} />
              <span className="font-medium">{pd.lateDeclared}</span>
            </div>
          ) : myPresence === 'ABSENT' ? (
            <div className="flex items-center gap-2 text-[var(--danger)] text-sm">
              <XCircle size={15} />
              <span className="font-medium">{pd.absenceDeclared}</span>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleMarkPresent}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#22c55e] text-black text-xs font-semibold rounded-lg hover:bg-[#16a34a] disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 size={13} />
                {pd.imPresent}
              </button>
              <button
                onClick={() => setShowLateModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#eab30815] text-[var(--warning)] border border-[#eab30830] text-xs font-semibold rounded-lg hover:bg-[#eab30825] transition-colors"
              >
                <Clock size={13} />
                {pd.imLate}
              </button>
              <button
                onClick={() => setShowAbsenceModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ef444415] text-[var(--danger)] border border-[#ef444430] text-xs font-semibold rounded-lg hover:bg-[#ef444425] transition-colors"
              >
                <UserX size={13} />
                {pd.declareAbsence}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Members table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text)] capitalize">{dateLabel}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wider">{pd.colMember}</th>
                <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wider hidden sm:table-cell">{pd.colGrade}</th>
                <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wider">{pd.colStatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-sm text-[var(--text-3)]">{pd.noActiveMembers}</td>
                </tr>
              ) : members.map((m) => (
                <tr key={m.id} className="hover:bg-[var(--bg)] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <img src={m.avatarUrl} alt={m.name} className="w-7 h-7 rounded-full flex-shrink-0" />
                      <span className="text-sm text-[var(--text)] font-medium">{m.name}</span>
                      {m.isMe && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-[var(--accent)]/20 text-[var(--accent)] rounded font-medium">{pd.youBadge}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 hidden sm:table-cell">
                    {m.gradeName ? (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded border"
                        style={{
                          color: m.gradeColor ?? '#8b8fa8',
                          borderColor: (m.gradeColor ?? '#8b8fa8') + '40',
                          backgroundColor: (m.gradeColor ?? '#8b8fa8') + '15',
                        }}
                      >
                        {m.gradeName}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--text-3)]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {m.status === 'PRESENT' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--success)]">
                        <CheckCircle2 size={13} /> {pd.present}
                      </span>
                    ) : m.status === 'LATE' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--warning)]">
                        <Clock size={13} />
                        {pd.late}{m.delayMinutes ? ` (${m.delayMinutes} min)` : ''}
                      </span>
                    ) : m.status === 'ABSENT' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--danger)]">
                        <XCircle size={13} /> {pd.absent}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-2)]">
                        <Clock size={13} /> {pd.pending}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAbsenceModal && (
        <AbsenceDeclareModal
          locale={locale}
          declareAction={declareAbsenceAction}
          onClose={() => setShowAbsenceModal(false)}
          onSuccess={() => { setShowAbsenceModal(false); router.refresh() }}
        />
      )}

      {showLateModal && (
        <LateDeclareModal
          locale={locale}
          markLateAction={markLateAction}
          onClose={() => setShowLateModal(false)}
          onSuccess={() => { setShowLateModal(false); router.refresh() }}
        />
      )}
    </div>
  )
}
