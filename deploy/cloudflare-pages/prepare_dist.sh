#!/usr/bin/env bash
# After `npm run build:host`: move the three registered assets that exceed Cloudflare Pages' 25 MiB file limit out of
# the bundle (they are served from R2 by functions/_middleware.js) and add the Pages routing and header files.
# Usage: deploy/cloudflare-pages/prepare_dist.sh <dist-dir> <stash-dir>
# The stash directory keeps the exact files (as built by build:host) for upload to R2
# (deploy/cloudflare-pages/r2_assets.ts sync). Keep it outside the repository, for example /tmp/r2-stash.
# Build gate: the build fails unless r2-assets.json agrees with the registries in public/ and the files unpack to the
# registered bytes, so an upstream change to one of these assets cannot deploy until R2 is re-synchronised.
set -euo pipefail
usage="usage: prepare_dist.sh <dist-dir> <stash-dir>"
[ $# -eq 2 ] || { echo "$usage" >&2; exit 2; }
[ -f "$1/index.html" ] || { echo "$1 is not a built bundle" >&2; exit 1; }
dist="$(cd "$1" && pwd)"
mkdir -p "$2"; stash="$(cd "$2" && pwd)"
here="$(cd "$(dirname "$0")" && pwd)"
assets=(atlas-living/living-mouse.glb atlas-vascular/schmid2021-mvn1-lines.json atlas-volume/sections/cryosection-slices.bin)
cd "$here/../.."
npx tsx deploy/cloudflare-pages/r2_assets.ts check --files "$dist" \
  || { echo "R2 asset gate failed: re-synchronise R2 and commit r2-assets.json (see docs/DRND_PRODUCTION_PLAN.md section 7)." >&2; exit 1; }
for a in "${assets[@]}"; do
  [ -f "$dist/$a" ] || { echo "missing from bundle: $a" >&2; exit 1; }
  mkdir -p "$stash/$(dirname "$a")"
  mv "$dist/$a" "$stash/$a"
done
cp "$here/_routes.json" "$here/_headers" "$dist/"
echo "Moved ${#assets[@]} assets to $stash; bundle now has $(find "$dist" -type f | wc -l) files, $(find "$dist" -type f -size +25M | wc -l) over 25 MiB."
