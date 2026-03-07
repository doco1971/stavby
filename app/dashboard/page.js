'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { useTheme } from '../layout'

const OBLASTI = ['Jihlava', 'Třebíč', 'Znojmo']

export default function Dashboard() {
  const { dark, toggle, T } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [stavby, setStavby]   = useState([])
  const [filter, setFilter]   = useState('vse')
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }
        setUser(user)

        let { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        if (!prof) {
          const { data: newProf } = await supabase.from('profiles')
            .insert({ id: user.id, email: user.email, role: 'admin', oblast: 'Třebíč' })
            .select().maybeSingle()
          prof = newProf
        }
        setProfile(prof)

        let q = supabase.from('stavby').select('*').order('updated_at', { ascending: false })
        if (prof?.role !== 'admin') q = q.eq('user_id', user.id)
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

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const novaStavba = async () => {
    const { data } = await supabase.from('stavby').insert({
      user_id: user.id,
      oblast: profile?.oblast || 'Třebíč',
      nazev: 'Nová stavba',
      mzdy: {}, mech: {}, zemni: {}, gn: {}, dof: {}
    }).select().single()
    if (data) router.push(`/stavba/${data.id}`)
  }

  const filtered = filter === 'vse' ? stavby : stavby.filter(s => s.oblast === filter)

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <div style={{ background: T.header, borderBottom: `1px solid ${T.border}`, padding: '0 24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, height: 58 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏗️</div>
          <div style={{ flex: 1, fontWeight: 800, fontSize: 15, color: T.text }}>Kalkulace stavby</div>
          <button onClick={toggle} style={{ background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 10px', color: T.muted, fontSize: 12, cursor: 'pointer' }}>{dark ? '☀️' : '🌙'}</button>
          <div style={{ color: T.muted, fontSize: 12 }}>{user?.email}</div>
          {profile?.role === 'admin' && <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderRadius: 4 }}>ADMIN</span>}
          <button onClick={() => router.push('/nastaveni')} style={{ background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 12px', color: T.muted, fontSize: 12, cursor: 'pointer' }}>⚙️ Nastavení</button>
          <button onClick={logout} style={{ background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 12px', color: T.muted, fontSize: 12, cursor: 'pointer' }}>Odhlásit</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <button onClick={novaStavba} style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Nová stavba</button>
          {['vse', ...OBLASTI].map(o => (
            <button key={o} onClick={() => setFilter(o)}
              style={{ padding: '9px 14px', background: filter === o ? 'rgba(59,130,246,0.15)' : 'transparent', border: `1px solid ${filter === o ? T.accent : T.border}`, borderRadius: 8, color: filter === o ? T.accent : T.muted, fontSize: 13, cursor: 'pointer' }}>
              {o === 'vse' ? 'Vše' : o}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', color: T.muted, fontSize: 12, alignSelf: 'center' }}>{filtered.length} staveb</div>
        </div>

        {err && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 12, marginBottom: 16 }}>⚠ {err}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', color: T.muted, padding: 60 }}>Načítám…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: T.muted, padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div>Žádné stavby. Vytvořte první kliknutím na "+ Nová stavba".</div>
          </div>
        ) : filtered.map(s => (
          <div key={s.id} onClick={() => router.push(`/stavba/${s.id}`)}
            style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer', marginBottom: 10 }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{s.nazev}</div>
                <div style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>{s.cislo && `č. ${s.cislo} · `}{s.oblast}</div>
                <div style={{ color: '#10b981', fontSize: 11, marginTop: 2 }}>🕐 Záloha: {new Date(s.updated_at).toLocaleString('cs-CZ', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase' }}>Oblast</div>
                <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: T.accent }}>{s.oblast}</div>
              </div>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(100,116,139,0.15)', color: T.muted }}>
                {s.stav === 'rozpracovana' ? 'Rozpracovaná' : s.stav === 'dokoncena' ? 'Dokončená' : 'Archivovaná'}
              </span>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.12)', color: T.accent }}>{s.oblast}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
