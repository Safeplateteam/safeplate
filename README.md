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

## Automation (GitHub Actions)
- **Weekly Gurgaon PG scrape** (`scrape.yml`, Sundays): works through `scrape_areas` on the free Apify credit — approved user requests first, then a basic sweep of every sector, then photos + reviews area by area. Needs secrets `APIFY_TOKEN` and `SCRAPER_KEY`. Can also be started by hand from the Actions tab.
- **Keep Supabase awake** (`keepalive.yml`, every 3 days).
- Users request new areas in the app; the team approves them in `#/admin` → Areas.

## Code
- `app/` — React + Vite web app, wrapped as Android APK with Capacitor (built by GitHub Actions).
- `supabase/` — database schema, privacy rules and admin functions.
- `scraper/` — weekly scraper script (Python, no dependencies).

Every push to `main` re-publishes the web app and rebuilds the APK automatically.
