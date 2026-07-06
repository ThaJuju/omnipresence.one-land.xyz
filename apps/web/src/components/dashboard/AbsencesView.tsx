'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CalendarDays, LayoutList, UserX, CheckCircle2, XCircle } from 'lucide-react'
import AbsenceDeclareModal from '@/components/presences/AbsenceDeclareModal'
import { getT, type Locale, type Translations } from '@/i18n/translations'

export type AbsenceItem = {
  id: string
  reason: string
  startDate: string
  endDate: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  memberName: string
  memberAvatarUrl: string
  memberGradeName: string | null
}

type StatusKey = 'PENDING' | 'APPROVED' | 'REJECTED'

function statusLabels(ab: Translations['absences']): Record<string, string> {
  return { all: ab.filterAll, PENDING: ab.filterPending, APPROVED: ab.filterApproved, REJECTED: ab.filterRejected }
}
const STATUS_STYLE: Record<StatusKey, { bg: string; color: string; border: string }> = {
  PENDING:  { bg: 'rgba(234,179,8,0.15)',  color: '#eab308', border: 'rgba(234,179,8,0.35)'  },
  APPROVED: { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', border: 'rgba(34,197,94,0.30)'  },
  REJECTED: { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444', border: 'rgba(239,68,68,0.30)'  },
}


// ── Dimensions ─────────────────────────────────────────────────────────────
// DAY_H  : vertical space reserved for the day-number badge in each cell
// BAR_H  : height of one absence bar
// BAR_GAP: vertical gap between stacked bars
// ROW_PAD: bottom padding below the last bar
// CELL_MIN: minimum cell height (matches reference design)
// GAP    : gap-1 = 4px, the Tailwind grid gap between cells
const DAY_H    = 32
const BAR_H    = 18
const BAR_GAP  = 3
const ROW_PAD  = 8
const CELL_MIN = 80
const GAP      = 4   // gap-1

// ── Helpers ─────────────────────────────────────────────────────────────────
function pad2(n: number) { return String(n).padStart(2, '0') }
function dateKey(y: number, m: number, d: number) { return `${y}-${pad2(m)}-${pad2(d)}` }
function firstDayOffset(y: number, m: number) { return (new Date(y, m - 1, 1).getDay() + 6) % 7 }
function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate() }
function getDuration(start: string, end: string, ab: Translations['absences']) {
  const d = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1
  return ab.duration(d)
}
function fmt(s: string, ab: Translations['absences']) { return new Date(s + 'T12:00:00').toLocaleDateString(ab.dateLocale) }

// ── Calendar layout engine ──────────────────────────────────────────────────

type WeekCell = { n: number; k: string; isToday: boolean } | null

type AbsenceSegment = {
  absence: AbsenceItem
  c0: number       // column start 1–7
  c1: number       // column end   1–7
  lane: number
  isStart: boolean
  isEnd: boolean
}

type CalendarWeek = {
  cells: WeekCell[]
  segs: AbsenceSegment[]
  numLanes: number
  cellMinH: number
}

function buildWeeks(year: number, month: number, absences: AbsenceItem[], todayKey: string): CalendarWeek[] {
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

    const segs: AbsenceSegment[] = overlapping.map(a => {
      const aS = new Date(a.startDate + 'T00:00:00')
      const aE = new Date(a.endDate   + 'T23:59:59')
      const bS = aS < wStart ? wStart : aS
      const bE = aE > wEnd   ? wEnd   : aE
      const c0 = (bS.getDay() + 6) % 7 + 1
      const c1 = (bE.getDay() + 6) % 7 + 1
      return {
        absence: a, c0, c1, lane: 0,
        isStart: aS >= wStart && aS.getDate() === bS.getDate() && aS.getMonth() === bS.getMonth(),
        isEnd:   aE <= wEnd   && aE.getDate() === bE.getDate() && aE.getMonth() === bE.getMonth(),
      }
    }).sort((a, b) => a.c0 - b.c0)

    // Greedy lane assignment
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

function absencesOnDay(list: AbsenceItem[], year: number, month: number, day: number) {
  const ts = new Date(year, month - 1, day).getTime()
  return list.filter(a => {
    if (a.status === 'REJECTED') return false
    const s = new Date(a.startDate + 'T00:00:00').getTime()
    const e = new Date(a.endDate   + 'T23:59:59').getTime()
    return ts >= s && ts <= e
  })
}

// ── Bar positioning (accounts for gap-1 = 4px between cells) ───────────────
// Cell width  = (100% - 6*GAP) / 7
// Left edge of column c (1-based) = (c-1) * (cell% + GAP)
// Bar from c0→c1:
//   left  = (c0-1) cells + (c0-1) gaps + insetL
//   width = (c1-c0+1) cells + (c1-c0) gaps − insetL − insetR
function barStyle(c0: number, c1: number, lane: number, isStart: boolean, isEnd: boolean, ss: { bg: string; color: string; border: string }) {
  const TOTAL_GAP = (7 - 1) * GAP  // 24px
  const iL = isStart ? 5 : 0
  const iR = isEnd   ? 5 : 0
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

// ── Component ───────────────────────────────────────────────────────────────

export default function AbsencesView({
  guildId, view, year, month, absences, statusFilter, isAdmin,
  approveAction, rejectAction, declareAbsenceAction, locale = 'fr',
}: {
  guildId: string
  view: 'calendar' | 'list'
  year: number
  month: number
  absences: AbsenceItem[]
  statusFilter: string
  isAdmin: boolean
  approveAction: (id: string) => Promise<void>
  rejectAction:  (id: string) => Promise<void>
  declareAbsenceAction: (fd: FormData) => Promise<void>
  locale?: Locale
}) {
  const t = getT(locale)
  const ab = t.absences
  const STATUS_LABELS = statusLabels(ab)
  const MONTH_NAMES = t.time.monthsFull
  const WEEKDAYS = t.time.weekdays
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [showModal,   setShowModal]   = useState(false)

  const now      = new Date()
  const todayKey = dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate())
  const selAbsences = selectedDay ? absencesOnDay(absences, year, month, selectedDay) : []
  const weeks    = buildWeeks(year, month, absences, todayKey)

  const pushUrl = (updates: Record<string, string>) => {
    const base: Record<string, string> = { view, month: `${year}-${pad2(month)}`, status: statusFilter }
    router.push(`/dashboard/${guildId}/absences?${new URLSearchParams({ ...base, ...updates })}`)
  }

  const prevMonth = () => {
    setSelectedDay(null)
    month === 1 ? pushUrl({ month: `${year - 1}-12` }) : pushUrl({ month: `${year}-${pad2(month - 1)}` })
  }
  const nextMonth = () => {
    setSelectedDay(null)
    month === 12 ? pushUrl({ month: `${year + 1}-01` }) : pushUrl({ month: `${year}-${pad2(month + 1)}` })
  }

  const handleApprove = (id: string) => startTransition(async () => { await approveAction(id); router.refresh() })
  const handleReject  = (id: string) => startTransition(async () => { await rejectAction(id);  router.refresh() })

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{ab.title}</h1>
          <p className="text-[var(--text-2)] text-sm mt-1">
            {view === 'calendar' ? `${MONTH_NAMES[month - 1]} ${year}` : ab.allAbsences}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 p-1 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
            {([
              { id: 'calendar' as const, Icon: CalendarDays, label: ab.calendarBtn },
              { id: 'list'     as const, Icon: LayoutList,   label: ab.listBtn },
            ]).map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => { setSelectedDay(null); pushUrl({ view: id }) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                style={view === id ? { background: 'var(--guild-accent)', color: '#fff' } : { color: 'var(--text-2)' }}
              >
                <Icon size={13} />{label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ background: 'var(--guild-accent)' }}
          >
            <UserX size={13} />{ab.declareBtn}
          </button>
        </div>
      </div>

      {/* ── CALENDAR VIEW ───────────────────────────────────────────────── */}
      {view === 'calendar' && (
        <div className="space-y-3">
          {/* Month nav */}
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
              <ChevronLeft size={13} />
            </button>
            <span className="text-sm font-semibold text-[var(--text)] w-40 text-center">{MONTH_NAMES[month - 1]} {year}</span>
            <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
              <ChevronRight size={13} />
            </button>
            <button
              onClick={() => { setSelectedDay(null); pushUrl({ month: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}` }) }}
              className="h-7 px-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
            >
              {t.common.today}
            </button>
          </div>

          <div className="card p-3">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">{d}</span>
                </div>
              ))}
            </div>

            {/* Week rows — one per week, each is a relative container */}
            <div className="space-y-1">
              {weeks.map((week, wi) => (
                <div key={wi} className="relative">
                  {/* Cell grid — gap-1 between cells, same as reference */}
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
                          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--hover)' }}
                          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                        >
                          {cell && (
                            <span
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold select-none"
                              style={{
                                background: isToday ? 'var(--guild-accent)' : 'transparent',
                                color: isToday ? '#fff' : isSelected ? 'var(--guild-accent)' : 'var(--text-2)',
                              }}
                            >
                              {cell.n}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Absence bars — absolutely positioned over the cell grid */}
                  {week.segs.map((seg, si) => {
                    const ss       = STATUS_STYLE[seg.absence.status]
                    const style    = barStyle(seg.c0, seg.c1, seg.lane, seg.isStart, seg.isEnd, ss)
                    const clickDay = week.cells[seg.c0 - 1]?.n ?? week.cells.find(Boolean)?.n ?? null
                    return (
                      <div
                        key={si}
                        style={style}
                        title={`${seg.absence.memberName} — ${seg.absence.reason}`}
                        onClick={(e) => { e.stopPropagation(); clickDay && setSelectedDay(clickDay) }}
                      >
                        {seg.isStart && (
                          <span style={{ fontSize: '10px', fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {seg.absence.memberName}
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
            {(['PENDING', 'APPROVED'] as StatusKey[]).map(k => {
              const s = STATUS_STYLE[k]
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
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-[var(--text)] capitalize">
                  {new Date(year, month - 1, selectedDay).toLocaleDateString(ab.dateLocale, {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
                <span className="text-xs text-[var(--text-3)]">
                  {ab.absenceCount(selAbsences.length)}
                </span>
              </div>
              {selAbsences.length === 0 ? (
                <p className="text-xs text-center py-6 text-[var(--text-3)]">{ab.noAbsenceThatDay}</p>
              ) : (
                <div className="space-y-2">
                  {selAbsences.map(a => (
                    <AbsenceCard key={a.id} absence={a} isAdmin={isAdmin} onApprove={handleApprove} onReject={handleReject} isPending={isPending} ab={ab} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── LIST VIEW ───────────────────────────────────────────────────── */}
      {view === 'list' && (
        <div className="space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(s => (
              <button
                key={s}
                onClick={() => pushUrl({ status: s })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={statusFilter === s
                  ? { background: 'var(--guild-accent)', color: '#fff' }
                  : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="card overflow-hidden">
            {absences.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[var(--text-3)]">
                <UserX size={36} className="mb-3 opacity-30" />
                <p className="text-sm">{ab.noAbsence}</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {absences.map(a => {
                  const s = STATUS_STYLE[a.status] ?? STATUS_STYLE.PENDING
                  return (
                    <div key={a.id} className="px-5 py-4 flex items-center gap-4">
                      <img src={a.memberAvatarUrl} alt={a.memberName} className="w-9 h-9 rounded-full flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-[var(--text)]">{a.memberName}</span>
                          {a.memberGradeName && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded text-[var(--text-3)] bg-[var(--bg)] border border-[var(--border)]">{a.memberGradeName}</span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-2)] truncate">{a.reason}</p>
                        <p className="text-xs text-[var(--text-3)] mt-0.5">
                          {fmt(a.startDate, ab)} → {fmt(a.endDate, ab)} · {getDuration(a.startDate, a.endDate, ab)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] px-2 py-1 rounded" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                          {STATUS_LABELS[a.status]}
                        </span>
                        {isAdmin && a.status === 'PENDING' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => handleApprove(a.id)} disabled={isPending} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium disabled:opacity-50" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>
                              <CheckCircle2 size={11} /> {ab.validate}
                            </button>
                            <button onClick={() => handleReject(a.id)} disabled={isPending} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium disabled:opacity-50" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                              <XCircle size={11} /> {ab.refuse}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <AbsenceDeclareModal
          locale={locale}
          declareAction={declareAbsenceAction}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); router.refresh() }}
        />
      )}
    </div>
  )
}

function AbsenceCard({ absence, isAdmin, onApprove, onReject, isPending, ab }: {
  absence: AbsenceItem
  isAdmin: boolean
  onApprove: (id: string) => void
  onReject:  (id: string) => void
  isPending: boolean
  ab: Translations['absences']
}) {
  const s = STATUS_STYLE[absence.status] ?? STATUS_STYLE.PENDING
  const STATUS_LABELS = statusLabels(ab)
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <img src={absence.memberAvatarUrl} alt={absence.memberName} className="w-8 h-8 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text)]">{absence.memberName}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
            {STATUS_LABELS[absence.status]}
          </span>
        </div>
        <p className="text-xs mt-0.5 truncate text-[var(--text-2)]">{absence.reason}</p>
        <p className="text-xs mt-0.5 text-[var(--text-3)]">
          {fmt(absence.startDate, ab)} → {fmt(absence.endDate, ab)} · {getDuration(absence.startDate, absence.endDate, ab)}
        </p>
      </div>
      {isAdmin && absence.status === 'PENDING' && (
        <div className="flex gap-1.5 flex-shrink-0">
          <button onClick={() => onApprove(absence.id)} disabled={isPending} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium disabled:opacity-50" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>
            <CheckCircle2 size={11} /> {ab.validate}
          </button>
          <button onClick={() => onReject(absence.id)} disabled={isPending} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium disabled:opacity-50" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
            <XCircle size={11} /> {ab.refuse}
          </button>
        </div>
      )}
    </div>
  )
}
