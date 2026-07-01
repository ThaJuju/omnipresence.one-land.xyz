'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('light') ? 'light' : 'dark')
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(next)
    try {
      localStorage.setItem('theme', next)
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
      className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--hover)] transition-colors cursor-pointer"
      style={{ color: 'var(--text-3)' }}
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  )
}
