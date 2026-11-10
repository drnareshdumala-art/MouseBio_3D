# DrND Deployment Audit: MouseBio_3D

Phase 1 (read-only repository audit). Audit date: 2026-11-10.
Scope: inspection only. No source file was modified, no dependency was installed, and nothing was built, committed or pushed. The only changes to the working tree are this report and the initial clone.

## 1. Repository identity

| Item | Finding |
| --- | --- |
| Local path | repository root of the local clone (an empty directory when cloned on 2026-11-10) |
| `origin` | `https://github.com/drnareshdumala-art/MouseBio_3D.git` (fork) |
| `upstream` | `https://github.com/Qasim-Hussain-Code/MouseBio_3D.git` (original) |
| Branch | `main`, tracking `origin/main`, clean working tree |
| Head | `6cfa354` "publish_pages_hosting" |
| Fork vs upstream | `main` is identical to `upstream/main` (0 ahead, 0 behind) |
| History | 44 commits, all by Qasim Hussain (`Qasim-Hussain-Code`, GitHub no-reply address); 34 tags (`v0.x`) |
| Application version | `package.json` 0.43.0 (the newest tag is older than the package version) |
| Size | about 303 MB working tree, about 253 MB `.git`; `public/` holds 87 files, 296 MiB |

Conclusion: the repository is the fork, the upstream relationship is preserved, and attribution in history is intact. Not verified from here: whether the fork is public or private, and whether GitHub Pages or Actions are enabled on it (see risk R6).

## 2. Framework and versions

All dependencies are pinned exactly (`.npmrc`: `save-exact=true`), and `package-lock.json` resolves every package from `registry.npmjs.org` (128 entries). Two packages declare install scripts: `esbuild` and `fsevents` (the usual binary-fetch scripts).

| Component | Version |
| --- | --- |
| React / React DOM | 19.3.1 |
| Three.js | 0.186.1 (`@types/three` 0.186.0) |
| Vite | 8.3.5 (`@vitejs/plugin-react` 6.1.2) |
| TypeScript | 7.0.2 |
| Test tooling | `tsx` 4.23.15 (`node:test`), `happy-dom` 21.0.4, `@testing-library/react` 16.3.3 |
| Node engine | `>=22.12.0`; CI and Render pin 22.23.4; installed here v22.23.1, npm 10.9.8 |
| Python | 3.12.3 available (needed only for the validation scripts) |

Runtime dependencies are only `react`, `react-dom` and `three`. No UI, state, routing or network library is present. Versions were read from `package.json` and the lockfile; they have not been installed or confirmed against the registry. The versions are newer than I can independently vouch for, so `npm ci` in Phase 2 is the real test.

## 3. Build configuration

### Scripts (read from `package.json` and the script sources)

| Command | What it does | Notes |
| --- | --- | --- |
| `npm run dev` | `vite --host 127.0.0.1` | Strict port. |
| `npm run build` | `third_party_notices.mjs --check` then `tsc --noEmit` then `vite build` | Needs `node_modules` (the notice check reads the licence files of react, react-dom, scheduler and three). Output `dist/` with **uncompressed** models. |
| `npm run build:host` | `npm run build` then `tsx scripts/compress_models.ts dist` | The **production command for a static host**. Gzips registered GLB/PLY files in `dist/` only after checking byte count and SHA-256 against the registry; the app unpacks and re-verifies them in the browser. |
| `npm run test` | `tsx --test` over 86 files in `tests/` | |
| `npm run check` | `tsc --noEmit` | |
| `npm run validate:geometry` | `python3 scripts/test_geometry.py` | |
| `npm run resources` | `python3 scripts/resource_usage.py` | Standard library only, read-only accounting; its output includes local paths and machine details, so keep it local. |
| `npm run notices` | Regenerates `public/THIRD_PARTY_NOTICES.txt` | Writes a tracked file; do not run casually. |

Corrections to the brief:
- There is **no `npm run validate`**. The nearest are `npm run validate:geometry` and `bash scripts/validate_all.sh` (runs `npm test`, `npm run build`, then about 20 Python checks, including `check_publication.py` and `resource_usage.py`).
- `npm run build` appears twice in the brief. The meaningful pair is `build` and `build:host`.
- **Recommended production command: `npm run build:host`.** It is what the upstream GitHub Pages workflow and `render.yaml` use.

### `vite.config.ts`

- `MOUSEBIO_BASE` defaults to `/`, so a Cloudflare Pages root deployment needs no variable. The value is validated by a regular expression and must be an absolute path ending in `/`.
- The GitHub Pages workflow sets `MOUSEBIO_BASE=/MouseBio_3D/`. Do not copy that into Cloudflare.
- A small plugin copies `scripts/serve_prototype.py` into `dist/`. It is harmless but ships a Python file in the site.
- App code resolves asset URLs through `deployedPath()`. The following spots use root-absolute paths instead and would break only under a subpath (they are fine at a root deployment): `index.html` favicon, the `/models/bondarenko-apical/…` links in `src/components/CardiacCellPanel.tsx`, and constants such as `SECTION_IMAGES_URL`, `NUCLEOSOME_URL` and `HEMOGLOBIN_URL`. Several are also checked against exact strings by validators, so avoid editing them.

### Existing deployment configuration

- `.github/workflows/pages.yml` builds with Node 22.23.4 and `build:host`, then deploys to GitHub Pages. Actions are pinned to commit SHAs, and permissions are minimal. It runs on every push to `main` and on manual dispatch.
- `render.yaml` defines a static site on Render with security and cache headers (`nosniff`, `Referrer-Policy`, immutable cache for `/assets/*`).
- There is no Cloudflare configuration and no `_headers` or `_redirects` file.

## 4. Static assets and 3D model loading

- All data are static files fetched from the same origin. The application has no server component.
- Models are loaded through a checked loader (`src/viewer/asset-fetch.ts`), which detects gzip, expands with `DecompressionStream`, and compares size and SHA-256 with the registry. A browser without `DecompressionStream` is reported as an error rather than silently skipping the check.
- The section images use their own pre-deflated streams (`cryosection-slices.bin`, `ct-deflate.bin`), expanded with `DecompressionStream('deflate-raw')`.
- `scripts/compress_models.ts` compresses only registered `.glb` and `.ply` files. It does **not** touch the vascular JSON or the `.bin` section streams.

### Files above 25 MiB (as committed) and expected size after `build:host`

Gzip-9 measurements taken on copies of the files, as an estimate. The real build output is verified in Phase 2.

| File | Committed | After `build:host` (estimate) |
| --- | --- | --- |
| `atlas-living/living-mouse.glb` | 48.5 MiB | about 31.2 MiB (still over 25 MiB) |
| `atlas-vascular/schmid2021-mvn1-lines.json` | 36.6 MiB | **36.6 MiB**, not handled by the script (a gzip would be about 3.7 MiB) |
| `atlas-volume/sections/cryosection-slices.bin` | 34.0 MiB | **34.0 MiB**, already deflated (no gain from gzip) |
| `atlas-microct/rosenhain2018-m01.glb` | 28.8 MiB | about 6.7 MiB |
| `atlas-volume/digimouse-volume-040.glb` | 26.4 MiB | about 6.8 MiB |

## 5. Licence and attribution requirements

| Material | Licence | Obligation |
| --- | --- | --- |
| Application code, scripts, tests | MIT, copyright 2026 Qasim Hussain | Keep `LICENSE` and the copyright notice. |
| Original documentation | CC BY 4.0 | Attribute Qasim Hussain, MouseBio_3D; indicate changes. |
| Digimouse geometry, living mouse, volume surfaces, section images, ontology table | CC BY-SA 4.0 | Attribute Dogdas et al. (2007); mark modifications; **ShareAlike** applies to adaptations. |
| EMA147, hindlimb (Charles 2016), NeuroMorpho NMO_130632, MVN1 vascular | CC BY 4.0 | Keep source authors, licence and a description of the modifications. |
| Micro-CT (Rosenhain 2018) | Dataset CC0 1.0, article CC BY 4.0 | Keep the author attribution. |
| MouseMapper nerve graph | Apache-2.0 | Keep the licence text and notices. |
| Bondarenko 2004 cell model | CC BY 3.0 | Keep the attribution and the disclosure of the optional substitution. |
| 26 PDB entries | CC0 1.0 | Attribution to the structure authors is encouraged. |
| npm packages | Per package | Keep `public/THIRD_PARTY_NOTICES.txt`, which `npm run build` checks against the installed versions. |

Additional obligations and notes:
- Each `public/atlas-*/LICENSE.md` and `public/models/bondarenko-apical/LICENSE.md` must be shipped unchanged. `docs/privacy-and-publication.md` states that attribution must not be removed during publication hygiene.
- The README names Qasim Hussain as the sole owner and maintainer. The planned DrND branding must therefore state "Original application developed by Qasim Hussain" and must not claim authorship. The same document asks that no automated system be added as author or co-author, so any commit to this repository should follow that rule (see risk R8).
- The Hindlimb decoding tool carries a separate AGPL-3.0-or-later licence and is stated as **not bundled** with the application. Do not add it to the deployment.
- The living mouse and its derivatives are CC BY-SA. Redistribution through Cloudflare is permitted, but any modified model or dataset we publish must keep the same licence.

## 6. Security and privacy findings

- **Network calls.** The source contains `fetch()` calls only for same-origin assets (`deployedPath(...)`). There is no `XMLHttpRequest`, `WebSocket` or `sendBeacon`. The only external URLs are `https://doi.org/...`, openstax.org, PubMed and similar citation links, opened by the user in a new tab with `rel="noreferrer"`. No CDN scripts, fonts or analytics.
- **Browser storage.** No use of `localStorage`, `sessionStorage`, `indexedDB` or cookies was found in `src/`. Imported CSV/JSON/SWC data stay in memory, matching the README and the privacy statement in `SourcesPage.tsx`. Import limits: 5 MiB and 20,000 rows for CSV/JSON; 2 MiB and 100,000 samples for SWC.
- **Credentials.** A keyword search for key, secret, token and password assignments found only false positives (for example "tokens" for flow particles and `id-token` in the workflow permissions). `.gitignore` excludes `.env*`, `research-data/` and `data/raw/`. A full secret scan of the git history was not run; the repository ships `scripts/check_publication.py`, which can do this in Phase 2.
- **Supply chain.** All packages come from the official registry, with exact versions and a lockfile. Run `npm ci` rather than `npm install`. Two packages have install scripts (esbuild, fsevents). `npm audit` has not been run, because it sends the dependency list to the registry; I will run it in Phase 2 with your approval.
- **Headers.** The deployment relies on `render.yaml` for security headers. No Content-Security-Policy is defined anywhere. A Cloudflare `_headers` file would be needed to match the Render settings (`nosniff`, referrer policy, immutable caching). A CSP would need testing against WebGL, workers and `DecompressionStream`.
- **Git identity.** All commits use the GitHub no-reply address. Nothing private was observed in the tracked content I inspected, but I did not run the publication checker.
- **Scientific scope.** The docs say clearly that the living mouse is a constructed model, simulated parts are marked as such, and the tutorials do not replace supervised training or an approved animal protocol. The deployment must keep those statements visible.

## 7. Potential deployment problems and risks

| ID | Severity | Risk |
| --- | --- | --- |
| R1 | **High** | **Cloudflare Pages limits each static file to 25 MiB** (to be re-confirmed against current Cloudflare documentation at the start of Phase 4). After `build:host`, three files remain over that limit: `living-mouse.glb` (about 31 MiB), `schmid2021-mvn1-lines.json` (36.6 MiB) and `cryosection-slices.bin` (34 MiB). The deployment would fail or be incomplete. |
| R2 | Medium | The obvious remedies each change something that your rules protect: (a) extend `compress_models.ts` to gzip the vascular JSON, which needs a loader change and checksum registry changes; (b) re-split or re-encode the living mouse and section streams, which changes scientific assets and needs your approval; (c) host the three large files elsewhere, for example Cloudflare R2, which adds a second service and cross-origin configuration; (d) choose another static host. GitHub Pages (already configured, 100 MB file limit) and Render (already configured) both fit the files as they are. Options are for you to decide, and no change was made. |
| R3 | Medium | `npm run build` alone does not compress models. The full bundle is about 300 MB. Using the wrong command would deploy the large uncompressed set and will also fail R1. Use `build:host`. |
| R4 | Medium | The fork's `pages.yml` will run on every push to `main`. If GitHub Pages is enabled on the fork it would publish a second copy under `/MouseBio_3D/`, which is harmless but unintended. If it is not enabled the job fails and the fork shows a red check. Decide whether to keep, disable or leave it before the first push. |
| R5 | Low | No `_headers` file, so Cloudflare would send no security or cache headers until one is added. The immutable cache rule for `/assets/*` is worth reproducing. |
| R6 | Low | I could not confirm from here whether the fork is public, whether Actions or Pages are enabled, or what Cloudflare account and Git integration permissions exist. |
| R7 | Low | `dist/serve_prototype.py` is published with the site. It is inert on a static host. |
| R8 | Low | The upstream privacy document asks that automated systems not be added as commit authors or co-authors. Commits made in this repository should use your identity only, without co-author trailers. |
| R9 | Low | Package and tool versions (for example TypeScript 7.0.2) are as written in the lockfile and were not exercised. A failure in `npm ci`, `tsc` or the tests would appear in Phase 2. |
| R10 | Info | Browser requirements: WebGL2 and `DecompressionStream`. Older mobile browsers could fail on the checked loader. |

## 8. Existing tests and validation

- 86 TypeScript test files under `tests/` (node:test through `tsx`): anatomy coverage and groups, asset fetch and checksums, compression, import parsers, dissection lab, scale journey, cardiac and cable models, view state and others.
- About 19 Python validators in `scripts/test_*.py` for geometry, registered anatomy, publication hygiene, the cell model and the local launcher. All use the standard library only.
- No browser or end-to-end tests, and no screenshots in CI. The workflow does not run the tests, only the build. Visual behaviour (rotation, layers, the dissection bench, tutorials, imports) can only be confirmed by browser testing in Phase 2.
- None of these commands has been run yet.

## 9. Recommended next actions

1. Approve Phase 2 (read-only local verification): `npm ci`, `npm run check`, `npm run test`, `npm run build:host`, the Python validators and `npm run resources`, plus browser testing of the application, with results in `docs/DRND_LOCAL_TEST_REPORT.md`. This installs dependencies into `node_modules/`, which is ignored by git, and writes `dist/` and `.npm-cache/`, which are also ignored.
2. Before Phase 4, decide how to handle R1/R2. My recommendation is to confirm the real post-build sizes in Phase 2, then choose between (a) hosting on a platform that already accepts these files (GitHub Pages or Render, both already configured by upstream) and (b) a minimal, reviewed change to the build so that the three oversized files fit, or an R2 bucket. I would not alter the scientific assets without your approval.
3. Decide the fate of the fork's `pages.yml` (R4) before any push.
4. Keep the Phase 3 branding to the proposed minimal treatment, with the original developer credited first.
5. Do not push, connect Cloudflare or change any external configuration until you approve each step.

## 10. Items not verified in this audit

- Whether any dependency has a known vulnerability (`npm audit` not run).
- The real size of `dist/` and whether `build:host` and the checksum verification succeed.
- Whether the viewer works in a browser, on mobile, or under the Cloudflare edge.
- The Cloudflare Pages file-size, file-count and Node-version limits at the time of deployment (to be re-checked against current documentation in Phase 4).
- Fork visibility and GitHub settings.
