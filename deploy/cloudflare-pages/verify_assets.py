#!/usr/bin/env python3
"""Fetch the three R2-served assets from a deployed base URL and compare size and SHA-256 with the registry.

Usage: python3 deploy/cloudflare-pages/verify_assets.py https://drnd-mousebio-3d.pages.dev
Read-only: GET requests to the given site only; no data is sent. A gzip Content-Encoding is decoded as a browser
would, and a gzip model (.glb) is unpacked as the application does, before comparing with the registered values.
"""
import gzip, hashlib, json, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def registry():
    living = json.loads((ROOT / "public/atlas-living/atlas.json").read_text())["statistics"]
    vascular = json.loads((ROOT / "public/atlas-vascular/atlas.json").read_text())["statistics"]
    layers = {l["id"]: l for l in json.loads((ROOT / "public/atlas-volume/sections/sections.json").read_text())["layers"]}
    cryo = layers["cryosection"]
    return [("/atlas-living/living-mouse.glb", living["glbBytes"], living["glbSha256"], True),
            ("/atlas-vascular/schmid2021-mvn1-lines.json", vascular["assetBytes"], vascular["assetSha256"], False),
            ("/atlas-volume/sections/cryosection-slices.bin", cryo["assetBytes"], cryo["assetSha256"], False)]

def main(base):
    base = base.rstrip("/")
    if not base.startswith(("http://127.0.0.1", "http://localhost", "https://")):
        sys.exit("Use an https:// site URL (or a local http://127.0.0.1 server).")
    failed = False
    for path, size, digest, unpack in registry():
        for accept in ("identity", "gzip"):
            request = urllib.request.Request(base + path, headers={"Accept-Encoding": accept, "User-Agent": "mousebio-asset-verify/1.0"})
            with urllib.request.urlopen(request, timeout=120) as response:
                body, encoding, kind = response.read(), response.headers.get("Content-Encoding"), response.headers.get("Content-Type")
                cache = response.headers.get("Cache-Control")
            wire = len(body)
            if encoding == "gzip":
                body = gzip.decompress(body)
            if unpack and body[:2] == b"\x1f\x8b":
                body = gzip.decompress(body)
            ok = len(body) == size and hashlib.sha256(body).hexdigest() == digest
            failed |= not ok
            print(f"{'OK  ' if ok else 'FAIL'} {path} accept={accept} encoding={encoding} wire={wire} type={kind} cache={cache}")
    sys.exit(1 if failed else 0)

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__))
