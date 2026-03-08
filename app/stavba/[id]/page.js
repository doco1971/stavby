'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import { useTheme } from '../../layout'

// ── helpers ──────────────────────────────────────────────
const uid  = () => Math.random().toString(36).slice(2, 9)
const num  = v  => parseFloat(String(v).replace(/\s/g,'').replace(',','.')) || 0
const fmt  = n  => Number(n).toLocaleString('cs-CZ', { minimumFractionDigits:2, maximumFractionDigits:2 })
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
  { key:"rezac",        label:"Řezač asfaltu" },
  { key:"uhlova_bruska",label:"Úhlová bruska" },
  { key:"mot_pech",     label:"Motorový pěch" },
  { key:"nalosute",     label:"Naložení a doprava sutě" },
  { key:"stav_prace",   label:"Stav. práce m. rozsahu" },
  { key:"def_fasady",    label:"Def. úprava fasád" },
  { key:"optotrubka",   label:"Optotrubka" },
  { key:"protlak",      label:"Protlak (zadej záporně)", isProtlak:true },
  { key:"roura_pe",     label:"Roura PE – říz. protlaky", noIdx:true },
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
  { key:"ekolog_likv",    label:"Ekolog. likv. odpadů" },
  { key:"material_vyn",   label:"Materiál výnosový" },
  { key:"doprava_mat",    label:"Doprava mat. na stavbu" },
  { key:"popl_ver",       label:"Popl. za veřej. prostr." },
  { key:"pripl_capex",    label:"Příplatek Capex / Opex" },
  { key:"kolaudace",      label:"Kolaudace" },
]
const DOF = [
  { key:"dio",             label:"DIO – Dopravní značení" },
  { key:"vytyc_siti",      label:"Vytýčení sítí" },
  { key:"neplanvykon",     label:"Neplánovaný výkon" },
  { key:"spravni_popl",    label:"Správní poplatky" },
  { key:"demontaz",        label:"Demontáž – nestandart" },
  { key:"spec_zadlazby",   label:"Speciální zádlažby" },
  { key:"omezeni_dopr",    label:"Omezení sil./žel. dopr." },
  { key:"rezerva",         label:"Rezerva" },
  { key:"archeolog_dozor",  label:"Archeologický dozor" },
]
const SEC = {
  mzdy:  { color:'#3b82f6', icon:'👷', label:'Mzdy montáže' },
  mech:  { color:'#f59e0b', icon:'🚜', label:'Mechanizace' },
  zemni: { color:'#ef4444', icon:'⛏️', label:'Zemní práce' },
  gn:    { color:'#10b981', icon:'📋', label:'Globální náklady' },
  dof:   { color:'#8b5cf6', icon:'🧾', label:'Ostatní náklady' },
}

const mkRows = () => [{ id: uid(), popis:'', castka:'' }]
const onEnterNext = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    const inputs = Array.from(document.querySelectorAll('input, select'))
    const idx = inputs.indexOf(e.target)
    if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus()
  }
}
const mkSec  = items => Object.fromEntries(items.map(it => [it.key, { rows: mkRows(), open: false }]))
const itemSum = rows => rows.reduce((a, r) => a + num(r.castka), 0)

// Materiál zhotovitele = mat_vlastni celkem − (písek D0-2 + štěrkopísek B0-4 + betonářský písek + štěrkodrť 0-32 + štěrkokamen 32-64 + asfalt + roura PE)
function computeMatZhot(zemni, matVlastniCelkem) {
  const odecti = ['pisek_d02','pisek_b04','pisek_beton','sterk_032','sterk_3264','asfalt','roura_pe']
    .reduce((a, k) => a + itemSum(zemni[k]?.rows || mkRows()), 0)
  const matV = (matVlastniCelkem != null && matVlastniCelkem > 0) ? matVlastniCelkem : itemSum(zemni['mat_vlastni']?.rows || mkRows())
  return Math.max(0, matV - odecti)
}
// Materiál vlastní (pro zpětnou kompatibilitu)
function computeMatVlastni(zemni) {
  return itemSum(zemni['mat_vlastni']?.rows || mkRows())
}

function compute(s) {
  const pri = num(s.prirazka), zmesM = num(s.zmes_mont), zmesZ = num(s.zmes_zem)
  const hzsM = num(s.hzs_mont), hzsZ = num(s.hzs_zem)
  const mzdyT = {}; let mzdySumBez = 0, mzdySumHzs = 0
  for (const it of MZDY) {
    const rows = s.mzdy[it.key]?.rows || mkRows()
    const hod = itemSum(rows)
    const bez = hod * (it.isZem ? zmesZ : zmesM)
    const hzs = hod * (it.isZem ? hzsZ : hzsM)
    const sP  = bez * (1 + pri)
    mzdyT[it.key] = { hod, bez, hzs, sP }
    mzdySumBez += bez
    mzdySumHzs += hzs
  }
  const mzdySumS = mzdySumBez * (1 + pri)
  const mzdyZisk = (mzdySumS - num(s.vypl_mzdy)) * 0.66
  const hodMont = MZDY.filter(i => !i.isZem).reduce((a, i) => a + (mzdyT[i.key]?.hod || 0), 0)
  const hodZem  = MZDY.filter(i =>  i.isZem).reduce((a, i) => a + (mzdyT[i.key]?.hod || 0), 0)

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

  // Materiál vlastní a zhotovitele = automatické výpočty
  const matVlastni = computeMatVlastni(s.zemni)
  const matZhot = computeMatZhot(s.zemni, matVlastni)
  const matVlastniCelkem = itemSum(s.zemni['mat_vlastni']?.rows || mkRows())
  const prispSklad = num(s.prispevek_sklad)
  const gzsKc = itemSum(s.dof['gzs']?.rows || mkRows())
  const stimulKc = itemSum(s.dof['stimul_prirazka']?.rows || mkRows())
  const bazova = mzdySumHzs + mechSumBez + zemniSumBez + gnSumBez + dofBez + matZhot + prispSklad + gzsKc + stimulKc
  const celkemZisk = mzdyZisk + mechZisk + zemniZisk + gnZisk

  return { mzdyT, mzdySumBez, mzdySumS, mzdySumHzs, mzdyZisk, hodMont, hodZem, mechT, mechSumBez, mechSumS, mechZisk, zemniT, zemniSumBez, zemniSumS, zemniZisk, gnT, gnSumBez, gnSumS, gnZisk, dofBez, dofSumS, matVlastni, matZhot, prispSklad, bazova, celkemZisk }
}

// ── Dialog: sazby po EBC importu ────────────────────────────
function SazbyDialog({ T, nazev, onConfirm, onCancel }) {
  const [vals, setVals] = useState({ prirazka:'', hzs_mont:'', hzs_zem:'', zmes_mont:'', zmes_zem:'' })
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
      <div style={{ background:T.card, border:'1px solid #3b82f6', borderRadius:14, padding:28, maxWidth:440, width:'90%' }}>
        <div style={{ color:'#3b82f6', fontWeight:800, fontSize:16, marginBottom:6 }}>⚙️ Zadej sazby pro stavbu</div>
        <div style={{ color:T.muted, fontSize:12, marginBottom:18 }}>{nazev}</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
          {[
            { l:'Přirážka %', k:'prirazka' },
            { l:'HZS montáž (Kč/h)', k:'hzs_mont' },
            { l:'HZS zemní (Kč/h)', k:'hzs_zem' },
            { l:'ZMES montáž (Kč/h)', k:'zmes_mont' },
            { l:'ZMES zemní (Kč/h)', k:'zmes_zem' },

          ].map(({l,k}) => (
            <div key={k}>
              <div style={{ color:T.muted, fontSize:10, fontWeight:700, marginBottom:4 }}>{l}</div>
              <input type="text" value={vals[k]} onChange={e => setVals(v => ({...v, [k]: e.target.value}))}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const isLast = k === 'zmes_zem'
                    if (isLast) { onConfirm(vals) }
                    else {
                      const inputs = Array.from(document.querySelectorAll('input'))
                      const idx = inputs.indexOf(e.target)
                      if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus()
                    }
                  }
                }}
                style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid #3b82f640', borderRadius:6, color:T.text, fontSize:13, padding:'7px 10px', outline:'none', boxSizing:'border-box', fontFamily:'monospace' }} />
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onCancel}
            style={{ padding:'9px 18px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:8, color:T.muted, cursor:'pointer', fontSize:13 }}>Zrušit</button>
          <button onClick={() => onConfirm(vals)}
            style={{ padding:'9px 24px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:8, color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700 }}>✓ Použít import</button>
        </div>
      </div>
    </div>
  )
}

// ── Dialog: schválení nové položky do katalogu ───────────
function KatalogDialog({ popis, sekce, vsechnySekce, T, onConfirm, onCancel }) {
  const [jeStandard, setJeStandard] = useState(false)
  const [cilSekce, setCilSekce] = useState(sekce)
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:T.card, border:`1px solid #3b82f6`, borderRadius:14, padding:28, maxWidth:440, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ color:'#3b82f6', fontWeight:800, fontSize:15, marginBottom:6 }}>📋 Nová položka v katalogu</div>
        <div style={{ color:T.muted, fontSize:13, marginBottom:18 }}>
          Položka <strong style={{ color:T.text }}>„{popis}"</strong> dosud není v katalogu. Zařadit ji?
        </div>

        <div style={{ marginBottom:14 }}>
          <div style={{ color:T.muted, fontSize:11, fontWeight:700, marginBottom:6, textTransform:'uppercase', letterSpacing:1 }}>Do které sekce patří?</div>
          <select value={cilSekce} onChange={e => setCilSekce(e.target.value)}
            style={{ width:'100%', background:T.bg, border:`1px solid ${T.border}`, borderRadius:6, color:T.text, fontSize:13, padding:'7px 10px', outline:'none' }}>
            {vsechnySekce.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
            <div onClick={() => setJeStandard(v => !v)}
              style={{ width:38, height:22, borderRadius:11, background: jeStandard ? '#3b82f6' : T.border, position:'relative', transition:'background 0.2s', flexShrink:0 }}>
              <div style={{ position:'absolute', top:3, left: jeStandard ? 19 : 3, width:16, height:16, borderRadius:8, background:'#fff', transition:'left 0.2s' }}/>
            </div>
            <div>
              <div style={{ color:T.text, fontSize:13, fontWeight:600 }}>Standardní položka</div>
              <div style={{ color:T.muted, fontSize:11 }}>Nabízet automaticky u všech příštích staveb</div>
            </div>
          </label>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => onConfirm(cilSekce, jeStandard)}
            style={{ flex:1, padding:'10px 0', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            ✓ Zařadit do katalogu
          </button>
          <button onClick={onCancel}
            style={{ padding:'10px 16px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:8, color:T.muted, fontSize:13, cursor:'pointer' }}>
            Přeskočit
          </button>
        </div>
      </div>
    </div>
  )
}

// ── komponenty ───────────────────────────────────────────
function ItemRow({ row, color, T, onChange, onRemove, canRemove, katalogItems, secKey, onNewPopis }) {
  const [open, setOpen] = useState(false)
  const val = row.popis || ''
  const suggestions = katalogItems
    ? katalogItems.filter(k => k.sekce === secKey && k.popis.toLowerCase().includes(val.toLowerCase()) && k.popis !== val)
    : []

  const handleBlur = () => {
    // Po opuštění pole — pokud je nový popis který není v katalogu, nabídneme zařazení
    setTimeout(() => {
      setOpen(false)
      if (val.trim().length > 2 && katalogItems && !katalogItems.find(k => k.popis === val.trim())) {
        onNewPopis && onNewPopis(val.trim(), secKey)
      }
    }, 200)
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 140px 28px', gap:6, marginBottom:5, position:'relative' }}>
      <div style={{ position:'relative' }}>
        <input value={val} placeholder="Popis…"
          onChange={e => { onChange({ ...row, popis: e.target.value }); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${T.border}`, borderRadius:5, color:T.text, fontSize:12, padding:'5px 9px', outline:'none', fontFamily:'system-ui', boxSizing:'border-box' }} />
        {open && suggestions.length > 0 && (
          <div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, zIndex:200, boxShadow:'0 8px 24px rgba(0,0,0,0.3)', overflow:'hidden' }}>
            {suggestions.slice(0, 6).map(s => (
              <div key={s.id} onMouseDown={() => { onChange({ ...row, popis: s.popis }); setOpen(false) }}
                style={{ padding:'7px 11px', cursor:'pointer', fontSize:12, color:T.text, borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:8 }}>
                {s.je_standard && <span style={{ fontSize:9, background:'#3b82f620', color:'#3b82f6', padding:'1px 5px', borderRadius:3, fontWeight:700 }}>STD</span>}
                {s.popis}
              </div>
            ))}
          </div>
        )}
      </div>
      <input value={row.castka} placeholder="0" onChange={e => onChange({ ...row, castka: e.target.value })}
        onKeyDown={onEnterNext}
        style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${T.border}`, borderRadius:5, color, fontSize:12, padding:'5px 9px', outline:'none', fontFamily:'monospace', textAlign:'right' }} />
      <button onClick={onRemove} style={{ background:'none', border:'none', color: canRemove ? '#ef4444' : 'transparent', fontSize:14, cursor: canRemove ? 'pointer' : 'default', padding:0 }}>✕</button>
    </div>
  )
}

// Jednoduchá sekce pro GZS a Stimulační – stejný vzhled jako položky v Sekce
function OstatniSekce({ secKey, label, data, color, T, handlers, katalog, onNewPopis, onLabelChange, editLabel }) {
  const { toggle, addRow, changeRow, removeRow } = handlers
  const sec = data[secKey] || { rows: [{ id: 'r1', popis: '', castka: '' }], open: false }
  const rowTotal = sec.rows.reduce((a, r) => a + (parseFloat(r.castka) || 0), 0)
  const cnt = sec.rows.length
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, marginBottom:12, overflow:'hidden' }}>
      <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ color, fontWeight:800, fontSize:14, flex:1 }}>{label}</span>
        <span style={{ color:T.muted, fontFamily:'monospace', fontSize:12 }}>Σ {rowTotal.toLocaleString('cs-CZ',{minimumFractionDigits:2})} Kč</span>
      </div>
      <div style={{ padding:'10px 14px' }}>
        <div style={{ marginBottom:6 }}>
          <div onClick={() => toggle('dof', secKey)}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6, cursor:'pointer',
              background: sec.open ? `${color}12` : 'transparent',
              border:`1px solid ${sec.open ? color+'30' : T.border}` }}>
            <div style={{ width:7, height:7, borderRadius:2, background: rowTotal!=0 ? color : T.border, flexShrink:0 }}/>
            <span style={{ color: sec.open ? color : rowTotal!=0 ? T.text : T.muted, fontSize:13, fontWeight: sec.open?700:400, flex:1 }}>
              {editLabel ? (data[secKey]?.customLabel || label) : label}
            </span>
            {cnt > 1 && <span style={{ background:`${color}22`, color, fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:4 }}>{cnt}×</span>}
            <span style={{ fontFamily:'monospace', fontSize:12, fontWeight: rowTotal!=0?700:400, color: sec.open ? color : rowTotal!=0 ? T.text : T.muted }}>
              {rowTotal.toLocaleString('cs-CZ',{minimumFractionDigits:2})}
            </span>
            <span style={{ color:T.muted, fontSize:10 }}>{sec.open?'▲':'▼'}</span>
          </div>
          {sec.open && (
            <div style={{ padding:'10px 10px 6px', background:`${color}08`, borderRadius:'0 0 6px 6px', border:`1px solid ${color}20`, borderTop:'none' }}>
              {editLabel && (
                <div style={{ marginBottom:8 }}>
                  <input value={data[secKey]?.customLabel || ''} placeholder={label + ' (název…)'}
                    onClick={e => e.stopPropagation()}
                    onChange={e => onLabelChange && onLabelChange('dof', secKey, e.target.value)}
                    style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:`1px solid ${color}40`, borderRadius:5, color, fontSize:12, padding:'5px 9px', outline:'none', boxSizing:'border-box', fontStyle:'italic' }} />
                </div>
              )}
              {sec.rows.map((row, idx) => (
                <ItemRow key={row.id} row={row} color={color} T={T}
                  onChange={r => changeRow('dof', secKey, idx, r)}
                  onRemove={() => removeRow('dof', secKey, idx)}
                  canRemove={sec.rows.length > 1}
                  katalogItems={katalog} secKey={secKey} onNewPopis={onNewPopis} />
              ))}
              <button onClick={() => addRow('dof', secKey)}
                style={{ width:'100%', padding:'5px 10px', background:'transparent', border:`1px dashed ${color}40`, borderRadius:5, color, fontSize:11, cursor:'pointer', marginBottom:6 }}>
                + přidat řádek
              </button>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 8px' }}>
                <span style={{ color:T.muted, fontSize:11 }}>Součet</span>
                <span style={{ color, fontFamily:'monospace', fontSize:13, fontWeight:800 }}>{rowTotal.toLocaleString('cs-CZ',{minimumFractionDigits:2})} Kč</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Sekce({ secKey, items, data, color, icon, label, handlers, sumS, sumBez, zisk, T, onLabelChange, katalog, onNewPopis, hodMont, hodZem }) {
  const { toggle, addRow, changeRow, removeRow } = handlers
  const total = sumBez != null ? sumBez : sumS

  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, marginBottom:12, overflow:'hidden' }}>
      <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:16 }}>{icon}</span>
        <span style={{ color, fontWeight:800, fontSize:14, flex:1 }}>{label}</span>
        {hodMont != null && (
          <span style={{ color:T.muted, fontSize:11, fontFamily:'monospace', marginRight:8 }}>
            mont. <span style={{ color, fontWeight:700 }}>{hodMont.toFixed(3)}</span> hod
            {'  '}
            zem. <span style={{ color, fontWeight:700 }}>{hodZem.toFixed(3)}</span> hod
          </span>
        )}
        <span style={{ color:T.muted, fontFamily:'monospace', fontSize:12 }}>Σ {fmt(total)} Kč</span>
      </div>
      <div style={{ padding:'10px 14px' }}>
        {[...items].sort((a, b) => {
          const aVal = itemSum((data[a.key]?.rows || mkRows()))
          const bVal = itemSum((data[b.key]?.rows || mkRows()))
          if (aVal !== 0 && bVal === 0) return -1
          if (aVal === 0 && bVal !== 0) return 1
          return 0
        }).map(it => {
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
                      canRemove={sec.rows.length > 1}
                      katalogItems={katalog}
                      secKey={it.key}
                      onNewPopis={onNewPopis} />
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
  const [katalog, setKatalog] = useState([])
  const [katalogDialog, setKatalogDialog] = useState(null)
  const [importDialog, setImportDialog] = useState(null)
  const [profile, setProfile] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null) // { title, text, onConfirm }
  const [alertDialog, setAlertDialog] = useState(null)     // { title, text, color }
  const [lastSaved, setLastSaved] = useState(null)
  const [sazbyDialog, setSazbyDialog] = useState(null) // { parsedEBC, noveMzdy, noveMech, noveZemni }

  // Enter zavře alertDialog
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Enter') {
        if (alertDialog) setAlertDialog(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [alertDialog])
  const importFileRef = useRef(null)
  const autosaveRef = useRef(null)

  // Načti katalog položek
  useEffect(() => {
    const loadKatalog = async () => {
      const { data } = await supabase.from('katalog_polozek').select('*').order('je_standard', { ascending: false })
      if (data) setKatalog(data)
    }
    loadKatalog()
  }, [])

  // Všechny sekce pro výběr v dialogu
  const vsechnySekce = [
    ...MECH.map(i => ({ key: i.key, label: 'Mech: ' + i.label })),
    ...ZEMNI.filter(i => !i.noIdx && !i.isProtlak).map(i => ({ key: i.key, label: 'Zemní: ' + i.label })),
  ]

  const handleNewPopis = (popis, sekce) => {
    setKatalogDialog({ popis, sekce })
  }

  const handleKatalogConfirm = async (cilSekce, jeStandard) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('katalog_polozek').insert({
      sekce: cilSekce,
      popis: katalogDialog.popis,
      je_standard: jeStandard,
      schvalil: user?.id,
    }).select().single()
    if (data) setKatalog(prev => [...prev, data])
    setKatalogDialog(null)
  }

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
      if (data.updated_at) setLastSaved(new Date(data.updated_at))
      // Načti profil uživatele
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setProfile(prof)
      }
    }
    load()
  }, [params.id])

  const save = async (data = s) => {
    setSaving(true)
    await supabase.from('stavby').update({ ...data, updated_at: new Date().toISOString() }).eq('id', params.id)
    setSaving(false); setSaved(true)
    setLastSaved(new Date())
    setTimeout(() => setSaved(false), 2000)
  }

  // Autosave při odchodu ze stránky
  useEffect(() => {
    if (!s) return
    const handleBeforeUnload = (e) => {
      save(s)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [s])

  const deleteStavba = () => {
    setConfirmDialog({
      title: 'Smazat stavbu',
      text: `Opravdu smazat stavbu "${s.nazev}"? Tato akce je nevratná.`,
      color: '#ef4444',
      onConfirm: async () => {
        await supabase.from('stavby').delete().eq('id', params.id)
        router.push('/dashboard')
      }
    })
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

  // ── Import z Excelu ──────────────────────────────────────
  const handleImportFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''

    // Dynamicky načti SheetJS
    if (!window.XLSX) {
      await new Promise((res, rej) => {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
        script.onload = res; script.onerror = rej
        document.head.appendChild(script)
      })
    }
    const XLSX = window.XLSX
    const ab = await file.arrayBuffer()
    const wb = XLSX.read(ab, { type: 'array', cellDates: true })

    // ── Detekce formátu ──────────────────────────────────────
    const isEBC = wb.SheetNames.includes('Globální náklady') && wb.SheetNames.includes('Práce, mechanizace a ost. nákl.')
    const isTemplate = wb.SheetNames.includes('Vstupní hodnoty')

    if (isEBC) {
      // ── Import z EBC formátu ─────────────────────────────
      const wsGN  = wb.Sheets['Globální náklady']
      const wsPM  = wb.Sheets['Práce, mechanizace a ost. nákl.']
      const wsMatV = wb.Sheets['Materiál vlastní']
      const rowsGN  = XLSX.utils.sheet_to_json(wsGN,  { header: 1, defval: '' })
      const rowsPM  = XLSX.utils.sheet_to_json(wsPM,  { header: 1, defval: '' })
      const rowsMatV = wsMatV ? XLSX.utils.sheet_to_json(wsMatV, { header: 1, defval: '' }) : []

      const num = (val) => parseFloat(String(val||'0').replace(/\s/g,'').replace(',','.')) || 0

      // Struktura EBC listu (sloupce jsou posunuté o 2 doleva — první 2 jsou vždy None):
      // Globální náklady: col[2]=Poř, col[3]=Kód, col[4]=Popis, col[5]=MJ, col[6]=Výměra/Cena, col[7]=Jedn.cena, col[8]=Celkem
      // Práce/mech:       col[2]=Ident, col[3]=Kód, col[4]=Popis, col[5]=MJ, col[6]=Výměra, col[7]=Jedn.hod, col[8]=Celkem hod, col[18]=Jedn.Cena, col[19]=Cena celkem
      // Název stavby:     R2 col[4]=název, col[7]=číslo stavby

      // Název a číslo stavby z R2
      const nazevStavby = String(rowsGN[1]?.[4] || rowsPM[1]?.[4] || '')
      const cisloStavby = String(rowsGN[1]?.[7] || rowsPM[1]?.[7] || '')

      // Pomocník: najdi řádek v GN listu podle obsahu sloupce col[4] (Popis) nebo col[3] (Kód)
      const findGN = (kody) => {
        const list = Array.isArray(kody) ? kody : [kody]
        return rowsGN.find(r => list.some(k =>
          String(r[4]||'').toLowerCase().includes(k.toLowerCase()) ||
          String(r[3]||'').toLowerCase().includes(k.toLowerCase())
        ))
      }

      // GN hodnota: col[6] = Výměra (pro JV = cena přímo), col[8] = Celkem
      const gnRow = (kody) => {
        const r = findGN(kody)
        if (!r) return 0
        return num(r[8]) || num(r[6])  // Celkem, fallback Výměra
      }

      // PM montážní a zemní hodiny
      let hMont = 0, hZem = 0
      for (const r of rowsPM) {
        const col1 = r[1]
        const popis = String(r[4]||'').toLowerCase()
        if (col1 === 3 || col1 === '3') {
          if (popis.includes('pm:') || popis.includes('mont')) hMont = num(r[8]) || hMont
          if (popis.includes('pz:') || popis.includes('zemní'))   hZem  = num(r[8]) || hZem
        }
      }

      // Stroje z listu Práce, mechanizace — řádky kde col[2]='S'
      // col[6]=množství, col[18]=jedn.cena, col[19]=cena celkem
      const stroje = {}
      for (const r of rowsPM) {
        if (String(r[2]||'').trim() !== 'S') continue
        const kod  = String(r[3]||'').trim()
        const cena = num(r[19]) || num(r[20])  // Cena celkem
        stroje[kod] = cena
      }

      // GZS a Stimulační přirážka — PP řádky, kód 9343 a 9349, cena = col[19]
      let gzsKc = 0, stimulacniKc = 0
      for (const r of rowsPM) {
        if (String(r[2]||'').trim() !== 'PP') continue
        const kod = String(r[3]||'').trim()
        if (kod === '9343') gzsKc = num(r[19])
        if (kod === '9349') stimulacniKc = num(r[19])
      }

      // Subdodávky — def. zádlažba (53001) a def. úprava fasád (54003)
      const wsSub = wb.Sheets['Subdodávky']
      let zadlazbyKc = 0, stavPraceKc = 0
      if (wsSub) {
        const rowsSub = XLSX.utils.sheet_to_json(wsSub, { header: 1, defval: '' })
        for (const r of rowsSub) {
          const kod = String(r[3]||'').trim()
          if (kod === '53001') zadlazbyKc = num(r[8])
          if (kod === '54003') stavPraceKc = num(r[8])
        }
      }

      // PZ zemní práce v Kč — hledám řádek kde col[4] obsahuje 'PZ:'
      let zemniPraceKc = 0
      for (const r of rowsPM) {
        const col1 = r[1]
        const popis = String(r[4]||'').toLowerCase()
        if ((col1 === 3 || col1 === '3') && (popis.includes('pz:') || popis.includes('zemní'))) {
          zemniPraceKc = num(r[19]) || num(r[20]) || zemniPraceKc
        }
      }

      // Materiál vlastní — col[8]=Cena, col[3]=Kód, col[4]=Popis
      let matVlastniCelkem = 0
      let pisekD02 = 0
      for (const r of rowsMatV) {
        const popis = String(r[4]||'').toLowerCase()
        const kod = String(r[3]||'')
        if (popis.includes('celkem') && num(r[8]) > 0) {
          matVlastniCelkem = num(r[8])
        }
        if (kod.includes('800000000301')) {
          pisekD02 = num(r[8])
        }
      }
      if (!matVlastniCelkem) {
        for (const r of rowsMatV) {
          const mnozV = num(r[6]), cenaV = num(r[7])
          if (mnozV > 0 && cenaV > 0) matVlastniCelkem += mnozV * cenaV
        }
      }

      // Příspěvek na sklad — z listu Rekapitulace pro EBC col[7]=Příspěvek za sklad, řádky úrovně 1
      const wsRekap = wb.Sheets['Rekapitulace pro EBC']
      let prispevekSklad = 0
      if (wsRekap) {
        const rowsRekap = XLSX.utils.sheet_to_json(wsRekap, { header: 1, defval: '' })
        for (const r of rowsRekap) {
          if ((r[1] === 1 || r[1] === '1') && num(r[7]) > 0) {
            prispevekSklad += num(r[7])
          }
        }
      }

      // Sestavení parsed EBC
      const parsedEBC = {
        nazev: nazevStavby,
        cislo: cisloStavby,
        mzdy_ebc_hmont: hMont,
        mzdy_ebc_hzem:  hZem,
        // Mechanizace
        mech: {
          jerab:    [{ id: uid(), popis: 'Autojeřáb',    castka: String(Math.round(stroje['120']  || 0)) }],
          nakladni: [{ id: uid(), popis: 'Nákladní auto', castka: String(Math.round((stroje['420']||0)+(stroje['440']||0))) }],
          traktor:  [{ id: uid(), popis: 'Traktor',       castka: String(Math.round(stroje['640']  || 0)) }],
          plosina:  [{ id: uid(), popis: 'Plošina',       castka: '0' }],
        },
        // Zemní práce (Kč)
        zemni: {
          bagr:         [{ id: uid(), popis: 'Rypadlo do 0,5m³',       castka: String(Math.round(stroje['520']||0)) }, { id: uid(), popis: 'Minirýpadlo pás. do 3,5t', castka: '0' }],
          kompresor:    [{ id: uid(), popis: 'Kompresor',               castka: String(Math.round(stroje['740']||0)) }],
          rezac:        [{ id: uid(), popis: 'Řezač asfaltu',           castka: String(Math.round(stroje['260']||0)) }],
          mot_pech:     [{ id: uid(), popis: 'Motorový pěch',           castka: String(Math.round(stroje['240']||0)) }],
          uhlova_bruska:[{ id: uid(), popis: 'Úhlová bruska',           castka: String(Math.round(stroje['255']||0)) }],
          mat_vlastni:  [{ id: uid(), popis: 'Materiál vlastní', castka: String(Math.round(matVlastniCelkem * 100) / 100) }],
          pisek_d02:    [{ id: uid(), popis: 'Písek D0-2',              castka: String(Math.round(pisekD02)) }],
          // Ostatní položky zemních prací z EBC nejsou přímo dostupné — ponecháme 0
          zemni_prace:  [{ id: uid(), popis: 'Zemní práce', castka: '0' }],
          zadlazby:     [{ id: uid(), popis: 'Def. zádlažba', castka: String(Math.round(zadlazbyKc)) }],
          sterk_3264:   [{ id: uid(), popis: 'Štěrkokamen 32-64', castka: '0' }],
          beton:        [{ id: uid(), popis: 'Beton',        castka: '0' }],
          asfalt:       [{ id: uid(), popis: 'Asfalt',       castka: '0' }],
          optotrubka:   [{ id: uid(), popis: 'Optotrubka',   castka: '0' }],
          nalosute:     [{ id: uid(), popis: 'Naložení a doprava sutě', castka: '0' }],
          stav_prace:   [{ id: uid(), popis: 'Stav. práce m. rozsahu', castka: '0' }],
          def_fasady:   [{ id: uid(), popis: 'Def. úprava fasád', castka: String(Math.round(stavPraceKc)) }],
          rezerv_zemni: [{ id: uid(), popis: 'Rezerva zemní', castka: '0' }],
          pisek_b04:    [{ id: uid(), popis: 'Písek B0-4',   castka: '0' }],
          pisek_beton:  [{ id: uid(), popis: 'Písek pro beton', castka: '0' }],
          sterk_032:    [{ id: uid(), popis: 'Štěrk 0-32',   castka: '0' }],
          protlak:      [{ id: uid(), popis: 'Protlak',       castka: '0' }],
          roura_pe:     [{ id: uid(), popis: 'Roura PE',      castka: '0' }],
        },
        // GN
        gn: {
          inzenyrska:     { rows: [{ id: uid(), popis: 'Inženýring zhotovitele CAPEX', castka: String(gnRow(['Inženýring zhotovitele','1101999'])) }], open: false },
          geodetika:      { rows: [{ id: uid(), popis: 'Geodetické práce',             castka: String(gnRow(['Geodetick','1102000'])) }], open: false },
          te_evidence:    { rows: [{ id: uid(), popis: 'Dokumentace pro TE',           castka: String(gnRow(['Dokumentace pro TE','1102010'])) }], open: false },
          vychozi_revize: { rows: [{ id: uid(), popis: 'Výchozí revize',               castka: String(gnRow(['Výchozí revize','1101594'])) }], open: false },
          pripl_ppn:      { rows: [{ id: uid(), popis: 'Přípl. PPN',                   castka: '0' }], open: false },
          ekolog_likv:    { rows: [{ id: uid(), popis: 'Ekologická likvidace odpadů',  castka: String(gnRow(['Ekolog','1101638'])) }], open: false },
          material_vyn:   { rows: [{ id: uid(), popis: 'Materiál výnosový',            castka: '0' }], open: false },
          doprava_mat:    { rows: [{ id: uid(), popis: 'Doprava materiálu na stavbu',  castka: String(gnRow(['Doprava materiálu','1102007'])) }], open: false },
          popl_ver:       { rows: [{ id: uid(), popis: 'Popl. ver. prostranství',      castka: '0' }], open: false },
          pripl_capex:    { rows: [{ id: uid(), popis: 'Přípl. CAPEX',                 castka: '0' }], open: false },
          kolaudace:      { rows: [{ id: uid(), popis: 'Kolaudace',                    castka: '0' }], open: false },
        },
        // DOF
        dof: {
          dio:          { rows: [{ id: uid(), popis: 'DIO',                    castka: String(gnRow(['Dopravní značení','1101929'])) }], open: false },
          vytyc_siti:   { rows: [{ id: uid(), popis: 'Vytýčení sítí',          castka: String(gnRow(['Vytyčení','Vytýčení','1101922'])) }], open: false },
          neplanvykon:  { rows: [{ id: uid(), popis: 'Neplánovaný výkon',       castka: '0' }], open: false },
          spravni_popl: { rows: [{ id: uid(), popis: 'Správní poplatky',        castka: '0' }], open: false },
          demontaz:     { rows: [{ id: uid(), popis: 'Demontáž',                castka: '0' }], open: false },
          spec_zadlazby:{ rows: [{ id: uid(), popis: 'Speciální zádlažby',      castka: '0' }], open: false },
          omezeni_dopr: { rows: [{ id: uid(), popis: 'Omezení sil. provozu',    castka: '0' }], open: false },
          rezerva:      { rows: [{ id: uid(), popis: 'Rezerva',                 castka: '0' }], open: false },
          archeolog_dozor: { rows: [{ id: uid(), popis: 'Archeologický dozor',    castka: String(gnRow(['Archeologický dozor','1101925'])) }], open: false },
          gzs:          { rows: [{ id: uid(), popis: 'GZS (SO)',                  castka: String(Math.round(gzsKc * 100) / 100) }], open: false },
          stimul_prirazka: { rows: [{ id: uid(), popis: 'Stimulační přirážka',   castka: String(Math.round(stimulacniKc * 100) / 100) }], open: false },
        },
      }

      // Mzdy — hodiny mont/zemní dosadíme do mont_nn a zem_nn (NN = nejblíže odpovídá)
      // Přesné rozdělení VN/NN/TS z EBC nelze, dáme vše do mont_nn resp. zem_nn
      // Sestavení čistých mzdy — žádné hodnoty z databáze nepřežijí
      const noveMzdy = mkSec(MZDY)
      noveMzdy['mont_nn'] = { rows: [{ id: uid(), popis: 'Montáž NN (EBC import)', castka: String(Math.round(hMont * 10) / 10) }], open: false }

      // Zemní práce — čistý objekt
      const noveZemni = mkSec(ZEMNI)
      for (const [k, rows] of Object.entries(parsedEBC.zemni)) noveZemni[k] = { rows, open: false }
      noveZemni['zemni_prace'] = { rows: [{ id: uid(), popis: 'Zemní práce (EBC import)', castka: String(Math.round(zemniPraceKc)) }], open: false }

      // Mech — čistý objekt
      const noveMech = mkSec(MECH)
      for (const [k, rows] of Object.entries(parsedEBC.mech)) noveMech[k] = { rows, open: false }

      setSazbyDialog({ parsedEBC, noveMzdy, noveMech, noveZemni, prispevekSklad, hMont, zemniPraceKc })
      setImportDialog(null)
      return
    }

    if (!isTemplate) {
      setAlertDialog({ title: 'Chyba importu', text: 'Nerozpoznaný formát souboru. Očekáván list "Vstupní hodnoty" nebo EBC formát (listy "Globální náklady", "Práce, mechanizace a ost. nákl.").', color: '#ef4444' })
      return
    }

    const ws = wb.Sheets['Vstupní hodnoty']
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    // Pomocná funkce: najdi řádek podle názvu v sloupci A
    const findRow = (name) => rows.find(r => String(r[0]||'').toLowerCase().includes(name.toLowerCase()))
    const v = (row, col) => parseFloat(String(row?.[col]||'0').replace(/\s/g,'').replace(',','.')) || 0

    // Mapování: { klíč: hodnota }
    // R1 hlavičky sloupců: col6=Jeřáb, col8=Nák.auto, col10=Traktor, col12=Plošina
    //                      col14=Zem.práce, col16=Zádlažby, col18=Bagr, col20=Kopresor
    //                      col22=Řez.asfaltu, col24=Protlak, col26=Mot.pěch, col28=Úhl.bruska
    // R20 hlavičky: col6=GZS, col8=Stimul, col12=Mat.vlastní, col14=Asfalt
    //               col16=Písek, col18=Štěrk, col20=Beton, col22=Mat.zhot, col24=Optotrubka
    //               col26=Nalož.suť, col28=Stav.pr., col30=Rezerv.zemní
    // Součtový řádek R18 (Vytýčení sítí) obsahuje součty všech sloupců
    const sumRow = rows[17] // R18 = index 17

    // GN — sloupec B (index 1)
    const gnMap = {
      inzenyrska:     findRow('Inženýrsk'),
      geodetika:      findRow('Geodetick'),
      te_evidence:    findRow('technická evidence'),
      vychozi_revize: findRow('Výchozí revize'),
      pripl_ppn:      findRow('PPN'),
      ekolog_likv:    findRow('Eko'),
      material_vyn:   findRow('Materiál výnosový'),
      doprava_mat:    findRow('Doprava mat'),
      popl_ver:       findRow('veř.prostranství'),
      pripl_capex:    findRow('Capex'),
      kolaudace:      findRow('Kolaudace'),
    }

    // DOF — sloupec B (index 1)
    const dofMap = {
      dio:          findRow('DIO'),
      vytyc_siti:   findRow('Vytýčení sítí'),
      neplanvykon:  findRow('Neplánovaný'),
      spravni_popl: findRow('Správní poplatky'),
      demontaz:     findRow('Demontáž'),
      spec_zadlazby:findRow('Speciální zádlažby'),
      omezeni_dopr: findRow('Omezení sil'),
      rezerva:      findRow('Rezerva'),
    }

    // Sestavení parsed dat
    const parsed = {
      prirazka:       String(v(findRow('Vysoutěžená přírážka'), 1)),
      hzs_mont:       String(v(findRow('HZS montážní'), 1)),
      hzs_zem:        String(v(findRow('HZS zemní'), 1)),
      zmes_mont:      String(v(findRow('Montážní práce ZMES'), 1)),
      zmes_zem:       String(v(findRow('Zemní práce ZMES'), 1)),
      prispevek_sklad:String(v(findRow('Příspěvek na sklad'), 1)),
      // Mechanizace ze součtového řádku R18
      mech: {
        jerab:    [{ id: uid(), popis: 'Autojeřáb', castka: String(v(sumRow, 6)) }],
        nakladni: [{ id: uid(), popis: 'Nákladní auto', castka: String(v(sumRow, 8)) }],
        traktor:  [{ id: uid(), popis: 'Traktor', castka: String(v(sumRow, 10)) }],
        plosina:  [{ id: uid(), popis: 'Plošina', castka: String(v(sumRow, 12)) }],
      },
      // Zemní práce ze součtového řádku R18
      zemni: {
        zemni_prace:  [{ id: uid(), popis: 'Zemní práce', castka: String(v(sumRow, 14)) }],
        zadlazby:     [{ id: uid(), popis: 'Zádlažby', castka: String(v(sumRow, 16)) }],
        bagr:         [{ id: uid(), popis: 'Rypadlo do 0,5m³', castka: String(v(sumRow, 18)) }, { id: uid(), popis: 'Minirýpadlo pás. do 3,5t', castka: '0' }],
        kompresor:    [{ id: uid(), popis: 'Kompresor', castka: String(v(sumRow, 20)) }],
        rezac:        [{ id: uid(), popis: 'Řezač asfaltu', castka: String(v(sumRow, 22)) }],
        mot_pech:     [{ id: uid(), popis: 'Motorový pěch', castka: String(v(sumRow, 26)) }],
        uhlova_bruska:[{ id: uid(), popis: 'Úhlová bruska', castka: String(v(sumRow, 28)) }],
        // R20 sloupce pro materiál
        mat_vlastni:  [{ id: uid(), popis: 'Materiál vlastní', castka: String(v(rows[20], 12)) }],
        asfalt:       [{ id: uid(), popis: 'Asfalt', castka: String(v(rows[20], 14)) }],
        pisek_d02:    [{ id: uid(), popis: 'Písek D0-2', castka: String(v(rows[20], 16)) }],
        sterk_3264:   [{ id: uid(), popis: 'Štěrkokamen 32-64', castka: String(v(rows[20], 18)) }],
        beton:        [{ id: uid(), popis: 'Beton', castka: String(v(rows[20], 20)) }],
        optotrubka:   [{ id: uid(), popis: 'Optotrubka', castka: String(v(rows[20], 24)) }],
        nalosute:     [{ id: uid(), popis: 'Naložení a doprava sutě', castka: String(v(rows[20], 26)) }],
        stav_prace:   [{ id: uid(), popis: 'Stav. práce m. rozsahu', castka: String(v(rows[20], 28)) }],
        rezerv_zemni: [{ id: uid(), popis: 'Rezerva zemní', castka: String(v(rows[20], 30)) }],
      },
      // GN
      gn: Object.fromEntries(
        Object.entries(gnMap).map(([k, row]) => [k, { rows: [{ id: uid(), popis: k, castka: String(v(row, 1)) }], open: false }])
      ),
      // DOF
      dof: Object.fromEntries(
        Object.entries(dofMap).map(([k, row]) => [k, { rows: [{ id: uid(), popis: k, castka: String(v(row, 1)) }], open: false }])
      ),
    }

    // Zjisti chybějící položky (hodnota 0)
    const missing = []
    const checkZero = (label, val) => { if (!parseFloat(val)) missing.push(label) }
    checkZero('Jeřáb', parsed.mech.jerab[0].castka)
    checkZero('Nákladní auto', parsed.mech.nakladni[0].castka)
    checkZero('Traktor', parsed.mech.traktor[0].castka)
    checkZero('Plošina', parsed.mech.plosina[0].castka)
    checkZero('Zemní práce', parsed.zemni.zemni_prace[0].castka)
    checkZero('Zádlažby', parsed.zemni.zadlazby[0].castka)
    checkZero('Bagr', parsed.zemni.bagr[0].castka)
    checkZero('Inženýrská činnost', parsed.gn.inzenyrska?.rows[0]?.castka)
    checkZero('Geodetické práce', parsed.gn.geodetika?.rows[0]?.castka)

    if (missing.length > 0) {
      setImportDialog({ missing, parsed })
    } else {
      applyImport(parsed)
    }
  }

  const applyImport = (parsed) => {
    setS(prev => {
      const next = { ...prev, ...parsed }
      // Doplň chybějící mzdy, gn, dof klíče
      const mzdy = prev.mzdy || {}
      for (const it of MZDY) if (!mzdy[it.key]) mzdy[it.key] = { rows: mkRows(), open: false }
      const zemni = { ...prev.zemni }
      for (const it of ZEMNI) if (!zemni[it.key]) zemni[it.key] = { rows: mkRows(), open: false }
      // Přepiš zemni z parsed
      for (const [k, rows] of Object.entries(parsed.zemni)) {
        zemni[k] = { rows, open: false }
      }
      const mech = { ...prev.mech }
      for (const [k, rows] of Object.entries(parsed.mech)) {
        mech[k] = { rows, open: false }
      }
      return { ...next, mzdy, mech, zemni }
    })
    setImportDialog(null)
    setAlertDialog({ title: '✅ Import dokončen', text: 'Všechny hodnoty byly načteny. Zkontroluj a ulož.', color: '#10b981' })
  }

  const applySazby = (sazby) => {
    const { parsedEBC, noveMzdy, noveMech, noveZemni, prispevekSklad } = sazbyDialog
    setS(prev => ({
      ...prev,
      nazev: parsedEBC.nazev || prev.nazev,
      cislo: parsedEBC.cislo || prev.cislo,
      prirazka: String(num(sazby.prirazka) / 100),
      hzs_mont: sazby.hzs_mont,
      hzs_zem:  sazby.hzs_zem,
      zmes_mont: sazby.zmes_mont,
      zmes_zem:  sazby.zmes_zem,
      mzdy:  noveMzdy,
      mech:  noveMech,
      zemni: noveZemni,
      gn:    parsedEBC.gn,
      dof:   parsedEBC.dof,
      prispevek_sklad: prispevekSklad > 0 ? String(Math.round(prispevekSklad * 100) / 100) : prev.prispevek_sklad,
    }))
    setSazbyDialog(null)
    setAlertDialog({ title: '✅ Import EBC dokončen', text: `Montáž: ${Math.round(sazbyDialog.hMont*10)/10} hod, Zemní práce: ${Math.round(sazbyDialog.zemniPraceKc).toLocaleString('cs')} Kč.`, color: '#10b981' })
  }

  return (
    <div style={{ minHeight:'100vh', background:T.bg }}>
      {/* HEADER */}
      <div style={{ background:T.header, borderBottom:`1px solid ${T.border}`, padding:'0 20px', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ maxWidth:1060, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0 0', flexWrap:'wrap' }}>
            <button onClick={() => { save(s); router.push('/dashboard') }} style={{ background:'transparent', border:`1px solid ${T.border}`, borderRadius:6, padding:'4px 10px', color:T.muted, fontSize:12, cursor:'pointer' }}>← zpět</button>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:10, color:T.muted, letterSpacing:1.5, textTransform:'uppercase' }}>Kalkulace stavby · {s.oblast}</div>
              <div style={{ fontSize:16, fontWeight:800, color:T.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {s.nazev || <span style={{ color:T.muted }}>Bez názvu…</span>}
              </div>
              {lastSaved && (
                <div style={{ fontSize:10, color:'#10b981', marginTop:2 }}>
                  🕐 Poslední záloha: {lastSaved.toLocaleTimeString('cs-CZ', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                </div>
              )}
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
            {profile?.role === 'admin' && (
              <button onClick={deleteStavba} style={{ padding:'6px 14px', background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:6, color:'#ef4444', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                🗑️ Smazat
              </button>
            )}
            <button onClick={() => save()} style={{ padding:'6px 14px', background: saved?'#10b981':'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:6, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              {saving ? '…' : saved ? '✓ Uloženo' : '💾 Uložit'}
            </button>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10 }}>
            <div style={{ display:'flex' }}>
              {[{k:'vstup',l:'📥 Vstupní hodnoty'},{k:'rozbor',l:'📊 Rozbor'}].map(t=>(
                <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'8px 20px', background:tab===t.k?'rgba(37,99,235,0.2)':'transparent', border:'none', borderBottom:tab===t.k?'3px solid #3b82f6':'3px solid transparent', borderRadius:'6px 6px 0 0', color:tab===t.k?'#3b82f6':T.muted, cursor:'pointer', fontSize:13, fontWeight:tab===t.k?800:400 }}>{t.l}</button>
              ))}
            </div>
            <div>
              <input ref={importFileRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={handleImportFile} />
              <button onClick={() => importFileRef.current?.click()}
                style={{ padding:'7px 16px', background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.4)', borderRadius:7, color:'#818cf8', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                📂 Importovat z Excelu
              </button>
            </div>
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

                ].map(({l,k,span,isPct,isSelect,isStav})=>(
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
                        onChange={e=>setField(k, isPct ? e.target.value : e.target.value)}
                        onBlur={e=>{ if(isPct) setField(k, String(num(e.target.value)/100)) }}
                        onKeyDown={onEnterNext}
                        style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:`1px solid ${T.border}`, borderRadius:6, color:T.text, fontSize:13, padding:'7px 10px', outline:'none', boxSizing:'border-box', fontFamily:'monospace' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Sekce secKey="gn"    items={GN}    data={s.gn}    T={T} color={SEC.gn.color}    icon={SEC.gn.icon}    label={SEC.gn.label}    sumS={c.gnSumS}    sumBez={c.gnSumBez}    zisk={c.gnZisk}    handlers={gnH}    onLabelChange={handleLabelChange} katalog={katalog} onNewPopis={handleNewPopis} />
            <Sekce secKey="dof"   items={DOF}   data={s.dof}   T={T} color={SEC.dof.color}   icon={SEC.dof.icon}   label={SEC.dof.label}   sumS={c.dofSumS}   sumBez={c.dofBez}                     handlers={dofH}   onLabelChange={handleLabelChange} katalog={katalog} onNewPopis={handleNewPopis} />
            <Sekce secKey="mzdy"  items={MZDY}  data={s.mzdy}  T={T} color={SEC.mzdy.color}  icon={SEC.mzdy.icon}  label={SEC.mzdy.label}  sumS={c.mzdySumHzs}  sumBez={c.mzdySumHzs}  zisk={c.mzdyZisk}  handlers={mzdyH}  onLabelChange={handleLabelChange} katalog={katalog} onNewPopis={handleNewPopis} hodMont={c.hodMont} hodZem={c.hodZem} />
            <Sekce secKey="mech"  items={MECH}  data={s.mech}  T={T} color={SEC.mech.color}  icon={SEC.mech.icon}  label={SEC.mech.label}  sumS={c.mechSumS}  sumBez={c.mechSumBez}  zisk={c.mechZisk}  handlers={mechH}  onLabelChange={handleLabelChange} katalog={katalog} onNewPopis={handleNewPopis} />
            <Sekce secKey="zemni" items={ZEMNI} data={s.zemni} T={T} color={SEC.zemni.color} icon={SEC.zemni.icon} label={SEC.zemni.label} sumS={c.zemniSumS} sumBez={c.zemniSumBez} zisk={c.zemniZisk} handlers={zemniH} onLabelChange={handleLabelChange} katalog={katalog} onNewPopis={handleNewPopis} />

            {/* Ostatní */}
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:'14px 16px', marginBottom:12 }}>
              <div style={{ color:'#14b8a6', fontSize:11, fontWeight:800, letterSpacing:1, textTransform:'uppercase', marginBottom:12 }}>🔧 Ostatní</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:14 }}>
                {[
                  { l:'Materiál zhotovitele', val: fmt(c.matZhot) },
                  { l:'Materiál vlastní',     val: fmt(c.matVlastni) },
                  { l:'Příspěvek na sklad',   val: fmt(num(s.prispevek_sklad)) },
                  { l:'GZS',                  val: fmt((s.dof?.gzs?.rows||[]).reduce((a,r)=>a+(parseFloat(r.castka)||0),0)) },
                  { l:'Stimulační přirážka',  val: fmt(num(s.dof?.stimul_prirazka?.rows?.[0]?.castka)) },
                ].map(({l,val})=>(
                  <div key={l}>
                    <div style={{ color:T.muted, fontSize:10, fontWeight:700, marginBottom:2 }}>{l}</div>
                    <div style={{ width:'100%', background:'rgba(20,184,166,0.08)', border:`1px solid rgba(20,184,166,0.3)`, borderRadius:6, color:'#14b8a6', fontSize:13, padding:'7px 10px', boxSizing:'border-box', fontFamily:'monospace', fontWeight:700 }}>{val} Kč</div>
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
              const hzsM = num(s.hzs_mont), hzsZ = num(s.hzs_zem)
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
                const saz = it.isZem ? hzsZ : hzsM
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
              const zemniRowsBez = zemniRows.filter(r=>!r.isProtlak).reduce((a,r)=>a+r.bez,0)
              const bazova = mzdyBez+mechBez+zemniRowsBez+gnBez+dofBez

              return (
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:'12px 14px', fontSize:11, overflowX:'auto' }}>
                  <SekceHeader label="Mzdy montáže" color="#3b82f6" icon="👷" />
                  {/* Součet hodin */}
                  <div style={{ display:'grid', gridTemplateColumns:cols, background:'rgba(59,130,246,0.06)', borderBottom:`1px solid ${T.border}40` }}>
                    <div style={{ padding:'5px 8px', color:'#3b82f6', fontSize:11, fontWeight:700 }}>⏱ Hodiny celkem</div>
                    <div style={{ padding:'5px 6px', textAlign:'right', fontFamily:'monospace', fontSize:12, fontWeight:800, color:'#3b82f6', gridColumn:'2/4' }}>
                      mont. {c.hodMont.toFixed(3)} hod
                    </div>
                    <div style={{ padding:'5px 6px', textAlign:'right', fontFamily:'monospace', fontSize:12, fontWeight:800, color:'#60a5fa', gridColumn:'4/6' }}>
                      zem. {c.hodZem.toFixed(3)} hod
                    </div>
                    <div style={{ padding:'5px 6px', textAlign:'right', fontFamily:'monospace', fontSize:11, color:T.muted, gridColumn:'6/8' }}>
                      Σ {(c.hodMont + c.hodZem).toFixed(3)} hod
                    </div>
                  </div>
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
                  <Row label="Mat. zhotovitele" bez={matZhot} priR={0} sP={matZhot} idx={0} kVypl={matZhot*0.8} color="#8b5cf6" />
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

      {/* Dialog schválení nové položky do katalogu */}
      {katalogDialog && (
        <KatalogDialog
          popis={katalogDialog.popis}
          sekce={katalogDialog.sekce}
          vsechnySekce={vsechnySekce}
          T={T}
          onConfirm={handleKatalogConfirm}
          onCancel={() => setKatalogDialog(null)}
        />
      )}

      {/* Confirm dialog */}
      {confirmDialog && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:28, maxWidth:420, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize:18, fontWeight:800, color: confirmDialog.color||'#f59e0b', marginBottom:12 }}>⚠️ {confirmDialog.title}</div>
            <div style={{ color:T.text, fontSize:14, lineHeight:1.6, marginBottom:24 }}>{confirmDialog.text}</div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setConfirmDialog(null)}
                style={{ padding:'9px 20px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:8, color:T.muted, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                Zrušit
              </button>
              <button onClick={() => { setConfirmDialog(null); confirmDialog.onConfirm() }}
                style={{ padding:'9px 20px', background: confirmDialog.color||'#ef4444', border:'none', borderRadius:8, color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700 }}>
                Potvrdit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert dialog */}
      {alertDialog && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:T.card, border:`1px solid ${alertDialog.color}40`, borderRadius:14, padding:28, maxWidth:420, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize:18, fontWeight:800, color: alertDialog.color, marginBottom:12 }}>{alertDialog.title}</div>
            <div style={{ color:T.text, fontSize:14, lineHeight:1.6, marginBottom:24 }}>{alertDialog.text}</div>
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button autoFocus onClick={() => setAlertDialog(null)}
                style={{ padding:'9px 24px', background: alertDialog.color, border:'none', borderRadius:8, color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700 }}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {sazbyDialog && <SazbyDialog T={T} nazev={sazbyDialog.parsedEBC.nazev} onConfirm={applySazby} onCancel={() => setSazbyDialog(null)} />}

      {/* Dialog chybějící položky při importu */}
      {importDialog && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:28, maxWidth:480, width:'90%' }}>
            <div style={{ color:'#f59e0b', fontWeight:800, fontSize:16, marginBottom:12 }}>⚠️ Chybějící položky</div>
            <div style={{ color:T.muted, fontSize:13, marginBottom:16 }}>
              Následující položky mají v rozpočtu hodnotu 0. Chceš je přeskočit nebo zadat ručně po importu?
            </div>
            <div style={{ marginBottom:20 }}>
              {importDialog.missing.map(m => (
                <div key={m} style={{ padding:'6px 10px', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:6, marginBottom:6, color:'#fbbf24', fontSize:13 }}>
                  • {m}
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setImportDialog(null)}
                style={{ padding:'8px 18px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:7, color:T.muted, cursor:'pointer', fontSize:13 }}>
                Zrušit
              </button>
              <button onClick={() => applyImport(importDialog.parsed)}
                style={{ padding:'8px 18px', background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.5)', borderRadius:7, color:'#818cf8', cursor:'pointer', fontSize:13, fontWeight:700 }}>
                Importovat (doplním ručně)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import { useTheme } from '../../layout'

// ── helpers ──────────────────────────────────────────────
const uid  = () => Math.random().toString(36).slice(2, 9)
const num  = v  => parseFloat(String(v).replace(/\s/g,'').replace(',','.')) || 0
const fmt  = n  => Number(n).toLocaleString('cs-CZ', { minimumFractionDigits:2, maximumFractionDigits:2 })
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
  { key:"rezac",        label:"Řezač asfaltu" },
  { key:"uhlova_bruska",label:"Úhlová bruska" },
  { key:"mot_pech",     label:"Motorový pěch" },
  { key:"nalosute",     label:"Naložení a doprava sutě" },
  { key:"stav_prace",   label:"Stav. práce m. rozsahu" },
  { key:"def_fasady",    label:"Def. úprava fasád" },
  { key:"optotrubka",   label:"Optotrubka" },
  { key:"protlak",      label:"Protlak (zadej záporně)", isProtlak:true },
  { key:"roura_pe",     label:"Roura PE – říz. protlaky", noIdx:true },
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
  { key:"ekolog_likv",    label:"Ekolog. likv. odpadů" },
  { key:"material_vyn",   label:"Materiál výnosový" },
  { key:"doprava_mat",    label:"Doprava mat. na stavbu" },
  { key:"popl_ver",       label:"Popl. za veřej. prostr." },
  { key:"pripl_capex",    label:"Příplatek Capex / Opex" },
  { key:"kolaudace",      label:"Kolaudace" },
]
const DOF = [
  { key:"dio",             label:"DIO – Dopravní značení" },
  { key:"vytyc_siti",      label:"Vytýčení sítí" },
  { key:"neplanvykon",     label:"Neplánovaný výkon" },
  { key:"spravni_popl",    label:"Správní poplatky" },
  { key:"demontaz",        label:"Demontáž – nestandart" },
  { key:"spec_zadlazby",   label:"Speciální zádlažby" },
  { key:"omezeni_dopr",    label:"Omezení sil./žel. dopr." },
  { key:"rezerva",         label:"Rezerva" },
  { key:"archeolog_dozor",  label:"Archeologický dozor" },
]
const SEC = {
  mzdy:  { color:'#3b82f6', icon:'👷', label:'Mzdy montáže' },
  mech:  { color:'#f59e0b', icon:'🚜', label:'Mechanizace' },
  zemni: { color:'#ef4444', icon:'⛏️', label:'Zemní práce' },
  gn:    { color:'#10b981', icon:'📋', label:'Globální náklady' },
  dof:   { color:'#8b5cf6', icon:'🧾', label:'Ostatní náklady' },
}

const mkRows = () => [{ id: uid(), popis:'', castka:'' }]
const onEnterNext = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    const inputs = Array.from(document.querySelectorAll('input, select'))
    const idx = inputs.indexOf(e.target)
    if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus()
  }
}
const mkSec  = items => Object.fromEntries(items.map(it => [it.key, { rows: mkRows(), open: false }]))
const itemSum = rows => rows.reduce((a, r) => a + num(r.castka), 0)

// Materiál zhotovitele = mat_vlastni celkem − (písek D0-2 + štěrkopísek B0-4 + betonářský písek + štěrkodrť 0-32 + štěrkokamen 32-64 + asfalt + roura PE)
function computeMatZhot(zemni, matVlastniCelkem) {
  const odecti = ['pisek_d02','pisek_b04','pisek_beton','sterk_032','sterk_3264','asfalt','roura_pe']
    .reduce((a, k) => a + itemSum(zemni[k]?.rows || mkRows()), 0)
  const matV = (matVlastniCelkem != null && matVlastniCelkem > 0) ? matVlastniCelkem : itemSum(zemni['mat_vlastni']?.rows || mkRows())
  return Math.max(0, matV - odecti)
}
// Materiál vlastní (pro zpětnou kompatibilitu)
function computeMatVlastni(zemni) {
  return itemSum(zemni['mat_vlastni']?.rows || mkRows())
}

function compute(s) {
  const pri = num(s.prirazka), zmesM = num(s.zmes_mont), zmesZ = num(s.zmes_zem)
  const hzsM = num(s.hzs_mont), hzsZ = num(s.hzs_zem)
  const mzdyT = {}; let mzdySumBez = 0, mzdySumHzs = 0
  for (const it of MZDY) {
    const rows = s.mzdy[it.key]?.rows || mkRows()
    const hod = itemSum(rows)
    const bez = hod * (it.isZem ? zmesZ : zmesM)
    const hzs = hod * (it.isZem ? hzsZ : hzsM)
    const sP  = bez * (1 + pri)
    mzdyT[it.key] = { hod, bez, hzs, sP }
    mzdySumBez += bez
    mzdySumHzs += hzs
  }
  const mzdySumS = mzdySumBez * (1 + pri)
  const mzdyZisk = (mzdySumS - num(s.vypl_mzdy)) * 0.66
  const hodMont = MZDY.filter(i => !i.isZem).reduce((a, i) => a + (mzdyT[i.key]?.hod || 0), 0)
  const hodZem  = MZDY.filter(i =>  i.isZem).reduce((a, i) => a + (mzdyT[i.key]?.hod || 0), 0)

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

  // Materiál vlastní a zhotovitele = automatické výpočty
  const matVlastni = computeMatVlastni(s.zemni)
  const matZhot = computeMatZhot(s.zemni, matVlastni)
  const matVlastniCelkem = itemSum(s.zemni['mat_vlastni']?.rows || mkRows())
  const prispSklad = num(s.prispevek_sklad)
  const gzsKc = itemSum(s.dof['gzs']?.rows || mkRows())
  const stimulKc = itemSum(s.dof['stimul_prirazka']?.rows || mkRows())
  const bazova = mzdySumHzs + mechSumBez + zemniSumBez + gnSumBez + dofBez + matZhot + prispSklad + gzsKc + stimulKc
  const celkemZisk = mzdyZisk + mechZisk + zemniZisk + gnZisk

  return { mzdyT, mzdySumBez, mzdySumS, mzdySumHzs, mzdyZisk, hodMont, hodZem, mechT, mechSumBez, mechSumS, mechZisk, zemniT, zemniSumBez, zemniSumS, zemniZisk, gnT, gnSumBez, gnSumS, gnZisk, dofBez, dofSumS, matVlastni, matZhot, prispSklad, bazova, celkemZisk }
}

// ── Dialog: sazby po EBC importu ────────────────────────────
function SazbyDialog({ T, nazev, onConfirm, onCancel }) {
  const [vals, setVals] = useState({ prirazka:'', hzs_mont:'', hzs_zem:'', zmes_mont:'', zmes_zem:'' })
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
      <div style={{ background:T.card, border:'1px solid #3b82f6', borderRadius:14, padding:28, maxWidth:440, width:'90%' }}>
        <div style={{ color:'#3b82f6', fontWeight:800, fontSize:16, marginBottom:6 }}>⚙️ Zadej sazby pro stavbu</div>
        <div style={{ color:T.muted, fontSize:12, marginBottom:18 }}>{nazev}</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
          {[
            { l:'Přirážka %', k:'prirazka' },
            { l:'HZS montáž (Kč/h)', k:'hzs_mont' },
            { l:'HZS zemní (Kč/h)', k:'hzs_zem' },
            { l:'ZMES montáž (Kč/h)', k:'zmes_mont' },
            { l:'ZMES zemní (Kč/h)', k:'zmes_zem' },

          ].map(({l,k}) => (
            <div key={k}>
              <div style={{ color:T.muted, fontSize:10, fontWeight:700, marginBottom:4 }}>{l}</div>
              <input type="text" value={vals[k]} onChange={e => setVals(v => ({...v, [k]: e.target.value}))}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const isLast = k === 'zmes_zem'
                    if (isLast) { onConfirm(vals) }
                    else {
                      const inputs = Array.from(document.querySelectorAll('input'))
                      const idx = inputs.indexOf(e.target)
                      if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus()
                    }
                  }
                }}
                style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid #3b82f640', borderRadius:6, color:T.text, fontSize:13, padding:'7px 10px', outline:'none', boxSizing:'border-box', fontFamily:'monospace' }} />
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onCancel}
            style={{ padding:'9px 18px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:8, color:T.muted, cursor:'pointer', fontSize:13 }}>Zrušit</button>
          <button onClick={() => onConfirm(vals)}
            style={{ padding:'9px 24px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:8, color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700 }}>✓ Použít import</button>
        </div>
      </div>
    </div>
  )
}

// ── Dialog: schválení nové položky do katalogu ───────────
function KatalogDialog({ popis, sekce, vsechnySekce, T, onConfirm, onCancel }) {
  const [jeStandard, setJeStandard] = useState(false)
  const [cilSekce, setCilSekce] = useState(sekce)
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:T.card, border:`1px solid #3b82f6`, borderRadius:14, padding:28, maxWidth:440, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ color:'#3b82f6', fontWeight:800, fontSize:15, marginBottom:6 }}>📋 Nová položka v katalogu</div>
        <div style={{ color:T.muted, fontSize:13, marginBottom:18 }}>
          Položka <strong style={{ color:T.text }}>„{popis}"</strong> dosud není v katalogu. Zařadit ji?
        </div>

        <div style={{ marginBottom:14 }}>
          <div style={{ color:T.muted, fontSize:11, fontWeight:700, marginBottom:6, textTransform:'uppercase', letterSpacing:1 }}>Do které sekce patří?</div>
          <select value={cilSekce} onChange={e => setCilSekce(e.target.value)}
            style={{ width:'100%', background:T.bg, border:`1px solid ${T.border}`, borderRadius:6, color:T.text, fontSize:13, padding:'7px 10px', outline:'none' }}>
            {vsechnySekce.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
            <div onClick={() => setJeStandard(v => !v)}
              style={{ width:38, height:22, borderRadius:11, background: jeStandard ? '#3b82f6' : T.border, position:'relative', transition:'background 0.2s', flexShrink:0 }}>
              <div style={{ position:'absolute', top:3, left: jeStandard ? 19 : 3, width:16, height:16, borderRadius:8, background:'#fff', transition:'left 0.2s' }}/>
            </div>
            <div>
              <div style={{ color:T.text, fontSize:13, fontWeight:600 }}>Standardní položka</div>
              <div style={{ color:T.muted, fontSize:11 }}>Nabízet automaticky u všech příštích staveb</div>
            </div>
          </label>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => onConfirm(cilSekce, jeStandard)}
            style={{ flex:1, padding:'10px 0', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            ✓ Zařadit do katalogu
          </button>
          <button onClick={onCancel}
            style={{ padding:'10px 16px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:8, color:T.muted, fontSize:13, cursor:'pointer' }}>
            Přeskočit
          </button>
        </div>
      </div>
    </div>
  )
}

// ── komponenty ───────────────────────────────────────────
function ItemRow({ row, color, T, onChange, onRemove, canRemove, katalogItems, secKey, onNewPopis }) {
  const [open, setOpen] = useState(false)
  const val = row.popis || ''
  const suggestions = katalogItems
    ? katalogItems.filter(k => k.sekce === secKey && k.popis.toLowerCase().includes(val.toLowerCase()) && k.popis !== val)
    : []

  const handleBlur = () => {
    // Po opuštění pole — pokud je nový popis který není v katalogu, nabídneme zařazení
    setTimeout(() => {
      setOpen(false)
      if (val.trim().length > 2 && katalogItems && !katalogItems.find(k => k.popis === val.trim())) {
        onNewPopis && onNewPopis(val.trim(), secKey)
      }
    }, 200)
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 140px 28px', gap:6, marginBottom:5, position:'relative' }}>
      <div style={{ position:'relative' }}>
        <input value={val} placeholder="Popis…"
          onChange={e => { onChange({ ...row, popis: e.target.value }); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${T.border}`, borderRadius:5, color:T.text, fontSize:12, padding:'5px 9px', outline:'none', fontFamily:'system-ui', boxSizing:'border-box' }} />
        {open && suggestions.length > 0 && (
          <div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, zIndex:200, boxShadow:'0 8px 24px rgba(0,0,0,0.3)', overflow:'hidden' }}>
            {suggestions.slice(0, 6).map(s => (
              <div key={s.id} onMouseDown={() => { onChange({ ...row, popis: s.popis }); setOpen(false) }}
                style={{ padding:'7px 11px', cursor:'pointer', fontSize:12, color:T.text, borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:8 }}>
                {s.je_standard && <span style={{ fontSize:9, background:'#3b82f620', color:'#3b82f6', padding:'1px 5px', borderRadius:3, fontWeight:700 }}>STD</span>}
                {s.popis}
              </div>
            ))}
          </div>
        )}
      </div>
      <input value={row.castka} placeholder="0" onChange={e => onChange({ ...row, castka: e.target.value })}
        onKeyDown={onEnterNext}
        style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${T.border}`, borderRadius:5, color, fontSize:12, padding:'5px 9px', outline:'none', fontFamily:'monospace', textAlign:'right' }} />
      <button onClick={onRemove} style={{ background:'none', border:'none', color: canRemove ? '#ef4444' : 'transparent', fontSize:14, cursor: canRemove ? 'pointer' : 'default', padding:0 }}>✕</button>
    </div>
  )
}

// Jednoduchá sekce pro GZS a Stimulační – stejný vzhled jako položky v Sekce
function OstatniSekce({ secKey, label, data, color, T, handlers, katalog, onNewPopis, onLabelChange, editLabel }) {
  const { toggle, addRow, changeRow, removeRow } = handlers
  const sec = data[secKey] || { rows: [{ id: 'r1', popis: '', castka: '' }], open: false }
  const rowTotal = sec.rows.reduce((a, r) => a + (parseFloat(r.castka) || 0), 0)
  const cnt = sec.rows.length
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, marginBottom:12, overflow:'hidden' }}>
      <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ color, fontWeight:800, fontSize:14, flex:1 }}>{label}</span>
        <span style={{ color:T.muted, fontFamily:'monospace', fontSize:12 }}>Σ {rowTotal.toLocaleString('cs-CZ',{minimumFractionDigits:2})} Kč</span>
      </div>
      <div style={{ padding:'10px 14px' }}>
        <div style={{ marginBottom:6 }}>
          <div onClick={() => toggle('dof', secKey)}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6, cursor:'pointer',
              background: sec.open ? `${color}12` : 'transparent',
              border:`1px solid ${sec.open ? color+'30' : T.border}` }}>
            <div style={{ width:7, height:7, borderRadius:2, background: rowTotal!=0 ? color : T.border, flexShrink:0 }}/>
            <span style={{ color: sec.open ? color : rowTotal!=0 ? T.text : T.muted, fontSize:13, fontWeight: sec.open?700:400, flex:1 }}>
              {editLabel ? (data[secKey]?.customLabel || label) : label}
            </span>
            {cnt > 1 && <span style={{ background:`${color}22`, color, fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:4 }}>{cnt}×</span>}
            <span style={{ fontFamily:'monospace', fontSize:12, fontWeight: rowTotal!=0?700:400, color: sec.open ? color : rowTotal!=0 ? T.text : T.muted }}>
              {rowTotal.toLocaleString('cs-CZ',{minimumFractionDigits:2})}
            </span>
            <span style={{ color:T.muted, fontSize:10 }}>{sec.open?'▲':'▼'}</span>
          </div>
          {sec.open && (
            <div style={{ padding:'10px 10px 6px', background:`${color}08`, borderRadius:'0 0 6px 6px', border:`1px solid ${color}20`, borderTop:'none' }}>
              {editLabel && (
                <div style={{ marginBottom:8 }}>
                  <input value={data[secKey]?.customLabel || ''} placeholder={label + ' (název…)'}
                    onClick={e => e.stopPropagation()}
                    onChange={e => onLabelChange && onLabelChange('dof', secKey, e.target.value)}
                    style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:`1px solid ${color}40`, borderRadius:5, color, fontSize:12, padding:'5px 9px', outline:'none', boxSizing:'border-box', fontStyle:'italic' }} />
                </div>
              )}
              {sec.rows.map((row, idx) => (
                <ItemRow key={row.id} row={row} color={color} T={T}
                  onChange={r => changeRow('dof', secKey, idx, r)}
                  onRemove={() => removeRow('dof', secKey, idx)}
                  canRemove={sec.rows.length > 1}
                  katalogItems={katalog} secKey={secKey} onNewPopis={onNewPopis} />
              ))}
              <button onClick={() => addRow('dof', secKey)}
                style={{ width:'100%', padding:'5px 10px', background:'transparent', border:`1px dashed ${color}40`, borderRadius:5, color, fontSize:11, cursor:'pointer', marginBottom:6 }}>
                + přidat řádek
              </button>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 8px' }}>
                <span style={{ color:T.muted, fontSize:11 }}>Součet</span>
                <span style={{ color, fontFamily:'monospace', fontSize:13, fontWeight:800 }}>{rowTotal.toLocaleString('cs-CZ',{minimumFractionDigits:2})} Kč</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Sekce({ secKey, items, data, color, icon, label, handlers, sumS, sumBez, zisk, T, onLabelChange, katalog, onNewPopis, hodMont, hodZem }) {
  const { toggle, addRow, changeRow, removeRow } = handlers
  const total = sumBez != null ? sumBez : sumS

  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, marginBottom:12, overflow:'hidden' }}>
      <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:16 }}>{icon}</span>
        <span style={{ color, fontWeight:800, fontSize:14, flex:1 }}>{label}</span>
        {hodMont != null && (
          <span style={{ color:T.muted, fontSize:11, fontFamily:'monospace', marginRight:8 }}>
            mont. <span style={{ color, fontWeight:700 }}>{hodMont.toFixed(3)}</span> hod
            {'  '}
            zem. <span style={{ color, fontWeight:700 }}>{hodZem.toFixed(3)}</span> hod
          </span>
        )}
        <span style={{ color:T.muted, fontFamily:'monospace', fontSize:12 }}>Σ {fmt(total)} Kč</span>
      </div>
      <div style={{ padding:'10px 14px' }}>
        {[...items].sort((a, b) => {
          const aVal = itemSum((data[a.key]?.rows || mkRows()))
          const bVal = itemSum((data[b.key]?.rows || mkRows()))
          if (aVal !== 0 && bVal === 0) return -1
          if (aVal === 0 && bVal !== 0) return 1
          return 0
        }).map(it => {
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
                      canRemove={sec.rows.length > 1}
                      katalogItems={katalog}
                      secKey={it.key}
                      onNewPopis={onNewPopis} />
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
  const [katalog, setKatalog] = useState([])
  const [katalogDialog, setKatalogDialog] = useState(null)
  const [importDialog, setImportDialog] = useState(null)
  const [profile, setProfile] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null) // { title, text, onConfirm }
  const [alertDialog, setAlertDialog] = useState(null)     // { title, text, color }
  const [lastSaved, setLastSaved] = useState(null)
  const [sazbyDialog, setSazbyDialog] = useState(null) // { parsedEBC, noveMzdy, noveMech, noveZemni }
  const importFileRef = useRef(null)
  const autosaveRef = useRef(null)

  // Načti katalog položek
  useEffect(() => {
    const loadKatalog = async () => {
      const { data } = await supabase.from('katalog_polozek').select('*').order('je_standard', { ascending: false })
      if (data) setKatalog(data)
    }
    loadKatalog()
  }, [])

  // Všechny sekce pro výběr v dialogu
  const vsechnySekce = [
    ...MECH.map(i => ({ key: i.key, label: 'Mech: ' + i.label })),
    ...ZEMNI.filter(i => !i.noIdx && !i.isProtlak).map(i => ({ key: i.key, label: 'Zemní: ' + i.label })),
  ]

  const handleNewPopis = (popis, sekce) => {
    setKatalogDialog({ popis, sekce })
  }

  const handleKatalogConfirm = async (cilSekce, jeStandard) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('katalog_polozek').insert({
      sekce: cilSekce,
      popis: katalogDialog.popis,
      je_standard: jeStandard,
      schvalil: user?.id,
    }).select().single()
    if (data) setKatalog(prev => [...prev, data])
    setKatalogDialog(null)
  }

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
      if (data.updated_at) setLastSaved(new Date(data.updated_at))
      // Načti profil uživatele
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setProfile(prof)
      }
    }
    load()
  }, [params.id])

  const save = async (data = s) => {
    setSaving(true)
    await supabase.from('stavby').update({ ...data, updated_at: new Date().toISOString() }).eq('id', params.id)
    setSaving(false); setSaved(true)
    setLastSaved(new Date())
    setTimeout(() => setSaved(false), 2000)
  }

  // Autosave při odchodu ze stránky
  useEffect(() => {
    if (!s) return
    const handleBeforeUnload = (e) => {
      save(s)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [s])

  const deleteStavba = () => {
    setConfirmDialog({
      title: 'Smazat stavbu',
      text: `Opravdu smazat stavbu "${s.nazev}"? Tato akce je nevratná.`,
      color: '#ef4444',
      onConfirm: async () => {
        await supabase.from('stavby').delete().eq('id', params.id)
        router.push('/dashboard')
      }
    })
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

  // ── Import z Excelu ──────────────────────────────────────
  const handleImportFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''

    // Dynamicky načti SheetJS
    if (!window.XLSX) {
      await new Promise((res, rej) => {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
        script.onload = res; script.onerror = rej
        document.head.appendChild(script)
      })
    }
    const XLSX = window.XLSX
    const ab = await file.arrayBuffer()
    const wb = XLSX.read(ab, { type: 'array', cellDates: true })

    // ── Detekce formátu ──────────────────────────────────────
    const isEBC = wb.SheetNames.includes('Globální náklady') && wb.SheetNames.includes('Práce, mechanizace a ost. nákl.')
    const isTemplate = wb.SheetNames.includes('Vstupní hodnoty')

    if (isEBC) {
      // ── Import z EBC formátu ─────────────────────────────
      const wsGN  = wb.Sheets['Globální náklady']
      const wsPM  = wb.Sheets['Práce, mechanizace a ost. nákl.']
      const wsMatV = wb.Sheets['Materiál vlastní']
      const rowsGN  = XLSX.utils.sheet_to_json(wsGN,  { header: 1, defval: '' })
      const rowsPM  = XLSX.utils.sheet_to_json(wsPM,  { header: 1, defval: '' })
      const rowsMatV = wsMatV ? XLSX.utils.sheet_to_json(wsMatV, { header: 1, defval: '' }) : []

      const num = (val) => parseFloat(String(val||'0').replace(/\s/g,'').replace(',','.')) || 0

      // Struktura EBC listu (sloupce jsou posunuté o 2 doleva — první 2 jsou vždy None):
      // Globální náklady: col[2]=Poř, col[3]=Kód, col[4]=Popis, col[5]=MJ, col[6]=Výměra/Cena, col[7]=Jedn.cena, col[8]=Celkem
      // Práce/mech:       col[2]=Ident, col[3]=Kód, col[4]=Popis, col[5]=MJ, col[6]=Výměra, col[7]=Jedn.hod, col[8]=Celkem hod, col[18]=Jedn.Cena, col[19]=Cena celkem
      // Název stavby:     R2 col[4]=název, col[7]=číslo stavby

      // Název a číslo stavby z R2
      const nazevStavby = String(rowsGN[1]?.[4] || rowsPM[1]?.[4] || '')
      const cisloStavby = String(rowsGN[1]?.[7] || rowsPM[1]?.[7] || '')

      // Pomocník: najdi řádek v GN listu podle obsahu sloupce col[4] (Popis) nebo col[3] (Kód)
      const findGN = (kody) => {
        const list = Array.isArray(kody) ? kody : [kody]
        return rowsGN.find(r => list.some(k =>
          String(r[4]||'').toLowerCase().includes(k.toLowerCase()) ||
          String(r[3]||'').toLowerCase().includes(k.toLowerCase())
        ))
      }

      // GN hodnota: col[6] = Výměra (pro JV = cena přímo), col[8] = Celkem
      const gnRow = (kody) => {
        const r = findGN(kody)
        if (!r) return 0
        return num(r[8]) || num(r[6])  // Celkem, fallback Výměra
      }

      // PM montážní a zemní hodiny
      let hMont = 0, hZem = 0
      for (const r of rowsPM) {
        const col1 = r[1]
        const popis = String(r[4]||'').toLowerCase()
        if (col1 === 3 || col1 === '3') {
          if (popis.includes('pm:') || popis.includes('mont')) hMont = num(r[8]) || hMont
          if (popis.includes('pz:') || popis.includes('zemní'))   hZem  = num(r[8]) || hZem
        }
      }

      // Stroje z listu Práce, mechanizace — řádky kde col[2]='S'
      // col[6]=množství, col[18]=jedn.cena, col[19]=cena celkem
      const stroje = {}
      for (const r of rowsPM) {
        if (String(r[2]||'').trim() !== 'S') continue
        const kod  = String(r[3]||'').trim()
        const cena = num(r[19]) || num(r[20])  // Cena celkem
        stroje[kod] = cena
      }

      // GZS a Stimulační přirážka — PP řádky, kód 9343 a 9349, cena = col[19]
      let gzsKc = 0, stimulacniKc = 0
      for (const r of rowsPM) {
        if (String(r[2]||'').trim() !== 'PP') continue
        const kod = String(r[3]||'').trim()
        if (kod === '9343') gzsKc = num(r[19])
        if (kod === '9349') stimulacniKc = num(r[19])
      }

      // Subdodávky — def. zádlažba (53001) a def. úprava fasád (54003)
      const wsSub = wb.Sheets['Subdodávky']
      let zadlazbyKc = 0, stavPraceKc = 0
      if (wsSub) {
        const rowsSub = XLSX.utils.sheet_to_json(wsSub, { header: 1, defval: '' })
        for (const r of rowsSub) {
          const kod = String(r[3]||'').trim()
          if (kod === '53001') zadlazbyKc = num(r[8])
          if (kod === '54003') stavPraceKc = num(r[8])
        }
      }

      // PZ zemní práce v Kč — hledám řádek kde col[4] obsahuje 'PZ:'
      let zemniPraceKc = 0
      for (const r of rowsPM) {
        const col1 = r[1]
        const popis = String(r[4]||'').toLowerCase()
        if ((col1 === 3 || col1 === '3') && (popis.includes('pz:') || popis.includes('zemní'))) {
          zemniPraceKc = num(r[19]) || num(r[20]) || zemniPraceKc
        }
      }

      // Materiál vlastní — col[8]=Cena, col[3]=Kód, col[4]=Popis
      let matVlastniCelkem = 0
      let pisekD02 = 0
      for (const r of rowsMatV) {
        const popis = String(r[4]||'').toLowerCase()
        const kod = String(r[3]||'')
        if (popis.includes('celkem') && num(r[8]) > 0) {
          matVlastniCelkem = num(r[8])
        }
        if (kod.includes('800000000301')) {
          pisekD02 = num(r[8])
        }
      }
      if (!matVlastniCelkem) {
        for (const r of rowsMatV) {
          const mnozV = num(r[6]), cenaV = num(r[7])
          if (mnozV > 0 && cenaV > 0) matVlastniCelkem += mnozV * cenaV
        }
      }

      // Příspěvek na sklad — z listu Rekapitulace pro EBC col[7]=Příspěvek za sklad, řádky úrovně 1
      const wsRekap = wb.Sheets['Rekapitulace pro EBC']
      let prispevekSklad = 0
      if (wsRekap) {
        const rowsRekap = XLSX.utils.sheet_to_json(wsRekap, { header: 1, defval: '' })
        for (const r of rowsRekap) {
          if ((r[1] === 1 || r[1] === '1') && num(r[7]) > 0) {
            prispevekSklad += num(r[7])
          }
        }
      }

      // Sestavení parsed EBC
      const parsedEBC = {
        nazev: nazevStavby,
        cislo: cisloStavby,
        mzdy_ebc_hmont: hMont,
        mzdy_ebc_hzem:  hZem,
        // Mechanizace
        mech: {
          jerab:    [{ id: uid(), popis: 'Autojeřáb',    castka: String(Math.round(stroje['120']  || 0)) }],
          nakladni: [{ id: uid(), popis: 'Nákladní auto', castka: String(Math.round((stroje['420']||0)+(stroje['440']||0))) }],
          traktor:  [{ id: uid(), popis: 'Traktor',       castka: String(Math.round(stroje['640']  || 0)) }],
          plosina:  [{ id: uid(), popis: 'Plošina',       castka: '0' }],
        },
        // Zemní práce (Kč)
        zemni: {
          bagr:         [{ id: uid(), popis: 'Rypadlo do 0,5m³',       castka: String(Math.round(stroje['520']||0)) }, { id: uid(), popis: 'Minirýpadlo pás. do 3,5t', castka: '0' }],
          kompresor:    [{ id: uid(), popis: 'Kompresor',               castka: String(Math.round(stroje['740']||0)) }],
          rezac:        [{ id: uid(), popis: 'Řezač asfaltu',           castka: String(Math.round(stroje['260']||0)) }],
          mot_pech:     [{ id: uid(), popis: 'Motorový pěch',           castka: String(Math.round(stroje['240']||0)) }],
          uhlova_bruska:[{ id: uid(), popis: 'Úhlová bruska',           castka: String(Math.round(stroje['255']||0)) }],
          mat_vlastni:  [{ id: uid(), popis: 'Materiál vlastní', castka: String(Math.round(matVlastniCelkem * 100) / 100) }],
          pisek_d02:    [{ id: uid(), popis: 'Písek D0-2',              castka: String(Math.round(pisekD02)) }],
          // Ostatní položky zemních prací z EBC nejsou přímo dostupné — ponecháme 0
          zemni_prace:  [{ id: uid(), popis: 'Zemní práce', castka: '0' }],
          zadlazby:     [{ id: uid(), popis: 'Def. zádlažba', castka: String(Math.round(zadlazbyKc)) }],
          sterk_3264:   [{ id: uid(), popis: 'Štěrkokamen 32-64', castka: '0' }],
          beton:        [{ id: uid(), popis: 'Beton',        castka: '0' }],
          asfalt:       [{ id: uid(), popis: 'Asfalt',       castka: '0' }],
          optotrubka:   [{ id: uid(), popis: 'Optotrubka',   castka: '0' }],
          nalosute:     [{ id: uid(), popis: 'Naložení a doprava sutě', castka: '0' }],
          stav_prace:   [{ id: uid(), popis: 'Stav. práce m. rozsahu', castka: '0' }],
          def_fasady:   [{ id: uid(), popis: 'Def. úprava fasád', castka: String(Math.round(stavPraceKc)) }],
          rezerv_zemni: [{ id: uid(), popis: 'Rezerva zemní', castka: '0' }],
          pisek_b04:    [{ id: uid(), popis: 'Písek B0-4',   castka: '0' }],
          pisek_beton:  [{ id: uid(), popis: 'Písek pro beton', castka: '0' }],
          sterk_032:    [{ id: uid(), popis: 'Štěrk 0-32',   castka: '0' }],
          protlak:      [{ id: uid(), popis: 'Protlak',       castka: '0' }],
          roura_pe:     [{ id: uid(), popis: 'Roura PE',      castka: '0' }],
        },
        // GN
        gn: {
          inzenyrska:     { rows: [{ id: uid(), popis: 'Inženýring zhotovitele CAPEX', castka: String(gnRow(['Inženýring zhotovitele','1101999'])) }], open: false },
          geodetika:      { rows: [{ id: uid(), popis: 'Geodetické práce',             castka: String(gnRow(['Geodetick','1102000'])) }], open: false },
          te_evidence:    { rows: [{ id: uid(), popis: 'Dokumentace pro TE',           castka: String(gnRow(['Dokumentace pro TE','1102010'])) }], open: false },
          vychozi_revize: { rows: [{ id: uid(), popis: 'Výchozí revize',               castka: String(gnRow(['Výchozí revize','1101594'])) }], open: false },
          pripl_ppn:      { rows: [{ id: uid(), popis: 'Přípl. PPN',                   castka: '0' }], open: false },
          ekolog_likv:    { rows: [{ id: uid(), popis: 'Ekologická likvidace odpadů',  castka: String(gnRow(['Ekolog','1101638'])) }], open: false },
          material_vyn:   { rows: [{ id: uid(), popis: 'Materiál výnosový',            castka: '0' }], open: false },
          doprava_mat:    { rows: [{ id: uid(), popis: 'Doprava materiálu na stavbu',  castka: String(gnRow(['Doprava materiálu','1102007'])) }], open: false },
          popl_ver:       { rows: [{ id: uid(), popis: 'Popl. ver. prostranství',      castka: '0' }], open: false },
          pripl_capex:    { rows: [{ id: uid(), popis: 'Přípl. CAPEX',                 castka: '0' }], open: false },
          kolaudace:      { rows: [{ id: uid(), popis: 'Kolaudace',                    castka: '0' }], open: false },
        },
        // DOF
        dof: {
          dio:          { rows: [{ id: uid(), popis: 'DIO',                    castka: String(gnRow(['Dopravní značení','1101929'])) }], open: false },
          vytyc_siti:   { rows: [{ id: uid(), popis: 'Vytýčení sítí',          castka: String(gnRow(['Vytyčení','Vytýčení','1101922'])) }], open: false },
          neplanvykon:  { rows: [{ id: uid(), popis: 'Neplánovaný výkon',       castka: '0' }], open: false },
          spravni_popl: { rows: [{ id: uid(), popis: 'Správní poplatky',        castka: '0' }], open: false },
          demontaz:     { rows: [{ id: uid(), popis: 'Demontáž',                castka: '0' }], open: false },
          spec_zadlazby:{ rows: [{ id: uid(), popis: 'Speciální zádlažby',      castka: '0' }], open: false },
          omezeni_dopr: { rows: [{ id: uid(), popis: 'Omezení sil. provozu',    castka: '0' }], open: false },
          rezerva:      { rows: [{ id: uid(), popis: 'Rezerva',                 castka: '0' }], open: false },
          archeolog_dozor: { rows: [{ id: uid(), popis: 'Archeologický dozor',    castka: String(gnRow(['Archeologický dozor','1101925'])) }], open: false },
          gzs:          { rows: [{ id: uid(), popis: 'GZS (SO)',                  castka: String(Math.round(gzsKc * 100) / 100) }], open: false },
          stimul_prirazka: { rows: [{ id: uid(), popis: 'Stimulační přirážka',   castka: String(Math.round(stimulacniKc * 100) / 100) }], open: false },
        },
      }

      // Mzdy — hodiny mont/zemní dosadíme do mont_nn a zem_nn (NN = nejblíže odpovídá)
      // Přesné rozdělení VN/NN/TS z EBC nelze, dáme vše do mont_nn resp. zem_nn
      // Sestavení čistých mzdy — žádné hodnoty z databáze nepřežijí
      const noveMzdy = mkSec(MZDY)
      noveMzdy['mont_nn'] = { rows: [{ id: uid(), popis: 'Montáž NN (EBC import)', castka: String(Math.round(hMont * 10) / 10) }], open: false }

      // Zemní práce — čistý objekt
      const noveZemni = mkSec(ZEMNI)
      for (const [k, rows] of Object.entries(parsedEBC.zemni)) noveZemni[k] = { rows, open: false }
      noveZemni['zemni_prace'] = { rows: [{ id: uid(), popis: 'Zemní práce (EBC import)', castka: String(Math.round(zemniPraceKc)) }], open: false }

      // Mech — čistý objekt
      const noveMech = mkSec(MECH)
      for (const [k, rows] of Object.entries(parsedEBC.mech)) noveMech[k] = { rows, open: false }

      setSazbyDialog({ parsedEBC, noveMzdy, noveMech, noveZemni, prispevekSklad, hMont, zemniPraceKc })
      setImportDialog(null)
      return
    }

    if (!isTemplate) {
      setAlertDialog({ title: 'Chyba importu', text: 'Nerozpoznaný formát souboru. Očekáván list "Vstupní hodnoty" nebo EBC formát (listy "Globální náklady", "Práce, mechanizace a ost. nákl.").', color: '#ef4444' })
      return
    }

    const ws = wb.Sheets['Vstupní hodnoty']
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    // Pomocná funkce: najdi řádek podle názvu v sloupci A
    const findRow = (name) => rows.find(r => String(r[0]||'').toLowerCase().includes(name.toLowerCase()))
    const v = (row, col) => parseFloat(String(row?.[col]||'0').replace(/\s/g,'').replace(',','.')) || 0

    // Mapování: { klíč: hodnota }
    // R1 hlavičky sloupců: col6=Jeřáb, col8=Nák.auto, col10=Traktor, col12=Plošina
    //                      col14=Zem.práce, col16=Zádlažby, col18=Bagr, col20=Kopresor
    //                      col22=Řez.asfaltu, col24=Protlak, col26=Mot.pěch, col28=Úhl.bruska
    // R20 hlavičky: col6=GZS, col8=Stimul, col12=Mat.vlastní, col14=Asfalt
    //               col16=Písek, col18=Štěrk, col20=Beton, col22=Mat.zhot, col24=Optotrubka
    //               col26=Nalož.suť, col28=Stav.pr., col30=Rezerv.zemní
    // Součtový řádek R18 (Vytýčení sítí) obsahuje součty všech sloupců
    const sumRow = rows[17] // R18 = index 17

    // GN — sloupec B (index 1)
    const gnMap = {
      inzenyrska:     findRow('Inženýrsk'),
      geodetika:      findRow('Geodetick'),
      te_evidence:    findRow('technická evidence'),
      vychozi_revize: findRow('Výchozí revize'),
      pripl_ppn:      findRow('PPN'),
      ekolog_likv:    findRow('Eko'),
      material_vyn:   findRow('Materiál výnosový'),
      doprava_mat:    findRow('Doprava mat'),
      popl_ver:       findRow('veř.prostranství'),
      pripl_capex:    findRow('Capex'),
      kolaudace:      findRow('Kolaudace'),
    }

    // DOF — sloupec B (index 1)
    const dofMap = {
      dio:          findRow('DIO'),
      vytyc_siti:   findRow('Vytýčení sítí'),
      neplanvykon:  findRow('Neplánovaný'),
      spravni_popl: findRow('Správní poplatky'),
      demontaz:     findRow('Demontáž'),
      spec_zadlazby:findRow('Speciální zádlažby'),
      omezeni_dopr: findRow('Omezení sil'),
      rezerva:      findRow('Rezerva'),
    }

    // Sestavení parsed dat
    const parsed = {
      prirazka:       String(v(findRow('Vysoutěžená přírážka'), 1)),
      hzs_mont:       String(v(findRow('HZS montážní'), 1)),
      hzs_zem:        String(v(findRow('HZS zemní'), 1)),
      zmes_mont:      String(v(findRow('Montážní práce ZMES'), 1)),
      zmes_zem:       String(v(findRow('Zemní práce ZMES'), 1)),
      prispevek_sklad:String(v(findRow('Příspěvek na sklad'), 1)),
      // Mechanizace ze součtového řádku R18
      mech: {
        jerab:    [{ id: uid(), popis: 'Autojeřáb', castka: String(v(sumRow, 6)) }],
        nakladni: [{ id: uid(), popis: 'Nákladní auto', castka: String(v(sumRow, 8)) }],
        traktor:  [{ id: uid(), popis: 'Traktor', castka: String(v(sumRow, 10)) }],
        plosina:  [{ id: uid(), popis: 'Plošina', castka: String(v(sumRow, 12)) }],
      },
      // Zemní práce ze součtového řádku R18
      zemni: {
        zemni_prace:  [{ id: uid(), popis: 'Zemní práce', castka: String(v(sumRow, 14)) }],
        zadlazby:     [{ id: uid(), popis: 'Zádlažby', castka: String(v(sumRow, 16)) }],
        bagr:         [{ id: uid(), popis: 'Rypadlo do 0,5m³', castka: String(v(sumRow, 18)) }, { id: uid(), popis: 'Minirýpadlo pás. do 3,5t', castka: '0' }],
        kompresor:    [{ id: uid(), popis: 'Kompresor', castka: String(v(sumRow, 20)) }],
        rezac:        [{ id: uid(), popis: 'Řezač asfaltu', castka: String(v(sumRow, 22)) }],
        mot_pech:     [{ id: uid(), popis: 'Motorový pěch', castka: String(v(sumRow, 26)) }],
        uhlova_bruska:[{ id: uid(), popis: 'Úhlová bruska', castka: String(v(sumRow, 28)) }],
        // R20 sloupce pro materiál
        mat_vlastni:  [{ id: uid(), popis: 'Materiál vlastní', castka: String(v(rows[20], 12)) }],
        asfalt:       [{ id: uid(), popis: 'Asfalt', castka: String(v(rows[20], 14)) }],
        pisek_d02:    [{ id: uid(), popis: 'Písek D0-2', castka: String(v(rows[20], 16)) }],
        sterk_3264:   [{ id: uid(), popis: 'Štěrkokamen 32-64', castka: String(v(rows[20], 18)) }],
        beton:        [{ id: uid(), popis: 'Beton', castka: String(v(rows[20], 20)) }],
        optotrubka:   [{ id: uid(), popis: 'Optotrubka', castka: String(v(rows[20], 24)) }],
        nalosute:     [{ id: uid(), popis: 'Naložení a doprava sutě', castka: String(v(rows[20], 26)) }],
        stav_prace:   [{ id: uid(), popis: 'Stav. práce m. rozsahu', castka: String(v(rows[20], 28)) }],
        rezerv_zemni: [{ id: uid(), popis: 'Rezerva zemní', castka: String(v(rows[20], 30)) }],
      },
      // GN
      gn: Object.fromEntries(
        Object.entries(gnMap).map(([k, row]) => [k, { rows: [{ id: uid(), popis: k, castka: String(v(row, 1)) }], open: false }])
      ),
      // DOF
      dof: Object.fromEntries(
        Object.entries(dofMap).map(([k, row]) => [k, { rows: [{ id: uid(), popis: k, castka: String(v(row, 1)) }], open: false }])
      ),
    }

    // Zjisti chybějící položky (hodnota 0)
    const missing = []
    const checkZero = (label, val) => { if (!parseFloat(val)) missing.push(label) }
    checkZero('Jeřáb', parsed.mech.jerab[0].castka)
    checkZero('Nákladní auto', parsed.mech.nakladni[0].castka)
    checkZero('Traktor', parsed.mech.traktor[0].castka)
    checkZero('Plošina', parsed.mech.plosina[0].castka)
    checkZero('Zemní práce', parsed.zemni.zemni_prace[0].castka)
    checkZero('Zádlažby', parsed.zemni.zadlazby[0].castka)
    checkZero('Bagr', parsed.zemni.bagr[0].castka)
    checkZero('Inženýrská činnost', parsed.gn.inzenyrska?.rows[0]?.castka)
    checkZero('Geodetické práce', parsed.gn.geodetika?.rows[0]?.castka)

    if (missing.length > 0) {
      setImportDialog({ missing, parsed })
    } else {
      applyImport(parsed)
    }
  }

  const applyImport = (parsed) => {
    setS(prev => {
      const next = { ...prev, ...parsed }
      // Doplň chybějící mzdy, gn, dof klíče
      const mzdy = prev.mzdy || {}
      for (const it of MZDY) if (!mzdy[it.key]) mzdy[it.key] = { rows: mkRows(), open: false }
      const zemni = { ...prev.zemni }
      for (const it of ZEMNI) if (!zemni[it.key]) zemni[it.key] = { rows: mkRows(), open: false }
      // Přepiš zemni z parsed
      for (const [k, rows] of Object.entries(parsed.zemni)) {
        zemni[k] = { rows, open: false }
      }
      const mech = { ...prev.mech }
      for (const [k, rows] of Object.entries(parsed.mech)) {
        mech[k] = { rows, open: false }
      }
      return { ...next, mzdy, mech, zemni }
    })
    setImportDialog(null)
    setAlertDialog({ title: '✅ Import dokončen', text: 'Všechny hodnoty byly načteny. Zkontroluj a ulož.', color: '#10b981' })
  }

  const applySazby = (sazby) => {
    const { parsedEBC, noveMzdy, noveMech, noveZemni, prispevekSklad } = sazbyDialog
    setS(prev => ({
      ...prev,
      nazev: parsedEBC.nazev || prev.nazev,
      cislo: parsedEBC.cislo || prev.cislo,
      prirazka: String(num(sazby.prirazka) / 100),
      hzs_mont: sazby.hzs_mont,
      hzs_zem:  sazby.hzs_zem,
      zmes_mont: sazby.zmes_mont,
      zmes_zem:  sazby.zmes_zem,
      mzdy:  noveMzdy,
      mech:  noveMech,
      zemni: noveZemni,
      gn:    parsedEBC.gn,
      dof:   parsedEBC.dof,
      prispevek_sklad: prispevekSklad > 0 ? String(Math.round(prispevekSklad * 100) / 100) : prev.prispevek_sklad,
    }))
    setSazbyDialog(null)
    setAlertDialog({ title: '✅ Import EBC dokončen', text: `Montáž: ${Math.round(sazbyDialog.hMont*10)/10} hod, Zemní práce: ${Math.round(sazbyDialog.zemniPraceKc).toLocaleString('cs')} Kč.`, color: '#10b981' })
  }

  return (
    <div style={{ minHeight:'100vh', background:T.bg }}>
      {/* HEADER */}
      <div style={{ background:T.header, borderBottom:`1px solid ${T.border}`, padding:'0 20px', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ maxWidth:1060, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0 0', flexWrap:'wrap' }}>
            <button onClick={() => { save(s); router.push('/dashboard') }} style={{ background:'transparent', border:`1px solid ${T.border}`, borderRadius:6, padding:'4px 10px', color:T.muted, fontSize:12, cursor:'pointer' }}>← zpět</button>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:10, color:T.muted, letterSpacing:1.5, textTransform:'uppercase' }}>Kalkulace stavby · {s.oblast}</div>
              <div style={{ fontSize:16, fontWeight:800, color:T.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {s.nazev || <span style={{ color:T.muted }}>Bez názvu…</span>}
              </div>
              {lastSaved && (
                <div style={{ fontSize:10, color:'#10b981', marginTop:2 }}>
                  🕐 Poslední záloha: {lastSaved.toLocaleTimeString('cs-CZ', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                </div>
              )}
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
            {profile?.role === 'admin' && (
              <button onClick={deleteStavba} style={{ padding:'6px 14px', background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:6, color:'#ef4444', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                🗑️ Smazat
              </button>
            )}
            <button onClick={() => save()} style={{ padding:'6px 14px', background: saved?'#10b981':'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:6, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              {saving ? '…' : saved ? '✓ Uloženo' : '💾 Uložit'}
            </button>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10 }}>
            <div style={{ display:'flex' }}>
              {[{k:'vstup',l:'📥 Vstupní hodnoty'},{k:'rozbor',l:'📊 Rozbor'}].map(t=>(
                <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'8px 20px', background:tab===t.k?'rgba(37,99,235,0.2)':'transparent', border:'none', borderBottom:tab===t.k?'3px solid #3b82f6':'3px solid transparent', borderRadius:'6px 6px 0 0', color:tab===t.k?'#3b82f6':T.muted, cursor:'pointer', fontSize:13, fontWeight:tab===t.k?800:400 }}>{t.l}</button>
              ))}
            </div>
            <div>
              <input ref={importFileRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={handleImportFile} />
              <button onClick={() => importFileRef.current?.click()}
                style={{ padding:'7px 16px', background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.4)', borderRadius:7, color:'#818cf8', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                📂 Importovat z Excelu
              </button>
            </div>
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

                ].map(({l,k,span,isPct,isSelect,isStav})=>(
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
                        onChange={e=>setField(k, isPct ? e.target.value : e.target.value)}
                        onBlur={e=>{ if(isPct) setField(k, String(num(e.target.value)/100)) }}
                        onKeyDown={onEnterNext}
                        style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:`1px solid ${T.border}`, borderRadius:6, color:T.text, fontSize:13, padding:'7px 10px', outline:'none', boxSizing:'border-box', fontFamily:'monospace' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Sekce secKey="gn"    items={GN}    data={s.gn}    T={T} color={SEC.gn.color}    icon={SEC.gn.icon}    label={SEC.gn.label}    sumS={c.gnSumS}    sumBez={c.gnSumBez}    zisk={c.gnZisk}    handlers={gnH}    onLabelChange={handleLabelChange} katalog={katalog} onNewPopis={handleNewPopis} />
            <Sekce secKey="dof"   items={DOF}   data={s.dof}   T={T} color={SEC.dof.color}   icon={SEC.dof.icon}   label={SEC.dof.label}   sumS={c.dofSumS}   sumBez={c.dofBez}                     handlers={dofH}   onLabelChange={handleLabelChange} katalog={katalog} onNewPopis={handleNewPopis} />
            <Sekce secKey="mzdy"  items={MZDY}  data={s.mzdy}  T={T} color={SEC.mzdy.color}  icon={SEC.mzdy.icon}  label={SEC.mzdy.label}  sumS={c.mzdySumHzs}  sumBez={c.mzdySumHzs}  zisk={c.mzdyZisk}  handlers={mzdyH}  onLabelChange={handleLabelChange} katalog={katalog} onNewPopis={handleNewPopis} hodMont={c.hodMont} hodZem={c.hodZem} />
            <Sekce secKey="mech"  items={MECH}  data={s.mech}  T={T} color={SEC.mech.color}  icon={SEC.mech.icon}  label={SEC.mech.label}  sumS={c.mechSumS}  sumBez={c.mechSumBez}  zisk={c.mechZisk}  handlers={mechH}  onLabelChange={handleLabelChange} katalog={katalog} onNewPopis={handleNewPopis} />
            <Sekce secKey="zemni" items={ZEMNI} data={s.zemni} T={T} color={SEC.zemni.color} icon={SEC.zemni.icon} label={SEC.zemni.label} sumS={c.zemniSumS} sumBez={c.zemniSumBez} zisk={c.zemniZisk} handlers={zemniH} onLabelChange={handleLabelChange} katalog={katalog} onNewPopis={handleNewPopis} />

            {/* Ostatní */}
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:'14px 16px', marginBottom:12 }}>
              <div style={{ color:'#14b8a6', fontSize:11, fontWeight:800, letterSpacing:1, textTransform:'uppercase', marginBottom:12 }}>🔧 Ostatní</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:14 }}>
                {[
                  { l:'Materiál zhotovitele', val: fmt(c.matZhot) },
                  { l:'Materiál vlastní',     val: fmt(c.matVlastni) },
                  { l:'Příspěvek na sklad',   val: fmt(num(s.prispevek_sklad)) },
                  { l:'GZS',                  val: fmt((s.dof?.gzs?.rows||[]).reduce((a,r)=>a+(parseFloat(r.castka)||0),0)) },
                  { l:'Stimulační přirážka',  val: fmt(num(s.dof?.stimul_prirazka?.rows?.[0]?.castka)) },
                ].map(({l,val})=>(
                  <div key={l}>
                    <div style={{ color:T.muted, fontSize:10, fontWeight:700, marginBottom:2 }}>{l}</div>
                    <div style={{ width:'100%', background:'rgba(20,184,166,0.08)', border:`1px solid rgba(20,184,166,0.3)`, borderRadius:6, color:'#14b8a6', fontSize:13, padding:'7px 10px', boxSizing:'border-box', fontFamily:'monospace', fontWeight:700 }}>{val} Kč</div>
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
              const hzsM = num(s.hzs_mont), hzsZ = num(s.hzs_zem)
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
                const saz = it.isZem ? hzsZ : hzsM
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
              const zemniRowsBez = zemniRows.filter(r=>!r.isProtlak).reduce((a,r)=>a+r.bez,0)
              const bazova = mzdyBez+mechBez+zemniRowsBez+gnBez+dofBez

              return (
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:'12px 14px', fontSize:11, overflowX:'auto' }}>
                  <SekceHeader label="Mzdy montáže" color="#3b82f6" icon="👷" />
                  {/* Součet hodin */}
                  <div style={{ display:'grid', gridTemplateColumns:cols, background:'rgba(59,130,246,0.06)', borderBottom:`1px solid ${T.border}40` }}>
                    <div style={{ padding:'5px 8px', color:'#3b82f6', fontSize:11, fontWeight:700 }}>⏱ Hodiny celkem</div>
                    <div style={{ padding:'5px 6px', textAlign:'right', fontFamily:'monospace', fontSize:12, fontWeight:800, color:'#3b82f6', gridColumn:'2/4' }}>
                      mont. {c.hodMont.toFixed(3)} hod
                    </div>
                    <div style={{ padding:'5px 6px', textAlign:'right', fontFamily:'monospace', fontSize:12, fontWeight:800, color:'#60a5fa', gridColumn:'4/6' }}>
                      zem. {c.hodZem.toFixed(3)} hod
                    </div>
                    <div style={{ padding:'5px 6px', textAlign:'right', fontFamily:'monospace', fontSize:11, color:T.muted, gridColumn:'6/8' }}>
                      Σ {(c.hodMont + c.hodZem).toFixed(3)} hod
                    </div>
                  </div>
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
                  <Row label="Mat. zhotovitele" bez={matZhot} priR={0} sP={matZhot} idx={0} kVypl={matZhot*0.8} color="#8b5cf6" />
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

      {/* Dialog schválení nové položky do katalogu */}
      {katalogDialog && (
        <KatalogDialog
          popis={katalogDialog.popis}
          sekce={katalogDialog.sekce}
          vsechnySekce={vsechnySekce}
          T={T}
          onConfirm={handleKatalogConfirm}
          onCancel={() => setKatalogDialog(null)}
        />
      )}

      {/* Confirm dialog */}
      {confirmDialog && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:28, maxWidth:420, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize:18, fontWeight:800, color: confirmDialog.color||'#f59e0b', marginBottom:12 }}>⚠️ {confirmDialog.title}</div>
            <div style={{ color:T.text, fontSize:14, lineHeight:1.6, marginBottom:24 }}>{confirmDialog.text}</div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setConfirmDialog(null)}
                style={{ padding:'9px 20px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:8, color:T.muted, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                Zrušit
              </button>
              <button onClick={() => { setConfirmDialog(null); confirmDialog.onConfirm() }}
                style={{ padding:'9px 20px', background: confirmDialog.color||'#ef4444', border:'none', borderRadius:8, color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700 }}>
                Potvrdit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert dialog */}
      {alertDialog && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:T.card, border:`1px solid ${alertDialog.color}40`, borderRadius:14, padding:28, maxWidth:420, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize:18, fontWeight:800, color: alertDialog.color, marginBottom:12 }}>{alertDialog.title}</div>
            <div style={{ color:T.text, fontSize:14, lineHeight:1.6, marginBottom:24 }}>{alertDialog.text}</div>
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button onClick={() => setAlertDialog(null)}
                style={{ padding:'9px 24px', background: alertDialog.color, border:'none', borderRadius:8, color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700 }}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {sazbyDialog && <SazbyDialog T={T} nazev={sazbyDialog.parsedEBC.nazev} onConfirm={applySazby} onCancel={() => setSazbyDialog(null)} />}

      {/* Dialog chybějící položky při importu */}
      {importDialog && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:28, maxWidth:480, width:'90%' }}>
            <div style={{ color:'#f59e0b', fontWeight:800, fontSize:16, marginBottom:12 }}>⚠️ Chybějící položky</div>
            <div style={{ color:T.muted, fontSize:13, marginBottom:16 }}>
              Následující položky mají v rozpočtu hodnotu 0. Chceš je přeskočit nebo zadat ručně po importu?
            </div>
            <div style={{ marginBottom:20 }}>
              {importDialog.missing.map(m => (
                <div key={m} style={{ padding:'6px 10px', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:6, marginBottom:6, color:'#fbbf24', fontSize:13 }}>
                  • {m}
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setImportDialog(null)}
                style={{ padding:'8px 18px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:7, color:T.muted, cursor:'pointer', fontSize:13 }}>
                Zrušit
              </button>
              <button onClick={() => applyImport(importDialog.parsed)}
                style={{ padding:'8px 18px', background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.5)', borderRadius:7, color:'#818cf8', cursor:'pointer', fontSize:13, fontWeight:700 }}>
                Importovat (doplním ručně)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
