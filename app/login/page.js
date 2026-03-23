// Build: 20260323_05
// Login – přihlašovací obrazovka
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'


export default function LoginPage() {
  const [email, setEmail]   = useState('')
  const [pass, setPass]     = useState('')
  const [err, setErr]       = useState('')
  const [loading, setLoading] = useState(false)
  const [appInfo, setAppInfo] = useState({ verze: '', datum: '', autor: 'M. Dočekal' })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('app_settings').select('app_info').single()
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
          <svg width="76" height="76" viewBox="0 0 140 140" fill="none" style={{ display: 'block', margin: '0 auto 16px' }}>
            <circle cx="70" cy="70" r="68" fill="#0f172a"/>
            <circle cx="70" cy="70" r="68" fill="none" stroke="#334155" strokeWidth="1.5"/>
            {/* Analytické sloupce */}
            <rect x="10" y="90" width="13" height="34" rx="2" fill="#0ea5e9" opacity="0.5"/>
            <rect x="27" y="72" width="13" height="52" rx="2" fill="#0ea5e9" opacity="0.55"/>
            <rect x="44" y="58" width="13" height="66" rx="2" fill="#0ea5e9" opacity="0.6"/>
            <rect x="61" y="48" width="13" height="76" rx="2" fill="#38bdf8" opacity="0.7"/>
            <rect x="78" y="60" width="13" height="64" rx="2" fill="#0ea5e9" opacity="0.6"/>
            <rect x="95" y="76" width="13" height="48" rx="2" fill="#0ea5e9" opacity="0.55"/>
            <rect x="112" y="86" width="13" height="38" rx="2" fill="#0ea5e9" opacity="0.5"/>
            {/* Základní linka */}
            <line x1="8" y1="126" x2="127" y2="126" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round"/>
            {/* Trendová linka */}
            <polyline points="16,90 33,72 50,58 67,48 85,60 102,76 119,86" fill="none" stroke="#7dd3fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
            {/* Stožár VN */}
            <line x1="56" y1="124" x2="67" y2="20" stroke="#bae6fd" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="78" y1="124" x2="67" y2="20" stroke="#bae6fd" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="58" y1="100" x2="76" y2="100" stroke="#bae6fd" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="60" y1="80" x2="74" y2="80" stroke="#bae6fd" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="44" y1="36" x2="90" y2="36" stroke="#bae6fd" strokeWidth="2" strokeLinecap="round"/>
            <line x1="50" y1="52" x2="84" y2="52" stroke="#bae6fd" strokeWidth="1.5" strokeLinecap="round"/>
            {/* Izolátory */}
            <circle cx="43" cy="36" r="3" fill="#0f172a" stroke="#e0f2fe" strokeWidth="1.5"/>
            <circle cx="91" cy="36" r="3" fill="#0f172a" stroke="#e0f2fe" strokeWidth="1.5"/>
            <circle cx="49" cy="52" r="2.5" fill="#0f172a" stroke="#e0f2fe" strokeWidth="1.2"/>
            <circle cx="85" cy="52" r="2.5" fill="#0f172a" stroke="#e0f2fe" strokeWidth="1.2"/>
            {/* Vodiče */}
            <line x1="18" y1="36" x2="43" y2="36" stroke="#e0f2fe" strokeWidth="1.2"/>
            <line x1="91" y1="36" x2="118" y2="36" stroke="#e0f2fe" strokeWidth="1.2"/>
            <line x1="22" y1="52" x2="49" y2="52" stroke="#e0f2fe" strokeWidth="1.2"/>
            <line x1="85" y1="52" x2="114" y2="52" stroke="#e0f2fe" strokeWidth="1.2"/>
            {/* Blesk — vpravo od stožáru */}
            <polygon points="106,28 94,56 102,56 90,82 114,50 104,50" fill="#fbbf24"/>
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
