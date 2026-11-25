import React, { useEffect, useMemo, useState } from 'react'
import { loadPgDetail, requestVisit, sendFeedback, track } from '../lib/api.js'
import { PILLARS, ISSUE_LABEL, AMENITY_LABEL, CHECKLIST, GENDER_LABEL, rentText, scoreColor } from '../lib/constants.js'
import { Gallery, VerifiedBadge, UnverifiedBadge, ScorePill, Bar, Stars, Sheet, Toast, timeAgo } from '../components/ui.jsx'
import MapView from '../components/MapView.jsx'
import { go } from '../App.jsx'

export default function PGDetail({ pg, loading }) {
  const [d, setD] = useState(null)
  const [visit, setVisit] = useState(false)
  const [toast, setToast] = useState('')
  useEffect(() => { if (pg) loadPgDetail(pg.id).then(setD) }, [pg])

  // count how often each problem is mentioned by residents
  const issueCounts = useMemo(() => {
    const c = {}
    ;(d?.reviews || []).forEach(r => (r.issues || []).forEach(i => { c[i] = (c[i] || 0) + 1 }))
    return c
  }, [d])

  if (loading) return <div className="page"><div className="skeleton" style={{ height: 260 }} /></div>
  if (!pg) return <div className="page"><div className="empty">PG not found. <a onClick={() => go('/')}>Back to list</a></div></div>

  const s = pg.score || {}
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2600) }

  return (
    <div className="page detail">
      <div className="detail-media">
        <Gallery photos={pg.photos} alt={pg.name} height={280} />
        <button className="back-btn" onClick={() => (history.length > 1 ? history.back() : go('/'))}>‹</button>
      </div>

      <div className="detail-body">
        {pg.verified ? <VerifiedBadge /> : <UnverifiedBadge />}
        <h1>{pg.name}</h1>
        <div className="muted">{pg.address || (pg.sector && `Sector ${pg.sector}, Gurgaon`)}</div>
        <div className="facts">
          {rentText(pg) && <span>💰 {rentText(pg)}</span>}
          {pg.gender && <span>👤 {GENDER_LABEL[pg.gender]}</span>}
          {pg.meals && <span>🍽️ {pg.meals}</span>}
        </div>

        {pg.verified ? (
          <section className="block trust">
            <div className="trust-head">
              <ScorePill value={s.trust_score} big label="/5" />
              <div>
                <h2>SafePlate Trust Score</h2>
                <p className="muted">{s.review_count ? `From ${s.review_count} resident review${s.review_count > 1 ? 's' : ''} + our team's visit` : "From our team's on-site audit"}{pg.verified_at ? ` · verified ${timeAgo(pg.verified_at)}` : ''}</p>
              </div>
            </div>
            {PILLARS.map(p => {
              const v = s[p.key] ?? pg['audit_' + p.key]
              const flagged = p.issues.filter(([k]) => issueCounts[k]).sort((a, b) => issueCounts[b[0]] - issueCounts[a[0]])
              return (
                <div key={p.key} className="pillar">
                  <div className="pillar-row">
                    <span className="pillar-name">{p.icon} {p.label}</span>
                    <Bar value={v} />
                    <b style={{ color: scoreColor(v) }}>{v != null ? Number(v).toFixed(1) : '–'}</b>
                  </div>
                  {flagged.length > 0 && (
                    <div className="issue-tags">
                      {flagged.map(([k, l]) => <span key={k} className="issue">{l} · {issueCounts[k]}</span>)}
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        ) : (
          <section className="block unverified-box">
            <div className="web-big">
              <span>★ {pg.web_rating != null ? Number(pg.web_rating).toFixed(1) : '–'}</span>
              <small>{pg.web_review_count ? `${pg.web_review_count} public reviews from the web` : 'Public rating from the web'}</small>
            </div>
            <p>This PG is <b>not yet onboarded or verified by SafePlate</b>. We haven't checked its kitchen, water, hygiene or security. Ratings below are public reviews from the web.</p>
            {s.review_count > 0 && <p className="muted">{s.review_count} SafePlate user review{s.review_count > 1 ? 's' : ''} below.</p>}
          </section>
        )}

        {pg.verified && pg.audit_checklist && Object.keys(pg.audit_checklist).length > 0 && (
          <section className="block">
            <h3>What our team checked</h3>
            <ul className="checklist">
              {CHECKLIST.filter(([k]) => k in pg.audit_checklist).map(([k, l]) => (
                <li key={k} className={pg.audit_checklist[k] ? 'ok' : 'bad'}>{pg.audit_checklist[k] ? '✓' : '✕'} {l}</li>
              ))}
            </ul>
            {pg.audit_notes && <p className="audit-note">“{pg.audit_notes}” — SafePlate team</p>}
          </section>
        )}

        {pg.amenities?.length > 0 && (
          <section className="block">
            <h3>Amenities</h3>
            <div className="amen">{pg.amenities.map(a => <span key={a}>{AMENITY_LABEL[a] || a}</span>)}</div>
          </section>
        )}

        <DecisionPrompt pg={pg} onDone={() => flash('Thanks! That helps us a lot 🙏')} />

        <section className="block">
          <div className="row-between">
            <h3>Resident reviews {d?.reviews?.length ? `(${d.reviews.length})` : ''}</h3>
            <button className="btn btn-small btn-outline" onClick={() => go('/review/' + pg.id)}>Write a review</button>
          </div>
          {d && d.reviews.length === 0 && <p className="muted">No resident reviews yet. Live here? Be the first to rate it.</p>}
          {d?.reviews.map(r => (
            <div key={r.id} className="review">
              <div className="review-head">
                <div className="avatar">{r.name[0]}</div>
                <div><b>{r.name}</b>{r.is_resident && <span className="resident-tag">Resident</span>}{r.phone_verified && <span className="resident-tag blue">✓ Phone verified</span>}<small>{timeAgo(r.created_at)}{r.months_stayed ? ` · stayed ${r.months_stayed} mo` : ''}</small></div>
              </div>
              <div className="review-scores">
                {PILLARS.map(p => <span key={p.key}>{p.icon} {r[p.key]}</span>)}
              </div>
              {r.issues?.length > 0 && <div className="issue-tags">{r.issues.map(i => <span key={i} className="issue">{ISSUE_LABEL[i] || i}</span>)}</div>}
              {r.comment && <p>{r.comment}</p>}
              {r.photos?.length > 0 && <div className="thumbs">{r.photos.map(u => <img key={u} src={u} alt="" />)}</div>}
            </div>
          ))}
        </section>

        {d?.web?.length > 0 && (
          <section className="block">
            <h3>Public reviews from the web</h3>
            <p className="muted small">Not verified by SafePlate. Shown so you have more to go on.</p>
            {d.web.map(w => (
              <div key={w.id} className="review web">
                <div className="review-head">
                  <div className="avatar grey">{(w.author || '?')[0]}</div>
                  <div><b>{w.author || 'Anonymous'}</b><small><Stars value={w.rating} /> {w.posted}</small></div>
                </div>
                {w.body && <p className="pre">{w.body.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')}</p>}
                {w.photos?.length > 0 && <div className="thumbs">{w.photos.map(u => <img key={u} src={u} alt="" referrerPolicy="no-referrer" />)}</div>}
              </div>
            ))}
          </section>
        )}

        {pg.lat && (
          <section className="block">
            <h3>Location</h3>
            <MapView pgs={[pg]} single height="200px" />
          </section>
        )}
      </div>

      <div className="sticky-bar">
        <div>
          <b>{rentText(pg) || 'Rent on request'}</b>
          <small>{pg.verified ? 'Verified by SafePlate' : 'Not yet verified'}</small>
        </div>
        <button className="btn btn-primary" onClick={() => { setVisit(true); track('visit_open', pg.id) }}>Request a visit</button>
      </div>

      <VisitSheet pg={pg} open={visit} onClose={() => setVisit(false)} onDone={() => { setVisit(false); flash('Request sent! Our team will call you within 24h.') }} />
      <Toast msg={toast} />
    </div>
  )
}

function DecisionPrompt({ pg, onDone }) {
  const key = 'sp_fb_' + pg.id
  const [state, setState] = useState(() => { try { return localStorage.getItem(key) } catch { return null } })
  const [reason, setReason] = useState('')
  const [helped, setHelped] = useState(null)
  if (state === 'done') return null
  const submit = async (h, why = '') => {
    await sendFeedback({ pg_id: pg.id, helped: h, reason: why || null })
    track(h ? 'helped_yes' : 'helped_no', pg.id)
    try { localStorage.setItem(key, 'done') } catch {}
    setState('done'); onDone()
  }
  return (
    <section className="block decide">
      <h3>Did this help you decide about this PG?</h3>
      {helped === null ? (
        <div className="decide-btns">
          <button className="btn btn-outline" onClick={() => setHelped(true)}>👍 Yes</button>
          <button className="btn btn-outline" onClick={() => setHelped(false)}>👎 Not really</button>
        </div>
      ) : (
        <div className="decide-more">
          <input className="input" value={reason} onChange={e => setReason(e.target.value)} maxLength={300}
            placeholder={helped ? 'What helped the most? (optional)' : 'What was missing? (optional)'} />
          <button className="btn btn-primary" onClick={() => submit(helped, reason)}>Send</button>
        </div>
      )}
    </section>
  )
}

function VisitSheet({ pg, open, onClose, onDone }) {
  const [v, setV] = useState({ name: '', phone: '', move_in: 'This month', message: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const send = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      await requestVisit({ pg_id: pg.id, ...v, phone: v.phone.replace(/\D/g, '').slice(-10) })
      track('visit_request', pg.id); onDone()
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Request a visit">
      <form onSubmit={send} className="form">
        <p className="muted small">The SafePlate team will arrange a visit to <b>{pg.name}</b> and call you back. Your number is never shown publicly.</p>
        <label>Your name<input className="input" required value={v.name} onChange={e => setV({ ...v, name: e.target.value })} /></label>
        <label>Mobile number<input className="input" required inputMode="numeric" placeholder="10-digit mobile" value={v.phone} onChange={e => setV({ ...v, phone: e.target.value })} /></label>
        <label>When are you moving?
          <select className="input" value={v.move_in} onChange={e => setV({ ...v, move_in: e.target.value })}>
            <option>This week</option><option>This month</option><option>Next month</option><option>Just exploring</option>
          </select>
        </label>
        <label>Anything to ask? (optional)<input className="input" maxLength={300} value={v.message} onChange={e => setV({ ...v, message: e.target.value })} /></label>
        {err && <div className="notice error">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
      </form>
    </Sheet>
  )
}
