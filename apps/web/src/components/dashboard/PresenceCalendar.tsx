'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getT, type Locale } from '@/i18n/translations'

type DayData = {
  present: number
  absent: number
  pending: number
  members: { present: string[]; absent: string[]; pending: string[] }
}

type Props = {
  events: Record<string, DayData>
  guildId: string
  locale: Locale
}

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7
  const days: (Date | null)[] = Array(startOffset).fill(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
  while (days.length % 7 !== 0) days.push(null)
  return days
}

function toKey(date: Date) {
  return date.toISOString().split('T')[0]!
}

type TooltipState = {
  key: string
  data: DayData
  x: number
  y: number
  alignRight: boolean
  alignBottom: boolean
}

export default function PresenceCalendar({ events, guildId, locale }: Props) {
  const tr = getT(locale)
  const dateLocale = locale === 'en' ? 'en-US' : 'fr-FR'
  const router = useRouter()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const days = getCalendarDays(viewYear, viewMonth)

  function prevMonth() {
    setTooltip(null)
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    setTooltip(null)
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function formatDateLocale(key: string) {
    const [y, m, d] = key.split('-').map(Number)
    const date = new Date(y!, m! - 1, d!)
    return date.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' })
  }

  function handleMouseEnter(e: React.MouseEvent<HTMLButtonElement>, key: string, data: DayData) {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    const rect = e.currentTarget.getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return
    const x = rect.left - containerRect.left + rect.width / 2
    const y = rect.top - containerRect.top
    const alignRight = x > containerRect.width / 2
    const alignBottom = y > containerRect.height * 0.6
    setTooltip({ key, data, x, y, alignRight, alignBottom })
  }

  function handleMouseLeave() {
    hideTimer.current = setTimeout(() => setTooltip(null), 120)
  }

  function handleTooltipEnter() {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }

  function handleTooltipLeave() {
    setTooltip(null)
  }

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current) }, [])

  return (
    <div ref={containerRef} className="select-none relative">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-[var(--hover)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-base font-semibold text-[var(--text)] w-44 text-center">
            {tr.time.monthsFull[viewMonth]} {viewYear}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-[var(--hover)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <button
          onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setTooltip(null) }}
          className="px-3 py-1.5 text-xs font-medium text-[var(--text-2)] border border-[var(--border)] rounded-lg hover:bg-[var(--hover)] hover:text-[var(--text)] transition-colors"
        >
          {tr.common.today}
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {tr.time.weekdays.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-[var(--text-3)] py-1.5 tracking-wide uppercase">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, i) => {
          if (!date) return <div key={`e-${i}`} />

          const key = toKey(date)
          const data = events[key]
          const isToday = key === toKey(today)
          const isFuture = date > today
          const total = data ? data.present + data.absent + data.pending : 0
          const ratio = total > 0 ? data!.present / total : -1

          let barColor = ''
          let bg = ''
          if (data && total > 0) {
            if (ratio >= 0.8)      { barColor = '#22c55e'; bg = 'rgba(35,209,96,0.10)' }
            else if (ratio >= 0.5) { barColor = '#eab308'; bg = 'rgba(255,221,87,0.10)' }
            else                   { barColor = '#ef4444'; bg = 'rgba(255,56,96,0.10)' }
          }

          const clickable = !!data && !isFuture

          return (
            <button
              key={key}
              onClick={() => clickable && router.push(`/dashboard/${guildId}/presences/${key}`)}
              onMouseEnter={data ? (e) => handleMouseEnter(e, key, data) : undefined}
              onMouseLeave={data ? handleMouseLeave : undefined}
              disabled={!clickable}
              className={[
                'rounded-md flex flex-col items-center justify-center py-2 gap-1 transition-all min-h-[56px]',
                isToday ? 'ring-2 ring-[#5865F2] ring-inset' : '',
                clickable ? 'hover:brightness-125 cursor-pointer' : 'cursor-default',
                !data || isFuture ? 'opacity-35' : '',
              ].join(' ')}
              style={{ background: bg || 'transparent' }}
            >
              <span className={['text-sm font-semibold leading-none', isToday ? 'text-[var(--accent)]' : data ? 'text-[var(--text)]' : 'text-[var(--text-3)]'].join(' ')}>
                {date.getDate()}
              </span>
              {data && total > 0 && (
                <>
                  <span className="text-[11px] leading-none font-mono tabular-nums" style={{ color: barColor }}>
                    {data.present}/{total}
                  </span>
                  <div className="w-5 h-[3px] rounded-full" style={{ backgroundColor: barColor }} />
                </>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5 pt-4 border-t border-[var(--border)] text-xs text-[var(--text-3)]">
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-[3px] rounded-full bg-[#22c55e]" />{tr.stats.legendGood} {tr.presences.present.toLowerCase()}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-[3px] rounded-full bg-[#eab308]" />{tr.stats.legendOk}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-[3px] rounded-full bg-[#ef4444]" />{tr.stats.legendBad}</span>
        <span className="ml-auto flex items-center gap-1.5"><span className="inline-block w-3.5 h-3.5 rounded border-2 border-[var(--accent)]" />{tr.common.today}</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          onMouseEnter={handleTooltipEnter}
          onMouseLeave={handleTooltipLeave}
          className="absolute z-50 w-64 bg-[var(--surface-2)] border border-[var(--border)] rounded-md shadow-xl shadow-black/40 overflow-hidden pointer-events-auto"
          style={{
            left: tooltip.alignRight ? undefined : tooltip.x,
            right: tooltip.alignRight ? `calc(100% - ${tooltip.x}px)` : undefined,
            top: tooltip.alignBottom ? undefined : tooltip.y,
            bottom: tooltip.alignBottom ? `calc(100% - ${tooltip.y}px)` : undefined,
            transform: tooltip.alignRight
              ? `translateX(8px) translateY(${tooltip.alignBottom ? '-8px' : '8px'})`
              : `translateX(-50%) translateY(${tooltip.alignBottom ? '-8px' : '8px'})`,
          }}
        >
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
            <p className="text-xs font-semibold text-[var(--text)] capitalize">{formatDateLocale(tooltip.key)}</p>
            <div className="flex gap-3 mt-1.5 text-xs">
              <span className="text-[var(--success)]">✓ {tooltip.data.present} {tr.presences.present.toLowerCase()}</span>
              {tooltip.data.absent > 0 && <span className="text-[var(--danger)]">✗ {tooltip.data.absent} {tr.presences.absent.toLowerCase()}</span>}
              {tooltip.data.pending > 0 && <span className="text-[var(--warning)]">⏳ {tooltip.data.pending} {tr.presences.pending.toLowerCase()}</span>}
            </div>
          </div>

          {tooltip.data.members.absent.length > 0 && (
            <div className="px-4 py-2.5">
              <p className="text-[10px] font-semibold text-[var(--danger)] uppercase tracking-wider mb-1.5">{tr.presences.absent}</p>
              <ul className="space-y-1">
                {tooltip.data.members.absent.slice(0, 8).map((name, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-[var(--text)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] flex-shrink-0" />
                    {name}
                  </li>
                ))}
                {tooltip.data.members.absent.length > 8 && (
                  <li className="text-xs text-[var(--text-3)]">+{tooltip.data.members.absent.length - 8}</li>
                )}
              </ul>
            </div>
          )}

          {tooltip.data.members.pending.length > 0 && (
            <div className={`px-4 py-2.5 ${tooltip.data.members.absent.length > 0 ? 'border-t border-[var(--border)]' : ''}`}>
              <p className="text-[10px] font-semibold text-[var(--warning)] uppercase tracking-wider mb-1.5">{tr.presences.pending}</p>
              <ul className="space-y-1">
                {tooltip.data.members.pending.slice(0, 5).map((name, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-[var(--text)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#eab308] flex-shrink-0" />
                    {name}
                  </li>
                ))}
                {tooltip.data.members.pending.length > 5 && (
                  <li className="text-xs text-[var(--text-3)]">+{tooltip.data.members.pending.length - 5}</li>
                )}
              </ul>
            </div>
          )}

          {tooltip.data.members.present.length > 0 && (
            <div className="px-4 py-2.5 border-t border-[var(--border)]">
              <p className="text-[10px] font-semibold text-[var(--success)] uppercase tracking-wider mb-1.5">{tr.presences.present}</p>
              <ul className="space-y-1">
                {tooltip.data.members.present.slice(0, 5).map((name, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-[var(--text-2)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] flex-shrink-0" />
                    {name}
                  </li>
                ))}
                {tooltip.data.members.present.length > 5 && (
                  <li className="text-xs text-[var(--text-3)]">+{tooltip.data.members.present.length - 5}</li>
                )}
              </ul>
            </div>
          )}

          <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--bg)]">
            <p className="text-[10px] text-[var(--text-3)]">{locale === 'en' ? 'Click for full details' : 'Cliquer pour voir le détail complet'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
