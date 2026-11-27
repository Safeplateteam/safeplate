"""Free extra PG listings from OpenStreetMap (Overpass API, no key, no cost).

Adds PGs / hostels / co-living places in Gurgaon that are NOT already in SafePlate
(skips anything within 80 m of an existing listing). OSM has names + locations only:
no photos, no ratings. Env: SCRAPER_KEY. Optional DRY_RUN=1.
"""
import json, math, os, re, sys, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from weekly_scrape import rpc, KEY, SUPABASE, ANON_KEY, PG_WORDS, NOT_PG, GURGAON, gender  # noqa: E402

DRY = os.environ.get("DRY_RUN") == "1"
S, N, W, E = GURGAON[0], GURGAON[1], GURGAON[2], GURGAON[3]
QUERY = f"""[out:json][timeout:90];
(
  nwr["tourism"="hostel"]({S},{W},{N},{E});
  nwr["tourism"="guest_house"]({S},{W},{N},{E});
  nwr["amenity"="dormitory"]({S},{W},{N},{E});
  nwr["building"="dormitory"]({S},{W},{N},{E});
  nwr["name"~"(^|[^A-Za-z])(PG|P\\\\.G\\\\.?)([^A-Za-z]|$)|paying guest|co-?living|coliving|girls hostel|boys hostel",i]({S},{W},{N},{E});
);
out center tags;"""


def overpass():
    for url in ("https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"):
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": QUERY}).encode(),
                                         headers={"User-Agent": "SafePlate-student-project/1.0"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode())["elements"]
        except Exception as e:
            print(f"{url} failed: {e}")
    sys.exit("Overpass not reachable")


def existing():
    req = urllib.request.Request(f"{SUPABASE}/rest/v1/pgs?select=name,lat,lng&limit=5000",
                                 headers={"apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return [p for p in json.loads(r.read().decode()) if p.get("lat")]


def meters(a, b):
    R, t = 6371000, math.radians
    h = math.sin(t(b[0] - a[0]) / 2) ** 2 + math.cos(t(a[0])) * math.cos(t(b[0])) * math.sin(t(b[1] - a[1]) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def main():
    if not KEY:
        sys.exit("Missing SCRAPER_KEY")
    els = overpass()
    have = existing()
    print(f"OpenStreetMap returned {len(els)} places · SafePlate already has {len(have)} PGs")
    items, skipped_dupe, skipped_type = [], 0, 0
    for e in els:
        t = e.get("tags", {})
        name = (t.get("name") or t.get("name:en") or "").strip()
        lat, lng = e.get("lat") or e.get("center", {}).get("lat"), e.get("lon") or e.get("center", {}).get("lon")
        if not (name and lat and lng):
            continue
        kind = t.get("tourism") or t.get("amenity") or t.get("building") or ""
        if not PG_WORDS.search(name) and kind != "hostel" or NOT_PG.search(name):
            skipped_type += 1; continue
        if any(meters((lat, lng), (p["lat"], p["lng"])) < 80 for p in have):
            skipped_dupe += 1; continue
        addr = ", ".join(x for x in [t.get("addr:housenumber"), t.get("addr:street"), t.get("addr:suburb"),
                                     t.get("addr:city") or "Gurugram"] if x)
        sec = re.search(r"Sector\s*(\d+)", " ".join([addr, t.get("addr:suburb", ""), name]), re.I)
        items.append({"place_id": f"osm:{e['type']}/{e['id']}", "name": name, "address": addr,
                      "sector": sec.group(1) if sec else None, "lat": lat, "lng": lng,
                      "gender": gender({"title": name}), "photos": [], "rating": None, "review_count": None})
        have.append({"lat": lat, "lng": lng})
    print(f"New PGs to add: {len(items)} · skipped {skipped_dupe} already listed · skipped {skipped_type} not PG-like")
    for it in items[:15]:
        print("  +", it["name"], "|", it["sector"] or "-")
    if DRY or not items:
        return
    n = 0
    for i in range(0, len(items), 100):
        n += rpc("scraper_import", {"k": KEY, "area_id": -1, "mode": "basic", "items": items[i:i + 100]})
    print(f"Done: {n} PGs added from OpenStreetMap (free).")


if __name__ == "__main__":
    main()
