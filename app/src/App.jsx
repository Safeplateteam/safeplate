import React, { useEffect, useState, useCallback } from 'react'
import { loadPgs, track } from './lib/api.js'
import Home from './pages/Home.jsx'
import PGDetail from './pages/PGDetail.jsx'
import ReviewForm from './pages/ReviewForm.jsx'
import Admin from './pages/Admin.jsx'
import Poster from './pages/Poster.jsx'
import Welcome from './components/Welcome.jsx'

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
  const [welcomed, setWelcomed] = useState(() => { try { return !!localStorage.getItem('sp_persona') } catch { return true } })

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

  const pg = route.id && pgs ? pgs.find(p => p.id === route.id) : null
  let page
  if (route.name === 'pg') page = <PGDetail pg={pg} loading={!pgs} />
  else if (route.name === 'review') page = <ReviewForm pg={pg} pgs={pgs} code={route.query.code} onDone={refresh} />
  else page = <Home pgs={pgs} err={err} />

  // residents arriving through a QR poster skip the welcome screen
  const showWelcome = !welcomed && route.name !== 'review'
  return (
    <>
      {page}
      {showWelcome && <Welcome onDone={() => setWelcomed(true)} />}
    </>
  )
}
