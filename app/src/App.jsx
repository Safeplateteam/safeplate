import React, { useEffect, useState, useCallback } from 'react'
import { loadPgs, track, currentUser, signOutEmail } from './lib/api.js'
import Login from './components/Login.jsx'
import Home from './pages/Home.jsx'
import PGDetail from './pages/PGDetail.jsx'
import ReviewForm from './pages/ReviewForm.jsx'
import Admin from './pages/Admin.jsx'
import Poster from './pages/Poster.jsx'
import Landing from './components/Landing.jsx'

// tiny hash router: #/  #/pg/:id  #/review/:id?code=  #/admin  #/poster/:id
function parse() {
  const h = window.location.hash.replace(/^#/, '') || '/'
  const [path, qs] = h.split('?')
  const parts = path.split('/').filter(Boolean)
  return { name: parts[0] || 'home', id: parts[1], query: Object.fromEntries(new URLSearchParams(qs || '')) }
}
export const go = (to) => { window.location.hash = to }

export default function App() {
  const [route, setRoute] = useState(parse())
  const [pgs, setPgs] = useState(null)
  const [err, setErr] = useState(null)
  // landing screen shows on every app open; QR-poster review links go straight to the form
  const [entered, setEntered] = useState(() => parse().name === 'review')
  const [openOwner, setOpenOwner] = useState(false)
  const choose = (persona) => {
    try { localStorage.setItem('sp_persona', persona) } catch {}
    track('persona', null, { persona })
    setEntered(true)
    if (persona === 'resident') go('/review')
    else { go('/'); if (persona === 'owner') setOpenOwner(true) }
  }

  const [user, setUser] = useState(undefined) // undefined = checking, null = signed out
  useEffect(() => { currentUser().then(setUser) }, [])

  const refresh = useCallback(() => loadPgs().then(setPgs).catch(e => setErr(e.message)), [])

  useEffect(() => {
    const on = () => { setRoute(parse()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    refresh()
    track('app_open', null, { ua: navigator.userAgent.slice(0, 80) })
    return () => window.removeEventListener('hashchange', on)
  }, [refresh])

  if (route.name === 'admin') return <Admin pgs={pgs} refresh={refresh} />
  if (route.name === 'poster') return <Poster pgs={pgs} id={route.id} />
  if (user === undefined) return <div className="page center"><img src="./icon.svg" alt="" style={{ width: 64, opacity: .8 }} /></div>
  if (!entered) return <Landing pgs={pgs} user={user} onChoose={choose} />
  if (!user) return <Login onDone={setUser} />

  const pg = route.id && pgs ? pgs.find(p => p.id === route.id) : null
  let page
  if (route.name === 'pg') page = <PGDetail pg={pg} loading={!pgs} />
  else if (route.name === 'review') page = <ReviewForm pg={pg} pgs={pgs} code={route.query.code} onDone={refresh} />
  else page = <Home pgs={pgs} err={err} user={user} openOwner={openOwner} onOwnerShown={() => setOpenOwner(false)} onHome={() => setEntered(false)} onSignOut={async () => { await signOutEmail(); setUser(null); setEntered(false) }} />

  return page
}
