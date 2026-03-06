'use client'
import { useState, useEffect, createContext, useContext } from 'react'

const ThemeCtx = createContext({ dark: true, toggle: () => {} })
export const useTheme = () => useContext(ThemeCtx)

export default function RootLayout({ children }) {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved) setDark(saved === 'dark')
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  const T = dark ? {
    bg: '#080f1c', card: '#0d1829', border: '#1e2d45',
    text: '#e2e8f0', muted: '#64748b', accent: '#3b82f6',
    header: '#0a1520',
  } : {
    bg: '#f1f5f9', card: '#ffffff', border: '#e2e8f0',
    text: '#1e293b', muted: '#94a3b8', accent: '#2563eb',
    header: '#ffffff',
  }

  return (
    <html lang="cs">
      <head>
        <title>Kalkulace stavby</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, background: T.bg, color: T.text, fontFamily: 'system-ui,sans-serif', minHeight: '100vh', transition: 'background 0.2s, color 0.2s' }}>
        <ThemeCtx.Provider value={{ dark, toggle, T }}>
          {children}
        </ThemeCtx.Provider>
      </body>
    </html>
  )
}
