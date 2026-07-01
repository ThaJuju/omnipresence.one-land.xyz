'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import type { Locale } from '@/i18n/translations'

export default function LanguageSwitcherSettings({
  locale,
  saveAction,
}: {
  locale: Locale
  saveAction: (locale: Locale) => Promise<void>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const apply = (next: Locale) => {
    document.cookie = `panel-locale=${next};path=/;max-age=31536000;SameSite=Lax`
    startTransition(async () => {
      await saveAction(next)
      router.refresh()
    })
  }

  return (
    <div className="flex gap-2">
      {(['fr', 'en'] as Locale[]).map((l) => (
        <button
          key={l}
          onClick={() => apply(l)}
          disabled={isPending}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
            locale === l
              ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
              : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--border-mid)]'
          }`}
        >
          {l === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
        </button>
      ))}
    </div>
  )
}
