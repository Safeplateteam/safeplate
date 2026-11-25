import React, { useState } from 'react'
import { sendEmailCode, checkEmailCode, track, markLogin } from '../lib/api.js'

// Sign-in gate: email + one-time code. No password. Stays signed in for 10 days on this device.
export default function Login({ onDone }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const send = async (e) => {
    e?.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr('Please enter a valid email address.'); return }
    setBusy(true); setErr('')
    try { await sendEmailCode(email); setStep('code'); track('login_code_sent') } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const verify = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { const em = await checkEmailCode(email, code); markLogin(); track('login'); onDone(em) }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  return (
    <div className="login">
      <div className="login-hero">
        <img src="./icon.svg" alt="" />
        <h1>SafePlate</h1>
        <p>Check the PG before you pay.<br />Real ratings for food, hygiene, amenities and security in Gurgaon.</p>
      </div>
      <div className="login-card">
        {step === 'email' ? (
          <form onSubmit={send}>
            <h2>Sign in</h2>
            <p className="muted small">We'll email you a one-time code. No password needed.</p>
            <input className="input" type="email" inputMode="email" autoComplete="email" autoFocus
              placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            {err && <div className="notice error">{err}</div>}
            <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <h2>Enter the code</h2>
            <p className="muted small">Sent to <b>{email}</b>. Check your inbox and spam folder.</p>
            <input className="input code-input" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={10}
              placeholder="Enter code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
            {err && <div className="notice error">{err}</div>}
            <button className="btn btn-primary btn-block btn-lg" disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Verify & continue'}</button>
            <div className="row-between" style={{ marginTop: 8 }}>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => { setStep('email'); setCode(''); setErr('') }}>Change email</button>
              <button type="button" className="btn btn-small btn-ghost" disabled={busy} onClick={send}>Resend code</button>
            </div>
          </form>
        )}
        <p className="login-foot">You stay signed in for 10 days on this device. Your email is never shown publicly.</p>
      </div>
    </div>
  )
}
