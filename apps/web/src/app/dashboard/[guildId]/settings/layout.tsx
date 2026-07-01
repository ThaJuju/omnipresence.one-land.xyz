import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SettingsNav from './_components/SettingsNav'
import { getLocale } from '@/i18n/server'
import { getT } from '@/i18n/translations'

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { guildId: string }
}) {
  const session = await auth()
  if (!session?.user?.discordId) redirect('/auth/signin')

  const { guildId } = params
  const locale = getLocale()
  const tr = getT(locale)

  const [guild, config] = await Promise.all([
    prisma.guildInstance.findUnique({ where: { id: guildId }, select: { discordGuildName: true } }),
    prisma.guildConfig.findUnique({
      where: { guildId },
      select: {
        warningEnabled: true,
        presenceEnabled: true,
        contributionEnabled: true,
        accountingEnabled: true,
        vdaEnabled: true,
        absenceEnabled: true,
      },
    }),
  ])
  if (!guild) redirect('/dashboard')

  const modules = {
    warningEnabled: config?.warningEnabled ?? true,
    presenceEnabled: config?.presenceEnabled ?? true,
    contributionEnabled: config?.contributionEnabled ?? true,
    accountingEnabled: config?.accountingEnabled ?? true,
    vdaEnabled: config?.vdaEnabled ?? false,
    absenceEnabled: config?.absenceEnabled ?? true,
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/dashboard/${guildId}`}
          className="inline-flex items-center gap-1 text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors mb-1"
        >
          ← {guild.discordGuildName}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{tr.settings.title}</h1>
      </div>

      <SettingsNav guildId={guildId} modules={modules} locale={locale} />

      <div className="min-w-0 space-y-6">
        {children}
      </div>
    </div>
  )
}
