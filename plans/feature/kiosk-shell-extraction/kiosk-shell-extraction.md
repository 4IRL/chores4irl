# Kiosk-Layer Extraction — pi-kiosk shell + agent (design doc)

> **What this file is.** A cross-repo architecture design doc, not an implementation plan
> for a single chores4irl feature. It records the decision (2026-07-15) to extract every
> kiosk/screen-specific concern out of chores4irl into a standalone repo on the user's
> **personal** GitHub account (`rmilarachi/pi-kiosk`), so the Pi's 10" touchscreen features
> (touch lock, auto screen-blank, device-control console) run **in parallel with, and
> independent of, whatever web app is displayed on the screen**. Implementation happens in
> later sessions: most of it in the new repo (which this doc seeds), plus exactly one
> chores4irl feature (`F15`, defined here and in `plans/META-PLAN.md`). This doc is the
> contract both sides build against.

## Summary

chores4irl currently carries two shipped features that belong to the *screen*, not the
*app* — the auto screen-blank (`F1`, #27) and the double-tap accidental-touch lock (`F2`,
#28) — plus a fully-specified-but-unbuilt device-control console (`F3` + `F7`–`F13`).
All of these are portable to any future application shown on the same wall-mounted Pi.
They move to a new two-component system in `rmilarachi/pi-kiosk`:

- **kiosk-shell** — a thin, always-running web page that Chromium's kiosk mode points at
  (replacing `http://localhost/` as the kiosk URL). It embeds the displayed app
  (chores4irl today; anything tomorrow) in a full-viewport `<iframe>` and renders the
  extracted overlays above it: `TouchLockOverlay` (z-90), `ScreenBlankOverlay` (z-100),
  and the `F3`-style console panel (gear↔X, single-row icon banner). React 19 + Vite + TS,
  mirroring the chores4irl toolchain so the shipped `F1`/`F2` components and tests port
  near-verbatim.
- **kiosk-agent** — a host-side systemd **user** service (Python) on `127.0.0.1:8127`
  providing (a) a global input-activity SSE feed read from evdev (the load-bearing piece:
  a cross-origin iframe swallows all pointer/keyboard events, so the shell cannot see
  activity inside the app), (b) the hardware-control API the console buttons call directly
  (rotate, brightness, display power, restart), and (c) agent-owned config
  (`GET/PATCH /api/config`) — required because the kiosk Chromium runs `--incognito`,
  wiping localStorage on every boot.

The agent's direct localhost HTTP API **supersedes** META-PLAN's host-bridge pattern
(app backend → state file in a bind mount → `inotifywait` host watcher) for `F13`/`F7`/
`F8`/`F10`; the rotate plan's host-side design decisions are harvested, not re-derived
(see DD-8). chores4irl ends up a plain web app: a new feature **`F15`** removes the
`F1`/`F2` overlays once the shell reaches parity on the Pi and commits an embeddability
guarantee. App-specific console controls (`F11` undo / `F12` redo) stay in chores4irl,
surfaced later through a versioned `kiosk/v1` postMessage contract (DD-3).

## Research Findings

Repo-verified facts this design leans on:

- **Inactivity detection cannot stay in the page.** `useScreenBlank.ts` and
  `useTouchLock.ts` both re-arm their 5-minute timers from `document`-level
  `pointerdown`/`keydown` listeners (`frontend/src/hooks/useScreenBlank.ts:62-71`,
  `useTouchLock.ts:24-33`). A shell page hosting the app in a **cross-origin iframe**
  receives none of those events — browsing contexts don't propagate input across origins.
  This single fact forces the agent's evdev activity feed (DD-2).
- **The shell and the app are different origins even on one host.** The app is served on
  `:80` (nginx container), the shell will sit on `:8080` — `http://localhost/` vs
  `http://localhost:8080/` are distinct origins. No DOM reach-through; postMessage with
  pinned `targetOrigin` is the only channel (DD-3).
- **`--incognito` forecloses browser-side config.** The kiosk autostart
  (`~/.config/autostart/chores4irl-kiosk.desktop`, as-built notes in
  `plans/completed/docker-raspberry-pi/docker-raspberry-pi.md`) launches
  `chromium --kiosk --ozone-platform=wayland ... --incognito http://localhost/`.
  localStorage is wiped every boot → config must live host-side (DD-4).
- **The overlays port near-verbatim.** `ScreenBlankOverlay.tsx` (full-viewport portal,
  `z-[100]`, swallows the waking tap) and `TouchLockOverlay.tsx` (`z-[90]`, double-tap
  ≤1500 ms and ≤60 px via `Math.hypot`, 400 ms `CLOSING_SETTLE_MS` unmount handshake) have
  no chore-app coupling. What does **not** port is the `App.tsx` integration —
  `inert={isBlanked || isLocked}` and the force-close-dialogs effect
  (`App.tsx:133-139, 299, 316`) — which is *replaced* by the shell overlay physically
  covering the iframe (an overlay div above a cross-origin iframe blocks all input to it).
- **chores4irl is embeddable today, by accident.** `nginx.conf` sets no
  `X-Frame-Options` / CSP `frame-ancestors`. This must become a documented guarantee
  (`F15`), not an accident, and a stated requirement for any future displayed app (DD-6).
- **Host display facts** (from `deploy/pi/README.md` + the rotate plan): the compositor is
  labwc (Wayland); `wlr-randr --output` takes the **connector name** (`HDMI-A-1`/`-2`)
  which drifts between ports and must be discovered at apply time; kanshi edits are not
  live (only `wlr-randr` rotates immediately); touch calibration is a separate labwc
  `calibrationMatrix` that must agree with the transform (table in `deploy/pi/README.md`);
  transform `0` maps to the token `normal`; anything driving these needs the graphical
  session's `WAYLAND_DISPLAY`/`XDG_RUNTIME_DIR`, i.e. a systemd **user** service.
- **The `F13` rotate plan is the closest prior art** and is superseded in part: its
  chores-backend host-bridge (Express `GET/POST /api/display/rotation` → `rotation.json`
  → rmilarachi-owned bind mount → `inotifywait` watcher) collapses into a direct
  shell→agent HTTP call. Its host-side decisions survive intact (DD-8).
- **`#rotate-overlay`** (the landscape guard in `frontend/src/index.css`) is
  viewport-relative and keeps working unchanged inside the iframe — no migration needed.
- **SSE inside an iframe works normally** — the app's `EventSource('/api/events')`
  multi-device sync is unaffected by embedding.

## Architecture Overview

```
Chromium --kiosk --incognito ──► http://localhost:8080          (kiosk-shell, nginx container)
  ┌─────────────────────────────────────────────────────────┐
  │ kiosk-shell page                                        │
  │   <iframe src={config.target_url}>  ◄── chores4irl      │
  │       (or any future web app)  at http://localhost/     │
  │   TouchLockOverlay  (z-90)                              │
  │   ScreenBlankOverlay (z-100)                            │
  │   ConsolePanel (gear↔X, top-right, single-row banner)   │
  │                                                         │
  │   EventSource ──► http://127.0.0.1:8127/api/events      │
  │   fetch ────────► /api/config · /api/display/* ·        │
  │                   /api/restart                          │
  └─────────────────────────────────────────────────────────┘
kiosk-agent (systemd user service, Python, binds 127.0.0.1:8127)
    evdev readers (/dev/input/event*) ──► throttled activity SSE
    blank-schedule state machine (config-owned) ──► blank-state SSE (+ optional wlopm)
    hardware ops: wlr-randr/kanshi/labwc rotate · brightness · wlopm power · restart
    config: ~/.config/pi-kiosk/config.toml  (GET/PATCH /api/config)
```

**State-machine ownership split:**

- **Blank = agent-owned.** The 21:00–06:00 schedule lives in agent config, is
  hardware-coupled (optional real power-off), and must survive shell page reloads. The
  shell is a dumb renderer: it subscribes to `blank-state` SSE, mounts/unmounts the black
  overlay, and calls wake on tap.
- **Lock = shell-owned.** The lock is gesture/UI-coupled and per-session — consistent with
  `F2`'s resolved local-only scope. The shell owns the state machine, re-armed by the
  agent's activity feed **plus** its own `document` listeners (covering taps that land on
  shell chrome rather than the iframe).

## Design Decisions

- **DD-1 — Blank implementation: hybrid, staged.** Phase 2 ships a straight overlay port
  of `F1` (behavior parity with what's on the wall today: 21:00–06:00 window, tap-to-wake
  swallowing the tap, 5-min inactivity re-blank, real wall-clock). A later config-flagged
  agent enhancement adds **real display power-off** (`wlopm --off <connector>`) after a
  short grace period (~30 s) *behind* the already-black overlay. Tap-to-wake with the
  panel powered off still works: the touchscreen keeps emitting evdev events, the agent
  sees the tap, runs `wlopm --on`, and the tap itself lands on the shell's still-mounted
  black overlay, which swallows it exactly as `F1` does today — **no evdev grab needed**.
  Invariant: the overlay stays mounted the entire time the display is powered off.
  Rationale: real power saving without risking migration parity or input-grab complexity.
  (Rejected: power-off-only with no overlay — the waking tap would fall through to the
  app; evdev grab-and-swallow — needless privilege and complexity.)
- **DD-2 — Touch lock: shell overlay above the iframe.** A parent-page overlay div blocks
  all input to a cross-origin iframe, so the double-tap unlock detection stays in the
  shell (it receives the taps while the overlay is shown) — `TouchLockOverlay`/
  `TouchLockIndicator` port near-verbatim, keeping the ≤1500 ms/≤60 px qualification and
  the 400 ms closing handshake. The inactivity **re-arm** consumes the agent's activity
  SSE (throttled to ≤1 event/s — the shell needs "there was activity," not every event)
  plus the shell's own `document` listeners. Port `useTouchLock` with its activity source
  abstracted (`useActivity(sources)`), shared with the blank overlay's re-blank timer.
- **DD-3 — App-specific console controls via a versioned postMessage contract
  (`kiosk/v1`).** Undo (`F11`) and redo (`F12`) act on chore data and **cannot** move to
  the shell. Envelope (pinned `targetOrigin` both directions, origins from config):
  - app → shell: `{ kiosk: 'v1', type: 'register-controls', controls: [{ id, label,
    icon, enabled }] }` · `{ type: 'controls-state', ... }` · optional `{ type:
    'activity' }` hint.
  - shell → app: `{ kiosk: 'v1', type: 'console-action', id }` · `{ type: 'kiosk-state',
    blanked, locked }`.
  The shell renders registered controls generically in the console banner and never
  hardcodes app semantics. `F11`/`F12` remain chores4irl features, **deferred until the
  contract exists** (pi-kiosk Phase 4); chores4irl becomes the contract's first
  app-side client.
- **DD-4 — Config is agent-owned and agent-served.** `~/.config/pi-kiosk/config.toml`:
  `target_url`; `blank { start_hour, end_hour, inactivity_min, power_off }`;
  `lock { enabled, inactivity_min }`; `display { panel_desc, portrait_pair }`;
  `security { shell_origin, app_origin }`. The shell fetches `GET /api/config` at boot
  (build-time `VITE_*` fallback for dev only). `F9`'s settings UI becomes
  `PATCH /api/config`. Forced by fact, not taste: `--incognito` wipes localStorage every
  boot, and the schedule must also drive the agent's own state machine.
- **DD-5 — Agent security.** Bind `127.0.0.1` only (kiosk-local control — acceptable and
  consistent with `F2`'s local-only resolution; LAN/remote control explicitly out of
  scope). CORS `Access-Control-Allow-Origin` pinned to exactly the shell origin from
  config. Subprocess **arg-vectors only** — never shell interpolation. Rotation allowlist
  `{normal, 90, 180, 270}` and brightness clamped 0–100 before any command is built
  (carries the `F13` plan's injection guard forward). Restart requires body
  `{"confirm": true}` and sits behind a shell-side confirm dialog.
- **DD-6 — Embedding requirements for displayed apps (a documented contract).** Any app
  shown by the shell: must not send `X-Frame-Options` or CSP `frame-ancestors` denying the
  shell origin; must be usable full-viewport in an iframe; SSE works normally; keyboard
  input inside the iframe is invisible to the shell (covered by the agent feed). The shell
  focuses the iframe on load and after each overlay dismisses (keyboard routing).
  chores4irl's guarantee lands as an `nginx.conf` comment + README note in `F15`.
- **DD-7 — Agent technology.** Python 3 + `python3-evdev` + an apt-installable async HTTP
  server (aiohttp), as a systemd **user** service (`kiosk-agent.service`,
  `WantedBy=default.target`) so it inherits the labwc session's
  `WAYLAND_DISPLAY`/`XDG_RUNTIME_DIR` (reuse the `F13` plan's env-import solutions).
  Deploy prerequisite: the `rmilarachi` user joins the `input` group for
  `/dev/input/event*` read access.
- **DD-8 — `F13` (rotate) harvest list.** Carried over from
  `plans/feature/rotate-screen-button/rotate-screen-button.md` into the agent: connector
  name discovered at apply time from `wlr-randr` (never hardcoded — it drifts between
  HDMI ports); a single `case` table for transform → token → `calibrationMatrix`
  (`deploy/pi/README.md` is the source); integer `0` → keyword `normal`; sed-anchored
  kanshi `transform` token edit (never template overwrite) + guarded labwc
  `calibrationMatrix` edit + `labwc --reconfigure`; startup-apply non-fatal;
  allowlist-before-interpolation; the portrait-only `90 ↔ 270` button toggle as the
  deliberate default (wire contract still accepts all four; that plan's corrected DD-8
  rationale applies unchanged); seed state from the shipped kanshi config. **Dropped:**
  the Express `/api/display/rotation` endpoint, `rotation.json`, the bind mount, the
  compose `name:` pin (its rotate motivation disappears; its DB-volume-determinism value
  can be re-raised separately as infra hardening), the `inotifywait` watcher, and
  `SettingsPanel` in chores4irl's NavBar.
- **DD-9 — chores4irl overlay removal: outright removal in `F15`, no feature flag.**
  Remove the `F1`/`F2` hooks/components/wiring in one PR *after* shell parity is verified
  on the Pi. A single deployment target + git history + the ported copies in pi-kiosk make
  a flag dead weight. The interim double-overlay window (shell overlays live while the
  in-app overlays still run inside the iframe) is functional but annoying (double unlock,
  double black layer) — keep it to one deploy cycle. (Rejected: env-gated flag — permanent
  complexity for a one-week window.)
- **DD-10 — Brightness feasibility flag (deliberately unresolved).** The DZX Z3 is an HDMI
  panel — backlight sysfs is likely absent. Candidates: `ddcutil` (if the panel speaks
  DDC/CI), or software dimming (gamma via `wl-gammarelay` or similar). Resolve at the
  pi-kiosk brightness feature's own planning, not here; the console button ships as a
  placeholder until then (the `F3` placeholder-first pattern migrates with the console).

## Naming & New-Repo Layout

Repo: **`rmilarachi/pi-kiosk`** (personal account, not 4IRL — alternatives considered:
`kiosk-shell`, `wall-kiosk`).

```
pi-kiosk/
  shell/     React 19 + Vite + TS + vitest (mirrors chores4irl toolchain) — nginx
             container on :8080, compose service `kiosk-shell`
  agent/     Python + pytest — systemd user unit kiosk-agent.service, HTTP on 127.0.0.1:8127
  deploy/    units, install.sh, the Chromium autostart .desktop (committed for the first
             time), and — at Phase 3 — the display config + docs migrated from
             chores4irl's deploy/pi/
  plans/     seeded from this doc's Migration Phases
```

## Cross-Repo Split

**Moves to pi-kiosk:**
- `F1`/`F2` overlay + hook code (**ported, not shared** — copies, since the repos share no
  packages): `useScreenBlank.ts`, `ScreenBlankOverlay.tsx`, `useTouchLock.ts`,
  `TouchLockOverlay.tsx`, `TouchLockIndicator.tsx`, and their tests.
- The console panel — `F3`'s spec (gear↔X toggle, single-row overlaid banner, control
  icons, placeholder-first rollout at the new repo's discretion).
- Rotate / brightness / manual blank-wake / restart / auto-blank settings
  (`F13`/`F7`/`F8`/`F10`/`F9`), re-architected onto the agent per DD-8/DD-4.
- `deploy/pi/display/*` + `install-display-config.sh` (Phase 3; chores4irl keeps them
  until then).
- Ownership of the Chromium kiosk autostart `.desktop` (URL flips to `:8080` in Phase 1).

**Changes in chores4irl:**
- **`F15` (new):** delete the `F1`/`F2` hooks/components/`App.tsx` wiring + their tests;
  add the embeddability guarantee (nginx comment + README note); update root README
  deployment notes to point at pi-kiosk for screen concerns.
- Later (pi-kiosk Phase 4): `F11`/`F12` implemented app-side on the `kiosk/v1` contract.

**Stays in chores4irl:**
- Everything else: the entire chore app, SSE bus, backup systemd units
  (`deploy/pi/chores4irl-backup.*`), the Docker deploy on `:80`, the `F4`/`F5`/`F6`/`F14`
  backlog, and the `#rotate-overlay` landscape guard (viewport-relative; works in-iframe).

## Migration Phases

The wall display keeps working at every step; each phase has a rollback.

1. **Scaffold + iframe passthrough** *(pi-kiosk)*. Shell renders only the full-viewport
   iframe of `http://localhost/`; agent skeleton serves `GET /api/config`; autostart
   `.desktop` URL switched to `:8080`. `F1`/`F2` still run *inside* the iframe
   (full-viewport, so behavior is unchanged — the overlays just render within the frame).
   **End state:** kiosk boots into the shell and the chores app is indistinguishable from
   today. **Rollback:** revert the `.desktop` URL.
2. **Overlays + activity feed.** Agent evdev activity SSE; port `F1`/`F2` into the shell
   (DD-1 overlay-only, DD-2); verify parity on the Pi (blank window, wake-tap swallow,
   re-blank, lock re-arm, double-tap unlock). Then the chores4irl **`F15`** PR removes the
   in-app overlays (DD-9). **Rollback:** shell overlays are config-disableable
   (`lock.enabled`, blank window); `F15` is a revertable single PR.
3. **Console + hardware controls.** Shell console panel (gear↔X per `F3`'s spec); agent
   rotate (DD-8 harvest — supersedes the `F13` plan's bridge), manual blank/wake (`F8`),
   restart (`F10`), brightness if feasible (`F7`/DD-10); migrate `deploy/pi/display/*`
   docs; optional wlopm power-off flag (DD-1). **Rollback:** controls are additive; each
   lands behind its own PR.
4. **Settings + contract.** `F9` settings UI editing agent config (DD-4); implement
   `kiosk/v1` postMessage (DD-3); chores4irl `F11`/`F12` become schedulable as app-side
   features. **Rollback:** contract is versioned; absence degrades to no app controls in
   the banner.

## Risks / Open Questions

- **Brightness feasibility** (DD-10) — unknown until probed on the panel.
- **evdev permissions** — `input`-group membership is a manual host step; document in
  pi-kiosk's install docs.
- **Agent-down degradation** — the shell must not brick the display: show a small
  non-blocking badge, keep the iframe interactive, degrade to no blanking and lock re-arm
  from shell-chrome events only.
- **Double-overlay interim UX** (DD-9) — bounded to one deploy cycle between pi-kiosk
  Phase 2 parity and `F15` merging.
- **wlopm availability on trixie** — verify on the Pi before wiring DD-1's power-off flag
  (fallback: `wlr-randr --output <connector> --off`, same session-env constraints).
- **Future apps that set `frame-ancestors`** — DD-6 is a requirement on displayed apps,
  not an assumption; check before adopting any third-party page.
- **The compose `name:` pin** from the `F13` plan loses its rotate motivation; whether to
  pin the project name for DB-volume determinism is now a detached, optional chores4irl
  infra question.
- **This session's scope** was docs-only in chores4irl; the pi-kiosk repo itself does not
  exist yet — Phase 1 starts there.

## Impact on the chores4irl backlog

| ID | Disposition |
|---|---|
| F1 (shipped #27) · F2 (shipped #28) | Stay shipped; behavior relocates to pi-kiosk at Phase 2; code removed by **F15** |
| F3 — console container | **Superseded** → pi-kiosk shell console (Phase 3) |
| F7 — brightness · F8 — manual blank/wake · F10 — restart | **Superseded** → pi-kiosk agent controls (Phase 3) |
| F9 — auto-blank settings UI | **Superseded** → pi-kiosk settings on `PATCH /api/config` (Phase 4) |
| F13 — rotate (plan exists) | **Superseded in part** → pi-kiosk agent (DD-8 harvest); chores-backend bridge dropped |
| F11 — undo · F12 — redo | **Remain chores4irl features**, re-scoped onto the `kiosk/v1` contract; deferred until pi-kiosk Phase 4 |
| **F15 — adopt kiosk-shell (new)** | Remove F1/F2 overlays + commit embeddability guarantee; gated on pi-kiosk Phase 2 parity |
| F4 · F5 · F6 · F14 | Unaffected (F6's URL alias, if it lands, becomes the natural `target_url`) |

## Status
finished: false
