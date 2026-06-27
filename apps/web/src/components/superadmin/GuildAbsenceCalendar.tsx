'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export type SAAbsenceItem = {
  id: string
  reason: string
  startDate: string
  endDate: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  memberName: string
}

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  PENDING:  { bg: 'rgba(234,179,8,0.15)',  color: '#eab308', border: 'rgba(234,179,8,0.35)'  },
  APPROVED: { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', border: 'rgba(34,197,94,0.30)'  },
  REJECTED: { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444', border: 'rgba(239,68,68,0.30)'  },
}
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente', APPROVED: 'Approuvée', REJECTED: 'Refusée',
}

const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const WEEKDAYS    = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

const DAY_H    = 32
const BAR_H    = 18
const BAR_GAP  = 3
const ROW_PAD  = 8
const CELL_MIN = 80
const GAP      = 4

function pad2(n: number) { return String(n).padStart(2, '0') }
function dateKey(y: number, m: number, d: number) { return `${y}-${pad2(m)}-${pad2(d)}` }
function firstDayOffset(y: number, m: number) { return (new Date(y, m - 1, 1).getDay() + 6) % 7 }
function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate() }
function fmt(s: string) { return new Date(s + 'T12:00:00').toLocaleDateString('fr-FR') }
function getDuration(start: string, end: string) {
  const d = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1
  return `${d}j`
}

type WeekCell = { n: number; k: string; isToday: boolean } | null
type Segment  = { a: SAAbsenceItem; c0: number; c1: number; lane: number; isStart: boolean; isEnd: boolean }
type CalWeek  = { cells: WeekCell[]; segs: Segment[]; numLanes: number; cellMinH: number }

function buildWeeks(year: number, month: number, absences: SAAbsenceItem[], todayKey: string): CalWeek[] {
  const offset   = firstDayOffset(year, month)
  const days     = daysInMonth(year, month)
  const numWeeks = Math.ceil((offset + days) / 7)

  return Array.from({ length: numWeeks }, (_, w) => {
    const cells: WeekCell[] = Array.from({ length: 7 }, (_, d) => {
      const n = w * 7 + d - offset + 1
      if (n < 1 || n > days) return null
      return { n, k: dateKey(year, month, n), isToday: dateKey(year, month, n) === todayKey }
    })

    const real = cells.filter(Boolean) as NonNullable<WeekCell>[]
    if (!real.length) return { cells, segs: [], numLanes: 0, cellMinH: CELL_MIN }

    const wStart = new Date(year, month - 1, real[0]!.n)
    const wEnd   = new Date(year, month - 1, real.at(-1)!.n, 23, 59, 59)

    const overlapping = absences.filter(a => {
      if (a.status === 'REJECTED') return false
      return new Date(a.startDate + 'T00:00:00') <= wEnd
          && new Date(a.endDate   + 'T23:59:59') >= wStart
    })

    const segs: Segment[] = overlapping.map(a => {
      const aS = new Date(a.startDate + 'T00:00:00')
      const aE = new Date(a.endDate   + 'T23:59:59')
      const bS = aS < wStart ? wStart : aS
      const bE = aE > wEnd   ? wEnd   : aE
      const c0 = (bS.getDay() + 6) % 7 + 1
      const c1 = (bE.getDay() + 6) % 7 + 1
      return {
        a, c0, c1, lane: 0,
        isStart: aS >= wStart && aS.getDate() === bS.getDate() && aS.getMonth() === bS.getMonth(),
        isEnd:   aE <= wEnd   && aE.getDate() === bE.getDate() && aE.getMonth() === bE.getMonth(),
      }
    }).sort((x, y) => x.c0 - y.c0)

    const laneEnds: number[] = []
    for (const s of segs) {
      let l = laneEnds.findIndex(e => e < s.c0)
      if (l === -1) l = laneEnds.length
      s.lane = l
      laneEnds[l] = s.c1
    }

    const numLanes = laneEnds.length
    const cellMinH = Math.max(CELL_MIN, DAY_H + numLanes * (BAR_H + BAR_GAP) + ROW_PAD)
    return { cells, segs, numLanes, cellMinH }
  })
}

function barStyle(c0: number, c1: number, lane: number, isStart: boolean, isEnd: boolean, ss: { bg: string; color: string; border: string }) {
  const TOTAL_GAP  = (7 - 1) * GAP
  const iL         = isStart ? 5 : 0
  const iR         = isEnd   ? 5 : 0
  const spans      = c1 - c0 + 1
  const gapsCrossed = c1 - c0
  const rL = isStart ? '4px' : '0'
  const rR = isEnd   ? '4px' : '0'
  const top = DAY_H + lane * (BAR_H + BAR_GAP) + 2
  return {
    position:     'absolute' as const,
    top:          `${top}px`,
    left:         `calc(${c0 - 1} * (100% - ${TOTAL_GAP}px) / 7 + ${(c0 - 1) * GAP + iL}px)`,
    width:        `calc(${spans} * (100% - ${TOTAL_GAP}px) / 7 + ${gapsCrossed * GAP - iL - iR}px)`,
    height:       `${BAR_H}px`,
    zIndex:       1,
    background:   ss.bg,
    border:       `1px solid ${ss.border}`,
    borderLeft:   isStart ? undefined : 'none',
    borderRight:  isEnd   ? undefined : 'none',
    borderRadius: `${rL} ${rR} ${rR} ${rL}`,
    color:        ss.color,
    display:      'flex',
    alignItems:   'center',
    paddingLeft:  isStart ? '6px' : '3px',
    overflow:     'hidden',
    cursor:       'pointer',
  }
}

function absencesOnDay(list: SAAbsenceItem[], year: number, month: number, day: number) {
  const ts = new Date(year, month - 1, day).getTime()
  return list.filter(a => {
    if (a.status === 'REJECTED') return false
    const s = new Date(a.startDate + 'T00:00:00').getTime()
    const e = new Date(a.endDate   + 'T23:59:59').getTime()
    return ts >= s && ts <= e
  })
}

export default function GuildAbsenceCalendar({
  absences, year, month, guildId,
}: {
  absences: SAAbsenceItem[]
  year: number
  month: number
  guildId: string
}) {
  const router = useRouter()
  const now = new Date()
  const todayKey = dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const weeks = buildWeeks(year, month, absences, todayKey)

  const pushMonth = (y: number, m: number) => {
    setSelectedDay(null)
    router.push(`/superadmin/instances/${guildId}?month=${y}-${pad2(m)}`)
  }
  const prevMonth = () => month === 1 ? pushMonth(year - 1, 12) : pushMonth(year, month - 1)
  const nextMonth = () => month === 12 ? pushMonth(year + 1, 1) : pushMonth(year, month + 1)
  const goToday   = () => pushMonth(now.getFullYear(), now.getMonth() + 1)

  const selAbsences = selectedDay ? absencesOnDay(absences, year, month, selectedDay) : []

  return (
    <div className="space-y-3">
      {/* Month nav */}
      <div className="flex items-center gap-2">
        <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--bg)] border border-white/[0.07] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
          <ChevronLeft size={13} />
        </button>
        <span className="text-sm font-semibold text-[var(--text)] w-40 text-center">{MONTH_NAMES[month - 1]} {year}</span>
        <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--bg)] border border-white/[0.07] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
          <ChevronRight size={13} />
        </button>
        <button onClick={goToday} className="h-7 px-2.5 rounded-lg bg-[var(--bg)] border border-white/[0.07] text-xs text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
          Aujourd&apos;hui
        </button>
        <span className="text-xs text-[var(--text-3)] ml-2">
          {absences.filter(a => a.status !== 'REJECTED').length} absence(s) ce mois
        </span>
      </div>

      <div className="bg-[var(--bg)] rounded-md border border-white/[0.07] p-3">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">{d}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="relative">
              <div className="grid grid-cols-7 gap-1">
                {week.cells.map((cell, ci) => {
                  const isSelected = cell !== null && selectedDay === cell.n
                  const isToday    = cell?.isToday ?? false
                  return (
                    <div
                      key={ci}
                      onClick={() => cell && setSelectedDay(isSelected ? null : cell.n)}
                      className="rounded-md p-1.5 cursor-pointer transition-colors"
                      style={{
                        minHeight: `${week.cellMinH}px`,
                        background: isSelected ? 'rgba(88,101,242,0.10)' : 'transparent',
                        border: isSelected
                          ? '1px solid rgba(88,101,242,0.32)'
                          : isToday
                            ? '1px solid rgba(88,101,242,0.22)'
                            : '1px solid transparent',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      {cell && (
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold select-none"
                          style={{
                            background: isToday ? 'var(--accent)' : 'transparent',
                            color: isToday ? '#fff' : isSelected ? 'var(--accent)' : '#9898b8',
                          }}
                        >
                          {cell.n}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {week.segs.map((seg, si) => {
                const ss    = STATUS_STYLE[seg.a.status]!
                const style = barStyle(seg.c0, seg.c1, seg.lane, seg.isStart, seg.isEnd, ss)
                const clickDay = week.cells[seg.c0 - 1]?.n ?? week.cells.find(Boolean)?.n ?? null
                return (
                  <div
                    key={si}
                    style={style}
                    title={`${seg.a.memberName} — ${seg.a.reason}`}
                    onClick={e => { e.stopPropagation(); clickDay && setSelectedDay(clickDay) }}
                  >
                    {seg.isStart && (
                      <span style={{ fontSize: '10px', fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {seg.a.memberName}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap px-1">
        {(['PENDING', 'APPROVED'] as const).map(k => {
          const s = STATUS_STYLE[k]!
          return (
            <div key={k} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.bg, border: `1px solid ${s.border}` }} />
              <span className="text-xs text-[var(--text-3)]">{STATUS_LABELS[k]}</span>
            </div>
          )
        })}
      </div>

      {/* Selected day panel */}
      {selectedDay !== null && (
        <div className="bg-[var(--bg)] rounded-md border border-white/[0.07] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[var(--text)] capitalize">
              {new Date(year, month - 1, selectedDay).toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
            <span className="text-xs text-[var(--text-3)]">
              {selAbsences.length} absence{selAbsences.length !== 1 ? 's' : ''}
            </span>
          </div>
          {selAbsences.length === 0 ? (
            <p className="text-xs text-center py-4 text-[var(--text-3)]">Aucune absence ce jour</p>
          ) : (
            <div className="space-y-2">
              {selAbsences.map(a => {
                const s = STATUS_STYLE[a.status]!
                return (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg)] border border-white/[0.07]">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-[var(--text)]">{a.memberName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                          {STATUS_LABELS[a.status]}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-2)] truncate">{a.reason}</p>
                      <p className="text-xs text-[var(--text-3)] mt-0.5">{fmt(a.startDate)} → {fmt(a.endDate)} · {getDuration(a.startDate, a.endDate)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
