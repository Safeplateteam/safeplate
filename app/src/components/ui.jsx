import React, { useState, useEffect } from 'react'
import { pushBack } from '../lib/back.js'
import { scoreColor } from '../lib/constants.js'

export function VerifiedBadge({ small }) {
  return <span className={'badge badge-verified' + (small ? ' badge-sm' : '')}>✓ Verified by SafePlate</span>
}
export function UnverifiedBadge({ small }) {
  return <span className={'badge badge-muted' + (small ? ' badge-sm' : '')}>Not yet verified by SafePlate</span>
}

export function ScorePill({ value, label = 'Trust', big }) {
  const c = scoreColor(value)
  return (
    <span className={'score-pill' + (big ? ' score-pill-big' : '')} style={{ background: c }}>
      {value != null ? Number(value).toFixed(1) : '–'}
      <small>{label}</small>
    </span>
  )
}

export function Bar({ value, color }) {
  const pct = value ? (Number(value) / 5) * 100 : 0
  return (
    <div className="bar"><div className="bar-fill" style={{ width: pct + '%', background: color || scoreColor(value) }} /></div>
  )
}

export function StarsInput({ value, onChange }) {
  return (
    <div className="stars-input" role="radiogroup">
      {[1, 2, 3, 4, 5].map(n => (
        <button type="button" key={n} aria-label={n + ' stars'}
          className={'star' + (n <= value ? ' on' : '')} onClick={() => onChange(n)}>★</button>
      ))}
    </div>
  )
}
export function Stars({ value }) {
  const v = Math.round(Number(value) || 0)
  return <span className="stars">{'★★★★★'.slice(0, v)}<span className="stars-off">{'★★★★★'.slice(v)}</span></span>
}

export function Gallery({ photos, alt, height = 220, rounded, max = 6 }) {
  const [i, setI] = useState(0)
  const list = photos && photos.length ? photos.slice(0, max) : [null]
  return (
    <div className={'gallery' + (rounded ? ' rounded' : '')} style={{ height }}>
      <div className="gallery-track" onScroll={e => { const n = Math.round(e.target.scrollLeft / e.target.clientWidth); if (n !== i) setI(n) }}>
        {list.map((src, k) => src
          ? <img key={k} src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer"
                 onError={e => { e.currentTarget.replaceWith(Object.assign(document.createElement('div'), { className: 'gallery-empty', textContent: '🏠' })) }} />
          : <div key={k} className="gallery-empty">🏠<span>No photos yet</span></div>)}
      </div>
      {list.length > 1 && <div className="dots">{list.slice(0, 8).map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>}
    </div>
  )
}

export function Sheet({ open, onClose, title, children }) {
  useEffect(() => (open ? pushBack(onClose) : undefined), [open]) // eslint-disable-line
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  )
}

export function Toast({ msg }) { return msg ? <div className="toast">{msg}</div> : null }

export function timeAgo(d) {
  const s = (Date.now() - new Date(d)) / 1000
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min ago'
  if (s < 86400) return Math.round(s / 3600) + ' h ago'
  if (s < 86400 * 30) return Math.round(s / 86400) + ' days ago'
  return new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}
