'use client'

import { useState, useTransition } from 'react'
import { getT, type Locale } from '@/i18n/translations'

export default function PublishAbsenceButton({
  publishAction,
  disabled,
  locale = 'fr',
}: {
  publishAction: () => Promise<{ success: boolean; error?: string }>
  disabled: boolean
  locale?: Locale
}) {
  const ae = getT(locale).settingsAbsenceEmbed
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null)

  function handleClick() {
    setResult(null)
    startTransition(async () => {
      const r = await publishAction()
      setResult(r)
    })
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isPending}
        className="px-4 py-2 btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isPending ? (
          <>
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            {ae.publishing}
          </>
        ) : (
          ae.publishBtn
        )}
      </button>
      {result && (
        <span className={`text-xs font-medium ${result.success ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
          {result.success ? ae.publishSuccess : `✗ ${result.error}`}
        </span>
      )}
      {disabled && !result && (
        <span className="text-xs text-[var(--text-3)]">{ae.selectChannelFirst}</span>
      )}
    </div>
  )
}
