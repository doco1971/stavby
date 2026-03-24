// ============================================================
// Build: 20260324_06
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
// 20260324_06 – export PDF + Excel v záložce Rozbor (editor stavby)
// 20260323_09 – filtr staveb podle autora (dropdown, dynamický ze staveb)
// 20260323_08 – SMAZAT modal: písmena se rozsvěcují červeně při psaní
// 20260323_07 – fix DeleteSmazatModal: React.useState → useState (client-side crash)
// 20260323_06 – mazání stavby z dashboardu: menu ⋮ (Otevřít/Smazat) + dvojité potvrzení (confirm + SMAZAT)
// 20260322_11 – autor stavby pod oblastí v dashboardu
// 20260322_10 – user vidí stavby dle oblasti_read
// 20260322_09 – editor vidí stavby z edit+read oblastí; fix fallback
// 20260322_08 – fix editor nevidí stavby; odstraněn duplicitní oblast badge
// 20260322_05 – aktualizace BUILD konstanty
// 20260321_21 – Fix: nový uživatel dostane roli 'user' (ne admin); fix canEdit před načtením profilu
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
const BUILD = '20260324_06'

export default function Dashboard() {
  const { dark, toggle, T } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [stavby, setStavby]   = useState([])
  const [filter, setFilter]       = useState('vse')
  const [filterAutor, setFilterAutor] = useState('vse')
  const [search, setSearch]       = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [menuOpen, setMenuOpen] = useState(null) // id stavby
  const [deleteConfirm1, setDeleteConfirm1] = useState(null) // { id, nazev }
  const [deleteConfirm2, setDeleteConfirm2] = useState(null) // { id, nazev }
  const [deleteInput, setDeleteInput] = useState('')
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
        let q = supabase.from('stavby').select('*, profiles(name, email)').order('updated_at', { ascending: false })
        if (prof?.role === 'admin') {
          // Admin vidí vše
        } else if (prof?.role === 'user.editor') {
          // Editor vidí stavby ze svých povolených oblastí (edit + read)
          const editOblasti = Array.isArray(prof?.oblasti_edit) && prof.oblasti_edit.length > 0 ? prof.oblasti_edit : []
          const readOblasti = Array.isArray(prof?.oblasti_read) && prof.oblasti_read.length > 0 ? prof.oblasti_read : []
          const povOblasti = [...new Set([...editOblasti, ...readOblasti])]
          // Fallback: oblasti nebo oblast
          const finalOblasti = povOblasti.length > 0
            ? povOblasti
            : Array.isArray(prof?.oblasti) && prof.oblasti.length > 0
            ? prof.oblasti
            : [prof?.oblast].filter(Boolean)
          if (finalOblasti.length > 0) q = q.in('oblast', finalOblasti)
          else q = q.eq('user_id', user.id)
        } else {
          // User vidí stavby ze svých read oblastí (pokud má), jinak jen své
          const readOblasti = Array.isArray(prof?.oblasti_read) && prof.oblasti_read.length > 0 ? prof.oblasti_read : []
          if (readOblasti.length > 0) q = q.in('oblast', readOblasti)
          else q = q.eq('user_id', user.id)
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

  const handleDeleteStavba = async (id) => {
    await supabase.from('stavby').delete().eq('id', id)
    setStavby(prev => prev.filter(s => s.id !== id))
  }

  const novaStavba = async () => {
    const { data } = await supabase.from('stavby').insert({
      user_id: user.id, oblast: profile?.oblast || 'Třebíč',
      nazev: 'Nová stavba', mzdy: {}, mech: {}, zemni: {}, gn: {}, dof: {}
    }).select().single()
    if (data) router.push(`/stavba/${data.id}`)
  }

  const baseNazev = (nazev) => String(nazev || '').replace(/\s*-\s*\(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}\)\s*$/, '').trim()

  const autori = [...new Map(
    stavby
      .filter(s => s.profiles?.name || s.profiles?.email)
      .map(s => {
        const id = s.profiles?.name || s.profiles?.email
        return [id, { id, label: s.profiles?.name || s.profiles?.email }]
      })
  ).values()]

  const filtered = stavby
    .filter(s => filter === 'vse' || s.oblast === filter)
    .filter(s => filterAutor === 'vse' || (s.profiles?.name || s.profiles?.email) === filterAutor)
    .filter(s => search === '' || baseNazev(s.nazev).toLowerCase().includes(search.toLowerCase()))

  const renderStavba = (s) => (
    <div key={s.id} style={{ position: 'relative' }}>
      <div onClick={() => router.push(`/stavba/${s.id}`)}
        style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer', marginBottom: 8 }}
        onMouseEnter={e => e.currentTarget.style.borderColor = T.accent}
        onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{s.nazev}</div>
            <div style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>{s.cislo && `č. ${s.cislo} · `}{s.oblast}</div>
            <div style={{ color: '#10b981', fontSize: 11, marginTop: 2 }}>🕐 Záloha: {new Date(s.updated_at).toLocaleString('cs-CZ', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase' }}>Oblast</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: T.accent }}>{s.oblast}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>👤 {s.profiles?.name || s.profiles?.email || '—'}</div>
            </div>
            {profile?.role === 'admin' && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === s.id ? null : s.id) }}
                  style={{ background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, color: T.muted, cursor: 'pointer', fontSize: 16, padding: '2px 8px', lineHeight: 1.4 }}>
                  ⋮
                </button>
                {menuOpen === s.id && (
                  <div style={{ position: 'absolute', right: 0, top: '110%', background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, minWidth: 140, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                    <button
                      onClick={e => { e.stopPropagation(); setMenuOpen(null); router.push(`/stavba/${s.id}`) }}
                      style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'transparent', border: 'none', color: T.text, fontSize: 13, textAlign: 'left', cursor: 'pointer' }}>
                      ✏️ Otevřít
                    </button>
                    <div style={{ height: 1, background: T.border, margin: '2px 0' }} />
                    <button
                      onClick={e => { e.stopPropagation(); setMenuOpen(null); setDeleteConfirm1({ id: s.id, nazev: s.nazev }) }}
                      style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'transparent', border: 'none', color: '#ef4444', fontSize: 13, textAlign: 'left', cursor: 'pointer' }}>
                      🗑️ Smazat
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
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

  // Zavřít menu klikem mimo
  useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuOpen])

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
          <button onClick={() => { router.refresh(); router.push('/nastaveni') }}
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
          {autori.length > 1 && (
            <select value={filterAutor} onChange={e => setFilterAutor(e.target.value)}
              style={{ padding: '9px 12px', background: filterAutor !== 'vse' ? 'rgba(99,102,241,0.1)' : T.card, border: `1px solid ${filterAutor !== 'vse' ? '#818cf8' : T.border}`, borderRadius: 8, color: filterAutor !== 'vse' ? '#818cf8' : T.muted, fontSize: 13, cursor: 'pointer', outline: 'none' }}>
              <option value="vse">👤 Autor: všichni</option>
              {autori.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          )}
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

      {/* Krok 1: confirm dialog mazání */}
      {deleteConfirm1 && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:T.card, border:'1px solid rgba(239,68,68,0.4)', borderRadius:14, padding:28, maxWidth:400, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize:16, fontWeight:800, color:'#ef4444', marginBottom:12 }}>⚠️ Smazat stavbu</div>
            <div style={{ color:T.text, fontSize:13, lineHeight:1.6, marginBottom:24 }}>
              Opravdu smazat stavbu <strong>„{deleteConfirm1.nazev}"</strong>? Tato akce je nevratná.
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setDeleteConfirm1(null)}
                style={{ padding:'9px 20px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:8, color:T.muted, cursor:'pointer', fontSize:13 }}>Zrušit</button>
              <button onClick={() => { setDeleteConfirm2(deleteConfirm1); setDeleteConfirm1(null); setDeleteInput('') }}
                style={{ padding:'9px 20px', background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:8, color:'#ef4444', cursor:'pointer', fontSize:13, fontWeight:700 }}>Pokračovat</button>
            </div>
          </div>
        </div>
      )}

      {/* Krok 2: zadání slova SMAZAT */}
      {deleteConfirm2 && (() => {
        const target = 'SMAZAT'
        const hotovo = deleteInput.toUpperCase() === target
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
            <div style={{ background:T.card, border:'1px solid rgba(239,68,68,0.4)', borderRadius:14, padding:28, maxWidth:420, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ fontSize:16, fontWeight:800, color:'#ef4444', marginBottom:12 }}>⚠️ Poslední potvrzení</div>
              <div style={{ color:T.text, fontSize:13, lineHeight:1.6, marginBottom:20 }}>
                Pro smazání stavby <strong>„{deleteConfirm2.nazev}"</strong> opište níže zobrazené slovo:
              </div>
              <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:20 }}>
                {target.split('').map((letter, i) => {
                  const active = (deleteInput.toUpperCase())[i] === letter
                  return (
                    <div key={i} style={{ width:38, height:44, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:6, border:`2px solid ${active ? '#ef4444' : 'rgba(239,68,68,0.25)'}`, fontSize:18, fontWeight:800, fontFamily:'monospace', color: active ? '#ef4444' : 'rgba(239,68,68,0.25)', transition:'color 0.15s, border-color 0.15s' }}>{letter}</div>
                  )
                })}
              </div>
              <input
                autoFocus
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value.toUpperCase().slice(0, 6))}
                onKeyDown={e => { if (e.key === 'Enter' && hotovo) { handleDeleteStavba(deleteConfirm2.id); setDeleteConfirm2(null); setDeleteInput('') } }}
                placeholder="Pište sem…"
                style={{ width:'100%', padding:'9px 12px', background:'rgba(239,68,68,0.06)', border:`1px solid ${hotovo ? '#ef4444' : 'rgba(239,68,68,0.3)'}`, borderRadius:8, color:T.text, fontSize:15, fontFamily:'monospace', fontWeight:700, letterSpacing:4, outline:'none', boxSizing:'border-box', marginBottom:20, textAlign:'center' }}
              />
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button onClick={() => { setDeleteConfirm2(null); setDeleteInput('') }}
                  style={{ padding:'9px 20px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:8, color:T.muted, cursor:'pointer', fontSize:13 }}>Zrušit</button>
                <button
                  onClick={() => { if (hotovo) { handleDeleteStavba(deleteConfirm2.id); setDeleteConfirm2(null); setDeleteInput('') } }}
                  disabled={!hotovo}
                  style={{ padding:'9px 20px', background: hotovo ? '#ef4444' : 'rgba(239,68,68,0.2)', border:'none', borderRadius:8, color:'#fff', cursor: hotovo ? 'pointer' : 'not-allowed', fontSize:13, fontWeight:700, opacity: hotovo ? 1 : 0.5, transition:'background 0.2s, opacity 0.2s' }}>
                  Smazat trvale
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
