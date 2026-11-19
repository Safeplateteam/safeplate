import React from 'react'
import { track } from '../lib/api.js'

// First screen: maps who the user is (city swapper vs. current resident)
export default function Welcome({ onDone }) {
  const pick = (persona) => {
    try { localStorage.setItem('sp_persona', persona) } catch {}
    track('persona', null, { persona })
    onDone()
  }
  return (
    <div className="welcome">
      <div className="welcome-card">
        <img src="./icon.svg" alt="" className="welcome-logo" />
        <h1>Check the PG <br />before you pay.</h1>
        <p>Real ratings for <b>food, hygiene, amenities and security</b> from people who actually live there.</p>
        <div className="welcome-q">What brings you here?</div>
        <button className="btn btn-primary btn-block" onClick={() => pick('city_swapper')}>🧳 I'm moving to Gurgaon</button>
        <button className="btn btn-outline btn-block" onClick={() => pick('resident')}>🏠 I already live in a PG</button>
        <button className="btn btn-ghost btn-block" onClick={() => pick('other')}>Just browsing</button>
        <div className="welcome-foot">No sign-up needed · Free</div>
      </div>
    </div>
  )
}
