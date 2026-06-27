'use client'

import { useState } from 'react'
import { X, Users } from 'lucide-react'

type DayStat = { k: string; present: number; absent: number; pending: number }

type MemberEntry = { id: string; name: string; avatar: string | null }
type DayDetail = { present: MemberEntry[]; absent: MemberEntry[]; pending: MemberEntry[] } | null

function pad2(n: number) { return String(n).padStart(2, '0') }

function presenceColor(rate: number) {
  if (rate >= 0.8)  return '#22c55e'
  if (rate >= 0.6)  return '#86efac'
  if (rate >= 0.4)  return '#eab308'
  if (rate >= 0.2)  return '#f97316'
  return '#ef4444'
}

function Avatar({ name, avatar }: { name: string; avatar: string | null }) {
  const initial = name[0]?.toUpperCase() ?? '?'
  if (avatar) {
    return <img src={`https://cdn.discordapp.com/avatars/${avatar}`} alt={name} className="w-6 h-6 rounded-full flex-shrink-0" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
  }
  return (
    <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold bg-[#1a1a40] text-[var(--text-2)]">
      {initial}
    </span>
  )
}

export default function GuildPresenceHeatmap({
  days,
  guildId,
  presenceRate,
  totalLogged,
}: {
  days: DayStat[]
  guildId: string
  presenceRate: number | null
  totalLogged: number
}) {
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`

  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [detail, setDetail]           = useState<DayDetail>(null)
  const [loading, setLoading]         = useState(false)

  const handleDayClick = async (k: string) => {
    if (selectedDay === k) {
      setSelectedDay(null)
      setDetail(null)
      return
    }
    setSelectedDay(k)
    setDetail(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/superadmin/presence/${guildId}?date=${k}`)
      if (res.ok) setDetail(await res.json() as DayDetail)
    } catch { /* ignore */ }
    setLoading(false)
  }

  const maxTotal = Math.max(...days.map(d => d.present + d.absent + d.pending), 1)

  if (totalLogged === 0) {
    return <p className="text-sm text-center py-6 text-[var(--text-3)]">Aucun log de présence enregistré</p>
  }

  const fmtDate = (k: string) => new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-3">
      {/* Heatmap squares */}
      <div className="flex gap-1 flex-wrap">
        {days.map(({ k, present, absent, pending }) => {
          const total      = present + absent + pending
          const resolved   = present + absent
          // Rate only on resolved (present+absent), ignore pending
          const rate       = resolved > 0 ? present / resolved : null
          // Square color: no data → dark, all pending → orange, resolved → green/red scale
          const squareBg   = total === 0
            ? '#0d1117'
            : rate === null
              ? '#eab308'          // all pending → orange
              : presenceColor(rate)
          const isToday    = k === todayKey
          const isSelected = k === selectedDay
          const d = new Date(k + 'T12:00:00')
          const label = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
          return (
            <button
              key={k}
              onClick={() => handleDayClick(k)}
              title={`${label} — ${present} présent(s) / ${absent} absent(s) / ${pending} en attente\nCliquer pour voir les membres`}
              className="flex-1 group"
              style={{ minWidth: 20, maxWidth: 28 }}
            >
              <div
                className="rounded-sm transition-all"
                style={{
                  height: 28,
                  background: squareBg,
                  opacity: isSelected ? 1 : total === 0 ? 0.2 : 0.75,
                  border: isSelected
                    ? '2px solid #fff'
                    : isToday
                      ? '2px solid #5865F2'
                      : '1px solid transparent',
                  transform: isSelected ? 'scaleY(1.1)' : undefined,
                }}
              />
              {isToday && !isSelected && (
                <div className="text-[8px] text-center text-[var(--accent)] mt-0.5 font-semibold leading-none">auj.</div>
              )}
            </button>
          )
        })}
      </div>

      {/* Bar chart — 3 segments stacked: present (green) / pending (orange) / absent (red) */}
      <div className="flex gap-1 items-end" style={{ height: 60 }}>
        {days.map(({ k, present, absent, pending }) => {
          const total      = present + absent + pending
          const h          = total > 0 ? Math.max(4, Math.round((total / maxTotal) * 52)) : 2
          const pPresent   = total > 0 ? present / total : 0
          const pPending   = total > 0 ? pending / total : 0
          const pAbsent    = total > 0 ? absent  / total : 0
          const isSelected = k === selectedDay
          // Round heights so they sum to h
          const hPresent = Math.round(pPresent * h)
          const hPending = Math.round(pPending * h)
          const hAbsent  = h - hPresent - hPending
          return (
            <button
              key={k}
              onClick={() => handleDayClick(k)}
              className="flex-1 flex flex-col justify-end transition-opacity"
              style={{ opacity: isSelected ? 1 : 0.8 }}
            >
              <div
                className="rounded-sm overflow-hidden transition-all"
                style={{ height: h, outline: isSelected ? '1.5px solid #fff' : undefined }}
              >
                {/* top → bottom: absent (red), pending (orange), present (green) */}
                {hAbsent  > 0 && <div style={{ height: hAbsent,  background: '#ef4444', opacity: 0.70 }} />}
                {hPending > 0 && <div style={{ height: hPending, background: '#eab308', opacity: 0.80 }} />}
                {hPresent > 0 && <div style={{ height: hPresent, background: '#22c55e', opacity: 0.85 }} />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Scale + legend */}
      <div className="flex justify-between text-[10px] text-[var(--text-3)]">
        <span>{days[0] ? new Date(days[0].k + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}</span>
        <span className="flex gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#22c55e', opacity: 0.85 }} />Présent
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#eab308', opacity: 0.80 }} />En attente
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#ef4444', opacity: 0.70 }} />Absent
          </span>
        </span>
        <span>{days.at(-1) ? new Date(days.at(-1)!.k + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}</span>
      </div>

      {/* Selected day detail panel */}
      {selectedDay && (
        <div className="bg-[var(--bg)] rounded-md border border-white/[0.07] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[var(--text)] capitalize">{fmtDate(selectedDay)}</p>
            <button onClick={() => { setSelectedDay(null); setDetail(null) }} className="text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors">
              <X size={14} />
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-6 gap-2 text-xs text-[var(--text-3)]">
              <div className="w-3 h-3 rounded-full border border-[#383865] border-t-transparent animate-spin" />
              Chargement…
            </div>
          )}

          {!loading && detail && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Présents */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
                  <span className="text-xs font-semibold text-[#22c55e]">Présents</span>
                  <span className="text-xs text-[var(--text-3)] ml-auto">{detail.present.length}</span>
                </div>
                {detail.present.length === 0 ? (
                  <p className="text-[11px] text-[var(--text-3)] italic">Aucun</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.present.map(m => (
                      <li key={m.id} className="flex items-center gap-2">
                        <Avatar name={m.name} avatar={m.avatar} />
                        <span className="text-xs text-[var(--text)] truncate">{m.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Absents */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                  <span className="text-xs font-semibold text-[#ef4444]">Absents</span>
                  <span className="text-xs text-[var(--text-3)] ml-auto">{detail.absent.length}</span>
                </div>
                {detail.absent.length === 0 ? (
                  <p className="text-[11px] text-[var(--text-3)] italic">Aucun</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.absent.map(m => (
                      <li key={m.id} className="flex items-center gap-2">
                        <Avatar name={m.name} avatar={m.avatar} />
                        <span className="text-xs text-[var(--text)] truncate">{m.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* En attente */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-2 h-2 rounded-full bg-[#eab308]" />
                  <span className="text-xs font-semibold text-[#eab308]">En attente</span>
                  <span className="text-xs text-[var(--text-3)] ml-auto">{detail.pending.length}</span>
                </div>
                {detail.pending.length === 0 ? (
                  <p className="text-[11px] text-[var(--text-3)] italic">Aucun</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.pending.map(m => (
                      <li key={m.id} className="flex items-center gap-2">
                        <Avatar name={m.name} avatar={m.avatar} />
                        <span className="text-xs text-[var(--text)] truncate">{m.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {!loading && !detail && (
            <div className="flex items-center justify-center py-4 gap-1.5 text-xs text-[var(--text-3)]">
              <Users size={13} />
              Impossible de charger les données
            </div>
          )}
        </div>
      )}
    </div>
  )
}
