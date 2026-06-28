# Review: In-App Rotate-Screen Button (Pi Kiosk)

## Review — 2026-06-28

### Summary

The plan is well-researched and the web tier (backend route, frontend service/component, request/response trace) is largely sound — the full-stack trace verified `express.json()` is registered, nginx forwards `/api/display/rotation` unrewritten, and the `chores-data` volume resolves to `/data` (`chores4irl_chores-data`). However the **host-bridge half is not ready**: one Critical (rotation `0` is rejected by `wlr-randr`/kanshi, which require the keyword `normal`) plus a cluster of Major host-side correctness/robustness gaps (false "calibrationMatrix guaranteed present" assumption, kanshi template-overwrite clobber, initial 0-vs-90 state desync, fire-and-forget with no failure feedback, underspecified NavBar slot) and one cross-cutting backend Major (`__dirname` is undefined in this ESM backend). **Requires changes before proceeding.**

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | FAIL | 0 critical, 2 major, 0 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 2 minor |
| 3 | Ordering & Cleanup | FAIL | 0 critical, 2 major, 2 minor |
| 4 | Integration & Conventions | FAIL | 0 critical, 1 major, 2 minor |
| 5 | Verification & Coverage | FAIL | 0 critical, 1 major, 3 minor |
| 6 | Completeness & Risk | FAIL | 1 critical, 7 major, 3 minor |

_(Counts above are raw per-subagent; the Findings below are deduplicated: 1 critical, 8 major, 11 minor.)_

### Findings

#### Critical (must fix before proceeding)

- **[Step 4] Rotation `0` must map to `normal`, not literal `0`, for wlr-randr and kanshi** _(Subagent #6; also raised by #1 as major)_: The wire contract carries integer `0|90|180|270` and the agent interpolates it directly into `wlr-randr --output "$CONNECTOR" --transform "$T"` and the kanshi `transform N` token. But `wlr-randr --transform` and kanshi's `transform` keyword accept `normal|90|180|270|flipped|...` — the upright orientation is `normal`, **not `0`** (confirmed in `deploy/pi/README.md`'s table "no rotation | `normal`" and `deploy/pi/display/kanshi-config`). So rotating back to upright (the most common "home" press) is rejected by both tools while 90/180/270 work. The Step 4 `case` table maps `0 → "1 0 0 0 1 0"` but that is the calibrationMatrix, not the transform token. The agent needs a separate token translation (`0 → normal`, others pass through) used for both the live `wlr-randr` arg and the persisted kanshi token, keeping the integer only on the wire and for the matrix lookup.

#### Major (should fix)

- **[Step 2] `rotationPath()` uses bare `__dirname`, undefined at runtime in this ESM backend** _(Subagents #1, #3, #4, #6 — all four)_: The plan's `path.resolve(__dirname, '../../data.db')` fallback claims to "mirror db.ts", but `db.ts` explicitly derives `__dirname` via `const __filename = fileURLToPath(import.meta.url); const __dirname = path.dirname(__filename);` precisely because the backend is `"type":"module"` + NodeNext. `@types/node` declares `__dirname` ambiently so `tsc`/`npm run build` passes, and every unit test sets `ROTATION_PATH` so the fallback never evaluates — the bug is fully latent past all plan gates, but throws `ReferenceError: __dirname is not defined` whenever both `ROTATION_PATH` and `DB_PATH` are unset (e.g. `npm run dev` hitting the route). Add the same two-line `fileURLToPath(import.meta.url)` preamble to `display.ts`.
- **[Step 3] Red component test references nonexistent `onRotate` prop; Green component prop is `onRotated`** _(Subagents #3, #5)_: Step 3 "Red (component)" renders with "a mocked `onRotate`" and asserts "the handler is called once", but Step 3 "Green" defines props `{ rotation, onRotated, onError }` and calls `onRotated(next)` only after `setRotation` (from `displayApi`) resolves. The prescribed test can never go green: under TS strict, passing `onRotate` to a component typed without it is a compile error failing the whole frontend suite; even ignoring types, no `onRotate` is ever called. The success test must mock `displayApi.setRotation` to resolve, then `await` and assert `onRotated` was called once with the next rotation; the rejection test makes it reject and asserts `onError`.
- **[Step 4] `<calibrationMatrix>` is NOT "guaranteed present by install-display-config.sh"** _(Subagent #6)_: The plan's `sed` of `<calibrationMatrix>` assumes the block always exists. `install-display-config.sh` only inserts it in the `else` branch (no `<libinput>` block at all); if `<libinput>` exists without a matrix it warns and `exit 1` without inserting, and the installer may never have run. A missing block makes the agent's `sed` silently no-op — display rotates but touch stays misaligned (exactly the failure the README warns about). The agent must verify/insert the block or fail loudly, and the "guaranteed present" claim must be dropped.
- **[Step 4] kanshi "overwrite from template" branch would clobber settings and reset rotation** _(Subagent #6)_: Step 4 offers "overwrite from a template OR sed only the `transform N` token" for persisting to `~/.config/kanshi/config`. The repo template hardcodes `transform 90`, so the overwrite branch always RESETS rotation to 90 (cannot carry the chosen value) and clobbers any drifted `mode`/`position`/`scale` on the single `output "DZX Z3 ..."` line. Only the sed-the-token approach is correct; the plan must mandate it rather than presenting both as equal.
- **[Step 5] Pinning `name: chores4irl` can orphan the existing backend data volume (chores DB loss)** _(Subagent #6; also #4 as minor, #3 as ordering minor)_: Adding top-level `name: chores4irl` makes the volume deterministically `chores4irl_chores-data`. If the deployed Pi's current Compose project name differs (different extract dir, or `COMPOSE_PROJECT_NAME` set), the next `up` mounts a NEW empty `chores4irl_chores-data` and orphans the old one — losing the live chores SQLite DB, not just `rotation.json`. The plan's mitigation only adjusts the agent's `C4I_ROTATION_STATE`, never the backend data volume. Must verify the current deployed volume name before pinning and document a migration path if it differs.
- **[Step 4/3] Fire-and-forget file bridge gives no UI feedback when the host agent fails to rotate** _(Subagent #6)_: The POST returns 200 as soon as the backend writes `rotation.json`. If the agent then fails (connector discovery empty, Wayland socket missing, config not writable, service down) it aborts to its journal, but the button already reported success — the user sees a successful press while nothing rotates, with no UI signal. Either add an acknowledgement channel (agent writes a status file the frontend polls) or explicitly document that "success" means "state recorded", not "rotation applied".
- **[Step 2/3/4] Initial state desync: `rotation.json` defaults to 0 but shipped display is `transform 90`** _(Subagent #6)_: GET defaults to `{rotation:0}` on ENOENT and the button seeds to 0 on mount, but the shipped kanshi config / physical display are `transform 90`. On a fresh deploy the agent's startup no-ops on the absent file (leaves 90); first press computes `0+90=90`, writes 90, agent applies 90 → no visible change (button looks broken); second press jumps to 180. Seed the initial desired rotation to the real shipped value (installer writes `rotation.json`, or the agent reads the live `wlr-randr` transform on startup when the file is absent).
- **[Step 3] NavBar right-slot wiring is underspecified and contradicts the existing scroller** _(Subagent #6)_: Step 3 says "wrap room tabs in a sub-flex and add a `flex-1` spacer so the button pins right regardless of tab scroll." The actual NavBar inner container is `flex space-x-1 overflow-x-auto scrollbar-none` — placing the button + spacer INSIDE the scroller lets it scroll off-screen when tabs overflow, contradicting "stays visible". To pin, the button must sit OUTSIDE the scroll container (outer `flex items-center`: `[scrollable tabs flex-1 min-w-0][button flex-shrink-0]`). The prop wiring ("pass the button or onRotate/props through") is also too vague to implement. Specify the concrete layout and the exact NavBar prop additions (explicit `rotation/onRotated/onError`, or a `rightSlot?: ReactNode`).

#### Minor (nice to fix)

- **[Step 3] Service export `setRotation` shadows App's `setRotation` state setter** _(Subagent #2)_: No bug today (App doesn't import the service `setRotation`), but a future `import { setRotation }` into `App.tsx` would silently shadow the React setter. Disambiguate (e.g. service `postRotation`/`applyRotation`, or App `setRotationState`).
- **[Step 3] `pending` disable flag not specified to reset on the error path** _(Subagent #2)_: Step 3 adds a `pending` flag to debounce taps and calls `onError` on rejection but never says to clear `pending` in a `finally`/catch. A single failed rotate (which the Step 7 forced-500 e2e triggers) could leave the button permanently disabled. Reset `pending` in a `finally`.
- **[Step 4/5] Agent default volume name `chores4irl_chores-data` is only guaranteed by the Step 5 compose pin (ordering inversion)** _(Subagent #3)_: Step 4 hardcodes the volume default before Step 5 pins `name:`. Soft inversion (nothing executes between authoring steps and there's a `C4I_ROTATION_STATE` override), but add a forward-note tying the Step 4 default to the Step 5 pin, or move the pin earlier. _(Related to the Major compose-pin finding but distinct aspect.)_
- **[Step 3] Re-export of `handleResponse` from `choreApi.ts` is dead weight** _(Subagent #3)_: `handleResponse` is referenced only inside `choreApi.ts` (all 5 uses in-file; no external importer). The extraction to `apiUtils.ts` is safe and atomic, but the "re-export from `choreApi.ts` to avoid churn" clause is unnecessary — have both `choreApi.ts` and `displayApi.ts` import directly from `./apiUtils`.
- **[Step 4] Single-letter bash vars (`d` in awk, `T` transform)** _(Subagent #4)_: Tolerated bash idiom but mildly violates the descriptive-naming rule (strictly enforced for TS/JS, which the plan satisfies). Optionally rename to `desc`/`transform`.
- **[Step 3] `App.test.tsx` not updated to mock the new `displayApi` mount call** _(Subagent #5)_: Step 3 wiring adds `getRotation().then(...).catch(()=>{})` in an App `useEffect`, but the ~25-test `App.test.tsx` mocks only `choreApi`. Every App render then fires a real `fetch('/api/display/rotation')`; the silent catch keeps tests green but adds nondeterministic network attempts / unhandled-rejection noise. Add `vi.mock('../services/displayApi', ...)`.
- **[Step 3] NavBar/App integration of the rotate button is covered only by e2e** _(Subagent #5)_: No vitest assertion that the button renders inside the assembled NavBar — only the Step 7 Playwright render check. A broken slot wiring would pass all unit suites. Add a `getByRole('button', { name: /rotate screen/i })` assertion to `App.test.tsx`.
- **[Step 2] Backend 500 (catch) branch for GET/POST is not unit-tested** _(Subagent #5)_: Step 2 covers happy/sad/ENOENT paths but not the route 500 branches (fs failure). The forced-500 case is only exercised on the frontend (Step 7 Playwright). Optionally add a backend test mocking `display.ts`/`fs` to reject and asserting `500 {success:false}`, or document the gap.
- **[Step 4] Startup-apply under `set -euo pipefail` is fatal if the Wayland socket isn't up yet** _(Subagent #6)_: `WantedBy=default.target` does not order the service after the compositor; an early `wlr-randr` failure aborts the script before the watch loop (Restart=always self-heals but the service flaps). Make the startup-apply non-fatal and/or wait for the socket.
- **[Step 2/4] Backend `writeFile` of `rotation.json` is not atomic** _(Subagent #6)_: The inotify `close_write` watch is largely safe, but the 2s polling fallback could read a partial write. The tolerant grep+allowlist reader is the stated mitigation and is adequate; a temp-file+rename on the backend write would make it fully race-free.
- **[Step 4] Self-discovery wayland-socket glob picks the first match arbitrarily** _(Subagent #6)_: `ls .../wayland-* | grep -v '\.lock$' | head -1` filters lockfiles but arbitrarily picks the first of multiple sockets. Fine for a single-session kiosk; prefer the `import-environment` value when present.

### Verification Gaps
- **Step 2**: Add a backend route test for the 500/catch branch (mock `readRotation`/`writeRotation` or `fs/promises` to reject) — or document that it is intentionally only e2e-covered.
- **Step 3**: Add an `App.test.tsx` assertion that the rotate button renders inside the NavBar (unit-level slot-integration coverage), and mock `displayApi` so the mount `getRotation()` is deterministic/offline.
- **Step 4 / Step 7**: The host agent and physical rotation remain manual-only by necessity; ensure the manual procedure also covers the `rotation:0 → normal` path and the touch-alignment (calibrationMatrix) check, since those are the highest-risk areas.

### To-Do: Required Changes

_(Step 5 of the skill — auto-apply / AskUserQuestion / loop — was intentionally skipped per the review request. All items below remain unchecked for the implementer or a follow-up apply pass. Each corresponds 1:1 to a deduplicated finding above.)_

**Critical**
- [x] [Step 4] Add a transform-token translation in the agent (`0 → normal`, 90/180/270 pass through) used for both `wlr-randr --transform` and the persisted kanshi `transform` token; keep the integer only on the wire and for the calibrationMatrix lookup. _(design_decision)_

**Major**
- [x] [Step 2] Add the ESM `__dirname` derivation to `display.ts` exactly as `db.ts` does — `import { fileURLToPath } from 'url'; const __filename = fileURLToPath(import.meta.url); const __dirname = path.dirname(__filename);` — and correct the "mirrors db.ts" note to include it. _(mechanical)_
- [x] [Step 3] Rewrite the Red (component) bullet to drop `onRotate`: mock `displayApi.setRotation`, render with `onRotated`/`onError` spies, `await`, assert `onRotated` called once with the next rotation on success and `onError` called on a rejected `setRotation`. _(design_decision)_
- [x] [Step 4] Drop the "calibrationMatrix block guaranteed present" assumption; have the agent verify `<calibrationMatrix>` exists before `sed` and either insert it (mirror the installer merge) or fail loudly to the journal rather than silently no-op the touch update. _(design_decision)_
- [x] [Step 4] Mandate sed-replacing only the `transform` token in the existing kanshi config (preserving `output`/`mode`/`position`/`scale`); remove the "overwrite from template" option, which resets rotation to the hardcoded 90 and clobbers drifted settings. _(design_decision)_
- [x] [Step 5] Before pinning `name: chores4irl`, document verifying the current deployed volume name (`docker volume ls | grep chores`, `docker compose ls`); add a data-migration/`COMPOSE_PROJECT_NAME` path for any mismatch so the backend's existing data volume is not orphaned. _(design_decision)_
- [x] [Step 4/3] Resolve the fire-and-forget feedback gap: either document that POST success means "state recorded, not applied" plus a journal check, or add an agent-written status file the frontend polls and surfaces if the apply did not land within N seconds. _(design_decision)_
- [x] [Step 2/3/4] Fix the initial 0-vs-90 desync: seed `rotation.json` to the real shipped transform (installer writes it on enable, or the agent reads the live `wlr-randr` transform on startup when the file is absent) so the button seeds to the true orientation. _(design_decision)_
- [x] [Step 3] Specify the concrete NavBar layout (button OUTSIDE the `overflow-x-auto` scroller: outer `flex items-center` with `[tabs flex-1 min-w-0][RotateScreenButton flex-shrink-0]`) and the exact NavBar prop additions (`rotation/onRotated/onError` or `rightSlot?: ReactNode`). _(design_decision)_

**Minor**
- [x] [Step 3] Disambiguate the `setRotation` name collision between the `displayApi` export and the App state setter. _(design_decision)_
- [x] [Step 3] Specify that `RotateScreenButton`'s `pending` flag is reset in a `finally`/catch so a failed rotate re-enables the button. _(design_decision)_
- [x] [Step 4/5] Add a forward-note tying the Step 4 hardcoded volume default to the Step 5 compose `name:` pin (or move the pin earlier) to remove the ordering inversion. _(design_decision)_
- [x] [Step 3] Drop the "re-export `handleResponse` from `choreApi.ts`" clause; import it directly from `./apiUtils` in both `choreApi.ts` and `displayApi.ts`. _(mechanical)_
- [x] [Step 4] Optionally rename bash single-letter vars (`d` → `desc`, `T` → `transform`) for naming-convention consistency. _(mechanical)_
- [x] [Step 3] Add `vi.mock('../services/displayApi', ...)` to `App.test.tsx` so the mount `getRotation()` is deterministic and offline. _(design_decision)_
- [x] [Step 3] Add an `App.test.tsx` assertion (`getByRole('button', { name: /rotate screen/i })`) covering the NavBar-slot integration at the unit layer. _(design_decision)_
- [x] [Step 2] Add a backend route test for the 500/catch branch (mock `display.ts`/`fs` to reject) or document that it is intentionally e2e-only. _(design_decision)_
- [x] [Step 4] Make the agent startup-apply non-fatal under `set -e` (and/or wait for the Wayland socket) so a transient missing socket does not prevent the watch loop from starting. _(design_decision)_
- [x] [Step 2/4] Consider writing `rotation.json` atomically on the backend (temp-file + rename) so the polling fallback can never observe a partial write. _(design_decision)_
- [x] [Step 4] Document that self-discovery assumes a single graphical session and prefers the `import-environment` `WAYLAND_DISPLAY` when present. _(design_decision)_

### Design Decisions (awaiting user input)

The following findings are `design_decision` (multiple valid approaches; require user/implementer choice). They are recorded here for persistence; per the review request, they were not auto-applied and no `AskUserQuestion` prompt was issued.

#### DD-1: [Step 4] How to map rotation `0` to the wlr-randr/kanshi transform token
| # | Option | Trade-off |
|---|---|---|
| 1 | Agent translates `0 → normal` before every `wlr-randr`/kanshi interpolation; wire stays `0\|90\|180\|270` | Keeps the integer wire contract trivially testable; one small translation point |
| 2 | Single case table mapping each integer to BOTH its transform string and its calibrationMatrix | One source of truth for both lookups; slightly larger table |

**Chosen:** _(pending)_

#### DD-2: [Step 4] calibrationMatrix block missing — insert vs fail
| # | Option | Trade-off |
|---|---|---|
| 1 | Agent inserts the block when missing (mirror installer merge) | Self-healing; touch always aligned; more agent logic |
| 2 | Agent aborts with a clear journal error and does not rotate | Keeps display+touch consistent (never rotates display without matching touch); rotation silently fails until installer is run |

**Chosen:** _(pending)_

#### DD-3: [Step 4/3] Host-apply feedback channel
| # | Option | Trade-off |
|---|---|---|
| 1 | Accept fire-and-forget; document success = "state written" + manual journal check | Zero added complexity; user can be misled when apply fails |
| 2 | Agent writes `rotation-status.json`; frontend polls and banners on mismatch | True end-to-end feedback; adds a poll loop and a second state file |

**Chosen:** _(pending)_

#### DD-4: [Step 2/3/4] Seed the initial rotation to the real orientation
| # | Option | Trade-off |
|---|---|---|
| 1 | Installer writes `rotation.json={rotation:90}` (current shipped value) on enable | Simple; correct at deploy time; static if shipped value later changes |
| 2 | Agent reads the live `wlr-randr` transform on startup when file absent, writes it back | Always reflects reality; depends on the Wayland session being up at startup |

**Chosen:** _(pending)_

#### DD-5: [Step 3] NavBar prop contract for the rotate button
| # | Option | Trade-off |
|---|---|---|
| 1 | NavBar takes explicit `rotation/onRotated/onError` props and renders the button itself | Explicit; NavBar coupled to rotation state |
| 2 | NavBar takes a `rightSlot?: ReactNode`; App passes `<RotateScreenButton/>` | Decouples NavBar from rotation; more generic slot |

**Chosen:** _(pending)_

#### DD-6: [Step 5] Compose name-pin migration safety
| # | Option | Trade-off |
|---|---|---|
| 1 | Verify-then-pin: only add `name:` after confirming the deployed volume is already `chores4irl_chores-data` | Safe; one manual check before pinning |
| 2 | Document an explicit volume migration (create + copy) for mismatched deployments | Handles the rename case; more operator steps |

**Chosen:** _(pending)_

_(Smaller design_decision minors — `setRotation` rename, `pending` reset location, App.test mock, NavBar unit assertion, backend-500 test, startup-apply guard, atomic write, wayland glob — are low-ambiguity and listed in the To-Do above; they do not each need a separate DD table.)_

---

### Verdict
[ ] Ready to proceed as-is
[ ] Proceed after minor fixes
[x] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #3 confirmed `handleResponse` has no external importer (re-export redundant), no circular import via `apiUtils`; #1 verified `fs`/`fileURLToPath` import needs. |
| Type annotations | [x] | #1 verified `ApiResponse<never>`, `VALID_ROTATIONS.includes`, cycling cast, shared-type import specifiers; flagged bare `__dirname`. |
| Error handling (status codes, exceptions, user feedback) | [x] | #2 traced 400/500 → `handleResponse` throw → `onError` → banner; #6 flagged fire-and-forget feedback gap + `pending` reset. |
| Test coverage (happy path, sad path, edge cases) | [x] | #5 verified happy/sad/ENOENT; flagged `onRotate` test mismatch, missing backend-500 test, App.test displayApi mock, NavBar unit gap. |
| Breaking changes (API contracts, shared state, DB schema) | [x] | #6 flagged compose name-pin volume orphan (DB loss risk); #2 verified volume real-path resolves to `/data`. |
| Config consistency (env vars, requirements pins, lint rules) | [x] | #4 verified `ApiResponse`+`satisfies`, boolean env parsing (Step 6), all four transform→matrix values, connector-vs-description distinction match repo. |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | #4 verified no TS/JS single-letter vars; noted bash `d`/`T` idiom; #2 flagged `setRotation` name collision. |

---

## Review — 2026-06-28 (Pass 2)

### Summary

Pass 1's eight applied fixes (`0→normal` token, ESM `__dirname`, `onRotated` prop, calibrationMatrix verify/abort, kanshi sed-only, compose verify-then-pin, installer rotation seed, NavBar `rightSlot`) were re-verified against source and all hold. However Pass 2 surfaces a **new Critical host-bridge blocker** the prior pass missed: the mandatory non-root systemd **user** service cannot read `rotation.json` because the named Docker volume lives under root-owned `/var/lib/docker/volumes/` (0700) — confirmed by `docker-compose.yml` using a named volume, not a bind mount. Plus three Majors: the 4-way rotation cycle reaches landscape states that trigger the existing portrait-only `#rotate-overlay` (hiding the app and the rotate button), the installer's `rotation.json` seed write into that same root-only path is unspecified for elevation/ownership, and the Step 2 500-branch test's hoisted `vi.mock('../display.js')` would poison the whole file and drop the statically-imported `VALID_ROTATIONS`. **Requires changes before proceeding.**

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 3 minor |
| 2 | Full-Stack Trace | FAIL | 0 critical, 1 major, 0 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 0 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 1 minor |
| 5 | Verification & Coverage | FAIL | 0 critical, 1 major, 1 minor |
| 6 | Completeness & Risk | FAIL | 1 critical, 1 major, 0 minor |

_(Raw per-subagent. Deduplicated total below: 1 critical, 3 major, 4 minor — Correctness's "500-branch mock drops VALID_ROTATIONS" minor is merged into Verification's major as the same root cause.)_

### Findings

#### Critical (must fix before proceeding)

- **[Step 4] Non-root systemd user service cannot read the root-`0700` Docker volume directory** _(Subagent #6)_: The agent is mandated to be a systemd **user** service (it needs the labwc session's `WAYLAND_DISPLAY`/`XDG_RUNTIME_DIR`, which a root/system service lacks), yet `STATE_FILE` defaults to `/var/lib/docker/volumes/chores4irl_chores-data/_data/rotation.json`. On a standard Docker install `/var/lib/docker/volumes` is `root:root` mode `0700` (and `/var/lib/docker` itself `0710/0711`), so a non-root user cannot traverse into it — `inotifywait` on `dirname(STATE_FILE)` and the read/grep in `apply_rotation` both fail with `EACCES`. Docker-group membership does NOT help (it grants socket access, not filesystem access to the root-owned `volumes/` tree). Confirmed: `docker-compose.yml` declares a **named** volume (`chores-data:/data`), not a host bind mount, so the data dir is under `/var/lib/docker/volumes/`. This is a head-on conflict between the two hard requirements (user service for Wayland vs. read a root-only path) and breaks the entire host bridge at runtime. Pass 1 pinned the volume *name* but never addressed *access permissions*; `README.md` has zero mention of root/sudo/permissions.

#### Major (should fix)

- **[Step 3 / Step 4] 4-way transform cycle reaches landscape states that trigger the portrait-only `#rotate-overlay`, hiding the app and the rotate button** _(Subagent #2)_: The app is portrait-only by explicit design — `frontend/src/index.css` ships `#rotate-overlay` (full-screen `z-9999`) shown via `@media (orientation: landscape) and (max-height: 500px)`, plus `#root { max-width: 768px }` with a portrait column layout. The shipped orientation is kanshi `transform 90` (a landscape-native panel rotated to portrait). Step 3 cycles `0(normal) → 90 → 180 → 270 → 0`, so `0` and `180` render the content in **landscape**; on a common small kiosk panel (800×480 / 1024×600) the rotated viewport height is < 500px, so `#rotate-overlay` covers the whole screen — including the rotate button mounted in the NavBar the overlay paints over. The user is then stuck in landscape with no in-UI way to rotate back, defeating the feature's goal. The overlay is a live, tested guard (`e2e/smoke.spec.ts` "portrait-enforcement overlay toggles with viewport orientation"). The plan never mentions `#rotate-overlay` or the portrait-only constraint.

- **[Step 5] Installer `rotation.json` seed write into the root-only volume path is unspecified for elevation/ownership** _(Subagent #6)_: Step 5 / DD-4 has the installer write `{"rotation":90}` into `…/chores4irl_chores-data/_data/rotation.json` when absent, but the existing `install-display-config.sh` runs as the pi user and only ever writes to `$HOME/.config` (no `sudo` anywhere). Writing into `/var/lib/docker/volumes/.../_data` needs root, and the plan specifies neither elevation, file mode, nor owner — a plain redirect fails with `EACCES`. (The backend read-back is fine: the Step 2 atomic temp+rename lets the `node` container user replace even a root-owned file because `/data` is `chown node:node`, and 0644 JSON is world-readable.) This gap is coupled to the Critical access-model decision and must be solved together with it.

- **[Step 2] 500-branch test's hoisted `vi.mock('../display.js')` poisons the whole file and drops the statically-imported `VALID_ROTATIONS`** _(Subagent #5; also raised by #1 as minor)_: Step 2 "Red" prescribes the 500/catch coverage as "in a separate test, `vi.mock('../display.js', ...)` (or mock `fs/promises`) so `readRotation`/`writeRotation` reject." Two compounding problems: (1) `vi.mock(...)` is hoisted to the top of the module and applies to the **entire file**, not "a separate test" — the rejecting mock would also break the happy-path tests in the same file. (2) `app.ts` statically imports `{ readRotation, writeRotation, VALID_ROTATIONS } from './display.js'` and the POST handler's `if (!VALID_ROTATIONS.includes(...))` guard runs **outside** the try/catch; a factory mock that omits `VALID_ROTATIONS` makes `.includes` throw a `TypeError` before the catch arm, so Express 5 emits its default HTML 500 (not `{success:false,error}`), failing the prescribed body assertion. `db-path.test.ts` is the precedent for per-test isolation via dynamic `import('../db.js')` + `vi.resetModules()` rather than a static hoisted mock.

#### Minor (nice to fix)

- **[Step 8 / Step 3] Frontend `vite build` does not type-check; "builds clean (TS strict)" is overstated** _(Subagent #1)_: The frontend build script is `"build": "vite build"` (esbuild transform only, no `tsc`), so type errors in `displayApi.ts` / `RotateScreenButton.tsx` / `NavBar.tsx` would not fail the build, and ESLint's `no-unused-vars` `varsIgnorePattern: '^[A-Z_]'` ignores a leftover PascalCase `ApiResponse` import. New-frontend-code type correctness is only surfaced by vitest/IDE. (The backend build IS a real `tsc` check, so that claim is accurate.) Add `tsc --noEmit` to the frontend verification or reword the claim.

- **[Step 3] New `rightSlot?: ReactNode` prop needs a `ReactNode` type import in `NavBar.tsx`** _(Subagent #1)_: Current `NavBar.tsx` imports only `RoomTab` (no React type imports). The Step 3 "Green (wiring)" bullet adds `rightSlot?: ReactNode` but never says to add `import type { ReactNode } from 'react';` — and since the frontend build does not type-check, the omission would not surface until vitest/IDE.

- **[Step 5] "the button and the static installer set the same values, so they stay consistent" is inaccurate** _(Subagent #4)_: The installer's kanshi step does a full-file overwrite from the template (which hardcodes `transform 90`) whenever the on-disk file differs. After a user rotates via the button (agent seds kanshi to e.g. `transform 180`), re-running the idempotent installer resets kanshi back to `transform 90`, clobbering the choice (rc.xml is left untouched, so a transient display/touch mismatch results). It is self-healing (the agent's startup-apply re-seds from `rotation.json` on next reboot), but the plan's consistency claim should be corrected. (Distinct from the already-fixed agent-side template clobber — this is the installer side.)

- **[Step 3] `App.test.tsx` displayApi mock must resolve `getRotation` in the factory, not a per-describe `beforeEach`** _(Subagent #5)_: `App.test.tsx` has no shared outer `beforeEach`; each describe block defines its own and many call `vi.clearAllMocks()`. If the implementer mirrors the choreApi pattern (bare `vi.fn()` in the factory, resolved per-block), the blocks that don't re-stub `getRotation` get a bare `vi.fn()` returning `undefined`; App's mount effect `getRotation().then(setRotation).catch(()=>{})` then calls `.then` on `undefined`, throwing synchronously in `useEffect` (the chained `.catch` does not swallow a throw from `.then` itself). Set the resolved value inside the `vi.mock` factory so it survives `clearAllMocks`.

### Verification Gaps
- **Step 2**: The prescribed 500-branch test cannot pass as worded — mandate the scoped `vi.doMock('fs/promises', ...)` (or `vi.doMock('../display.js', ...)` preserving `VALID_ROTATIONS` via `importActual`) + `vi.resetModules()` + in-test dynamic `import('../app.js')`, mirroring `db-path.test.ts`.
- **Step 7 / Step 4**: Manual host verification should explicitly cover (a) reading `rotation.json` from the volume path as the **pi user** (the access-model fix) and (b) confirming a landscape transform does not black out the UI via `#rotate-overlay`.

### To-Do: Required Changes

_(Step 5 of the skill — auto-apply / AskUserQuestion / loop — was intentionally skipped per the review request. All items below remain unchecked for the implementer or a follow-up apply pass. Each corresponds 1:1 to a deduplicated finding above.)_

**Critical**
- [x] [Step 4/5] Resolve the access-model conflict so the non-root Wayland **user** service can observe `rotation.json` without traversing the root-`0700` `/var/lib/docker/volumes/` tree. Update `STATE_FILE`, the installer seed path, the unit, and `README.md` to match the chosen mechanism. _(design_decision — see DD-7)_

**Major**
- [x] [Step 3/4] Decide how the rotate feature coexists with the portrait-only `#rotate-overlay` before implementing the 4-way cycle (prefer keeping every reachable state portrait-valid); document the chosen orientation set and any layout/overlay changes. _(design_decision — see DD-8)_
- [x] [Step 5] Specify exactly how/where the installer seeds `rotation.json` given the access mechanism chosen for the Critical — state the elevation (`sudo`?), file mode, and owner so both the container's atomic-rename overwrite and the agent's read succeed. _(design_decision — coupled to DD-7)_
- [x] [Step 2] Rewrite the 500-branch test prescription: use scoped `vi.doMock('fs/promises', ...)` (or `vi.doMock('../display.js', ...)` preserving `VALID_ROTATIONS` via `importActual`) + `vi.resetModules()` + in-test dynamic `import('../app.js')`, mirroring `db-path.test.ts`; drop the misleading "in a separate test, `vi.mock('../display.js')`" wording. _(mechanical)_

**Minor**
- [x] [Step 8/3] Add an explicit `tsc --noEmit` type-check to the frontend verification (or reword the "builds clean (TS strict)" claim to note `vite build` does not type-check and vitest/IDE is the type-confidence source). _(mechanical)_
- [x] [Step 3] Add `import type { ReactNode } from 'react';` to `NavBar.tsx` in the Step 3 "Green (wiring)" bullet. _(mechanical)_
- [x] [Step 5] Correct the "they stay consistent" sentence: note the static installer overwrites kanshi to the template's `transform 90`, so re-running it after a button rotation reverts kanshi (self-healed on the next reboot by the agent's startup-apply from `rotation.json`); optionally make the installer rotation-aware. _(mechanical)_
- [x] [Step 3] Specify that `App.test.tsx`'s `vi.mock('../services/displayApi', ...)` sets `getRotation`'s resolved value **inside the factory** (e.g. `getRotation: vi.fn().mockResolvedValue(0)`) so it survives every per-describe `vi.clearAllMocks()`. _(mechanical)_

### Design Decisions (awaiting user input)

#### DD-7: [Step 4/5] How the non-root Wayland user service reads `rotation.json` from the root-only Docker volume
**Context:** The agent must run as a systemd **user** service (for `WAYLAND_DISPLAY`/`XDG_RUNTIME_DIR`) but its state file lives in the named Docker volume under `/var/lib/docker/volumes/` (root:root 0700, non-traversable by the pi user). The installer seed write into that path has the same elevation problem. Both must be solved together.

| # | Option | Trade-off |
|---|---|---|
| 1 | Bind-mount the data dir (or a dedicated rotation dir) to a pi-user-owned host path in `docker-compose.yml` (e.g. `./chores-state:/data`); container and user service share a pi-owned path | Removes the `/var/lib/docker` dependency entirely; installer seed needs no sudo; but changes the volume model (migrate existing SQLite DB) |
| 2 | Run a small root **system** service (or sudoers-allowed helper) that copies/forwards `rotation.json` from the volume to a user-readable path the Wayland user service watches | Keeps the named volume; adds a second service and a copy hop |
| 3 | `setfacl u:<pi>:rX` on the volume path (or sudo-based read) | Least code, but fragile — Docker may reset ACLs; least preferred |

**Chosen:** _(pending)_

#### DD-8: [Step 3/4] How the rotate button coexists with the portrait-only `#rotate-overlay`
**Context:** The 4-way cycle reaches landscape transforms (`0`/`180` on a landscape-native panel) that trip the existing `@media (orientation: landscape) and (max-height: 500px)` full-screen overlay, hiding the app and the rotate button on a small kiosk panel — locking the user out of the very control that fixes it.

| # | Option | Trade-off |
|---|---|---|
| 1 | Cycle only between the two portrait transforms (`90 ↔ 270`); document `0/180` as intentionally unreachable | Every state stays portrait-valid; overlay never fires; simplest; reduces the feature to a portrait flip |
| 2 | Keep the 4-way cycle but verify the real panel's rotated height ≥ 500px (overlay never fires) AND make the layout usable in landscape, or relax/remove the overlay's `max-height:500px` guard | Full 4-way rotation; requires panel-dimension verification and landscape layout work, or weakening a tested guard |
| 3 | Re-scope to an explicit two-state portrait flip toggle | Matches the app's portrait-only design; abandons 0→90→180→270 |

**Chosen:** _(pending)_

---

### Verdict
[ ] Ready to proceed as-is
[ ] Proceed after minor fixes
[x] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #3 re-verified the `handleResponse`→`apiUtils` extraction is atomic and dead-import-safe (eslint `varsIgnorePattern '^[A-Z_]'`); #1 flagged missing `ReactNode` import in NavBar. |
| Type annotations | [x] | #1 re-verified `__dirname`/`0→normal`/cycling math/import specifiers; flagged frontend `vite build` does not run `tsc` so "TS strict" is overstated. |
| Error handling (status codes, exceptions, user feedback) | [x] | #2 re-traced 200/400/500 → `handleResponse` throw → `onError` → banner; fire-and-forget feedback already documented (Pass 1 DD-3). |
| Test coverage (happy path, sad path, edge cases) | [x] | #5 verified happy/sad/ENOENT + the new 500/App-mock/NavBar-slot additions; flagged the 500-branch `vi.mock` file-poisoning trap and the App.test factory-resolve requirement. |
| Breaking changes (API contracts, shared state, DB schema) | [x] | #6 re-verified NavBar `rightSlot` (only consumer is App.tsx) and apiUtils extraction (no external importer) are safe; surfaced the root-`0700` volume access blocker + installer seed elevation. |
| Config consistency (env vars, requirements pins, lint rules) | [x] | #4 verified env-var naming, systemd unit naming vs `chores4irl-backup.service`, transform→matrix table, bare-filename disambiguation; flagged installer-vs-button kanshi "consistency" claim. |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | #4 confirmed no TS/JS single-letter vars; bash `desc`/`transform` renames from Pass 1 applied; #2 confirmed `applyRotation` naming avoids the setter collision. |

### Note on the new Critical/Majors (Pass 1 misses)
The Critical (volume permissions) and the landscape-overlay Major are **cross-stack interactions in files the plan never references** (`/var/lib/docker/volumes` permissions; `frontend/src/index.css` `#rotate-overlay`) — Pass 1's subagents scoped to plan-named files and the endpoint contract, missing the host-OS filesystem-permission layer and the browser-CSS end of the round trip. The 500-branch test Major is a "fix verification stopped at plan text" miss: Pass 1 added the 500-test requirement but did not trace the prescribed `vi.mock` mechanism against vitest hoisting + the static `VALID_ROTATIONS` import.

---

## Review — 2026-06-28 (Pass 3)

### Summary

Pass 3 (final / hard cap) reverses the convergence trend: by reading the **AS-BUILT deployment record** (`plans/deploy/docker-raspberry-pi/docker-raspberry-pi.md`) and `git ls-files deploy/` — which **no prior pass read** — three new **Critical** factual blockers surface, all verified directly by the orchestrator. (1) The `deploy/pi/` files the plan's Steps 4–5 build on (`README.md`, `install-display-config.sh`, `display/*` kanshi/labwc templates) **do not exist**; `deploy/pi/` contains only `chores4irl-backup.{service,timer}`. Prior-pass subagents listed these phantom files in their `files_read`. (2) The panel identity is fabricated: the agent matches a **`DZX Z3`** description that appears nowhere in the repo or deploy record, while the real Pi is a single connector-named output `HDMI-A-1 @ 1024x600` that kanshi matches **by connector name** — so the agent's discovery returns empty and aborts on every rotation, and its kanshi `sed` no-ops. (3) The shipped orientation is **`transform 270`** (touch matrix `0 1 0 -1 0 1`), not the `90` the plan asserts throughout — seeding `rotation.json={rotation:90}` reintroduces exactly the first-load desync DD-4 was meant to eliminate. Plus three Majors (deploy user is `rmilarachi` not `pi`, and the load-bearing `uid 1000 = pi` no-sudo claim is unverified; `vi.resetModules()` does not clear a `vi.doMock` and can break sibling happy-path tests; an unsequenced bind-mount-dir ownership race lets `docker compose up` create `./chores-rotation` root-owned). **Not converged. Requires changes before proceeding.** These are hard-cap findings: tagged for resolution during implementation.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 0 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 1 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 1 minor |
| 4 | Integration & Conventions | FAIL | 3 critical, 1 major, 0 minor |
| 5 | Verification & Coverage | FAIL | 0 critical, 1 major, 1 minor |
| 6 | Completeness & Risk | FAIL | 2 critical, 3 major, 1 minor |

_(Raw per-subagent. Deduplicated total below: **3 critical, 3 major, 4 minor**. The "phantom deploy/pi files", "DZX Z3 / connector-name", "shipped 270 not 90", and "rmilarachi not pi" findings were each independently raised by both #4 and #6.)_

### Findings

#### Critical (must fix before proceeding)

- **[Step 4 / Step 5 / Research Findings] The `deploy/pi/` files the plan extends and reads do not exist** _(Subagents #4, #6; orchestrator-verified)_: Steps 4–5 and DD-1/DD-2 treat `deploy/pi/README.md` (cited 5+ times as the transform→calibrationMatrix "source of truth" and "current shipped values" table), `deploy/pi/install-display-config.sh` ("Extend …", "same house style as …", "same atomic temp-file + mv pattern already used in …", "the installer's existing touch-`calibrationMatrix` step is the prerequisite the agent pre-flight-checks"), and `deploy/pi/display/*` (the kanshi/labwc templates whose "hardcoded `transform 90`" drives the sed-not-overwrite reasoning) as **existing, version-controlled artifacts**. Verified via `git ls-files deploy/` and `ls deploy/pi/`: the directory contains **only** `chores4irl-backup.service` and `chores4irl-backup.timer`. Per `docker-raspberry-pi.md:561`, "all Step 10 artifacts live ON THE PI … NOT in the repo." There is no installer to extend, no template to sed-vs-overwrite, and no README table to read or update. Prior passes accepted these as real (their subagents even listed `deploy/pi/display/kanshi-config` and `install-display-config.sh` in `files_read`). The plan must either add a prerequisite step that **creates** `install-display-config.sh` + `README.md` (with the transform table) + `display/` templates and commits the Pi-resident kanshi/rc.xml, or be rewritten so Steps 4–5 operate directly on the on-Pi `~/.config` files with no installer/template/README dependency and document the calibration as a manual prerequisite.

- **[Step 4] Panel identity (`DZX Z3`, connector-by-description discovery) is fabricated — agent aborts/no-ops on the real Pi** _(Subagents #4, #6; orchestrator-verified)_: Step 4 sets `PANEL_DESC="${C4I_PANEL_DESC:-DZX Z3}"`, discovers the connector via `wlr-randr | awk index($0,"DZX Z3")`, and seds the kanshi line `output "DZX Z3 0000000000000" …`, with the prose premise "kanshi matches by description; the connector name drifts between `HDMI-A-1`/`HDMI-A-2`". `git grep "DZX Z3"` shows the string occurs **only** inside the rotate-screen-button plan/review files — nowhere in repo source or the deploy record. The real Pi (`docker-raspberry-pi.md:556`) is a **single** HDMI touchscreen on connector `HDMI-A-1 @ 1024x600`, and the shipped kanshi config matches **by connector name**: `profile { output "HDMI-A-1" mode 1024x600 position 0,0 transform 270 }` (touch panel is `yldzkj USB2IIC_CTP_CONTROL`, no `DZX Z3` anywhere). Consequences on real hardware: (1) `CONNECTOR=$(wlr-randr | awk index($0,"DZX Z3"))` returns empty → the agent's "abort if no connector found" fires on **every** rotation and nothing ever applies; (2) the kanshi `sed` targets an `output "DZX Z3 …"` line that does not exist → silent no-op, rotation never persists. The "matches by description / drifts between ports" framing is inverted for this single-`HDMI-A-1`, connector-named deploy. Align the agent to match/sed the `output "HDMI-A-1"` connector-name line (default `HDMI-A-1`, env-overridable) or auto-discover the sole connected output; drop the description-matching premise.

- **[Summary / DD-8 / Step 5 (DD-4) / Research Findings] Shipped orientation is `transform 270`, not `90` — wrong seed reintroduces the desync DD-4 fixes** _(Subagents #4, #6; orchestrator-verified)_: The plan asserts the shipped panel is kanshi `transform 90` in the Summary, DD-8 ("rotated to portrait (kanshi `transform 90`)"), Research Findings ("current shipped values (`transform 90` ↔ `0 -1 1 1 0 0`)"), and Step 5/DD-4 (seeds `rotation.json={rotation:90}` as "the shipped kanshi `transform 90`"). The AS-BUILT record (`docker-raspberry-pi.md:556,584`) shows the real Pi ships `output "HDMI-A-1" … transform 270` with touch `calibrationMatrix 0 1 0 -1 0 1` — and the plan's own case table maps `270 → "0 1 0 -1 0 1"`, confirming 270 is shipped. Seeding `90` makes `GET` report 90 while the display is physically at 270, so the first press computes `next=270` (a real 180° flip away from the user's actual orientation) — exactly the seed-vs-shipped desync DD-4 claims to eliminate. Change the installer seed to `{"rotation":270}` and correct every "shipped transform 90" reference (Summary, DD-8, Research Findings, any `display.ts`/agent/README comment) to 270 / matrix `0 1 0 -1 0 1`.

#### Major (should fix)

- **[Step 4 / Step 5 / Step 7 / DD-7] Deploy user is `rmilarachi`, not `pi`; the `uid 1000 = pi` no-sudo claim is unverified** _(Subagents #4, #6; orchestrator-verified)_: DD-7 hinges the entire no-sudo access model on "container `node` user is uid 1000 — the same uid as the Pi `pi` user," with manual verification "as the `pi` user" and seed "owner `pi`". The committed `deploy/pi/chores4irl-backup.service:8` and `docker-raspberry-pi.md:553,584` state the actual deploy user is **`rmilarachi`** (home `/home/rmilarachi`); there is no `pi` user. systemd `%h`/`$HOME` keep the paths user-agnostic (functionally OK if `rmilarachi` is uid 1000), but (a) every "pi"/"pi-owned"/"uid 1000 = pi"/"as the pi user" string is factually wrong, and (b) the load-bearing equality that the bind-mount dir owner uid equals the container `node` uid (1000) — on which the atomic temp+rename overwrite and the user-service read both depend — is asserted against the wrong username and never verified. Replace `pi` with `rmilarachi` (or neutral `$USER`/`$HOME`) throughout and add an explicit `id -u == 1000` pre-flight backing the DD-7 uid-equality claim.

- **[Step 2] `vi.resetModules()` does NOT clear a `vi.doMock` registration — the offered alternative can fail sibling happy-path tests** _(Subagent #5)_: The 500/catch bullet ends "add `vi.doUnmock('../display.js')` (**or `vi.resetModules()`**) so the mock does not leak into sibling tests." The parenthetical is wrong: in Vitest (backend `vitest ^4.1.4`) `vi.resetModules()` clears the **module cache** but not the **mock registry**; only `vi.doUnmock()`/`vi.unmock()` removes a `doMock`. The shared `beforeEach` (mirroring `db-path.test.ts`) calls only `vi.resetModules()`, so it does not undo the `doMock`. If an implementer relies on the parenthetical, the `display.js` `doMock` (readRotation/writeRotation rejecting) stays registered; the next sibling test's `await import('../app.js')` re-imports the still-mocked module and the happy-path GET/POST assertions get forced 500s and FAIL — unless the 500 test happens to be the file's last `it` (not guaranteed). Remove the "(or `vi.resetModules()`)" alternative; prescribe only `vi.doUnmock('../display.js')` (and optionally note that `resetModules` alone does not clear a `doMock`).

- **[Step 5] Bind-mount source-dir ownership race: `docker compose up` before the installer `mkdir` creates `./chores-rotation` root-owned** _(Subagent #6; orchestrator-verified)_: Step 5 adds the `./chores-rotation:/rotation` bind mount to `docker-compose.yml` **and** has the installer `mkdir`+seed it user-owned, but never sequences the two. The documented Pi flow (`docker-raspberry-pi.md:360-364`; root `README.md` "Updating an existing Pi deployment") runs `docker compose up -d` directly. If the user pulls the new compose and runs `up` **before** the new installer, Docker auto-creates the missing bind source `./chores-rotation` as `root:root` — then (a) the installer's non-sudo `mkdir`/`printf` as `rmilarachi` cannot write the seed (EACCES), (b) the backend `node` (uid 1000) gets EACCES on the atomic temp+rename write so `POST /api/display/rotation` returns 500, and (c) the systemd user service cannot create/observe the file. The DD-7 "user-owned, no sudo" premise collapses. Guarantee the dir exists user-owned before any `up`: enforce installer-first ordering, have the installer detect+`chown` a root-owned pre-existing dir, or commit a tracked `./chores-rotation/.gitkeep` placeholder so Docker never creates it root-owned.

#### Minor (nice to fix)

- **[DD-8] Portrait-only lockout rationale does not hold for the 1024x600 panel** _(Subagent #6; orchestrator-verified)_: DD-8 justifies the `90↔270` restriction by claiming `0`/`180` render landscape and `#rotate-overlay` "covers the whole screen … locking the user out." The overlay media query is `(orientation: landscape) and (max-height: 500px)` (`index.css:73`). The real panel is `1024x600`, so in landscape the viewport height is `600px > 500px` and `#rotate-overlay` **does not fire**. The lockout scenario cannot occur on this hardware and Step 7's optional "write `{rotation:180}` to confirm the overlay fires" would show nothing. Portrait-only remains a reasonable conservative default — keep it, but correct the rationale and the Step 7 expectation.

- **[Step 3] Failure-path button re-enable (the `finally` `pending` reset) is unasserted at any layer** _(Subagent #5)_: Step 3 mandates resetting `pending` in a `finally` so a failed rotate re-enables the button, explicitly tied to the Step 7 forced-500 e2e — but the Failure component test asserts only `onError` called / `onRotated` not, and the e2e asserts only the banner appears. The exact `finally`-not-`then` behavior has no automated coverage. Add `expect(screen.getByRole('button', { name: /rotate screen/i })).not.toBeDisabled()` after the awaited rejection in the Failure unit test.

- **[Step 7] Forced-500 e2e should fulfill with a JSON `{success:false,error}` body** _(Subagent #2)_: The forced-500 variant says it mirrors the complete-chore rollback test, which fulfills with `JSON.stringify({success:false,error:'Forced error'})`. If the rotation `route.fulfill` omits the body, `Response.json()` inside `handleResponse` throws a `SyntaxError` on the empty body; the banner still appears (so the assertion passes) but surfaces a parse message and never exercises the real `success:false` branch. Prescribe `route.fulfill({ status: 500, body: JSON.stringify({ success: false, error: 'Forced error' }) })`.

- **[Step 3] Dead `ApiResponse` import in `choreApi.ts` is not caught by any gate** _(Subagent #3)_: After Step 3 extracts `handleResponse` + its `ApiResponse` usage to `apiUtils.ts`, `choreApi.ts`'s `import type { Chore, ApiResponse }` must drop `ApiResponse`. The plan covers this in intent ("move handleResponse and its ApiResponse import"), but nothing mechanically flags a leftover: `eslint.config.js` `no-unused-vars` `varsIgnorePattern: '^[A-Z_]'` ignores `ApiResponse`, neither tsconfig sets `noUnusedLocals`, and no `npm run lint` step exists. Add an explicit instruction to rewrite the import to `import type { Chore } from '@customTypes/SharedTypes';`.

### Verification Gaps
- **Step 2**: The 500-branch isolation must use `vi.doUnmock('../display.js')` (not `vi.resetModules()`) to clear the `doMock`; otherwise sibling happy-path tests can fail depending on `it` ordering.
- **Step 3 / Step 7**: Add a unit assertion that the button is re-enabled (`not.toBeDisabled()`) after a failed rotate; the `finally`-reset is currently unverified at every layer.
- **Step 4 / Step 7**: The agent's connector discovery, kanshi `sed`, and seed value must be re-grounded against the **real** on-Pi config (`HDMI-A-1`, `transform 270`, user `rmilarachi`) before the manual verification procedure can pass — the current procedure tests a panel/orientation/user that do not exist on the target hardware.

### To-Do: Required Changes

_(Step 5 of the skill — auto-apply / AskUserQuestion / loop — was intentionally skipped per the review request. This is Pass 3, the hard cap; each item corresponds 1:1 to a deduplicated finding above.)_

> **Apply disposition (2026-06-28, by main agent + user).** Pass 3 ran while the working tree was on `chore/plans-housekeeping`, which does **not** contain PR #19's `deploy/pi/{README.md,install-display-config.sh,display/*}`. The reviewer therefore (a) saw those files "missing" and (b) reconciled the orientation/connector/panel against the **stale** AS-BUILT note in `plans/deploy/docker-raspberry-pi/docker-raspberry-pi.md`. Three "Critical" findings are artifacts of that branch/stale-doc context and were **REJECTED or REFRAMED** (annotated below); the remaining 7 findings are branch-independent and were **APPLIED**. Verified facts: PR #19's `kanshi-config` intentionally matches by the `DZX Z3 0000000000000` **description** (robust to HDMI-A-1↔HDMI-A-2 connector drift); `transform 90` is the **deliberate** value after the user reported the AS-BUILT `270` was upside-down post-remount (so reverting to `270` would re-introduce the bug). The agent's "discover the connector from `wlr-randr` by matching the description" approach is correct, not fabricated.

**Critical**
- [x] **[REFRAMED]** [Step 4/5] The plan builds on `deploy/pi/README.md`, `deploy/pi/install-display-config.sh`, and `deploy/pi/display/*`. These DO exist — on the `deploy/pi-display-configs` branch (PR #19), not on the housekeeping branch Pass 3 was run from. **Resolution:** added a **Prerequisites** section recording the PR #19 branch-ordering dependency, rather than recreating already-reviewed files. _(branch-context artifact — not recreating files)_
- [x] **[REJECTED]** [Step 4] "Replace the fabricated `DZX Z3` description-matching with `HDMI-A-1` connector-name match; drop the description premise." Not fabricated — PR #19's `kanshi-config` deliberately matches by the `DZX Z3 0000000000000` **description** precisely because the connector name drifts between HDMI-A-1/HDMI-A-2 (the original deploy bug). The agent correctly discovers the **connector** from `wlr-randr` by matching that description, and feeds the connector to `wlr-randr --output`. Dropping this would re-introduce the port-drift failure. _(branch-context artifact — reviewer couldn't see PR #19)_
- [x] **[REJECTED]** [Summary/DD-8/Step 5] "Revert shipped orientation `90` → `270` to match AS-BUILT." `270` is the **stale** AS-BUILT value; the user reported it renders **upside-down** after the panel was remounted, and `90` is the deliberate corrective shipped on PR #19. Reverting to `270` would re-introduce the upside-down bug. **Real safeguard already added** (Prerequisites): confirm upright on the Pi and keep the installer seed in lock-step with the shipped `kanshi-config` transform rather than hardcoding a literal in two places. _(branch/stale-doc artifact)_

**Major**
- [x] **[APPLIED]** [Step 4/5/7/DD-7] Replaced all `pi`/`pi-owned`/`uid 1000 = pi` references with `rmilarachi` throughout, and added an explicit `id -u == 1000` preflight to-do in Step 5 verifying the deploy user's uid equals the container `node` uid before relying on the shared-uid no-sudo model. _(mechanical)_
- [x] **[APPLIED]** [Step 2] Removed the "(or `vi.resetModules()`)" alternative; the bullet now prescribes `vi.doUnmock('../display.js')` in `afterEach` and notes that `resetModules` alone does not clear a `doMock` registration. _(mechanical)_
- [x] **[APPLIED]** [Step 5] Added a bullet guaranteeing `./chores-rotation` exists user-owned before `docker compose up`: commit a tracked `chores-rotation/.gitkeep` AND have the installer `mkdir -p` + `chown` a root-owned pre-existing dir, enforcing installer-before-compose ordering, with a `stat -c '%U'` verification. _(design_decision)_

**Minor**
- [x] **[APPLIED]** [DD-8] Corrected the portrait-only rationale (Summary, both DD-8 paragraphs, Step 7): on `1024×600` landscape height is `600px > 500px` so `#rotate-overlay` never fires — `90↔270` is now framed as a deliberate conservative default, not an overlay-forced lockout, with a "revisit if a panel's landscape height ≤ 500px" caveat. Step 7's overlay-on-180 check corrected accordingly. _(mechanical)_
- [x] **[APPLIED]** [Step 3] Added `expect(screen.getByRole('button', { name: /rotate screen/i })).not.toBeDisabled()` to the Failure component test, regression-protecting the `finally` `pending` reset at the unit layer. _(design_decision)_
- [x] **[APPLIED]** [Step 7] The forced-500 e2e now fulfills with `route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Forced error' }) })` so it exercises the real `handleResponse` `success:false` branch. _(design_decision)_
- [x] **[APPLIED]** [Step 3] Added the instruction to rewrite `choreApi.ts`'s type import to `import type { Chore } from '@customTypes/SharedTypes';` (dropping the now-dead `ApiResponse`), with a note that no eslint/`vite build` gate flags it — only `tsc --noEmit`. _(mechanical)_

### Missed-Finding Root Causes
| Finding | Root cause | Skill gap? |
|---|---|---|
| `deploy/pi/` installer/README/templates do not exist | **Trusted plan assertion + incomplete file reads**: Passes 1–2 accepted the plan's references to these files as real and never ran `git ls-files deploy/`; some prior subagents even fabricated `files_read` entries for them. The authoritative AS-BUILT record (`plans/deploy/docker-raspberry-pi/docker-raspberry-pi.md`) was never opened. | Partial gap — the "What to read is a floor" rule covers reading referenced files, but does not require **confirming a referenced file exists on disk** (vs. trusting a prior subagent's `files_read`). A "verify every plan-referenced path with `git ls-files`/`ls` before reviewing against it" check would have caught this in Pass 1. |
| Panel is `HDMI-A-1`, not `DZX Z3`; shipped `transform 270` not `90`; user `rmilarachi` not `pi` | **Scoped too narrowly**: Passes 1–2 scoped to the plan-named files and the endpoint contract; the deployment's ground-truth lives in a sibling plan (`docker-raspberry-pi.md`) the rotate plan never references but is squarely on its critical path. | Gap — Integration/Completeness "What to read" should include sibling deploy/AS-BUILT plans for any feature touching host/hardware config, not just files the plan names. |
| `vi.resetModules()` does not clear a `doMock` | **Fix verification stopped at plan text**: Pass 2 fixed the hoisted-`vi.mock` trap and prescribed `vi.doUnmock`, but added "(or `vi.resetModules()`)" without tracing the Vitest semantics difference. | No new gap — the existing "trace the prescribed mechanism against the real test runner" expectation covers this; it was an execution miss. |
| Bind-mount dir ownership race | **Scoped too narrowly**: Pass 2 introduced the bind mount to solve the root-`0700` volume access, but did not trace the new dir's creation ordering against the documented `docker compose up` deploy flow. | No new gap — ordering/intermediate-state checks cover this; it was introduced and not re-traced in the same pass. |

---

### Verdict
[ ] Ready to proceed as-is
[ ] Proceed after minor fixes
[x] Requires changes before proceeding

### Resolve During Implementation
Pass 3 is the hard cap (3 passes complete). The 3 Critical + 3 Major + 4 Minor findings above are **not converged** and are tagged for resolution during implementation. The three Criticals and the `rmilarachi`/uid Major are factual corrections grounded in `deploy/pi/` (`git ls-files`) and `plans/deploy/docker-raspberry-pi/docker-raspberry-pi.md` (AS-BUILT: `HDMI-A-1 @ 1024x600 transform 270`, touch matrix `0 1 0 -1 0 1`, user `rmilarachi`, repo at `~/chores4irl`) — they should be applied before any host-agent code is written, since the current Step 4 agent aborts on every rotation against the real hardware.

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #3 re-verified the `handleResponse`→`apiUtils` extraction is atomic; flagged the dead `ApiResponse` import in `choreApi.ts` is not gate-caught (eslint `varsIgnorePattern '^[A-Z_]'`, no `noUnusedLocals`, no lint step). |
| Type annotations | [x] | #1 PASS — re-verified `__dirname`, `0→normal`, cycling math, shared-type import specifiers (`@customTypes` alias, `.js` suffix) all hold. |
| Error handling (status codes, exceptions, user feedback) | [x] | #2 re-traced 200/400/500 → `handleResponse` throw → `onError` → banner; flagged forced-500 e2e should send a JSON body to exercise the real `success:false` branch. |
| Test coverage (happy path, sad path, edge cases) | [x] | #5 verified `db-path.test.ts`/`ReturnToTodayButton.test.tsx` patterns match; flagged `vi.resetModules` ≠ `doUnmock` (sibling-test breakage) and the unasserted failure-path re-enable. |
| Breaking changes (API contracts, shared state, DB schema) | [x] | #6 surfaced the bind-mount-dir ownership race vs. the documented `docker compose up` flow; #4 confirmed the apiUtils/rightSlot contracts are otherwise safe. |
| Config consistency (env vars, requirements pins, lint rules) | [x] | #4/#6 grounded against `docker-compose.yml`, `deploy/pi/`, and the AS-BUILT record: phantom `deploy/pi` installer/README/templates, fabricated `DZX Z3`, shipped `transform 270` not `90`. |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | #4 confirmed `chores4irl-rotation.service` matches `chores4irl-backup.service` naming; flagged the wrong `pi` username vs. the committed `rmilarachi` and the unverified `uid 1000` equality. |

---

## Review — 2026-06-28 (Pass 4)

### Summary

Pass 4 runs on the correct base: the working branch is `deploy/pi-display-configs`, rebased onto current `main`, where PR #19's `deploy/pi/{README.md,install-display-config.sh,display/kanshi-config,display/labwc-rc.xml.fragment}` **all exist** (verified `git ls-files deploy/pi/` + `ls`). This pass therefore supersedes Pass 3's three "Critical" findings, which were branch-context/stale-doc artifacts (Pass 3 ran on a housekeeping branch lacking those files and reconciled against the stale AS-BUILT note). Re-grounded against the real on-branch files: kanshi-config deliberately matches the panel by the `output "DZX Z3 0000000000000"` **description** (robust to HDMI-A-1↔HDMI-A-2 connector drift) and ships `transform 90` on purpose (the older `270` rendered upside-down after the panel was remounted); README's transform↔calibrationMatrix table matches the plan's Step 4 case table row-for-row. All six subagents returned **PASS**. Only **two Minor** wording/cosmetic findings remain (a `.gitkeep` path described as `deploy/`-relative that contradicts the repo-root `./chores-rotation` bind source; an unanchored kanshi `sed` that also rewrites documentation comment lines). **0 critical, 0 major — converged. The plan is ready for implementation.**

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 1 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 0 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 0 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 1 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 0 minor |
| 6 | Completeness & Risk | PASS | 0 critical, 0 major, 1 minor |

_(Raw per-subagent. Deduplicated total below: **0 critical, 0 major, 2 minor**. Subagents #1 and #4 independently raised the identical `.gitkeep`-path wording finding — merged into one.)_

### Re-verification of Prior-Pass Resolutions

All load-bearing prior-pass fixes were re-traced against source on this branch and **hold**:
- **`0 → normal` token (Pass 1 Critical)**: Step 4 case table maps `0 → "normal"`; matches `deploy/pi/README.md` ("no rotation | `normal`") and kanshi's keyword requirement. ✓
- **ESM `__dirname` in `display.ts` (Pass 1 Major)**: `db.ts` confirmed to use the `fileURLToPath(import.meta.url)` preamble + `path.resolve(__dirname, '../../data.db')`; the plan mirrors it. ✓
- **`onRotated` prop / `90↔270` toggle (Pass 1)**: component contract and tests consistent (`next = rotation===90?270:90`). ✓
- **kanshi sed-only, not template-overwrite (Pass 1/2)**: plan mandates sed-the-token; the shipped template hardcodes `transform 90`, confirming overwrite would clobber. ✓
- **DD-7 bind-mount access model (Pass 2 Critical)**: `docker-compose.yml` uses a named volume; `Dockerfile.backend` runs `USER node` (uid 1000) with chown'd `/data`; the `./chores-rotation:/rotation` bind + `ROTATION_PATH` + `.gitkeep`/installer-chown ownership guard + uid-1000 preflight are all present and coherent. ✓
- **`vi.doMock` + `vi.doUnmock` (Pass 3 Major)**: backend `vitest.config.ts` sets no `restoreMocks`/`clearMocks`, so `doMock` does not auto-clear; the plan's `afterEach vi.doUnmock('../display.js')` is required and correctly prescribed; `importActual` + spread preserves `VALID_ROTATIONS` so the out-of-`try` POST guard still passes. ✓
- **`rmilarachi` (not `pi`) + uid preflight (Pass 3 Major)**: plan uses `rmilarachi` throughout with an `id -u == 1000` preflight. ✓
- **DD-8 overlay rationale (Pass 3 Minor)**: `frontend/src/index.css` overlay fires at `(orientation: landscape) and (max-height: 500px)`; the 1024×600 panel's landscape height is 600px > 500px so it does not fire — the plan's corrected "deliberate conservative default" framing is accurate. ✓

No prior resolution needed to be re-opened.

### Findings

#### Minor (nice to fix)

- **[Step 5] `.gitkeep` described as `deploy/`-relative contradicts the repo-root `./chores-rotation` bind source** _(Subagents #1, #4)_: Step 5's ownership-race mitigation (a) says to commit a tracked "`deploy/`-relative `chores-rotation/.gitkeep`". But the bind mount is `./chores-rotation:/rotation` and `docker-compose.yml` lives at the repo root, so the bind source resolves to **repo-root** `chores-rotation/`. If an implementer reads "`deploy/`-relative" literally and commits `deploy/chores-rotation/.gitkeep`, the actual bind source stays absent from the `git archive` tarball and Docker still auto-creates it `root:root` — the exact failure mechanism (a) is meant to prevent. The surrounding prose ("next to `docker-compose.yml`") makes the intent recoverable and the installer `mkdir`+`chown` fallback (b) self-corrects, so this is non-blocking — but the wording is internally inconsistent with the bind path used everywhere else in the plan. Fix: change "a tracked `deploy/`-relative `chores-rotation/.gitkeep`" to "a tracked repo-root `chores-rotation/.gitkeep` (next to `docker-compose.yml`, matching the `./chores-rotation` bind source)".

- **[Step 4] kanshi `sed` is unanchored — also rewrites documentation comment lines, contradicting the step's own "ONLY the output line" wording** _(Subagent #6)_: Step 4 prose says the agent seds "ONLY the `transform <token>` token on the existing `output "DZX Z3 0000000000000"` … line" and gives the literal `sed -i -E 's/(transform )[^ ]+/\1'"$transform_token"'/' "$KANSHI_DEST"`. That command has no line anchor, so `sed` rewrites the first `transform ` match on **every** line. The shipped `deploy/pi/display/kanshi-config` (a verbatim copy of what installs to `~/.config/kanshi/config`) contains `transform ` on four comment lines (9, 20, 21, 24 — including the worked `wlr-randr --output HDMI-A-1 --transform 90` example) plus the functional output line 30. kanshi ignores comments, so there is **no functional break, no touch/display desync, and no data loss** — but on every rotation the in-file documentation gets silently flipped, misleading the next maintainer reading the live Pi config. Fix: anchor to the output line, e.g. `sed -i -E '/^[[:space:]]*output /s/(transform )[^ ]+/\1'"$transform_token"'/' "$KANSHI_DEST"`, matching the prose.

### Verification Gaps

None new. Verification across all 8 steps is layer-appropriate and sufficient (backend supertest happy/sad/ENOENT/500-catch; frontend vitest service + component success/failure + `App.test.tsx` displayApi mock-in-factory + NavBar-slot assertion; Playwright forced-500 with JSON `{success:false,error}` body; Step 8 explicit `tsc --noEmit -p frontend/tsconfig.json`; host agent correctly scoped to documented manual verification + `bash -n` + non-CI selftest harness).

### To-Do: Required Changes

_(Step 5 of the skill — auto-apply / AskUserQuestion / loop — was intentionally skipped per the review request. Both items below are Minor and remain unchecked for the implementer or a follow-up apply pass. Each corresponds 1:1 to a deduplicated finding above.)_

**Minor**
- [x] **[APPLIED]** [Step 5] Reworded the `.gitkeep` mitigation to "a tracked **repo-root** `chores-rotation/.gitkeep` (next to `docker-compose.yml`, matching the `./chores-rotation` bind source exactly)". _(mechanical)_
- [x] **[APPLIED]** [Step 4] Anchored the kanshi `sed` to the `output` directive line — `sed -i -E '/^[[:space:]]*output /s/(transform )[^ ]+/\1'"$transform_token"'/' "$KANSHI_DEST"` — leaving documentation comment lines that contain the word `transform` intact across rotations. _(mechanical)_

### Verdict
[x] Ready to proceed as-is (after the two optional Minor wording fixes)
[ ] Proceed after minor fixes
[ ] Requires changes before proceeding

**Converged: 0 critical, 0 major.** Pass 4 is clean — the plan is ready for implementation. The two Minor findings are cosmetic/clarity improvements with no functional impact and do not block proceeding.

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #3 re-confirmed the `handleResponse`→`apiUtils` extraction removes the dead `ApiResponse` import in the SAME bullet; eslint `varsIgnorePattern '^[A-Z_]'` + no `noUnusedLocals` means only Step 8 `tsc --noEmit` gates it (plan relies on it correctly); `RotateScreenButton` created before App wiring. |
| Type annotations | [x] | #1 traced `rotationPath()`/`__dirname` ESM preamble vs `db.ts`, backend `'../../types/SharedTypes.js'` + frontend `@customTypes/SharedTypes` specifiers, `ApiResponse<never>`/`satisfies`/`VALID_ROTATIONS.includes` all accurate against source. |
| Error handling (status codes, exceptions, user feedback) | [x] | #2 traced 200/400/500 → `handleResponse` throw → `onError` → `.bg-red-700` banner for every `success:false` body (400, 500-catch, forced-500); error key (`error`) aligned both ends. |
| Test coverage (happy path, sad path, edge cases) | [x] | #5 verified `db-path.test.ts` pattern, the 500-branch `doMock`+`doUnmock` correctness vs Vitest semantics, component `90↔270`/failure `not.toBeDisabled()`, App.test factory-resolve, NavBar-slot assertion, Playwright forced-500 JSON body, Step 8 `tsc --noEmit`. |
| Breaking changes (API contracts, shared state, DB schema) | [x] | #6/#3 confirmed DD-7 decouples rotation.json from the named volume (compose `name:` pin now guards only the DB); bind-dir ownership race mitigated by `.gitkeep` + installer chown + uid preflight; no DB migration. |
| Config consistency (env vars, requirements pins, lint rules) | [x] | #4/#6 grounded against the REAL on-branch `deploy/pi/README.md`, `kanshi-config` (description `DZX Z3 0000000000000`, `transform 90`), `docker-compose.yml`, `nginx.conf`: transform↔matrix table matches row-for-row; connector-vs-description distinction correct by design; `ROTATION_SECRET` uses explicit empty/unset parsing. |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | #4 confirmed `chores4irl-rotation.service` matches the `chores4irl-backup.service` precedent, `rmilarachi` (not `pi`) throughout, `applyRotation` avoids the setter collision, lucide-react `RotateCw`, no single-letter TS/JS vars. |

### Note on Pass 3 reversal
Pass 3's three "Critical" findings (phantom `deploy/pi/*` files; "fabricated" `DZX Z3` panel; "shipped `transform 270` not `90`") were **branch-context and stale-doc artifacts**: Pass 3 ran on a housekeeping branch that did not contain PR #19's commits and reconciled against the stale AS-BUILT note in `plans/deploy/docker-raspberry-pi/docker-raspberry-pi.md`. On the correct `deploy/pi-display-configs` base, all four `deploy/pi/` files exist and were read; the `DZX Z3` description-match is a deliberate connector-drift safeguard; and `transform 90` is the deliberate corrected orientation. Those three findings are **not reproduced** in Pass 4. The seven branch-independent Pass 3 findings were already applied.

## Review — 2026-06-28 (Pass 5 — settings panel)

### Summary

The plan converged at Pass 4 (0 critical, 0 major). Since then a single design change landed: **DD-5 was revised from a bare rotate button in the NavBar `rightSlot` to a `SettingsPanel`** — a NavBar toggle (gear `Settings` icon ↔ `X`, `aria-expanded` reflecting state, accessible name swapping `Open controls` ↔ `Close controls`) that conditionally mounts an overlaid single-row banner. Rotate is the one functional control (now nested inside the panel); five others — Brightness `Sun`, Screen blank `MonitorOff`, Restart `Power`, Undo `Undo2`, Redo `Redo2` — ship as disconnected optimistic placeholders (`data-placeholder='true'`, no-op handlers, no `displayApi` import). This touched the Summary, the DD-5 bullet, Step 3 (new `SettingsPanel` Red/Green TDD bullets + rotate nested in panel + App.tsx renders `<SettingsPanel/>` into `rightSlot` + App.test slot assertion now checks the `Open controls` toggle), Step 7 (e2e opens the panel before clicking rotate, in both success and forced-500 variants), and Step 8 (typecheck list adds `SettingsPanel.tsx`). Pass 5 scrutinized **only** the newly-added settings-panel surface; the converged backend/host-agent/rotate items were spot-checked and the panel change did **not** break them. All six subagents returned **PASS**. Deduplicated total: **0 critical, 0 major, 2 minor — still converged. The plan remains ready for implementation.**

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 critical, 0 major, 0 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 0 minor |
| 3 | Ordering & Cleanup | PASS | 0 critical, 0 major, 0 minor |
| 4 | Integration & Conventions | PASS | 0 critical, 0 major, 1 minor |
| 5 | Verification & Coverage | PASS | 0 critical, 0 major, 0 minor |
| 6 | Completeness & Risk | PASS | 0 critical, 0 major, 2 minor |

_(Raw per-subagent: 3 minor. Deduplicated total below: **0 critical, 0 major, 2 minor**. Subagents #4 and #6 independently raised the identical abs-overlay-clipping-under-`overflow-hidden` note — merged into one.)_

### Panel-surface verification (what Pass 5 confirmed)

All load-bearing settings-panel claims were traced against source on this branch and **hold**:
- **lucide-react icon exports** (`Settings, X, Sun, MonitorOff, Power, Undo2, Redo2`, plus `RotateCw`): all are real named exports. `frontend/package.json` pins `lucide-react ^1.8.0`; #1 verified against the 1.8.0 tarball `dist/lucide-react.d.ts` (named exports + matching `settings.js`/`x.js`/`sun.js`/`monitor-off.js`/`power.js`/`undo-2.js`/`redo-2.js`/`rotate-cw.js`) and #4 confirmed against `node_modules`. ✓
- **Component contract**: `SettingsPanel` props `{rotation, onRotated, onError}` thread straight through to `RotateScreenButton`; App.tsx `onRotated={setRotation}` (Dispatch assignable to `(next:DisplayRotation)=>void`) and `onError={setError}` (string assignable to `string|null` setter) typecheck. ✓
- **NavBar `rightSlot`**: NavBar currently destructures only `{rooms, selectedRoom, onSelect}` and has no right slot today; adding `rightSlot?: ReactNode` + the outer flex row (slot OUTSIDE the `overflow-x-auto` scroller) is a clean additive change. `div#NavBar` itself carries `border-b border-gray-700 flex-shrink-0` — **no `overflow`** — so it does not clip the banner; the plan preserves those classes. ✓
- **Collapsed-by-default test validity**: Step 3 Green mounts the banner **conditionally** ("When `open`, render the overlaid single-row banner"), so `screen.queryByRole('button', { name: /rotate screen/i })` correctly returns `null` when closed — a true conditional mount, not a CSS-hidden false positive. ✓
- **Accessible-name swap + six-control assertions**: toggle `aria-label={open ? 'Close controls' : 'Open controls'}` + `aria-expanded={open}` back the `/open controls/i`→`/close controls/i` and the six-`aria-label` open-state assertions; `data-placeholder='true'` + `aria-label` on the five placeholders make `getByLabelText('Brightness')` + `toHaveAttribute` viable, and the no-op handler keeps the `applyRotation` spy uncalled. ✓
- **App.test factory pattern**: `App.test.tsx` mocks via top-level factory and uses `vi.clearAllMocks()` (never `resetAllMocks`), so a factory-set `getRotation: vi.fn().mockResolvedValue(90)` survives; the `getByRole('button', { name: /open controls/i })` toggle renders immediately (collapsed default) and is reachable. ✓
- **e2e opens panel first in BOTH variants**: Step 7 success path and the `page.route()` forced-500 variant each open the panel before clicking rotate (the rotate button is hidden until open), so the button is found in both; the forced-500 JSON `{success:false,error}` body still surfaces through the panel layer to the `.bg-red-700` banner. ✓
- **Ordering**: within Step 3, `RotateScreenButton` (Green bullet) is created BEFORE `SettingsPanel` (its importer) BEFORE App.tsx/NavBar wiring; SettingsPanel TDD Red-before-Green intact; all icon imports added in the same Green bullet they are used; Step 8 `tsc --noEmit -p frontend/tsconfig.json` covers the whole `src` tree (`include: ['src']`), so `SettingsPanel.tsx` + all new files are type-checked. ✓
- **Placeholder inertness**: placeholders carry no `displayApi` import and cannot reach the endpoint; the inertness test locks this in. ✓

No prior-pass resolution needed to be re-opened; the panel change did not regress any converged item.

### Findings

#### Minor (nice to fix)

- **[Step 3] Inert placeholder buttons are focusable + activatable with no inertness affordance (a11y/UX)** _(Subagent #6)_: The five placeholders render as real `<button type='button'>` with full `aria-label`s, no-op `onClick`, and the SAME `min-h-[44px] min-w-[44px] bg-gray-700 hover:bg-gray-600 rounded-full` styling as the functional rotate button, carrying only `data-placeholder='true'` (a non-semantic marker invisible to assistive tech). A keyboard or screen-reader user can Tab to and activate `Brightness`/`Screen blank`/`Restart`/`Undo`/`Redo` and the button silently does nothing — no `disabled`, no `aria-disabled='true'`, no visual cue distinguishing inert from active (the hover state even implies interactivity). The `SettingsPanel` test deliberately locks in this inert-but-enabled behavior. This does not break functionality and matches the plan's "looks complete / optimistic" intent, but the plan never records it as a deliberate tradeoff. NON-BLOCKING. Suggested disposition: either add a one-line note in the Step 3 Green bullet acknowledging the inert-button tradeoff as intentional, OR signal inertness with `aria-disabled='true'` + `opacity-50` + a `(coming soon)` label suffix (keep the no-op handler and avoid the `disabled` attribute, which would drop the buttons from the a11y tree and break the keyboard-focus assertion).

- **[Step 3] Absolute overlay banner sits inside two App-level `overflow-hidden` ancestors — clipping unverified for the panel layout** _(Subagents #4, #6, merged)_: The banner is `absolute right-0 top-full mt-1 z-40` anchored in a `relative` wrapper. Moving `rightSlot` OUTSIDE the NavBar `overflow-x-auto` scroller correctly removes the *horizontal* scroller as an ancestor (it becomes a sibling), so the banner is not clipped by it. However the `relative` wrapper still renders inside App.tsx's `<div className="App h-full flex flex-col overflow-hidden">` and its inner `<div className="flex flex-col h-full overflow-hidden bg-gray-900 px-4 pt-4">` — both `overflow-hidden`. An absolutely-positioned descendant is still clipped by an `overflow-hidden` ancestor of its containing block. For the shipped 1024×600 portrait panel a single row of six `min-w-[44px]` buttons (~300px) anchored `right-0` and dropping just below the NavBar fits within bounds, so in practice it is **not** clipped — both subagents independently judged it fine for this layout — but the plan asserts the panel "overlays rather than reflowing" without ever verifying the double `overflow-hidden` does not clip the dropdown (the classic abs-overlay-inside-overflow-hidden footgun). LOW-CONFIDENCE / NON-BLOCKING. Suggested disposition: add a clip-check to Step 3 Refactor or Step 7 manual verification (open the panel on the real 1024×600 panel and confirm all six controls are visible and un-clipped); if clipping is ever observed — or a future multi-row/taller panel is added — render the banner via a React portal or `fixed` positioning to escape the App-level `overflow-hidden` boxes.

### Verification Gaps

None new. The panel test coverage is layer-appropriate: `SettingsPanel.test.tsx` covers collapsed-default (conditional-mount `queryByRole` null), open (six controls by `aria-label` + name swap + `aria-expanded`), close, placeholder inertness (`data-placeholder` + spy-not-called), and the rotate-wiring assertion; `App.test.tsx` adds the `Open controls` slot-integration assertion with a deterministic `displayApi` factory mock; Step 7 Playwright opens the panel before rotate in both the success and forced-500 variants; Step 8 type-checks `SettingsPanel.tsx`.

### To-Do: Required Changes

_(Step 5 of the skill — auto-apply / AskUserQuestion / loop — was intentionally skipped per the review request. Both items below are Minor and remain unchecked for the implementer or a follow-up apply pass. Each corresponds 1:1 to a deduplicated finding above. Neither blocks proceeding.)_

**Minor**
- [x] **[APPLIED]** **[Step 3] Record the inert-placeholder a11y tradeoff** — added a note to the placeholder-buttons bullet stating the optimistic "looks active" style is intentional per product direction (buttons stay in the a11y tree with a no-op handler), with the `aria-disabled` + `opacity-50` + `(coming soon)` fallback documented (and an explicit "not the `disabled` attribute" caveat) for later if needed. _(design_decision — kept optimistic per user)_
- [x] **[APPLIED]** **[Step 3 / Step 7] Add an overlay clip-check for the banner under the App-level `overflow-hidden` ancestors** — added an "Overflow caveat" sub-bullet to the SettingsPanel Green step: verify on the real 1024×600 panel that the six controls render un-clipped, and fall back to a React portal / `fixed` positioning to escape the overflow context if clipped. _(mechanical)_

### Verdict
[x] Ready to proceed as-is (after the two optional Minor notes)
[ ] Proceed after minor fixes
[ ] Requires changes before proceeding

**Converged: 0 critical, 0 major.** Pass 5 is clean — the settings-panel surface is internally consistent with `RotateScreenButton`, `NavBar` (`rightSlot`), and `App.tsx`; the lucide-react icons all exist; the open/close a11y assertions are valid against the conditional-mount markup; and both e2e variants account for the rotate button being hidden until the panel opens. The two Minor findings are non-blocking a11y/UX clarity improvements with no functional impact.

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | #1/#3 confirmed all panel icon imports (`Settings, X, Sun, MonitorOff, Power, Undo2, Redo2`) are real `lucide-react@^1.8.0` exports and added in the same Green bullet they're used; `RotateCw` stays in `RotateScreenButton`; no dead imports introduced by the panel. |
| Type annotations | [x] | #1 traced `SettingsPanelProps`/`RotateScreenButtonProps` (`rotation/onRotated/onError`), `useState<DisplayRotation>(0)`, `onRotated={setRotation}`/`onError={setError}` assignability, and `rightSlot?: ReactNode` — all type-accurate against source. |
| Error handling (status codes, exceptions, user feedback) | [x] | #2 traced App→SettingsPanel→RotateScreenButton→`applyRotation`→`handleResponse` throw→`onError`→red banner through the new panel layer; forced-500 JSON body still surfaces after the panel opens. |
| Test coverage (happy path, sad path, edge cases) | [x] | #5 confirmed every prescribed `SettingsPanel.test.tsx` TL query is reachable against the conditional-mount Green markup; App.test factory mock + slot assertion valid; Step 7 opens panel in both variants; Step 8 type-checks `SettingsPanel.tsx`. |
| Breaking changes (API contracts, shared state, DB schema) | [x] | #1/#2 confirmed the panel is a pure additive frontend wrapper — wire contract, backend, and host agent unchanged; placeholders carry no `displayApi` import and hit no endpoint. |
| Config consistency (env vars, requirements pins, lint rules) | [x] | #3 confirmed `eslint.config.js` + `frontend/tsconfig.json` (`include: ['src']`) gate the new files via Step 8 `tsc --noEmit`; no new packages (lucide-react already installed). |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | #4 confirmed `SettingsPanel.tsx` lives in `frontend/src/components/nav/`, dark-theme 44px buttons match `ReturnToTodayButton`, lucide-react used per the icon-library rule, no window globals for `open`/`rotation` state, descriptive names throughout. |

### Note on missed-finding root causes (Step 6)
Not applicable. The settings-panel surface did not exist in Passes 1–4 (DD-5 was revised to the panel only after Pass 4 converged), so the two Pass-5 Minor findings are about brand-new plan text, not issues prior passes overlooked. No prior pass had anything to miss here, and no converged item was found broken by the panel change. Step 7 (skill self-improvement) is therefore also skipped (no missed findings → no skill gap to address).
