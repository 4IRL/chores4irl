# Review: Local URL alias instead of IP:port (F6)

## Review — 2026-09-19

### Summary
Requires changes before proceeding. The plan's mechanism (rename the Pi hostname to `c4i`; Avahi + router DHCP-name DNS follow) is sound and the request path under a new Host name is clean (nginx `server_name _`, relative `/api` URLs, no host coupling anywhere — Subagent #2 PASS). But the main deliverable, `deploy/pi/set-hostname.sh`, would be silently gitignored by the unanchored `*.sh` rule (`.gitignore:55`) and never reach the commit/PR/`git archive`; the documented rollback command is rejected by the script's own lowercase regex; step `[2/3]` lacks the idempotency guards its own re-run test asserts (a second run clobbers the pristine `hosts.bak`); Step 4 has no raw-IP fallback, no same-step revert, and no branch for "bare `c4i` never registers" or "cloud-init reverted `/etc/hosts`"; and Steps 4–5 collide with `/run-plan`'s subagent rules (Docker/make-only sandbox escape, never ask the user, Phase 0 tool gate). Mechanical fixes are auto-applied below; 11 design decisions need the user.

### Subagent Results

| # | Subagent | Verdict | Findings |
|---|---|---|---|
| 1 | Correctness & Accuracy | FAIL | 0 critical, 4 major, 6 minor |
| 2 | Full-Stack Trace | PASS | 0 critical, 0 major, 2 minor |
| 3 | Ordering & Cleanup | FAIL | 1 critical, 3 major, 4 minor |
| 4 | Integration & Conventions | FAIL | 1 critical, 3 major, 5 minor |
| 5 | Verification & Coverage | FAIL | 1 critical, 3 major, 7 minor |
| 6 | Completeness & Risk | FAIL | 0 critical, 6 major, 7 minor |

Deduplicated: **1 critical, 9 major, 17 minor**.

### Findings

#### Critical (must fix before proceeding)
- **[Step 2] `deploy/pi/set-hostname.sh` is gitignored by the unanchored `*.sh` rule and its exec bit cannot reach the index** _(Subagents #1, #3, #4, #5, #6)_: `.gitignore:55` is bare `*.sh` (matches at every depth, not "at root" as Research Findings claim). `git check-ignore -v deploy/pi/set-hostname.sh` → `.gitignore:55:*.sh`. The three tracked `.sh` files predate the rule (#19 vs #22); `deploy/pi/display/rotate-display.sh` has sat ignored since July for the same reason. `/git-commit` stages with `git add .`, so the script would be absent from the commit, the PR review, and the `git archive` deploy tarball — the F6 "reproducible mechanism" end state would not be met, and Step 2/5/6 gates would stay green (`git diff --stat` never lists untracked files; `test -x` checks only the working tree). Separately `git config core.fileMode` → `false`, so `chmod +x` is never recorded (sibling `install-display-config.sh` is `100644` in the index). → **DD-1**.

#### Major (should fix)
- **[Steps 1/3/4] Documented rollback `set-hostname.sh MilarachiC4I` is rejected by the script's lowercase-only regex** _(Subagents #1, #3, #6)_: reproduced in `$TMPDIR` — `WARNING: invalid hostname 'MilarachiC4I'`, rc=1. The only stated revert path for a persistent host change does nothing. → **DD-2**.
- **[Step 2] `[2/3]` has no already-up-to-date guard — a re-run overwrites `hosts.bak` with the renamed file** _(Subagents #1, #3, #5, #6)_: reproduced (`hosts.bak` after run 2 → `127.0.1.1 c4i c4i`); the prescribed `cmp` on targets cannot see it; the plan's own "reports 'already up to date' for each file" claim is false for hostname/hosts. → mechanical (applied).
- **[Step 4] No raw-IP fallback / resume path once `MilarachiC4I` stops resolving** _(Subagent #3)_: the poll-then-`ssh rmilarachi@c4i` sequence has no way in if the router hasn't registered the new name; the pre-flight doesn't record the IP. → mechanical (applied).
- **[Step 4] No branch when bare `c4i` never registers with router DNS** _(Subagent #6)_: memory records the Pi IP as a MAC-keyed reservation on the Verizon router; some routers keep the stored device name or only register on a fresh lease. → **DD-3**.
- **[Step 4] `/run-plan`'s subagent prompt forbids `dangerouslyDisableSandbox` for non-Docker/make commands** _(Subagent #4)_: `run-plan/SKILL.md:123` ("Docker/make commands only. Never for git") contradicts Step 4's "every command runs unsandboxed"; `ssh`/`scp`/`curl`/`getent` fail in-sandbox (loopback-only netns). → **DD-4**.
- **[Step 5] `AskUserQuestion` inside a step `/run-plan` executes via a subagent told not to ask the user** _(Subagent #4)_: `run-plan/SKILL.md:121`; stop conditions don't include "step wants user input". → **DD-5**.
- **[All steps] `/run-plan` Phase 0 health-checks Pi-only tools on the laptop and halts** _(Subagent #4)_: `ssh --version` exit 255, `scp --version` exit 1, `raspi-config`/`avahi-daemon` not found, `docker info` fails in-sandbox. → mechanical (applied: Prerequisites block).
- **[Step 4] cloud-init durability premise may not hold on reboot; post-reboot gate has no recovery branch** _(Subagents #5, #1)_: cloud-init's NoCloud docs say user-data edits need an `instance-id` change; on a same-instance reboot the per-always modules may read the cached `/var/lib/cloud/instance/cloud-config.txt` (still `MilarachiC4I`) → `/etc/hosts` reverted. The orchestrator's reading of `stages._restore_from_checked_cache` + `DataSourceNoCloud.check_instance_id` (no seed dir, `seedfrom` file URL → `check_instance_id` returns `None` → cache invalid → re-discovery → fresh seed read; `CloudConfigPartHandler` is PER_ALWAYS and rewrites the cache) predicts it WILL pick up the edit — unverifiable from the sandbox; Step 4's post-reboot check is the arbiter. Mechanical parts applied (pre-flight probe, `cloud-init status --wait`, expected "assuming user maintained hostname" journal line, refined durability sentence); the recovery branch → **DD-6**.
- **[Step 6] `grep -rn 'MilarachiC4I' … .` sweep is neither mechanical nor stable** _(Subagent #5)_: this shell's `grep` is a ugrep wrapper honouring `.gitignore` (skips every `*.sh`); GNU grep exits 2 on unreadable dotfiles; the docs the plan itself adds contain the old name. → mechanical (applied: `git grep` pair).
- **[Step 4] No same-step revert path or blast-radius note for a persistent host-state change** _(Subagent #6)_. → mechanical (applied; rollback name per DD-2).
- **[Step 4] Old-name consumers outside tracked source unaddressed** _(Subagent #6)_: memory `sandbox-cannot-reach-pi-lan.md` (`ssh milarachic4i …`, dangling `[[chores4irl-pi-deploy]]` link) and `.claude/settings.local.json` allow-rules `Bash(ssh milarachic4i:*)` / `Bash(scp * milarachic4i:*)` key on the alias name. → **DD-7**.

#### Minor (nice to fix)
- **[Step 3] Stale plan link is `README.md:70`, not 69; bare `README.md` references should say "root"** _(#1, #4, #5)_ — applied.
- **[Step 2] `git diff --stat` can never show a newly added file** _(#1)_ — folded into DD-1's verification rewrite.
- **[Step 2] `[3/3]` verify commands can trip `set -e` / leave a non-zero exit on idempotent re-run** _(#1, #3)_ — applied.
- **[Step 2] Hosts line written tab-separated while "keep that shape" means spaces** _(#1)_ — applied (space-separated; `grep -x`).
- **[Step 3] Ambiguous insertion points in both READMEs; `Target Pi` line edit unspecified** _(#1, #4, #6)_ — applied.
- **[Step 4] No contingency if the post-reboot cloud-init proof fails** _(#1)_ — merged into DD-6.
- **[Step 3] Verify block's `curl http://c4i.local/…` contradicts the WSL row** _(#2)_ — applied.
- **[Step 6] Guardrail: never point the Playwright smoke suite at the live Pi (it completes the first real chore with a 2025-01-15 clock)** _(#2)_ — applied.
- **[Step 2] `cp -p` on vfat is gratuitous and a possible `set -e` abort point** _(#3, #5)_ — applied (plain `cp`, matching `install-display-config.sh`).
- **[Step 4] `/boot/firmware/user-data.bak` (credential-bearing) is created and never mentioned again** _(#3, #4, #6)_ — "never print" rule extended (applied); lifecycle → **DD-8**.
- **[Step 4] `scp` into `~/chores4irl/deploy/pi/` assumes the directory exists** _(#3)_ — applied (`mkdir -p`).
- **[Step 4] `sed -i deploy.sh` without a preceding read** _(#4)_ — applied (grep count gate first).
- **[Step 4] Allow-rules keyed on the old hostname go stale** _(#4)_ — folded into DD-7.
- **[Step 2] Dry-run cases don't cover missing-user-data (warn+skip) and append paths** _(#5)_ → **DD-10**.
- **[Step 3] `grep -n 'set-hostname.sh'` expectation names 3 hits but to-dos produce 4** _(#5)_ — applied (per-file counts).
- **[Step 5] `grep -n '200'` is too weak a token** _(#5)_ — applied (fixed log-line shape + regex gate).
- **[Step 4] `getent ahostsv4` expected output omits the socktype column** _(#5)_ — applied.
- **[Step 1] Heading-count gate is not self-checking; "Verification log" must be `##`** _(#5)_ — applied.
- **[Step 4/3] Dual-stack: router publishes an AAAA but the stack is IPv4-only** _(#6)_ — applied (`curl -4`, `ping.exe -4`, README note).
- **[Step 2] `hostnamectl` before the hosts edit opens a `sudo: unable to resolve host` window** _(#6)_ → **DD-9**.
- **[Step 2/4] cloud-init `previous-hostname` stays `MilarachiC4I`; expect the "user maintained" journal line** _(#6)_ — applied (leave alone, matching `raspi-config`; journal-line expectation added).
- **[Step 2] Remaining "figure it out" gaps in the script spec (exact messages, `CURRENT` fallback, dry-run `[3/3]`, `$SUDO` unquoted, rw-mount check)** _(#6)_ — applied.
- **[Step 1/5] pi-kiosk `target_url` hand-off not recorded** _(#6)_ → **DD-11**.

### Verification Gaps
- **Step 4**: the cloud-init re-render question can only be settled on the Pi — the plan now records a pre-flight probe of the cached `cloud-config.txt` `hostname:` line and a `cloud-init status --wait`-gated post-reboot check; DD-6 decides the recovery branch.
- **Step 2**: `cp` / `sed -i` on the vfat boot partition cannot be exercised by the ext4 dry run — noted in the plan; the Pi run is the test.

### To-Do: Mechanical Fixes (auto-applied)
- [x] Step 2: `[2/3]` up-to-date guards for hostname and hosts; backups never overwritten; re-run assertions on `.bak` contents; both runs exit 0 _(applied by fixing subagent)_
- [x] Step 2: `[3/3]` verify commands guarded against `set -e`; reminder inside an `if`; dry-run `[3/3]` output specified _(applied)_
- [x] Step 2: hosts line space-separated (`127.0.1.1 $NEW $NEW`), `grep -x` assertion _(applied)_
- [x] Step 2: plain `cp` instead of `cp -p` for both backups _(applied)_
- [x] Step 2: exact `warn` strings, `CURRENT` fallback expression, `$SUDO` unquoted note, rw-mount pre-check, header notes _(applied)_
- [x] Step 2: "never print" rule extended to `$USER_DATA_FILE.bak` _(applied)_
- [x] Step 3: stale link line 70 (link text + href); "root `README.md`" qualification _(applied)_
- [x] Step 3: `deploy/pi/README.md` section appended after `## Apply / restore onto a Pi`; `Target Pi:` paragraph edit spelled out; root README bullet placed after **Autostart on boot** _(applied)_
- [x] Step 3: Verify block qualifies `c4i.local` as mDNS-client-only (not WSL CLI) _(applied)_
- [x] Step 3: IPv6-only-clients note in the caveats table _(applied)_
- [x] Step 3: per-file `grep -c` gates _(applied)_
- [x] Step 1: `## Verification log` top-level; self-checking heading gate (≥ 7) _(applied)_
- [x] Steps: `**Prerequisites (for /run-plan Phase 0)**` block under `## Steps` _(applied)_
- [x] Step 4: pre-flight records the IP (`getent ahostsv4 MilarachiC4I | awk 'NR==1{print $1,$3}'`), cached cloud-config `hostname:` + instance-id probe (grep-only) _(applied)_
- [x] Step 4: `mkdir -p ~/chores4irl/deploy/pi` before `scp` _(applied)_
- [x] Step 4: raw-IP SSH fallback after the poll; resume note at the top of the step _(applied)_
- [x] Step 4: `cloud-init status --wait` before the post-reboot check; expected "assuming user maintained hostname" journal line _(applied)_
- [x] Step 4: `curl -4`, `ping.exe -4`; family recorded in the log _(applied)_
- [x] Step 4: `grep -n 'rmilarachi@MilarachiC4I' deploy.sh` → 2 before `sed -i`; run sandboxed _(applied)_
- [x] Step 4: same-step **Rollback** bullet + **Blast radius** line (rollback name per DD-2) _(applied)_
- [x] Step 5: fixed log-line shape per probe; regex gate ≥ 2 _(applied)_
- [x] Step 6: `git grep` pair replaces the `grep -rn` sweep; `git ls-files --error-unmatch` for the script _(applied)_
- [x] Step 6: Playwright "local only — never `PLAYWRIGHT_BASE_URL=http://c4i/`" guardrail _(applied)_
- [x] Research Findings: `*.sh` is unanchored; `README.md:70`; `getent` real first line; durability sentence refined (user-data → `/etc/hosts` re-render; `hostnamectl` → `/etc/hostname`, then user-maintained) _(applied)_

### Design Decisions (awaiting user input)

#### DD-1: [Step 2] How does `deploy/pi/set-hostname.sh` get tracked past `.gitignore:55` `*.sh`, and with what mode?
**Context:** The rule is unanchored; `git add .` (used by `/git-commit`) skips the file; `core.fileMode=false` means `chmod +x` is never recorded. Step 2/5/6 verifications must be rewritten to `git ls-files -s` / `git diff --cached --stat` / `git status --short` showing `A ` accordingly.

| # | Option | Trade-off |
|---|---|---|
| 1 | `git add -f deploy/pi/set-hostname.sh` + `git update-index --chmod=+x` (record 100755) | Mirrors how the existing tracked scripts coexist with the rule; no `.gitignore` edit; every future `deploy/pi/*.sh` needs the same manual `-f`. Verified: `git add -f --dry-run` → `add 'deploy/pi/set-hostname.sh'`; `update-index --chmod` sets the index mode independently of `core.fileMode`. |
| 2 | Add `!deploy/pi/*.sh` to `.gitignore` directly after `*.sh` (file has no trailing newline — the edit must start with one) + `update-index --chmod=+x` | Fixes the rule for future host scripts; `.gitignore` joins the PR. Must NOT be `!deploy/pi/**/*.sh` — that would surface the untracked `deploy/pi/display/rotate-display.sh` into `git add .` and drag unreviewed July work into this PR. |
| 3 | `git add -f`, accept `100644` like `install-display-config.sh` | No mode fiddling; Step 4 already `chmod +x`es on the Pi; README says `bash deploy/pi/set-hostname.sh`. |

**Chosen:** Option 1 — `git add -f deploy/pi/set-hostname.sh` + `git update-index --chmod=+x deploy/pi/set-hostname.sh` (record 100755), as its own Step 2 to-do right after the file is created/chmod'ed; no `.gitignore` edit. Refinements: the to-do states why the force-add is a one-time act (`/git-commit` uses `git add .`; an already-indexed path is no longer subject to ignore rules). The DD-6 drop-in `deploy/pi/cloud-init/99-c4i-hostname.cfg` does NOT need `-f` — `git check-ignore -v --no-index deploy/pi/cloud-init/99-c4i-hostname.cfg` prints nothing, exit 1 (2026-09-19). Step 2's verification is now `git ls-files -s deploy/pi/set-hostname.sh` → `100755 <blob> 0	deploy/pi/set-hostname.sh` + `git diff --cached --stat` listing the script and the `.cfg` (plus `plans/META-PLAN.md` if `/run-feature`'s ledger edit is staged); the `A ` state is observable only at the end of Step 2 (`git diff --cached --stat`), before `/run-plan`'s per-step commit; Step 5/6 check tracking with `git ls-files --error-unmatch` + `git ls-files -s` → `100755` (Step 5 additionally lists the branch's files via `git diff --name-only main...HEAD` + `git status --short`, excluding `.gitignore` and any `??` entry for the script or `.cfg`); Step 6's "mode per DD-1" is `100755`.

#### DD-2: [Steps 1/2/3/4] Rollback name vs the script's validation regex
**Context:** `MilarachiC4I` fails `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`; every rollback line in the plan uses it.

| # | Option | Trade-off |
|---|---|---|
| 1 | Case-insensitive RFC 1123 regex `^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$`; keep rollback lines; compare up-to-date case-insensitively (`${CURRENT,,}` = `${NEW,,}`) | Restores the exact prior state (user-data, `/etc/hostname`, `/etc/hosts`, matches `previous-hostname`). Verified: `hostnamectl`/cloud-init accept mixed case — the Pi runs `MilarachiC4I` today. |
| 2 | Keep lowercase-only; change every rollback line to `set-hostname.sh milarachic4i` | Advertised forms are lowercase anyway; DNS/mDNS/SSH are case-insensitive; `previous-hostname` (`MilarachiC4I`) would differ from `/etc/hostname` → cloud-init's "user maintained" branch every boot (harmless). |
| 3 | Normalise: `NEW=${1,,}` with a `warn` when it differed, then the lowercase regex | Rollback lines stay as written and produce `milarachic4i`; same `previous-hostname` note as option 2. |

**Chosen:** Option 1 — case-insensitive RFC 1123 label regex `^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$`; up-to-date comparisons use `[ "${CURRENT,,}" = "${NEW,,}" ]` and the hosts (and user-data) guards use `grep -qiE`; the invalid-name `warn` text does not say lowercase. All rollback lines stay `set-hostname.sh MilarachiC4I`. Refinement: the Red → Green matrix gains a rollback positive case — `… set-hostname.sh MilarachiC4I` against fixtures already renamed to `c4i` restores `hostname: MilarachiC4I`, `/etc/hostname` `MilarachiC4I`, hosts `127.0.1.1 MilarachiC4I MilarachiC4I`, exit 0 (dry-run 2026-09-19 with a reconstructed script: all four assertions passed; the drop-in reported "already up to date" and `manage_etc_hosts: false` stayed — see DD-6).

#### DD-3: [Step 4] What if bare `c4i` never registers with the router's DNS?
**Context:** The Pi's IP is a MAC-keyed reservation on the Verizon router (memory); some routers keep the stored device name or only register a name on a fresh lease. META-PLAN F6 only requires the name to resolve "from at least the primary target client(s)" — `c4i.local` alone could satisfy it.

| # | Option | Trade-off |
|---|---|---|
| 1 | Force a fresh lease from the Pi, detached so the Wi‑Fi drop doesn't kill it (`sudo systemd-run --unit=c4i-release --collect sh -c 'nmcli con down netplan-wlan0-wedonthavewifi; sleep 3; nmcli con up netplan-wlan0-wedonthavewifi'`), re-poll; if still unresolved → treat bare `c4i` as best-effort, pass on `c4i.local` + raw IP, record in the caveats table | No router UI; bounded; degrades gracefully. |
| 2 | Force re-lease; if still unresolved → edit the router's reservation/device entry (MAC `88:a2:9e:5a:c1:9c`) to `c4i` in the Verizon UI, re-lease again; record the UI path in the log | Guarantees the bare name but adds a manual router step and a static coupling. |
| 3 | Best-effort immediately: pass on `c4i.local` + raw IP; keep `deploy.sh` on `c4i.local`/IP; document bare `c4i` as router-dependent | Least work; loses bare `c4i` on WSL (no mDNS) — `deploy.sh` would need the IP. |

**Chosen:** Custom — "Re-lease, router UI, then best-effort; progressing only if previously unresolved." Step 4 now has an explicit ladder bullet: rung 1 = detached DHCP re-lease (`sudo systemd-run --unit=c4i-release --collect sh -c 'nmcli con down …; sleep 3; nmcli con up …'`), wait ~30 s, re-poll `getent ahostsv4 c4i`; rung 2 = the user edits the Verizon router's device/reservation entry for MAC `88:a2:9e:5a:c1:9c` to `c4i` (asked via the orchestrator's report — a subagent never guesses the UI), repeat rung 1, record the UI path; rung 3 = bare `c4i` best-effort — pass on `c4i.local` + raw IP, `deploy.sh` targets `<PI_IP>` instead of `c4i` (the Rollback bullet's reverse-sed is conditional on the target written), and Step 5 moves bare `c4i` to the caveats table as "router-dependent — not registered on this router as of <date>". Step 5 logs the rung taken (`rung 0` = no escalation) and its regex gate drops to ≥ 1 at rung 3.

#### DD-4: [Step 4] Where does the live-Pi step execute?
**Context:** `/run-plan` tells every `/next-step-taker` subagent "dangerouslyDisableSandbox for Docker/make only"; Step 4 needs it for `ssh`/`scp`/`curl`/`getent`/`ping.exe` (loopback-only sandbox netns). The `Bash(ssh milarachic4i:*)` allow-rules don't match the plan's `rmilarachi@…` forms, so each call prompts either way.

| # | Option | Trade-off |
|---|---|---|
| 1 | Main session, user-run: tag Step 4 `(USER-RUN — main session, unsandboxed)`; a `/run-plan` subagent must stop and report it as a blocker; the main session runs `/next-step-taker local-url-alias` for Step 4, then re-invokes `/run-plan local-url-alias` for 5–6 (a normal blocker resume, not a second full run) | The reboot, host-key acceptance and permission prompts happen where the user sees them; one extra orchestration hop. |
| 2 | Keep inside `/run-plan`: add a first bullet "Sandbox exception (plan-author decision): the LAN-reaching commands MUST run with `dangerouslyDisableSandbox: true` per memory `sandbox-cannot-reach-pi-lan`; local edits stay sandboxed; expect a permission prompt per call" | Fully autonomous; the subagent must reconcile a direct contradiction with its orchestrator prompt and handle the reboot/poll loop unattended. |

**Chosen:** Option 2 — keep inside `/run-plan`. Step 4's first bullet is now: "**Sandbox exception (plan-author decision, overrides `/run-plan`'s Docker/make-only rule for this step):** the LAN-reaching commands in this step (`ssh`, `scp`, `curl http://c4i…`/`http://<PI_IP>…`, `getent ahostsv4 …`, `ping.exe`) MUST run with `dangerouslyDisableSandbox: true` — the sandbox netns is loopback-only (memory `sandbox-cannot-reach-pi-lan`); `allowedDomains` cannot help. Local commands (`grep`/`sed -i` on `deploy.sh`) stay sandboxed. Expect a permission prompt per call — the `Bash(ssh milarachic4i:*)` allow-rules do not match these `rmilarachi@…` command forms; the user's permission prompt remains the gate." Plus: "The reboot drops the SSH session by design — treat the disconnect as expected, not a failure."

#### DD-5: [Step 5] Phone/Windows client confirmation
**Context:** Step 5's `AskUserQuestion` runs inside a subagent told not to ask the user. The confirmation is not load-bearing for the F6 end state (laptop checks satisfy "primary target client(s)").

| # | Option | Trade-off |
|---|---|---|
| 1 | Drop the prompt; add a **Pending client checks (user)** list to the Verification log and to the PR body's Verification Steps; `/run-feature` Phase B's merge gate already asks the user to confirm the feature works — a failing client becomes a caveats-table follow-up commit | No mid-plan stop; confirmation still happens before merge. |
| 2 | Deliberate stop: last bullet of Step 5 "STOP and report that user confirmation is needed (do not tick)"; main session asks, records, ticks, re-invokes `/run-plan` for Step 6 | Log complete before the PR; one more resume hop (two if DD-4 = 1). |

**Chosen:** Option 1 — the `AskUserQuestion` bullet is deleted from Step 5 and replaced with a **Pending client checks (user)** list in `## Verification log` (phone → `http://c4i.local/`; Windows browser → `http://c4i/` and `http://c4i.local/`), repeated verbatim in the PR body's Verification Steps (new Step 6 to-do for `/git-push`) so the user confirms them at `/run-feature` Phase B's merge gate; a later failing client becomes a caveats-table follow-up commit. Step 4's `ping.exe`-unavailable fallback now points at that list instead of asking mid-step.

#### DD-6: [Step 4] Recovery branch if cloud-init re-renders `/etc/hosts` with the old name after reboot
**Context:** See the Major above; expected not to trigger, but the gate needs a next action.

| # | Option | Trade-off |
|---|---|---|
| 1 | Recovery only if it triggers: `sudo cloud-init clean` (no `--logs`/`--machine-id`) + `sudo reboot` — next boot re-consumes the seed; per-instance modules re-run once (keys present in user-data: `apt`, `enable_ssh`, `hostname`, `keyboard`, `manage_etc_hosts`, `manage_resolv_conf`, `packages`, `rpi`, `ssh_pwauth`, `timezone`, `users` — all idempotent; `ssh_deletekeys: false` keeps host keys) | Nothing extra in the script; heavier one-off if it triggers. |
| 2 | Pre-empt in the script: optional `[1b/3]` that also rewrites `hostname:` in `${CLOUD_CFG_CACHE:-/var/lib/cloud/instance/cloud-config.txt}` when present (same backup-then-sed, same never-print rule — that file holds the `users:` hash too); 4th dry-run fixture | Depends on a cloud-init internal path; if the seed IS re-read the edit is harmlessly overwritten. |
| 3 | Pre-empt with a drop-in `/etc/cloud/cloud.cfg.d/99-c4i-hostname.cfg` (`preserve_hostname: true`, `manage_etc_hosts: false`) so cloud-init stops touching `/etc/hostname`/`/etc/hosts` | Most durable; removes cloud-init from the hostname loop entirely (the `user-data` edit becomes cosmetic); one more versioned artifact. |

**Chosen:** Option 3 with the orchestrator's refinement: "Drop-in `preserve_hostname: true` + `manage_etc_hosts: false`, BUT user-data has higher precedence than `cloud.cfg.d` for `manage_etc_hosts`, so the script also flips `manage_etc_hosts: true → false` in user-data; `cloud-init clean && reboot` stays as the single recovery rung if the post-reboot check shows cloud-init used cached config." Applied: (a) new versioned `deploy/pi/cloud-init/99-c4i-hostname.cfg` (exact 5-line content in Step 2; added to the `deploy/pi/README.md` Files table in Step 3 and to Step 5/6's intended-files/tracked-files lists); (b) `[1/4]` also runs `sed -i -E "s/^(manage_etc_hosts:[[:space:]]*).*/\1false/"` when the key is present (`info` + skip when absent; same never-print rule; fixture gains `manage_etc_hosts: true`; dry-run asserts `grep -x 'manage_etc_hosts: false'`); rollback restores only the hostname line and explicitly leaves `manage_etc_hosts: false` + `preserve_hostname: true` in place; (c) new `[3/4]` installs the drop-in (`CLOUD_CFG_D_FILE` override, `cmp -s` → "already up to date.", backup-if-exists then `$SUDO cp`; missing source → `warn` + exit 1) and `[4/4]` greps both keys — sub-steps renumbered `[1/4]`…`[4/4]` throughout, so the idempotent re-run now yields four "already up to date" lines; Step 4 ships the `.cfg` alongside the script; (d) Step 4's post-reboot recovery is `sudo cloud-init clean && sudo reboot` ONCE (keys enumerated, `ssh_deletekeys: false`), re-check, stop if it reverts again; Research Findings' cloud-init bullet names the drop-in as the pre-emption and `cloud-init clean` as the recovery; (e) post-reboot expected list adds both drop-in lines and `manage_etc_hosts: false` in user-data, and the `'user maintained'` count becomes ≥ 0 (hostname modules skip under `preserve_hostname: true`).

#### DD-7: [Step 4] Old-name consumers outside the repo (SSH alias, permission rules, memory)
**Context:** `.claude/settings.local.json` has `Bash(ssh milarachic4i:*)` / `Bash(scp * milarachic4i:*)`; memory `sandbox-cannot-reach-pi-lan.md` says `ssh milarachic4i …` and links a non-existent `[[chores4irl-pi-deploy]]`. Both are write-denied to subagents; the user owns the SSH config and settings file, the main session owns memory.

| # | Option | Trade-off |
|---|---|---|
| 1 | Keep the alias name: user edits `~/.ssh/config` `Host milarachic4i` → `HostName c4i`; allow-rules and memory keep working; main session adds one sentence to the memory file and fixes the dangling link | Zero permission-rule churn; alias name no longer matches the Pi. |
| 2 | Rename everything: user renames the alias to `Host c4i` and adds `Bash(ssh c4i:*)` / `Bash(scp * c4i:*)`; main session rewrites the memory file's three mentions | Consistent naming; user edits two files. |

**Chosen:** Option 2 — rename everything. Step 4 tells the user (never reading/editing those files): rename the `~/.ssh/config` alias `Host milarachic4i` → `Host c4i` (`HostName c4i`), add `Bash(ssh c4i:*)` / `Bash(scp * c4i:*)` (and, matching this plan's command forms, `Bash(ssh rmilarachi@c4i:*)` / `Bash(scp * rmilarachi@c4i:*)`) to `.claude/settings.local.json`; the old `milarachic4i` rules can be removed. Step 5 gains a **Main-session task** to-do (write-denied to `/run-plan` subagents): the orchestrator rewrites memory `sandbox-cannot-reach-pi-lan.md`'s `milarachic4i` mentions to `c4i` (today `command grep -c milarachic4i` → `3`), notes `c4i` / `c4i.local`, fixes the dangling `[[chores4irl-pi-deploy]]` link (line 16); verify `command grep -c milarachic4i <file>` → 0. A Step 5 subagent leaves that box unticked and reports it as a main-session follow-up, not a blocker.

#### DD-8: [Steps 4/5] Lifecycle of `/boot/firmware/user-data.bak` and `/etc/hosts.bak`
**Context:** `user-data.bak` holds the `users:` password hash on a world-readable vfat partition (same exposure as the original; `chmod` is a no-op on vfat).

| # | Option | Trade-off |
|---|---|---|
| 1 | Delete after the post-reboot proof (Step 4): `ssh rmilarachi@c4i 'sudo rm -f /boot/firmware/user-data.bak /etc/hosts.bak'`; rollback is via the script alone | No lingering credential copy; loses byte-for-byte restore. |
| 2 | Keep as rollback material; document in the README (never print; restore by name) and delete at the F6 fold-back | Exact restore available; credential copy lingers a while. |

**Chosen:** Option 1 — delete after the post-reboot proof: Step 4 runs `ssh rmilarachi@c4i 'sudo rm -f /boot/firmware/user-data.bak /etc/hosts.bak /etc/cloud/cloud.cfg.d/99-c4i-hostname.cfg.bak'` → "backups removed; rollback thereafter is via `set-hostname.sh MilarachiC4I` alone". The Rollback bullet says "(`.bak` copies exist only until the post-reboot proof; after that, rollback is the script)"; Step 3's README Rollback text and the script's final `Done.`/backups line say the same ("backups at …; delete them once the reboot verification passes"); Step 5 logs the deletion.

#### DD-9: [Step 2] `hostnamectl` before or after the `/etc/hosts` edit?
**Context:** Between them every `sudo` prints `sudo: unable to resolve host c4i` (warning only; sudo continues).

| # | Option | Trade-off |
|---|---|---|
| 1 | Edit `/etc/hosts` first, then `hostnamectl` — no warning window | `raspi-config` also edits hosts alongside the hostname; trivial reorder inside `[2/3]`. |
| 2 | Keep the order; document the warning as expected; narrow Step 4's stop rule to "exits non-zero or prints a `WARNING:` line from this script" | No reorder; operator must recognise a benign warning. |

**Chosen:** Option 1 — in `[2/4]` edit `/etc/hosts` FIRST, then `hostnamectl`, so `sudo` resolves the new name immediately (`raspi-config do_hostname` edits hosts alongside the hostname). Both up-to-date guards kept (hosts via case-insensitive regex, hostname via `${CURRENT,,}` = `${NEW,,}`). Research Findings now states the order as `/etc/hosts` first, then `hostnamectl`.

#### DD-10: [Step 2] Dry-run coverage of the missing-user-data and append paths
| # | Option | Trade-off |
|---|---|---|
| 1 | Add both cases (+ the no-arg default): `USER_DATA_FILE=$TMPDIR/does-not-exist …` → exit 0, stderr contains `skipping`; hosts with only `127.0.0.1 localhost` → line appended; `set-hostname.sh` (no arg) ≡ `c4i` | Spec fully mirrored; three one-liners. |
| 2 | Leave as is; state the paths are exercised only by code reading (they never occur on this Pi) | Less to run. |

**Chosen:** Option 1 — the Red → Green bullet gains: `USER_DATA_FILE=$TMPDIR/does-not-exist …` → exit 0 and stderr contains `skipping`; `printf '127.0.0.1 localhost\n' > $TMPDIR/hosts2; HOSTS_FILE=$TMPDIR/hosts2 …` → `grep -x '127.0.1.1 c4i c4i' $TMPDIR/hosts2`; no-arg run `… set-hostname.sh` ≡ `c4i`. Dry-run 2026-09-19 with the reconstructed script: missing user-data → `exit=0`, `grep -c skipping` → `1`; append case → `exit=0`, `hosts2` = `127.0.0.1 localhost` / `127.0.1.1 c4i c4i` (no `hosts2.bak` — additive path); no-arg → `exit=0`, `hostname`=`c4i`, `hostname: c4i`, `127.0.1.1 c4i c4i`.

#### DD-11: [Steps 1/5] pi-kiosk `target_url` hand-off
**Context:** META-PLAN:119–121 says F6's alias "becomes the natural `target_url`"; the on-device kiosk uses loopback `http://localhost/` which has no name-resolution dependency.

| # | Option | Trade-off |
|---|---|---|
| 1 | Record: on the wall Pi `target_url` stays `http://localhost/`; `http://c4i.local/` is the value for a kiosk on a different device; Phase C updates META-PLAN:119–121 accordingly | Keeps the kiosk independent of Avahi/DNS at login. |
| 2 | Record: `target_url` becomes `http://c4i.local/` everywhere; note the Avahi/nss-mdns-at-login risk for F15 | Consistent naming; adds a boot-order dependency. |

**Chosen:** Option 2 — Step 1's decision record gains an eighth heading `## Downstream (pi-kiosk / F15)` recording: "pi-kiosk `target_url` should become `http://c4i.local/` everywhere (wall Pi included) for consistency with the LAN name; RISK for F15: the kiosk then depends on Avahi + nss-mdns being up on the Pi at login (boot-order dependency) — F15 must weigh a `localhost` fallback." Step 1's heading gate is now ≥ 8 (dry-run: exit 1 today, ≥ 8 after Step 1). Step 5 gains a to-do: leave a one-line fold-back note at the end of the decision record for `/run-feature` Phase C to carry into META-PLAN's F15 section / Infra-track bullet (META-PLAN:119–121).

---

### Verdict
[ ] Ready to proceed as-is
[ ] Proceed after minor fixes
[x] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | N/A — no source modules; lint config read (`eslint.config.js` touches only js/ts) |
| Type annotations | [x] | N/A — shell + markdown only |
| Error handling (status codes, exceptions, user feedback) | [x] | `/api/chores` → 200 traced; script `set -e` interactions reviewed |
| Test coverage (happy path, sad path, edge cases) | [x] | Dry-run matrix reconstructed and executed in `$TMPDIR`; backend vitest green (73 tests) |
| Breaking changes (API contracts, shared state, DB schema) | [x] | Hostname consumers enumerated (units, Docker, kanshi, backup script, memory, settings) |
| Config consistency (env vars, requirements pins, lint rules) | [x] | `.gitignore`, `core.fileMode`, `.claude/settings*.json`, skill-config, run-plan/run-feature/git-commit/git-push SKILL.md read |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | `deploy/pi/` conventions, secrets rules, re-read-before-edit |

## Review — 2026-09-19 (Pass 2)

### Summary
Requires changes before proceeding, but the plan is close. Every Pass 1 resolution was re-verified against the real files: DD-1's force-add/index-mode mechanism, DD-2's case-insensitive regex, DD-9's hosts-first order, DD-6's drop-in + user-data flip (now cited against cloud-init's precedence page and module source — user-data does out-rank `cloud.cfg.d`, so the flip is load-bearing; `cloud-init clean` re-reads the seed with the drop-in intact), and the full Step 2 Red→Green matrix (first run, idempotent re-run with four guards, rollback, both negatives, all DD-10 cases, pre-existing drop-in) all hold — five reviewers independently reconstructed and executed the script. One resolution is **reopened as Critical**: DD-1's Step 5 clause expects `git status --short` to show `A  deploy/pi/set-hostname.sh`, but `/run-plan` commits after every step, so by Step 5 the script is already committed and the gate can never pass. The other majors are all consequences of running under `/run-plan`'s autonomous loop (a checkbox designed to stay unticked stalls the loop; DD-3's router-UI rung and DD-4's sandbox exception need a stop protocol / orchestrator hand-off the subagent can actually follow) plus two gaps in the new DD-6 material (a fail-early check placed after side effects; no revert path / steady-state statement for the drop-in). All but one are mechanical.

### Subagent Results

| # | Subagent | Verdict | Findings | Prior resolutions |
|---|---|---|---|---|
| 1 | Correctness & Accuracy | FAIL | 0 critical, 1 major, 4 minor | 35 checked, 1 reopened (DD-1 Step 5 clause) |
| 2 | Full-Stack Trace | PASS | 0 / 0 / 4 minor | 6 checked, 0 reopened |
| 3 | Ordering & Cleanup | FAIL | 1 critical, 1 major, 7 minor | 19 checked, 1 reopened (same) |
| 4 | Integration & Conventions | FAIL | 0 critical, 4 major, 4 minor | 9 checked, 0 reopened |
| 5 | Verification & Coverage | FAIL | 1 critical, 0 major, 3 minor | 18 checked, 1 reopened (same) |
| 6 | Completeness & Risk | FAIL | 0 critical, 1 major, 9 minor | 17 checked, 0 reopened (one refined) |

Deduplicated: **1 critical, 5 major, 22 minor**.

### Findings

#### Critical (must fix before proceeding)
- **[Step 5] `git status --short` gate expects `A  deploy/pi/set-hostname.sh`, impossible under `/run-plan`'s per-step commits — reopens DD-1's Step 5 refinement** _(Subagents #1, #3, #4, #5, #6)_: `run-plan/SKILL.md` §2d spawns `/git-commit` (`git add .`) after EACH step; the `A ` state exists only at the end of Step 2, before its commit. Reproduced in a scratch repo. DD-1's mechanism itself holds (force-add + `update-index --chmod=+x` → `100755`, later edits picked up by `git add .`, included in `git archive`). → mechanical (applied: cadence-independent gate — `git ls-files --error-unmatch` + `git ls-files -s` + `git diff --name-only main...HEAD` listing; DD-1 Chosen text amended).

#### Major (should fix)
- **[Step 2] `[3/4]` missing-drop-in-source check runs AFTER user-data, `/etc/hosts` and the hostname are rewritten** _(Subagent #3)_: a forgotten `.cfg` halts with the Pi half-applied (consistent and re-runnable, but a fail-early defect with the reboot pending). → **DD-12**.
- **[Step 5] DD-7 "main-session task" checkbox is designed to stay unticked, which re-selects Step 5 forever and blocks `finished: true`** _(Subagent #4)_: `/run-plan` picks the next `- [ ]`; `/next-step-taker` sets `finished: true` only when all boxes are ticked. → mechanical (applied: non-checkbox blockquote note after the Verification bullet).
- **[Step 4] DD-3 rung 2 (user edits the router UI) has no stop protocol a never-ask-the-user subagent can follow** _(Subagent #4)_: it would either skip to rung 3 or be auto-continued. → mechanical (applied: explicit **Stop protocol** — leave boxes unticked, end the report with `UNRESOLVED — requires user action:`, which trips `/run-plan` 2b's gate).
- **[Step 4] DD-4 "Sandbox exception" is plan text; the orchestrator's subagent prompt still says Docker/make only** _(Subagent #4)_: the plan must tell `/run-plan` 2a to carry the exception into the Step 4 prompt and describe the sandboxed-fail → unsandboxed-retry sequence. → mechanical (applied: orchestrator note in Prerequisites + expected sequence).
- **[Steps 1/3/4] Drop-in + user-data `manage_etc_hosts: false` are persistent host changes with no revert path and no stated steady state** _(Subagent #6)_: after F6 cloud-init never manages the hostname or `/etc/hosts` on this Pi; editing `hostname:` in user-data becomes inert (cited: `cc_update_hostname` / `cc_update_etc_hosts` early returns). → mechanical (applied: full-revert command in the Rollback bullet + steady-state sentence in Blast radius, README, decision record).

#### Minor (nice to fix)
- **[Step 2] `CURRENT=` fallback is dead under `set -euo pipefail`** _(#1, #6)_ — applied (`|| true`).
- **[Step 4] Post-reboot one-liner ends in `grep -c "user maintained"` → ssh exits 1 on the expected 0; old unit names; wrong log source** _(#1, #2, #5, #6)_ — applied: replaced with positive proofs from `/var/log/cloud-init.log` (`preserve_hostname' is set`, `manage_etc_hosts' is not set`), `|| true`, journal count kept as informational.
- **[Step 2] DD-9 rationale imprecise; a benign `sudo: unable to resolve host MilarachiC4I` on the one `hostnamectl` call is not a stop condition** _(#1)_ — applied.
- **[Step 4] Blanket `Bash(scp:*)` rule already exists; "prompt per call" overstates scp; DD-7's scp rules redundant; `ssh -o …` forms don't match prefix rules; relay-via-report wording** _(#1, #4)_ — applied.
- **[Step 4] Rung-1 / recovery / rollback ssh-to-IP forms lack `-o StrictHostKeyChecking=accept-new`** _(#2)_ — applied.
- **[Step 4] `journalctl -u cloud-init.service` is a pre-24.3 unit name** _(#2)_ — superseded by the log-file proofs.
- **[Step 4] `docker ps` may show `(health: starting)` within ~40 s of boot** _(#2)_ — applied.
- **[Step 3] README IPv6 note should cite the `docker ps` probe, not `"80:80"`** _(#2)_ — applied.
- **[Step 2] Two separate `sed -i` calls on user-data; interruption between them → retry overwrites the pristine `.bak`** _(#3)_ — applied (single atomic `sed -i -E -e … -e …`).
- **[Step 4] Intermediate state after a halted run not described next to the stop rule** _(#3)_ — applied.
- **[Step 4] `.bak` deletion line hard-codes `@c4i`** _(#3)_ — applied (`<c4i-or-PI_IP>`).
- **[Step 4] Script-only rollback re-creates `.bak`s; Rollback never deletes them** _(#3)_ — applied.
- **[Step 4] `deploy.sh` "exactly 2 hits" turns a resume into a false blocker** _(#3)_ — applied (0 hits + 2 `c4i`/IP hits = already done).
- **[Step 2] Final reminder compares case-sensitively** _(#3)_ — applied.
- **[Step 4] Ladder escalates to the router before confirming the Pi-side name survived the reboot** _(#3)_ — applied (hostname gate before rung 1).
- **[Prerequisites] Builtins `printf`/`command` exit 2 under a literal Phase 0 scan** _(#4)_ — applied.
- **[Step 2] `/next-step-taker`'s `git diff --name-only` hides the staged script from Step 2's reviewers** _(#4)_ — applied (`git diff --name-only HEAD` / explicit file list).
- **[Steps 4/5] Three bare `README.md` refs; wrong paraphrase of root `README.md:137`** _(#4)_ — applied.
- **[Steps 2/3/6] `MilarachiC4I` README gate made count-based (`:2`); script/.cfg must not carry the literal** _(#5, #6)_ — applied.
- **[Step 5] Log list missing five Step 4 observables; align `curl -w`** _(#5)_ — applied.
- **[Step 4] `ssh_deletekeys: false` premise unprobed** _(#6)_ — applied (pre-flight grep + `ssh-keygen -R` note).
- **[Step 2] No dry-run case for a pre-existing, different drop-in** _(#6)_ — applied.
- **[Step 3] Stale cloud-init header in `/etc/hosts` after the flip** _(#6)_ — applied (README sentence).
- **[Step 4] Rung-1 ssh may exit 255 on link drop; `--collect` collision note; Rollback must reverse DD-7 advice** _(#6)_ — applied.
- **[Step 2] `$TMPDIR` fixtures never cleaned** _(#6)_ — applied (`$F6` dir + `rm -rf`).

### Verification Gaps
- **Step 4**: `ssh_deletekeys` and the exact `/var/log/cloud-init.log` strings are Pi-side; the pre-flight probe now records the former and the post-reboot proofs are `|| true`-guarded so a missing line is logged, not fatal.

### To-Do: Mechanical Fixes (auto-applied)
- [x] Step 5: cadence-independent git gate; Step 2 ledger parenthetical reworded; DD-1 Chosen amended _(applied)_
- [x] Step 5: DD-7 memory task → non-checkbox blockquote note _(applied)_
- [x] Step 4 / Prerequisites: Stop protocol for user-action rungs and stop points _(applied)_
- [x] Prerequisites / Step 4: orchestrator note for `/run-plan` 2a; sandboxed-fail → unsandboxed-retry sequence; scp already allow-listed; relay-via-report wording; ssh `-o` forms note _(applied)_
- [x] Step 4 / Step 3 / Step 1: full revert to the pre-F6 cloud-init-managed state; steady-state sentence _(applied)_
- [x] Step 2: `CURRENT=` `|| true`; guarded `[4/4]` `cat`; atomic single `sed -i -E`; case-insensitive final reminder; no-literal-old-name rule; pre-existing-different-drop-in case; `$F6` fixture dir + cleanup; DD-9 rationale wording _(applied)_
- [x] Step 4: `accept-new` on all IP/name ssh forms; post-reboot proofs from `/var/log/cloud-init.log` with `|| true`; `(health: starting)` note; deletion line `<c4i-or-PI_IP>`; post-rollback `.bak` deletion; deploy.sh resume rule; hostname gate before the ladder; rung-1 exit-255 + `--collect` notes; Rollback reverses DD-7 advice; `ssh_deletekeys` probe + `ssh-keygen -R` note; intermediate-state sentence; benign `sudo` line note _(applied)_
- [x] Step 3: IPv6 note cites the `docker ps` probe; stale `/etc/hosts` header sentence; count-based `MilarachiC4I` gate _(applied)_
- [x] Step 5: log list additions; `curl -w` aligned _(applied)_
- [x] Prerequisites: builtins/coreutils sentence _(applied)_
- [x] Step 2: `/next-step-taker` changed-files note _(applied)_
- [x] Steps 4/5: bare `README.md` refs qualified; `README.md:137` paraphrase corrected _(applied)_

### Design Decisions (awaiting user input)

#### DD-12: [Step 2] Where does the missing-drop-in-source check live?
**Context:** `[3/4]` checks `[ -f "$CLOUD_INIT_DROPIN_SRC" ]` after user-data, `/etc/hosts` and the hostname are already rewritten; a forgotten `.cfg` halts with the Pi half-applied (state is consistent and a retry converges — reproduced — but the reboot is pending and the cache-protection drop-in is absent).

| # | Option | Trade-off |
|---|---|---|
| 1 | Hoist the check into the pre-flight block right after name validation (same `warn` text; `[3/4]` then only does cmp/backup/install) | Fails before any side effect; one line moves. |
| 2 | Keep it in `[3/4]`; document in the header and Step 4's stop rule that a `[3/4]` halt leaves a consistent, re-runnable Pi (re-ship `cloud-init/` and re-run before rebooting) | No reorder; relies on the operator reading the note. |

**Chosen:** Option 1 — the `[ -f "$CLOUD_INIT_DROPIN_SRC" ] || { warn …; exit 1; }` check now runs in the pre-flight block right after name validation (same warn string); `[3/4]` only installs. Applied 2026-09-19 by the orchestrator; dry-run: script rebuilt from the to-dos with the source dir moved away → exit 1 with the warn, and `hostname`/`hosts`/`user-data` fixtures untouched (`cmp` identical to pre-run copies).

---

### Verdict
[ ] Ready to proceed as-is
[ ] Proceed after minor fixes
[x] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | N/A — shell/markdown/cfg; no lint touches them (re-verified) |
| Type annotations | [x] | N/A |
| Error handling (status codes, exceptions, user feedback) | [x] | `set -e` interactions of every prescribed line re-executed; ssh one-liner exit statuses traced |
| Test coverage (happy path, sad path, edge cases) | [x] | Full Red→Green matrix executed by five reviewers; two extra cases added |
| Breaking changes (API contracts, shared state, DB schema) | [x] | Old-name consumers swept (repo, memory, skills, settings) — only the scheduled memory file |
| Config consistency (env vars, requirements pins, lint rules) | [x] | run-plan / next-step-taker / git-commit / git-push / run-feature sources re-read; sandbox deny lists checked |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | secrets rules honoured incl. `.bak` and cached cloud-config; `deploy/pi/` conventions |

## Review — 2026-09-19 (Pass 3)

### Summary
Proceed after minor fixes (hard cap reached; every remaining item was mechanical and has been applied — nothing is left for "resolve during implementation" beyond the Pi-side observables that only the live run can settle). No Pass 2 resolution was reopened; the script rebuilt from the FINAL Step 2 to-dos passed the full matrix in five independent reconstructions (67/67 in the Verification reviewer's run, including DD-12 fail-early with fixtures untouched, the pre-existing-different drop-in, rollback, all DD-10 cases and the idempotent re-run with exactly four guards); eleven injected halt points all converge on retry with pristine backups; every Step 4 ssh one-liner is `bash -n`-clean as a local line and as its extracted remote string; the two `/var/log/cloud-init.log` proof strings were verified against the cloud-init **25.2** tag. The three majors were all `/run-plan`-autonomy gaps introduced by Pass 2's own Stop protocol / conditional bullets (no persisted resume state, four uncovered Phase 0 tokens, no tick-as-N/A convention).

### Subagent Results

| # | Subagent | Verdict | Findings | Prior resolutions |
|---|---|---|---|---|
| 1 | Correctness & Accuracy | PASS | 0 / 0 / 1 minor | 29 checked, 0 reopened |
| 2 | Full-Stack Trace | PASS | 0 / 0 / 1 minor | 10 checked, 0 reopened |
| 3 | Ordering & Cleanup | FAIL | 0 critical, 1 major, 1 minor | 13 checked, 0 reopened |
| 4 | Integration & Conventions | FAIL | 0 critical, 2 major, 4 minor | 20 checked, 0 reopened |
| 5 | Verification & Coverage | PASS | 0 / 0 / 3 minor | 13 checked, 0 reopened (Pass 2 gate re-proven) |
| 6 | Completeness & Risk | PASS | 0 / 0 / 3 minor + 2 info | 17 checked, 0 reopened |

Deduplicated: **0 critical, 3 major, 12 minor, 2 info** — all mechanical.

### Findings

#### Major (should fix)
- **[Step 4] DD-3 Stop protocol persists no state — a resumed run cannot tell rung 2 was already offered, and `<PI_IP>` dies with the halted subagent** _(Subagent #3)_ → applied: italic `_(STOP <date>: rung 2 pending …; PI_IP=<ip>)_` marker on the ladder bullet; resumed run treats a marked rung 2 as done; Resume note takes `<PI_IP>` from the marker.
- **[Prerequisites] Four command tokens still uncovered by the Phase 0 lists: `docker compose`, `ssh-keygen`, `vitest`, `ipconfig`** _(Subagent #4)_ → applied.
- **[Step 4] Conditional checkboxes (Resume note, ladder, Rollback, Recovery) have no tick-as-N/A convention — an untouched `[ ]` re-selects Step 4 forever** _(Subagent #4)_ → applied: convention sentence; Resume note demoted to a non-checkbox paragraph; poll box tick rule.

#### Minor (nice to fix)
- **[Step 4] "will prompt for the host key" contradicts `accept-new`** _(#1)_ — applied.
- **[Step 4/5] `systemctl cat chores4irl.service | grep -ci …` exits 1 on its pass value; only lived in the Rollback bullet** _(#2, #5)_ — applied (`|| true`; moved into the post-reboot one-liner).
- **[Step 4] Two checkboxes carry no happy-path action** _(#3)_ — applied (see major 3).
- **[Step 4] Stop-protocol token wording; blocker-resume parenthetical** _(#4)_ — applied.
- **[Step 4] Sandbox-evidence wording (`<sandbox_violations>`, `getent` rc=2)** _(#4)_ — applied.
- **[Step 5] Memory rewrite must use the Edit tool (Bash writes under `~/.claude/projects` are sandbox-denied)** _(#4)_ — applied.
- **[Step 4] `ssh-keygen -R` as a report-relay rather than a subagent action** _(#4)_ — applied.
- **[Step 3] Old-name literal rule sat inside the README-content bullet (transcription risk → gate `:3`)** _(#5)_ — applied (moved to an implementer note).
- **[Step 4] No explicit "if 0" branch for the two log-count proofs; `unverified` tag now citable** _(#5, #6)_ — applied (branch + 25.2-tag citations).
- **[Step 2] Progress/backup `info` lines named by Step 4 but undefined in Step 2** _(#6)_ — applied (Exact strings list completed; inline-only strings enumerated).
- **[Step 4] `status: done` hard-coded, but the live probe showed `degraded done`** _(#6)_ — applied (baseline recorded pre-flight; same-value comparison; only a NEW degradation is a stop condition; no `&&` follows `status --wait`).
- **[Step 4] `known_hosts` additions and the shipped script copy on the Pi lack a "not reverted, by design" statement** _(#6)_ — applied.
- _(info)_ Cleanup sweep complete: `$F6`, `plans/**/tmp/` (gitignored `.gitignore:48`), Pi `.bak`s, transient unit, stale `known_hosts` entry — all accounted for.

### Verification Gaps
- **Step 4**: whether cloud-init's DEBUG lines reach `/var/log/cloud-init.log` on this Pi (default `05_logging.cfg` says yes) — the proofs are `|| true`-guarded and the plan now says what a `0` means; the file greps remain the actual proof.

### To-Do: Mechanical Fixes (auto-applied)
- [x] Prerequisites: `ssh-keygen` (`command -v`), `docker compose`/`vitest`/`ipconfig` exemptions, builtins extended, `warn`/`info` noted _(applied)_
- [x] Step 4: conditional-checkbox convention; Resume note → paragraph; poll tick rule; STOP marker + resume semantics; `UNRESOLVED — requires user decision/action:`; sandbox-evidence wording; `|| true` + relocation of the `chores4irl.service` probe; `accept-new` wording; `cloud-init status` baseline/relative comparison; log-count "if 0" branch + 25.2 citations; not-reverted-by-design sentence; `ssh-keygen -R` relay _(applied)_
- [x] Step 2: section-header / backup / progress `echo`/`info` strings defined; inline-only strings folded into the list _(applied)_
- [x] Step 3: old-name literal rule moved to an implementer note _(applied)_
- [x] Step 5: sanity-line + status-baseline log lines; `|| true` on the service probe; `accept-new` form; Edit-tool note in the DD-7 blockquote _(applied)_

### Design Decisions (awaiting user input)
None this pass.

### Resolve During Implementation
- Pi-side observables that only the live run settles (recorded, guarded, non-fatal): exact `cloud-init status` baseline; whether the two DEBUG proof lines land in `/var/log/cloud-init.log`; `ssh_deletekeys` presence; router lease-name lag / DD-3 rung actually needed; `(health: starting)` timing.

### Verdict
[ ] Ready to proceed as-is
[x] Proceed after minor fixes
[ ] Requires changes before proceeding

### Coverage Checklist
| Area | Checked? | Notes |
|---|---|---|
| Imports (dead, missing, circular) | [x] | N/A — shell/markdown/cfg; no lint or hooks touch them (re-verified) |
| Type annotations | [x] | N/A |
| Error handling (status codes, exceptions, user feedback) | [x] | Every remote one-liner's exit path traced; all expected-zero greps `\|\| true`-guarded |
| Test coverage (happy path, sad path, edge cases) | [x] | 67-case matrix + 11 injected halts, five reconstructions |
| Breaking changes (API contracts, shared state, DB schema) | [x] | Old-name consumers swept; nothing unaddressed |
| Config consistency (env vars, requirements pins, lint rules) | [x] | run-plan / next-step-taker / git-commit / git-push / run-feature re-read; Phase 0 simulated on the final text |
| Naming conventions (CLAUDE.md rules, project patterns) | [x] | Secrets rules honoured (grep-only on every credential-bearing file; no subagent writes under `~/.ssh`, `~/.claude/projects`, `.claude/settings.local.json`) |

### Missed-Finding Root Causes
| Finding | Root cause | Skill gap? |
|---|---|---|
| Step 5 `git status --short` gate expected `A ` (Pass 2, Critical) | **Fix verification stopped at plan text** — Pass 1's DD-1 application dry-ran git mechanics in a scratch repo but never simulated the executor: `/run-plan` commits after every step, so the gate could never pass. | Yes — fixing/DD-application subagents are told to dry-run gates against the repo, not against the executing skill's cadence (per-step commit, next-unticked-box selection, subagent write-deny paths). |
| DD-7 "main-session task" checkbox stalls `/run-plan` (Pass 2, Major) | Same class — the DD-application subagent wrote a box designed to stay unticked without checking how `/next-step-taker` selects the next step. | Same gap. |
| DD-3 rung 2 / DD-4 exception not actionable by a never-ask subagent (Pass 2, Major) | Same class — plan text asserting authority over the orchestrator's subagent prompt; no stop protocol matching `/run-plan` 2b's gate. | Same gap. |
| DD-3 STOP loses `<PI_IP>`/rung state on resume (Pass 3, Major) | Same class — Pass 2's Stop protocol was verified against the gate text, not against a simulated resume (what the re-invoked subagent can see = plan file only). | Same gap. |
| Conditional checkboxes with no tick-as-N/A convention (Pass 3, Major) | Same class (and a precedent existed in `plans/completed/docker-raspberry-pi/`). | Same gap. |
| Phase 0 tokens still uncovered (Pass 3, Major) | **Scoped too narrowly** — Pass 2's Prerequisites fix simulated Phase 0 on the Pass 1 text; later fixes added `ssh-keygen`, `docker compose`, `ipconfig` tokens and nobody re-ran the simulation. | Partly — the enumerate-all-instances rule covers plan text, but no rule says "re-run a whole-document simulation after the pass's other fixes land". |
| `[3/4]` source check after side effects (Pass 2, Major) | DD-6 application added a script sub-step without a fail-early walk; Pass 1 reviewers' idempotency walk pre-dated the sub-step. | Yes — fixing/DD subagents run the happy-path dry-run but not the halt-point walk that review Subagent #3 runs. |
| `CURRENT=` fallback dead under `pipefail`; `journalctl … \| grep -c` exit 1 (Pass 2, Minor) | Pass 1 mechanical fixes dry-ran only the path where the file/line exists; exit status of the zero-match path never executed. | Same as above — fixing subagents' dry-run rule does not require the negative / zero-match path and the exit status under `set -e`. |

Recurring pattern (8 of 9): a fix or DD applied in pass N is verified against **its own problem** but not against (a) the semantics of the skill that will execute the plan, or (b) the negative/exit-status path of the shell it writes.

### Skill Improvements Applied
| # | Finding | Subagent | Gap type | Change | Status |
|---|---|---|---|---|---|
| 1 | Step 5 `git status` gate / DD-7 stay-unticked box / DD-3–DD-4 no stop protocol / STOP loses resume state / conditional-checkbox convention (recurring: fix verified against its own problem, not the executor) | 5b + 5f | prompt_gap | Added Verification locus rules (4) executor-semantics simulation and (5) negative-path execution to `references/subagent-prompts.md`; pointers in `SKILL.md` 5b item 2 and 5f (1) | Applied |
| 2 | `[3/4]` source check after side effects | 5f | prompt_gap | Fail-early clause appended to Verification locus rule (2) | Applied |
| 3 | `CURRENT=` dead fallback; `grep -c` exit 1 on pass value | 5b | prompt_gap | Negative-path clause appended to "Dry-run prescribed verification gates" | Applied |
| 4 | Phase 0 tokens uncovered after parallel fixes | 5b + 5f | scope_limitation | **Whole-document gate re-run** after all 5b fixers return and as 5f sweep item 5 | Applied |
| 5 | Conditional checkboxes — project precedent / cadence context | 5b | missing_context | Memory `run-plan-executor-cadence.md` + MEMORY.md index line | Applied |
| 6 | Conditional checkboxes — review-side detection | #4 | prompt_ambiguity | "Executing-skill simulation on the FINAL plan text" checklist item for Subagent #4 | Rejected by user |
