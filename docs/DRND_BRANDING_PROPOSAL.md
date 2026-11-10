# DrND Branding Proposal: MouseBio_3D

Phase 3, Part A. Proposal only. Nothing in the interface, source, README or licence files has been changed.
Date: 2026-11-10. Commit inspected: `6cfa354` (identical to upstream `main`).

## 1. Principles

1. The application keeps its name, **MouseBio_3D**, its logo mark and its visual design.
2. Qasim Hussain stays named as original developer and maintainer of the application, everywhere the upstream already names them.
3. DrND's KnowledgeHub is named only as the **educational platform that hosts** this deployment. No sentence may say or imply that DrND developed, authored or owns MouseBio_3D or its models.
4. Scientific text, citations, structure names, licence notices and the `LICENSE`, `LICENSES.md`, `THIRD_PARTY_NOTICES.txt` and per-dataset `LICENSE.md` files are not edited.
5. Every change is additive and small, so upstream merges stay easy (see section 6).

## 2. What the interface says today

| Location | Current text or behaviour | File |
| --- | --- | --- |
| Browser tab title | `MouseBio_3D \| Digital mouse laboratory` | `index.html` |
| Meta description | "A local, open-source laboratory mouse atlas with explicit anatomical provenance and scientific limitations." | `index.html` |
| Header, left | Animated mouse mark, wordmark "MouseBio_3D", small line "DIGITAL MOUSE LABORATORY" | `src/App.tsx` (header), `src/components/Brand.css` |
| Header, right | "Start here" button, "Local session" badge, sources (i) button | `src/App.tsx` |
| Bottom bar of the 3D workspace | Mesh count on the left, "Constructed model" or "Source-derived geometry" on the right | `src/App.tsx` (`workspace-footer`) |
| "Sources and evidence" dialog, In brief | "MouseBio_3D is a digital laboratory mouse maintained by Qasim Hussain." | `src/components/SourcesPage.tsx` |
| Same dialog, Licences tab | Licence list and attribution | `src/components/SourcesPage.tsx` |
| Start here dialog | Scientific scope and limitations | `src/components/PrototypeStart.tsx` |
| Repository | README, `LICENSE` (MIT, Qasim Hussain), `LICENSES.md` | repo root |

The upstream already names Qasim Hussain in the dialog above and in the licence files, so no existing attribution needs to move.

## 3. Proposed treatment

Three tiers, from least to most visible. I recommend tiers 1 and 2 and offer tier 3 as optional.

### Tier 1: metadata and repository (no visible change to the app)

- `index.html` title: `MouseBio_3D | Digital mouse laboratory | DrND's KnowledgeHub`.
- `index.html` meta description: keep the upstream sentence and add "Hosted by DrND's KnowledgeHub – Virtual Biology Lab. Original application by Qasim Hussain."
- README: add one clearly delimited section, "Independent deployment by DrND's KnowledgeHub", at the end (text in section 5). The upstream README body is untouched.
- New, separate files only: the `docs/DRND_*.md` documents. No edit to `LICENSE`, `LICENSES.md` or `docs/privacy-and-publication.md`.

### Tier 2: one visible attribution line (recommended)

**A. Workspace footer (bottom bar).** Add one short, low-contrast item at the right end of the existing footer line:

> Original application by Qasim Hussain · Hosted by DrND's KnowledgeHub – Virtual Biology Lab

Both parts are links: "Qasim Hussain" to the upstream repository (`github.com/Qasim-Hussain-Code/MouseBio_3D`), and "DrND's KnowledgeHub – Virtual Biology Lab" to the KnowledgeHub landing page (URL to be supplied; see section 7). It sits in the footer because that bar is already used for provenance statements ("Source-derived geometry"), it is visible in every mode, and it needs no header space. On narrow screens it wraps to a second line or drops to the dialog below.

**B. "Sources and evidence", In brief tab.** Keep the upstream sentence exactly as it is and add one paragraph after it:

> This deployment is hosted by DrND's KnowledgeHub – Virtual Biology Lab as an educational resource. The application, its code and its scientific models were created and are maintained by Qasim Hussain; DrND's KnowledgeHub did not develop them. Source datasets keep their own authors and licences, listed under Licences. Additional educational resources: DrND's KnowledgeHub.

This is the authoritative statement, reachable from the header (i) button.

### Tier 3: header line (optional)

Replace nothing; add a second small line or a link beside "DIGITAL MOUSE LABORATORY", for example "DrND's KnowledgeHub · Virtual Biology Lab". This is the most prominent option and changes the header layout the upstream designed, so I do not recommend it for the first release. It could be added later if you want the platform name visible at first glance.

### Not proposed

- No logo swap, recolouring, font change or rename of the wordmark.
- No banner, pop-up, cookie-style notice or iframe wrapper.
- No analytics, tracking pixel or third-party script for branding purposes. The application's statement "no analytics, remote data service or automatic upload" must stay true, so do not enable Cloudflare Web Analytics on the Pages project either.

## 4. Mock-up of the footer line

```
● (existing status text, unchanged)          Source-derived geometry · Original application by Qasim Hussain · Hosted by DrND's KnowledgeHub – Virtual Biology Lab
```

(Wording may be shortened to "Original app: Qasim Hussain · Hosted by DrND's KnowledgeHub" on small screens.)

## 5. Proposed texts

README section (to append after the upstream "Licences" section):

> ## Independent deployment by DrND's KnowledgeHub
>
> This repository is an independent fork of [MouseBio_3D](https://github.com/Qasim-Hussain-Code/MouseBio_3D) by **Qasim Hussain**, deployed as part of DrND's KnowledgeHub – Virtual Biology Lab. The application, its source code and its anatomical models were developed by Qasim Hussain and remain under the licences in [LICENSE](LICENSE) and [LICENSES.md](LICENSES.md); the source datasets keep their own authors and licences. DrND's KnowledgeHub hosts this deployment and provides additional educational resources; it is not the author of the application. The tool is an educational simulation, is not a clinically or experimentally validated animal model, and does not replace supervised animal training or approved animal protocols. Deployment, upstream tracking and test notes are in `docs/DRND_*.md`.

Short form (footer or social cards): "MouseBio_3D by Qasim Hussain, hosted by DrND's KnowledgeHub – Virtual Biology Lab."

Educational notice for the KnowledgeHub landing page (Phase 6, not part of the application): "This simulation does not replace supervised animal training or approved animal protocols." The application already shows an equivalent notice in the Dissect mode and the Procedures tab.

## 6. Files that would change if you approve

| Tier | File | Change | Size |
| --- | --- | --- | --- |
| 1 | `index.html` | title and meta description | 2 lines |
| 1 | `README.md` | appended section | about 8 lines, no upstream text altered |
| 2A | `src/App.tsx` | one `<span>` with two links in `workspace-footer` | 1 line |
| 2B | `src/components/SourcesPage.tsx` | one `<p>` after the existing "maintained by" paragraph | 1 line |
| 2 | `src/components/Brand.css` or `src/styles.css` | one small rule for the footer link style | about 3 lines |
| any | `tests/sources-page.test.ts` | an assertion that the Qasim Hussain sentence and the new paragraph are both present | small |

To keep upstream merges simple I would put the new wording in one new small module (for example `src/platform-note.ts`, exporting two strings and two URLs) so that `App.tsx` and `SourcesPage.tsx` each change by one import and one expression. Upstream edits to those two files are frequent, so expect an occasional trivial merge conflict on exactly those lines; the maintenance guide (Phase 7) would list them.

An alternative that touches no upstream-owned file besides `index.html` is to inject the note at build time from an environment variable (for example `MOUSEBIO_PLATFORM_NOTE=1`), but that adds a build switch the upstream does not have. I do not recommend it for a single deployment.

## 7. Open points for you

1. **Link target.** What URL should "DrND's KnowledgeHub – Virtual Biology Lab" point to until the Phase 6 landing page exists? Your website repository was not inspected in this phase.
2. **Tier.** Confirm tiers 1 and 2, or add tier 3.
3. **Wording.** Confirm that "Hosted by" is the right relationship. Alternatives: "Deployed by" or "Presented by". I avoided "powered by" and "from" because they can read as authorship.
4. **Licence check.** CC BY-SA 4.0 obliges anyone redistributing the Digimouse-derived models to credit the original authors and indicate changes. The fork changes no model; the Licences tab and notices already do this and stay as they are.
5. **Privacy statement.** The "Local session" badge and the privacy text remain accurate only while no analytics or tracking is added at the hosting layer.

## 8. What I need from you

Approval of tiers and wording (and the link target) before I edit anything. Then the change set is small enough to review in one diff, with `npm run check`, `npm run test`, `npm run build:host` and a browser look at the footer and dialog before any commit. I will not commit or push without your approval.
