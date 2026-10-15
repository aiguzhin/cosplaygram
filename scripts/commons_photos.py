"""Подбирает фото косплея для каждого персонажа с Wikimedia Commons.

Берём только файлы со свободной лицензией (CC0, PD, CC BY, CC BY-SA) и сохраняем автора и лицензию,
чтобы показать подпись на сайте. Запускается в GitHub Actions (там есть доступ в интернет).

Вход:  scripts/characters.json  — {id: {"q": "поисковый запрос", "must": ["слово", ...], "skip": ["File:..."]}}
Выход: public/chars/<id>.jpg и public/chars/credits.json
"""
import json, os, re, sys, time, urllib.parse, urllib.request
from io import BytesIO

from PIL import Image

API = "https://commons.wikimedia.org/w/api.php"
UA = "CosplaygramBot/1.0 (https://github.com/aiguzhin/cosplaygram; cosplay platform demo photos)"
OUT = "public/chars"
OK_LICENSES = re.compile(r"^(cc0|public domain|pd|cc by(-sa)? ?\d(\.\d)?|cc by(-sa)?)", re.I)
BAD_WORDS = re.compile(r"nsfw|nude|lingerie|bikini|swimsuit|underwear|fetish", re.I)


def get(params):
    params = {**params, "format": "json", "formatversion": "2"}
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for i in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            print("  повтор:", e)
            time.sleep(2 + i * 3)
    return {}


def strip(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip()


def candidates(q, must, skip):
    res = get({"action": "query", "list": "search", "srsearch": q, "srnamespace": 6, "srlimit": 40})
    titles = [h["title"] for h in res.get("query", {}).get("search", [])]
    titles = [t for t in titles if re.search(r"\.(jpe?g|png)$", t, re.I) and t not in skip]
    if must:
        titles = [t for t in titles if any(m in t.lower() for m in must)]
    out = []
    for i in range(0, len(titles), 20):
        info = get({"action": "query", "titles": "|".join(titles[i:i + 20]), "prop": "imageinfo",
                    "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 720})
        for page in info.get("query", {}).get("pages", []):
            ii = (page.get("imageinfo") or [{}])[0]
            meta = ii.get("extmetadata", {})
            lic = strip(meta.get("LicenseShortName", {}).get("value"))
            desc = strip(meta.get("ImageDescription", {}).get("value"))
            if not OK_LICENSES.match(lic) or "nc" in lic.lower() or "nd" in lic.lower():
                continue
            if BAD_WORDS.search(page["title"] + " " + desc):
                continue
            w, h = ii.get("width", 0), ii.get("height", 0)
            if w < 450 or h < 450 or h < w * 0.85:  # нужен вертикальный или квадратный кадр
                continue
            out.append({
                "title": page["title"],
                "thumb": ii.get("thumburl") or ii.get("url"),
                "page": ii.get("descriptionurl"),
                "author": strip(meta.get("Artist", {}).get("value"))[:80] or "Автор не указан",
                "license": lic,
                "score": (h / max(w, 1) > 1.15) * 2 + (w >= 1000),
            })
    out.sort(key=lambda c: -c["score"])
    return out


def main():
    chars = json.load(open("scripts/characters.json", encoding="utf-8"))
    only = set(sys.argv[1:])
    os.makedirs(OUT, exist_ok=True)
    credits_path = os.path.join(OUT, "credits.json")
    credits = json.load(open(credits_path, encoding="utf-8")) if os.path.exists(credits_path) else {}
    for cid, spec in chars.items():
        if only and cid not in only:
            continue
        if not only and cid in credits and os.path.exists(os.path.join(OUT, f"{cid}.jpg")):
            continue
        print(f"{cid}: {spec['q']}")
        found = False
        for c in candidates(spec["q"], [m.lower() for m in spec.get("must", [])], set(spec.get("skip", []))):
            try:
                req = urllib.request.Request(c["thumb"], headers={"User-Agent": UA})
                data = urllib.request.urlopen(req, timeout=40).read()
                im = Image.open(BytesIO(data)).convert("RGB")
                w, h = im.size
                th = int(w * 5 / 4)
                if h > th:  # кадр 4:5, чуть выше центра — там обычно лицо
                    top = int((h - th) * 0.25)
                    im = im.crop((0, top, w, top + th))
                im.thumbnail((720, 900))
                im.save(os.path.join(OUT, f"{cid}.jpg"), "JPEG", quality=82, optimize=True, progressive=True)
                credits[cid] = {k: c[k] for k in ("title", "page", "author", "license")}
                print(f"  ✓ {c['title']} — {c['license']}")
                found = True
                break
            except Exception as e:  # noqa: BLE001
                print("  ошибка загрузки:", e)
        if not found:
            print("  — подходящего свободного фото нет")
            credits.pop(cid, None)
        time.sleep(0.5)
    json.dump(credits, open(credits_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)


if __name__ == "__main__":
    main()
