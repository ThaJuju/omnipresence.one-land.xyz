'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, UserX } from 'lucide-react'
import AbsenceDeclareModal from '@/components/presences/AbsenceDeclareModal'
import LateDeclareModal from '@/components/presences/LateDeclareModal'

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
}) {
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

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Présences</h1>
          <p className="text-[var(--text-2)] text-sm mt-1">Suivi journalier des membres</p>
        </div>
        <a
          href={`/api/export/${guildId}/presences`}
          className="px-3 py-1.5 bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--border-mid)] text-xs rounded-lg transition-colors flex items-center gap-1.5"
        >
          ⬇ Export CSV
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
            Aujourd'hui
          </button>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { label: 'Présents',    value: stats.present, Icon: CheckCircle2, color: 'text-[var(--success)]', bg: 'bg-[#22c55e]/10' },
          { label: 'En retard',   value: stats.late,    Icon: Clock,        color: 'text-[var(--warning)]', bg: 'bg-[#eab308]/10' },
          { label: 'Absents',     value: stats.absent,  Icon: XCircle,      color: 'text-[var(--danger)]', bg: 'bg-[#ef4444]/10' },
          { label: 'En attente',  value: stats.pending, Icon: Clock,        color: 'text-[var(--text-2)]', bg: 'bg-[var(--hover)]' },
        ] as const).map(({ label, value, Icon, color, bg }) => (
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
          <p className="text-sm font-semibold text-[var(--text)] mb-3">Votre présence</p>
          {myPresence === 'PRESENT' ? (
            <div className="flex items-center gap-2 text-[var(--success)] text-sm">
              <CheckCircle2 size={15} />
              <span className="font-medium">Vous êtes marqué présent aujourd'hui</span>
            </div>
          ) : myPresence === 'LATE' ? (
            <div className="flex items-center gap-2 text-[var(--warning)] text-sm">
              <Clock size={15} />
              <span className="font-medium">Retard déclaré</span>
            </div>
          ) : myPresence === 'ABSENT' ? (
            <div className="flex items-center gap-2 text-[var(--danger)] text-sm">
              <XCircle size={15} />
              <span className="font-medium">Absence déclarée</span>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleMarkPresent}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#22c55e] text-black text-xs font-semibold rounded-lg hover:bg-[#16a34a] disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 size={13} />
                Je suis présent
              </button>
              <button
                onClick={() => setShowLateModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#eab30815] text-[var(--warning)] border border-[#eab30830] text-xs font-semibold rounded-lg hover:bg-[#eab30825] transition-colors"
              >
                <Clock size={13} />
                Je suis en retard
              </button>
              <button
                onClick={() => setShowAbsenceModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ef444415] text-[var(--danger)] border border-[#ef444430] text-xs font-semibold rounded-lg hover:bg-[#ef444425] transition-colors"
              >
                <UserX size={13} />
                Déclarer une absence
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
                <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wider">Membre</th>
                <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wider hidden sm:table-cell">Grade</th>
                <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wider">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-sm text-[var(--text-3)]">Aucun membre actif</td>
                </tr>
              ) : members.map((m) => (
                <tr key={m.id} className="hover:bg-[var(--bg)] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <img src={m.avatarUrl} alt={m.name} className="w-7 h-7 rounded-full flex-shrink-0" />
                      <span className="text-sm text-[var(--text)] font-medium">{m.name}</span>
                      {m.isMe && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-[var(--accent)]/20 text-[var(--accent)] rounded font-medium">Vous</span>
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
                        <CheckCircle2 size={13} /> Présent
                      </span>
                    ) : m.status === 'LATE' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--warning)]">
                        <Clock size={13} />
                        En retard{m.delayMinutes ? ` (${m.delayMinutes} min)` : ''}
                      </span>
                    ) : m.status === 'ABSENT' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--danger)]">
                        <XCircle size={13} /> Absent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-2)]">
                        <Clock size={13} /> En attente
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
          declareAction={declareAbsenceAction}
          onClose={() => setShowAbsenceModal(false)}
          onSuccess={() => { setShowAbsenceModal(false); router.refresh() }}
        />
      )}

      {showLateModal && (
        <LateDeclareModal
          markLateAction={markLateAction}
          onClose={() => setShowLateModal(false)}
          onSuccess={() => { setShowLateModal(false); router.refresh() }}
        />
      )}
    </div>
  )
}
