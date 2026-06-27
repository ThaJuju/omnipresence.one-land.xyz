'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { getT, type Locale } from '@/i18n/translations'

type Result = {
  id: string
  username: string
  nickname: string | null
  avatar: string | null
  panelRole: string
}

export default function GlobalSearch({ guildId, locale }: { guildId: string; locale: Locale }) {
  const tr = getT(locale)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') { setOpen(false); setQuery('') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    setLoading(true)
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search/${guildId}?q=${encodeURIComponent(query)}`)
      if (res.ok) setResults(await res.json())
      setLoading(false)
    }, 200)
    return () => clearTimeout(t)
  }, [query, guildId])

  return (
    <>
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#131335] border border-white/[0.07] rounded-lg text-xs text-[var(--text-3)] hover:text-[var(--text-2)] hover:border-white/[0.12] transition-colors"
      >
        <span>🔍</span>
        <span className="hidden sm:inline">{tr.header.searchPlaceholder}</span>
        <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 bg-[#1a1a40] rounded font-mono">Ctrl K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => { setOpen(false); setQuery('') }}
        >
          <div
            className="w-full max-w-lg bg-[var(--surface)] border border-white/[0.07] rounded-md shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.07]">
              <span className="text-[var(--text-3)] flex-shrink-0">🔍</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr.members.searchPlaceholder}
                className="flex-1 bg-transparent text-[var(--text)] placeholder-[#383865] text-sm outline-none"
              />
              {loading && <span className="text-[10px] text-[var(--text-3)]">...</span>}
              <kbd className="text-[10px] text-[var(--text-3)] px-1.5 py-0.5 bg-[#1a1a40] rounded font-mono flex-shrink-0">Esc</kbd>
            </div>

            {results.length > 0 && (
              <ul className="max-h-72 overflow-y-auto divide-y divide-[#161638]">
                {results.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/dashboard/${guildId}/members/${r.id}`}
                      onClick={() => { setOpen(false); setQuery('') }}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors"
                    >
                      {r.avatar ? (
                        <img src={r.avatar} alt="" className="w-7 h-7 rounded-full flex-shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#1a1a40] flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--text)] truncate">{r.nickname ?? r.username}</p>
                        {r.nickname && <p className="text-xs text-[var(--text-3)] truncate">{r.username}</p>}
                      </div>
                      <span className="text-[11px] text-[var(--text-3)] flex-shrink-0">{r.panelRole}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {query.length >= 2 && !loading && results.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-[var(--text-3)]">
                {tr.header.noResults} « {query} »
              </p>
            )}

            {query.length < 2 && (
              <p className="px-4 py-6 text-center text-xs text-[var(--text-3)]">
                {tr.header.minChars}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
