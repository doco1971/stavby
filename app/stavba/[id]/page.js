'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import { useTheme } from '../../layout'

// ── helpers ──────────────────────────────────────────────
const uid  = () => Math.random().toString(36).slice(2, 9)
const num  = v  => parseFloat(String(v).replace(/\s/g,'').replace(',','.')) || 0
const fmt  = n  => Math.round(n).toLocaleString('cs-CZ')
const pct  = v  => (num(v) * 100).toFixed(2)

// ── definice sekcí ───────────────────────────────────────
const MZDY = [
  { key:"mont_vn",    label:"Montáž VN",              isZem:false },
  { key:"mont_nn",    label:"Montáž NN",              isZem:false },
  { key:"mont_opto",  label:"Montáž Opto",            isZem:false },
  { key:"mont_ts",    label:"Montáž TS",              isZem:false },
  { key:"zem_vn",     label:"Zemní VN",               isZem:true  },
  { key:"zem_nn",     label:"Zemní NN",               isZem:true  },
  { key:"uhlova_bruska", label:"Úhlová bruska",       isZem:true  },
  { key:"rezerv_mont",label:"Rezerva montáž",         isZem:false },
]
const MECH = [
  { key:"jerab",    label:"Jeřáb" },
  { key:"nakladni", label:"Nákladní auto" },
  { key:"traktor",  label:"Traktor" },
  { key:"plosina",  label:"Plošina" },
]
const ZEMNI = [
  { key:"zemni_prace",  label:"Zemní práce" },
  { key:"zadlazby",     label:"Zádlažby" },
  { key:"bagr",         label:"Bagr" },
  { key:"kompresor",    label:"Kompresor" },
  { key:"rezac",        label:"Řezač asfaltu" },
  { key:"mot_pech",     label:"Motorový pěch" },
  { key:"nalosute",     label:"Naložení a doprava sutě" },
  { key:"stav_prace",   label:"Stav. práce m. rozsahu" },
  { key:"optotrubka",   label:"Optotrubka" },
  { key:"protlak",      label:"Protlak" },
  { key:"roura_pe",     label:"Roura PE – říz. protlaky", noIdx:true },
  { key:"pisek",        label:"Písek", noIdx:true },
  { key:"sterk",        label:"Štěrk", noIdx:true },
  { key:"beton",        label:"Beton", noIdx:true },
  { key:"asfalt",       label:"Asfalt" },
  { key:"rezerv_zemni", label:"Rezerva zemní" },
]
const GN = [
  { key:"inzenyrska",     label:"Inženýrská činnost" },
  { key:"geodetika",      label:"Geodetické práce" },
  { key:"te_evidence",    label:"TE – tech. evidence" },
  { key:"vychozi_revize", label:"Výchozí revize" },
  { key:"pripl_ppn",      label:"Příplatek PPN NN" },
  { key:"ekolog_likv",    label:"Ekolog. likv. odpadů" },
  { key:"material_vyn",   label:"Materiál výnosový" },
  { key:"doprava_mat",    label:"Doprava mat. na stavbu" },
  { key:"popl_ver",       label:"Popl. za veřej. prostr." },
  { key:"pripl_capex",    label:"Příplatek Capex / Opex" },
  { key:"kolaudace",      label:"Kolaudace" },
]
const DOF = [
  { key:"dio",           label:"DIO – Dopravní značení" },
  { key:"vytyc_siti",    label:"Vytýčení sítí" },
  { key:"neplanvykon",   label:"Neplánovaný výkon" },
  { key:"spravni_popl",  label:"Správní poplatky" },
  { key:"demontaz",      label:"Demontáž – nestandart" },
  { key:"spec_zadlazby", label:"Speciální zádlažby" },
  { key:"omezeni_dopr",  label:"Omezení sil./žel. dopr." },
  { key:"rezerva",       label:"Rezerva" },
]
const SEC = {
  mzdy:  { color:'#3b82f6', icon:'👷', label:'Mzdy montáže' },
  mech:  { color:'#f59e0b', icon:'🚜', label:'Mechanizace' },
  zemni: { color:'#ef4444', icon:'⛏️', label:'Zemní práce' },
  gn:    { color:'#10b981', icon:'📋', label:'Globální náklady' },
  dof:   { color:'#8b5cf6', icon:'🧾', label:'Doloženo fakturou' },
}

const mkRows = () => [{ id: uid(), popis:'', castka:'' }]
const mkSec  = items => Object.fromEntries(items.map(it => [it.key, { rows: mkRows(), open: false }]))
const itemSum = rows => rows.reduce((a, r) => a + num(r.castka), 0)

function compute(s) {
  const pri = num(s.prirazka), zmesM = num(s.zmes_mont), zmesZ = num(s.zmes_zem)
  const mzdyT = {}; let mzdySumBez = 0
  for (const it of MZDY) {
    const rows = s.mzdy[it.key]?.rows || mkRows()
    const hod = itemSum(rows)
    const bez = hod * (it.isZem ? zmesZ : zmesM)
    const sP  = bez * (1 + pri)
    mzdyT[it.key] = { hod, bez, sP }
    mzdySumBez += bez
  }
  const mzdySumS = mzdySumBez * (1 + pri)
  const mzdyZisk = (mzdySumS - num(s.vypl_mzdy)) * 0.66

  const mechT = {}; let mechSumBez = 0
  for (const it of MECH) {
    const bez = itemSum(s.mech[it.key]?.rows || mkRows())
    const sP  = bez * (1 + pri)
    mechT[it.key] = { bez, sP }
    mechSumBez += bez
  }
  const mechSumS = mechSumBez * (1 + pri)
  const mechZisk = mechSumS - num(s.vypl_mech)

  const zemniT = {}; let zemniSumBez = 0, zemniSumS = 0
  for (const it of ZEMNI) {
    const bez = itemSum(s.zemni[it.key]?.rows || mkRows())
    const idx = it.noIdx ? 0 : -0.15
    const sP  = bez * (1 + pri) * (1 + idx)
    zemniT[it.key] = { bez, idx, sP }
    zemniSumBez += bez; zemniSumS += sP
  }
  const zemniZisk = zemniSumS - num(s.vypl_zemni)

  const gnT = {}; let gnSumBez = 0
  for (const it of GN) {
    const bez = itemSum(s.gn[it.key]?.rows || mkRows())
    const sP  = bez * (1 + pri)
    gnT[it.key] = { bez, sP }
    gnSumBez += bez
  }
  const gnSumS = gnSumBez * (1 + pri)
  const gnZisk = gnSumS - num(s.vypl_gn)

  const dofBez = DOF.reduce((a, it) => a + itemSum(s.dof[it.key]?.rows || mkRows()), 0)
  const dofSumS = dofBez * (1 + pri)

  const gzs = num(s.gzs), matZhot = num(s.mat_zhotovitele), prispSklad = num(s.prispevek_sklad)
  const bazova = mzdySumS + mechSumS + zemniSumS + gnSumS + dofSumS + gzs + matZhot + prispSklad
  const celkemZisk = mzdyZisk + mechZisk + zemniZisk + gnZisk

  return { mzdyT, mzdySumBez, mzdySumS, mzdyZisk, mechT, mechSumBez, mechSumS, mechZisk, zemniT, zemniSumBez, zemniSumS, zemniZisk, gnT, gnSumBez, gnSumS, gnZisk, dofBez, dofSumS, gzs, matZhot, prispSklad, bazova, celkemZisk }
}

// ── komponenty ───────────────────────────────────────────
function ItemRow({ row, color, T, onChange, onRemove, canRemove }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 140px 28px', gap:6, marginBottom:5 }}>
      <input value={row.popis} placeholder="Popis…" onChange={e => onChange({ ...row, popis: e.target.value })}
        style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${T.border}`, borderRadius:5, color:T.text, fontSize:12, padding:'5px 9px', outline:'none', fontFamily:'system-ui' }} />
      <input value={row.castka} placeholder="0" onChange={e => onChange({ ...row, castka: e.target.value })}
        style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${T.border}`, borderRadius:5, color, fontSize:12, padding:'5px 9px', outline:'none', fontFamily:'monospace', textAlign:'right' }} />
      <button onClick={onRemove} style={{ background:'none', border:'none', color: canRemove ? '#ef4444' : 'transparent', fontSize:14, cursor: canRemove ? 'pointer' : 'default', padding:0 }}>✕</button>
    </div>
  )
}

function Sekce({ secKey, items, data, color, icon, label, handlers, sumS, zisk, T }) {
  const { toggle, addRow, changeRow, removeRow } = handlers
  const total = sumS
  const openCount = items.filter(it => data[it.key]?.open).length

  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, marginBottom:12, overflow:'hidden' }}>
      <div onClick={() => {}} style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:16 }}>{icon}</span>
        <span style={{ color, fontWeight:800, fontSize:14, flex:1 }}>{label}</span>
        <span style={{ color:T.muted, fontFamily:'monospace', fontSize:12 }}>Σ {fmt(total)} Kč</span>
        {zisk != null && total > 0 && <span style={{ color: zisk>=0?'#10b981':'#ef4444', fontFamily:'monospace', fontSize:11, marginLeft:12 }}>zisk {fmt(zisk)}</span>}
      </div>
      <div style={{ padding:'10px 14px' }}>
        {items.map(it => {
          const sec = data[it.key] || { rows: mkRows(), open: false }
          const total = it.isZem !== undefined ? itemSum(sec.rows) : itemSum(sec.rows)
          const cnt = sec.rows.length
          return (
            <div key={it.key} style={{ marginBottom:6 }}>
              <div onClick={() => toggle(secKey, it.key)}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6, cursor:'pointer', background: sec.open ? `${color}12` : 'transparent', border:`1px solid ${sec.open ? color+'30' : T.border}` }}>
                <div style={{ width:7, height:7, borderRadius:2, background: total>0 ? color : T.border, flexShrink:0 }}/>
                <span style={{ color: sec.open ? color : total>0 ? T.text : T.muted, fontSize:13, fontWeight: sec.open?700:400, flex:1 }}>{it.label}</span>
                {cnt > 1 && <span style={{ background:`${color}22`, color, fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:4 }}>{cnt}×</span>}
                <span style={{ fontFamily:'monospace', fontSize:12, fontWeight: total>0?700:400, color: sec.open ? color : total>0 ? T.text : T.muted }}>{fmt(total)}</span>
                <span style={{ color:T.muted, fontSize:10 }}>{sec.open?'▲':'▼'}</span>
              </div>
              {sec.open && (
                <div style={{ padding:'10px 10px 6px', background:`${color}08`, borderRadius:'0 0 6px 6px', border:`1px solid ${color}20`, borderTop:'none' }}>
                  {sec.rows.map((row, idx) => (
                    <ItemRow key={row.id} row={row} color={color} T={T}
                      onChange={r => changeRow(secKey, it.key, idx, r)}
                      onRemove={() => removeRow(secKey, it.key, idx)}
                      canRemove={sec.rows.length > 1} />
                  ))}
                  <button onClick={() => addRow(secKey, it.key)}
                    style={{ width:'100%', padding:'5px 10px', background:'transparent', border:`1px dashed ${color}40`, borderRadius:5, color, fontSize:11, cursor:'pointer', marginBottom:6 }}>
                    + přidat řádek
                  </button>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 8px' }}>
                    <span style={{ color:T.muted, fontSize:11 }}>Součet</span>
                    <span style={{ color, fontFamily:'monospace', fontSize:13, fontWeight:800 }}>{fmt(itemSum(sec.rows))} {it.isZem !== undefined ? 'hod' : 'Kč'}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── hlavní stránka ────────────────────────────────────────
export default function StavbaPage() {
  const { dark, toggle: toggleTheme, T } = useTheme()
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const [s, setS]   = useState(null)
  const [tab, setTab] = useState('vstup')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('stavby').select('*').eq('id', params.id).single()
      if (!data) { router.push('/dashboard'); return }
      // Inicializace chybějících sekcí
      const mzdy  = data.mzdy  || {}; for (const it of MZDY)  if (!mzdy[it.key])  mzdy[it.key]  = { rows: mkRows(), open: false }
      const mech  = data.mech  || {}; for (const it of MECH)  if (!mech[it.key])  mech[it.key]  = { rows: mkRows(), open: false }
      const zemni = data.zemni || {}; for (const it of ZEMNI) if (!zemni[it.key]) zemni[it.key] = { rows: mkRows(), open: false }
      const gn    = data.gn    || {}; for (const it of GN)    if (!gn[it.key])    gn[it.key]    = { rows: mkRows(), open: false }
      const dof   = data.dof   || {}; for (const it of DOF)   if (!dof[it.key])   dof[it.key]   = { rows: mkRows(), open: false }
      setS({ ...data, mzdy, mech, zemni, gn, dof })
    }
    load()
  }, [params.id])

  const save = async (data = s) => {
    setSaving(true)
    await supabase.from('stavby').update(data).eq('id', params.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const setField = (k, v) => setS(prev => ({ ...prev, [k]: v }))

  const makeH = (secName) => ({
    toggle:    (_, key) => setS(prev => ({ ...prev, [secName]: { ...prev[secName], [key]: { ...prev[secName][key], open: !prev[secName][key].open } } })),
    addRow:    (_, key) => setS(prev => ({ ...prev, [secName]: { ...prev[secName], [key]: { ...prev[secName][key], rows: [...prev[secName][key].rows, { id: uid(), popis:'', castka:'' }] } } })),
    changeRow: (_, key, idx, row) => setS(prev => { const rows = [...prev[secName][key].rows]; rows[idx] = row; return { ...prev, [secName]: { ...prev[secName], [key]: { ...prev[secName][key], rows } } } }),
    removeRow: (_, key, idx) => setS(prev => { const rows = prev[secName][key].rows.filter((_, i) => i !== idx); return { ...prev, [secName]: { ...prev[secName], [key]: { ...prev[secName][key], rows } } } }),
  })

  if (!s) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', color:'#64748b' }}>Načítám…</div>

  const c = compute(s)
  const mzdyH = makeH('mzdy'), mechH = makeH('mech'), zemniH = makeH('zemni'), gnH = makeH('gn'), dofH = makeH('dof')

  return (
    <div style={{ minHeight:'100vh', background:T.bg }}>
      {/* HEADER */}
      <div style={{ background:T.header, borderBottom:`1px solid ${T.border}`, padding:'0 20px', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ maxWidth:1060, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0 0', flexWrap:'wrap' }}>
            <button onClick={() => router.push('/dashboard')} style={{ background:'transparent', border:`1px solid ${T.border}`, borderRadius:6, padding:'4px 10px', color:T.muted, fontSize:12, cursor:'pointer' }}>← zpět</button>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:10, color:T.muted, letterSpacing:1.5, textTransform:'uppercase' }}>Kalkulace stavby · {s.oblast}</div>
              <div style={{ fontSize:16, fontWeight:800, color:T.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {s.nazev || <span style={{ color:T.muted }}>Bez názvu…</span>}
              </div>
            </div>
            <div style={{ display:'flex', gap:18, flexShrink:0 }}>
              {[
                { l:'Bázová cena', v:c.bazova,     col:'#3b82f6' },
                { l:'Zisk',        v:c.celkemZisk, col:c.celkemZisk>=0?'#10b981':'#ef4444' },
              ].map(({l,v,col})=>(
                <div key={l} style={{ textAlign:'right' }}>
                  <div style={{ color:T.muted, fontSize:9, textTransform:'uppercase', letterSpacing:0.5 }}>{l}</div>
                  <div style={{ color:col, fontFamily:'monospace', fontSize:13, fontWeight:700 }}>{fmt(v)} Kč</div>
                </div>
              ))}
            </div>
            <button onClick={toggleTheme} style={{ background:'transparent', border:`1px solid ${T.border}`, borderRadius:6, padding:'5px 8px', color:T.muted, fontSize:12, cursor:'pointer' }}>{dark?'☀️':'🌙'}</button>
            <button onClick={() => save()} style={{ padding:'6px 14px', background: saved?'#10b981':'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:6, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              {saving ? '…' : saved ? '✓ Uloženo' : '💾 Uložit'}
            </button>
          </div>
          <div style={{ display:'flex', marginTop:10 }}>
            {[{k:'vstup',l:'📥 Vstupní hodnoty'},{k:'rozbor',l:'📊 Rozbor'}].map(t=>(
              <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'8px 20px', background:tab===t.k?'rgba(37,99,235,0.2)':'transparent', border:'none', borderBottom:tab===t.k?'3px solid #3b82f6':'3px solid transparent', borderRadius:'6px 6px 0 0', color:tab===t.k?'#3b82f6':T.muted, cursor:'pointer', fontSize:13, fontWeight:tab===t.k?800:400 }}>{t.l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1060, margin:'0 auto', padding:'20px 20px 60px' }}>
        {tab==='vstup' && (
          <div>
            {/* Parametry */}
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:'16px 18px', marginBottom:20 }}>
              <div style={{ color:'#f59e0b', fontSize:11, fontWeight:800, letterSpacing:1, textTransform:'uppercase', marginBottom:14 }}>⚙️ Parametry stavby</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
                {[
                  { l:'Název stavby', k:'nazev', span:true },
                  { l:'Číslo stavby', k:'cislo' },
                  { l:'Datum',        k:'datum' },
                  { l:'Oblast',       k:'oblast', isSelect:true },
                  { l:'Přirážka %',   k:'prirazka', isPct:true },
                  { l:'HZS montáž (Kč/h)', k:'hzs_mont' },
                  { l:'HZS zemní (Kč/h)',  k:'hzs_zem' },
                  { l:'ZMES montáž (Kč/h)', k:'zmes_mont' },
                  { l:'ZMES zemní (Kč/h)',  k:'zmes_zem' },
                ].map(({l,k,span,isPct,isSelect})=>(
                  <div key={k} style={span?{gridColumn:'1/-1'}:{}}>
                    <div style={{ color:T.muted, fontSize:10, fontWeight:700, letterSpacing:0.5, marginBottom:4 }}>{l}</div>
                    {isSelect ? (
                      <select value={s[k]||''} onChange={e=>setField(k,e.target.value)}
                        style={{ width:'100%', background:T.card, border:`1px solid ${T.border}`, borderRadius:6, color:T.text, fontSize:13, padding:'7px 10px', outline:'none', boxSizing:'border-box' }}>
                        {['Jihlava','Třebíč','Znojmo'].map(o=><option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type="text"
                        value={isPct ? pct(s[k]) : (s[k]??'')}
                        onChange={e=>setField(k, isPct ? String(num(e.target.value)/100) : e.target.value)}
                        style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:`1px solid ${T.border}`, borderRadius:6, color:T.text, fontSize:13, padding:'7px 10px', outline:'none', boxSizing:'border-box', fontFamily:'monospace' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Sekce secKey="mzdy"  items={MZDY}  data={s.mzdy}  T={T} color={SEC.mzdy.color}  icon={SEC.mzdy.icon}  label={SEC.mzdy.label}  sumS={c.mzdySumS}  zisk={c.mzdyZisk}  handlers={mzdyH} />
            <Sekce secKey="mech"  items={MECH}  data={s.mech}  T={T} color={SEC.mech.color}  icon={SEC.mech.icon}  label={SEC.mech.label}  sumS={c.mechSumS}  zisk={c.mechZisk}  handlers={mechH} />
            <Sekce secKey="zemni" items={ZEMNI} data={s.zemni} T={T} color={SEC.zemni.color} icon={SEC.zemni.icon} label={SEC.zemni.label} sumS={c.zemniSumS} zisk={c.zemniZisk} handlers={zemniH} />
            <Sekce secKey="gn"    items={GN}    data={s.gn}    T={T} color={SEC.gn.color}    icon={SEC.gn.icon}    label={SEC.gn.label}    sumS={c.gnSumS}    zisk={c.gnZisk}    handlers={gnH} />
            <Sekce secKey="dof"   items={DOF}   data={s.dof}   T={T} color={SEC.dof.color}   icon={SEC.dof.icon}   label={SEC.dof.label}   sumS={c.dofSumS}               handlers={dofH} />

            {/* Ostatní */}
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:'14px 16px', marginBottom:12 }}>
              <div style={{ color:'#14b8a6', fontSize:11, fontWeight:800, letterSpacing:1, textTransform:'uppercase', marginBottom:12 }}>🔧 Ostatní</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:14 }}>
                {[
                  { l:'GZS', k:'gzs' },
                  { l:'Materiál zhotovitele', k:'mat_zhotovitele', note:'není indexován' },
                  { l:'Příspěvek na sklad',   k:'prispevek_sklad' },
                ].map(({l,k,note})=>(
                  <div key={k}>
                    <div style={{ color:T.muted, fontSize:10, fontWeight:700, marginBottom:2 }}>{l}</div>
                    {note&&<div style={{ color:T.muted, fontSize:10, fontStyle:'italic', marginBottom:4 }}>{note}</div>}
                    <input type="text" value={s[k]??''} placeholder="0" onChange={e=>setField(k,e.target.value)}
                      style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${T.border}`, borderRadius:6, color:'#14b8a6', fontSize:13, padding:'7px 10px', outline:'none', boxSizing:'border-box', fontFamily:'monospace' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Vyplaceno */}
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:'14px 16px' }}>
              <div style={{ color:'#f59e0b', fontSize:11, fontWeight:800, letterSpacing:1, textTransform:'uppercase', marginBottom:12 }}>💰 Vyplaceno subdodavatelům</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                {[
                  { l:'Mzdy', k:'vypl_mzdy' },
                  { l:'Mechanizace', k:'vypl_mech' },
                  { l:'Zemní práce', k:'vypl_zemni' },
                  { l:'Glob. náklady', k:'vypl_gn' },
                ].map(({l,k})=>(
                  <div key={k}>
                    <div style={{ color:T.muted, fontSize:10, fontWeight:700, marginBottom:4 }}>{l}</div>
                    <input type="text" value={s[k]??''} placeholder="0" onChange={e=>setField(k,e.target.value)}
                      style={{ width:'100%', background:'rgba(245,158,11,0.05)', border:`1px solid rgba(245,158,11,0.3)`, borderRadius:6, color:'#f59e0b', fontSize:13, padding:'7px 10px', outline:'none', boxSizing:'border-box', fontFamily:'monospace' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab==='rozbor' && (
          <div>
            {/* HLAVIČKA */}
            <div style={{ background:'linear-gradient(135deg,rgba(37,99,235,0.12),rgba(74,158,255,0.05))', border:'1px solid rgba(74,158,255,0.25)', borderRadius:14, padding:'16px 20px', marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                <div>
                  <div style={{ color:T.muted, fontSize:10, letterSpacing:1, textTransform:'uppercase' }}>Číslo a název stavby</div>
                  <div style={{ color:T.text, fontWeight:800, fontSize:15 }}>{s.nazev}</div>
                  <div style={{ color:T.muted, fontSize:12 }}>č. {s.cislo} · {s.oblast} · {s.datum}</div>
                </div>
                <div style={{ display:'flex', gap:24 }}>
                  {[
                    { l:'Bázová cena', v:c.bazova, col:'#3b82f6' },
                    { l:'Cena s přirážkou', v:c.bazova*(1+num(s.prirazka)), col:'#60a5fa' },
                    { l:'Zisk celkem', v:c.celkemZisk, col:c.celkemZisk>=0?'#10b981':'#ef4444' },
                  ].map(({l,v,col})=>(
                    <div key={l} style={{ textAlign:'right' }}>
                      <div style={{ color:T.muted, fontSize:9, textTransform:'uppercase', letterSpacing:0.5 }}>{l}</div>
                      <div style={{ color:col, fontFamily:'monospace', fontSize:16, fontWeight:900 }}>{fmt(v)}</div>
                      <div style={{ color:T.muted, fontSize:9 }}>Kč</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Procentuální bar */}
              {c.bazova > 0 && (() => {
                const bars = [
                  {l:'Mzdy',v:c.mzdySumS,col:'#3b82f6'},{l:'Mech.',v:c.mechSumS,col:'#f59e0b'},
                  {l:'Zemní',v:c.zemniSumS,col:'#ef4444'},{l:'GN',v:c.gnSumS,col:'#10b981'},
                  {l:'Ost.',v:c.dofSumS+c.gzs+c.matZhot+c.prispSklad,col:'#8b5cf6'},
                ].filter(x=>x.v>0)
                return (<>
                  <div style={{ display:'flex', height:8, borderRadius:4, overflow:'hidden', gap:2, margin:'12px 0 6px' }}>
                    {bars.map(b=><div key={b.l} style={{ flex:b.v, background:b.col, opacity:0.85 }}/>)}
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
                    {bars.map(({l,v,col})=>(
                      <div key={l} style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <div style={{ width:8, height:8, borderRadius:2, background:col }}/>
                        <span style={{ color:T.muted, fontSize:10 }}>{l}: </span>
                        <span style={{ color:T.text, fontFamily:'monospace', fontSize:10, fontWeight:700 }}>{fmt(v)}</span>
                        <span style={{ color:T.muted, fontSize:10 }}>({(v/c.bazova*100).toFixed(1)}%)</span>
                      </div>
                    ))}
                  </div>
                </>)
              })()}
            </div>

            {/* TABULKA ROZBORU */}
            {(() => {
              const pri = num(s.prirazka)
              const zmesM = num(s.zmes_mont), zmesZ = num(s.zmes_zem)

              // Hlavička tabulky
              const TH = ({children, right}) => (
                <div style={{ color:T.muted, fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:0.5, textAlign: right?'right':'left', padding:'4px 6px' }}>{children}</div>
              )
              const cols = '2fr 1fr 1fr 1fr 1fr 1fr 1fr'

              const SekceHeader = ({label, color, icon}) => (
                <div style={{ display:'grid', gridTemplateColumns:cols, background:`${color}18`, borderRadius:'6px 6px 0 0', borderBottom:`2px solid ${color}`, marginTop:14 }}>
                  <div style={{ padding:'7px 8px', color, fontWeight:800, fontSize:12 }}>{icon} {label}</div>
                  <TH right>Bez přirážky</TH>
                  <TH right>Přirážka</TH>
                  <TH right>S přirážkou</TH>
                  <TH right>Index</TH>
                  <TH right>K vyplacení</TH>
                  <TH right>Vyplaceno</TH>
                </div>
              )

              const Row = ({label, bez, pri: p, sP, idx, kVypl, vypl, color, isBold, isTotal}) => {
                const zisk = sP - (vypl||0)
                return (
                  <div style={{ display:'grid', gridTemplateColumns:cols, background: isTotal ? `${color}10` : 'transparent', borderBottom:`1px solid ${T.border}40`, borderRadius: isTotal?'0 0 6px 6px':0 }}>
                    <div style={{ padding:'5px 8px', color: isTotal?color:T.text, fontSize: isTotal?12:11, fontWeight: isTotal||isBold?700:400 }}>{label}</div>
                    {[
                      bez > 0 ? fmt(bez) : '—',
                      `${((p||pri)*100).toFixed(1)} %`,
                      sP > 0 ? fmt(sP) : '—',
                      idx !== undefined ? `${(idx*100).toFixed(0)} %` : '—',
                      kVypl > 0 ? fmt(kVypl) : '—',
                      vypl > 0 ? fmt(vypl) : '—',
                    ].map((v,i) => (
                      <div key={i} style={{ padding:'5px 6px', textAlign:'right', fontFamily:'monospace', fontSize:11, color: isTotal&&i===4 ? color : i===5&&vypl>0 ? '#f59e0b' : T.muted, fontWeight: isTotal?700:400 }}>{v}</div>
                    ))}
                  </div>
                )
              }

              // MZDY
              const mzdyRows = MZDY.map(it => {
                const hod = itemSum(s.mzdy[it.key]?.rows||[])
                const saz = it.isZem ? zmesZ : zmesM
                const bez = hod * saz
                const sP = bez * (1 + pri)
                const kVypl = bez * 0.66
                return { label: it.label, bez, sP, kVypl, idx: 0 }
              })
              const mzdyBez = mzdyRows.reduce((a,r)=>a+r.bez,0)
              const mzdySP  = mzdyBez * (1+pri)
              const vyplMzdy = num(s.vypl_mzdy)

              // MECH
              const mechRows = MECH.map(it => {
                const bez = itemSum(s.mech[it.key]?.rows||[])
                const sP = bez * (1+pri)
                return { label: it.label, bez, sP, kVypl: bez*0.8, idx: 0 }
              })
              const mechBez = mechRows.reduce((a,r)=>a+r.bez,0)
              const mechSP  = mechBez * (1+pri)
              const vyplMech = num(s.vypl_mech)

              // ZEMNÍ
              const zemniRows = ZEMNI.map(it => {
                const bez = itemSum(s.zemni[it.key]?.rows||[])
                const idx = it.noIdx ? 0 : -0.15
                const sP = bez * (1+pri) * (1+idx)
                return { label: it.label, bez, sP, idx, kVypl: sP*0.8 }
              })
              const zemniSP = zemniRows.reduce((a,r)=>a+r.sP,0)
              const vyplZemni = num(s.vypl_zemni)

              // GN
              const gnRows = GN.map(it => {
                const bez = itemSum(s.gn[it.key]?.rows||[])
                const sP = bez * (1+pri)
                return { label: it.label, bez, sP, kVypl: bez*0.8, idx: 0 }
              })
              const gnBez = gnRows.reduce((a,r)=>a+r.bez,0)
              const gnSP  = gnBez * (1+pri)
              const vyplGN = num(s.vypl_gn)

              // DOF
              const dofBez = DOF.reduce((a,it)=>a+itemSum(s.dof[it.key]?.rows||[]),0)
              const dofSP = dofBez * (1+pri)

              const gzs = num(s.gzs), matZhot = num(s.mat_zhotovitele), prispSklad = num(s.prispevek_sklad)
              const bazova = mzdySP + mechSP + zemniSP + gnSP + dofSP + gzs + matZhot * 1 + prispSklad * (1+pri)

              return (
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:'12px 14px', fontSize:11, overflowX:'auto' }}>

                  {/* MZDY */}
                  <SekceHeader label="Mzdy montáže" color="#3b82f6" icon="👷" />
                  {mzdyRows.map((r,i) => <Row key={i} {...r} color="#3b82f6" pri={pri} />)}
                  <Row label="CELKEM MZDY" bez={mzdyBez} pri={pri} sP={mzdySP} idx={0}
                    kVypl={mzdyBez*0.66} vypl={vyplMzdy} color="#3b82f6" isTotal />

                  {/* MECHANIZACE */}
                  <SekceHeader label="Mechanizace" color="#f59e0b" icon="🚜" />
                  {mechRows.map((r,i) => <Row key={i} {...r} color="#f59e0b" pri={pri} />)}
                  <Row label="CELKEM MECHANIZACE" bez={mechBez} pri={pri} sP={mechSP} idx={0}
                    kVypl={mechBez*0.8} vypl={vyplMech} color="#f59e0b" isTotal />

                  {/* ZEMNÍ */}
                  <SekceHeader label="Zemní práce" color="#ef4444" icon="⛏️" />
                  {zemniRows.map((r,i) => <Row key={i} {...r} color="#ef4444" pri={pri} />)}
                  <Row label="CELKEM ZEMNÍ PRÁCE" bez={zemniRows.reduce((a,r)=>a+r.bez,0)} pri={pri} sP={zemniSP} idx={-0.15}
                    kVypl={zemniSP*0.8} vypl={vyplZemni} color="#ef4444" isTotal />

                  {/* GN */}
                  <SekceHeader label="Globální náklady" color="#10b981" icon="📋" />
                  {gnRows.map((r,i) => <Row key={i} {...r} color="#10b981" pri={pri} />)}
                  <Row label="CELKEM GLOBÁLNÍ NÁKLADY" bez={gnBez} pri={pri} sP={gnSP} idx={0}
                    kVypl={gnBez*0.8} vypl={vyplGN} color="#10b981" isTotal />

                  {/* OSTATNÍ */}
                  <SekceHeader label="Ostatní položky" color="#8b5cf6" icon="🔧" />
                  <Row label="Mat. zhotovitele (bez indexu)" bez={matZhot} pri={0} sP={matZhot} idx={0} kVypl={matZhot*0.8} color="#8b5cf6" />
                  <Row label="Příspěvek na sklad" bez={prispSklad} pri={pri} sP={prispSklad*(1+pri)} idx={0} kVypl={prispSklad*0.8} color="#8b5cf6" />
                  <Row label="GZS" bez={gzs} pri={pri} sP={gzs*(1+pri)} idx={0} kVypl={gzs*0.8} color="#8b5cf6" />
                  <Row label="Doloženo fakturou" bez={dofBez} pri={pri} sP={dofSP} idx={0} kVypl={dofSP} color="#8b5cf6" />

                  {/* CELKEM ZA STAVBU */}
                  <div style={{ display:'grid', gridTemplateColumns:cols, background:'rgba(37,99,235,0.15)', borderRadius:8, marginTop:10, border:'2px solid rgba(37,99,235,0.4)' }}>
                    <div style={{ padding:'9px 8px', color:'#60a5fa', fontWeight:900, fontSize:13 }}>CELKEM ZA STAVBU</div>
                    <div style={{ padding:'9px 6px', textAlign:'right', fontFamily:'monospace', fontSize:12, fontWeight:700, color:'#60a5fa' }}>{fmt(mzdyBez+mechBez+zemniRows.reduce((a,r)=>a+r.bez,0)+gnBez+dofBez+gzs+matZhot+prispSklad)}</div>
                    <div style={{ padding:'9px 6px', textAlign:'right', fontFamily:'monospace', fontSize:11, color:T.muted }}>{(pri*100).toFixed(1)} %</div>
                    <div style={{ padding:'9px 6px', textAlign:'right', fontFamily:'monospace', fontSize:12, fontWeight:700, color:'#60a5fa' }}>{fmt(bazova)}</div>
                    <div/>
                    <div style={{ padding:'9px 6px', textAlign:'right', fontFamily:'monospace', fontSize:11, color:T.muted }}>{fmt(mzdyBez*0.66+mechBez*0.8+zemniSP*0.8+gnBez*0.8)}</div>
                    <div style={{ padding:'9px 6px', textAlign:'right', fontFamily:'monospace', fontSize:12, fontWeight:700, color:'#f59e0b' }}>{fmt(vyplMzdy+vyplMech+vyplZemni+vyplGN)}</div>
                  </div>

                </div>
              )
            })()}

            <div style={{ textAlign:'right', marginTop:16 }}>
              <button onClick={()=>window.print()} style={{ padding:'10px 22px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                🖨️ Tisk / Export PDF
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
