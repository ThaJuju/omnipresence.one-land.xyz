'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ResetWarningsButton({ guildId }: { guildId: string }) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'loading'>('idle')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleReset() {
    setStep('loading')
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/warnings/reset`, { method: 'DELETE' })
      const data = await res.json() as { data?: { reset: number }; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Erreur inconnue')
        setStep('confirm')
        return
      }
      setStep('idle')
      router.refresh()
    } catch {
      setError('Erreur réseau')
      setStep('confirm')
    }
  }

  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('confirm')}
        className="px-4 py-2 bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30 rounded-lg text-sm font-medium hover:bg-[#ef4444]/20 transition-colors"
      >
        Réinitialiser tous les avertissements
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-md p-4 text-sm text-[#ef4444] space-y-1">
        <p className="font-semibold">⚠️ Action irréversible</p>
        <p>Tous les avertissements actifs seront révoqués et les rôles Discord associés retirés de chaque membre concerné.</p>
      </div>
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={handleReset}
          disabled={step === 'loading'}
          className="px-4 py-2 bg-[#ef4444] text-white rounded-lg text-sm font-medium hover:bg-[#dc2626] transition-colors disabled:opacity-50"
        >
          {step === 'loading' ? 'Réinitialisation…' : 'Confirmer la réinitialisation'}
        </button>
        <button
          onClick={() => { setStep('idle'); setError(null) }}
          disabled={step === 'loading'}
          className="px-4 py-2 bg-[var(--surface)] border border-white/[0.07] text-[var(--text-2)] rounded-lg text-sm hover:text-[var(--text)] transition-colors disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
