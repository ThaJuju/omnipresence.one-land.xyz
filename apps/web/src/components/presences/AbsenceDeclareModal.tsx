'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'

export default function AbsenceDeclareModal({
  declareAction,
  onClose,
  onSuccess,
}: {
  declareAction: (fd: FormData) => Promise<void>
  onClose: () => void
  onSuccess: () => void
}) {
  const today = new Date().toISOString().split('T')[0]!
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!reason.trim()) { setError('Le motif est obligatoire'); return }
    if (endDate < startDate) { setError('La date de fin ne peut pas être avant la date de début'); return }
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await declareAction(fd)
      onSuccess()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-[var(--text)]">Déclarer une absence</h2>
          <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Motif *</label>
            <textarea
              name="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Expliquez la raison de votre absence..."
              className="w-full input px-3 py-2 text-sm resize-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Date de début *</label>
              <input
                type="date"
                name="startDate"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value) }}
                className="w-full input px-3 py-2 text-sm [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Date de fin *</label>
              <input
                type="date"
                name="endDate"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full input px-3 py-2 text-sm [color-scheme:dark]"
              />
            </div>
          </div>

          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-[var(--text-2)] border border-[var(--border)] rounded-lg hover:bg-white/5 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 btn-primary text-sm disabled:opacity-50"
            >
              {isPending ? 'Enregistrement…' : "Déclarer l'absence"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
