- [ ] F4: Remove 'Details' and 'Long-term task' toggle from the Add Task form. Propagate the removal from the database and other associated schema related to these fields.
- [ ] F5: Make 'Add Task' button deck transparent blur background, allowing the chores list visible slightly visible beneath for a more modern, fluid feel. The button will remain locked at the bottom and opaque as the chores list scrolls, but you should be able to see the chore bars on the sides of the button.
- [ ] F6: Explore options by which local users can access a URL alias rather than an IP address and port. e.g. users connected to the local network can type 'C4I' in their browser, instead of [local_IP_address]:[port]
- [ ] F14 (added 2026-07-08): All text input fields should have an 'x' to clear any typed substring. Applies to every free-text input currently in the app: the persistent chore-search bar, and the Add/Edit chore form's Name and Room fields. Does not apply to the Details field (already slated for removal by F4), the Duration/Frequency fields (numeric), or Last Completed (date). Absorbs and supersedes the prior unscheduled follow-up note under F9-L (search-bar-only clear button).
- [ ] F11 (re-scoped 2026-07-15): Undo — allow the user to recover from accidental touch and chore completion. Bounded undo cache (1–2 levels sufficient if complexity/size limited); an undo is itself a write that must emit on the SSE bus. **Implemented in chores4irl**, surfaced through the pi-kiosk console via the `kiosk/v1` postMessage contract (chores4irl is the contract's first app-side client). Deferred until pi-kiosk Phase 4 delivers the contract — see `plans/feature/kiosk-shell-extraction/kiosk-shell-extraction.md`.
- [ ] F12 (re-scoped 2026-07-15): Redo — re-apply an action undone via F11; pairs with F11's cache (same 1–2-level bound). Same surfacing as F11 (`kiosk/v1` contract); depends on F11 + pi-kiosk Phase 4.
- [ ] F15 (added 2026-07-15): Adopt kiosk-shell — remove the F1 auto-screen-blank and F2 touch-lock overlays from the app (their behavior is now provided by the pi-kiosk shell in front of the iframe-embedded app), and commit the embeddability guarantee (no `X-Frame-Options`/`frame-ancestors` denying the shell origin; recorded as an nginx.conf comment + README note). Runs only after pi-kiosk Phase 2 parity is verified on the Pi. See `plans/feature/kiosk-shell-extraction/kiosk-shell-extraction.md`.

## Settings / device-control panel — MIGRATED to pi-kiosk (2026-07-15)

The device-control panel ("console") and its controls no longer ship inside chores4irl.
Per the kiosk-layer extraction decision (design doc:
`plans/feature/kiosk-shell-extraction/kiosk-shell-extraction.md`), the screen belongs to a
standalone **`rehankalu/pi-kiosk`** repo — a kiosk-shell web page (Chromium's kiosk
target, embedding the displayed app in an iframe) plus a host-side kiosk-agent service —
so the console works regardless of which application is displayed. Disposition of the
former section's items:

- **Panel container (F3)** → pi-kiosk shell console (same design: gear↔X toggle,
  single-row overlaid icon banner; placeholder-first rollout at the new repo's discretion).
- **Brightness (F7)**, **manual screen blank/wake toggle (F8)**, **Restart (F10)** →
  pi-kiosk agent controls, called directly over localhost HTTP (the old
  frontend→backend→state-file→host-agent bridge design is superseded).
- **Auto screen blank/wake settings (F9)** → pi-kiosk settings UI editing agent-owned
  config (`PATCH /api/config`), which also carries F1's formerly hardcoded 9pm/6am times.
- **Rotate (F13)** → pi-kiosk agent; the host-side decisions of
  `plans/feature/rotate-screen-button/rotate-screen-button.md` are harvested (see that
  file's supersession banner and the design doc's DD-8).
- **Undo / Redo** → remain chores4irl features: re-listed above as F11/F12 (re-scoped onto
  the `kiosk/v1` contract).
