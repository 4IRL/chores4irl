# Review: docker-raspberry-pi

## Review — 2026-04-23

### Summary
Six parallel subagents reviewed the plan. Four key issues are blocking: (1) both Dockerfiles omit the root `tsconfig.json` that `frontend/tsconfig.json` and `backend/tsconfig.json` both `extends`, so `tsc`/`vite build` will fail inside the builder stages; (2) Step 11's backup script uses CommonJS `require()` inside a package declared `"type": "module"`; (3) the Step 1 line range for the DB-path derivation is off (7–9, not 5–7); (4) Step 12's remote-Pi Playwright run will spawn local dev servers because the webServer block in `playwright.config.ts` is unconditional. All four are mechanical. A handful of genuine design decisions remain (restart policy, explicit `0.0.0.0` bind, TZ parameterization, README).

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | FAIL | 3 critical, 5 major, 2 minor |
| 2 | Full-Stack Trace | FAIL | 0 critical, 1 major, 1 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 4 design_decision flags |
| 4 | Integration & Conventions | FAIL | 0 critical, 3 major, 2 minor |
| 5 | Verification & Coverage | FAIL | 1 critical, 0 major, 6 minor |
| 6 | Completeness & Risk | FAIL | 2 critical, 4 major, 9 minor |

### Findings

#### Critical (must fix before proceeding)

- **[Steps 4 & 5] Dockerfiles omit root tsconfig.json** _(Subagent #6, verified)_: Both `backend/tsconfig.json` and `frontend/tsconfig.json` declare `"extends": "../tsconfig.json"`. Neither Dockerfile copies the root `tsconfig.json` into the builder stage, so `tsc` (backend) and `vite build` (frontend) will fail with an ENOENT on the extends path. Add `COPY tsconfig.json ./tsconfig.json` to both builder stages before the `npm ci` step.

- **[Step 1] DB-path derivation line range is wrong** _(Subagent #1)_: Plan claims `backend/src/db.ts` lines 5–7 hold the derivation; actual location is lines 7–9 (lines 5–6 are the `__filename`/`__dirname` ESM setup). The replacement code is correct; only the line reference needs fixing.

- **[Step 11] Backup script uses `require()` in an ESM package** _(Subagent #1)_: `backend/package.json` declares `"type": "module"`, so `node -e "const Database=require('better-sqlite3')"` fails with "require is not defined in ES module scope". Switch to dynamic import inside an async IIFE: `node -e "(async()=>{const Database=(await import('better-sqlite3')).default; const db=new Database(process.env.DB_PATH); await db.backup('/data/backup-tmp.db'); process.exit(0);})().catch(()=>process.exit(1))"`.

- **[Step 12] Playwright webServer guard must be mandatory, not conditional** _(Subagents #1, #2, #5)_: The plan currently says "If the config prevents remote targeting, add an env-gated early return". Reading `playwright.config.ts` confirms the webServer block is unconditional and the current `baseURL` is hardcoded to `http://localhost:5174`. Running `PLAYWRIGHT_BASE_URL=http://<pi-ip>/ npx playwright test` today would spawn the local dev servers **in parallel** with the remote run, conflict on ports, and ignore the override. The fix is deterministic, not optional — make the plan require the edit.

- **[Step 1] db-path test is underspecified** _(Subagents #4, #5, #6)_: Plan describes two assertions in prose (DB_PATH override + TEST_DB_PATH=':memory:' priority) but provides no test code, no module-reset pattern, and omits the third case (both env vars unset → default path). A junior implementer must invent the whole test, including the `vi.stubEnv` / `vi.resetModules` dance and the dynamic import timing. Provide a full code skeleton with all three cases.

#### Major (should fix)

- **[Step 7] `restart: unless-stopped` can infinite-loop on persistent DB error** _(Subagent #6)_: If the backend fails repeatedly (corrupt WAL, mis-permission on volume), `unless-stopped` restarts forever with no observability hatch. Consider `on-failure: 5` (give up after 5 tries, leave the container stopped for investigation) or accept the risk with a prominent note. — **Design decision**.

- **[Step 6] backend `listen()` relies on Node 20's implicit 0.0.0.0 default** _(Subagent #1)_: `backend/src/server.ts:3` calls `app.listen(PORT, ...)` with no hostname. Node 20 defaults to `0.0.0.0`, so cross-container proxy works today, but leaving it implicit is brittle if Node or npm version ever changes. Option A: accept the default (the Dockerfile pins `node:20.18.0-bookworm-slim`). Option B: change to `app.listen(PORT, '0.0.0.0', ...)` for explicit safety. — **Design decision**.

- **[Step 10] Display rotation/touch calibration doesn't distinguish X11 vs Wayland** _(Subagent #6)_: Bookworm defaults to Wayland; `display_rotate=1` in `/boot/firmware/config.txt` is an X11/DSI-era path and does not rotate touch coordinates under Wayland. `wlr-randr --transform 90` rotates the display on Wayland but often leaves touch input unrotated. The current plan reads as an either/or without specifying the order or how to detect which session is running. Expand with a detect-first workflow.

- **[Step 9] Tarballs are left behind on laptop and Pi** _(Subagent #6)_: `/tmp/chores4irl-src.tar.gz` on the laptop and `~/chores4irl-src.tar.gz` on the Pi are never cleaned up. Add `rm` to-dos after successful extraction/build.

- **[Step 10] RTC battery section lacks verification specifics** _(Subagent #6)_: Plan tells the user to "confirm a coin-cell backup battery is installed" without saying how to verify (visual inspection? voltage?), what battery to buy, or what the failure mode looks like if it's missing. Expand.

- **[Step 2] No verification that other config files don't reference root `index.html`** _(Subagent #4)_: After the delete, the plan only checks `ls frontend/index.html`. Add a grep verification that no Dockerfile, nginx.conf, or docker-compose.yml references a root-level `index.html`.

- **[Step 7] Root `package.json` reference is ambiguous in a monorepo** _(Subagent #4)_: Step 7 mentions "update the root `package.json`" — in a repo with three `package.json` files, every reference should be path-qualified. Clarify.

- **[Subagent #1 finding — INVESTIGATED AND REJECTED] Tailwind config copying**: Subagent #1 claimed `frontend/src/tailwind.config.js` must be copied into the Dockerfile builder. Verified: `frontend/src/index.css` uses `@import "tailwindcss";` (Tailwind v4 CSS-first mode) and `frontend/vite.config.ts` calls `tailwindcss()` with no config argument. The existing `tailwind.config.js` is stale leftover from v3 and is not loaded by the v4 plugin — the frontend build does not depend on it. No fix needed; logging for transparency.

#### Minor (nice to fix)

- **[Step 3] `.dockerignore` verification is a file-count eyeball** _(Subagent #5)_: Strengthen by grepping the tarball listing for forbidden paths (`node_modules`, `.git`, `*.db`) and failing if any match.

- **[Steps 4–7] No per-step syntax validation** _(Subagent #5)_: Add `hadolint < Dockerfile.*` (or at least `docker build --no-cache --target builder`), `docker run --rm -v ./nginx.conf:/etc/nginx/conf.d/default.conf nginx:1.27-alpine nginx -t`, and `docker compose config` as per-step checks so a typo isn't discovered only in Step 8.

- **[Step 9] "grep for linux-arm64 in build output" may false-negative on cached builds** _(Subagent #5)_: If npm's cache already has ARM64 prebuilts, no download line appears. Note the `npm ci` reinstall trick or pivot to a post-build `docker run --rm <image> uname -m` check.

- **[Step 10] systemd unit lacks `TimeoutStopSec`** _(Subagent #6)_: Without it, shutdown relies on systemd's default (90s) — add an explicit `TimeoutStopSec=30` so a hung `compose down` doesn't delay shutdown.

- **[Steps 10, 11] Username `pi` is hardcoded** _(Subagent #3)_: `/home/pi/…` paths are correct for default Raspberry Pi OS but brittle otherwise. Add a one-line note instructing readers to substitute if their Pi user differs.

- **[Step 10] `/usr/bin/docker` hardcoded in systemd unit** _(Subagent #3)_: Add a pre-flight `which docker` check and substitution guidance.

- **[Step 9] Buildx fallback underspecified** _(Subagent #6)_: The fallback paragraph mentions `docker save` and "use image: instead of build:" without exact commands or an alternate compose file. Flesh out with concrete buildx/save/load lines.

- **[Step 8] Smoke-test seed count is wrong after the first run** _(Subagent #6)_: `curl /api/chores | jq '.data | length'` will return >10 on a re-run (the volume still has the extras you added). Add a `docker compose down -v` reset note before re-running.

- **[Step 2] No git-state check before deletion** _(Subagent #6)_: A tiny `git status` / `git ls-files --error-unmatch` confirm that the file is safe to delete and recoverable from history. Cheap insurance.

- **[Step 7] TZ hardcoded, not env-driven** _(Subagent #4)_: `TZ: America/New_York` vs `TZ: ${TZ:-America/New_York}` in the compose file. The latter lets the user override without editing YAML. — **Design decision** (preference).

- **[new] README has no deployment section** _(Subagent #4)_: After this plan ships, the README should document the local smoke test, the ship-to-Pi flow, and first-boot Pi setup. Consider a Step 13. — **Design decision** (optional scope).

### Verification Gaps
- **Step 3**: File-count sanity is insufficient — add negative assertion (`grep -qE 'node_modules|\.git|\.db' && exit 1`).
- **Steps 4–7**: No intermediate syntax validation before Step 8's end-to-end build.
- **Step 9**: ARM64 verification can silently pass on a cached build; add an explicit post-build `uname -m` inside a container.

### To-Do: Mechanical Fixes (to be auto-applied)
- [ ] Add root `tsconfig.json` COPY to Dockerfile.backend and Dockerfile.frontend builder stages.
- [ ] Fix "lines 5–7" → "lines 7–9" in Step 1 db.ts reference.
- [ ] Replace `require()` with async-IIFE dynamic import in Step 11 backup script.
- [ ] Make Step 12's playwright.config.ts edit mandatory and provide the exact patch.
- [ ] Provide full `db-path.test.ts` skeleton including all three test cases in Step 1.
- [ ] Add tarball cleanup `rm` to-dos to Step 9 (laptop + Pi).
- [ ] Expand RTC section with visual-inspection/voltage check, battery spec, and no-battery failure mode.
- [ ] Add "no bare index.html references elsewhere" grep to Step 2.
- [ ] Qualify "root `package.json`" reference in Step 7 with the absolute path.
- [ ] Strengthen `.dockerignore` verification with a grep-based negative assertion.
- [ ] Add per-step syntax validation to-dos for Dockerfile/nginx.conf/docker-compose.yml (Steps 4, 5, 6, 7).
- [ ] Add note to Step 9 about the npm-cache false-negative risk with the ARM64 grep check.
- [ ] Add `TimeoutStopSec=30` to the systemd unit in Step 10.
- [ ] Add username-is-`pi` assumption note to Steps 10/11 with override instructions.
- [ ] Add `which docker` pre-flight check for the systemd unit in Step 10.
- [ ] Expand Step 9 buildx fallback with concrete `docker save`, `docker load`, and alternate-compose lines.
- [ ] Clarify Step 8 smoke-test seed count (add `down -v` reset note for re-runs).
- [ ] Add `git status` / `git ls-files --error-unmatch` safety check before Step 2 delete.
- [ ] Expand Step 10 display-rotation section with a detect-first X11 vs Wayland workflow.

### Design Decisions (awaiting user input)

#### DD-1: [Step 7] Container restart policy
**Context:** `restart: unless-stopped` will restart infinitely on persistent backend failure (corrupt volume, bad permissions), with no escape hatch short of `docker compose down`. The safer `on-failure: 5` caps restarts and leaves the stack stopped for manual diagnosis, at the cost of potentially going offline after transient hiccups.

| # | Option | Trade-off |
|---|---|---|
| 1 | Keep `unless-stopped` | Maximum uptime; a transient issue can't permanently stop the stack. Persistent failures loop forever. |
| 2 | Use `on-failure: 5` | Caps failure loops. A transient issue that crosses 5 restarts leaves the stack offline until manual intervention. |
| 3 | Keep `unless-stopped` + add prominent "if it loops, `docker compose down` and check logs" note | Keeps behavior, documents the failure mode. |

**Chosen:** Option 2 — `on-failure:5`. Rationale: caps restart loops; transient offline is acceptable for a single-device home deployment, and Step 11 backups give a recovery path for persistent corruption.

---

#### DD-2: [Step 6 / pre-step] Explicit `0.0.0.0` bind in `backend/src/server.ts`
**Context:** `app.listen(PORT, ...)` relies on Node 20's default of binding all interfaces. With the Dockerfile pinned to `node:20.18.0-bookworm-slim` this works, but the bind is implicit. Making it explicit (`app.listen(PORT, '0.0.0.0', ...)`) removes all ambiguity at the cost of a small code edit in Step 1.

| # | Option | Trade-off |
|---|---|---|
| 1 | Leave implicit; rely on pinned Node 20 default | Zero code change; depends on Node default never regressing. |
| 2 | Add explicit `'0.0.0.0'` as a new sub-to-do in Step 1 | One-line source change; eliminates version drift risk. |

**Chosen:** Option 2 — explicit `'0.0.0.0'` bind. Rationale: one-line source change eliminates Node-version drift risk for cross-container reachability.

---

#### DD-3: [Step 7] TZ parameterization in docker-compose.yml
**Context:** The plan hardcodes `TZ: America/New_York` with a comment ("set to the Pi's actual locale"). A templated default like `TZ: ${TZ:-America/New_York}` lets users override via `export TZ=...` instead of editing YAML.

| # | Option | Trade-off |
|---|---|---|
| 1 | Keep hardcoded `TZ: America/New_York` | Simpler to read; one obvious place to change. |
| 2 | Use `TZ: ${TZ:-America/New_York}` | 12-factor style; override-without-editing. Slightly more indirection. |

**Chosen:** Option 1 — templated `${TZ:-America/New_York}`. Rationale: allows zone override without editing YAML.

---

#### DD-4: [new Step 13] README deployment section
**Context:** After this plan ships, the repo gains substantial deployment machinery (Dockerfiles, compose, Pi provisioning, backup). README is currently the Vite boilerplate.

| # | Option | Trade-off |
|---|---|---|
| 1 | Add Step 13: update README with Deployment section | Makes the flow discoverable; small added scope. |
| 2 | Skip; keep plan narrowly scoped to infra | Avoids doc drift; the plan file itself is the doc. |

**Chosen:** Option 1 — add Step 13 (now Step 12 after renumber) for README. Rationale: the deployment workflow is non-trivial; the README is the discoverable entry point.

---

### Verdict
[ ] Ready to proceed as-is  
[ ] Proceed after minor fixes  
[x] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | Subagent #3 verified db.ts imports still used; no dead imports introduced. |
| Type annotations | [x] | Subagent #1 verified no type/signature changes. |
| Error handling (status codes, exceptions, user feedback) | [x] | Subagent #2 traced all four Express routes + frontend handlers. |
| Test coverage (happy path, sad path, edge cases) | [x] | Subagent #5 flagged missing third case in db-path test. |
| Breaking changes (API contracts, shared state, DB schema) | [x] | Subagent #6: DB_PATH env is additive; no API contract change. |
| Config consistency (env vars, requirements pins, lint rules) | [x] | Subagent #4 confirmed ESLint rules won't trip Step 1; no new npm deps. |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | Subagent #4: global CLAUDE.md is the only ruleset; no violations. |
| Monorepo path disambiguation | [x] | Root `tsconfig.json` miss caught; `index.html` + `package.json` callouts made. |

---

## Review — 2026-04-23 (Pass 2)

### Summary
Pass 2 re-verified all Pass 1 fixes. Subagents 2, 3, and 6 returned clean (PASS). Subagents 1 and 5 returned FAIL but their "critical" findings were all scope-confusion false positives — they flagged that the **source files** (`backend/src/db.ts`, `backend/package.json`, `backend/src/server.ts`, `playwright.config.ts`) don't yet contain the changes the plan prescribes. That's exactly right: a plan review checks the plan text, not the state of the code the plan will change. Those findings are not accepted. After filtering false positives, Pass 2 found exactly one real major issue (Subagent 4 M2: `TZ` env-var guidance tells users to edit `~/.profile`, which the systemd unit does not source) plus a handful of minor enhancements.

### Re-verification of Pass 1 resolutions
| Pass 1 fix | Re-verified against | Still holds? |
|---|---|---|
| Root `tsconfig.json` COPY in both Dockerfiles | Read both Dockerfile blocks in the updated plan | [x] |
| DB-path line range 7–9 | Re-checked `backend/src/db.ts:7–9` | [x] |
| Backup script dynamic import | Read Step 11 script, no `require(` remains | [x] |
| Playwright webServer mandatory patch | Read Step 13; patch is explicit and present | [x] |
| db-path test skeleton (three cases) | Step 1 includes full test code with three `it()` blocks | [x] |
| 18 other minor mechanical fixes | Spot-checked each | [x] |
| DD-1 `on-failure:5` | Present in both services in Step 7 compose block | [x] |
| DD-2 explicit `'0.0.0.0'` | New Step 1 bullet present | [x] |
| DD-3 `${TZ:-America/New_York}` | Present in Step 7 compose block | [x] |
| DD-4 new Step 12 README | Present between Steps 11 and 13 | [x] |

### Subagent Results (Pass 2)

| # | Subagent | Verdict | Real findings (after filtering FPs) |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS (false FAIL) | 0 real findings — all 5 "critical" were scope-confusion about source not containing planned edits |
| 2 | Full-Stack Trace | PASS | 0 findings |
| 3 | Ordering & Cleanup | PASS | 0 findings |
| 4 | Integration & Conventions | FAIL | 1 major (TZ/systemd), 1 minor (bare-filename concern — rejected as overstated) |
| 5 | Verification & Coverage | PASS (false FAIL) | 0 real findings — same scope-confusion as #1 |
| 6 | Completeness & Risk | PASS | 0 findings, 4 optional enhancements |

### Findings

#### Major (should fix)
- **[Step 10] TZ env-var override guidance won't reach the systemd service** _(Subagent #4 M2)_: Step 10 tells the reader to `export TZ=Europe/London` in `~/.profile`. That file is sourced only on interactive login shells. The `chores4irl.service` systemd unit runs under `Type=oneshot` with the default systemd environment and never sources `~/.profile`, so `docker compose up -d` invoked via the unit will always see an empty `TZ` and fall through to `${TZ:-America/New_York}`. The user would set up a non-default zone, reboot, and get America/New_York silently. Fix: add `Environment="TZ=America/New_York"` (overridable via `/etc/chores4irl.env`) to the `[Service]` block of the systemd unit, and rewrite the Step 10 TZ to-do to instruct editing the unit (or the env file) rather than `~/.profile`.

#### Minor (optional polish)
- **[Step 7] Quote `on-failure:5`** _(Subagent #6 1.1)_: `restart: on-failure:5` is valid YAML but `restart: "on-failure:5"` is defensive against parser edge cases. Cosmetic.
- **[Step 10 Wayland rotation] Discover output name first** _(Subagent #6 §4)_: The plan uses `HDMI-A-1` as example output; tell the reader to run `wlr-randr` with no args first to enumerate the real name.
- **[Step 9 fallback] Buildx cleanup after use** _(Subagent #6 §6)_: Optional `docker buildx rm armbuilder` after cross-compile — tidiness only.
- **[Step 12 README] Consider mDNS/`pi.local` + troubleshooting hint** _(Subagent #6 §5)_: Nice-to-have in README.

#### Rejected findings
- **Subagent #1 (all 5 "critical")** and **Subagent #5 BLOCK-1/BLOCK-2**: Both subagents flagged the fact that `backend/src/db.ts`, `backend/package.json`, `backend/src/server.ts`, and `playwright.config.ts` do not yet contain the edits the plan describes. That is not a plan defect — the plan is the instruction to make those edits. Review scope is the plan document, not an audit of whether it has been executed. Not accepted.
- **Subagent #4 C1 (bare-filename ambiguity for `.dockerignore`)**: `.dockerignore` is unambiguously a repo-root file by docker convention, already placed there in Step 3's explicit `/home/rmila/Code/chores4irl/.dockerignore`. The subsequent bare references in Step 9 (`tar --exclude-from=.dockerignore`) are run from the same repo root and not ambiguous. Severity overstated.
- **Subagent #4 M1 (test skeleton pattern deviation)**: The `vi.resetModules()` + dynamic-import pattern is the correct idiomatic Vitest solution for env-var-sensitive module code. The existing `chores.test.ts` / `routes.test.ts` use static imports because they don't need env isolation — different need, different pattern. Not a real integration problem.
- **Subagent #4 M3 (Step 12 README structure)**: Documentation steps listing topics-to-cover instead of exact prose is an appropriate tone choice for the content type. Not a defect.

### To-Do: Mechanical Fixes (to be auto-applied)
- [ ] Rewrite the Step 10 timezone to-do and add `Environment="TZ=America/New_York"` to the systemd unit so the unit owns the TZ source-of-truth.
- [ ] Add a `wlr-randr`-with-no-args "discover your output name first" hint to the Wayland rotation bullet.
- [ ] Optional: quote `restart: "on-failure:5"` in the compose file.

### Verdict
[ ] Ready to proceed as-is  
[x] Proceed after minor fixes (one real major, easily mechanical)  
[ ] Requires changes before proceeding

### Missed-Finding Root Causes
Pass 2 found **one** real finding that Pass 1 missed (TZ/systemd guidance). Root-cause analysis:

| Finding | Root cause | Skill gap? |
|---|---|---|
| TZ env-var guidance targets `~/.profile` which systemd doesn't read | **Scoped too narrowly.** Pass 1's integration subagent checked the compose-file parameterization change (DD-3) but didn't trace how the TZ value would actually reach the running stack — specifically, that the systemd unit short-circuits user shell env. The "What to read" list did not explicitly include systemd unit files when a downstream DD-applied change was about an env var. | Possible: Subagent 4's "Config consistency (env vars ...)" checklist could explicitly require a trace from each env-var-declaring config (compose, Dockerfile ENV) to every process that starts the stack (systemd, shell), not just to the containers themselves. |

### Skill Improvements Considered
The "scoped too narrowly" root cause above is the type of finding Step 7 of the plan-reviewer skill is designed to loop back on. The proposed improvement — **Subagent 4 (Integration) should verify that any env var introduced in a compose file or Dockerfile is actually reachable from every entry point that starts the stack (shell, systemd, CI)** — is modest and targeted. Leaving this as a candidate to surface to the user after the plan finalizes, rather than auto-applying a skill change in-loop.
