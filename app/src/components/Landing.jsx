import React from 'react'
import { PILLARS } from '../lib/constants.js'

// Shown every time the app opens (before sign-in, and again for signed-in users).
// The three buttons also record who the user is: city swapper, resident or PG owner.
export default function Landing({ pgs, user, onChoose }) {
  const total = pgs?.length
  const verified = pgs?.filter(p => p.verified).length || 0
  const sectors = pgs ? new Set(pgs.map(p => p.sector).filter(Boolean)).size : null
  return (
    <div className="landing">
      <div className="landing-hero">
        <img src="./icon.svg" alt="" />
        <h1>Check the PG<br />before you pay.</h1>
        <p>Moving to Gurgaon? See real ratings for food, hygiene, amenities and security from people who actually live there.</p>
        {total != null && (
          <div className="landing-stats">
            <div><b>{total}</b><span>PGs listed</span></div>
            <div><b>{sectors}</b><span>sectors</span></div>
            {verified > 0 ? <div><b>{verified}</b><span>verified</span></div> : <div><b>4</b><span>trust checks</span></div>}
          </div>
        )}
      </div>

      <div className="landing-card">
        <div className="pillars-row">
          {PILLARS.map(p => <div key={p.key}><span>{p.icon}</span><small>{p.label}</small></div>)}
        </div>
        <button className="btn btn-primary btn-block btn-lg" onClick={() => onChoose('city_swapper')}>🧳 Find a PG in Gurgaon</button>
        <button className="btn btn-outline btn-block" onClick={() => onChoose('resident')}>🏠 I live in a PG, rate it</button>
        <button className="btn btn-ghost btn-block" onClick={() => onChoose('owner')}>🏢 I own a PG, get verified</button>
        <p className="landing-foot">{user ? `Signed in as ${user}` : 'Free · Sign in with just your email'}</p>
      </div>
    </div>
  )
}
