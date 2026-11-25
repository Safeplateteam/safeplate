"""SafePlate weekly Gurgaon PG scraper (runs on GitHub Actions, stdlib only).

Order of work each run (stops when this run's share of the free Apify credit is used):
  1. Areas users requested and the team approved      -> full (photos + 10 reviews)
  2. Areas never swept                                 -> basic (name, location, rating, 1 photo)
  3. Areas swept but never scraped in full (by priority) -> full
  4. Oldest full scrape                                -> full
The free $5/month is spread evenly over the weeks left in Apify's billing cycle.

Env: APIFY_TOKEN, SCRAPER_KEY (GitHub Secrets). Optional: MAX_AREAS, DRY_RUN=1.
"""
import json, math, os, re, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone

SUPABASE = "https://agcvwaauvtofnvymwhsc.supabase.co"
ANON_KEY = "sb_publishable_9_qjvc3ekBBo98OI85vfxw_0vyztTZu"  # public key, safe to commit
ACTOR = "compass~crawler-google-places"
APIFY = "https://api.apify.com/v2"
TOKEN = os.environ.get("APIFY_TOKEN", "").strip()
KEY = os.environ.get("SCRAPER_KEY", "").strip()
MAX_AREAS = int(os.environ.get("MAX_AREAS", "40"))
DRY = os.environ.get("DRY_RUN") == "1"
FREE_CREDIT = float(os.environ.get("MONTHLY_BUDGET_USD", "5"))  # Apify free plan credit; never plan beyond it

GURGAON = (28.33, 28.57, 76.88, 77.17)  # lat min/max, lng min/max
PG_WORDS = re.compile(r"\b(pg|p\.g|paying guest|hostel|co-?living|coliving|stay|stays|homestay|dorm|dormitory|"
                      r"guest ?house|residency|rooms?|living|accommodation|lodging|homes?|nest|zolo|stanza|"
                      r"colive|housr|settl|your-?space)\b", re.I)
NOT_PG = re.compile(r"\b(restaurant|cafe|school|hospital|clinic|bank|atm|temple|mandir|gym|salon|store|shop|"
                    r"pharmacy|petrol|college|coaching|office|real estate|property dealer|builder)\b", re.I)
CAP = {"basic": 0.12, "full": 0.40}  # max $ per area run


def http(method, url, body=None, headers=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "application/json", **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        txt = r.read().decode()
        return json.loads(txt) if txt else None


def rpc(fn, args):
    return http("POST", f"{SUPABASE}/rest/v1/rpc/{fn}", args,
                {"apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}"}, timeout=180)


def apify(method, path, body=None, **params):
    try:
        return http(method, f"{APIFY}{path}?{urllib.parse.urlencode(params)}", body,
                    {"Authorization": f"Bearer {TOKEN}"}, timeout=180)
    except urllib.error.HTTPError as e:
        if e.code == 401:
            sys.exit("Apify rejected APIFY_TOKEN (401). Re-copy the full 'Personal API token' (starts with apify_api_) "
                     "from console.apify.com/settings/integrations and update the GitHub secret.")
        raise


def credit():
    d = apify("GET", "/users/me/limits")["data"]
    used = float(d["current"]["monthlyUsageUsd"])
    limit = min(float(d["limits"]["maxMonthlyUsageUsd"]), FREE_CREDIT)
    end = d.get("monthlyUsageCycle", {}).get("endAt")
    days_left = 30
    if end:
        days_left = max(1, (datetime.fromisoformat(end.replace("Z", "+00:00")) - datetime.now(timezone.utc)).days)
    return used, limit, days_left


def plan(areas):
    by = lambda a: (a["priority"], a["name"])
    act = [a for a in areas if a["status"] == "active"]
    q = []
    q += [(a, "full") for a in sorted(act, key=by) if a["priority"] <= 10 and not a["full_at"]]
    q += [(a, "basic") for a in sorted(act, key=by) if not a["basic_at"] and not a["full_at"]]
    q += [(a, "full") for a in sorted(act, key=by) if a["basic_at"] and not a["full_at"]]
    q += [(a, "full") for a in sorted([a for a in act if a["full_at"]], key=lambda a: a["full_at"])]
    seen, out = set(), []
    for a, m in q:
        if a["id"] not in seen:
            seen.add(a["id"]); out.append((a, m))
    return out


def actor_input(area, mode):
    name = area["name"]
    base = {
        "searchStringsArray": [f"PG in {name} Gurgaon"] + ([f"paying guest {name} Gurugram"] if mode == "full" else []),
        "locationQuery": "Gurugram, Haryana, India",
        "maxCrawledPlacesPerSearch": 20 if mode == "basic" else 15,
        "language": "en", "skipClosedPlaces": True, "includeWebResults": False,
        "scrapeContacts": False, "scrapeDirectories": False, "scrapeImageAuthors": False,
        "scrapeTableReservationProvider": False, "scrapeOrderOnline": False,
        "enableCompetitorAnalysis": False, "maximumLeadsEnrichmentRecords": 0,
        "scrapeSocialMediaProfiles": {k: False for k in ["facebooks", "instagrams", "tiktoks", "twitters", "youtubes"]},
    }
    if mode == "full":
        base.update({"scrapePlaceDetailPage": True, "maxReviews": 10, "reviewsSort": "newest",
                     "maxImages": 8, "scrapeReviewsPersonalData": True})
    else:
        base.update({"scrapePlaceDetailPage": False, "maxReviews": 0, "maxImages": 0,
                     "scrapeReviewsPersonalData": False})
    return base


def short(name):
    p = (name or "").split()
    return (p[0] + (f" {p[1][0].upper()}." if len(p) > 1 else "")) if p else "Google user"


def gender(x):
    s = " ".join([x.get("title") or "", x.get("categoryName") or "", *(x.get("categories") or [])]).lower()
    g, b = re.search(r"girl|women|ladies|female", s), re.search(r"\bboy|\bmen\b|gents|\bmale\b", s)
    return "coed" if (g and b) or re.search(r"co-?living", s) and not (g or b) else "girls" if g else "boys" if b else None


def clean(items, mode):
    out = {}
    for x in items:
        loc = x.get("location") or {}
        lat, lng = loc.get("lat"), loc.get("lng")
        if not (x.get("placeId") and lat and lng) or x.get("permanentlyClosed"):
            continue
        if not (GURGAON[0] <= lat <= GURGAON[1] and GURGAON[2] <= lng <= GURGAON[3]):
            continue
        text = " ".join([x.get("title") or "", x.get("categoryName") or "", *(x.get("categories") or [])])
        if not PG_WORDS.search(text) or (NOT_PG.search(x.get("categoryName") or "") and not PG_WORDS.search(x.get("title") or "")):
            continue
        photos = (x.get("imageUrls") or [])[:8] or ([x["imageUrl"]] if x.get("imageUrl") else [])
        item = {
            "place_id": x["placeId"], "name": x.get("title"), "address": x.get("address"),
            "sector": (re.search(r"Sector\s*(\d+)", x.get("address") or "", re.I) or [None, None])[1],
            "lat": lat, "lng": lng, "gender": gender(x), "photos": photos,
            "rating": x.get("totalScore"), "review_count": x.get("reviewsCount"),
        }
        if mode == "full":
            item["reviews"] = [{"author": short(r.get("name")), "rating": r.get("stars"),
                                "body": (r.get("text") or "")[:700], "photos": (r.get("reviewImageUrls") or [])[:3],
                                "posted": r.get("publishAt")}
                               for r in (x.get("reviews") or [])[:10] if r.get("text") or r.get("stars")]
        out[x["placeId"]] = item
    return list(out.values())


def run_area(area, mode, cap):
    run = apify("POST", f"/acts/{ACTOR}/runs", actor_input(area, mode), maxTotalChargeUsd=f"{cap:.2f}", waitForFinish=60)["data"]
    while run["status"] in ("READY", "RUNNING"):
        run = apify("GET", f"/actor-runs/{run['id']}", waitForFinish=60)["data"]
    items = apify("GET", f"/datasets/{run['defaultDatasetId']}/items", clean="true", format="json") or []
    return run["status"], items


def main():
    if not TOKEN or not KEY:
        sys.exit("Missing APIFY_TOKEN or SCRAPER_KEY secret.")
    if not TOKEN.startswith("apify_api_"):
        print("Warning: APIFY_TOKEN does not start with 'apify_api_' - it may be copied incompletely.")
    try:
        rpc("scraper_areas", {"k": KEY})
    except urllib.error.HTTPError:
        sys.exit("Supabase rejected SCRAPER_KEY. Re-copy it from Supabase (private.settings) and update the GitHub secret.")
    used, limit, days_left = credit()
    remaining = limit - used
    weeks_left = max(1, math.ceil(days_left / 7))
    budget = remaining / weeks_left
    print(f"Apify credit: ${used:.2f} used of ${limit:.2f} · {days_left} days left in cycle · this run's budget ${budget:.2f}")
    if remaining < 0.10:
        print("Free credit used up for this month. Stopping until the next cycle."); return

    queue = plan(rpc("scraper_areas", {"k": KEY}))
    print(f"{len(queue)} areas in rotation")
    start_used, done, found = used, 0, 0
    for area, mode in queue[:MAX_AREAS]:
        spent = used - start_used
        left = budget - spent
        if left < CAP["basic"] * 0.5 or (mode == "full" and left < 0.15):
            print(f"Run budget reached (${spent:.2f} spent)."); break
        cap = min(CAP[mode], left)
        print(f"→ {area['name']} [{mode}] cap ${cap:.2f}", flush=True)
        if DRY:
            done += 1; continue
        try:
            status, items = run_area(area, mode, cap)
            rows = clean(items, mode)
            n = rpc("scraper_import", {"k": KEY, "area_id": area["id"], "mode": mode, "items": rows})
            found += n; done += 1
            print(f"  {status}: {len(items)} results → {n} PGs saved")
        except Exception as e:  # keep going with the next area
            print(f"  failed: {e}")
        used = credit()[0]
    print(f"Done: {done} areas, {found} PGs saved, ${used - start_used:.2f} spent this run, ${limit - used:.2f} left this month.")


if __name__ == "__main__":
    main()
