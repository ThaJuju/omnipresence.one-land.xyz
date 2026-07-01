import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getSuperAdminAccess } from '@/lib/superadmin-access'

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user?.discordId) redirect('/auth/signin')
  const access = await getSuperAdminAccess(session.user.discordId)
  if (!access) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <nav className="border-b border-white/[0.07] bg-[var(--bg)] px-6 py-3 flex items-center gap-4">
        <span className="text-[#ef4444] font-bold text-sm">⚡ SUPERADMIN</span>
        <a href="/superadmin" className="text-sm text-[var(--text-2)] hover:text-[var(--text)]">Dashboard</a>
        <a href="/superadmin/instances" className="text-sm text-[var(--text-2)] hover:text-[var(--text)]">Instances</a>
        <a href="/superadmin/stats" className="text-sm text-[var(--text-2)] hover:text-[var(--text)]">Stats</a>
        {access.isDev && (
          <a href="/superadmin/groups" className="text-sm text-[var(--text-2)] hover:text-[var(--text)]">Groupes</a>
        )}
        {!access.isDev && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#eab30820] text-[#eab308] font-medium">
            Accès limité — {access.guildIds.length} serveur{access.guildIds.length !== 1 ? 's' : ''}
          </span>
        )}
        <div className="flex-1" />
        <a href="/dashboard" className="text-xs text-[var(--text-3)] hover:text-[var(--text-2)]">← Panel normal</a>
      </nav>
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </div>
  )
}
