# DrND R2 Feasibility: Hosting the Three Oversized Assets

Phase 3, Part B. Investigation only. No bucket was created, nothing was uploaded, no Cloudflare setting was touched, and no source, data or dependency was changed.
Date: 2026-11-10. Commit inspected: `6cfa354` (identical to upstream `main`).

## 1. Summary and recommendation

- The three files cannot be deployed to Cloudflare Pages as they are: Pages caps each asset at 25 MiB.
- **The application loads every large asset through one checked, same-origin loader.** Pointing it at a different origin (a direct R2 URL) would need changes to the loader, the path validation, the build and several checks. That is possible but intrusive.
- **A cleaner way to use R2 needs no application code change:** keep the URLs unchanged and let a small Cloudflare Pages Function serve those three paths from an R2 bucket on the same origin. The rest of the site stays on Pages. Because the app already verifies size and SHA-256 of every asset, a stale or wrong object in R2 fails visibly instead of showing wrong anatomy.
- **Recommended architecture:** Cloudflare Pages + R2 through a Pages Function (option A1 below), validated first in a throwaway trial project, with **GitHub Pages as the zero-change fallback** (it already works exactly as upstream publishes it). Render is workable but its free bandwidth is too small for a 100 MB-class site.
- Claims marked **(to verify)** come from documentation or inference and must be confirmed in a trial before relying on them.

## 2. The three assets and how the app loads them

| Asset | Plain size | Size after `build:host` | Registry | Loader |
| --- | --- | --- | --- | --- |
| `atlas-living/living-mouse.glb` | 50,891,580 B | 34,267,945 B (gzip) | `public/atlas-living/atlas.json`: `assetUrl`, `statistics.glbBytes`, `statistics.glbSha256` | `loadAtlasScene` in `src/viewer/atlas-loader.ts`, then `fetchBoundGlb` in `src/viewer/region-detail.ts` |
| `atlas-vascular/schmid2021-mvn1-lines.json` | 38,356,364 B | unchanged (not handled by the compressor) | `public/atlas-vascular/atlas.json`: `assetUrl`, `statistics.assetBytes`, `statistics.assetSha256`; the same values are repeated in `src/domain/anatomy-coverage.ts` | `loadSourcePolylineAsset` in `src/viewer/source-polyline-loader.ts` |
| `atlas-volume/sections/cryosection-slices.bin` | 35,654,474 B | unchanged (already deflated) | `public/atlas-volume/sections/sections.json`: `assetUrl`, `assetBytes`, `assetSha256` | `loadSectionVolume` in `src/viewer/section-image.ts` (only when the user shows section images) |

Notes:
- The living mouse is the default view, so it loads on every first visit. The vascular file loads only when that reference is chosen. The cryosection file loads only for section-image display of the volume reference.
- The same sections folder also holds `ct-deflate.bin` (19.9 MB) and `labels-deflate.bin` (0.9 MB), both under 25 MiB, so they can stay on Pages.

### Loading mechanics (all three)
- All use `fetchBoundAnatomyBytes` in `src/viewer/asset-fetch.ts`. It calls `fetch(deployedPath(url), { credentials: 'same-origin', redirect: 'error' })` and reads `response.body` as a stream. It does not use `Blob` or `response.arrayBuffer()`. It fills a pre-sized `Uint8Array` of the registered byte count, then hashes it with `crypto.subtle.digest('SHA-256')`.
- It fails if the stream exceeds the registered size, falls short, or the SHA-256 differs. It also rejects redirects and opaque responses.
- **Gzip handling is by file type.** For `.glb` and `.ply` it checks for the gzip magic bytes (`1f 8b`) and unpacks with `DecompressionStream('gzip')` itself; that is how the `build:host` files work on any static host. For `.json` and `.bin` (the other two assets) it does **not** unpack gzip. Those two rely on ordinary HTTP `Content-Encoding` done by the host or the browser. The existing test "a body already decoded by the host is read as the registered bytes" covers that case.
- It never sends a `Range` header (no `Range` use anywhere in `src/`). Progress uses `Content-Length` when no `Content-Encoding` is present.
- `src/viewer/ViewerCanvas.tsx` also does a plain `fetch` of a small `flow-paths.json`; that file is not an oversized asset.

### Constraints that matter for a different origin
1. `isLocalAnatomyPath` only accepts root-relative paths matching `^/[A-Za-z0-9_./-]+\.(glb|ply|txt|json|bin)$`. Absolute URLs are refused.
2. `deployedPath` (`src/domain/deployed-path.ts`) only prefixes a safe same-site base. It has no concept of an asset origin.
3. `credentials: 'same-origin'` and `redirect: 'error'` are deliberate security properties of the loader.
4. The manifests, `section-images.ts`, `source-polyline.ts`, `native-surface-summary.ts` and `scripts/check_publication.py` validate the exact `assetUrl` strings and several expect the files to exist in the repository tree. `scripts/serve_prototype.py` sets `connect-src 'self'`.
5. `scripts/compress_models.ts` throws if a registered model is missing from `dist/`, so the three files cannot simply be deleted before `build:host`; they have to be removed after it.

## 3. Can R2 serve these files? (documentation findings)

Sources are listed at the end; items marked (to verify) are not confirmed by documentation I read.

| Requirement | Finding |
| --- | --- |
| Storage and size | R2 stores objects far larger than these three (about 103 MiB together). Standard storage is well inside the free 10 GB-month. |
| Egress cost | R2 egress is free, including through Workers and the r2.dev domain. |
| Operation cost | Free allowance 1 M Class A and 10 M Class B operations a month; beyond that $4.50 and $0.36 per million. Page loads here are Class B reads. |
| Content types | R2 stores a `Content-Type` per object; set `model/gltf-binary`, `application/json` and `application/octet-stream` at upload. The app does not check content type. |
| Public access | A public bucket can be reached through a **custom domain** or the **r2.dev** development URL. r2.dev is documented as rate-limited and not intended for production, and a custom domain must be a zone in the same Cloudflare account. You have not said a custom domain exists, so direct public access is not available for production today. |
| CORS | Needed only if the browser loads R2 from a different origin. Policy is set per bucket; `AllowedOrigins` must be `*` or an exact scheme://host[:port]. Cloudflare Pages preview deployments get their own hostnames, so a strict origin list would not cover them. `Content-Length` would have to be exposed for the progress bar to show transfer size. |
| Caching | With a custom domain, Cloudflare's CDN can cache R2 objects; policy changes keep old headers until cached copies are purged. The r2.dev URL does not support caching rules. |
| Range requests | Not used by the app. R2 supports them anyway, so nothing is needed. |
| Same-origin option | A Pages Function can read an R2 bucket through a binding and return the object on the Pages origin. Cloudflare publishes a tutorial for R2 as static asset storage for Pages. Streaming bodies of this size from a Function is expected to work **(to verify in a trial)**. |
| Whether an R2 account needs billing details on file | **(to verify)** I did not confirm this from documentation. |

## 4. Options evaluated

### A1. Cloudflare Pages + R2 behind a Pages Function (same origin) — recommended Cloudflare design
How it works:
- Pages serves everything except the three files from `dist/`.
- The three files are uploaded once to a private R2 bucket under the same paths (`atlas-living/living-mouse.glb` and so on).
- A Pages Function (a new file, `functions/[[path]].ts` or three specific routes) is bound to the bucket and returns the object with `Content-Type`, `Cache-Control: public, max-age=31536000, immutable` (the files are checksum-bound) and the object's `ETag`.
- A `_routes.json` limits the Function to those three paths, so every other request stays a free static request.
- The Pages build command becomes `npm ci && npm run build:host && rm -f` the three files from `dist/` (the removal has to come after `build:host`, see constraint 5).

What does and does not change:
- **No change** to `src/`, the registries, the manifests, the scientific assets, `package.json` or any existing test.
- **New** (outside the app): a `functions/` file of roughly 25 lines, `_routes.json`, optional `_headers`, a custom build command, a one-time R2 upload, and the R2 binding.
- No CORS and no custom domain are needed, since everything stays on one origin.
- The loader's `redirect: 'error'` is satisfied because the Function answers 200 directly.

Compression:
- Upload the `build:host` copy of `living-mouse.glb` (gzip stream, 32.7 MiB). The app already unpacks it.
- For the JSON and `.bin` files the app does not unpack, so the response must either be sent plain (36.6 and 34.0 MiB; Cloudflare may compress the JSON at the edge, **to verify**) or be stored gzipped with the object's `Content-Encoding: gzip` and passed through untouched, which the browser decodes before the app sees it (the `.bin` file is already deflated, so it gains nothing). Both variants keep the byte-and-checksum guarantee.

Cost (documentation figures): R2 storage about 0.1 GB (free tier covers 10 GB-month), no egress fee, reads far inside 10 M a month. Function invocations count against the Workers/Pages Functions allowance of the free plan, but only the three paths invoke it. Expected cost for educational traffic: **$0**, to be re-checked against current pricing.

Risks:
- Function streaming of 35 MB bodies, and whether Cloudflare compresses a Function response, need a trial.
- A fourth moving part (R2 bucket, binding, Function) to maintain.
- When upstream changes one of these three files, the R2 copy must be re-uploaded or the app will show a checksum error. That error is safe (it fails closed) but visible.

### A2. Cloudflare Pages + R2 directly (cross-origin, external asset base)
The app would fetch the three files from an R2 public URL.

Required changes: add an external asset base setting (for example a build variable alongside `MOUSEBIO_BASE`), an allow-list of which registry paths go external, changes to `isLocalAnatomyPath`, `deployedPath` and `fetchBoundAnatomyBytes` (CORS mode, `credentials`), the three loaders' callers, the build (the same post-build removal), the `serve_prototype.py` CSP, `check_publication.py` expectations and new tests; an R2 CORS policy; and a custom domain because r2.dev is rate-limited and has no caching.
It would also loosen the "everything is served from the local origin" statement in `docs/privacy-and-publication.md` and the loader's same-origin design, and the registry would need an explicit list (or manifest) of which assets are external.
Assessment: technically possible, but the largest change to the upstream architecture, needs a custom domain you have not said you own, and breaks your "no unnecessary architecture change" rule. **Not recommended.**

### B. GitHub Pages
- Works today with no change: the fork already contains `.github/workflows/pages.yml`, which builds `build:host` with `MOUSEBIO_BASE=/MouseBio_3D/` and publishes `dist/`, exactly as upstream's live site is deployed. The site would be `https://drnareshdumala-art.github.io/MouseBio_3D/`.
- Limits (documentation): published site up to 1 GB (this one is about 190 MB), soft bandwidth cap 100 GB a month, no per-file limit found on the Pages limits page other than Git's own file-size rules, which these files are under. Text and JSON are compressed by the host.
- Cost: free for a public repository. Needs the fork's Pages setting enabled and Actions allowed (a GitHub setting change you would approve).
- Drawbacks: no custom response headers (so no CSP or immutable-cache tuning beyond GitHub's defaults), URL under github.io unless you add a custom domain, and no Cloudflare rollback tooling. Every push to `main` redeploys.

### C. Render static hosting
- Works with the existing `render.yaml` (a static site, security and cache headers, `build:host`). Custom headers are supported.
- Free (Hobby) workspace includes only **5 GB of bandwidth a month**; extra is billed at $0.15/GB, plus 500 build minutes. One first visit transfers about 40 MB (living mouse 34 MB plus application files) and more if other references are opened, so the free allowance covers on the order of 100 first visits a month.
- Good as a backup host; poor as the primary host for a public teaching tool with unpredictable traffic.

## 5. Comparison

| | A1 Pages + R2 (Function) | A2 Pages + R2 (direct) | B GitHub Pages | C Render |
| --- | --- | --- | --- | --- |
| App source changes | none | substantial | none | none |
| Scientific asset changes | none | none | none | none |
| New services / accounts | R2 bucket, Function | R2 bucket, custom domain | none (settings only) | Render account |
| Complexity | medium | high | low | low |
| Ongoing maintenance | re-upload on upstream asset change | same plus CORS and domain | none beyond the workflow | none |
| Performance | Cloudflare CDN; Function hop on 3 paths (cacheable) | CDN via custom domain | Fastly CDN | Cloudflare-fronted CDN |
| Headers / CSP control | yes (`_headers`) | yes | no | yes |
| Rollback | Pages deployment history | same | redeploy a commit | redeploy |
| Cost at low traffic | about $0 (verify) | about $0 | $0 | $0 up to 5 GB, then $0.15/GB |
| Cost at high traffic | R2 egress free; Functions allowance | same | soft 100 GB cap | grows quickly |
| Risk | Function streaming, new part count | largest | lowest | bandwidth |

## 6. Questions in your list, answered

1. **Registry and loading architecture:** section 2.
2. **How each file is referenced:** by root-relative `assetUrl` plus bytes and SHA-256 in `atlas.json` or `sections.json`; the vascular values are repeated in `anatomy-coverage.ts`.
3. **Loading method:** `fetch` with a streamed reader into a `Uint8Array`. No `Blob`, no `arrayBuffer()` on the response.
4. **Gzip and checksum:** `.glb`/`.ply` unpacked by the app; `.json`/`.bin` rely on HTTP content-encoding; all checked against the registered size and SHA-256 after unpacking.
5. **R2 content types and headers:** yes, per object; via a Function you control every header.
6. **CORS:** not needed for A1 (same origin). Needed for A2, with the preview-origin problem noted above.
7. **Caching and ranges:** no range requests are used. The files are immutable by checksum, so a long immutable `Cache-Control` is safe; a changed file needs a new path or a purge.
8. **Configurable external base URL:** not present. A1 avoids needing one.
9. **Separate asset manifest:** not necessary. The existing registries already carry size and digest. A1 needs only a list of the three paths in the build command and the Function; A2 would need an explicit external list.
10. **Existing tests:** `tests/asset-fetch.test.ts` already injects a fake `fetch`, so a cross-origin or proxied response (including a pre-decoded gzip body) can be unit-tested without a browser. `tests/deployed-path.test.ts` covers base handling. `compress-models.test.ts` covers `build:host`. For deployed behaviour the existing `scripts/test_distribution.py` is designed for a local plain build and would not apply to a Function-backed site; a post-deploy check should fetch the three URLs and compare byte count and SHA-256 with the registry (a short script, no application change).

## 7. Recommended architecture and the changes it needs

**Target: Option A1 (Cloudflare Pages + R2 through a Pages Function), validated in a throwaway trial; fallback: Option B (GitHub Pages).**

If you approve implementation, the work would be, in order:
1. **Trial (no production impact).** In a throwaway Cloudflare Pages project and test bucket, confirm: the Function streams the three files within limits; the browser loads the living mouse, vascular reference and section images with no checksum error; whether the edge compresses the JSON; the R2 free tier does not require a payment method, or you accept one; and the real cost estimate. You would create the project and bucket (or approve my doing it).
2. **Build.** Pages build command: `npm ci && npm run build:host && rm -f dist/atlas-living/living-mouse.glb dist/atlas-vascular/schmid2021-mvn1-lines.json dist/atlas-volume/sections/cryosection-slices.bin`, output `dist`, `NODE_VERSION=22.23.4`.
3. **Repo additions (no change to existing source):** `functions/` handler, `_routes.json`, `_headers`, and a short upload and verification script under `scripts/` or `docs/`.
4. **R2.** One private bucket (suggested `drnd-mousebio-3d-assets`), three objects uploaded from the `build:host` output with correct content types, bucket bound to the Pages project as a binding.
5. **Verification.** Fetch each of the three URLs from the deployed site and compare size and SHA-256 with the registry; then browser-test the same paths as in `DRND_LOCAL_TEST_REPORT.md`.
6. **Upstream maintenance.** Add to `docs/DRND_UPSTREAM_MAINTENANCE.md`: if an upstream merge changes any of the three files or their registry entries, re-upload to R2 before deploying.

Decision for you:
- **Proceed with the A1 trial**, or
- **Use GitHub Pages first** (no code, immediate public preview at the github.io address, then move to Cloudflare later if wanted), or
- Ask for any other change to the design.

Not part of this proposal and untouched: re-encoding or splitting the three scientific assets (for example mesh compression), which would alter data and registries and needs its own approval.

## 8. Sources

- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- R2 public buckets: https://developers.cloudflare.com/r2/buckets/public-buckets/
- R2 CORS: https://developers.cloudflare.com/r2/buckets/cors/
- R2 as static asset storage with Pages: https://developers.cloudflare.com/pages/tutorials/use-r2-as-static-asset-storage-for-pages/
- Pages Functions routing and `_routes.json`: https://developers.cloudflare.com/pages/functions/routing/
- Workers pricing (shared by Pages Functions): https://developers.cloudflare.com/workers/platform/pricing/
- GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Render pricing and free plan: https://render.com/pricing and https://render.com/docs/free
