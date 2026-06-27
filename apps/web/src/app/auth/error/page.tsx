import Link from 'next/link'

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const errorMessages: Record<string, string> = {
    OAuthSignin: 'Erreur lors de la connexion OAuth.',
    OAuthCallback: 'Erreur lors du callback OAuth.',
    OAuthCreateAccount: 'Impossible de créer un compte.',
    default: 'Une erreur est survenue lors de la connexion.',
  }

  const message = errorMessages[searchParams.error ?? 'default'] ?? errorMessages['default']

  return (
    <main className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-[var(--text)] mb-2">Erreur de connexion</h1>
        <p className="text-[var(--text-2)] mb-6">{message}</p>
        <Link
          href="/auth/signin"
          className="inline-block px-6 py-3 bg-[var(--accent)] text-white rounded-lg font-medium hover:opacity-80 hover:bg-[var(--accent)] transition-colors"
        >
          Réessayer
        </Link>
      </div>
    </main>
  )
}
