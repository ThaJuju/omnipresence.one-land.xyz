'use server'

import { prisma } from '@repo/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { getSuperAdminAccess } from '@/lib/superadmin-access'
import { botClient, type BotProfile } from '@/lib/bot-client'
import { Bot } from 'lucide-react'

async function saveBotProfile(formData: FormData) {
  'use server'
  const session = await auth()
  const access = await getSuperAdminAccess(session?.user?.discordId)
  if (!access?.isDev) return

  const description = ((formData.get('description') as string) ?? '').trim()
  const customStatus = ((formData.get('customStatus') as string) ?? '').trim()

  try {
    await botClient.setBotProfile({
      description: description || null,
      customStatus: customStatus || null,
    })
  } catch {
    redirect('/superadmin/bot?error=1')
  }
  revalidatePath('/superadmin/bot')
  redirect('/superadmin/bot?saved=1')
}

export default async function BotProfilePage({
  searchParams,
}: {
  searchParams: { saved?: string; error?: string }
}) {
  const session = await auth()
  const access = await getSuperAdminAccess(session?.user?.discordId)
  if (!access) redirect('/dashboard')
  if (!access.isDev) redirect('/superadmin')

  let profile: BotProfile | null = null
  let botOnline = true
  try {
    profile = await botClient.getBotProfile()
  } catch {
    botOnline = false
    const stored = await prisma.botProfile.findUnique({ where: { id: 'default' } })
    profile = {
      username: null,
      avatarUrl: null,
      description: stored?.description ?? null,
      customStatus: stored?.customStatus ?? null,
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        {profile?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt="" className="w-12 h-12 rounded-full" />
        ) : (
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--hover)] text-[var(--text-3)]">
            <Bot size={24} />
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Profil du bot</h1>
          <p className="text-sm text-[var(--text-3)]">
            {profile?.username ? `${profile.username} · ` : ''}Bio et statut affichés sur Discord — global à toutes les instances
          </p>
        </div>
      </div>

      {!botOnline && (
        <div className="card p-4 mb-4 text-sm" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
          Le bot est hors ligne — valeurs affichées depuis la base, sauvegarde impossible pour le moment.
        </div>
      )}
      {searchParams.saved && (
        <div className="card p-4 mb-4 text-sm" style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
          Profil du bot mis à jour.
        </div>
      )}
      {searchParams.error && (
        <div className="card p-4 mb-4 text-sm" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
          Échec de la mise à jour — le bot est probablement hors ligne.
        </div>
      )}

      <form action={saveBotProfile} className="card p-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-[var(--text-2)] mb-1.5">
            Bio (« À propos de moi »)
          </label>
          <textarea
            name="description"
            defaultValue={profile?.description ?? ''}
            maxLength={400}
            rows={5}
            placeholder="Texte affiché dans le profil Discord du bot…"
            className="w-full input px-3 py-2 text-sm"
          />
          <p className="text-xs text-[var(--text-3)] mt-1">
            400 caractères max. La mise à jour côté Discord peut prendre quelques minutes.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-2)] mb-1.5">
            Statut personnalisé
          </label>
          <input
            name="customStatus"
            defaultValue={profile?.customStatus ?? ''}
            maxLength={128}
            placeholder="Texte affiché sous le nom du bot…"
            className="w-full input px-3 py-2 text-sm"
          />
          <p className="text-xs text-[var(--text-3)] mt-1">
            128 caractères max. Laisser vide pour retirer le statut. Restauré automatiquement au redémarrage du bot.
          </p>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={!botOnline}>
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  )
}
