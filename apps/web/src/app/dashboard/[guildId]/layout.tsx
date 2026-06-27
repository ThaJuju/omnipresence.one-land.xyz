import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import SetupLanguageModal from '@/components/SetupLanguageModal'
import { getLocale } from '@/i18n/server'
import { getT } from '@/i18n/translations'

export default async function GuildLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { guildId: string }
}) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params

  const member = await prisma.member.findUnique({
    where: {
      guildId_discordUserId: {
        guildId,
        discordUserId: session.user.discordId,
      },
    },
    include: {
      guild: {
        include: { config: true },
      },
    },
  })

  if (!member || !member.guild.isActive || member.guild.isBanned) {
    redirect('/dashboard')
  }

  const locale = getLocale()
  const tr = getT(locale)

  if (member.panelRole === 'MEMBRE') {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">🚫</div>
          <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--text)' }}>{tr.dashboard.accessDenied}</h1>
          <p style={{ color: 'var(--text-2)' }}>{tr.dashboard.accessDeniedDesc}</p>
        </div>
      </main>
    )
  }

  const accentColor = member.guild.config?.accentColor ?? '#6366f1'
  const needsSetup = !member.guild.config

  async function setupLanguage(lang: string) {
    'use server'
    await prisma.guildConfig.upsert({
      where: { guildId },
      update: { botLanguage: lang },
      create: { guildId, botLanguage: lang },
    })
    revalidatePath(`/dashboard/${guildId}`, 'layout')
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)', '--guild-accent': accentColor } as React.CSSProperties}>
      {needsSetup && <SetupLanguageModal setupAction={setupLanguage} />}
      <Sidebar guild={member.guild} member={member} locale={locale} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header guild={member.guild} member={member} session={session} locale={locale} />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
