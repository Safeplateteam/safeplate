import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'

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

export default function MapView({ pgs, activeId, onSelect, height = '100%', single, center }) {
  const el = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  const me = useRef(null)

  useEffect(() => {
    map.current = L.map(el.current, { zoomControl: false, attributionControl: true, zoomSnap: 0.5, inertia: true, scrollWheelZoom: !single, dragging: true, tapTolerance: 20 }).setView(CENTER, 15)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap contributors', updateWhenIdle: true, keepBuffer: 3,
    }).addTo(map.current)
    if (single) { map.current.dragging.disable(); map.current.touchZoom.disable(); map.current.doubleClickZoom.disable() } // small map on PG page: don't trap scrolling
    // the map is often created before its box has its final size → re-measure so tiles don't stay grey
    const fix = () => map.current && map.current.invalidateSize()
    const t1 = setTimeout(fix, 150), t2 = setTimeout(fix, 600)
    const ro = window.ResizeObserver ? new ResizeObserver(fix) : null
    ro && ro.observe(el.current)
    layer.current = (single ? L.layerGroup() : L.markerClusterGroup({
      showCoverageOnHover: false, maxClusterRadius: 45, spiderfyOnMaxZoom: true,
      iconCreateFunction: (c) => L.divIcon({ className: '', html: `<div class="cluster">${c.getChildCount()}</div>`, iconSize: [40, 40] }),
    })).addTo(map.current)
    return () => { clearTimeout(t1); clearTimeout(t2); ro && ro.disconnect(); map.current.remove(); map.current = null }
  }, [single])

  useEffect(() => {
    if (!layer.current) return
    layer.current.clearLayers()
    const pts = []
    pgs.filter(p => p.lat && p.lng).forEach(p => {
      const m = L.marker([p.lat, p.lng], { icon: pin(p, p.id === activeId), zIndexOffset: p.verified ? 1000 : 0 })
      if (onSelect) m.on('click', () => { onSelect(p); map.current.panTo([p.lat, p.lng], { animate: true }) })
      layer.current.addLayer(m)
      pts.push([p.lat, p.lng])
    })
    if (single && pts.length) map.current.setView(pts[0], 16)
  }, [pgs, activeId, onSelect, single])

  useEffect(() => {
    if (single || !map.current) return
    if (me.current) { me.current.remove(); me.current = null }
    if (center) {
      me.current = L.circleMarker(center, { radius: 8, color: '#fff', weight: 3, fillColor: '#2563EB', fillOpacity: 1 }).addTo(map.current)
      map.current.setView(center, 15)
    }
  }, [center, single])

  return <div ref={el} className="map" style={{ height }} />
}
