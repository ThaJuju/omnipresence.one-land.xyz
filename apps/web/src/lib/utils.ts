import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function avatarUrl(discordUserId: string, discordAvatar: string | null): string {
  if (!discordAvatar) {
    const defaultIndex = (Number(BigInt(discordUserId) >> 22n) % 6).toString()
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`
  }
  const ext = discordAvatar.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/avatars/${discordUserId}/${discordAvatar}.${ext}`
}

export function guildIconUrl(discordGuildId: string, icon: string | null): string | null {
  if (!icon) return null
  const ext = icon.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/icons/${discordGuildId}/${icon}.${ext}`
}
