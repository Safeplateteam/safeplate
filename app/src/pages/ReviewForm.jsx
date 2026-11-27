import React, { useEffect, useState } from 'react'
import { submitReview, uploadPhoto, track, EMAIL_OTP, verifiedEmail, sendEmailCode, checkEmailCode, signOutEmail } from '../lib/api.js'
import { PILLARS } from '../lib/constants.js'
import { StarsInput, VerifiedBadge } from '../components/ui.jsx'
import { go, goBack } from '../App.jsx'

const LABELS = ['', 'Very bad', 'Bad', 'Okay', 'Good', 'Excellent']

export default function ReviewForm({ pg, pgs, code, onDone }) {
  const [pick, setPick] = useState('')
  const [r, setR] = useState({ food: 0, hygiene: 0, amenities: 0, security: 0, issues: [], comment: '', name: '', phone: '', months_stayed: '' })
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const [vEmail, setVEmail] = useState(null) // email verified with a one-time code
  useEffect(() => { if (EMAIL_OTP) verifiedEmail().then(setVEmail) }, [])

  useEffect(() => { track('review_start', pg?.id || null, { qr: !!code }) }, [pg, code])

  // keep a draft on the phone so nothing is lost if the user leaves the app (e.g. to copy the email code)
  const draftKey = pg ? 'sp_draft_' + pg.id : null
  const [draftLoaded, setDraftLoaded] = useState(false)
  useEffect(() => {
    if (!draftKey) return
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) || 'null')
      if (d && Date.now() - d.at < 7 * 86400000) { setR(x => ({ ...x, ...d.r })); setPhotos(d.photos || []) }
    } catch {}
    setDraftLoaded(true)
  }, [draftKey])
  useEffect(() => {
    if (!draftKey || !draftLoaded || done) return
    try { localStorage.setItem(draftKey, JSON.stringify({ r, photos, at: Date.now() })) } catch {}
  }, [r, photos, draftKey, draftLoaded, done])

  // no PG chosen yet → let them pick one
  if (!pg) {
    const t = pick.toLowerCase()
    return (
      <div className="page">
        <header className="top simple"><button className="icon-btn" onClick={() => goBack('/')}>‹</button><b>Rate your PG</b><span /></header>
        <div className="pad">
          <p className="muted">Which PG do you live in?</p>
          <input className="input" autoFocus placeholder="Search PG name…" value={pick} onChange={e => setPick(e.target.value)} />
          <div className="pick-list">
            {(pgs || []).filter(p => !t || p.name.toLowerCase().includes(t)).sort((a, b) => b.verified - a.verified || a.name.localeCompare(b.name)).slice(0, 40).map(p => (
              <button key={p.id} className="pick" onClick={() => go('/review/' + p.id)}>
                <b>{p.name}</b><small>{p.address || (p.sector && 'Sector ' + p.sector)}</small>
              </button>
            ))}
          </div>
          <p className="muted small">Can't find your PG? Tell the SafePlate team and we'll add it.</p>
        </div>
      </div>
    )
  }

  if (done) return (
    <div className="page center">
      <div className="done">
        <div className="done-icon">🎉</div>
        <h2>Thank you!</h2>
        <p>Your review of <b>{pg.name}</b> is live. You just helped someone moving to Gurgaon pick a safer PG.</p>
        <button className="btn btn-primary btn-block" onClick={() => go('/pg/' + pg.id)}>See the PG page</button>
        <button className="btn btn-ghost btn-block" onClick={() => go('/')}>Explore other PGs</button>
      </div>
    </div>
  )

  const set = (k, v) => setR({ ...r, [k]: v })
  const toggleIssue = (k) => set('issues', r.issues.includes(k) ? r.issues.filter(x => x !== k) : [...r.issues, k])
  const phoneOk = EMAIL_OTP ? !!vEmail : /^[6-9]\d{9}$/.test(r.phone.replace(/\D/g, '').slice(-10))
  const ready = PILLARS.every(p => r[p.key] > 0) && r.name.trim().length >= 2 && phoneOk

  const addPhotos = async (files) => {
    setErr('')
    for (const f of [...files].slice(0, 4 - photos.length)) {
      try { const url = await uploadPhoto(f); setPhotos(p => [...p, url]) } catch (x) { setErr(x.message) }
    }
  }

  const send = async (e) => {
    e.preventDefault()
    if (!ready) { setErr(EMAIL_OTP && !vEmail ? 'Please rate all four sections, add your name and verify your email.' : 'Please rate all four sections and add your name and a valid mobile number.'); return }
    setBusy(true); setErr('')
    try {
      await submitReview({
        pg_id: pg.id, qr: code || null, name: r.name.trim(), phone: EMAIL_OTP ? null : r.phone.replace(/\D/g, '').slice(-10),
        food: r.food, hygiene: r.hygiene, amenities: r.amenities, security: r.security,
        issues: r.issues, comment: r.comment.trim() || null, photos, months_stayed: r.months_stayed ? Number(r.months_stayed) : null,
      })
      track('review_submit', pg.id, { qr: !!code, photos: photos.length, issues: r.issues.length })
      try { localStorage.removeItem(draftKey) } catch {}
      onDone && onDone(); setDone(true); window.scrollTo(0, 0)
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  return (
    <div className="page review-page">
      <header className="top simple"><button className="icon-btn" onClick={() => goBack('/pg/' + pg.id)}>‹</button><b>Rate your PG</b><span /></header>
      <form className="pad form" onSubmit={send}>
        <div className="review-pg">
          <h2>{pg.name}</h2>
          {pg.verified && <VerifiedBadge small />}
          {code && <div className="notice ok small">📍 You scanned this PG's SafePlate poster. Your review will be tagged as a <b>Resident</b> review.</div>}
        </div>

        {PILLARS.map(p => (
          <div key={p.key} className="rate-block" style={{ '--c': p.color }}>
            <div className="rate-head"><span>{p.icon}</span><div><b>{p.label}</b><small>{p.question}</small></div></div>
            <StarsInput value={r[p.key]} onChange={v => set(p.key, v)} />
            <div className="rate-label">{LABELS[r[p.key]] || 'Tap to rate'}</div>
            <div className="issue-pick">
              <small>Any problems? (tap all that apply)</small>
              <div>
                {p.issues.map(([k, l]) => (
                  <button type="button" key={k} className={'chip small' + (r.issues.includes(k) ? ' on bad' : '')} onClick={() => toggleIssue(k)}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        ))}

        <label>Anything else people should know? (optional)
          <textarea className="input" rows={3} maxLength={800} value={r.comment} onChange={e => set('comment', e.target.value)}
            placeholder="e.g. Paneer every day, RO not serviced, owner fixes things fast…" />
        </label>

        <div className="photo-pick">
          <b>Add photos</b><small>Food, kitchen, room — real photos make reviews trusted (max 4)</small>
          <div className="thumbs">
            {photos.map(u => <img key={u} src={u} alt="" />)}
            {photos.length < 4 && (
              <label className="add-photo">＋<input type="file" accept="image/*" multiple hidden onChange={e => addPhotos(e.target.files)} /></label>
            )}
          </div>
        </div>

        <div className="two">
          <label>Your name<input className="input" required maxLength={40} placeholder="e.g. Rahul S." value={r.name} onChange={e => set('name', e.target.value)} /></label>
          <label>Months stayed<input className="input" inputMode="numeric" maxLength={3} value={r.months_stayed} onChange={e => set('months_stayed', e.target.value.replace(/\D/g, ''))} /></label>
        </div>
        {EMAIL_OTP ? <EmailVerify email={vEmail} onChange={setVEmail} pgId={pg.id} /> : (
          <label>Mobile number<input className="input" required inputMode="numeric" placeholder="10-digit mobile" value={r.phone} onChange={e => set('phone', e.target.value)} />
            <small className="muted">Only used to stop fake and duplicate reviews. Never shown publicly.</small>
          </label>
        )}

        {err && <div className="notice error">{err}</div>}
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Posting…' : 'Post review'}</button>
      </form>
    </div>
  )
}

// Email + one-time code. No password, no account screens; stays signed in on this device.
function EmailVerify({ email, onChange, pgId }) {
  const [addr, setAddr] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  if (email) return (
    <div className="pe-box">
      <div className="pe-done">✓ Verified as {email}</div>
      <button type="button" className="btn btn-small btn-ghost" onClick={async () => { await signOutEmail(); onChange(null) }}>Use a different email</button>
    </div>
  )
  const send = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.trim())) { setErr('Please enter a valid email address.'); return }
    setBusy(true); setErr('')
    try { await sendEmailCode(addr); setStep('code'); track('email_code_sent', pgId) } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const verify = async () => {
    setBusy(true); setErr('')
    try { const e = await checkEmailCode(addr, code); onChange(e); track('email_verified', pgId) } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <div className="pe-box">
      <b>Verify your email</b>
      <small className="muted">We send a one-time code. Stops fake reviews. Your email is never shown publicly.</small>
      {step === 'email' ? (
        <div className="decide-more" style={{ marginTop: 10 }}>
          <input className="input" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={addr} onChange={e => setAddr(e.target.value)} />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send code'}</button>
        </div>
      ) : (
        <>
          <p className="small muted" style={{ margin: '8px 0' }}>Code sent to <b>{addr}</b>. Check your inbox and spam folder.</p>
          <div className="decide-more">
            <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={10} placeholder="Enter code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
            <button type="button" className="btn btn-primary" disabled={busy || code.length < 6} onClick={verify}>{busy ? 'Checking…' : 'Verify'}</button>
          </div>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => { setStep('email'); setCode('') }}>Change email / resend</button>
        </>
      )}
      {err && <div className="notice error">{err}</div>}
    </div>
  )
}
