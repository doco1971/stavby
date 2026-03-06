'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { useTheme } from '../layout'

const OBLASTI = ['Jihlava', 'Třebíč', 'Znojmo']
const fmt = n => Math.round(n || 0).toLocaleString('cs-CZ')

export default function Dashboard() {
  const { dark, toggle, T } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser]     = useState(null)
  const [profile, setProfile] = useState(null)
  const [stavby, setStavby] = useState([])
  const [filter, setFilter] = useState('vse')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      const query = supabase.from('stavby').select('*').order('updated_at', { ascending: false })
      if (prof?.role !== 'admin') query.eq('user_id', user.id)
      const { data } = await query
      setStavby(data || [])
      setLoading(false)
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
      oblast: profile?.oblast || 'Jihlava',
      nazev: 'Nová stavba',
      mzdy: {}, mech: {}, zemni: {}, gn: {}, dof: {}
    }).select().single()
    if (data) router.push(`/stavba/${data.id}`)
  }

  const filtered = filter === 'vse' ? stavby : stavby.filter(s => s.oblast === filter)

  const stavCards = filtered.map(s => (
    <div key={s.id} onClick={() => router.push(`/stavba/${s.id}`)}
      style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer', transition: 'border-color 0.2s', marginBottom: 10 }}
      onMouseEnter={e => e.currentTarget.style.borderColor = T.accent}
      onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{s.nazev}</div>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>
            {s.cislo && `č. ${s.cislo} · `}{s.oblast} · {new Date(s.updated_at).toLocaleDateString('cs-CZ')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bázová cena</div>
          <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: T.accent }}>— Kč</div>
        </div>
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: s.stav === 'dokoncena' ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)', color: s.stav === 'dokoncena' ? '#10b981' : T.muted }}>
          {s.stav === 'rozpracovana' ? 'Rozpracovaná' : s.stav === 'dokoncena' ? 'Dokončená' : 'Archivovaná'}
        </span>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.12)', color: T.accent }}>{s.oblast}</span>
      </div>
    </div>
  ))

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      {/* Header */}
      <div style={{ background: T.header, borderBottom: `1px solid ${T.border}`, padding: '0 24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, height: 58 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏗️</div>
          <div style={{ flex: 1, fontWeight: 800, fontSize: 15, color: T.text }}>Kalkulace stavby</div>
          <button onClick={toggle} style={{ background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 10px', color: T.muted, fontSize: 12, cursor: 'pointer' }}>
            {dark ? '☀️' : '🌙'}
          </button>
          <div style={{ color: T.muted, fontSize: 12 }}>{profile?.full_name || user?.email}</div>
          {profile?.role === 'admin' && <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderRadius: 4 }}>ADMIN</span>}
          <button onClick={logout} style={{ background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 12px', color: T.muted, fontSize: 12, cursor: 'pointer' }}>Odhlásit</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>
        {/* Akce + filtry */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <button onClick={novaStavba}
            style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + Nová stavba
          </button>
          {['vse', ...OBLASTI].map(o => (
            <button key={o} onClick={() => setFilter(o)}
              style={{ padding: '9px 14px', background: filter === o ? 'rgba(59,130,246,0.15)' : 'transparent', border: `1px solid ${filter === o ? T.accent : T.border}`, borderRadius: 8, color: filter === o ? T.accent : T.muted, fontSize: 13, cursor: 'pointer' }}>
              {o === 'vse' ? 'Vše' : o}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', color: T.muted, fontSize: 12, alignSelf: 'center' }}>
            {filtered.length} {filtered.length === 1 ? 'stavba' : filtered.length < 5 ? 'stavby' : 'staveb'}
          </div>
        </div>

        {/* Seznam */}
        {loading ? (
          <div style={{ textAlign: 'center', color: T.muted, padding: 60 }}>Načítám…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: T.muted, padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div>Žádné stavby. Vytvořte první kliknutím na "+ Nová stavba".</div>
          </div>
        ) : stavCards}
      </div>
    </div>
  )
}
