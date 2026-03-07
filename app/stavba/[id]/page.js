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
// MZDY: mont_vn obsahuje VN venkovní + VN kabelové + TS technologie + TS vnitřní
const MZDY = [
  { key:"mont_vn",       label:"Montáž VN + TS",          isZem:false },
  { key:"mont_nn",       label:"Montáž NN",               isZem:false },
  { key:"mont_opto",     label:"Montáž Opto",             isZem:false },
  { key:"zem_vn",        label:"Zemní VN",                isZem:true  },
  { key:"zem_nn",        label:"Zemní NN",                isZem:true  },
  { key:"rezerv_mont",   label:"Rezerva montáž", editLabel:true, isZem:false },
]
const MECH = [
  { key:"jerab",    label:"Autojeřáb hydr. ruka" },
  { key:"nakladni", label:"Nákladní auto" },
  { key:"traktor",  label:"Traktor" },
  { key:"plosina",  label:"Plošina" },
  // ponorný vibrátor patří do ZEMNI / kompresor
]
const ZEMNI = [
  { key:"zemni_prace",  label:"Zemní práce" },
  { key:"zadlazby",     label:"Zádlažby" },
  { key:"bagr",         label:"Bagr" },
  { key:"kompresor",    label:"Kompresor" },
  { key:"ponorny_vib",  label:"Ponorný vibrátor" },
  { key:"rezac",        label:"Řezač asfaltu" },
  { key:"uhlova_zem",   label:"Úhlová bruska" },
  { key:"mot_pech",     label:"Motorový pěch" },
  { key:"nalosute",     label:"Naložení a doprava sutě" },
  { key:"stav_prace",   label:"Stav. práce m. rozsahu" },
  { key:"optotrubka",   label:"Optotrubka" },
  { key:"protlak",      label:"Protlak (zadej záporně)", isProtlak:true },
  { key:"roura_pe",     label:"Roura PE – říz. protlaky", noIdx:true },
  { key:"mat_vlastni",  label:"Materiál vlastní", noIdx:true },
  { key:"pisek_d02",    label:"Písek D0-2", noIdx:true },
  { key:"pisek_b04",    label:"Štěrkopísek B 0-4", noIdx:true },
  { key:"pisek_beton",  label:"Betonářský písek", noIdx:true },
  { key:"sterk_032",    label:"Štěrkodrť 0-32", noIdx:true },
  { key:"sterk_3264",   label:"Štěrkokamen 32-64", noIdx:true },
  { key:"beton",        label:"Beton", noIdx:true },
  { key:"asfalt",       label:"Asfalt" },
  { key:"rezerv_zemni", label:"Rezerva zemní", editLabel:true },
]
const GN = [
  { key:"inzenyrska",     label:"Inženýrská činnost" },
  { key:"geodetika",      label:"Geodetické práce" },
  { key:"te_evidence",    label:"TE – tech. evidence" },
  { key:"vychozi_revize", label:"Výchozí revize" },
  { key:"pripl_ppn",      label:"Příplatek PPN NN" },
  { key:"stimul_prirazka",label:"Stimulační přirážka" },
  { key:"ekolog_likv",    label:"Ekolog. likv. odpadů" },
  { key:"material_vyn",   label:"Materiál výnosový" },
  { key:"doprava_mat",    label:"Doprava mat. na stavbu" },
  { key:"gzs_silnice",    label:"GZS – Silniční provoz / rušení dopravy" },
  { key:"gzs_vn",         label:"GZS – Provozní vlivy VN/VVN" },
  { key:"gzs_zeleznice",  label:"GZS – Železniční provoz do 10 m od koleje" },
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

// Automatický výpočet Materiálu zhotovitele
// = Materiál vlastní - (písek + štěrkopísek + betonářský písek + štěrkodrť + štěrkokamen + beton + roura PE + asfalt)
function computeMatZhot(zemni) {
  const matV   = itemSum(zemni['mat_vlastni']?.rows  || mkRows())
  const odecti = ['pisek_d02','pisek_b04','pisek_beton','sterk_032','sterk_3264','beton','roura_pe','asfalt']
    .reduce((a, k) => a + itemSum(zemni[k]?.rows || mkRows()), 0)
  return Math.max(0, matV - odecti)
}

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
    const idx = it.noIdx ? 0 : it.isProtlak ? 0 : -0.15
    const sP  = bez * (1 + pri) * (1 + idx)
    zemniT[it.key] = { bez, idx, sP }
    if (!it.isProtlak) { zemniSumBez += bez; zemniSumS += sP }
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

  // Materiál zhotovitele = automaticky z materiálu vlastního
  const matZhotAuto = computeMatZhot(s.zemni)
  const matZhot = matZhotAuto, prispSklad = num(s.prispevek_sklad)
  const bazova = mzdySumS + mechSumS + zemniSumS + gnSumS + dofSumS + matZhot + prispSklad
  const celkemZisk = mzdyZisk + mechZisk + zemniZisk + gnZisk

  return { mzdyT, mzdySumBez, mzdySumS, mzdyZisk, mechT, mechSumBez, mechSumS, mechZisk, zemniT, zemniSumBez, zemniSumS, zemniZisk, gnT, gnSumBez, gnSumS, gnZisk, dofBez, dofSumS, matZhot, prispSklad, bazova, celkemZisk }
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

function Sekce({ secKey, items, data, color, icon, label, handlers, sumS, zisk, T, onLabelChange }) {
  const { toggle, addRow, changeRow, removeRow } = handlers
  const total = sumS

  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, marginBottom:12, overflow:'hidden' }}>
      <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:16 }}>{icon}</span>
        <span style={{ color, fontWeight:800, fontSize:14, flex:1 }}>{label}</span>
        <span style={{ color:T.muted, fontFamily:'monospace', fontSize:12 }}>Σ {fmt(total)} Kč</span>
        {zisk != null && total > 0 && <span style={{ color: zisk>=0?'#10b981':'#ef4444', fontFamily:'monospace', fontSize:11, marginLeft:12 }}>zisk {fmt(zisk)}</span>}
      </div>
      <div style={{ padding:'10px 14px' }}>
        {items.map(it => {
          const sec = data[it.key] || { rows: mkRows(), open: false }
          const rowTotal = itemSum(sec.rows)
          const cnt = sec.rows.length
          // Label pro editovatelné sekce
          const displayLabel = it.editLabel
            ? (data[it.key]?.customLabel || it.label)
            : it.label
          const isProtlak = it.isProtlak
          const protlakVal = isProtlak ? Math.abs(rowTotal) : 0

          return (
            <div key={it.key} style={{ marginBottom:6 }}>
              <div onClick={() => toggle(secKey, it.key)}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6, cursor:'pointer',
                  background: sec.open ? `${color}12` : 'transparent',
                  border:`1px solid ${sec.open ? color+'30' : T.border}` }}>
                <div style={{ width:7, height:7, borderRadius:2, background: rowTotal!=0 ? color : T.border, flexShrink:0 }}/>
                <span style={{ color: sec.open ? color : rowTotal!=0 ? T.text : T.muted, fontSize:13, fontWeight: sec.open?700:400, flex:1 }}>
                  {displayLabel}
                  {isProtlak && rowTotal < 0 && <span style={{ color:'#f59e0b', fontSize:10, marginLeft:6 }}>→ Protlaky: {fmt(protlakVal)} Kč</span>}
                </span>
                {cnt > 1 && <span style={{ background:`${color}22`, color, fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:4 }}>{cnt}×</span>}
                <span style={{ fontFamily:'monospace', fontSize:12, fontWeight: rowTotal!=0?700:400, color: isProtlak&&rowTotal<0 ? '#f97316' : sec.open ? color : rowTotal!=0 ? T.text : T.muted }}>
                  {fmt(rowTotal)}{isProtlak && rowTotal < 0 ? '' : ''}
                </span>
                <span style={{ color:T.muted, fontSize:10 }}>{sec.open?'▲':'▼'}</span>
              </div>
              {sec.open && (
                <div style={{ padding:'10px 10px 6px', background:`${color}08`, borderRadius:'0 0 6px 6px', border:`1px solid ${color}20`, borderTop:'none' }}>
                  {/* Editovatelný label pro rezervy */}
                  {it.editLabel && (
                    <div style={{ marginBottom:8 }}>
                      <input
                        value={data[it.key]?.customLabel || ''}
                        placeholder={it.label + ' (název…)'}
                        onClick={e => e.stopPropagation()}
                        onChange={e => onLabelChange && onLabelChange(secKey, it.key, e.target.value)}
                        style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:`1px solid ${color}40`, borderRadius:5, color, fontSize:12, padding:'5px 9px', outline:'none', boxSizing:'border-box', fontStyle:'italic' }}
                      />
                    </div>
                  )}
                  {isProtlak && (
                    <div style={{ padding:'5px 8px', marginBottom:8, background:'rgba(249,115,22,0.1)', borderRadius:5, color:'#f97316', fontSize:11 }}>
                      ⚠️ Zadej zápornou hodnotu (např. -39524). Kladná částka přejde do sloupce Protlaky v rozboru.
                    </div>
                  )}
                  {sec.rows.map((row, idx) => (
                    <ItemRow key={row.id} row={row} color={isProtlak ? '#f97316' : color} T={T}
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
                    <span style={{ color: isProtlak&&rowTotal<0?'#f97316':color, fontFamily:'monospace', fontSize:13, fontWeight:800 }}>
                      {fmt(rowTotal)} {it.isZem !== undefined ? 'hod' : 'Kč'}
                    </span>
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

  const handleLabelChange = (secName, key, val) =>
    setS(prev => ({ ...prev, [secName]: { ...prev[secName], [key]: { ...prev[secName][key], customLabel: val } } }))

  if (!s) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', color:'#64748b' }}>Načítám…</div>

  const c = compute(s)
  const mzdyH = makeH('mzdy'), mechH = makeH('mech'), zemniH = makeH('zemni'), gnH = makeH('gn'), dofH = makeH('dof')

  // Protlaky hodnota pro rozbor (kladná)
  const protlakVal = Math.abs(itemSum(s.zemni['protlak']?.rows || mkRows()))

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

            <Sekce secKey="mzdy"  items={MZDY}  data={s.mzdy}  T={T} color={SEC.mzdy.color}  icon={SEC.mzdy.icon}  label={SEC.mzdy.label}  sumS={c.mzdySumS}  zisk={c.mzdyZisk}  handlers={mzdyH}  onLabelChange={handleLabelChange} />
            <Sekce secKey="mech"  items={MECH}  data={s.mech}  T={T} color={SEC.mech.color}  icon={SEC.mech.icon}  label={SEC.mech.label}  sumS={c.mechSumS}  zisk={c.mechZisk}  handlers={mechH}  onLabelChange={handleLabelChange} />
            <Sekce secKey="zemni" items={ZEMNI} data={s.zemni} T={T} color={SEC.zemni.color} icon={SEC.zemni.icon} label={SEC.zemni.label} sumS={c.zemniSumS} zisk={c.zemniZisk} handlers={zemniH} onLabelChange={handleLabelChange} />
            <Sekce secKey="gn"    items={GN}    data={s.gn}    T={T} color={SEC.gn.color}    icon={SEC.gn.icon}    label={SEC.gn.label}    sumS={c.gnSumS}    zisk={c.gnZisk}    handlers={gnH}    onLabelChange={handleLabelChange} />
            <Sekce secKey="dof"   items={DOF}   data={s.dof}   T={T} color={SEC.dof.color}   icon={SEC.dof.icon}   label={SEC.dof.label}   sumS={c.dofSumS}               handlers={dofH}   onLabelChange={handleLabelChange} />

            {/* Ostatní */}
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:'14px 16px', marginBottom:12 }}>
              <div style={{ color:'#14b8a6', fontSize:11, fontWeight:800, letterSpacing:1, textTransform:'uppercase', marginBottom:12 }}>🔧 Ostatní</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:14 }}>
                {[
                  { l:'Materiál zhotovitele', k:'mat_zhotovitele', note:'počítá se automaticky', readOnly:true, val: fmt(c.matZhot) },
                  { l:'Příspěvek na sklad',   k:'prispevek_sklad' },
                ].map(({l,k,note,readOnly,val})=>(
                  <div key={k}>
                    <div style={{ color:T.muted, fontSize:10, fontWeight:700, marginBottom:2 }}>{l}</div>
                    {note&&<div style={{ color:T.muted, fontSize:10, fontStyle:'italic', marginBottom:4 }}>{note}</div>}
                    {readOnly ? (
                      <div style={{ width:'100%', background:'rgba(20,184,166,0.08)', border:`1px solid rgba(20,184,166,0.3)`, borderRadius:6, color:'#14b8a6', fontSize:13, padding:'7px 10px', boxSizing:'border-box', fontFamily:'monospace', fontWeight:700 }}>{val} Kč</div>
                    ) : (
                      <input type="text" value={s[k]??''} placeholder="0" onChange={e=>setField(k,e.target.value)}
                        style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${T.border}`, borderRadius:6, color:'#14b8a6', fontSize:13, padding:'7px 10px', outline:'none', boxSizing:'border-box', fontFamily:'monospace' }} />
                    )}
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
              const cols = '2fr 1fr 1fr 1fr 1fr 1fr 1fr'

              const TH = ({children}) => (
                <div style={{ color:T.muted, fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:0.5, textAlign:'right', padding:'4px 6px' }}>{children}</div>
              )
              const SekceHeader = ({label, color, icon}) => (
                <div style={{ display:'grid', gridTemplateColumns:cols, background:`${color}18`, borderRadius:'6px 6px 0 0', borderBottom:`2px solid ${color}`, marginTop:14 }}>
                  <div style={{ padding:'7px 8px', color, fontWeight:800, fontSize:12 }}>{icon} {label}</div>
                  <TH>Bez přirážky</TH><TH>Přirážka</TH><TH>S přirážkou</TH><TH>Index</TH><TH>K vyplacení</TH><TH>Vyplaceno</TH>
                </div>
              )
              const Row = ({label, bez, priR, sP, idx, kVypl, vypl, color, isTotal, highlight}) => (
                <div style={{ display:'grid', gridTemplateColumns:cols, background: isTotal?`${color}10`:highlight?'rgba(249,115,22,0.06)':'transparent', borderBottom:`1px solid ${T.border}40`, borderRadius:isTotal?'0 0 6px 6px':0 }}>
                  <div style={{ padding:'5px 8px', color:isTotal?color:highlight?'#f97316':T.text, fontSize:isTotal?12:11, fontWeight:isTotal?700:400 }}>{label}</div>
                  {[
                    bez !== 0 ? fmt(Math.abs(bez)) : '—',
                    `${((priR??pri)*100).toFixed(1)} %`,
                    sP !== 0 ? fmt(Math.abs(sP)) : '—',
                    idx !== undefined ? `${(idx*100).toFixed(0)} %` : '—',
                    kVypl > 0 ? fmt(kVypl) : '—',
                    vypl > 0 ? fmt(vypl) : '—',
                  ].map((v,i) => (
                    <div key={i} style={{ padding:'5px 6px', textAlign:'right', fontFamily:'monospace', fontSize:11, color: isTotal&&i===4?color : i===5&&vypl>0?'#f59e0b' : T.muted, fontWeight:isTotal?700:400 }}>{v}</div>
                  ))}
                </div>
              )

              // MZDY
              const mzdyRows = MZDY.map(it => {
                const hod = itemSum(s.mzdy[it.key]?.rows||[])
                const saz = it.isZem ? zmesZ : zmesM
                const bez = hod * saz
                return { label: s.mzdy[it.key]?.customLabel || it.label, bez, sP: bez*(1+pri), kVypl: bez*0.66, idx:0 }
              })
              const mzdyBez = mzdyRows.reduce((a,r)=>a+r.bez,0)
              const mzdySP = mzdyBez*(1+pri)

              // MECH
              const mechRows = MECH.map(it => {
                const bez = itemSum(s.mech[it.key]?.rows||[])
                return { label: it.label, bez, sP: bez*(1+pri), kVypl: bez*0.8, idx:0 }
              })
              const mechBez = mechRows.reduce((a,r)=>a+r.bez,0)
              const mechSP = mechBez*(1+pri)

              // ZEMNÍ – protlak je zvláštní řádek (kladná hodnota)
              const zemniRows = ZEMNI.map(it => {
                const bez = itemSum(s.zemni[it.key]?.rows||[])
                const idx = it.noIdx ? 0 : it.isProtlak ? 0 : -0.15
                const sP = it.isProtlak ? Math.abs(bez)*(1+pri) : bez*(1+pri)*(1+idx)
                return { label: s.zemni[it.key]?.customLabel || it.label, bez: it.isProtlak ? Math.abs(bez) : bez, sP, idx, kVypl: sP*0.8, isProtlak: it.isProtlak }
              })
              const zemniSP = zemniRows.filter(r=>!r.isProtlak).reduce((a,r)=>a+r.sP,0)

              // GN
              const gnRows = GN.map(it => {
                const bez = itemSum(s.gn[it.key]?.rows||[])
                return { label: it.label, bez, sP: bez*(1+pri), kVypl: bez*0.8, idx:0 }
              })
              const gnBez = gnRows.reduce((a,r)=>a+r.bez,0)
              const gnSP = gnBez*(1+pri)

              const dofBez = DOF.reduce((a,it)=>a+itemSum(s.dof[it.key]?.rows||[]),0)
              const dofSP = dofBez*(1+pri)
              const matZhot = c.matZhot, prispSklad = num(s.prispevek_sklad)
              const bazova = mzdySP+mechSP+zemniSP+gnSP+dofSP+matZhot+prispSklad

              return (
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:'12px 14px', fontSize:11, overflowX:'auto' }}>
                  <SekceHeader label="Mzdy montáže" color="#3b82f6" icon="👷" />
                  {mzdyRows.map((r,i) => <Row key={i} {...r} color="#3b82f6" />)}
                  <Row label="CELKEM MZDY" bez={mzdyBez} sP={mzdySP} idx={0} kVypl={mzdyBez*0.66} vypl={num(s.vypl_mzdy)} color="#3b82f6" isTotal />

                  <SekceHeader label="Mechanizace" color="#f59e0b" icon="🚜" />
                  {mechRows.map((r,i) => <Row key={i} {...r} color="#f59e0b" />)}
                  <Row label="CELKEM MECHANIZACE" bez={mechBez} sP={mechSP} idx={0} kVypl={mechBez*0.8} vypl={num(s.vypl_mech)} color="#f59e0b" isTotal />

                  <SekceHeader label="Zemní práce" color="#ef4444" icon="⛏️" />
                  {zemniRows.map((r,i) => <Row key={i} {...r} color={r.isProtlak?'#f97316':'#ef4444'} highlight={r.isProtlak} />)}
                  <Row label="CELKEM ZEMNÍ PRÁCE (bez protlaků)" bez={zemniRows.filter(r=>!r.isProtlak).reduce((a,r)=>a+r.bez,0)} sP={zemniSP} idx={-0.15} kVypl={zemniSP*0.8} vypl={num(s.vypl_zemni)} color="#ef4444" isTotal />

                  <SekceHeader label="Globální náklady" color="#10b981" icon="📋" />
                  {gnRows.map((r,i) => <Row key={i} {...r} color="#10b981" />)}
                  <Row label="CELKEM GLOBÁLNÍ NÁKLADY" bez={gnBez} sP={gnSP} idx={0} kVypl={gnBez*0.8} vypl={num(s.vypl_gn)} color="#10b981" isTotal />

                  <SekceHeader label="Ostatní položky" color="#8b5cf6" icon="🔧" />
                  <Row label="Mat. zhotovitele (auto)" bez={matZhot} priR={0} sP={matZhot} idx={0} kVypl={matZhot*0.8} color="#8b5cf6" />
                  <Row label="Příspěvek na sklad" bez={prispSklad} sP={prispSklad*(1+pri)} idx={0} kVypl={prispSklad*0.8} color="#8b5cf6" />
                  <Row label="Doloženo fakturou" bez={dofBez} sP={dofSP} idx={0} kVypl={dofSP} color="#8b5cf6" />

                  {/* CELKEM */}
                  <div style={{ display:'grid', gridTemplateColumns:cols, background:'rgba(37,99,235,0.15)', borderRadius:8, marginTop:10, border:'2px solid rgba(37,99,235,0.4)' }}>
                    <div style={{ padding:'9px 8px', color:'#60a5fa', fontWeight:900, fontSize:13 }}>CELKEM ZA STAVBU</div>
                    <div style={{ padding:'9px 6px', textAlign:'right', fontFamily:'monospace', fontSize:12, fontWeight:700, color:'#60a5fa' }}>{fmt(mzdyBez+mechBez+zemniRows.filter(r=>!r.isProtlak).reduce((a,r)=>a+r.bez,0)+gnBez+dofBez+matZhot+prispSklad)}</div>
                    <div style={{ padding:'9px 6px', textAlign:'right', fontFamily:'monospace', fontSize:11, color:T.muted }}>{(pri*100).toFixed(1)} %</div>
                    <div style={{ padding:'9px 6px', textAlign:'right', fontFamily:'monospace', fontSize:12, fontWeight:700, color:'#60a5fa' }}>{fmt(bazova)}</div>
                    <div/>
                    <div style={{ padding:'9px 6px', textAlign:'right', fontFamily:'monospace', fontSize:11, color:T.muted }}>{fmt(mzdyBez*0.66+mechBez*0.8+zemniSP*0.8+gnBez*0.8)}</div>
                    <div style={{ padding:'9px 6px', textAlign:'right', fontFamily:'monospace', fontSize:12, fontWeight:700, color:'#f59e0b' }}>{fmt(num(s.vypl_mzdy)+num(s.vypl_mech)+num(s.vypl_zemni)+num(s.vypl_gn))}</div>
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
