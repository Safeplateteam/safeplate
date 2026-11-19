import React, { useEffect, useRef } from 'react'
import L from 'leaflet'

const CENTER = [28.4615, 77.0535] // Sector 30, Gurgaon (DLF Star Mall area)

function pin(pg, active) {
  const label = pg.verified
    ? (pg.score?.trust_score != null ? Number(pg.score.trust_score).toFixed(1) : '✓')
    : (pg.web_rating != null ? '★' + Number(pg.web_rating).toFixed(1) : '•')
  return L.divIcon({
    className: '',
    html: `<div class="pin ${pg.verified ? 'pin-verified' : 'pin-web'} ${active ? 'pin-active' : ''}">${label}</div>`,
    iconSize: [52, 28], iconAnchor: [26, 28],
  })
}

export default function MapView({ pgs, activeId, onSelect, height = '100%', single }) {
  const el = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)

  useEffect(() => {
    map.current = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(CENTER, 15)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap contributors',
    }).addTo(map.current)
    layer.current = L.layerGroup().addTo(map.current)
    return () => map.current.remove()
  }, [])

  useEffect(() => {
    if (!layer.current) return
    layer.current.clearLayers()
    const pts = []
    pgs.filter(p => p.lat && p.lng).forEach(p => {
      const m = L.marker([p.lat, p.lng], { icon: pin(p, p.id === activeId), zIndexOffset: p.verified ? 1000 : 0 })
      if (onSelect) m.on('click', () => onSelect(p))
      m.addTo(layer.current)
      pts.push([p.lat, p.lng])
    })
    if (single && pts.length) map.current.setView(pts[0], 16)
    else if (pts.length > 1) map.current.setView(CENTER, 16)
  }, [pgs, activeId, onSelect, single])

  return <div ref={el} className="map" style={{ height }} />
}
