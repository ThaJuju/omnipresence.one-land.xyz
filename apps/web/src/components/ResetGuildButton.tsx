'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function ResetGuildButton({
  guildName,
  resetAction,
}: {
  guildName: string
  resetAction: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [isPending, startTransition] = useTransition()

  const confirm = () => {
    startTransition(async () => {
      await resetAction()
      setOpen(false)
      setInput('')
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--danger)] border border-[#ef444430] rounded-lg hover:bg-[#ef444410] transition-colors"
      >
        <AlertTriangle size={14} />
        Réinitialiser la guild
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setOpen(false); setInput('') }} />
          <div className="relative bg-[var(--surface)] border border-[#ef444430] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#ef444415] flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-[var(--danger)]" />
              </div>
              <div>
                <h2 className="font-bold text-[var(--text)]">Réinitialiser la guild</h2>
                <p className="text-xs text-[var(--text-2)] mt-0.5">Cette action est irréversible</p>
              </div>
            </div>

            <p className="text-sm text-[var(--text-2)] mb-3 leading-relaxed">
              Toutes les données opérationnelles seront supprimées définitivement :
            </p>
            <ul className="text-xs text-[var(--text-2)] space-y-1 mb-5 pl-3 border-l border-[#ef444430]">
              <li>Logs de présence, absences, avertissements</li>
              <li>Cotisations, écritures comptables, VDA</li>
              <li>Historique des grades, audit logs, notifications</li>
            </ul>
            <p className="text-xs text-[var(--text-2)] mb-2">
              La config, les membres et les grades seront <span className="text-[var(--text)]">conservés</span>.
            </p>

            <p className="text-xs font-medium text-[var(--text)] mb-1.5 mt-4">
              Tapez <span className="font-mono text-[var(--danger)]">RESET</span> pour confirmer
            </p>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="RESET"
              className="w-full bg-[var(--bg)] border border-[#ef444430] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[#ef4444] transition-colors font-mono"
              autoComplete="off"
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setOpen(false); setInput('') }}
                className="flex-1 px-4 py-2 text-sm font-medium text-[var(--text-2)] border border-[var(--border)] rounded-lg hover:bg-white/5 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirm}
                disabled={input !== 'RESET' || isPending}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#ef4444] rounded-lg hover:bg-[#dc2626] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? 'Réinitialisation…' : 'Confirmer le reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
