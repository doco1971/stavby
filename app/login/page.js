'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

export default function LoginPage() {
  const [email, setEmail]   = useState('')
  const [pass, setPass]     = useState('')
  const [err, setErr]       = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handle = async () => {
    if (!email || !pass) { setErr('Vyplňte email a heslo'); return }
    setLoading(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) { setErr('Nesprávný email nebo heslo'); setLoading(false) }
    else router.push('/dashboard')
  }

  const inputSx = {
    width: '100%', padding: '11px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8, color: '#fff', fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
    fontFamily: "'Segoe UI',sans-serif",
    transition: 'border-color 0.2s',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#0f2027 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI',sans-serif",
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: '48px 40px', width: 400,
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        {/* LOGO */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <svg width="72" height="72" viewBox="0 0 80 80" fill="none" style={{ display: 'block', margin: '0 auto 14px' }}>
            <defs>
              <radialGradient id="lgbg" cx="50%" cy="35%" r="70%">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#0f172a" />
              </radialGradient>
            </defs>
            <circle cx="40" cy="40" r="38" fill="url(#lgbg)" stroke="#2563eb" strokeWidth="1.5" strokeOpacity="0.5" />
            <polygon points="47,10 30,42 40,42 33,68 52,36 42,36" fill="#facc15" />
            <circle cx="18" cy="24" r="2.2" fill="#facc15" opacity="0.55" />
            <circle cx="62" cy="22" r="1.8" fill="#facc15" opacity="0.45" />
            <circle cx="65" cy="56" r="2"   fill="#facc15" opacity="0.4"  />
            <circle cx="15" cy="58" r="1.6" fill="#facc15" opacity="0.5"  />
          </svg>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: 0 }}>Kalkulace staveb</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', margin: '6px 0 0', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' }}>EG.D · Třebíč</p>
        </div>

        {/* FORM */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, marginBottom: 5, textTransform: 'uppercase' }}>Email</div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handle()}
            placeholder="vas@email.cz" style={inputSx}
            onFocus={e => e.target.style.borderColor = 'rgba(96,165,250,0.6)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
          />
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, marginBottom: 5, textTransform: 'uppercase' }}>Heslo</div>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handle()}
            placeholder="••••••••" style={inputSx}
            onFocus={e => e.target.style.borderColor = 'rgba(96,165,250,0.6)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
          />
        </div>

        {err && (
          <div style={{ color: '#f87171', fontSize: 13, marginBottom: 16, textAlign: 'center',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, padding: '8px 12px' }}>
            ⚠️ {err}
          </div>
        )}

        <button onClick={handle} disabled={loading} style={{
          width: '100%', padding: 14,
          background: loading ? 'rgba(37,99,235,0.5)' : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
          border: 'none', borderRadius: 10, color: '#fff',
          fontSize: 15, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
          transition: 'opacity 0.2s', letterSpacing: 0.3,
        }}>
          {loading ? 'Přihlašuji…' : 'Přihlásit se →'}
        </button>
      </div>
    </div>
  )
}
