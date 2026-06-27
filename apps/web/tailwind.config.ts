import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0a0f',
          secondary: '#111118',
          card: '#16161f',
          hover: '#1e1e2a',
        },
        border: {
          DEFAULT: '#2a2a3a',
        },
        accent: {
          DEFAULT: '#5865F2',
          hover: '#4752c4',
        },
        text: {
          primary: '#f0f0ff',
          secondary: '#8888aa',
          muted: '#555577',
        },
        success: '#23d160',
        warning: '#ffdd57',
        danger: '#ff3860',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
    },
  },
  plugins: [],
}

export default config
