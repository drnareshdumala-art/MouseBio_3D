# DrND Production Implementation Plan: MouseBio_3D on Cloudflare Pages + R2

Plan. Step 1 and step 2 (local branch, commits and local verification) are implemented; see `DRND_PHASE1_IMPLEMENTATION_REPORT.md`. No production resource exists, nothing is pushed, and no existing KnowledgeHub or EduAssess project is touched. Date: 2026-11-10. Baseline: commit `6cfa354` (identical to upstream `main`).

Inputs: `DRND_DEPLOYMENT_AUDIT.md`, `DRND_LOCAL_TEST_REPORT.md`, `DRND_BRANDING_PROPOSAL.md`, `DRND_R2_FEASIBILITY.md`, `DRND_R2_TRIAL_REPORT.md` and `docs/evidence/r2-trial-2026-11-10.txt`.

## 1. Starting point

- Verified in the local and remote trials: the application runs unchanged; three assets over 25 MiB are served from a private R2 bucket by a small Pages Function on the same origin; byte counts and SHA-256 match the registry; the real app loads all three on Cloudflare.
- Reference environment, retained and **not** to be reused for production: Pages project `drnd-mousebio-3d-trial` (https://drnd-mousebio-3d-trial.pages.dev, direct upload) and R2 bucket `drnd-mousebio-3d-assets-trial`.
- Production must be a **new Git-connected** Pages project, because Cloudflare does not allow a direct-upload project to be switched to Git integration.
- Other facts checked against Cloudflare documentation: the Pages build image defaults to Node 22.23.4 (the version upstream pins); `NODE_VERSION` or `.node-version` can override it; bindings are set per environment (production and preview) in project settings and need a redeploy to take effect; rollback is available only to successful **production** deployments and is instant; preview builds can be restricted to chosen branches.
- Not found in documentation I read: the exact permissions the Cloudflare GitHub app requests. Check them on the consent screen when connecting (section 5).

## 2. Decisions (all approved 2026-11-10; D5 modified as shown; see `DRND_PHASE1_IMPLEMENTATION_REPORT.md`)

Each has a recommended default. Please confirm or change them; the plan below assumes the defaults.

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Branch model in the fork | `main` stays a pure mirror of upstream (fast-forward only). DrND changes live on `drnd/production`. Work happens on `drnd/<topic>` branches that become preview deployments. |
| D2 | R2 key scheme | **Content-addressed keys** (K2, section 6) so that rolling back a deployment also rolls back its assets. The tested trial used path keys (K1); K2 is a small change to the Function that I would test locally before use. |
| D3 | Branding tiers and wording | Tiers 1 and 2 of `DRND_BRANDING_PROPOSAL.md`, "Hosted by" wording, and the link target for "DrND's KnowledgeHub – Virtual Biology Lab" (needed from you). |
| D4 | Production names | Pages project `drnd-mousebio-3d`; R2 bucket `drnd-mousebio-3d-assets`; first URL `https://drnd-mousebio-3d.pages.dev`. |
| D5 | The fork's inherited GitHub Pages workflow (`.github/workflows/pages.yml`) | **Modified and approved:** disable that workflow specifically, not GitHub Actions as a whole. Done in two layers: (1) on `drnd/production` each job carries `if: github.repository == 'Qasim-Hussain-Code/MouseBio_3D'`, and a separate `drnd-validate.yml` runs tests and validation only (no secrets, no deployment); (2) because GitHub runs a workflow from the branch that was pushed, and `main` mirrors upstream and keeps the unguarded file, the workflow is also disabled by name in the fork with `gh workflow disable Pages` (a GitHub setting change at Gate B, not yet done). |
| D6 | Preview deployments | Custom branch rule: build only `drnd/*` branches (not `main`). Preview deployments are public URLs; the content is already public. |
| D7 (approved: no trailer) | Commit attribution | Upstream's `docs/privacy-and-publication.md` asks that automated systems not be added as authors or co-authors of that project. Decide whether commits I prepare for the fork carry a `Co-Authored-By` trailer. Recommended: no trailer, your identity only. |
| D8 | Analytics | Keep Cloudflare Web Analytics and any tracking **off**, so the app's "no analytics" statement stays true. |
| D9 | Custom domain | Out of scope for this plan; initial URL is `pages.dev`. Domain work is a separate approval. |

## 3. Target architecture

```
GitHub fork (drnareshdumala-art/MouseBio_3D)
  main              mirror of upstream (never edited by hand)
  drnd/production   mirror + DrND changes   --->  Cloudflare Pages "drnd-mousebio-3d"  (production)
  drnd/<topic>      work and review         --->  preview deployments (drnd/* only)

Cloudflare Pages project
  build:    npm run build:host  +  deploy/cloudflare-pages/prepare_dist.sh   -> dist/ (no file over 25 MiB)
  functions/_middleware.js : 3 routes only, reads R2 binding R2_ASSETS, same origin
  R2 bucket "drnd-mousebio-3d-assets" (private): three immutable, content-addressed objects per asset version
```

Nothing changes in `src/` except the small branding edits from the branding proposal, and nothing changes in `public/` (the scientific assets and registries stay exactly as upstream ships them).

## 4. Implementation steps and approval gates

Each gate says what changes outside this machine and whether it can be undone.

| Step | What | Where it happens | External effect | Undo |
| --- | --- | --- | --- | --- |
| 0 | You approve this plan and decisions D1 to D9 | chat | none | n/a |
| 1 | Create local branch `drnd/production` from `main`; add commits for (a) branding, (b) Function and deploy files, (c) docs. No push. | local | none | delete local branch |
| 2 | Local verification: `npm ci`, `check`, `test`, `build:host`, `prepare_dist.sh`, Python validators, local `wrangler pages dev` with emulated R2 (as in the trial), browser pass | local | none | n/a |
| 3 | **Gate A.** Push `drnd/production` and `drnd/*` branches to `origin` (your fork only; `main` is not pushed to unless it differs from upstream, which it does not) | GitHub fork | fork gets new branches | delete the remote branches |
| 4 | **Gate B (modified D5).** Disable only the inherited deployment workflow by name (`gh workflow disable Pages` on the fork); GitHub Actions stays on for `drnd-validate.yml` | GitHub fork settings | stops the inherited deploy workflow only | `gh workflow enable Pages` |
| 5 | **Gate C.** Create R2 bucket `drnd-mousebio-3d-assets` and upload the three assets with the sync script (section 7) | your Cloudflare account (new resource) | creates a bucket and about 110 MB of objects | delete objects and bucket |
| 6 | **Gate D.** In the Cloudflare dashboard, create Pages project `drnd-mousebio-3d` by connecting GitHub, **limited to the fork repository only**; production branch `drnd/production`; build settings and environment variables from section 5; preview rule `drnd/*`; production and preview R2 binding `R2_ASSETS` to the production bucket. This is done by you in the dashboard (the Git connection and the GitHub authorisation cannot be done from the command line); I would guide and then verify read-only | your Cloudflare and GitHub accounts | creates the project, authorises the Cloudflare GitHub app on one repository | delete the project, revoke the app |
| 7 | First build of a `drnd/*` preview branch; run the post-deploy checks (section 8) | Cloudflare preview URL | public preview URL | delete the deployment |
| 8 | **Gate E.** Deploy production by building `drnd/production`; run the full checks; record evidence under `docs/evidence/` | `https://drnd-mousebio-3d.pages.dev` | production goes live | roll back (section 9) |
| 9 | Write `docs/CLOUDFLARE_DEPLOYMENT_GUIDE.md` and `docs/DRND_UPSTREAM_MAINTENANCE.md` from what actually happened | local | none | n/a |
| 10 | Phase 6 (separate approval): KnowledgeHub link and landing page | website repo | not part of this plan | n/a |

Commits and pushes require your approval at steps 1 and 3; I will show the diff before each.

## 5. Cloudflare Pages project configuration

| Setting | Value |
| --- | --- |
| Project name | `drnd-mousebio-3d` |
| Git repository | `drnareshdumala-art/MouseBio_3D` only (do not grant access to all repositories) |
| Production branch | `drnd/production` |
| Preview branches | custom: include `drnd/*`; exclude `main` |
| Framework preset | none (Vite output is plain static files); the framework preset is not needed |
| Build command | `npm run build:host && deploy/cloudflare-pages/prepare_dist.sh dist /tmp/r2-stash` |
| Build output directory | `dist` |
| Root directory | repository root (the `functions/` folder must be at the root) |
| Install | Pages installs from `package-lock.json`; I will confirm in the first build log that it ran a locked install (`npm ci` semantics) |
| Environment variables | `NODE_VERSION=22.23.4` for production and preview (also matches the default; set explicitly so a future default change does not alter builds). No secrets. |
| R2 binding | `R2_ASSETS` -> `drnd-mousebio-3d-assets`, production and preview |
| Analytics / Web Analytics | off |
| Custom domain | none initially |
| Headers | `_headers` copied into `dist/` by `prepare_dist.sh` (nosniff, referrer policy, immutable cache for `/assets/*`); the Function sets its own headers |
| Build budget | the local `build:host` takes well under a minute; I will record the real Cloudflare build time |

The R2 bucket stays private: no public access, no r2.dev URL, no custom domain, no CORS policy, because only the Function reads it.

## 6. R2 binding and key scheme

Trial design (K1): the object key equals the URL path, for example `atlas-living/living-mouse.glb`. It works and passed all trial checks, but replacing an object changes what **every** deployment (including a rolled-back one) would serve, and a rolled-back site would then fail its checksum.

Recommended production design (K2, decision D2):
- The object key is `<sha256 of the stored bytes>/<file name>`. Keys are never overwritten or reused for different bytes.
- A committed file `deploy/cloudflare-pages/r2-assets.json` maps each of the three URL paths to its key and records the registry values it was synchronised against (`bytes`, `sha256` as in `atlas.json` or `sections.json`), the stored size and content type.
- `functions/_middleware.js` imports that file and serves `R2_ASSETS.get(key)` for the three paths. The file is part of the commit, so **each deployment carries its own asset table**: rolling back the site or redeploying an older commit selects the older keys, which still exist.
- A build gate in `prepare_dist.sh` fails the build if `r2-assets.json` does not match the registry values in the repository (`public/atlas-living/atlas.json`, `public/atlas-vascular/atlas.json`, `public/atlas-volume/sections/sections.json`). An upstream merge that changes any of the three assets therefore cannot deploy until someone re-synchronises R2 and commits the new table. The living mouse is a gzip file whose compressed bytes can differ between Node versions, so the gate compares the registry (unpacked) values, not the compressed digest.
- Everything is verified again at run time by the application itself (size and SHA-256 after unpacking), so a wrong object produces a visible error rather than wrong anatomy.

Cost of K2 over K1: about 20 more lines in the Function and in `prepare_dist.sh`, plus the sync script. I would test K2 locally with the emulator (no Cloudflare resource is needed) before any push.

## 7. Asset synchronisation

Needed when the three assets are first put in R2, and whenever an upstream change alters one of them (rare; expected only with a new upstream release that changes those files).

1. On the target commit: `npm ci && npm run build:host && deploy/cloudflare-pages/prepare_dist.sh dist <stash-dir>` (the stash is kept outside the repository).
2. `deploy/cloudflare-pages/sync_assets.sh <stash-dir>` (a new script, to be written and reviewed first): for each asset compute the key; skip the upload if the key already exists; otherwise upload with the correct content type; finally write `r2-assets.json`.
3. Review the diff of `r2-assets.json`, commit it with the registry change that required it, and push to a `drnd/*` branch.
4. Preview build; run `verify_assets.py` against the preview URL; browse the three assets; then promote.

Rules: uses your own `wrangler` login on your machine; no token in the repository, in Cloudflare build settings or in any file; old keys are kept until you choose to prune them (storage per version is about 110 MB, far inside the free tier); the script never deletes.

## 8. Verification and acceptance

Before any push (local):
- `npm run check`, `npm run test` (676 tests), `npm run build:host`, `prepare_dist.sh` (no file over 25 MiB), the Python validators used in the local test report, a `wrangler pages dev` run against emulated R2, and the browser checks from `DRND_LOCAL_TEST_REPORT.md` plus the branding additions.

After each preview and production deployment:
- `python3 deploy/cloudflare-pages/verify_assets.py <site-url>`: 6 of 6 OK.
- Browser: living mouse loads (434 meshes, 2,331,092 triangles); vascular reference (575,722 points); cryosection cut face renders; no console errors; footer and "Sources and evidence" dialog show Qasim Hussain's attribution and the hosting note; licences tab intact; the Dissect disclaimer present.
- Headers: nosniff, referrer policy, immutable cache on `/assets/*` and on the three Function routes; conditional request returns 304.
- Privacy: only same-origin requests, no analytics script, no cookies, nothing in browser storage.
- Evidence saved as a new dated file in `docs/evidence/`.

Acceptance for production: all of the above pass on the production URL, the first-load experience is acceptable on a normal connection (Phase 5 measures it properly), and the rollback rehearsal in section 9 has been done once.

## 9. Rollback strategy

| Situation | Action | Notes |
| --- | --- | --- |
| A deployment has a visible problem | Cloudflare dashboard, Deployments, "Rollback to this deployment" on the last good production deployment (instant, production only); or revert the commit on `drnd/production` and let it rebuild | With K2 the older deployment carries the older asset table, and the old R2 keys still exist, so the assets roll back with it. Bindings and environment variables are project settings, not per-deployment, so do not rename `R2_ASSETS` or change them during an incident. |
| An R2 object is missing or wrong | The app refuses it and shows an error (fail closed). Roll back, or re-run the sync script and redeploy | Never overwrite a key; upload a new one. |
| Binding removed or misconfigured | The three routes return an error; everything else works. Restore the binding in project settings and redeploy, or roll back | Part of the post-deploy checks. |
| Cloudflare daily Functions allowance used up | Pages can be set either to fail the Function routes or to pass them through; either way the three assets fail visibly | Only the three routes invoke the Function. Watch usage in the first weeks; Workers Paid is the cost option if traffic grows (your decision). |
| R2 or Cloudflare outage | Fall back to the no-change host: GitHub Pages from the existing workflow (re-enable Actions and Pages on the fork) or Render with the existing `render.yaml` | Needs the KnowledgeHub link to point at the fallback URL; no DNS is involved while the site is on `pages.dev`. |
| Bad upstream merge | Do not deploy; reset `drnd/production` to the last good commit | Upstream is never merged automatically. |
| Need to remove the site | Delete the Pages project (production URL stops); keep or delete the bucket | The reference trial remains independent. |

Rehearsal: after the first production deployment, make a harmless second deployment (for example a documentation change), roll back to the first from the dashboard, run `verify_assets.py` and the browser checks, then roll forward. Record the evidence.

What rollback cannot undo: a published repository state on GitHub (use a revert commit), a build that fails before deployment (nothing is published), and objects uploaded to R2 (kept by design).

## 10. Branding implementation (from the approved proposal, once confirmed)

Files: `index.html` (title and meta description), `README.md` (one appended section), `src/App.tsx` (one footer span), `src/components/SourcesPage.tsx` (one paragraph), a CSS rule, an optional small module for the strings, and an assertion in `tests/sources-page.test.ts`. No licence, citation, scientific text or asset changes. The "maintained by Qasim Hussain" sentence stays exactly as upstream wrote it.

## 11. Costs and quotas

| Item | Expectation (documentation figures, to be re-checked at the time) |
| --- | --- |
| Cloudflare Pages | Free plan: unlimited static requests and bandwidth; 20,000 files and 25 MiB per file per site (this site is about 103 files, none over the limit); builds count against a monthly build allowance |
| R2 | Three assets and a few versions: about 0.1 to 0.5 GB stored (free tier 10 GB-month); egress free; reads far below 10 million a month |
| Pages Functions | Free plan daily request allowance; only three paths invoke the Function, so each full visit costs at most three invocations |
| GitHub | Free for the fork |
| Expected total | $0 at educational traffic levels |

## 12. Risks

| Risk | Mitigation |
| --- | --- |
| Cloudflare GitHub app authorisation grants broader access than needed | Select the single repository; review the consent screen; revoke if needed |
| Upstream changes one of the three assets | Build gate fails until R2 is re-synchronised; sync script and `verify_assets.py` |
| Cloudflare changes limits or the Function model | Re-check limits before the first production deployment (as done in this plan); fallback hosts documented |
| First-load weight (about 40 MB for the default view) on slow or mobile networks | Phase 5 measures it; no asset reduction without your approval |
| Merge conflicts from the small branding edits on later upstream updates | Keep strings in one module; list the touched lines in the maintenance guide |
| The inherited GitHub Pages workflow | Decision D5 |
| Single point of failure for the three assets (R2 binding) | Rollback table above; fallback host |

## 13. What I will not do without a further approval

Create or change any Cloudflare resource, authorise or change GitHub apps and settings, push any branch, delete the trial resources, touch the KnowledgeHub or EduAssess projects, configure DNS or a custom domain, enable analytics, change scientific assets or registries, or commit anything.

## 14. Documents that will be produced

`docs/CLOUDFLARE_DEPLOYMENT_GUIDE.md` and `docs/DRND_UPSTREAM_MAINTENANCE.md` (the remaining deliverables from your brief), written from the real deployment, and `docs/DRND_PERFORMANCE_REPORT.md` for Phase 5.
