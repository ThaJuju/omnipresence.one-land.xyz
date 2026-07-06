import { signIn } from '@/lib/auth'
import { getLocale } from '@/i18n/server'
import { getT } from '@/i18n/translations'

const DISCORD_PATH = 'M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037 19.736 19.736 0 00-4.885 1.515.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.054a19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.077.077 0 00-.041-.107 13.1 13.1 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z'

export default function SignInPage() {
  const si = getT(getLocale()).signin
  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Ambient glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 720,
          height: 480,
          top: '-140px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(closest-side, var(--accent-dim), transparent)',
          filter: 'blur(20px)',
        }}
      />

      <div className="w-full max-w-sm relative animate-float-in">
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-5"
            style={{
              background: 'var(--accent-grad)',
              boxShadow: '0 8px 32px -8px var(--accent-soft), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}
          >
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d={DISCORD_PATH} />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient">{si.title}</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-2)' }}>
            {si.subtitle}
          </p>
        </div>

        <div className="card p-6">
          <form
            action={async () => {
              'use server'
              await signIn('discord', { redirectTo: '/dashboard' })
            }}
          >
            <button
              type="submit"
              className="btn-primary w-full flex items-center justify-center gap-2.5 px-4 py-3 text-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d={DISCORD_PATH} />
              </svg>
              {si.continueWithDiscord}
            </button>
          </form>
          <p className="text-[11px] text-center mt-4" style={{ color: 'var(--text-3)' }}>
            {si.privacyNote}
          </p>
        </div>
      </div>
    </main>
  )
}
