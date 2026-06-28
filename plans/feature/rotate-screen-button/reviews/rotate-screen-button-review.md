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
- [ ] [Step 4/5] Resolve the access-model conflict so the non-root Wayland **user** service can observe `rotation.json` without traversing the root-`0700` `/var/lib/docker/volumes/` tree. Update `STATE_FILE`, the installer seed path, the unit, and `README.md` to match the chosen mechanism. _(design_decision — see DD-7)_

**Major**
- [ ] [Step 3/4] Decide how the rotate feature coexists with the portrait-only `#rotate-overlay` before implementing the 4-way cycle (prefer keeping every reachable state portrait-valid); document the chosen orientation set and any layout/overlay changes. _(design_decision — see DD-8)_
- [ ] [Step 5] Specify exactly how/where the installer seeds `rotation.json` given the access mechanism chosen for the Critical — state the elevation (`sudo`?), file mode, and owner so both the container's atomic-rename overwrite and the agent's read succeed. _(design_decision — coupled to DD-7)_
- [ ] [Step 2] Rewrite the 500-branch test prescription: use scoped `vi.doMock('fs/promises', ...)` (or `vi.doMock('../display.js', ...)` preserving `VALID_ROTATIONS` via `importActual`) + `vi.resetModules()` + in-test dynamic `import('../app.js')`, mirroring `db-path.test.ts`; drop the misleading "in a separate test, `vi.mock('../display.js')`" wording. _(mechanical)_

**Minor**
- [ ] [Step 8/3] Add an explicit `tsc --noEmit` type-check to the frontend verification (or reword the "builds clean (TS strict)" claim to note `vite build` does not type-check and vitest/IDE is the type-confidence source). _(mechanical)_
- [ ] [Step 3] Add `import type { ReactNode } from 'react';` to `NavBar.tsx` in the Step 3 "Green (wiring)" bullet. _(mechanical)_
- [ ] [Step 5] Correct the "they stay consistent" sentence: note the static installer overwrites kanshi to the template's `transform 90`, so re-running it after a button rotation reverts kanshi (self-healed on the next reboot by the agent's startup-apply from `rotation.json`); optionally make the installer rotation-aware. _(mechanical)_
- [ ] [Step 3] Specify that `App.test.tsx`'s `vi.mock('../services/displayApi', ...)` sets `getRotation`'s resolved value **inside the factory** (e.g. `getRotation: vi.fn().mockResolvedValue(0)`) so it survives every per-describe `vi.clearAllMocks()`. _(mechanical)_

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
