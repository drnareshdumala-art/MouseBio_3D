# DrND Local Test Report: MouseBio_3D

Phase 2 (local environment and testing). Test date: 2026-11-10.
Commit tested: `6cfa354` (`main`, identical to `upstream/main`). No tracked source file was modified. No commit, push, deployment or external configuration change was made. Build output (`dist/`), `node_modules/` and `.npm-cache/` are git-ignored.

Environment: Linux, Node v22.23.1, npm 10.9.8, Python 3.12.3. Browser: the Claude desktop app's built-in browser pane (Chromium-based), WebGL2 and `DecompressionStream` available. It was narrow (about 560 px wide), so the application showed its compact layout throughout.

## 1. Summary

| Area | Result |
| --- | --- |
| `npm ci` | Passed. 61 packages added, 0 vulnerabilities reported by the install audit. |
| `npm run check` (tsc) | Passed (3.4 s). |
| `npm run test` | **Passed: 676 of 676** (4 min 53 s). |
| `npm run build` | Passed. 298.1 MiB, uncompressed models. |
| `npm run build:host` | Passed. 190.1 MiB. 28 registered models gzipped, 194.5 MB stored as 81.3 MB, every checksum verified. |
| Python validators | 19 of 19 pass (some tests skipped by design, see 3). Two needed the correct way of running them (see 3). |
| `check_publication.py --tracked` | 0 errors, 0 warnings (informational synthetic fixtures only). |
| `npm run resources` | Within the 10 GB budget (about 1.03 GB including `.git`, `node_modules`, `dist`). |
| Browser testing (production `build:host` output) | All areas tested worked. No functional failures found. |
| **Cloudflare Pages readiness** | **Blocker confirmed: three files in `dist/` exceed 25 MiB.** |

No failures were found in the application. One deployment blocker was confirmed, and it matches the audit finding R1.

## 2. Commands and results

### Install and static checks
- `npm ci`: 18 s. `found 0 vulnerabilities`. An npm 12 upgrade notice appeared; not acted on.
- `npm run check`: no type errors.
- `npm run test`: 676 tests, 0 fail, 0 skipped, 0 cancelled.

### Builds compared

| | `npm run build` | `npm run build:host` |
| --- | --- | --- |
| Size of `dist/` | 298.1 MiB | 190.1 MiB |
| Files | 104 | 104 |
| Registered models stored | plain | gzip (28 files; 194,544,603 bytes stored as 81,331,442, about 58% smaller) |
| JS bundle (all chunks) | about 1.9 MB (222 KB gzip for the main chunk) | identical |
| Chunk-size warning | yes (`index` 739 kB, `three` 612 kB), pre-existing | same |

Notes:
- The notices check, `tsc` and Vite ran as part of both builds without error.
- `build:host` verified each model's byte count and SHA-256 against its registry before and after compression, as designed.
- The compressed models load in the browser and are accepted by the application's own checksum check: the living mouse (gzip, 34.3 MB stored) and the volume, micro-CT, hindlimb and EMA147 references all loaded from the `build:host` output with no checksum error.

### Files over 25 MiB in `dist/` after `build:host` (Cloudflare Pages limit)

| File | Size |
| --- | --- |
| `atlas-living/living-mouse.glb` | 32.7 MiB |
| `atlas-vascular/schmid2021-mvn1-lines.json` | 36.6 MiB |
| `atlas-volume/sections/cryosection-slices.bin` | 34.0 MiB |

Measured values match the estimates in the audit. The plain build has five such files. This is the only deployment problem found. Options remain as listed in the audit (R2) and need your decision. I changed nothing.

## 3. Python validators

Run from the repository root with `python3 scripts/<name>.py` (no packages needed).

Passed (19): geometry, resources, volume assessment, volume geometry, hindlimb geometry, micro-CT geometry, section images, EMA147 geometry, publication, registered anatomy, NeuroMorpho, NeuroMorpho publication, MouseMapper nerve, vascular, polyline publication (310 s), release, serve prototype, Bondarenko, distribution.

Process notes (my own, not application faults):
- My first run used Python isolated mode (`-I`), which blocks the sibling imports these scripts rely on, so every script failed at import. Re-run normally, they pass.
- `test_distribution.py` needs a local server at `127.0.0.1:4173` and compares served bytes with the registry, so it must be run against the plain `npm run build` output. Against the `build:host` output it correctly reports checksum mismatches because the files are gzip. Against the plain build served with `vite preview`: 10 of 10 pass.
- `test_polyline_publication.py` takes about 5 minutes; my first 250 s limit cut it off.
- Skipped by design (7 tests): they need the original raw downloads in the git-ignored `data/raw/` (micro-CT scan, MouseMapper VTK, vascular archive, Digimouse archives, EMA147 archive, Bondarenko and NeuroMorpho originals). The regenerate-from-source checks therefore did not run; checks on the shipped files did.
- `npm run validate` does not exist (see the audit). `validate:geometry` passed.

## 4. Browser testing

Served with `vite preview` from the `build:host` output. Pane was narrow (compact layout); the side panel overlays the canvas in that layout.

| Feature | Result | Evidence |
| --- | --- | --- |
| Main 3D living mouse | Pass | Rendered with coat; WebGL2 present; gzip model loaded, 0 console errors on load. |
| Rotation | Pass | Drag changed the view (mouse seen from behind afterward). |
| Zoom | Pass (buttons) | "+" button changed magnification. Scroll-wheel zoom and the Play unfold journey were not tested. |
| Structure selection | Pass | Clicking the model selected "Small intestine" with Focus, Hide, Isolate, Zoom in and Details actions. |
| Anatomical layers | Pass | Skeleton, Muscles and Organs layers each changed the display. Coat, Skin, Fat, Nerves, Blood vessels and the 14 system toggles were present but not individually checked. |
| Skin, muscle, skeleton, organ views | Pass | Screenshots of each. |
| Dissection bench | Pass | Bench with animal, 12 instruments, Undo, Start again, Record. "Simulated" and "not a substitute for supervised training under an approved protocol" notices displayed. |
| Guided tutorials | Partly tested | All 15 listed with step counts. "Open the abdomen" opened at step 2 of 6 with citation (Parkinson et al. 2011, J Vis Exp 54:2966); the hands demonstration ("Show me this step") ran. The other 14 tutorials were not run. |
| CSV import | Pass | Valid synthetic file accepted: 4 observations, 2 conditions, mean computed for the control group (0.22). Messages: "No data transmitted". |
| CSV error handling | Pass | Missing columns, unknown structure ID and invalid number rejected; existing data retained. |
| JSON import | Pass | Valid `mousebio.experimental.v1` file accepted and labelled "Synthetic example data". Malformed JSON rejected ("The file is not valid JSON"). |
| SWC import | Pass | Synthetic 5-sample SWC opened as a local trace ("No file data transmitted"). A file whose sample is its own parent was rejected, trace unchanged. |
| Scientific reference models | Pass | Volume (21), micro-CT (11), hindlimb (44), EMA147 (77), nerve graph and vascular paths all loaded and rendered. Whole-body references were checked visually only for the hindlimb, nerve and vascular references; no load errors for any. The neuron reference and the trace panel were not individually screenshotted. |
| Physiology | Partly tested | Living tab opens with the cardiac cell model and its Bondarenko et al. 2004 citation; the vascular reference showed its flow model with the "assumed pipe model" caption. No simulation values were checked against the literature. |
| Citations | Pass | "Sources and evidence" dialog: tabs In brief, Structures, Works cited, Deep levels, Procedures, Licences. Works cited has 88 DOI links; Procedures 19; Licences lists CC BY-SA 4.0. |
| Compare tab | Opened | The tab opens; no comparison was run. |
| Privacy | Pass | All 80+ network requests went to `127.0.0.1`. No POST requests, no external hosts. `localStorage`, `sessionStorage` and cookies were empty after the whole session. |
| Console | See below | Two `Anatomical geometry rejected AbortError: Aborted` errors, both caused by my switching reference models faster than they could load (in-flight loads were cancelled). Not seen during normal loading. |

### Observations (not defects; for your judgement)
1. A measurement name beginning with `=` (`=1+1`) was accepted as plain text by the CSV import. The documentation says CSV exports escape such cells, so I judge this harmless, but I did not test the export because it triggers a file download.
2. The "Sources and evidence" dialog says the lab is "maintained by Qasim Hussain". The Phase 3 branding must leave that statement accurate, with DrND's KnowledgeHub shown alongside it.
3. I did not test on a phone, a desktop-width window, or other browsers. I did not measure frame rate, memory or GPU use. Those belong to Phase 5.

## 5. Not tested

- Cloudflare Pages itself (no deployment, no account access).
- Mobile and Android Chrome; browsers other than the built-in Chromium pane.
- Wide-desktop layout (the pane was narrow).
- Scroll-wheel zoom, the "Play" scale journey down to the atom, and the Walk and Pause motion controls.
- The remaining 14 tutorials, the Compare workflow, saved-view export and import, JSON/CSV export, and the large-file limits (5 MiB, 20,000 rows, 2 MiB SWC).
- Regeneration of assets from raw source data (raw archives not present).
- `npm audit` against the live registry beyond what `npm ci` reported.

## 6. Recommended next steps

1. Decide how to resolve the 25 MiB blocker (audit R2) before Phase 4. This needs your approval because every fix touches the build or a scientific asset, or changes the hosting plan.
2. Approve Phase 3 (branding proposal), which needs no code change until you approve it.
3. Optionally approve a broader browser pass (wide desktop layout, remaining tutorials, Play journey, Compare and export) before deployment.
