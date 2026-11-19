# SafePlate — PG Trust Score (MVP)

**Know your PG's food, hygiene, amenities and security before you pay.**
Entrepreneurship project · Group 11 · Pilot market: Sector 30, Gurgaon.

| What | Where |
|---|---|
| Web app | https://safeplateteam.github.io/safeplate/ |
| Android APK | Releases → **apk-latest** → `SafePlate.apk` |
| Team admin | web app → `#/admin` (passphrase) |
| Database | Supabase project `agcvwaauvtofnvymwhsc` |

## How it works
- **Verified by SafePlate** PGs: team visits, fills the audit checklist in `#/admin`, prints the QR poster. Residents scan → review is tagged *Resident*.
- **Not yet verified** PGs: imported from public web listings (name, location, rating, photos, reviews).
- **Trust Score** = 60% resident reviews + 40% team audit, across 🥘 Food · 🧹 Hygiene · 🛠️ Amenities · 🔒 Security.
- **Decision test**: every PG page asks *"Did this help you decide?"* — results in the admin dashboard.

## Code
- `app/` — React + Vite web app, wrapped as Android APK with Capacitor (built by GitHub Actions).
- `supabase/` — database schema, privacy rules and admin functions.

Every push to `main` re-publishes the web app and rebuilds the APK automatically.
