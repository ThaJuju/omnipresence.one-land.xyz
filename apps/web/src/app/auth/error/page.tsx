import Link from 'next/link'
import { getLocale } from '@/i18n/server'
import { getT } from '@/i18n/translations'

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const ae = getT(getLocale()).authError
  const message = ae.errors[searchParams.error ?? 'default'] ?? ae.errors['default']

  return (
    <main className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] mb-2">{ae.title}</h1>
        <p className="text-[var(--text-2)] mb-6">{message}</p>
        <Link
          href="/auth/signin"
          className="inline-block px-6 py-3 btn-primary font-medium"
        >
          {ae.tryAgain}
        </Link>
      </div>
    </main>
  )
}
