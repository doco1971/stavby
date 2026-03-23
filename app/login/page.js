'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

const ADMIN_UUID = 'c905118b-e578-497d-ab4e-077477f445ae'

export default function LoginPage() {
  const [email, setEmail]   = useState('')
  const [pass, setPass]     = useState('')
  const [err, setErr]       = useState('')
  const [loading, setLoading] = useState(false)
  const [appInfo, setAppInfo] = useState({ verze: '', datum: '', autor: 'M. Dočekal' })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('profiles').select('app_info').eq('id', ADMIN_UUID).single()
      .then(({ data }) => { if (data?.app_info) setAppInfo(prev => ({ ...prev, ...data.app_info })) })
  }, [])

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
          <svg width="72" height="72" viewBox="0 0 80 80" fill="none" style={{ display: 'block', margin: '0 auto 16px' }}>
            <defs>
              <radialGradient id="lgbg" cx="50%" cy="35%" r="70%">
                <stop offset="0%" stopColor="#1d4ed8" />
                <stop offset="100%" stopColor="#0f172a" />
              </radialGradient>
            </defs>
            <circle cx="40" cy="40" r="38" fill="url(#lgbg)" stroke="#2563eb" strokeWidth="1.5" strokeOpacity="0.6" />
            {/* Stylizované "R" ze sloupců rozboru */}
            <rect x="22" y="16" width="7" height="48" rx="2" fill="#facc15" opacity="0.9" />
            <rect x="22" y="16" width="26" height="7" rx="2" fill="#facc15" opacity="0.9" />
            <rect x="22" y="33" width="22" height="7" rx="2" fill="#facc15" opacity="0.9" />
            <rect x="38" y="40" width="7" height="24" rx="2" fill="#facc15" opacity="0.75" transform="rotate(30 38 40)" />
            {/* Sloupce grafu vpravo */}
            <rect x="56" y="44" width="6" height="20" rx="1.5" fill="#3b82f6" opacity="0.6" />
            <rect x="64" y="34" width="6" height="30" rx="1.5" fill="#3b82f6" opacity="0.4" />
          </svg>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 900, margin: '0 0 6px', letterSpacing: -0.5 }}>Rozbor staveb</h1>
          <p style={{ color: '#facc15', margin: '0 0 4px', fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>ZMES s.r.o.</p>
          <p style={{ color: 'rgba(255,255,255,0.35)', margin: 0, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>Jihlava · Třebíč · Znojmo</p>
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

        {/* VERZE + AUTOR */}
        <div style={{ marginTop: 24, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 16 }}>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, letterSpacing: 0.5 }}>
            {appInfo.verze && <span>{appInfo.verze}{appInfo.datum ? ` · ${appInfo.datum}` : ''} · </span>}
            © {appInfo.autor || 'M. Dočekal'}
          </div>
        </div>
      </div>
    </div>
  )
}
