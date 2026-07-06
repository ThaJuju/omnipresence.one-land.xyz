import Link from 'next/link'
import { auth } from '@/lib/auth'
import {
  CheckSquare, Users, CalendarX, AlertTriangle, Wallet, BookOpen,
  Sparkles, ArrowRight, Bot, Settings2, LayoutDashboard, Bell,
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { getLocale } from '@/i18n/server'
import { getT } from '@/i18n/translations'

const DISCORD_PATH = 'M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037 19.736 19.736 0 00-4.885 1.515.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.054a19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.077.077 0 00-.041-.107 13.1 13.1 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z'

const FEATURE_ICONS = [CheckSquare, CalendarX, AlertTriangle, Users, Wallet, BookOpen]
const STEP_ICONS = [Bot, Settings2, LayoutDashboard]

export default async function LandingPage() {
  const session = await auth()
  const l = getT(getLocale()).landing
  const MODULES = l.modules
  const FEATURES = l.features.map((f, i) => ({ icon: FEATURE_ICONS[i]!, title: f.title, desc: f.desc, big: i === 0 }))
  const STEPS = l.steps.map((st, i) => ({ icon: STEP_ICONS[i]!, title: st.title, desc: st.desc }))
  const primaryHref = session ? '/dashboard' : '/auth/signin'
  const primaryLabel = session ? l.accessPanel : l.signIn
  const inviteHref = `https://discord.com/api/oauth2/authorize?client_id=${process.env['DISCORD_CLIENT_ID']}&permissions=268585984&scope=bot%20applications.commands`

  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Ambient glows */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 1000, height: 620, top: '-220px', left: '50%', transform: 'translateX(-50%)',
          background: 'radial-gradient(closest-side, var(--accent-dim), transparent)', filter: 'blur(24px)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          width: 500, height: 500, top: '380px', right: '-160px',
          background: 'radial-gradient(closest-side, color-mix(in srgb, #a855f7 10%, transparent), transparent)', filter: 'blur(32px)',
        }}
      />

      {/* Nav */}
      <nav
        className="px-6 h-14 flex items-center justify-between sticky top-0 z-20"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--glass)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent-grad)', boxShadow: '0 4px 12px -4px var(--accent-soft)' }}>
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d={DISCORD_PATH} /></svg>
          </div>
          <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>OmniPresence</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Link href={primaryHref} className="btn-primary px-4 py-2 text-sm inline-block ml-1">{primaryLabel}</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-16 pb-24 flex flex-col items-center text-center relative">
        <div
          className="badge mb-6 animate-fade-in"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)', padding: '6px 14px', fontSize: 12 }}
        >
          <Sparkles size={13} /> {l.badge}
        </div>

        <h1 className="text-4xl md:text-6xl font-bold mb-5 tracking-tight max-w-3xl leading-[1.08]" style={{ color: 'var(--text)' }}>
          {l.heroTitle} <span className="text-gradient">{l.heroTitleAccent}</span>
        </h1>
        <p className="text-lg max-w-xl mb-9 leading-relaxed" style={{ color: 'var(--text-2)' }}>
          {l.heroSubtitle}
        </p>

        <div className="flex flex-wrap justify-center gap-3 mb-16">
          <a href={inviteHref} className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2">
            {l.inviteBot} <ArrowRight size={15} />
          </a>
          <Link href={primaryHref} className="btn-ghost px-6 py-3 text-sm inline-block">{primaryLabel}</Link>
        </div>

        {/* Dashboard mockup */}
        <div className="w-full max-w-4xl relative animate-float-in" style={{ perspective: 1400 }}>
          <div
            className="rounded-2xl overflow-hidden text-left mx-auto"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-pop), 0 0 80px -20px var(--accent-soft)',
              transform: 'rotateX(3deg)',
            }}
          >
            {/* window chrome */}
            <div className="flex items-center gap-1.5 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--danger)', opacity: 0.6 }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--warning)', opacity: 0.6 }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--success)', opacity: 0.6 }} />
            </div>

            <div className="flex" style={{ minHeight: 300 }}>
              {/* fake sidebar */}
              <div className="hidden sm:block w-40 shrink-0 p-3 space-y-1" style={{ borderRight: '1px solid var(--border)' }}>
                {l.mockNav.map((label, i) => ({ label, active: i === 0 })).map((item) => (
                  <div
                    key={item.label}
                    className="rounded-md px-2.5 py-1.5 text-xs font-medium"
                    style={item.active
                      ? { background: 'var(--accent-dim)', color: 'var(--accent)' }
                      : { color: 'var(--text-3)' }
                    }
                  >
                    {item.label}
                  </div>
                ))}
              </div>

              {/* fake main content */}
              <div className="flex-1 p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: l.mockStats[0]!, value: '128', color: 'var(--accent)' },
                    { label: l.mockStats[1]!, value: '94', color: 'var(--success)' },
                    { label: l.mockStats[2]!, value: '3', color: 'var(--warning)' },
                  ].map((stat) => (
                    <div key={stat.label} className="card p-3">
                      <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-3)' }}>{stat.label}</p>
                      <p className="text-xl font-bold tabular-nums" style={{ color: stat.color }}>{stat.value}</p>
                      <div className="flex items-end gap-0.5 h-4 mt-2">
                        {[40, 65, 50, 80, 60, 90, 70].map((h, i) => (
                          <span key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: `color-mix(in srgb, ${stat.color} 45%, transparent)` }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="card p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Bell size={12} style={{ color: 'var(--text-3)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{l.mockActivity}</span>
                  </div>
                  {l.mockActivityLines.map((line) => (
                    <div key={line} className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-2)' }}>
                      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modules strip */}
      <section className="px-6 pb-20">
        <p className="text-center text-xs font-medium uppercase tracking-wider mb-5" style={{ color: 'var(--text-3)' }}>
          {l.modulesStrip}
        </p>
        <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
          {MODULES.map((m) => (
            <span key={m} className="badge" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)', padding: '6px 12px' }}>
              {m}
            </span>
          ))}
        </div>
      </section>

      {/* Feature bento grid */}
      <section className="px-6 pb-24 max-w-5xl mx-auto w-full">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3" style={{ color: 'var(--text)' }}>
            {l.featuresTitle}
          </h2>
          <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--text-2)' }}>
            {l.featuresSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc, big }) => (
            <div key={title} className={`card card-hover p-6 ${big ? 'md:col-span-2' : ''}`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                <Icon size={19} strokeWidth={2} />
              </div>
              <h3 className="font-semibold text-base mb-2 tracking-tight" style={{ color: 'var(--text)' }}>{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-24 max-w-4xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
            {l.stepsTitle}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-6 left-[16%] right-[16%] h-px" style={{ background: 'var(--border)' }} />
          {STEPS.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="relative text-center flex flex-col items-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-4 relative z-10"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-mid)', color: 'var(--accent)', boxShadow: 'var(--shadow-sm)' }}
              >
                <Icon size={20} strokeWidth={1.8} />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-3)' }}>{l.stepLabel(i + 1)}</p>
              <h3 className="font-semibold text-sm mb-2 tracking-tight" style={{ color: 'var(--text)' }}>{title}</h3>
              <p className="text-xs leading-relaxed max-w-[220px]" style={{ color: 'var(--text-2)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="px-6 pb-20 max-w-4xl mx-auto w-full">
        <div
          className="rounded-2xl p-10 md:p-14 text-center relative overflow-hidden"
          style={{ background: 'var(--accent-grad)', boxShadow: '0 24px 60px -20px var(--accent-soft)' }}
        >
          <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 30% 20%, white, transparent 60%)' }} />
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-3 relative">
            {l.ctaTitle}
          </h2>
          <p className="text-sm text-white/85 mb-8 relative max-w-md mx-auto">
            {l.ctaSubtitle}
          </p>
          <a
            href={inviteHref}
            className="relative inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-transform hover:scale-[1.03]"
            style={{ background: 'white', color: 'var(--accent)' }}
          >
            {l.inviteBot} <ArrowRight size={15} />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-5xl mx-auto w-full" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: 'var(--accent-grad)' }}>
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d={DISCORD_PATH} /></svg>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>© {new Date().getFullYear()} OmniPresence</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href={primaryHref} className="text-xs transition-colors hover:opacity-80" style={{ color: 'var(--text-2)' }}>{primaryLabel}</Link>
          <a href={inviteHref} className="text-xs transition-colors hover:opacity-80" style={{ color: 'var(--text-2)' }}>{l.inviteBot}</a>
        </div>
      </footer>
    </main>
  )
}
