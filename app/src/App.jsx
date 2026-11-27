import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as NativeApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { loadPgs, track, currentUser, signOutEmail } from './lib/api.js'
import { popBack } from './lib/back.js'
import Login from './components/Login.jsx'
import Landing from './components/Landing.jsx'
import Home from './pages/Home.jsx'
import PGDetail from './pages/PGDetail.jsx'
import ReviewForm from './pages/ReviewForm.jsx'
import Admin from './pages/Admin.jsx'
import Poster from './pages/Poster.jsx'

// tiny hash router: #/  #/pg/:id  #/review/:id?code=  #/admin  #/poster/:id
function parse() {
  const h = window.location.hash.replace(/^#/, '') || '/'
  const [path, qs] = h.split('?')
  const parts = path.split('/').filter(Boolean)
  return { name: parts[0] || 'home', id: parts[1], query: Object.fromEntries(new URLSearchParams(qs || '')) }
}
export const go = (to) => { window.location.hash = to }
// in-app "‹" buttons: real back navigation (no new history entry), with a fallback screen
export const goBack = (fallback = '/') => {
  if (window.history.length > 1) window.history.back(); else go(fallback)
}

// Resume where the user was if the app is reopened within this window
// (e.g. Android closed it while they were copying the email code).
const RESUME_MS = 15 * 60 * 1000
function saveSpot(hash) { try { localStorage.setItem('sp_spot', JSON.stringify({ hash, at: Date.now() })) } catch {} }
function recentSpot() {
  try {
    const s = JSON.parse(localStorage.getItem('sp_spot') || 'null')
    return s && Date.now() - s.at < RESUME_MS ? s.hash : null
  } catch { return null }
}

export default function App() {
  // On a fresh start: QR-poster links and recent sessions skip the landing screen
  const [entered, setEntered] = useState(() => {
    if (parse().name === 'review') return true
    const spot = recentSpot()
    if (spot && (!window.location.hash || window.location.hash === '#/')) {
      if (spot !== '#/' && spot !== '#') window.history.replaceState(null, '', spot)
      return true
    }
    return false
  })
  const [route, setRoute] = useState(parse())
  const [pgs, setPgs] = useState(null)
  const [err, setErr] = useState(null)
  const [openOwner, setOpenOwner] = useState(false)
  const [user, setUser] = useState(undefined) // undefined = checking, null = signed out
  useEffect(() => { currentUser().then(setUser) }, [])

  const choose = (persona) => {
    try { localStorage.setItem('sp_persona', persona) } catch {}
    track('persona', null, { persona })
    setEntered(true)
    if (persona === 'resident') go('/review')
    else { go('/'); if (persona === 'owner') setOpenOwner(true) }
  }

  const refresh = useCallback(() => loadPgs().then(setPgs).catch(e => setErr(e.message)), [])

  useEffect(() => {
    const on = () => { setRoute(parse()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    refresh()
    track('app_open', null, { ua: navigator.userAgent.slice(0, 80), native: Capacitor.isNativePlatform() })
    return () => window.removeEventListener('hashchange', on)
  }, [refresh])

  // remember the current screen (not admin pages)
  useEffect(() => {
    if (entered && !['admin', 'poster'].includes(route.name)) saveSpot(window.location.hash || '#/')
  }, [route, entered])

  // keep the app below Android's status bar, with dark icons on our light background
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
    StatusBar.setStyle({ style: Style.Light }).catch(() => {})
    StatusBar.setBackgroundColor({ color: '#F7F8FA' }).catch(() => {})
  }, [])

  // Android hardware back button
  const state = useRef({})
  state.current = { entered, route }
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const h = NativeApp.addListener('backButton', () => {
      const { entered, route } = state.current
      if (popBack()) return                                   // close an open sheet / card first
      if (!entered) { saveSpot('#/'); NativeApp.exitApp(); return } // landing → leave the app
      if (route.name !== 'home') {                            // any inner screen → previous screen
        goBack('/')
        return
      }
      setEntered(false)                                       // PG list → landing screen
    })
    return () => { h.then(x => x.remove()) }
  }, [])

  if (route.name === 'admin') return <Admin pgs={pgs} refresh={refresh} />
  if (route.name === 'poster') return <Poster pgs={pgs} id={route.id} />
  if (user === undefined) return <div className="page center"><img src="./icon.svg" alt="" style={{ width: 64, opacity: .8 }} /></div>
  if (!entered) return <Landing pgs={pgs} user={user} onChoose={choose} />
  if (!user) return <Login onDone={setUser} />

  const pg = route.id && pgs ? pgs.find(p => p.id === route.id) : null
  if (route.name === 'pg') return <PGDetail pg={pg} loading={!pgs} />
  if (route.name === 'review') return <ReviewForm pg={pg} pgs={pgs} code={route.query.code} onDone={refresh} />
  return <Home pgs={pgs} err={err} user={user} openOwner={openOwner} onOwnerShown={() => setOpenOwner(false)}
    onHome={() => setEntered(false)} onSignOut={async () => { await signOutEmail(); setUser(null); setEntered(false) }} />
}
