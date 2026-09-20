# Push Review: feature/local-url-alias

## Review 1
Generated: 2026-09-19 21:05
Comparison: origin/main (f007927)...HEAD (ab5864b)
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
`set-hostname.sh` validates the hostname with an anchored RFC 1123 regex before any side effect, runs `set -euo pipefail`, backs up every system file before rewriting it, and only ever greps two whitelisted keys out of user-data (the `users:` hash is never printed).
- minor — `plans/feature/local-url-alias/**`: the Pi's private LAN IP (`192.168.1.214`) and Wi-Fi MAC are committed in cleartext across the plan/research/review docs. RFC1918 + LAN-only; optional redaction to `<PI_IP>`/`<PI_MAC>` if the repo may go public.

#### 2. Correctness — PASS
Script logic (`set -e`/pipefail interactions, sed anchoring, validation, hosts-first-then-hostnamectl, guarded verify) is correct and matches `install-display-config.sh` conventions; docs commands match what the script prints.
- minor — `deploy/pi/set-hostname.sh:111`: the `/etc/hosts` up-to-date guard uses `grep -q`, satisfied if *any* `127.0.1.1` line matches; two `127.0.1.1` lines (one stale) would skip the rewrite and leave the stale line. Never occurs with cloud-init's template or this script's own writes.

#### 3. Simplicity & Conciseness — PASS
Tightly scoped for a genuinely complex domain; no over-engineering or dead code.
- minor — `README.md:139`: the "answers as `http://c4i.local/` (mDNS) and `http://c4i/` (router DNS)" sentence is repeated almost verbatim from line 125.
- minor — `deploy/pi/set-hostname.sh:98,115,146`: the two-line "cp .bak; info backed up" pattern is triplicated (optional `backup()` helper).

#### 4. Test Coverage — PASS
No committed shell test matches the repo's `deploy/pi/*.sh` precedent (`install-display-config.sh` shipped the same way); the 59-assertion dry-run matrix + live-Pi verification exceed it, and the `hostname:` sed no-op regression is concretely covered by the matrix.
- minor — `deploy/pi/README.md:200`: claims "`docker ps` shows `0.0.0.0:80->80/tcp` … — probed 2026-09-19", but the only logged `docker ps` used `--format "{{.Names}} {{.Status}}"` (no ports); the claim is inferred from `docker-compose.yml` `"80:80"` + `nginx.conf` `listen 80;`, not probed.

#### 5. Completeness & Cleanup — FAIL
No debug/temp artifacts, placeholders, or stray old-hostname references; step-count labels correct.
- **major** — `deploy/pi/set-hostname.sh:8-15` and `deploy/pi/README.md:118-128`: the header's (a) drop-in → (b) user-data → (c) hosts/hostnamectl order, mirrored as the README's numbered list 1–3, does not match the script's real execution order `[1/4]` user-data → `[2/4]` hosts+hostnamectl → `[3/4]` drop-in → `[4/4]` verify. Prose and code disagree.

#### 6. Consistency & Style — PASS
Script and docs mirror `install-display-config.sh` (helpers, header, step output, quoting, backups).
- minor — `README.md:139`: references `deploy/pi/README.md` in plain backticks while line 125 uses a markdown link to the same target.

#### 7. Integration Risk — PASS
Every consumer cross-checked (nginx `server_name _`, docker-compose, systemd units, CI, `playwright.config.ts`, backup service) — zero stray old-hostname references; the `.gitignore` force-add is tracked at mode 100755 and documented; cloud-init semantics live-verified with log-line proof; pi-kiosk `target_url` hand-off recorded as the DD-11 fold-back note.

#### 8. Error Handling & Silent Failures — FAIL
Disciplined overall: pre-flight checks before any write, backups before every edit, credential-safe grep-only reads, well-messaged `hostnamectl` fallback.
- **major** — `deploy/pi/set-hostname.sh:156,160`: in `[4/4] verify`, the two checks that confirm the config keys actually landed (`$SUDO grep … "$USER_DATA_FILE" || true`; `grep … "$CLOUD_CFG_D_FILE" || true`) are silently swallowed on any failure (no-match, permission denied, stale sudo), unlike their sibling checks on lines 158–159 which `warn`. Line 160 also lacks the `[ -f … ]` guard and `$SUDO` prefix its sibling on 156 has. The script can print `Done.` having silently failed to confirm the state it exists to verify.
- minor — `deploy/pi/set-hostname.sh:77-80`: the "no `hostname:` key … add one and re-run" precondition treats any non-zero grep exit (incl. a sudo/permission failure) as "key missing", so the script's own diagnosis can mislead (real stderr still prints).

### To-Do: Required Changes

- [x] **Reorder the header comment's (a)/(b)/(c) list to the real execution order** — `deploy/pi/set-hostname.sh:8-15` — describe the steps as: (a) rewrites user-data's `hostname:` line and flips `manage_etc_hosts:` to `false` (user-data out-ranks cloud.cfg.d for that key); (b) applies the change immediately: `/etc/hosts` first, then `hostnamectl`; (c) installs the drop-in `cloud-init/99-c4i-hostname.cfg` → `/etc/cloud/cloud.cfg.d/` (`preserve_hostname: true`, `manage_etc_hosts: false`) so cloud-init stops touching `/etc/hostname` and `/etc/hosts`. Keep the wording of each bullet; only the order and the (a)/(b)/(c) labels change.
- [x] **Reorder the README's "three edits" numbered list to match** — `deploy/pi/README.md:118-128` — renumber so 1 = user-data rewrite + `manage_etc_hosts` flip (keep the "never prints the file" sentence), 2 = `/etc/hosts` then `hostnamectl`, 3 = drop-in install. Keep the "each load-bearing" lead-in and the paragraph that follows unchanged.
- [x] **Make the two swallowed verify checks warn instead of `|| true`** — `deploy/pi/set-hostname.sh:154-160` — replace line 156 with `$SUDO grep -E '^(hostname|manage_etc_hosts):' "$USER_DATA_FILE" || warn "could not read hostname/manage_etc_hosts from $USER_DATA_FILE — verify by hand"` (inside the existing `[ -f … ]` guard), and replace line 160 with an `if [ -f "$CLOUD_CFG_D_FILE" ]; then $SUDO grep -E '^(preserve_hostname|manage_etc_hosts):' "$CLOUD_CFG_D_FILE" || warn "could not read $CLOUD_CFG_D_FILE — verify by hand"; else warn "no $CLOUD_CFG_D_FILE"; fi` block, matching the sibling checks on 158–159. Re-run the plan's Step 2 dry-run matrix (`bash -n` + the `$TMPDIR` fixture runs for first run / idempotent re-run / rollback / invalid name / missing user-data / missing drop-in source) and confirm exit codes and the "Exact strings" are unchanged.
- [x] **Reword the "probed" claim on the Docker port publish** — `deploy/pi/README.md:200` — change "`docker ps` shows `0.0.0.0:80->80/tcp` with no `[::]:80` publish — probed 2026-09-19" to say it follows from `docker-compose.yml`'s `"80:80"` mapping and `nginx.conf`'s `listen 80;` (inferred from config, not from a logged probe).
- [x] **Link the second `deploy/pi/README.md` reference and drop the duplicated sentence** — `README.md:139` — replace the repeated "answers as `http://c4i.local/` (mDNS) and `http://c4i/` (router DNS)" phrasing with a pointer and make the reference a markdown link like line 125: `see [`deploy/pi/README.md`](deploy/pi/README.md) § LAN name`.
- [x] **Tighten the `/etc/hosts` up-to-date guard** — `deploy/pi/set-hostname.sh:111` — only treat hosts as up to date when the count of `^127\.0\.1\.1` lines equals the count of lines matching the exact target pattern (or drop the short-circuit and always run the idempotent sed); keep the `hosts already up to date` string for the single-line case so the dry-run matrix's `already up to date` count (4) still holds.
- [x] **Distinguish "key missing" from "could not read" in the user-data precondition** — `deploy/pi/set-hostname.sh:77-80` — run the `$SUDO grep` once capturing its exit status; exit 1 → the existing "no `hostname:` key … add one and re-run" warn; exit ≥ 2 → a new warn naming the file and "could not read (permissions/sudo?)", then exit 1 as today.
- [x] **(Optional) Extract a `backup()` helper** — `deploy/pi/set-hostname.sh:98-99,115-116,146-147` — `backup() { $SUDO cp "$1" "$1.bak"; info "backed up -> $1.bak"; }` and call it at the three sites; the printed strings must stay byte-identical.
- [ ] **(Optional, repo-visibility dependent) Redact the LAN IP/MAC in planning docs** — `plans/feature/local-url-alias/**` — only if the repo is or becomes public; the deploy docs already use `<pi-ip>`-style placeholders. — deferred: repo-visibility decision for the user
