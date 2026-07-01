'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'idle' | 'confirm' | 'loading' | 'done'

export default function ResetWarningsButton({ guildId }: { guildId: string }) {
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
        setError(data.error ?? 'Erreur inconnue')
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
              setError(event.message ?? 'Erreur inconnue')
              setStep('confirm')
            }
          } catch { /* ligne SSE incomplète */ }
        }
      }
    } catch {
      setError('Erreur réseau')
      setStep('confirm')
    }
  }

  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('confirm')}
        className="px-4 py-2 bg-[#ef4444]/10 text-[var(--danger)] border border-[#ef4444]/30 rounded-lg text-sm font-medium hover:bg-[#ef4444]/20 transition-colors"
      >
        Réinitialiser tous les avertissements
      </button>
    )
  }

  if (step === 'done') {
    return (
      <p className="text-sm text-[var(--text-2)]">
        ✅ Réinitialisation terminée — tous les avertissements ont été révoqués.
      </p>
    )
  }

  if (step === 'loading') {
    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
    return (
      <div className="space-y-2">
        <p className="text-sm text-[var(--text-2)]">
          Retrait des rôles Discord… {progress.done}/{progress.total} membres
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
        <p className="font-semibold">⚠️ Action irréversible</p>
        <p>Tous les avertissements actifs seront révoqués et les rôles Discord associés retirés de chaque membre concerné.</p>
      </div>
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-[#ef4444] text-white rounded-lg text-sm font-medium hover:bg-[#dc2626] transition-colors"
        >
          Confirmer la réinitialisation
        </button>
        <button
          onClick={() => { setStep('idle'); setError(null) }}
          className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)] rounded-lg text-sm hover:text-[var(--text)] transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
