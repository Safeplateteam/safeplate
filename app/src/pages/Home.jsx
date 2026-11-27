import React, { useMemo, useState, useCallback, useEffect } from 'react'
import PGCard from '../components/PGCard.jsx'
import MapView from '../components/MapView.jsx'
import { Sheet, Toast } from '../components/ui.jsx'
import { pushBack } from '../lib/back.js'
import { track, requestArea, ownerLead } from '../lib/api.js'
import { go } from '../App.jsx'

const FILTERS = [
  ['near', '📍 Near me'], ['verified', '✓ Verified only'], ['girls', 'Girls'], ['boys', 'Boys'], ['coed', 'Co-ed'],
  ['budget', 'Under ₹12k'], ['meals', 'Meals included'], ['top', 'Trust 4+'],
]
const PAGE = 30

export function km(a, b) {
  const R = 6371, t = x => x * Math.PI / 180
  const h = Math.sin(t(b[0] - a[0]) / 2) ** 2 + Math.cos(t(a[0])) * Math.cos(t(b[0])) * Math.sin(t(b[1] - a[1]) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export default function Home({ pgs, err, user, onSignOut, openOwner, onOwnerShown, onHome }) {
  const [q, setQ] = useState('')
  const [f, setF] = useState(new Set())
  const [view, setView] = useState('list')
  const [active, setActive] = useState(null)
  useEffect(() => (active ? pushBack(() => setActive(null)) : undefined), [active])
  useEffect(() => (view === 'map' ? pushBack(() => setView('list')) : undefined), [view])
  const [me, setMe] = useState(null)
  const [shown, setShown] = useState(PAGE)
  const [ask, setAsk] = useState(false)
  const [owner, setOwner] = useState(false)
  useEffect(() => { if (openOwner) { setOwner(true); onOwnerShown && onOwnerShown() } }, [openOwner]) // eslint-disable-line
  const [toast, setToast] = useState('')
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3500) }

  const toggle = (k) => {
    if (k === 'near' && !f.has('near')) {
      if (!navigator.geolocation) return flash('Location is not available on this device')
      navigator.geolocation.getCurrentPosition(
        p => { setMe([p.coords.latitude, p.coords.longitude]); setF(s => new Set(s).add('near')); track('near_me') },
        () => flash('Allow location access to see PGs near you'), { enableHighAccuracy: false, timeout: 10000 })
      return
    }
    const n = new Set(f); n.has(k) ? n.delete(k) : n.add(k); setF(n); setShown(PAGE); track('filter', null, { k, on: n.has(k) })
  }
  const open = useCallback((pg) => { track('view_pg', pg.id, { verified: pg.verified, from: view }); go('/pg/' + pg.id) }, [view])

  const list = useMemo(() => {
    if (!pgs) return []
    const t = q.trim().toLowerCase()
    const sectorQ = t.match(/^(?:sector\s*|sec\s*)?(\d{1,3})$/)
    const near = f.has('near') && me
    return pgs.filter(p =>
      (!t || (sectorQ ? p.sector === sectorQ[1] : [p.name, p.address, p.sector && 'sector ' + p.sector].join(' ').toLowerCase().includes(t))) &&
      (!f.has('verified') || p.verified) &&
      (!['girls', 'boys', 'coed'].some(g => f.has(g)) || f.has(p.gender)) &&
      (!f.has('budget') || (p.rent_min && p.rent_min <= 12000)) &&
      (!f.has('meals') || (p.amenities || []).includes('meals') || p.meals) &&
      (!f.has('top') || (p.score?.trust_score ?? 0) >= 4))
      .map(p => near && p.lat ? { ...p, dist: km(me, [p.lat, p.lng]) } : p)
  }, [pgs, q, f, me])

  // web listings: by distance when "Near me" is on, else by a confidence-weighted rating
  const conf = (p) => ((p.web_rating || 0) * (p.web_review_count || 0) + 3.5 * 8) / ((p.web_review_count || 0) + 8)
  const sorter = f.has('near') && me ? (a, b) => (a.dist ?? 99) - (b.dist ?? 99) : (a, b) => conf(b) - conf(a)
  const verified = list.filter(p => p.verified).sort(f.has('near') && me ? sorter : () => 0)
  const others = list.filter(p => !p.verified).sort(sorter)

  return (
    <div className={'page home' + (view === 'map' ? ' map-mode' : '')}>
      <header className="top">
        <div className="brand" onClick={onHome} style={{ cursor: 'pointer' }}>
          <img src="./icon.svg" alt="" />
          <div><b>SafePlate</b><small>PG Trust Score · Gurgaon</small></div>
        </div>
        <div className="seg">
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
          <button className={view === 'map' ? 'on' : ''} onClick={() => { setView('map'); track('map_open') }}>Map</button>
        </div>
      </header>

      <div className="search">
        <span>🔎</span>
        <input value={q} onChange={e => { setQ(e.target.value); setShown(PAGE) }} placeholder="Search PG name, area or sector (e.g. 45)…" />
        {q && <button className="icon-btn" onClick={() => setQ('')}>✕</button>}
      </div>
      <div className="chips">
        {FILTERS.map(([k, l]) => <button key={k} className={'chip' + (f.has(k) ? ' on' : '')} onClick={() => toggle(k)}>{l}</button>)}
      </div>

      {view === 'list' && <div className="actions">
        <button className="action a-resident" onClick={() => { track('resident_cta'); go('/review') }}>
          <span>🏠</span><b>Live in a PG?</b><small>Rate it in 1 min</small>
        </button>
        <button className="action a-owner" onClick={() => { setOwner(true); track('owner_cta') }}>
          <span>🏢</span><b>Own a PG?</b><small>Get verified free</small>
        </button>
        <button className="action a-area" onClick={() => { setAsk(true); track('area_request_open') }}>
          <span>📍</span><b>Area missing?</b><small>Request it</small>
        </button>
      </div>}

      {err && <div className="notice error">Couldn't load PGs. Check your internet and reopen the app.</div>}
      {!pgs && !err && <div className="skeleton-list">{[1, 2, 3].map(i => <div key={i} className="skeleton" />)}</div>}

      {pgs && view === 'map' && (
        <div className="map-wrap">
          <MapView pgs={list} activeId={active?.id} onSelect={setActive} center={f.has('near') ? me : null} height="100%" />
          <div className="legend"><span className="pin pin-verified">4.2</span> Verified <span className="pin pin-web">★4.0</span> Not yet verified</div>
          {active && <div className="map-card"><button className="map-card-x" onClick={() => setActive(null)}>✕</button><PGCard pg={active} onOpen={open} compact /></div>}
        </div>
      )}

      {pgs && view === 'list' && (
        <main className="list">
          {verified.length > 0 && (
            <section>
              <div className="section-head">
                <h2>Trusted PGs</h2>
                <p>Visited & audited by the SafePlate team, rated by residents</p>
              </div>
              {verified.map(p => <PGCard key={p.id} pg={p} onOpen={open} />)}
            </section>
          )}
          {others.length > 0 && (
            <section>
              <div className="section-head">
                <h2>{f.has('near') && me ? 'Nearest options' : 'More options'} <small className="count">{others.length}</small></h2>
                <p>Not yet onboarded or verified by SafePlate · ratings are public reviews from the web</p>
              </div>
              <div className="grid-2">{others.slice(0, shown).map(p => <PGCard key={p.id} pg={p} onOpen={open} compact />)}</div>
              {others.length > shown && <button className="btn btn-outline btn-block" onClick={() => setShown(shown + PAGE)}>Show more ({others.length - shown} left)</button>}
            </section>
          )}
          {list.length === 0 && <div className="empty">No PGs match this yet.</div>}

          <footer className="foot">
            {user && <div>Signed in as {user} · <a onClick={onSignOut}>Sign out</a></div>}
            SafePlate · Gurgaon · Made by Group 11
          </footer>
        </main>
      )}
      <OwnerSheet open={owner} onClose={() => setOwner(false)} onDone={(m) => { setOwner(false); flash(m) }} />
      <AreaSheet open={ask} onClose={() => setAsk(false)} onDone={(m) => { setAsk(false); flash(m) }} initial={q} />
      <Toast msg={toast} />
    </div>
  )
}

function AreaSheet({ open, onClose, onDone, initial }) {
  const [area, setArea] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { if (open) { setArea(/\d|sector|lok|phase/i.test(initial || '') ? initial : ''); setErr('') } }, [open]) // eslint-disable-line
  const send = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { const m = await requestArea(area); track('area_request', null, { area }); setArea(''); onDone(m) }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Request an area">
      <form className="form" onSubmit={send}>
        <p className="muted small">Which area or sector are you looking for a PG in? Our team adds approved areas in the next weekly update.</p>
        <label>Area or sector<input className="input" required autoFocus placeholder="e.g. Sector 56, Sushant Lok 2" value={area} onChange={e => setArea(e.target.value)} /></label>
        {err && <div className="notice error">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Sending…' : 'Request this area'}</button>
      </form>
    </Sheet>
  )
}

function OwnerSheet({ open, onClose, onDone }) {
  const blank = { owner_name: '', phone: '', pg_name: '', area: '', beds: '', message: '' }
  const [v, setV] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, x) => setV({ ...v, [k]: x })
  const send = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    const phone = v.phone.replace(/\D/g, '').slice(-10)
    if (!/^[6-9]\d{9}$/.test(phone)) { setErr('Please enter a valid 10-digit mobile number.'); setBusy(false); return }
    try {
      await ownerLead({ ...v, phone, beds: v.beds ? Number(v.beds) : null, area: v.area || null, message: v.message || null })
      track('owner_lead'); setV(blank)
      onDone('Thanks! The SafePlate team will call you within 2 days to schedule a visit.')
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Get your PG verified">
      <form className="form" onSubmit={send}>
        <div className="owner-perks">
          <div>✓ <b>"Verified by SafePlate"</b> badge on your listing</div>
          <div>✓ Shown first, above unverified PGs</div>
          <div>✓ Visit requests from people moving to Gurgaon</div>
          <div>✓ Free during our pilot</div>
        </div>
        <p className="muted small">Our team visits your PG, checks the kitchen, water, hygiene and security, and then lists it as verified.</p>
        <label>Your name<input className="input" required maxLength={60} value={v.owner_name} onChange={e => set('owner_name', e.target.value)} /></label>
        <label>Mobile number<input className="input" required inputMode="numeric" placeholder="10-digit mobile" value={v.phone} onChange={e => set('phone', e.target.value)} /></label>
        <label>PG name<input className="input" required maxLength={100} value={v.pg_name} onChange={e => set('pg_name', e.target.value)} /></label>
        <div className="two">
          <label>Area / sector<input className="input" maxLength={120} placeholder="e.g. Sector 30" value={v.area} onChange={e => set('area', e.target.value)} /></label>
          <label>No. of beds<input className="input" inputMode="numeric" maxLength={4} value={v.beds} onChange={e => set('beds', e.target.value.replace(/\D/g, ''))} /></label>
        </div>
        <label>Anything else? (optional)<input className="input" maxLength={400} value={v.message} onChange={e => set('message', e.target.value)} /></label>
        {err && <div className="notice error">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Sending…' : 'Request a verification visit'}</button>
      </form>
    </Sheet>
  )
}
