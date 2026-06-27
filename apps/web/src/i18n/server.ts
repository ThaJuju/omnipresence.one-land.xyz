import { cookies } from 'next/headers'
import type { Locale } from './translations'

export function getLocale(): Locale {
  return (cookies().get('panel-locale')?.value as Locale) ?? 'fr'
}
