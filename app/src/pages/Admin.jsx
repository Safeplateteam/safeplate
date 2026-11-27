import React, { useEffect, useState } from 'react'
import { admin, uploadPhoto } from '../lib/api.js'
import { PILLARS, AMENITIES, CHECKLIST, ISSUE_LABEL, POSITIVE } from '../lib/constants.js'
import { VerifiedBadge, Toast, timeAgo } from '../components/ui.jsx'
import { go } from '../App.jsx'

// Team-only page: #/admin  (protected by the passphrase stored in the database)
export default function Admin({ pgs, refresh }) {
  const [pass, setPass] = useState(() => sessionStorage.getItem('sp_admin') || '')
  const [dash, setDash] = useState(null)
  const [tab, setTab] = useState('dash')
  const [edit, setEdit] = useState(null)
  const [err, setErr] = useState('')
  const [toast, setToast] = useState('')
  const [q, setQ] = useState('')

  const load = async (p = pass) => {
    try { const d = await admin.dashboard(p); setDash(d); sessionStorage.setItem('sp_admin', p); setErr('') }
    catch (x) { setErr(x.message); setDash(null) }
  }
  useEffect(() => { if (pass) load() }, []) // eslint-disable-line
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  if (!dash) return (
    <div className="page center">
      <form className="done" onSubmit={e => { e.preventDefault(); load() }}>
        <img src="./icon.svg" alt="" style={{ width: 56 }} />
        <h2>SafePlate team</h2>
        <p className="muted">Enter the team passphrase</p>
        <input className="input" type="password" value={pass} onChange={e => setPass(e.target.value)} autoFocus />
        {err && <div className="notice error">{err}</div>}
        <button className="btn btn-primary btn-block">Open admin</button>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => go('/')}>Back to app</button>
      </form>
    </div>
  )

  if (edit) return <PgEditor pass={pass} pg={edit} onClose={async (saved) => { setEdit(null); if (saved) { await refresh(); await load(); flash('Saved ✓') } }} />

  const helpedTotal = dash.helped_yes + dash.helped_no
  const allTags = Object.entries(dash.issue_counts || {}).sort((a, b) => b[1] - a[1])
  const issues = allTags.filter(([k]) => !POSITIVE.has(k))
  const goods = allTags.filter(([k]) => POSITIVE.has(k))
  const t = q.toLowerCase()

  return (
    <div className="page admin">
      <header className="top simple">
        <button className="icon-btn" onClick={() => go('/')}>‹</button><b>SafePlate Admin</b>
        <button className="icon-btn" onClick={() => { sessionStorage.removeItem('sp_admin'); setDash(null); setPass('') }}>⎋</button>
      </header>
      <div className="tabs">
        {[['dash', 'Dashboard'], ['pgs', 'PGs'], ['owners', 'Owners'], ['areas', 'Areas'], ['reviews', 'Reviews'], ['visits', 'Visits']].map(([k, l]) =>
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'dash' && (
        <div className="pad">
          <div className="kpis">
            <Kpi n={dash.sessions} l="Unique visitors" />
            <Kpi n={helpedTotal ? Math.round(100 * dash.helped_yes / helpedTotal) + '%' : '–'} l={`"Helped me decide" (${helpedTotal} answers)`} />
            <Kpi n={dash.reviews} l={`Reviews (${dash.resident_reviews} via QR)`} />
            <Kpi n={dash.visit_requests} l="Visit requests" />
            <Kpi n={dash.pgs_verified} l={`Verified PGs (of ${dash.pgs_total})`} />
          </div>
          <h3>Problems reported by residents</h3>
          {issues.length === 0 && <p className="muted">No reviews yet.</p>}
          {issues.map(([k, n]) => (
            <div key={k} className="issue-row"><span>{ISSUE_LABEL[k] || k}</span><div className="bar"><div className="bar-fill" style={{ width: (100 * n / issues[0][1]) + '%', background: '#B42318' }} /></div><b>{n}</b></div>
          ))}
          <h3>What residents like</h3>
          {goods.length === 0 && <p className="muted">No positives tagged yet.</p>}
          {goods.map(([k, n]) => (
            <div key={k} className="issue-row"><span>{ISSUE_LABEL[k] || k}</span><div className="bar"><div className="bar-fill" style={{ width: (100 * n / goods[0][1]) + '%', background: '#0E7C66' }} /></div><b>{n}</b></div>
          ))}
          <p className="muted small">Tip: these numbers are your “grading” evidence — which share of problems are food vs hygiene vs amenities vs security.</p>
        </div>
      )}

      {tab === 'pgs' && (
        <div className="pad">
          <button className="btn btn-primary btn-block" onClick={() => setEdit({ verified: true, amenities: [], photos: [], audit_checklist: {} })}>＋ Onboard a new PG</button>
          <input className="input" placeholder="Search PGs…" value={q} onChange={e => setQ(e.target.value)} style={{ margin: '12px 0' }} />
          {(pgs || []).filter(p => !t || p.name.toLowerCase().includes(t)).map(p => (
            <div key={p.id} className="admin-row">
              <div><b>{p.name}</b><small>{p.verified ? '✓ Verified' : 'Web listing'} · {p.score?.review_count || 0} reviews</small></div>
              <div className="admin-actions">
                {p.verified && <button className="btn btn-small btn-ghost" onClick={() => go('/poster/' + p.id)}>QR poster</button>}
                <button className="btn btn-small btn-outline" onClick={() => setEdit(p)}>{p.verified ? 'Edit' : 'Verify'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'areas' && <Areas pass={pass} flash={flash} />}
      {tab === 'owners' && <Owners pass={pass} flash={flash} />}

      {tab === 'reviews' && (
        <div className="pad">
          {dash.recent_reviews.length === 0 && <p className="muted">No reviews yet.</p>}
          {dash.recent_reviews.map(r => (
            <div key={r.id} className={'admin-review' + (r.hidden ? ' hidden' : '')}>
              <div className="row-between"><b>{r.pg}</b><small>{timeAgo(r.created_at)}</small></div>
              <div className="small">{r.name} · {r.phone} {r.is_resident && '· QR resident'}</div>
              <div className="small">🥘{r.food} 🧹{r.hygiene} 🛠️{r.amenities} 🔒{r.security}</div>
              {r.comment && <p className="small">{r.comment}</p>}
              <button className="btn btn-small btn-ghost" onClick={async () => { await admin.hideReview(pass, r.id, !r.hidden); await load(); await refresh() }}>
                {r.hidden ? 'Show again' : 'Hide (fake/abusive)'}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'visits' && (
        <div className="pad">
          {dash.visits.length === 0 && <p className="muted">No visit requests yet.</p>}
          {dash.visits.map(v => (
            <div key={v.id} className="admin-review">
              <div className="row-between"><b>{v.pg}</b><small>{timeAgo(v.created_at)}</small></div>
              <div>{v.name} · <a href={'tel:' + v.phone}>{v.phone}</a></div>
              <div className="small muted">Moving: {v.move_in}{v.message ? ' · ' + v.message : ''}</div>
            </div>
          ))}
        </div>
      )}
      <Toast msg={toast} />
    </div>
  )
}

function Owners({ pass, flash }) {
  const [leads, setLeads] = useState(null)
  const load = () => admin.ownerLeads(pass).then(setLeads).catch(e => flash(e.message))
  useEffect(() => { load() }, []) // eslint-disable-line
  const set = async (l, st) => { await admin.setOwnerLead(pass, l.id, st); load() }
  if (!leads) return <div className="pad muted">Loading…</div>
  return (
    <div className="pad">
      <p className="muted small">PG owners who asked to get verified. Call them, visit the PG, then add it in the PGs tab and mark it Verified.</p>
      {leads.length === 0 && <p className="muted">No owner requests yet.</p>}
      {leads.map(l => (
        <div key={l.id} className="admin-review">
          <div className="row-between"><b>{l.pg_name}</b><small>{timeAgo(l.created_at)}</small></div>
          <div>{l.owner_name} · <a href={'tel:' + l.phone}>{l.phone}</a></div>
          <div className="small muted">{[l.area, l.beds && l.beds + ' beds', l.message].filter(Boolean).join(' · ')}</div>
          <div className="chips wrap" style={{ marginTop: 8 }}>
            {['new', 'contacted', 'onboarded', 'rejected'].map(st => (
              <button key={st} className={'chip small' + (l.status === st ? ' on' : '')} onClick={() => set(l, st)}>{st}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Areas({ pass, flash }) {
  const [areas, setAreas] = useState(null)
  const [name, setName] = useState('')
  const load = () => admin.areas(pass).then(setAreas).catch(e => flash(e.message))
  useEffect(() => { load() }, []) // eslint-disable-line
  const set = async (a, st) => { await admin.setArea(pass, a.id, st, st === 'active' ? 10 : null); flash(st === 'active' ? a.name + ' approved' : a.name + ' removed'); load() }
  const add = async (e) => { e.preventDefault(); await admin.addArea(pass, name); setName(''); flash('Added'); load() }
  if (!areas) return <div className="pad muted">Loading…</div>
  const req = areas.filter(a => a.status === 'requested')
  const act = areas.filter(a => a.status === 'active')
  const swept = act.filter(a => a.basic_at).length, full = act.filter(a => a.full_at).length
  const d = (x) => x ? new Date(x).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'
  return (
    <div className="pad">
      <div className="kpis">
        <Kpi n={`${swept}/${act.length}`} l="Areas listed (basic sweep)" />
        <Kpi n={`${full}/${act.length}`} l="Areas with photos + reviews" />
      </div>
      <p className="muted small">The scraper runs every Sunday on the free Apify credit and works through this list. Approved requests go first.</p>
      <h3>Requested by users ({req.length})</h3>
      {req.length === 0 && <p className="muted small">No new requests.</p>}
      {req.map(a => (
        <div key={a.id} className="area-row">
          <div><b>{a.name}</b><small>{a.request_count} request{a.request_count > 1 ? 's' : ''}</small></div>
          <div className="admin-actions">
            <button className="btn btn-small btn-primary" onClick={() => set(a, 'active')}>Approve</button>
            <button className="btn btn-small btn-ghost" onClick={() => set(a, 'rejected')}>Reject</button>
          </div>
        </div>
      ))}
      <form onSubmit={add} className="decide-more" style={{ margin: '16px 0' }}>
        <input className="input" placeholder="Add an area, e.g. Sector 57" value={name} onChange={e => setName(e.target.value)} required />
        <button className="btn btn-primary">Add</button>
      </form>
      <h3>In rotation ({act.length})</h3>
      {act.map(a => (
        <div key={a.id} className="area-row">
          <div><b>{a.name}</b><small>Listed {d(a.basic_at)} · Full {d(a.full_at)}{a.last_found != null ? ` · ${a.last_found} PGs` : ''}</small></div>
          <button className="btn btn-small btn-ghost" onClick={() => set(a, 'rejected')}>Remove</button>
        </div>
      ))}
    </div>
  )
}

const Kpi = ({ n, l }) => <div className="kpi"><b>{n}</b><span>{l}</span></div>

function PgEditor({ pass, pg, onClose }) {
  const [p, setP] = useState({ ...pg, audit_checklist: { ...(pg.audit_checklist || {}) }, amenities: [...(pg.amenities || [])], photos: [...(pg.photos || [])] })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setP(x => ({ ...x, [k]: v }))
  const toggleAmenity = (k) => set('amenities', p.amenities.includes(k) ? p.amenities.filter(a => a !== k) : [...p.amenities, k])

  const here = () => navigator.geolocation.getCurrentPosition(
    pos => setP(x => ({ ...x, lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) })),
    () => setErr('Could not get location. Allow location access or type it in.'), { enableHighAccuracy: true })

  const addPhotos = async (files) => {
    for (const f of [...files]) { try { const u = await uploadPhoto(f, 'reviews'); setP(x => ({ ...x, photos: [...x.photos, u] })) } catch (x) { setErr(x.message) } }
  }

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    const out = { ...p }
    ;['lat', 'lng', 'rent_min', 'rent_max', ...PILLARS.map(x => 'audit_' + x.key)].forEach(k => { out[k] = out[k] === '' || out[k] == null ? null : Number(out[k]) })
    ;['score', 'created_at', 'verified_at', 'source', 'web_rating', 'web_review_count', 'ext_ref'].forEach(k => delete out[k])
    try { await admin.savePg(pass, out); onClose(true) } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  return (
    <div className="page admin">
      <header className="top simple"><button className="icon-btn" onClick={() => onClose(false)}>‹</button><b>{pg.id ? 'Edit PG' : 'Onboard PG'}</b><span /></header>
      <form className="pad form" onSubmit={save}>
        <label className="switch-row"><span>{p.verified ? <VerifiedBadge small /> : 'Mark as Verified by SafePlate'}</span>
          <input type="checkbox" checked={!!p.verified} onChange={e => set('verified', e.target.checked)} /></label>

        <label>PG name<input className="input" required value={p.name || ''} onChange={e => set('name', e.target.value)} /></label>
        <label>Address<input className="input" value={p.address || ''} onChange={e => set('address', e.target.value)} /></label>
        <div className="two">
          <label>Sector<input className="input" value={p.sector || ''} onChange={e => set('sector', e.target.value)} /></label>
          <label>For
            <select className="input" value={p.gender || ''} onChange={e => set('gender', e.target.value || null)}>
              <option value="">—</option><option value="boys">Boys</option><option value="girls">Girls</option><option value="coed">Co-ed</option>
            </select>
          </label>
        </div>
        <div className="two">
          <label>Rent from (₹)<input className="input" inputMode="numeric" value={p.rent_min ?? ''} onChange={e => set('rent_min', e.target.value)} /></label>
          <label>Rent up to (₹)<input className="input" inputMode="numeric" value={p.rent_max ?? ''} onChange={e => set('rent_max', e.target.value)} /></label>
        </div>
        <label>Meals<input className="input" placeholder="e.g. Breakfast + Dinner" value={p.meals || ''} onChange={e => set('meals', e.target.value)} /></label>
        <div className="two">
          <label>Latitude<input className="input" value={p.lat ?? ''} onChange={e => set('lat', e.target.value)} /></label>
          <label>Longitude<input className="input" value={p.lng ?? ''} onChange={e => set('lng', e.target.value)} /></label>
        </div>
        <button type="button" className="btn btn-small btn-outline" onClick={here}>📍 Use my current location (stand at the PG gate)</button>

        <h3>Team audit scores (1–5)</h3>
        {PILLARS.map(x => (
          <label key={x.key} className="slider-row">{x.icon} {x.label}
            <input type="range" min="1" max="5" step="0.5" value={p['audit_' + x.key] ?? 3} onChange={e => set('audit_' + x.key, e.target.value)} />
            <b>{p['audit_' + x.key] ?? '–'}</b>
          </label>
        ))}

        <h3>Checklist</h3>
        {CHECKLIST.map(([k, l]) => (
          <div key={k} className="check3">
            <span>{l}</span>
            <div>
              <button type="button" className={'chip small' + (p.audit_checklist[k] === true ? ' on' : '')} onClick={() => set('audit_checklist', { ...p.audit_checklist, [k]: true })}>Yes</button>
              <button type="button" className={'chip small' + (p.audit_checklist[k] === false ? ' on bad' : '')} onClick={() => set('audit_checklist', { ...p.audit_checklist, [k]: false })}>No</button>
            </div>
          </div>
        ))}
        <label>Team notes (shown publicly)<textarea className="input" rows={2} value={p.audit_notes || ''} onChange={e => set('audit_notes', e.target.value)} /></label>

        <h3>Amenities</h3>
        <div className="chips wrap">{AMENITIES.map(([k, l]) => <button type="button" key={k} className={'chip small' + (p.amenities.includes(k) ? ' on' : '')} onClick={() => toggleAmenity(k)}>{l}</button>)}</div>

        <h3>Photos</h3>
        <div className="thumbs">
          {p.photos.map(u => <div key={u} className="thumb-x"><img src={u} alt="" referrerPolicy="no-referrer" /><button type="button" onClick={() => set('photos', p.photos.filter(x => x !== u))}>✕</button></div>)}
          <label className="add-photo">＋<input type="file" accept="image/*" multiple hidden onChange={e => addPhotos(e.target.files)} /></label>
        </div>

        {err && <div className="notice error">{err}</div>}
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Saving…' : 'Save PG'}</button>
      </form>
    </div>
  )
}
