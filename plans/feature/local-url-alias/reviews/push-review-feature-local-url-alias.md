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

## Review 2
Generated: 2026-09-19 21:40
Comparison: origin/main (f007927)...HEAD (885e2f3)
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
All Review 1 fixes applied with no new issues; `set-hostname.sh` remains injection-safe (anchored RFC 1123 validation before any side effect, `$NEW` restricted to `[A-Za-z0-9-]`), backups before every write, credential-safe grep-only reads of user-data.

#### 2. Correctness — PASS
All Review 1 fixes present and correct (`hosts_total`/`hosts_ok` guard, `rc=$?` split, `backup()`, verify warns, header/README order, "probed" rewording, README link dedup).
- minor — `deploy/pi/set-hostname.sh` `[4/4]` user-data check: the "could not read" warn also fires when grep simply finds neither key (exit 1). Step 1 already guarantees `hostname:` is present; optional rewording to "could not confirm".
- minor — `[4/4]` `grep -E '^127\.0\.1\.1'` display check is not leading-whitespace-tolerant like the step-2 guard. Cosmetic.
- minor — `hosts_ok` uses `grep -ci`; a differently-cased existing line counts as correct and keeps its casing. Documented/intentional.

#### 3. Simplicity & Conciseness — PASS
`backup()` dedup and README link fix cleanly applied; no new over-engineering or dead code.

#### 4. Test Coverage — PASS
The two Review 1 behavior changes check out by inspection.
- minor — `plans/feature/local-url-alias/local-url-alias.md:204`: the Step 2 dry-run matrix text was not extended with the two new fixture cases (two-`127.0.1.1`-lines hosts guard; unreadable user-data `rc≥2` branch) that the fix pass actually ran (63/63).
- minor — `plans/feature/local-url-alias/local-url-alias.md:212`: the plan's own README instruction still carries the pre-fix "`docker ps` … — probed 2026-09-19" claim that the shipped README corrected to "inferred from config".

#### 5. Completeness & Cleanup — FAIL
Review 1's header/README order fix is correctly applied; the other Review 1 fixes verified present. No TODO/debug/placeholder/temp artifacts; old-hostname references confined to the intended lines.
- **major** — `plans/feature/local-url-alias/research/lan-name-resolution.md:90-102`: the `## Decision` → **Mechanism** numbered list still enumerates the three edits in the pre-fix order (1 drop-in → 2 user-data → 3 hosts/hostnamectl) versus the script's real `[1/4]` user-data → `[2/4]` hosts+hostnamectl → `[3/4]` drop-in.
- **major** — `plans/feature/local-url-alias/local-url-alias.md:54-67`: the Research Findings "Mechanism (DD-6, option 3 + refinement)" (1)/(2)/(3) list has the same stale drop-in-first order.

#### 6. Consistency & Style — PASS
Script and docs consistent with `install-display-config.sh` naming, quoting, header, exit-code conventions.
- minor — `deploy/pi/set-hostname.sh:79,92`: `rc` / `need_meh` are terse next to `hosts_total`/`need_hostname`; not a single-letter violation.
- minor — `deploy/pi/README.md:150`: new `###` subsections vs the older section's bold-inline style; defensible given length (matches the `### Port-independent output matching` precedent). No action.

#### 7. Integration Risk — PASS
No stray old-hostname references; force-add tracked at 100755 and no longer reported by `git check-ignore`; cloud-init precedence verified against upstream; pi-kiosk `target_url` hand-off documented.
- minor — `.gitignore:55`: the unanchored `*.sh` rule means every future `deploy/pi/*.sh` needs the same `git add -f` workaround (`deploy/pi/display/rotate-display.sh` is silently ignored today). Optional follow-up: anchor the rule.

#### 8. Error Handling & Silent Failures — PASS
Review 1's major confirmed fixed (`[ -f ]` guards, `$SUDO`, `warn` fallbacks); `rc=$?` split correct; `hosts_total`/`hosts_ok` `|| true` justified (`grep -c` exits 1 on zero matches); `backup()` still aborts under `set -e` on a failed `cp`.
- minor — `deploy/pi/set-hostname.sh:121-122`: the two hosts-count greps have no `$SUDO`, unlike the other file reads; an unreadable `/etc/hosts` would leave the counters empty and `[ -gt ]` would error inside the `if` condition. `/etc/hosts` is world-readable in practice.

### To-Do: Required Changes

- [x] **Reorder the decision record's Mechanism list to the real execution order** — `plans/feature/local-url-alias/research/lan-name-resolution.md:90-102` — renumber so 1 = user-data in-place edit (`hostname:` → new name, `manage_etc_hosts: true → false`, user-data out-ranks cloud.cfg.d), 2 = `/etc/hosts` first then `hostnamectl set-hostname`, 3 = the cloud-init drop-in. Keep each bullet's wording; only order/numbers change.
- [x] **Reorder the plan's Research Findings Mechanism (1)/(2)/(3) to match** — `plans/feature/local-url-alias/local-url-alias.md:54-67` — (1) user-data precedence flip + `hostname:` rewrite, (2) `/etc/hosts` then `hostnamectl` (DD-9), (3) the drop-in. Keep wording; renumber only. Note the parenthetical "user-data precedence caveat" still reads correctly as item (1) since it explains why the drop-in alone is insufficient.
- [x] **Record the two new dry-run cases in the plan's Step 2 matrix line** — `plans/feature/local-url-alias/local-url-alias.md:204` — append: a hosts fixture with two `127.0.1.1` lines (one stale, one correct) → not reported up to date, both rewritten to `127.0.1.1 <new> <new>`, re-run reports `hosts already up to date.`; and a `chmod 000` user-data fixture → exit 1 with the `could not read … (permissions/sudo?)` warn, not the missing-key warn. Mark the matrix as re-run after the push-review fixes (63 assertions).
- [x] **Drop the "probed 2026-09-19" wording from the plan's README instruction** — `plans/feature/local-url-alias/local-url-alias.md:212` — match the shipped `deploy/pi/README.md`: the IPv4-only publish is inferred from `docker-compose.yml`'s `"80:80"` and `nginx.conf`'s `listen 80;`, not a logged probe.
- [x] **Prefix the two hosts-count greps with `$SUDO`** — `deploy/pi/set-hostname.sh:121-122` — for consistency with the script's other file reads (`$SUDO grep -cE …`, `$SUDO grep -ciE …`); the dry-run matrix runs with `SUDO=` so output is unchanged.
- [ ] **(Optional) Rename `rc` → `grep_status` and `need_meh` → `need_manage_etc_hosts`** — `deploy/pi/set-hostname.sh:79-92`. — deferred: cosmetic
- [ ] **(Optional, follow-up F-ID) Anchor the `*.sh` gitignore rule** — `.gitignore:55` — so future `deploy/pi/*.sh` scripts don't need `git add -f`; out of scope for this PR. — deferred: separate F-ID

## Review 3
Generated: 2026-09-19 22:15
Comparison: origin/main (f007927)...HEAD (a2edb73)
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
Injection-safe (anchored RFC 1123 gate before any `$NEW` use), user-data grep-only for two keys, backup-before-mutation under `set -euo pipefail`; the Review 2 `$SUDO` change introduced nothing new.

#### 2. Correctness — PASS
`$SUDO grep -c … || true` inside `$(…)` yields a clean integer in both `SUDO=` and `SUDO=sudo` modes; the header, README, decision record and plan Research Findings mechanism lists now all match `[1/4]`→`[3/4]`.

#### 3. Simplicity & Conciseness — PASS
No new over-engineering, dead code or duplicated sections.

#### 4. Test Coverage — PASS
Review 2's two minors confirmed fixed; the 63-assertion matrix + line-by-line live-Pi log exceed the repo's precedent.
- minor — `deploy/pi/set-hostname.sh` `hostnamectl` failure fallback (warn + direct `/etc/hostname` write) is exercised by neither the matrix (`APPLY_LIVE=0` skips it) nor the live run (it succeeded). Accepted risk.
- minor — a fully nonexistent `$HOSTS_FILE` is untested (falls through to the `tee -a` append). Cannot occur on a real Debian/Pi target.

#### 5. Completeness & Cleanup — FAIL
Decision record, plan Research Findings, script header and `deploy/pi/README.md` confirmed reordered per Reviews 1–2.
- **major** — `plans/feature/local-url-alias/local-url-alias.md:161` (Step 1 ticked to-do): parenthetical still narrates "held by the cloud-init drop-in + user-data edit + hostnamectl/hosts".
- **major** — `plans/feature/local-url-alias/local-url-alias.md:178` (Step 2 ticked to-do): the header-comment instruction still lists (a) drop-in, (b) user-data, (c) hosts/hostnamectl.
- **major** — `plans/feature/local-url-alias/local-url-alias.md:214` (Step 2 ticked to-do): the README-section instruction leads with the drop-in.

#### 6. Consistency & Style — PASS
Helpers/header/`.bak`/`[n/N]` conventions mirror the sibling; headings/tables/fences/links consistent.
- minor — `deploy/pi/README.md:21`: `/etc/hosts` in the Files-table Purpose cell lacks backticks unlike the rest of the column.

#### 7. Integration Risk — PASS
No stray old-hostname references; cloud-init precedence handled per cloud-init's real merge order; pi-kiosk `target_url` hand-off consistent with META-PLAN; app surface untouched.
- minor — `deploy/pi/README.md:138`: the Pi's live copy of `set-hostname.sh` predates the push-review hardening (885e2f3, a2edb73); `deploy/pi/` artifacts are not synced by a normal redeploy, so the docs should say to `scp` the script + drop-in before a re-apply/rollback.

#### 8. Error Handling & Silent Failures — PASS
Review 2's major and minor confirmed fixed; fail-fast validation, `rc=$?` split, `backup()` abort semantics, and the communicated `hostnamectl` fallback all sound.
- minor — `deploy/pi/set-hostname.sh:169-170`: the verify-step `cat "$HOSTNAME_FILE"` and `grep … "$HOSTS_FILE"` reads omit `$SUDO`, inconsistent with the block's other checks and the step-2 counting greps.

### To-Do: Required Changes

- [x] **Reorder the three stale to-do narrations in the plan** — `plans/feature/local-url-alias/local-url-alias.md:161,178,214` — line 161: "held by the user-data edit + hostnamectl/hosts + the cloud-init drop-in"; line 178: relabel (a) = user-data `hostname:`/`manage_etc_hosts:` edit, (b) = `/etc/hosts` then `hostnamectl`, (c) = drop-in install; line 214: lead with the user-data edit, then hosts+hostnamectl, then the drop-in. Sweep the rest of the plan and decision record for any other drop-in-first narration.
- [x] **Prefix the two verify-step reads with `$SUDO`** — `deploy/pi/set-hostname.sh:169-170` — `$SUDO cat "$HOSTNAME_FILE" 2>/dev/null || warn …` and `$SUDO grep -E '^127\.0\.1\.1' "$HOSTS_FILE" || warn …`; printed strings unchanged.
- [x] **Backtick `/etc/hosts` in the Files-table row** — `deploy/pi/README.md:21`.
- [x] **Note that `deploy/pi/` artifacts are not synced by a normal redeploy** — `deploy/pi/README.md` § Apply / re-apply — one sentence: `scp` `deploy/pi/set-hostname.sh` and `deploy/pi/cloud-init/99-c4i-hostname.cfg` to `~/chores4irl/deploy/pi/` on the Pi before a re-apply or rollback, since `deploy.sh` ships only the app.
- [ ] **(Optional, accepted risk) Exercise the `hostnamectl` fallback in the matrix** — `deploy/pi/set-hostname.sh:384-390` — an `APPLY_LIVE=1` case with `hostnamectl` shadowed on `PATH`. — deferred: accepted risk

## Review 4
Generated: 2026-09-19 23:05
Comparison: origin/main (f007927)...HEAD (83d6883)
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
Anchored RFC 1123 gate before any `$NEW` use; user-data grep-only for two keys; backup-before-mutation under `set -euo pipefail`.

#### 2. Correctness — PASS
The `[4/4]` `$SUDO` reads behave in both `SUDO=`/`SUDO=sudo` modes; all narrations match `[1/4]`→`[3/4]`.
- minor — `deploy/pi/set-hostname.sh` `[4/4]`: `2>/dev/null` on the `$SUDO cat "$HOSTNAME_FILE"` line but not on the sibling `$SUDO grep … "$HOSTS_FILE"` line (redundant stderr line possible). Cosmetic.

#### 3. Simplicity & Conciseness — PASS
Tightly scoped; the new "not synced by a normal redeploy" paragraph is adjacent in spirit to the intro's "canonical copies live on the Pi" sentence but serves a different purpose. No action.

#### 4. Test Coverage — PASS
All prior required fixes verified.
- minor — `[4/4]` avahi-inactive branch is exercised by neither the matrix (`APPLY_LIVE=0`) nor the live run. Accepted risk alongside the `hostnamectl` fallback.

#### 5. Completeness & Cleanup — PASS
Exhaustive sweep: every enumeration of the three edits now follows the script's real order; no debug/placeholder/temp artifacts; old-hostname references confined to the intended lines.

#### 6. Consistency & Style — PASS
- minor — `deploy/pi/set-hostname.sh:69,74` vs `59-62,81-87`: guard-and-exit shape mixed (`cmd || { warn; exit 1; }` one-liners vs multi-line `if`). Cosmetic.

#### 7. Integration Risk — PASS
Review 3's "deploy/pi not synced" note confirmed in `deploy/pi/README.md` § Apply / re-apply; no other risks.

#### 8. Error Handling & Silent Failures — PASS
Review 3's `$SUDO` minor confirmed fixed.
- minor — `deploy/pi/set-hostname.sh:169`: "no $HOSTNAME_FILE" conflates missing with unreadable; optional "could not read" rewording.
- minor — `deploy/pi/set-hostname.sh:74`: the findmnt guard's message doesn't distinguish not-mounted / findmnt-missing / read-only. Negligible on the target.

### To-Do: Required Changes

- [ ] **(Optional) Harmonise stderr handling on the two `[4/4]` verify reads** — `deploy/pi/set-hostname.sh:169-170` — add `2>/dev/null` to the hosts grep or drop it from the hostname cat.
- [ ] **(Optional) Reword "no $HOSTNAME_FILE" → "could not read $HOSTNAME_FILE"** — `deploy/pi/set-hostname.sh:169`.
- [ ] **(Optional) Broaden the findmnt guard message** — `deploy/pi/set-hostname.sh:74` — "could not confirm /boot/firmware is mounted read-write".
- [ ] **(Optional) Unify guard-and-exit shape** — `deploy/pi/set-hostname.sh:59-87` — one style throughout.
- [ ] **(Optional, accepted risk) Matrix case for the avahi-inactive branch** — `deploy/pi/set-hostname.sh:429`.

## Review 5
Generated: 2026-09-20 08:40
Comparison: origin/feature/local-url-alias (e3c4abb, PR #43 head)...HEAD (cffcf85) — delta only: Chromium profile-lock cleanup after the live rename broke the kiosk
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
`rm -f` targets three literal filenames under `$CHROMIUM_DIR`; `lock_target` is compared, never used as a path.
- minor — `deploy/pi/set-hostname.sh:156`: first use of `$HOME`; under `sudo ./set-hostname.sh` (which the header calls harmless) `env_reset` makes it root's home and the step silently no-ops.

#### 2. Correctness — PASS
`${lock_target%-*}` strips only the trailing `-<pid>` even for hyphenated hostnames (verified).
- minor — `:159`: comparison is case-sensitive while the rest of the script is deliberately case-insensitive.
- minor — `:158`: `readlink` command substitution unguarded under `set -e` (TOCTOU only).
- minor — `:20`: header's "double sudo is harmless" no longer covers the `$HOME`-based step.

#### 3. Simplicity & Conciseness — PASS
- minor — `:157-165`: `if … && …; elif [ "$APPLY_LIVE" != 1 ]` re-tests the negation; the file's idiom is plain if/else on `APPLY_LIVE`.
- minor — README's two mentions serve different readers (procedure vs symptom); no change required.

#### 4. Test Coverage — FAIL
Core logic sound; cases M–P cover symlink/no-lock/new-name/dry-run.
- **major** — `:157`: the block only fires on `-L`; a regular-file `SingletonLock` (crash/manual `touch`/partial cleanup) silently no-ops — no rm, no info, no warn.
- minor — plan `:86`: cases M–P recorded as prose without literal fixture commands/assertions.
- minor — no hyphenated-hostname case through `${lock_target%-*}`.
- minor — case-sensitivity (as Correctness).

#### 5. Completeness & Cleanup — PASS
- minor — `:33`: `CHROMIUM_DIR` missing from the header's "Overridable paths" list.

#### 6. Consistency & Style — PASS
- minor — `CHROMIUM_DIR` default not grouped with the other overridable defaults / header list.
- minor — `:161`: full-sentence info line lacks the trailing period the file's other state messages use.

#### 7. Integration Risk — PASS
Removing the lock while the kiosk Chromium runs is safe (lock read only at startup); the reboot follows immediately.
- minor — `deploy/pi/README.md:3-7` vs `:150`: the opening paragraph still says a redeploy "never touches" these files, contradicting the corrected Apply/re-apply paragraph (a redeploy re-extracts the tracked copies; only the *installed* system files are untouched).
- minor — header "Overridable paths" (as above).
- minor — optional comment that nothing else must launch Chromium against the profile before the reboot.

#### 8. Error Handling & Silent Failures — PASS
- minor — `:158`: unguarded `readlink` (as Correctness).
- minor — `:156`: `$HOME` under `sudo` (as Safety).
- info — the "lock already targets `$NEW`" path prints nothing, unlike the script's other idempotent no-ops.

### To-Do: Required Changes

- [x] **Handle a non-symlink `SingletonLock`** — `deploy/pi/set-hostname.sh:157` — test `-e`; if present but not `-L`, `warn "… SingletonLock is not a symlink — left in place; remove it by hand if the kiosk does not start"`; add fixture case Q (regular file) to the matrix.
- [x] **Compare hostnames case-insensitively and guard `readlink`** — `:158-159` — `lock_target="$(readlink … 2>/dev/null || true)"`; skip when empty; compare `${lock_host,,}` with `${NEW,,}`; add fixture case R (hyphenated `$NEW`, e.g. `c4i-test`) and S (lock differs only by case → kept).
- [x] **Resolve the kiosk user's home instead of `$HOME`** — `:156` — `getent passwd "${SUDO_USER:-$(id -un)}"` (guarded `|| true`, fall back to `$HOME`) so `sudo ./set-hostname.sh` still finds the lock; keep the header's "double sudo" claim true.
- [x] **Group `CHROMIUM_DIR` with the other overridable defaults and list it in the header** — `:32-36`.
- [x] **Use the file's if/else idiom, add the trailing period, and announce the idempotent no-op** — `:157-165` — `info "Chromium profile lock already targets $NEW."` when kept.
- [x] **Fix the README opening paragraph** — `deploy/pi/README.md:3-7` — a redeploy overwrites the tracked copies under `~/chores4irl/deploy/pi/`; the *installed* system files (`/etc/cloud/cloud.cfg.d/…`, labwc config, etc.) are what a redeploy never touches.
- [x] **Record cases M–S in the plan's matrix with literal commands** — `plans/feature/local-url-alias/local-url-alias.md` Step 2 matrix line.

## Review 6
Generated: 2026-09-20 09:35
Comparison: origin/feature/local-url-alias (e3c4abb, PR #43 head)...HEAD (fa536b2) — delta only
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
`SUDO_USER` is set by sudo itself; `getent` output parsing safe; `rm -f` scope unchanged.
- minor — `deploy/pi/set-hostname.sh:49`: if `kiosk_home` is empty and `HOME` is set-but-empty, `CHROMIUM_DIR` becomes `/.config/chromium` (skipped silently).

#### 2. Correctness — PASS
All seven Review 5 items applied correctly.
- minor — `:49`: `$HOME` under `set -u` when `HOME` is unset would abort; use `${HOME:-}`.

#### 3. Simplicity & Conciseness — PASS
Four-branch block proportionate; comment length matches the file's idiom; README split intentional.

#### 4. Test Coverage — FAIL
Cases Q/R/S genuinely closed.
- **major** — plan matrix line: claimed "incl. the `SUDO_USER` home-resolution check", but every recorded case overrides `CHROMIUM_DIR`, so the `getent`/`SUDO_USER` default path was never exercised through the script.
- minor — the `readlink`-failure warn branch has no case (TOCTOU only; accepted risk).

#### 5. Completeness & Cleanup — PASS
- minor — the `SUDO_USER` check narrated without a case letter/literal command (same root as the Test Coverage major).

#### 6. Consistency & Style — PASS
Review 5's style items confirmed applied.

#### 7. Integration Risk — PASS
README intro and Apply/re-apply now agree.
- minor — the script assumes invoker/`SUDO_USER` == the kiosk user (true today; single account).
- info — `plans/feature/kiosk-shell-extraction/` predates the lock discovery; carry the knowledge into pi-kiosk Phase 1.

#### 8. Error Handling & Silent Failures — PASS
Every `|| true`/`2>/dev/null` in the new block is load-bearing; `rm -f` still aborts loudly.
- minor — an inaccessible `$CHROMIUM_DIR` makes both `-L`/`-e` false → silent skip.

### To-Do: Required Changes

- [x] **Exercise the `getent`/`SUDO_USER` resolution through the script and record it** — plan Step 2 matrix — cases T (getent stub → SUDO_USER's home), U (getent fails → `$HOME`), V (no profile dir → info line), with literal commands; unsupported claim removed.
- [x] **`${HOME:-}` in the `CHROMIUM_DIR` default** — `deploy/pi/set-hostname.sh:49`.
- [x] **Announce a missing profile dir instead of skipping silently** — `deploy/pi/set-hostname.sh` — `info "no Chromium profile at $CHROMIUM_DIR — nothing to clean."` (case V).
- [ ] **(Optional, accepted risk) Fixture the `readlink`-failure warn branch** — TOCTOU-only path.
- [ ] **(Optional) Header note that the invoker/`SUDO_USER` must be the kiosk user** — relevant only if the Pi gains a second account.

## Review 7
Generated: 2026-09-20 10:20
Comparison: origin/feature/local-url-alias (e3c4abb, PR #43 head)...HEAD (a51ea64) — delta only
Verdict: **BLOCKED**

### Results by Reviewer

#### 1. Safety & Security — PASS
- minor — carry-over: set-but-empty `HOME` + no `kiosk_home` → `/.config/chromium` (not attacker-influenced; skipped with the info line).

#### 2. Correctness — PASS

#### 3. Simplicity & Conciseness — PASS
- minor — the missing-dir branch guards an unobserved edge; the "nothing else may launch Chromium" comment line reads as an operational caveat. Accepted.

#### 4. Test Coverage — FAIL
- **major** — plan matrix case T: the recorded `getent` stub single-quoted `$D` inside the printf format, so the literal command would bake `/home-a` (empty `$D`) and fall into the "no profile" branch instead of reproducing the claimed removal. (The run that produced the result used `printf … %s … "$D/home-a"`; the transcription was wrong.)

#### 5. Completeness & Cleanup — PASS

#### 6. Consistency & Style — PASS
- minor — `deploy/pi/README.md:161`: dangling "instead of clearing it".
- minor — `deploy/pi/README.md:215`: straight-quoted section reference vs the file's `§` style.

#### 7. Integration Risk — PASS
- minor — the lock cleanup has no `[N/4]` header of its own (it's part of step 2's "apply now"). Accepted.

#### 8. Error Handling & Silent Failures — PASS
- minor — no catch-all `else` after `-L`/`-e`/`! -d` (dir exists, no lock → silent). Accepted: that is the normal post-reboot state.

### To-Do: Required Changes

- [x] **Record case T's stub exactly as run** — plan Step 2 matrix — `printf '…%s…' "$D/home-a" > $D/bin/getent`, with a note on why `$D` must be interpolated at stub-creation time; re-proved literally 2026-09-20.
- [x] **Reword the two README phrases** — `deploy/pi/README.md:161,215`.
