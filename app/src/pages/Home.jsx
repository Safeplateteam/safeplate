import React, { useMemo, useState, useCallback, useEffect } from 'react'
import PGCard from '../components/PGCard.jsx'
import MapView from '../components/MapView.jsx'
import { Sheet, Toast } from '../components/ui.jsx'
import { track, requestArea } from '../lib/api.js'
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

export default function Home({ pgs, err }) {
  const [q, setQ] = useState('')
  const [f, setF] = useState(new Set())
  const [view, setView] = useState('list')
  const [active, setActive] = useState(null)
  const [me, setMe] = useState(null)
  const [shown, setShown] = useState(PAGE)
  const [ask, setAsk] = useState(false)
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
    <div className="page home">
      <header className="top">
        <div className="brand">
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

      {err && <div className="notice error">Couldn't load PGs. Check your internet and reopen the app.</div>}
      {!pgs && !err && <div className="skeleton-list">{[1, 2, 3].map(i => <div key={i} className="skeleton" />)}</div>}

      {pgs && view === 'map' && (
        <div className="map-wrap">
          <MapView pgs={list} activeId={active?.id} onSelect={setActive} center={f.has('near') ? me : null} height="calc(100vh - 210px)" />
          <div className="legend"><span className="pin pin-verified">4.2</span> Verified <span className="pin pin-web">★4.0</span> Not yet verified</div>
          {active && <div className="map-card"><PGCard pg={active} onOpen={open} compact /></div>}
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

          <div className="cta-area" onClick={() => { setAsk(true); track('area_request_open') }}>
            <div>📍</div>
            <div><b>Don't see your area?</b><span>Tell us where you're moving. We add new areas every week.</span></div>
            <div>›</div>
          </div>
          <div className="cta-resident" onClick={() => { track('resident_cta'); go('/review') }}>
            <div>🏠</div>
            <div><b>Already living in a PG?</b><span>Rate its food, hygiene, amenities and security in 1 minute. Help the next person moving in.</span></div>
            <div>›</div>
          </div>
          <footer className="foot">SafePlate · Gurgaon · Made by Group 11</footer>
        </main>
      )}
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
