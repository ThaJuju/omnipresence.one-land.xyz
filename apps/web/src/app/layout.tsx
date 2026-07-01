import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Discord Panel',
  description: 'Plateforme de gestion Discord multi-tenant',
}

const themeInit = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(t);}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="app-ambient">{children}</body>
    </html>
  )
}
