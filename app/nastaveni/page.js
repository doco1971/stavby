'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { useTheme } from '../layout'

const OBLASTI = ['Jihlava', 'Třebíč', 'Znojmo']
const ROLE_LABELS = { admin: { label: 'ADMIN', color: '#fbbf24', bg: 'rgba(245,158,11,0.2)', icon: '👑' }, user: { label: 'USER', color: '#94a3b8', bg: 'rgba(100,116,139,0.15)', icon: '👤' } }

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
  const [tab, setTab]       = useState('profil')
  const [me, setMe]         = useState(null)
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved]   = useState('')

  // profil form
  const [profName, setProfName] = useState('')
  const [profPass, setProfPass] = useState('')
  const [profPass2, setProfPass2] = useState('')
  const [profErr, setProfErr]   = useState('')

  // nový uživatel
  const [newEmail, setNewEmail] = useState('')
  const [newPass,  setNewPass]  = useState('')
  const [newRole,  setNewRole]  = useState('user')
  const [newOblast, setNewOblast] = useState('Třebíč')
  const [userErr,  setUserErr]  = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setMe({ ...user, ...prof })
      setProfName(prof?.email || user.email || '')
      if (prof?.role === 'admin') {
        const { data: all } = await supabase.from('profiles').select('*').order('email')
        setUsers(all || [])
      }
      setLoading(false)
    }
    load()
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
    if (!newEmail || !newPass) { setUserErr('Email a heslo jsou povinné'); return }
    const { data, error } = await supabase.auth.admin.createUser({ email: newEmail, password: newPass, email_confirm: true })
    if (error) { setUserErr(error.message); return }
    await supabase.from('profiles').upsert({ id: data.user.id, email: newEmail, role: newRole, oblast: newOblast })
    setUsers(prev => [...prev, { id: data.user.id, email: newEmail, role: newRole, oblast: newOblast }])
    setNewEmail(''); setNewPass('')
    flash('✓ Uživatel přidán')
  }

  const removeUser = async (id) => {
    if (!confirm('Opravdu smazat tohoto uživatele?')) return
    await supabase.from('profiles').delete().eq('id', id)
    setUsers(prev => prev.filter(u => u.id !== id))
    flash('Uživatel smazán')
  }

  const changeRole = async (id, role) => {
    await supabase.from('profiles').update({ role }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
  }

  const changeOblast = async (id, oblast) => {
    await supabase.from('profiles').update({ oblast }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, oblast } : u))
  }

  const logout = async () => { await supabase.auth.signOut(); router.push('/login') }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#64748b', background: T.bg }}>Načítám…</div>

  const isAdmin = me?.role === 'admin'
  const TABS = [
    { k: 'profil', l: '👤 Můj profil' },
    ...(isAdmin ? [{ k: 'uzivatele', l: '👥 Uživatelé' }] : []),
  ]

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: 'system-ui,sans-serif' }}>
      {/* HEADER */}
      <div style={{ background: T.header, borderBottom: `1px solid ${T.border}`, padding: '0 24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0 0' }}>
            <button onClick={() => router.push('/dashboard')} style={{ background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, padding: '4px 10px', color: T.muted, fontSize: 12, cursor: 'pointer' }}>← zpět</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase' }}>Nastavení</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{me?.email}</div>
            </div>
            {saved && <div style={{ color: '#10b981', fontSize: 12, fontWeight: 700, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '4px 12px' }}>{saved}</div>}
            <button onClick={toggleTheme} style={{ background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 8px', color: T.muted, fontSize: 12, cursor: 'pointer' }}>{dark ? '☀️' : '🌙'}</button>
            <button onClick={logout} style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Odhlásit</button>
          </div>
          <div style={{ display: 'flex', marginTop: 10 }}>
            {TABS.map(t => (
              <button key={t.k} onClick={() => setTab(t.k)} style={{
                padding: '8px 20px', background: tab === t.k ? 'rgba(37,99,235,0.2)' : 'transparent',
                border: 'none', borderBottom: tab === t.k ? '3px solid #3b82f6' : '3px solid transparent',
                borderRadius: '6px 6px 0 0', color: tab === t.k ? '#3b82f6' : T.muted,
                cursor: 'pointer', fontSize: 13, fontWeight: tab === t.k ? 800 : 400,
              }}>{t.l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px 60px' }}>

        {/* ── PROFIL ── */}
        {tab === 'profil' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Info karta */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '20px 22px' }}>
              <SecHead color="#60a5fa">Informace o účtu</SecHead>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: isAdmin ? 'rgba(245,158,11,0.2)' : 'rgba(100,116,139,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                  {isAdmin ? '👑' : '👤'}
                </div>
                <div>
                  <div style={{ color: T.text, fontSize: 16, fontWeight: 700 }}>{me?.email}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: ROLE_LABELS[me?.role]?.bg || 'rgba(100,116,139,0.15)', color: ROLE_LABELS[me?.role]?.color || '#94a3b8' }}>
                      {ROLE_LABELS[me?.role]?.label || me?.role?.toUpperCase()}
                    </span>
                    {me?.oblast && (
                      <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                        📍 {me.oblast}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Změna hesla */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '20px 22px' }}>
              <SecHead color="#a78bfa">Změna hesla</SecHead>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <Lbl T={T}>Nové heslo</Lbl>
                  <input type="password" value={profPass} onChange={e => setProfPass(e.target.value)} placeholder="••••••••" style={inputSx(T)} />
                </div>
                <div>
                  <Lbl T={T}>Potvrdit heslo</Lbl>
                  <input type="password" value={profPass2} onChange={e => setProfPass2(e.target.value)} placeholder="••••••••" style={inputSx(T)} />
                </div>
              </div>
              {profErr && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 7 }}>⚠️ {profErr}</div>}
              <button onClick={saveProfile} style={{ padding: '9px 22px', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Uložit změny
              </button>
            </div>

            {/* Vzhled */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '20px 22px' }}>
              <SecHead color="#34d399">Vzhled aplikace</SecHead>
              <div style={{ display: 'flex', gap: 12 }}>
                {[{ k: false, l: '☀️ Světlý' }, { k: true, l: '🌙 Tmavý' }].map(({ k, l }) => (
                  <button key={String(k)} onClick={() => k !== dark && toggleTheme()} style={{
                    padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    background: dark === k ? 'rgba(52,211,153,0.2)' : 'transparent',
                    border: dark === k ? '2px solid #34d399' : `1px solid ${T.border}`,
                    color: dark === k ? '#34d399' : T.muted,
                  }}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── UŽIVATELÉ (jen admin) ── */}
        {tab === 'uzivatele' && isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Přidat uživatele */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '20px 22px' }}>
              <SecHead color="#60a5fa">Přidat uživatele</SecHead>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px 160px', gap: 12, marginBottom: 12 }}>
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
                  <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ ...inputSx(T), cursor: 'pointer' }}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <Lbl T={T}>Oblast</Lbl>
                  <select value={newOblast} onChange={e => setNewOblast(e.target.value)} style={{ ...inputSx(T), cursor: 'pointer' }}>
                    {OBLASTI.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              {userErr && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 10, padding: '7px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 7 }}>⚠️ {userErr}</div>}
              <button onClick={addUser} style={{ padding: '9px 20px', background: 'linear-gradient(135deg,#16a34a,#15803d)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + Přidat uživatele
              </button>
            </div>

            {/* Seznam uživatelů */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '20px 22px' }}>
              <SecHead color="#f472b6">Seznam uživatelů ({users.length})</SecHead>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {users.map(u => {
                  const rl = ROLE_LABELS[u.role] || ROLE_LABELS.user
                  const isMe = u.id === me?.id
                  return (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: isMe ? 'rgba(37,99,235,0.06)' : `${T.bg}99`, borderRadius: 9, border: `1px solid ${isMe ? 'rgba(59,130,246,0.3)' : T.border}` }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: rl.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                        {rl.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: T.text, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {u.email}
                          {isMe && <span style={{ fontSize: 10, color: '#60a5fa', background: 'rgba(59,130,246,0.15)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>JÁ</span>}
                        </div>
                        <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>ID: {u.id?.slice(0, 8)}…</div>
                      </div>
                      {/* Oblast select */}
                      <select value={u.oblast || ''} onChange={e => changeOblast(u.id, e.target.value)}
                        disabled={isMe}
                        style={{ padding: '4px 8px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 12, cursor: isMe ? 'default' : 'pointer', opacity: isMe ? 0.5 : 1 }}>
                        <option value="">– oblast –</option>
                        {OBLASTI.map(o => <option key={o}>{o}</option>)}
                      </select>
                      {/* Role badge / select */}
                      {isMe ? (
                        <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: rl.bg, color: rl.color }}>{rl.label}</span>
                      ) : (
                        <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                          style={{ padding: '4px 8px', background: rl.bg, border: `1px solid ${rl.color}44`, borderRadius: 6, color: rl.color, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          <option value="user">USER</option>
                          <option value="admin">ADMIN</option>
                        </select>
                      )}
                      <button onClick={() => removeUser(u.id)} disabled={isMe}
                        style={{ background: 'none', border: 'none', color: isMe ? T.border : '#f87171', cursor: isMe ? 'default' : 'pointer', fontSize: 16, padding: '0 4px', flexShrink: 0 }}>✕</button>
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

