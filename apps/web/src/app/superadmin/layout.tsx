import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user?.discordId) redirect('/auth/signin')
  if (session.user.discordId !== process.env['SUPERADMIN_DISCORD_ID']) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <nav className="border-b border-white/[0.07] bg-[var(--bg)] px-6 py-3 flex items-center gap-4">
        <span className="text-[#ef4444] font-bold text-sm">⚡ SUPERADMIN</span>
        <a href="/superadmin" className="text-sm text-[var(--text-2)] hover:text-[var(--text)]">Dashboard</a>
        <a href="/superadmin/instances" className="text-sm text-[var(--text-2)] hover:text-[var(--text)]">Instances</a>
        <a href="/superadmin/stats" className="text-sm text-[var(--text-2)] hover:text-[var(--text)]">Stats</a>
        <div className="flex-1" />
        <a href="/dashboard" className="text-xs text-[var(--text-3)] hover:text-[var(--text-2)]">← Panel normal</a>
      </nav>
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </div>
  )
}
