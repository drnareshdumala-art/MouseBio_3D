# DrND R2 Trial Report (Pages Function + R2)

Trial of option A1 from `DRND_R2_FEASIBILITY.md`. Date: 2026-11-10. Commit tested: `6cfa354`.

**Status: the local trial passed (sections 1 to 4) and the remote trial passed (section 7).** Remote resources created on the account for the trial: R2 bucket `drnd-mousebio-3d-assets-trial` and Pages project `drnd-mousebio-3d-trial` (one deployment). Nothing was committed or pushed, no GitHub connection or DNS was configured, and the account's existing projects and bucket were not touched. The only repository changes are new untracked files: `functions/_middleware.js`, `deploy/cloudflare-pages/*` and the `docs/DRND_*.md` documents. No existing file, dependency, data file or scientific asset was modified.

## Reference environment (retained by your decision, 2026-11-10)

| Item | Value |
| --- | --- |
| Cloudflare Pages project | `drnd-mousebio-3d-trial` (direct upload; no Git provider) |
| Live URL | https://drnd-mousebio-3d-trial.pages.dev |
| Deployment | `6c99ff02-ffab-4811-8d17-41bcf7070ba1` (https://6c99ff02.drnd-mousebio-3d-trial.pages.dev) |
| R2 bucket | `drnd-mousebio-3d-assets-trial` (private; binding `R2_ASSETS`; no public access, no r2.dev, no custom domain) |
| Source | commit `6cfa354` (identical to upstream `main`) plus the untracked `functions/` and `deploy/` files described below; no branding |
| Verification evidence | `docs/evidence/r2-trial-2026-11-10.txt` (timestamped registry check 6 of 6, uploaded-object digests, response headers) and section 7 of this report |

Rules for this environment: it is a reference only. Do not delete it, connect it to GitHub, attach a domain, redeploy it or upload other objects to it without approval. Do not modify the `drndsknowledgehub` or `drnd-eduassess` projects. Direct-upload Pages projects cannot be switched to Git integration, so production will be a separate, new project (see `DRND_PRODUCTION_PLAN.md`).

## 1. What was tested

Cloudflare's own `wrangler pages dev` (wrangler 4.160.0, installed in a scratch folder outside the repository, not added to `package.json`) ran the real `build:host` output as a Pages site with a local, emulated R2 bucket. The emulator runs entirely on this machine and needs no account. Setup:

- Site folder: the `build:host` bundle with the three oversized files removed: 102 files, 86.8 MiB, **0 files over 25 MiB**.
- Local R2 bucket holding the three removed files, byte-for-byte as built (living mouse as the 34.3 MB gzip stream), uploaded with the content types `model/gltf-binary`, `application/json` and `application/octet-stream`.
- `functions/_middleware.js`: answers GET and HEAD for exactly those three paths from the R2 binding `R2_ASSETS`, sets `Content-Type`, `ETag`, `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff` and, when not encoded, `Content-Length`; honours `If-None-Match` with a 304; passes every other request to the static site.
- `_routes.json`: limits the Function to those three paths so all other requests stay plain static requests.

## 2. Results

| Check | Result |
| --- | --- |
| Static site under the Pages file limit | Pass. 0 of 102 files over 25 MiB. |
| Function serves the three paths | Pass. 200 with the headers above; a neighbouring file (`ct-deflate.bin`) is still served statically with its own headers. |
| Byte count and SHA-256 against the registry | Pass for all three, with `Accept-Encoding: identity` and `gzip`. The living mouse is a gzip stream that the app unpacks (checked after unpacking). |
| Real application, default view | Pass. Living mouse loaded through the Function: 434 meshes, 2,331,092 triangles (the registered values), 34,267,945 bytes transferred, no console errors. |
| Real application, vascular reference | Pass. Loaded 575,722 source points and 563,651 segments (the registered values). 38,356,364 bytes decoded, 4,309,059 bytes on the wire (the local emulator gzipped the JSON). |
| Real application, section images | Pass. Choosing the volume reference with a section axis and the "Specimen photograph" cut-face image fetched `cryosection-slices.bin` (35,654,474 bytes, identical to the registry) and rendered the source photograph with its caption; no error or alert. |
| `redirect: 'error'` / same-origin loader | Satisfied without change, because the Function answers 200 on the same origin. |
| Verification script | `deploy/cloudflare-pages/verify_assets.py` passed 6 of 6 checks against the local server. |
| `prepare_dist.sh` | Tested on a copy of `dist/`: moved the three files to a stash folder, added `_routes.json` and `_headers`, leaving 103 files, none over 25 MiB. |

### What the local trial does not prove
- **Production edge behaviour.** The local emulator is not Cloudflare's network. In particular, it gzipped the JSON response when the browser asked for gzip, while it did not compress the `.glb` or `.bin` (already compressed data). Whether the real edge compresses a Function response, and how fast it serves 35 MB bodies, must be measured on a deployed trial.
- **Failure behaviour was not re-tested live.** A stale or wrong object being rejected is covered by existing unit tests in `tests/asset-fetch.test.ts` ("a compressed body whose content differs from the registry is refused" and similar), not by a new live test.
- **R2 account requirements** (billing details on file, bucket region) and **Cloudflare Functions quotas** in practice.
- Mobile browsers and real-world latency.

## 3. Files added (untracked; not committed)

| File | Purpose |
| --- | --- |
| `functions/_middleware.js` | The R2-backed Pages Function (about 25 lines). Cloudflare requires the folder at the project root. |
| `deploy/cloudflare-pages/_routes.json` | Restricts the Function to the three paths. Copied into `dist/` by `prepare_dist.sh`. |
| `deploy/cloudflare-pages/_headers` | Security and cache headers for static files, mirroring `render.yaml`. Not applied to Function responses. |
| `deploy/cloudflare-pages/prepare_dist.sh` | After `build:host`: moves the three files to a stash folder, adds the two files above. |
| `deploy/cloudflare-pages/verify_assets.py` | Read-only check of a deployed (or local) site: fetches the three assets and compares size and SHA-256 with the registry. |

Because these files are untracked, `scripts/prepare_release.py` (which requires no unreviewed non-ignored files) would refuse to run until they are committed or removed. This does not affect the website build or tests.

## 4. Build command for the real project

```bash
npm ci && npm run build:host && deploy/cloudflare-pages/prepare_dist.sh dist /tmp/r2-stash
```

Output directory `dist`, `NODE_VERSION` 22.23.4. The stash folder (`/tmp/r2-stash`, outside the repository) holds the three files for upload and is not deployed. (The trial itself used a K1 path-keyed Function; production uses the content-addressed K2 design in `DRND_PRODUCTION_PLAN.md`.)

The R2 objects must be uploaded **from the same `build:host` output** that the site was built from (the stash), because the living-mouse object is the gzip variant. Uploading the plain file would also pass the app's checks but would transfer 50.9 MB instead of 34.3 MB.

## 5. Remote trial: what is needed and what I would do

I cannot sign in to Cloudflare for you and I will not handle your credentials. The steps below create resources on your account, so I will run them only after you sign in and say so.

**You do:**
1. In a terminal tab, run `wrangler login` and approve the browser sign-in. (A global `wrangler` is installed on this machine.)
2. Confirm R2 is enabled on the account. Cloudflare may ask for billing details even for the free tier **(to verify)**; adding a payment method is your decision.
3. Confirm the names: bucket `drnd-mousebio-3d-assets-trial` and Pages project `drnd-mousebio-3d-trial`, so the trial never touches the planned production name `drnd-mousebio-3d`.

**I then run, from the repository root (all reversible: delete the project and the bucket afterwards):**
1. `wrangler r2 bucket create drnd-mousebio-3d-assets-trial`
2. Build with the command in section 4, then upload the three stashed files with `wrangler r2 object put ... --content-type ...`.
3. `wrangler pages project create drnd-mousebio-3d-trial --production-branch main`, bind the bucket as `R2_ASSETS`, then `wrangler pages deploy dist --project-name drnd-mousebio-3d-trial` (direct upload, no GitHub connection, no DNS).
4. Run `verify_assets.py https://drnd-mousebio-3d-trial.pages.dev`, then browser-test the three assets and the headers, and measure transfer sizes and timings.
5. Report results here, with the real behaviour of compression and streaming.
6. Delete the trial project and bucket, unless you want to keep them.

Not part of the trial: no GitHub connection, no custom domain, no production project, no push.

## 6. Recommendation

The design works with no change to the application, the registries or any scientific asset, both locally and on Cloudflare (section 7). I recommend adopting it for the production project, subject to the open points in section 8. GitHub Pages remains the no-change fallback described in `DRND_R2_FEASIBILITY.md`.

## 7. Remote trial results (2026-11-10)

Account: one Cloudflare account, signed in with wrangler OAuth (credentials stored by wrangler, never seen or repeated by me). R2 was already enabled on the account (it already held an unrelated bucket), so no billing step was needed for the trial; whether R2 would require billing details on a brand-new account remains unverified.

What was created:
- R2 bucket `drnd-mousebio-3d-assets-trial` with three objects uploaded from the `build:host` output (living mouse as the 34,267,945-byte gzip stream, the vascular JSON and the cryosection stream as built), with content types set.
- Pages project `drnd-mousebio-3d-trial` (direct upload, no Git provider), one production deployment (`6c99ff02`) of 101 static files plus the Function bundle, `_headers` and `_routes.json`, with the bucket bound as `R2_ASSETS`.
- URLs: `https://drnd-mousebio-3d-trial.pages.dev` and `https://6c99ff02.drnd-mousebio-3d-trial.pages.dev`.

| Check | Result |
| --- | --- |
| Pages accepted the bundle | Pass. 101 files uploaded, none over 25 MiB, Function bundle compiled and uploaded. |
| `verify_assets.py` on the production alias | **Pass, 6 of 6.** Size and SHA-256 of all three assets match the registry, with and without `Accept-Encoding: gzip`. |
| `verify_assets.py` on the preview URL | Pass (the first attempt failed only because the new certificate was not yet ready). |
| Real app, default view | Pass. 434 meshes, 2,331,092 triangles; no console errors. The 34.3 MB model took about 7 s to download in the browser from this machine, then parsed. |
| Real app, vascular reference | Pass. 575,722 points, 563,651 segments. 38,356,364 bytes decoded, **2,807,756 bytes on the wire**. |
| Real app, section images | Pass. Cryosection stream (35,654,474 bytes, 6.5 s) and labels loaded, the cut-face photograph rendered, no alerts or errors. |
| Response headers from the Function | `Content-Type`, `Cache-Control: public, max-age=31536000, immutable`, `ETag`, `X-Content-Type-Options: nosniff`, `Content-Length` (when not encoded). |
| Conditional request | Pass. `If-None-Match` with the object's ETag returns 304. |
| HEAD request | Pass. 200 with the correct `Content-Length`. |
| Static files | `_headers` applied: `cache-control: public, max-age=31536000, immutable` and `x-content-type-options: nosniff` on `/assets/*`; root page carries `referrer-policy: strict-origin-when-cross-origin`. |

Findings:
1. **The real edge does compress the JSON** (gzip, about 2.8 to 3.8 MB on the wire depending on the request; weak ETag). The `.glb` (already gzip) and `.bin` (already deflated) are sent as stored. So the three files cost roughly 34 + 3 + 36 MB on the wire, with the vascular file being cheap. Browsers decode the JSON transparently, and the app's checksum runs on the decoded bytes, as designed.
2. **Cloudflare returned 403 to the default `Python-urllib` User-Agent**, while browsers and curl are fine. `verify_assets.py` now sends the plain client name `mousebio-asset-verify/1.0`. This is a property of Cloudflare's edge, not of the site.
3. **Unknown paths return the app's HTML with status 200** (the standard Pages single-page fallback), the same as the upstream static host would. A missing R2 object under the three Function routes returns 404.
4. **Speed:** one curl download of the living mouse took 8.1 s at about 4.2 MB/s. That reflects this machine's connection and is not a performance measurement; Phase 5 should measure properly.
5. Not tested remotely: mobile browsers, a cold cache from another region, behaviour under load, the stale-object failure live (covered by unit tests), and Functions quota behaviour over time.

## 8. Open points before production

1. **Cleanup choice.** The trial project and bucket still exist. They cost nothing at this size but should be deleted if you do not want to keep them (`wrangler pages project delete drnd-mousebio-3d-trial` and `wrangler r2 bucket delete drnd-mousebio-3d-assets-trial` after emptying it). I have not deleted anything.
2. **Production names.** Planned: Pages project `drnd-mousebio-3d` and bucket `drnd-mousebio-3d-assets`. Your account already has `drndsknowledgehub` (with a custom domain) and `drnd-eduassess`; both were left untouched.
3. **Git-connected deployment.** The trial used direct upload from a local build. A GitHub-connected project needs `functions/` and the build command from section 4 in the repository, the R2 binding added in the project's settings (a Cloudflare setting you must approve), and the three objects uploaded from a `build:host` output of the exact commit.
4. **Upstream changes.** If a future upstream merge changes any of the three assets or their registry entries, re-upload the matching objects before deploying. The app refuses mismatched files, so a stale object produces a visible error rather than wrong anatomy.
5. **Committing the new files** (`functions/`, `deploy/`, docs) is yours to approve.
