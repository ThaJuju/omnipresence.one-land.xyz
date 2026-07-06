'use client'

import { useState, useTransition } from 'react'
import { X, Clock } from 'lucide-react'
import { getT, type Locale } from '@/i18n/translations'

export default function LateDeclareModal({
  markLateAction,
  onClose,
  onSuccess,
  locale = 'fr',
}: {
  markLateAction: (fd: FormData) => Promise<void>
  onClose: () => void
  onSuccess: () => void
  locale?: Locale
}) {
  const t = getT(locale)
  const pd = t.presences
  const [isPending, startTransition] = useTransition()
  const [delay, setDelay] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const minutes = parseInt(delay, 10)
    if (isNaN(minutes) || minutes <= 0) {
      setError(pd.errInvalidMinutes)
      return
    }
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await markLateAction(fd)
      onSuccess()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[var(--warning)]" />
            <h2 className="font-bold text-[var(--text)]">{pd.lateModalTitle}</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">
              {pd.lateDurationLabel}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="delayMinutes"
                min={1}
                max={480}
                value={delay}
                onChange={(e) => setDelay(e.target.value)}
                placeholder={pd.latePlaceholder}
                className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[#eab308] transition-colors"
              />
              <span className="text-sm text-[var(--text-2)] whitespace-nowrap">{pd.minutes}</span>
            </div>
          </div>

          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-[var(--text-2)] border border-[var(--border)] rounded-lg hover:bg-white/5 transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 text-sm font-medium text-black bg-[#eab308] rounded-lg hover:bg-[#ca8a04] disabled:opacity-50 transition-colors"
            >
              {isPending ? pd.saving : pd.confirmLate}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
