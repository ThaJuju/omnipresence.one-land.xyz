import Link from 'next/link'
import { auth } from '@/lib/auth'

export default async function LandingPage() {
  const session = await auth()

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <nav
        className="px-6 h-12 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--guild-accent), #8b5cf6)' }}
          >
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037 19.736 19.736 0 00-4.885 1.515.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.054a19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.077.077 0 00-.041-.107 13.1 13.1 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
            </svg>
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Discord Panel</span>
        </div>
        <div>
          {session ? (
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-80"
              style={{ background: 'var(--accent)' }}
            >
              Accéder au panel
            </Link>
          ) : (
            <Link
              href="/auth/signin"
              className="px-3 py-1.5 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-80"
              style={{ background: 'var(--accent)' }}
            >
              Se connecter
            </Link>
          )}
        </div>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center mb-8"
          style={{ background: 'linear-gradient(135deg, var(--guild-accent), #8b5cf6)' }}
        >
          <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037 19.736 19.736 0 00-4.885 1.515.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.054a19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.077.077 0 00-.041-.107 13.1 13.1 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
          </svg>
        </div>

        <h1 className="text-4xl font-bold mb-4 tracking-tight" style={{ color: 'var(--text)' }}>
          Gérez votre serveur Discord
        </h1>
        <p className="text-lg max-w-xl mb-10" style={{ color: 'var(--text-2)' }}>
          Un panel complet pour gérer les présences, absences, membres, grades, cotisations et bien plus — directement depuis votre navigateur.
        </p>

        <div className="flex gap-3">
          <a
            href={`https://discord.com/api/oauth2/authorize?client_id=${process.env['DISCORD_CLIENT_ID']}&permissions=268585984&scope=bot%20applications.commands`}
            className="px-5 py-2.5 rounded-md font-medium text-sm text-white transition-opacity hover:opacity-80"
            style={{ background: 'var(--accent)' }}
          >
            Inviter le bot
          </a>
          <Link
            href="/auth/signin"
            className="px-5 py-2.5 rounded-md font-medium text-sm transition-colors hover:bg-white/[0.04]"
            style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}
          >
            Se connecter
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full">
          {[
            { icon: '✅', title: 'Présences', desc: 'Suivi automatique via boutons Discord. Avertissements automatiques pour les absences non déclarées.' },
            { icon: '👥', title: 'Membres', desc: 'Gestion des grades, historique, cotisations. Synchronisation automatique avec les rôles Discord.' },
            { icon: '📊', title: 'Statistiques', desc: 'Dashboard complet, exports PDF/Excel, comptabilité intégrée.' },
          ].map((feature) => (
            <div
              key={feature.title}
              className="p-5 rounded-md text-left"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="text-2xl mb-3">{feature.icon}</div>
              <h3 className="font-semibold text-sm mb-1.5" style={{ color: 'var(--text)' }}>{feature.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
