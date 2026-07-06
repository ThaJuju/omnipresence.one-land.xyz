'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getT, type Locale } from '@/i18n/translations'

type Step = 'idle' | 'confirm' | 'loading' | 'done'

export default function ResetWarningsButton({ guildId, locale = 'fr' }: { guildId: string; locale?: Locale }) {
  const t = getT(locale)
  const w = t.settingsWarnings
  const [step, setStep] = useState<Step>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleReset() {
    setStep('loading')
    setError(null)
    setProgress({ done: 0, total: 0 })

    try {
      const res = await fetch(`/api/guilds/${guildId}/warnings/reset`, { method: 'DELETE' })

      if (!res.ok || !res.body) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? w.unknownError)
        setStep('confirm')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: string
              total?: number
              done?: number
              reset?: number
              message?: string
            }

            if (event.type === 'start') {
              setProgress({ done: 0, total: event.total ?? 0 })
            } else if (event.type === 'progress') {
              setProgress({ done: event.done ?? 0, total: event.total ?? 0 })
            } else if (event.type === 'done') {
              setStep('done')
              router.refresh()
            } else if (event.type === 'error') {
              setError(event.message ?? w.unknownError)
              setStep('confirm')
            }
          } catch { /* ligne SSE incomplète */ }
        }
      }
    } catch {
      setError(w.networkError)
      setStep('confirm')
    }
  }

  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('confirm')}
        className="px-4 py-2 bg-[#ef4444]/10 text-[var(--danger)] border border-[#ef4444]/30 rounded-lg text-sm font-medium hover:bg-[#ef4444]/20 transition-colors"
      >
        {w.resetBtn}
      </button>
    )
  }

  if (step === 'done') {
    return (
      <p className="text-sm text-[var(--text-2)]">
        {w.resetDone}
      </p>
    )
  }

  if (step === 'loading') {
    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
    return (
      <div className="space-y-2">
        <p className="text-sm text-[var(--text-2)]">
          {w.resetProgress(progress.done, progress.total)}
        </p>
        <div className="w-full h-2 bg-[var(--bg)] rounded-full overflow-hidden border border-[var(--border)]">
          <div
            className="h-full bg-[#ef4444] rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-[var(--text-3)]">{pct}%</p>
      </div>
    )
  }

  // step === 'confirm'
  return (
    <div className="space-y-3">
      <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-md p-4 text-sm text-[var(--danger)] space-y-1">
        <p className="font-semibold">{w.irreversible}</p>
        <p>{w.resetWarningText}</p>
      </div>
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-[#ef4444] text-white rounded-lg text-sm font-medium hover:bg-[#dc2626] transition-colors"
        >
          {w.confirmReset}
        </button>
        <button
          onClick={() => { setStep('idle'); setError(null) }}
          className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)] rounded-lg text-sm hover:text-[var(--text)] transition-colors"
        >
          {t.common.cancel}
        </button>
      </div>
    </div>
  )
}
