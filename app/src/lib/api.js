import { createClient } from '@supabase/supabase-js'

// Publishable key: safe to ship inside the app (access is controlled by database rules)
export const SUPABASE_URL = 'https://agcvwaauvtofnvymwhsc.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_9_qjvc3ekBBo98OI85vfxw_0vyztTZu'
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// Phone.email "Sign in with Phone" Client ID (public). Empty = reviewers type their number without OTP.
export const PHONE_EMAIL_CLIENT_ID = ''

// Public web link of the app (used inside QR posters)
export const PUBLIC_URL = 'https://safeplateteam.github.io/safeplate/'

export const PG_COLS = 'id,name,address,sector,lat,lng,verified,source,gender,rent_min,rent_max,meals,amenities,photos,web_rating,web_review_count,audit_food,audit_hygiene,audit_amenities,audit_security,audit_notes,audit_checklist,verified_at,created_at'

export async function loadPgs() {
  const [{ data: pgs, error }, { data: scores }] = await Promise.all([
    sb.from('pgs').select(PG_COLS).order('verified', { ascending: false }).order('web_rating', { ascending: false, nullsFirst: false }),
    sb.from('pg_scores').select('*'),
  ])
  if (error) throw error
  const byId = Object.fromEntries((scores || []).map(s => [s.pg_id, s]))
  return (pgs || []).map(p => ({ ...p, score: byId[p.id] || { review_count: 0 } }))
}

export async function loadPgDetail(id) {
  const [{ data: reviews }, { data: web }] = await Promise.all([
    sb.from('reviews_public').select('*').eq('pg_id', id).order('created_at', { ascending: false }),
    sb.from('web_reviews').select('*').eq('pg_id', id).order('created_at', { ascending: true }),
  ])
  return { reviews: reviews || [], web: web || [] }
}

export async function submitReview(r) {
  const { data, error } = await sb.rpc('submit_review', { r })
  if (error) throw new Error(friendly(error.message))
  return data
}

export async function requestArea(area) {
  const { data, error } = await sb.rpc('request_area', { area })
  if (error) throw new Error(friendly(error.message))
  return data
}

export async function requestVisit(v) {
  const { error } = await sb.from('visit_requests').insert(v)
  if (error) throw new Error(friendly(error.message))
}

export async function sendFeedback(f) {
  await sb.from('feedback').insert({ ...f, session_id: sessionId() })
}

export async function uploadPhoto(file, folder = 'reviews') {
  const small = await shrink(file)
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await sb.storage.from('photos').upload(path, small, { contentType: 'image/jpeg' })
  if (error) throw new Error('Photo upload failed: ' + error.message)
  return sb.storage.from('photos').getPublicUrl(path).data.publicUrl
}

// ── admin (team only, passphrase checked inside the database) ──
export const admin = {
  dashboard: (pass) => rpc('admin_dashboard', { pass }),
  savePg: (pass, pg) => rpc('admin_save_pg', { pass, pg }),
  hideReview: (pass, review_id, is_hidden) => rpc('admin_set_review_hidden', { pass, review_id, is_hidden }),
  qrCodes: (pass) => rpc('admin_qr_codes', { pass }),
  areas: (pass) => rpc('admin_areas', { pass }),
  setArea: (pass, area_id, new_status, new_priority = null) => rpc('admin_set_area', { pass, area_id, new_status, new_priority }),
  addArea: (pass, area, prio = 10) => rpc('admin_add_area', { pass, area, prio }),
}
async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args)
  if (error) throw new Error(friendly(error.message))
  return data
}

// ── analytics ──
export function sessionId() {
  try {
    let s = localStorage.getItem('sp_session')
    if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('sp_session', s) }
    return s
  } catch { return 'nostorage' }
}
export function track(event, pg_id = null, meta = {}) {
  sb.from('events').insert({ event, pg_id, meta, session_id: sessionId() }).then(() => {}, () => {})
}

function friendly(msg = '') {
  if (msg.includes('phone_check')) return 'Please enter a valid 10-digit Indian mobile number.'
  if (msg.includes('name_check')) return 'Please enter your name (2–40 characters).'
  if (msg.includes('already reviewed')) return 'You have already reviewed this PG with this phone number.'
  return msg
}

// resize photos on the phone before upload (keeps us inside the free 1 GB)
function shrink(file, max = 1280) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      c.toBlob(b => resolve(b || file), 'image/jpeg', 0.8)
    }
    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
  })
}
