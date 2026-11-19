import React, { useMemo, useState, useCallback } from 'react'
import PGCard from '../components/PGCard.jsx'
import MapView from '../components/MapView.jsx'
import { track } from '../lib/api.js'
import { go } from '../App.jsx'

const FILTERS = [
  ['verified', '✓ Verified only'], ['girls', 'Girls'], ['boys', 'Boys'], ['coed', 'Co-ed'],
  ['budget', 'Under ₹12k'], ['meals', 'Meals included'], ['top', 'Trust 4+'],
]

export default function Home({ pgs, err }) {
  const [q, setQ] = useState('')
  const [f, setF] = useState(new Set())
  const [view, setView] = useState('list')
  const [active, setActive] = useState(null)

  const toggle = (k) => { const n = new Set(f); n.has(k) ? n.delete(k) : n.add(k); setF(n); track('filter', null, { k, on: n.has(k) }) }
  const open = useCallback((pg) => { track('view_pg', pg.id, { verified: pg.verified, from: view }); go('/pg/' + pg.id) }, [view])

  const list = useMemo(() => {
    if (!pgs) return []
    const t = q.trim().toLowerCase()
    return pgs.filter(p =>
      (!t || [p.name, p.address, p.sector].join(' ').toLowerCase().includes(t)) &&
      (!f.has('verified') || p.verified) &&
      (!['girls', 'boys', 'coed'].some(g => f.has(g)) || f.has(p.gender)) &&
      (!f.has('budget') || (p.rent_min && p.rent_min <= 12000)) &&
      (!f.has('meals') || (p.amenities || []).includes('meals') || p.meals) &&
      (!f.has('top') || (p.score?.trust_score ?? 0) >= 4))
  }, [pgs, q, f])

  const verified = list.filter(p => p.verified)
  const others = list.filter(p => !p.verified)

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
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search PG name or sector…" />
        {q && <button className="icon-btn" onClick={() => setQ('')}>✕</button>}
      </div>
      <div className="chips">
        {FILTERS.map(([k, l]) => <button key={k} className={'chip' + (f.has(k) ? ' on' : '')} onClick={() => toggle(k)}>{l}</button>)}
      </div>

      {err && <div className="notice error">Couldn't load PGs. Check your internet and reopen the app.</div>}
      {!pgs && !err && <div className="skeleton-list">{[1, 2, 3].map(i => <div key={i} className="skeleton" />)}</div>}

      {pgs && view === 'map' && (
        <div className="map-wrap">
          <MapView pgs={list} activeId={active?.id} onSelect={setActive} height="calc(100vh - 210px)" />
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
                <h2>More options nearby</h2>
                <p>Not yet onboarded or verified by SafePlate · ratings are public reviews from the web</p>
              </div>
              <div className="grid-2">{others.map(p => <PGCard key={p.id} pg={p} onOpen={open} compact />)}</div>
            </section>
          )}
          {list.length === 0 && <div className="empty">No PGs match these filters yet.</div>}

          <div className="cta-resident" onClick={() => { track('resident_cta'); go('/review') }}>
            <div>🏠</div>
            <div><b>Already living in a PG?</b><span>Rate its food, hygiene, amenities and security in 1 minute. Help the next person moving in.</span></div>
            <div>›</div>
          </div>
          <footer className="foot">SafePlate · MVP for Sector 30, Gurgaon · Made by Group 11</footer>
        </main>
      )}
    </div>
  )
}
