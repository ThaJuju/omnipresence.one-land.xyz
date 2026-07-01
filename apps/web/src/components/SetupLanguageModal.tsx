'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function SetupLanguageModal({
  setupAction,
}: {
  setupAction: (lang: string) => Promise<void>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function choose(lang: string) {
    startTransition(async () => {
      await setupAction(lang)
      router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--bg)]/90 backdrop-blur-sm">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">🌐</div>
          <h2 className="text-xl font-bold text-[var(--text)] mb-1">Langue / Language</h2>
          <p className="text-sm text-[var(--text-2)]">
            Choisissez la langue du panel et du bot Discord.
            <br />
            <span className="text-[#5868a8]">Choose the language for the panel and Discord bot.</span>
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => choose('fr')}
            disabled={isPending}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-md bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--hover)] transition-all text-left group disabled:opacity-50"
          >
            <span className="text-2xl">🇫🇷</span>
            <div>
              <p className="text-sm font-semibold text-[var(--text)] group-hover:text-white">Français</p>
              <p className="text-xs text-[var(--text-2)]">Panel et bot en français</p>
            </div>
          </button>

          <button
            onClick={() => choose('en')}
            disabled={isPending}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-md bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--hover)] transition-all text-left group disabled:opacity-50"
          >
            <span className="text-2xl">🇬🇧</span>
            <div>
              <p className="text-sm font-semibold text-[var(--text)] group-hover:text-white">English</p>
              <p className="text-xs text-[var(--text-2)]">Panel and bot in English</p>
            </div>
          </button>
        </div>

        {isPending && (
          <p className="text-center text-xs text-[var(--text-2)] mt-4">Enregistrement…</p>
        )}
      </div>
    </div>
  )
}
