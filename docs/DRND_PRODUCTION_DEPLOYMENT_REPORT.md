# DrND Production Deployment Report

Running record of the external gates of `DRND_PRODUCTION_PLAN.md`. Each section is written when its gate completes.

## Gate A: push `drnd/production` to the fork (2026-11-10) - done

- Pushed `drnd/production` (`d084d30`, five commits above upstream `6cfa354`) to `origin` (`drnareshdumala-art/MouseBio_3D`). `main` was not pushed (it already equals `origin/main` and `upstream/main`).
- GitHub registered one workflow, `DrND validate`. Its first run on the pushed branch **passed every step** (install, type check, tests, `build:host`, R2 asset gate, registered-asset and publication checks).
- The inherited Pages workflow did not run; GitHub Pages is not enabled on the fork.

## Gate B: disable the inherited Pages workflow (2026-11-10) - nothing to disable

- `gh workflow disable Pages` reported that no workflow named Pages exists on the fork (GitHub registers an inherited workflow only after something triggers it). No GitHub setting was changed.
- Protection in place: Pages is not enabled on the fork; the inherited workflow triggers only on a push to `main` or manually; the copy on `drnd/production` is guarded by `if: github.repository == 'Qasim-Hussain-Code/MouseBio_3D'`.
- Follow-up recorded for `DRND_UPSTREAM_MAINTENANCE.md`: before the first push of the fork's `main`, either run `gh workflow disable Pages` as soon as GitHub registers it, or merge upstream into `drnd/production` from a local copy without pushing `main`.

## Gate C: production R2 bucket and asset synchronisation (2026-11-10) - done

Scope: create one private R2 bucket and upload the three registered assets under the content-addressed keys in the committed table. Nothing else was created or changed.

### Safeguards and how each was met

| # | Safeguard | Result |
| --- | --- | --- |
| 1 | Verify the Cloudflare account identity first | The logged-in `wrangler` account is the single account that owns the retained trial project and the existing `drndsknowledgehub` and `drnd-eduassess` Pages projects and the `drnd-knowledgehub` bucket. (The account identifier is intentionally not recorded in this repository.) |
| 2 | Confirm the bucket did not exist | The bucket list before the change held only `drnd-knowledgehub` and `drnd-mousebio-3d-assets-trial`. |
| 3 | Create only this one private bucket | `drnd-mousebio-3d-assets` created (Standard storage class, location APAC chosen automatically). `r2.dev` public access is disabled and no custom domain is attached. |
| 4 | Upload only the three approved assets under the committed keys | Before uploading, the keys and sizes computed from the build were compared with `deploy/cloudflare-pages/r2-assets.json`: all three identical. The sync then wrote a table that is byte-identical to the committed one, so the repository file did not change. |
| 5 | Do not overwrite, delete or modify existing objects | The bucket was new and empty; the sync only adds keys. No object was deleted or replaced. |
| 6 | Do not touch the trial bucket | Its entry is unchanged and it still holds its 3 objects (108 MB). |
| 7 | Do not modify `drnd-knowledgehub` or other buckets | Names and creation dates of the existing buckets are identical before and after. |
| 8 | Verify against the registry (byte counts and SHA-256) | See below. |
| 10 | No production Pages project, GitHub connection, DNS or deployment | None were done. |

### Bucket

| Item | Value |
| --- | --- |
| Name | `drnd-mousebio-3d-assets` |
| Access | private; `r2.dev` URL disabled; no custom domains |
| Created | 2026-11-10 |
| Binding name planned for Pages | `R2_ASSETS` (not yet created) |

### Objects (key = `<SHA-256 of the stored bytes>/<file name>`)

| URL path served by the Function | R2 key | Stored bytes | Registry bytes | Registry SHA-256 |
| --- | --- | --- | --- | --- |
| `/atlas-living/living-mouse.glb` | `dfdc3fd58f30aa1971fdc5410500f453699dac18fa8888bbc21a6972062bfbd0/living-mouse.glb` | 34,267,945 (gzip stream) | 50,891,580 | `28f094fee00e7bb3cb4a2e9ebaa2b972555cf60ee750efe24897f3c5052a3966` |
| `/atlas-vascular/schmid2021-mvn1-lines.json` | `8d9fb19e943a126562ab5a439d83590b5694d58b208f064a8140d556ed3e4652/schmid2021-mvn1-lines.json` | 38,356,364 | 38,356,364 | `8d9fb19e943a126562ab5a439d83590b5694d58b208f064a8140d556ed3e4652` |
| `/atlas-volume/sections/cryosection-slices.bin` | `4b095a416dad1e12063c227a07df0914f317331ae732c2bd8874a4bc045843e0/cryosection-slices.bin` | 35,654,474 | 35,654,474 | `4b095a416dad1e12063c227a07df0914f317331ae732c2bd8874a4bc045843e0` |

Total about 108 MB (103 MiB). Content type per object: `model/gltf-binary`, `application/json`, `application/octet-stream`.

### Verification (independent of the upload)

Each object was downloaded back from the production bucket with `wrangler r2 object get --remote` and checked:

| Object | Downloaded bytes = table `storedBytes` | SHA-256 of downloaded bytes = table `storedSha256` and key prefix | Result |
| --- | --- | --- | --- |
| living-mouse.glb | 34,267,945 | match | OK |
| schmid2021-mvn1-lines.json | 38,356,364 | match | OK |
| cryosection-slices.bin | 35,654,474 | match | OK |

Then `r2_assets.ts check --files` was run on the downloaded copies, which unpacks the gzip living mouse as the application does and compares byte count and SHA-256 with the registries in `public/`: **the three files match the registry** (living mouse 50,891,580 bytes, `28f094fe...`; vascular and cryosection identical to their stored bytes). The committed table was also confirmed consistent with the registries and `_routes.json`.

### Notes

- The bucket's own statistics (`object_count`, `bucket_size`) still read 0 shortly after the upload, while the downloads above prove the objects exist. Cloudflare updates bucket statistics periodically; re-read them before Gate D and record the figures here.
- The upload used the same bytes the trial used (the build is deterministic), so the production keys equal the keys in the table committed at `523e5bb`. No repository file changed during this gate.
- Rollback for this gate: delete the three objects, then the bucket (`wrangler r2 object delete ...`, `wrangler r2 bucket delete drnd-mousebio-3d-assets`). Not done.

## Gate D: Git-connected Pages project `drnd-mousebio-3d` (approved 2026-11-10) - waiting for the dashboard steps

The Git connection and the Cloudflare GitHub app authorisation can only be done in the Cloudflare dashboard, by you. Prerequisites checked on 2026-11-10: the project name `drnd-mousebio-3d` is free; the fork is public with Pages off; branches `main` and `drnd/production` exist on the fork; bucket statistics still read 0 (not yet refreshed).

**Order refinement (a deliberate change from plan section 4, step 6).** A Git-connected project builds its production branch the moment it is created, and an R2 binding can only be added afterwards. To avoid a live deployment whose three large routes return 503, the project is first created with production branch **`main`**. That first build is expected to **fail** (`main` does not contain `deploy/cloudflare-pages/prepare_dist.sh`), so nothing is published. The binding, variables and branch rules are then set; a `drnd/*` preview is verified; only then is the production branch switched to `drnd/production`.

Checklist for the dashboard (Workers and Pages, Create, Pages, Connect to Git):

1. Authorise the Cloudflare GitHub app for **only** the repository `drnareshdumala-art/MouseBio_3D` (choose "Only select repositories"). Read the permissions on the consent screen.
2. Project name `drnd-mousebio-3d`; production branch **`main`** (temporary).
3. Framework preset: None. Build command: `npm run build:host && deploy/cloudflare-pages/prepare_dist.sh dist /tmp/r2-stash`. Build output directory: `dist`. Root directory: leave empty.
4. Environment variable `NODE_VERSION` = `22.23.4` (plain text, production and preview).
5. Save and Deploy. The first build should fail at the missing script; expect no deployment.
6. Project Settings, Bindings: add an R2 bucket binding, variable name `R2_ASSETS`, bucket `drnd-mousebio-3d-assets`, for **both Production and Preview**.
7. Project Settings, Branch control: preview branches = custom, include `drnd/*`. Leave the production branch as `main` for now.
8. Confirm Web Analytics is off and no custom domain is attached.

After you tell me it is done, I verify read-only with `wrangler pages project list` and `wrangler pages deployment list`. Next steps, each needing approval: push a `drnd/staging` branch to create a preview deployment and verify it (`verify_assets.py` and the browser checks); then switch the production branch to `drnd/production` (dashboard) and push the one pending local commit to trigger the production build; then the rollback rehearsal.

## Next gate

Gate E: preview verification, then production deployment (see Gate D above).
