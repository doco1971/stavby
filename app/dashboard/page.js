// ============================================================
// Build: 20260321_12
// Kalkulace stavby – Dashboard
// ============================================================
// Cesty: app/dashboard/page.js
//   import supabase: '../../lib/supabase'
//   import layout:   '../layout'
//
// FUNKCE:
// - Seznam staveb s filtrem podle oblasti
// - Vyhledávání podle názvu stavby (ignoruje datum verze)
// - Seskupení verzí stejné stavby při aktivním hledání
// - Přepínač motivu ☀️🌙 vedle sebe
// - Build kódu vedle názvu aplikace
// - Zvýrazněná tlačítka Nastavení a Odhlásit
//
// CHANGELOG:
// 20260321_12 – Fix: nový uživatel dostane roli 'user' (ne admin); fix canEdit před načtením profilu
// 20260321_02 – Filtrování staveb podle povolených oblastí uživatele
// 20260321_01 – Build sync; pravidla vývoje přidána
// 20260317_34 – Jméno+role uživatele v headeru (světlejší, vedle role)
// 20260317_30 – Fix: tlačítko Nová stavba skryto pro roli user
// 20260317_29 – fix import cest (supabase, layout)
// 20260317_16 – build kódu vedle "Kalkulace stavby"; zvýraznění Nastavení + Odhlásit
// 20260315_28 – přidáno vyhledávání + seskupení verzí
// 20260315_24 – přepínač ☀️🌙 vedle sebe
// ============================================================
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { useTheme } from '../layout'

const OBLASTI = ['Jihlava', 'Třebíč', 'Znojmo']
const BUILD = '20260321_12'

export default function Dashboard() {
  const { dark, toggle, T } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [stavby, setStavby]   = useState([])
  const [filter, setFilter]   = useState('vse')
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }
        setUser(user)
        let { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        if (!prof) {
          const { data: newProf } = await supabase.from('profiles')
            .insert({ id: user.id, email: user.email, role: 'user', oblast: 'Třebíč' })
            .select().maybeSingle()
          prof = newProf
        }
        setProfile(prof)
        // canEdit je computed z profilu — viz render
        let q = supabase.from('stavby').select('*').order('updated_at', { ascending: false })
        if (prof?.role === 'admin') {
          // Admin vidí vše
        } else if (prof?.role === 'user.editor') {
          // Editor vidí stavby ze svých povolených oblastí
          const povOblasti = prof?.oblasti_edit || prof?.oblasti || [prof?.oblast].filter(Boolean)
          if (povOblasti.length > 0) q = q.in('oblast', povOblasti)
          else q = q.eq('user_id', user.id)
        } else {
          // User vidí jen své stavby
          q = q.eq('user_id', user.id)
        }
        const { data, error } = await q
        if (error) setErr(error.message)
        setStavby(data || [])
      } catch(e) {
        setErr(e.message)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const logout = async () => { await supabase.auth.signOut(); router.push('/login') }

  const novaStavba = async () => {
    const { data } = await supabase.from('stavby').insert({
      user_id: user.id, oblast: profile?.oblast || 'Třebíč',
      nazev: 'Nová stavba', mzdy: {}, mech: {}, zemni: {}, gn: {}, dof: {}
    }).select().single()
    if (data) router.push(`/stavba/${data.id}`)
  }

  const baseNazev = (nazev) => String(nazev || '').replace(/\s*-\s*\(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}\)\s*$/, '').trim()

  const filtered = stavby
    .filter(s => filter === 'vse' || s.oblast === filter)
    .filter(s => search === '' || baseNazev(s.nazev).toLowerCase().includes(search.toLowerCase()))

  const renderStavba = (s) => (
    <div key={s.id} onClick={() => router.push(`/stavba/${s.id}`)}
      style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer', marginBottom: 8 }}
      onMouseEnter={e => e.currentTarget.style.borderColor = T.accent}
      onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{s.nazev}</div>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>{s.cislo && `č. ${s.cislo} · `}{s.oblast}</div>
          <div style={{ color: '#10b981', fontSize: 11, marginTop: 2 }}>🕐 Záloha: {new Date(s.updated_at).toLocaleString('cs-CZ', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
          <div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase' }}>Oblast</div>
          <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: T.accent }}>{s.oblast}</div>
        </div>
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.12)', color: T.accent }}>{s.oblast}</span>
      </div>
    </div>
  )

  const renderGrouped = () => {
    const skupiny = {}
    filtered.forEach(s => {
      const base = baseNazev(s.nazev)
      if (!skupiny[base]) skupiny[base] = []
      skupiny[base].push(s)
    })
    return Object.entries(skupiny).map(([base, verze]) => (
      <div key={base} style={{ marginBottom: 20 }}>
        <div style={{ color: T.accent, fontSize: 12, fontWeight: 700, marginBottom: 8, padding: '6px 10px', background: 'rgba(59,130,246,0.08)', borderRadius: 6, borderLeft: `3px solid ${T.accent}`, display: 'flex', justifyContent: 'space-between' }}>
          <span>{base}</span>
          <span style={{ color: T.muted, fontWeight: 400 }}>{verze.length} {verze.length === 1 ? 'verze' : verze.length < 5 ? 'verze' : 'verzí'}</span>
        </div>
        {verze.map(s => renderStavba(s))}
      </div>
    ))
  }

  const canEdit = profile?.role === 'admin' || profile?.role === 'user.editor'

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      {/* HEADER */}
      <div style={{ background: T.header, borderBottom: `1px solid ${T.border}`, padding: '0 24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, height: 58 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏗️</div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: T.text }}>Kalkulace stavby</span>
            <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>📦 {BUILD}</span>
          </div>
          <div style={{ display:'flex', border:`1px solid ${T.border}`, borderRadius:6, overflow:'hidden' }}>
            <button onClick={() => dark && toggle()} style={{ padding:'5px 10px', background: !dark ? 'rgba(255,255,255,0.15)' : 'transparent', border:'none', color: !dark ? T.text : T.muted, fontSize:12, cursor:'pointer' }}>☀️</button>
            <button onClick={() => !dark && toggle()} style={{ padding:'5px 10px', background: dark ? 'rgba(255,255,255,0.15)' : 'transparent', border:'none', borderLeft:`1px solid ${T.border}`, color: dark ? T.text : T.muted, fontSize:12, cursor:'pointer' }}>🌙</button>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ color:'#94a3b8', fontSize:12 }}>{profile?.name || user?.email}</span>
            {profile?.name && <span style={{ color:'#64748b', fontSize:11 }}>{user?.email}</span>}
            {profile?.role && (() => {
              const rl = { admin:{label:'ADMIN',color:'#f59e0b',bg:'rgba(245,158,11,0.15)'}, 'user.editor':{label:'EDITOR',color:'#818cf8',bg:'rgba(99,102,241,0.15)'}, user:{label:'USER',color:'#64748b',bg:'rgba(100,116,139,0.1)'} }
              const r = rl[profile.role] || rl.user
              return <span style={{ fontSize:10, padding:'2px 6px', background:r.bg, color:r.color, borderRadius:4, fontWeight:700 }}>{r.label}</span>
            })()}
          </div>
          <button onClick={() => router.push('/nastaveni')}
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 6, padding: '5px 12px', color: '#818cf8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            ⚙️ Nastavení
          </button>
          <button onClick={() => setLogoutConfirm(true)}
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, padding: '5px 12px', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            🚪 Odhlásit
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          {canEdit && <button onClick={novaStavba} style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Nová stavba</button>}
          {['vse', ...OBLASTI].map(o => (
            <button key={o} onClick={() => setFilter(o)}
              style={{ padding: '9px 14px', background: filter === o ? 'rgba(59,130,246,0.15)' : 'transparent', border: `1px solid ${filter === o ? T.accent : T.border}`, borderRadius: 8, color: filter === o ? T.accent : T.muted, fontSize: 13, cursor: 'pointer' }}>
              {o === 'vse' ? 'Vše' : o}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', color: T.muted, fontSize: 12, alignSelf: 'center' }}>{filtered.length} staveb</div>
        </div>

        <div style={{ marginBottom: 20, position: 'relative' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Hledat stavbu… (ignoruje datum verze)"
            style={{ width: '100%', padding: '10px 36px 10px 14px', background: T.card, border: `1px solid ${search ? T.accent : T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'system-ui' }} />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 16 }}>✕</button>
          )}
        </div>

        {err && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 12, marginBottom: 16 }}>⚠ {err}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', color: T.muted, padding: 60 }}>Načítám…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: T.muted, padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{search ? '🔍' : '📋'}</div>
            <div>{search ? `Žádná stavba neodpovídá hledání "${search}"` : 'Žádné stavby. Vytvořte první kliknutím na "+ Nová stavba".'}</div>
          </div>
        ) : search ? renderGrouped() : filtered.map(s => renderStavba(s))}
      </div>

      {logoutConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:28, maxWidth:380, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize:16, fontWeight:800, color:T.text, marginBottom:12 }}>Odhlásit se?</div>
            <div style={{ color:T.muted, fontSize:13, marginBottom:24 }}>Opravdu se chcete odhlásit z aplikace?</div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setLogoutConfirm(false)}
                style={{ padding:'9px 20px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:8, color:T.muted, cursor:'pointer', fontSize:13 }}>Zrušit</button>
              <button onClick={logout}
                style={{ padding:'9px 20px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:8, color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700 }}>Odhlásit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
