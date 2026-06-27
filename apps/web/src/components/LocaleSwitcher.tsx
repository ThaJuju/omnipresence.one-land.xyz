'use client'

import { useRouter } from 'next/navigation'
import type { Locale } from '@/i18n/translations'

export default function LocaleSwitcher({ locale, variant = 'header' }: { locale: Locale; variant?: 'header' | 'settings' }) {
  const router = useRouter()

  const setLocale = (next: Locale) => {
    document.cookie = `panel-locale=${next};path=/;max-age=31536000;SameSite=Lax`
    router.refresh()
  }

  if (variant === 'settings') {
    return (
      <div className="flex gap-2">
        {(['fr', 'en'] as Locale[]).map((l) => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              locale === l
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                : 'bg-[var(--bg)] border-white/[0.07] text-[var(--text-2)] hover:text-[var(--text)] hover:border-white/[0.12]'
            }`}
          >
            {l === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
          </button>
        ))}
      </div>
    )
  }

  const toggle = () => setLocale(locale === 'fr' ? 'en' : 'fr')

  return (
    <button
      onClick={toggle}
      title={locale === 'fr' ? 'Switch to English' : 'Passer en français'}
      className="flex items-center gap-1 text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.03]"
    >
      {locale === 'fr' ? '🇫🇷' : '🇬🇧'}
      <span className="hidden sm:inline">{locale.toUpperCase()}</span>
    </button>
  )
}
