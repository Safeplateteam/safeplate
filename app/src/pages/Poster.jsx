import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { admin, PUBLIC_URL } from '../lib/api.js'
import { go } from '../App.jsx'

// Printable A4 poster for a verified PG. Residents scan → review tagged "Resident".
export default function Poster({ pgs, id }) {
  const [img, setImg] = useState('')
  const [err, setErr] = useState('')
  const pg = pgs?.find(p => p.id === id)

  useEffect(() => {
    const pass = sessionStorage.getItem('sp_admin')
    if (!pass) { setErr('Open the admin page first.'); return }
    admin.qrCodes(pass).then(codes => {
      const url = `${PUBLIC_URL}#/review/${id}?code=${codes[id]}`
      return QRCode.toDataURL(url, { width: 600, margin: 1, color: { dark: '#0F5132' } })
    }).then(setImg).catch(e => setErr(e.message))
  }, [id])

  if (err) return <div className="page center"><div className="notice error">{err}</div><button className="btn btn-ghost" onClick={() => go('/admin')}>Admin</button></div>
  if (!pg) return <div className="page center">Loading…</div>

  return (
    <div className="poster-wrap">
      <div className="no-print poster-tools">
        <button className="btn btn-ghost" onClick={() => go('/admin')}>‹ Back</button>
        <button className="btn btn-primary" onClick={() => window.print()}>Print / Save PDF</button>
      </div>
      <div className="poster">
        <div className="poster-brand"><img src="./icon.svg" alt="" /> SafePlate</div>
        <h1>Living here?<br />Rate your PG in 1 minute.</h1>
        <p>Food · Hygiene · Amenities · Security</p>
        {img && <img className="poster-qr" src={img} alt="QR code" />}
        <div className="poster-pg">{pg.name}</div>
        <p className="poster-small">Scan with your phone camera. No app or sign-up needed.<br />Your phone number is never shown publicly.</p>
        <div className="poster-foot">✓ This PG is Verified by SafePlate</div>
      </div>
    </div>
  )
}
