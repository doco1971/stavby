'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { useTheme } from '../layout'

export default function LoginPage() {
  const { dark, toggle, T } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const login = async () => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Nesprávný email nebo heslo'); setLoading(false) }
    else router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: '40px 36px', width: 360, boxShadow: dark ? '0 20px 60px rgba(0,0,0,0.5)' : '0 8px 40px rgba(0,0,0,0.08)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 12px' }}>🏗️</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Kalkulace stavby</div>
          <div style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>Jihomoravský region</div>
        </div>

        {/* Formulář */}
        {[
          { label: 'Email', value: email, set: setEmail, type: 'email' },
          { label: 'Heslo', value: password, set: setPassword, type: 'password' },
        ].map(({ label, value, set, type }) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
            <input
              type={type}
              value={value}
              onChange={e => set(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              style={{ width: '100%', padding: '10px 12px', background: dark ? 'rgba(255,255,255,0.05)' : '#f8fafc', border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        ))}

        {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>⚠ {error}</div>}

        <button onClick={login} disabled={loading}
          style={{ width: '100%', padding: '11px', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Přihlašování…' : 'Přihlásit se'}
        </button>

        {/* Přepínač světlý/tmavý */}
        <button onClick={toggle} style={{ width: '100%', marginTop: 12, padding: '8px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8, color: T.muted, fontSize: 12, cursor: 'pointer' }}>
          {dark ? '☀️ Přepnout na denní režim' : '🌙 Přepnout na noční režim'}
        </button>
      </div>
    </div>
  )
}
