import Link from 'next/link'
import { auth } from '@/lib/auth'
import { CheckSquare, Users, BarChart3 } from 'lucide-react'

const DISCORD_PATH = 'M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037 19.736 19.736 0 00-4.885 1.515.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.054a19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.077.077 0 00-.041-.107 13.1 13.1 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z'

const FEATURES = [
  { icon: CheckSquare, title: 'Présences', desc: 'Suivi automatique via boutons Discord. Avertissements automatiques pour les absences non déclarées.' },
  { icon: Users, title: 'Membres', desc: 'Gestion des grades, historique, cotisations. Synchronisation automatique avec les rôles Discord.' },
  { icon: BarChart3, title: 'Statistiques', desc: 'Dashboard complet, exports PDF/Excel, comptabilité intégrée.' },
]

export default async function LandingPage() {
  const session = await auth()

  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Hero glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 900,
          height: 560,
          top: '-180px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(closest-side, var(--accent-dim), transparent)',
          filter: 'blur(24px)',
        }}
      />

      <nav
        className="px-6 h-14 flex items-center justify-between sticky top-0 z-10"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--glass)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent-grad)', boxShadow: '0 4px 12px -4px var(--accent-soft)' }}
          >
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d={DISCORD_PATH} />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>Discord Panel</span>
        </div>
        <div>
          <Link
            href={session ? '/dashboard' : '/auth/signin'}
            className="btn-primary px-4 py-2 text-sm inline-block"
          >
            {session ? 'Accéder au panel' : 'Se connecter'}
          </Link>
        </div>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center relative">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8 animate-float-in"
          style={{
            background: 'var(--accent-grad)',
            boxShadow: '0 12px 40px -10px var(--accent-soft), inset 0 1px 0 rgba(255,255,255,0.25)',
          }}
        >
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d={DISCORD_PATH} />
          </svg>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-5 tracking-tight text-gradient max-w-2xl leading-[1.1]">
          Gérez votre serveur Discord
        </h1>
        <p className="text-lg max-w-xl mb-10 leading-relaxed" style={{ color: 'var(--text-2)' }}>
          Un panel complet pour gérer les présences, absences, membres, grades, cotisations et bien plus — directement depuis votre navigateur.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <a
            href={`https://discord.com/api/oauth2/authorize?client_id=${process.env['DISCORD_CLIENT_ID']}&permissions=268585984&scope=bot%20applications.commands`}
            className="btn-primary px-6 py-3 text-sm inline-block"
          >
            Inviter le bot
          </a>
          <Link href="/auth/signin" className="btn-ghost px-6 py-3 text-sm inline-block">
            Se connecter
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card card-hover p-5 text-left">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
              >
                <Icon size={18} strokeWidth={2} />
              </div>
              <h3 className="font-semibold text-sm mb-1.5 tracking-tight" style={{ color: 'var(--text)' }}>{title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
