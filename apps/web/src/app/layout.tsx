import type { Metadata } from 'next'
import './globals.css'
import { getLocale } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const locale = getLocale()
  return locale === 'en'
    ? {
        title: 'OmniPresence — Manage your community effortlessly',
        description: 'Presences, absences, members, contributions and accounting: the all-in-one panel connected to your Discord server.',
      }
    : {
        title: 'OmniPresence — Gérez votre communauté sans effort',
        description: 'Présences, absences, membres, cotisations et comptabilité : le panel tout-en-un connecté à votre serveur Discord.',
      }
}

const themeInit = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(t);}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale()
  return (
    <html lang={locale} className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="app-ambient">{children}</body>
    </html>
  )
}
