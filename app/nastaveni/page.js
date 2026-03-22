// Build: 20260322_09
// Nastavení – profil, výchozí sazby, správa uživatelů
// ============================================================
// CHANGELOG:
// 20260322_09 – fix READ tlačítka opacity pro user roli
// 20260322_08 – normalizace oblastí pro user roli při načtení; fix dashboard oblasti_edit
// 20260322_07 – fix: EDIT/READ tlačítka disabled pro roli user
// 20260322_06 – Varianta D: API routes přes cookies (SSR Auth), odstraněn Bearer token
// 20260322_05 – debug: flash chyby při selhání changeRole; ověření session
// 20260322_04 – fix changeRole: při změně na user promazat oblasti_edit/read (frontend + route)
// 20260322_03 – fix get-users: .order('name,email') → .order('email') — neexistující sloupec způsoboval chybu
// 20260322_02 – fix addUser: oblasti_edit/read prázdné pro roli user (frontend)
// 20260322_01 – fix oblasti: sessionRef → useState token; getUser() místo getSession()
// 20260321_21 – getToken() helper s fallback getSession()
// 20260321_01 – Seznam uživatelů načítán přes API route /api/get-users (fix RLS rekurze)
// 20260317_35 – Build sync
// 20260317_34 – Fix: výchozí tab pro non-admina=sazby; jméno+role v dashboardu headeru;
//               tlačítko zpět zvýrazněno; výchozí sazby načteny správně
// 20260317_33 – pole Jméno; API route create-user
// 20260317_31 – Pořadí tabů: Uživatelé → Výchozí sazby → Můj profil
//               Přidána role user.editor (EDITOR)
//               Odstraněna sekce Vzhled aplikace z Můj profil
//               Přepínač ☀️🌙 vedle sebe (stejně jako dashboard/page)
// 20260316_13 – původní verze
// ============================================================
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { useTheme } from '../layout'

const OBLASTI = ['Jihlava', 'Třebíč', 'Znojmo']
const ROLE_LABELS = {
  admin:        { label: 'ADMIN',  color: '#fbbf24', bg: 'rgba(245,158,11,0.2)',   icon: '👑' },
  'user.editor':{ label: 'EDITOR', color: '#818cf8', bg: 'rgba(99,102,241,0.2)',   icon: '✏️' },
  user:         { label: 'USER',   color: '#94a3b8', bg: 'rgba(100,116,139,0.15)', icon: '👤' },
}

function inputSx(T) {
  return { width: '100%', padding: '9px 12px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 7, color: T.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'system-ui' }
}
function SecHead({ color, children }) {
  return <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 10, color, fontWeight: 700, fontSize: 12, letterSpacing: 0.5, marginBottom: 12 }}>{children}</div>
}
function Lbl({ T, children }) {
  return <div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, marginBottom: 5, textTransform: 'uppercase' }}>{children}</div>
}

export default function NastaveniPage() {
  const { dark, toggle: toggleTheme, T } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab]     = useState('sazby')
  const [me, setMe]       = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState('')

  const [sazby, setSazby] = useState({ prirazka:'', hzs_mont:'', hzs_zem:'', zmes_mont:'', zmes_zem:'', index_rozbor:'-15' })
  const [profPass, setProfPass]   = useState('')
  const [profPass2, setProfPass2] = useState('')
  const [profErr, setProfErr]     = useState('')
  const [newEmail, setNewEmail]   = useState('')
  const [newPass,  setNewPass]    = useState('')
  const [newRole,  setNewRole]    = useState('user')
  const [newName,    setNewName]    = useState('')
  const [newOblast,  setNewOblast]  = useState('Třebíč')
  const [newOblasti, setNewOblasti] = useState(['Třebíč'])
  const [newOblastiRead, setNewOblastiRead] = useState([])
  const [userErr,  setUserErr]    = useState('')
  const [addingUser, setAddingUser] = useState(false)
  const [savingSazby, setSavingSazby] = useState(false)
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    const loadUser = async (session) => {
      if (!session) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof) { router.push('/login'); return }
      setMe({ ...session.user, ...prof })
      if (prof?.role === 'admin') {
        setTab('uzivatele')
        const res = await fetch('/api/get-users')
        if (res.ok) {
          const json = await res.json()
          // Normalizovat: user role nemá oblasti_edit ani oblasti_read
          const normalized = (json.users || []).map(u =>
            u.role === 'user' ? { ...u, oblasti_edit: [], oblasti_read: [] } : u
          )
          setUsers(normalized)

        }
      }
      const sazbyData = prof?.default_sazby
      if (sazbyData) setSazby(prev => ({ ...prev, ...sazbyData, index_rozbor: sazbyData.index_rozbor ?? '-15' }))
      setLoading(false)
    }

    // 1. Okamžité načtení při mountu — řeší návrat na stránku přes "zpět"
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadUser(session)
      else setLoading(false)
    })

    // 2. Pojistka pro budoucí změny — logout v jiném tabu
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') { router.push('/login'); return }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  const flash = (msg) => { setSaved(msg); setTimeout(() => setSaved(''), 2500) }

  const saveProfile = async () => {
    setProfErr('')
    if (profPass && profPass !== profPass2) { setProfErr('Hesla se neshodují'); return }
    if (profPass) {
      const { error } = await supabase.auth.updateUser({ password: profPass })
      if (error) { setProfErr('Chyba při změně hesla: ' + error.message); return }
    }
    flash('✓ Uloženo')
    setProfPass(''); setProfPass2('')
  }

  const addUser = async () => {
    setUserErr('')
    if (!newName.trim()) { setUserErr('Jméno je povinné'); return }
    if (!newEmail || !newPass) { setUserErr('Email a heslo jsou povinné'); return }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) { setUserErr('Zadejte platný email (např. jan@firma.cz)'); return }
    if (newPass.length < 6) { setUserErr('Heslo musí mít alespoň 6 znaků'); return }
    if (newOblasti.length === 0) { setUserErr('Vyberte alespoň jednu oblast'); return }
    setAddingUser(true)
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, password: newPass, role: newRole, oblast: newOblast, oblasti: newOblasti, oblasti_edit: newRole === 'user' ? [] : newOblasti, oblasti_read: newRole === 'user' ? [] : newOblastiRead, name: newName }),
    })
    const json = await res.json()
    setAddingUser(false)
    if (!res.ok) { setUserErr(json.error || 'Chyba při vytváření uživatele'); return }
    setUsers(prev => [...prev, json.user])
    setNewEmail(''); setNewPass(''); setNewName(''); setNewOblasti(['Třebíč']); setNewOblastiRead([])
    flash('✓ Uživatel přidán')
  }

  const removeUser = async (id) => {
    if (!confirm('Opravdu smazat tohoto uživatele? Akce je nevratná.')) return
    const res = await fetch('/api/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== id))
      flash('✓ Uživatel smazán')
    } else {
      const json = await res.json()
      flash('⚠ Chyba: ' + (json.error || 'Nepodařilo se smazat uživatele'))
    }
  }


  const changeRole = async (id, role) => {
    const res = await fetch('/api/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role, ...(role === 'user' ? { oblasti_edit: [], oblasti_read: [] } : {}) }),
    })
    if (res.ok) {
      const json = await res.json()
      if (json.user) setUsers(prev => prev.map(u => u.id === id ? { ...u, ...json.user } : u))
      else setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
    } else {
      const json = await res.json().catch(() => ({}))
      flash('⚠ Chyba uložení: ' + (json.error || res.status))
    }
  }

  const changeOblast = async (id, oblast) => {
    await supabase.from('profiles').update({ oblast }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, oblast } : u))
  }

  const changeOblastiEdit = async (id, oblast, current) => {
    const nove = current.includes(oblast) ? current.filter(o => o !== oblast) : [...current, oblast]
    const user = users.find(u => u.id === id)
    const noveRead = (user?.oblasti_read || []).filter(o => o !== oblast)
    const res = await fetch('/api/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, oblasti_edit: nove, oblasti_read: noveRead }),
    })
    if (res.ok) {
      const json = await res.json()
      if (json.user) setUsers(prev => prev.map(u => u.id === id ? { ...u, ...json.user } : u))
      else setUsers(prev => prev.map(u => u.id === id ? { ...u, oblasti_edit: nove, oblasti_read: noveRead } : u))
    }
  }

  const changeOblastiRead = async (id, oblast, current) => {
    const nove = current.includes(oblast) ? current.filter(o => o !== oblast) : [...current, oblast]
    const res = await fetch('/api/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, oblasti_read: nove }),
    })
    if (res.ok) {
      const json = await res.json()
      if (json.user) setUsers(prev => prev.map(u => u.id === id ? { ...u, ...json.user } : u))
      else setUsers(prev => prev.map(u => u.id === id ? { ...u, oblasti_read: nove } : u))
    }
  }

  const saveSazby = async () => {
    setSavingSazby(true)
    await supabase.from('profiles').update({ default_sazby: sazby }).eq('id', me.id)
    setSavingSazby(false)
    flash('✓ Sazby uloženy')
  }

  const logout = async () => { await supabase.auth.signOut(); router.push('/login') }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', color:'#64748b', background:T.bg }}>Načítám…</div>

  const isAdmin = me?.role === 'admin'
  const TABS = [
    ...(isAdmin ? [{ k:'uzivatele', l:'👥 Uživatelé' }] : []),
    { k:'sazby',  l:'💰 Výchozí sazby' },
    { k:'profil', l:'👤 Můj profil' },
  ]

  return (
    <div style={{ minHeight:'100vh', background:T.bg, fontFamily:'system-ui,sans-serif' }}>
      {/* HEADER */}
      <div style={{ background:T.header, borderBottom:`1px solid ${T.border}`, padding:'0 24px', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 0 0' }}>
            <button onClick={() => { router.refresh(); router.push('/dashboard') }} style={{ background:'rgba(37,99,235,0.15)', border:'1px solid rgba(37,99,235,0.4)', borderRadius:6, padding:'5px 12px', color:'#60a5fa', fontSize:12, fontWeight:700, cursor:'pointer' }}>← zpět</button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:T.muted, letterSpacing:1.5, textTransform:'uppercase' }}>Nastavení</div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ fontSize:15, fontWeight:800, color:T.text }}>{me?.name || me?.email}</div>
                <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background: (ROLE_LABELS[me?.role]?.bg || 'rgba(100,116,139,0.15)'), color: (ROLE_LABELS[me?.role]?.color || '#94a3b8'), fontWeight:700 }}>{ROLE_LABELS[me?.role]?.label || me?.role?.toUpperCase()}</span>
              </div>
              {me?.name && <div style={{ fontSize:11, color:T.muted }}>{me.email}</div>}
            </div>
            {saved && <div style={{ color:'#10b981', fontSize:12, fontWeight:700, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:6, padding:'4px 12px' }}>{saved}</div>}
            <div style={{ display:'flex', border:`1px solid ${T.border}`, borderRadius:6, overflow:'hidden' }}>
              <button onClick={() => dark && toggleTheme()} style={{ padding:'5px 10px', background: !dark ? 'rgba(255,255,255,0.15)' : 'transparent', border:'none', color: !dark ? T.text : T.muted, fontSize:12, cursor:'pointer' }}>☀️</button>
              <button onClick={() => !dark && toggleTheme()} style={{ padding:'5px 10px', background: dark ? 'rgba(255,255,255,0.15)' : 'transparent', border:'none', borderLeft:`1px solid ${T.border}`, color: dark ? T.text : T.muted, fontSize:12, cursor:'pointer' }}>🌙</button>
            </div>
            <button onClick={logout} style={{ padding:'6px 14px', background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:6, color:'#f87171', fontSize:12, fontWeight:600, cursor:'pointer' }}>Odhlásit</button>
          </div>
          <div style={{ display:'flex', marginTop:10 }}>
            {TABS.map(t => (
              <button key={t.k} onClick={() => setTab(t.k)} style={{
                padding:'8px 20px', background: tab===t.k ? 'rgba(37,99,235,0.2)' : 'transparent',
                border:'none', borderBottom: tab===t.k ? '3px solid #3b82f6' : '3px solid transparent',
                borderRadius:'6px 6px 0 0', color: tab===t.k ? '#3b82f6' : T.muted,
                cursor:'pointer', fontSize:13, fontWeight: tab===t.k ? 800 : 400,
              }}>{t.l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:860, margin:'0 auto', padding:'28px 24px 60px' }}>

        {/* ── PROFIL ── */}
        {tab === 'profil' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:'20px 22px' }}>
              <SecHead color="#60a5fa">Informace o účtu</SecHead>
              <div style={{ display:'flex', alignItems:'center', gap:18, marginBottom:18 }}>
                <div style={{ width:52, height:52, borderRadius:'50%', background: ROLE_LABELS[me?.role]?.bg || 'rgba(100,116,139,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>
                  {ROLE_LABELS[me?.role]?.icon || '👤'}
                </div>
                <div>
                  <div style={{ color:T.text, fontSize:16, fontWeight:700 }}>{me?.name || me?.email}</div>
                  {me?.name && <div style={{ color:T.muted, fontSize:12 }}>{me.email}</div>}
                  <div style={{ display:'flex', gap:8, marginTop:4 }}>
                    <span style={{ padding:'2px 8px', borderRadius:5, fontSize:11, fontWeight:700, background: ROLE_LABELS[me?.role]?.bg || 'rgba(100,116,139,0.15)', color: ROLE_LABELS[me?.role]?.color || '#94a3b8' }}>
                      {ROLE_LABELS[me?.role]?.label || me?.role?.toUpperCase()}
                    </span>
                    {me?.oblast && (
                      <span style={{ padding:'2px 8px', borderRadius:5, fontSize:11, fontWeight:600, background:'rgba(59,130,246,0.15)', color:'#60a5fa' }}>
                        📍 {me.oblast}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ marginBottom:8 }}>
                <Lbl T={T}>Jméno</Lbl>
                <div style={{ display:'flex', gap:8 }}>
                  <input type="text" value={me?.name || ''} onChange={e => setMe(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Jan Novák"
                    style={{ ...inputSx(T), flex:1 }} />
                  <button onClick={async () => {
                    setSavingName(true)
                    await supabase.from('profiles').update({ name: me.name }).eq('id', me.id)
                    setSavingName(false)
                    flash('✓ Jméno uloženo')
                  }} disabled={savingName}
                  style={{ padding:'9px 18px', background: savingName ? '#374151' : 'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:7, color:'#fff', fontSize:12, fontWeight:600, cursor: savingName ? 'default' : 'pointer', whiteSpace:'nowrap', opacity: savingName ? 0.7 : 1 }}>
                    {savingName ? '⏳' : 'Uložit'}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:'20px 22px' }}>
              <SecHead color="#a78bfa">Změna hesla</SecHead>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                <div>
                  <Lbl T={T}>Nové heslo</Lbl>
                  <input type="password" value={profPass} onChange={e => setProfPass(e.target.value)} placeholder="••••••••" style={inputSx(T)} />
                </div>
                <div>
                  <Lbl T={T}>Potvrdit heslo</Lbl>
                  <input type="password" value={profPass2} onChange={e => setProfPass2(e.target.value)} placeholder="••••••••" style={inputSx(T)} />
                </div>
              </div>
              {profErr && <div style={{ color:'#f87171', fontSize:12, marginBottom:12, padding:'8px 12px', background:'rgba(239,68,68,0.1)', borderRadius:7 }}>⚠️ {profErr}</div>}
              <button onClick={saveProfile} style={{ padding:'9px 22px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                Uložit změny
              </button>
            </div>
          </div>
        )}

        {/* ── SAZBY ── */}
        {tab === 'sazby' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:'20px 22px' }}>
              <SecHead color="#f59e0b">Výchozí sazby pro import EBC</SecHead>
              <div style={{ color:T.muted, fontSize:12, marginBottom:16 }}>
                Tyto hodnoty se předvyplní při importu EBC. Lze je při každém importu upravit.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:16 }}>
                {[
                  { l:'Přirážka %',         k:'prirazka' },
                  { l:'HZS montáž (Kč/h)',  k:'hzs_mont' },
                  { l:'ZMES montáž (Kč/h)', k:'zmes_mont' },
                  { l:'HZS zemní (Kč/h)',   k:'hzs_zem' },
                  { l:'ZMES zemní (Kč/h)',  k:'zmes_zem' },
                ].map(({ l, k }) => (
                  <div key={k}>
                    <Lbl T={T}>{l}</Lbl>
                    <input type="text" value={sazby[k] || ''} onChange={e => setSazby(v => ({ ...v, [k]: e.target.value }))}
                      placeholder="0" style={{ ...inputSx(T), fontFamily:'monospace' }} />
                  </div>
                ))}
              </div>
              <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:16, marginTop:4 }}>
                <SecHead color="#a78bfa">Výchozí index pro záložku Rozbor</SecHead>
                <div style={{ color:T.muted, fontSize:12, marginBottom:12 }}>
                  Předvyplní se do sloupce Index v sekci Mzdy montáže. Lze upravit ručně pro každý řádek.
                </div>
                <div style={{ maxWidth:220 }}>
                  <Lbl T={T}>Index ZMES/HZS (%)</Lbl>
                  <input type="text" value={sazby.index_rozbor ?? '-15'} onChange={e => setSazby(v => ({ ...v, index_rozbor: e.target.value }))}
                    placeholder="-15" style={{ ...inputSx(T), fontFamily:'monospace' }} />
                </div>
              </div>
              <button onClick={saveSazby} disabled={savingSazby}
                style={{ marginTop:20, padding:'9px 22px', background: savingSazby ? '#374151' : 'linear-gradient(135deg,#d97706,#b45309)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor: savingSazby ? 'default' : 'pointer', opacity: savingSazby ? 0.7 : 1 }}>
                {savingSazby ? '⏳ Ukládám…' : 'Uložit sazby'}
              </button>
            </div>
          </div>
        )}

        {/* ── UŽIVATELÉ (jen admin) ── */}
        {tab === 'uzivatele' && isAdmin && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:'20px 22px' }}>
              <SecHead color="#60a5fa">Přidat uživatele</SecHead>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 160px 160px', gap:12, marginBottom:12 }}>
                <div>
                  <Lbl T={T}>Jméno</Lbl>
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Jan Novák" style={inputSx(T)} />
                </div>
                <div>
                  <Lbl T={T}>Email</Lbl>
                  <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="jan@firma.cz" style={inputSx(T)} />
                </div>
                <div>
                  <Lbl T={T}>Heslo</Lbl>
                  <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="••••••••" style={inputSx(T)} />
                </div>
                <div>
                  <Lbl T={T}>Role</Lbl>
                  <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ ...inputSx(T), cursor:'pointer' }}>
                    <option value="user">User</option>
                    <option value="user.editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div style={{ gridColumn:'span 2' }}>
                  <Lbl T={T}>Oblasti přístupu</Lbl>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, paddingTop:4 }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                      <span style={{ color:'#3b82f6', fontSize:10, fontWeight:700, width:32 }}>EDIT</span>
                      {OBLASTI.map(o => {
                        const ma = newOblasti.includes(o)
                        return (
                          <button key={o} type="button" onClick={() => {
                            setNewOblasti(prev => ma ? prev.filter(x=>x!==o) : [...prev, o])
                            if (!ma) setNewOblastiRead(prev => prev.filter(x=>x!==o))
                          }}
                            style={{ padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer',
                              background: ma ? 'rgba(59,130,246,0.2)' : 'transparent',
                              border: `1px solid ${ma ? '#3b82f6' : T.border}`,
                              color: ma ? '#60a5fa' : T.muted }}>
                            {o}
                          </button>
                        )
                      })}
                    </div>
                    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                      <span style={{ color:'#94a3b8', fontSize:10, fontWeight:700, width:32 }}>READ</span>
                      {OBLASTI.map(o => {
                        const maEdit = newOblasti.includes(o)
                        const ma = newOblastiRead.includes(o)
                        return (
                          <button key={o} type="button" disabled={maEdit} onClick={() => !maEdit && setNewOblastiRead(prev => ma ? prev.filter(x=>x!==o) : [...prev, o])}
                            style={{ padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:700,
                              cursor: maEdit ? 'default' : 'pointer',
                              background: maEdit ? 'rgba(59,130,246,0.1)' : ma ? 'rgba(148,163,184,0.2)' : 'transparent',
                              border: `1px solid ${maEdit ? '#3b82f640' : ma ? '#94a3b8' : T.border}`,
                              color: maEdit ? '#3b82f640' : ma ? '#94a3b8' : T.muted }}>
                            {o}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
              {userErr && <div style={{ color:'#f87171', fontSize:12, marginBottom:10, padding:'7px 12px', background:'rgba(239,68,68,0.1)', borderRadius:7 }}>⚠️ {userErr}</div>}
              <button onClick={addUser} disabled={addingUser}
                style={{ padding:'9px 20px', background: addingUser ? '#374151' : 'linear-gradient(135deg,#16a34a,#15803d)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor: addingUser ? 'default' : 'pointer', opacity: addingUser ? 0.7 : 1 }}>
                {addingUser ? '⏳ Přidávám…' : '+ Přidat uživatele'}
              </button>
            </div>

            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:'20px 22px' }}>
              <SecHead color="#f472b6">Seznam uživatelů ({users.length})</SecHead>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {users.map(u => {
                  const rl = ROLE_LABELS[u.role] || ROLE_LABELS.user
                  const isMe = u.id === me?.id
                  return (
                    <div key={u.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background: isMe ? 'rgba(37,99,235,0.06)' : `${T.bg}99`, borderRadius:9, border:`1px solid ${isMe ? 'rgba(59,130,246,0.3)' : T.border}` }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:rl.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                        {rl.icon}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:T.text, fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                          {u.name || u.email}
                          {isMe && <span style={{ fontSize:10, color:'#60a5fa', background:'rgba(59,130,246,0.15)', borderRadius:4, padding:'1px 6px', fontWeight:700 }}>JÁ</span>}
                        </div>
                        <div style={{ color:T.muted, fontSize:11, marginTop:2 }}>{u.name && <span>{u.email} · </span>}ID: {u.id?.slice(0,8)}…</div>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {(() => { const isUser = u.role === 'user'; return (<>
                        <div style={{ display:'flex', gap:3, alignItems:'center' }}>
                          <span style={{ color:'#3b82f6', fontSize:9, fontWeight:700, width:28 }}>EDIT</span>
                          {OBLASTI.map(o => {
                            const ma = (u.oblasti_edit || []).includes(o)
                            return (
                              <button key={o} disabled={isMe || isUser} onClick={() => !isMe && !isUser && changeOblastiEdit(u.id, o, u.oblasti_edit || [])}
                                style={{ padding:'2px 7px', borderRadius:4, fontSize:11, fontWeight:700, cursor: isMe || isUser ? 'default' : 'pointer',
                                  background: ma ? 'rgba(59,130,246,0.2)' : 'transparent',
                                  border: `1px solid ${ma ? '#3b82f6' : T.border}`,
                                  color: ma ? '#60a5fa' : T.muted,
                                  opacity: isMe || isUser ? 0.4 : 1 }}>
                                {o}
                              </button>
                            )
                          })}
                        </div>
                        <div style={{ display:'flex', gap:3, alignItems:'center' }}>
                          <span style={{ color:'#94a3b8', fontSize:9, fontWeight:700, width:28 }}>READ</span>
                          {OBLASTI.map(o => {
                            const maEdit = (u.oblasti_edit || []).includes(o)
                            const ma = (u.oblasti_read || []).includes(o)
                            return (
                              <button key={o} disabled={isMe || maEdit || isUser} onClick={() => !isMe && !maEdit && !isUser && changeOblastiRead(u.id, o, u.oblasti_read || [])}
                                style={{ padding:'2px 7px', borderRadius:4, fontSize:11, fontWeight:700,
                                  cursor: isMe || maEdit || isUser ? 'default' : 'pointer',
                                  background: maEdit ? 'rgba(59,130,246,0.1)' : ma ? 'rgba(148,163,184,0.2)' : 'transparent',
                                  border: `1px solid ${maEdit ? '#3b82f640' : ma ? '#94a3b8' : T.border}`,
                                  color: maEdit ? '#3b82f640' : ma ? '#94a3b8' : T.muted,
                                  opacity: isMe || isUser ? 0.4 : 1 }}>
                                {o}
                              </button>
                            )
                          })}
                        </div>
                        </>)})()}
                      </div>
                      {isMe ? (
                        <span style={{ padding:'3px 10px', borderRadius:6, fontSize:11, fontWeight:700, background:rl.bg, color:rl.color }}>{rl.label}</span>
                      ) : (
                        <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                          style={{ padding:'4px 8px', background:rl.bg, border:`1px solid ${rl.color}44`, borderRadius:6, color:rl.color, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                          <option value="user">USER</option>
                          <option value="user.editor">EDITOR</option>
                          <option value="admin">ADMIN</option>
                        </select>
                      )}
                      <button onClick={() => removeUser(u.id)} disabled={isMe}
                        style={{ background:'none', border:'none', color: isMe ? T.border : '#f87171', cursor: isMe ? 'default' : 'pointer', fontSize:16, padding:'0 4px', flexShrink:0 }}>✕</button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
