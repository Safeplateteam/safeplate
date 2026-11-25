import React from 'react'
import { Gallery, VerifiedBadge, ScorePill, Bar, Stars } from './ui.jsx'
import { PILLARS, GENDER_LABEL, rentText } from '../lib/constants.js'

export default function PGCard({ pg, onOpen, compact }) {
  const s = pg.score || {}
  const rent = rentText(pg)
  return (
    <article className={'card' + (compact ? ' card-compact' : '')} onClick={() => onOpen(pg)}>
      <div className="card-media">
        <Gallery photos={pg.photos} alt={pg.name} height={compact ? 120 : 200} />
        {pg.verified && <div className="card-badge"><VerifiedBadge small /></div>}
        {pg.verified && s.trust_score != null && <div className="card-score"><ScorePill value={s.trust_score} /></div>}
      </div>
      <div className="card-body">
        <div className="card-title-row">
          <h3 className="card-title">{pg.name}</h3>
          {!pg.verified && pg.web_rating != null && (
            <span className="web-rating">★ {Number(pg.web_rating).toFixed(1)}{pg.web_review_count ? <small> ({pg.web_review_count})</small> : null}</span>
          )}
        </div>
        <div className="card-meta">
          {[pg.dist != null && (pg.dist < 1 ? `${Math.round(pg.dist * 1000)} m` : `${pg.dist.toFixed(1)} km`), pg.sector && `Sector ${pg.sector}`, GENDER_LABEL[pg.gender], rent].filter(Boolean).join(' · ') || pg.address}
        </div>
        {pg.verified && !compact && (
          <div className="mini-pillars">
            {PILLARS.map(p => {
              const v = s[p.key] ?? pg['audit_' + p.key]
              return (
                <div key={p.key} className="mini-pillar">
                  <span>{p.icon} {p.label}</span>
                  <Bar value={v} />
                  <b>{v != null ? Number(v).toFixed(1) : '–'}</b>
                </div>
              )
            })}
          </div>
        )}
        {pg.verified
          ? <div className="card-foot">{s.review_count ? `${s.review_count} resident review${s.review_count > 1 ? 's' : ''}` : 'Audited by the SafePlate team'}</div>
          : <div className="card-foot muted">Public reviews from the web · <span className="link">not verified by SafePlate</span></div>}
      </div>
    </article>
  )
}

export { Stars }
