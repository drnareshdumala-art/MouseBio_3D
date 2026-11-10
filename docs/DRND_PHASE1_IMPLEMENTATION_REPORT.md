# DrND Phase 1 Implementation Report: Local Branch, Branding and Deployment Files

Production plan step 1 and step 2 (local branch preparation, reviewed local commits, local verification). Date: 2026-11-10.

**Nothing was pushed, no GitHub connection or setting was changed, no production Cloudflare resource was created, nothing was deployed.** The retained trial resources (`drnd-mousebio-3d-trial`, `drnd-mousebio-3d-assets-trial`) and the `drndsknowledgehub` and `drnd-eduassess` projects were not touched. The local R2 emulator was used for all R2 testing.

## 1. Branch and baseline

| Item | Result |
| --- | --- |
| `main` | Unchanged at `6cfa354`; equal to `origin/main` and `upstream/main` (re-fetched from upstream before branching: 0 ahead, 0 behind). |
| New branch | `drnd/production`, created from `main` at `6cfa354`. Not pushed. |
| Untracked documentation | All earlier reports verified present, then committed (commit 4). |
| Commit identity | Dr. Naresh Dumala, GitHub no-reply address. **No `Co-Authored-By` trailer** in any commit (D7). |

## 2. Commits on `drnd/production` (oldest first; run `git log main..drnd/production`)

| Commit | Content |
| --- | --- |
| `523e5bb` feat(deploy) | `functions/_middleware.js` (R2 Function), `deploy/cloudflare-pages/` (`r2-assets.json` mapping, `r2_assets.ts` sync and check tool, `prepare_dist.sh` build gate, `verify_assets.py`, `_routes.json`, `_headers`), `tests/r2-assets.test.ts`. |
| `c542037` ci | Upstream `pages.yml` guarded so it runs only in `Qasim-Hussain-Code/MouseBio_3D`; new `drnd-validate.yml`. |
| `4de4f49` feat(branding) | `src/platform-note.ts`, footer line in `src/App.tsx`, paragraph in `src/components/SourcesPage.tsx`, CSS in `src/components/Brand.css`, `index.html` metadata, README section, `tests/platform-note.test.ts`, one assertion in `tests/app.test.ts`. |
| `3216b5e` docs | The audit, local test, branding, R2 feasibility, R2 trial and production plan documents and the trial evidence file. |
| (this report) | `docs/DRND_PHASE1_IMPLEMENTATION_REPORT.md`. |

Changes versus `main`: 25 files, about 1,460 lines added, 2 removed. **Zero** files under `public/` or `data/`, and none of `LICENSE`, `LICENSES.md`, `THIRD_PARTY_NOTICES.txt`, registries, citations or scientific text differ from `main`.

## 3. What was implemented

### Branding (D3)
- Footer line below the 3D workspace: "MouseBio_3D – Hosted by DrND's KnowledgeHub – Virtual Biology Lab. Original application developed and maintained by Qasim Hussain." It is a separate element, not a child of the upstream status footer, so the upstream footer's layout rules are not disturbed. (The upstream status footer is hidden by the app in the layouts I tested; the note stays visible.)
- "Sources and evidence" dialog: the upstream sentence "MouseBio_3D is a digital laboratory mouse maintained by Qasim Hussain. ..." is unchanged; a highlighted paragraph follows it with the hosting statement, the original-developer statement, "DrND's KnowledgeHub did not develop the application", the licences pointer and a link to the upstream repository (a URL taken from the `upstream` remote).
- Browser title "MouseBio_3D | Digital mouse laboratory | Hosted by DrND's KnowledgeHub" and a meta description carrying the approved sentences.
- README: one appended section; upstream README text unchanged.
- **No KnowledgeHub URL appears anywhere.** A test asserts that none was introduced. The link remains pending your confirmation.

### R2 deployment files (D2, D4)
- `deploy/cloudflare-pages/r2-assets.json`: maps each of the three paths to a content-addressed key `<sha256 of stored bytes>/<file>` plus the registry size and digest it was synchronised against. Bucket name `drnd-mousebio-3d-assets`.
- `functions/_middleware.js`: serves only those three paths from the `R2_ASSETS` binding; checks the stored size; returns 503 (no binding), 404 (missing) or 502 (wrong size), all uncached; sets immutable cache, ETag, nosniff and content type on success; passes everything else through.
- `prepare_dist.sh` (build gate): the build fails unless the table matches the registries in `public/`, `_routes.json` lists exactly the three paths, and the files unpack to the registered bytes. It then moves the three files to a stash outside the repository and adds `_routes.json` and `_headers`.
- `r2_assets.ts sync`: uploads each object under its key (idempotent, never overwrites different content, never deletes), then rewrites the table. `--local` uses the emulator; `--remote` uses the logged-in wrangler. **The remote mode has not been run.**
- Pages build command (for the later dashboard step): `npm run build:host && deploy/cloudflare-pages/prepare_dist.sh dist /tmp/r2-stash`.

### Workflows (D5, modified)
- `pages.yml` (upstream deployment): each job has `if: github.repository == 'Qasim-Hussain-Code/MouseBio_3D'`. Otherwise unchanged.
- `drnd-validate.yml`: runs on pushes to `drnd/**`, on pull requests to `main` or `drnd/production`, and manually. Steps: `npm ci`, `check`, `test`, `build:host`, the R2 asset gate, the registered-anatomy and publication tests. Read-only permissions, no secrets, no deployment, actions pinned to the upstream SHAs. It has been YAML-parsed here but **has not run on GitHub**.
- **Remaining step at Gate B (not done):** GitHub runs a workflow from the pushed branch's own copy, and `main` (the upstream mirror) keeps the unguarded `pages.yml`. When `main` is later updated from upstream, that copy would run. So the inherited workflow must also be disabled by name in the fork: `gh workflow disable Pages`. GitHub Actions as a whole stays enabled so `drnd-validate.yml` can run.

## 4. Test results (all local)

| Check | Result |
| --- | --- |
| `npm run check` (tsc) | Pass. |
| `npm run test` (complete suite) | **689 of 689 pass** (676 upstream-suite tests plus 13 new: 5 platform-note, 8 R2 mapping, gate and Function). 0 fail, 0 skipped. |
| `npm run build:host` | Pass. 190.1 MiB; 28 models gzipped from 194.5 MB to 81.3 MB; notices check passes. |
| Build gate, normal | Pass. Bundle after `prepare_dist.sh`: 103 files, **0 over 25 MiB**. |
| Build gate, tampered table | Fails as designed (exit 1) and leaves the bundle untouched. |
| `check_publication.py --tracked` | 0 errors, 0 warnings (informational synthetic fixtures only). It first found one real problem in my own documentation, a local user-home path in the audit report; I removed it and amended the unpushed docs commit. |
| History scan (`--tracked --include-history`) | 2 errors, both about **one upstream commit** (`063d6cc` "update_readme", an ancestor of `main`) whose author address is not a GitHub no-reply address. It is part of the upstream repository's existing public history, predates this work, and is not in any DrND commit; all four DrND commits use the no-reply identity. I did not rewrite upstream history (the fork must keep it intact for upstream tracking). Noted for your awareness only. Tracked content (the working tree) is clean. |
| `test_publication.py`, `test_registered_anatomy.py` | Pass (13 and 15 tests). |
| Scientific assets and licences vs `main` | 0 files changed. |

### Browser (production-style: Pages emulator with the Function and emulated R2)
- Living mouse loaded through the Function: 434 meshes, 2,331,092 triangles. Vascular reference and the cryosection cut face also loaded through it (34.3 MB, 38.4 MB decoded and 35.7 MB). No console errors or alerts.
- Title, meta description, footer line and dialog statement present and correct. In the 562 px compact layout the note wraps to two lines at the bottom and overlaps nothing; at 1280 px it is a single line inside the viewport.

## 5. R2 synchronisation and rollback verification (local emulator only)

Three versions of the asset table were served against one emulated bucket, and each was checked against the registry with `verify_assets.py`:

| Case | Result |
| --- | --- |
| v1: the committed table | 6 of 6 OK |
| v2: a new living-mouse object (same unpacked bytes, different gzip level) synchronised under a **new key**, table updated | 6 of 6 OK; the v1 object still exists |
| v3: a table whose vascular key points to a same-size object with one byte changed | **Fails closed**: the vascular checks report FAIL, the other four pass |
| Rollback: serve the v1 table again after v2 and v3 were written | 6 of 6 OK; the original objects were untouched |

This demonstrates that (a) sync adds new keys without disturbing old ones, (b) a deployment carrying an older table keeps working after newer assets exist, and (c) a wrong object is caught by the registry check rather than shown. It does not test the Cloudflare dashboard rollback itself, which needs a Git-connected production project; the plan schedules that rehearsal after the first production deployment.

## 6. Not done and not verified

- The `drnd-validate.yml` workflow has not run on GitHub.
- The remote sync mode, the Git-connected Pages project, the dashboard R2 binding, the Cloudflare GitHub authorisation, preview-branch rules and the dashboard rollback rehearsal.
- Real Cloudflare build time, and Cloudflare's own build with these commands (the build image default Node is documented as 22.23.4, matching `NODE_VERSION`; confirm in the first build log).
- Mobile devices and performance measurement (Phase 5).
- The KnowledgeHub link (pending your URL) and the KnowledgeHub landing page (Phase 6).

## 7. Review guide and next gates

Review with:

```bash
git log --stat main..drnd/production
git diff main..drnd/production -- src index.html README.md .github
```

Next external actions, each needing your explicit approval (plan section 4): Gate A push of `drnd/production` (fork only); Gate B `gh workflow disable Pages`; Gate C create bucket `drnd-mousebio-3d-assets` and run `r2_assets.ts sync --remote`; Gate D create the Git-connected Pages project (you, in the dashboard); preview verification; Gate E production deployment and rollback rehearsal.

One decision for the sync step: the committed table already points at objects whose bytes came from this build; the remote sync will upload exactly those bytes (same keys), so no table change is expected.
