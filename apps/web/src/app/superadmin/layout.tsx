import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getSuperAdminAccess } from '@/lib/superadmin-access'
import ThemeToggle from '@/components/ThemeToggle'
import { Zap } from 'lucide-react'

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user?.discordId) redirect('/auth/signin')
  const access = await getSuperAdminAccess(session.user.discordId)
  if (!access) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <nav
        className="px-6 py-3 flex items-center gap-1 sticky top-0 z-20"
        style={{
          background: 'var(--glass)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span className="flex items-center gap-1.5 text-[var(--danger)] font-bold text-sm tracking-tight mr-3">
          <Zap size={15} fill="currentColor" /> SUPERADMIN
        </span>
        <a href="/superadmin" className="text-sm px-2.5 py-1.5 rounded-md text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors">Dashboard</a>
        <a href="/superadmin/instances" className="text-sm px-2.5 py-1.5 rounded-md text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors">Instances</a>
        <a href="/superadmin/stats" className="text-sm px-2.5 py-1.5 rounded-md text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors">Stats</a>
        {access.isDev && (
          <>
            <a href="/superadmin/groups" className="text-sm px-2.5 py-1.5 rounded-md text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors">Groupes</a>
            <a href="/superadmin/bot" className="text-sm px-2.5 py-1.5 rounded-md text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors">Bot</a>
          </>
        )}
        {!access.isDev && (
          <span className="badge ml-2" style={{ background: 'color-mix(in srgb, var(--warning) 12%, transparent)', color: 'var(--warning)' }}>
            Accès limité — {access.guildIds.length} serveur{access.guildIds.length !== 1 ? 's' : ''}
          </span>
        )}
        <div className="flex-1" />
        <ThemeToggle />
        <a href="/dashboard" className="text-xs px-2.5 py-1.5 rounded-md text-[var(--text-3)] hover:text-[var(--text-2)] hover:bg-[var(--hover)] transition-colors">← Panel normal</a>
      </nav>
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </div>
  )
}
