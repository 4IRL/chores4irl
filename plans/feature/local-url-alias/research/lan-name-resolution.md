# LAN name resolution for chores4irl on the Pi — research spike / decision record (F6)

Research spike for META-PLAN F6 "Local URL alias instead of IP:port". Written 2026-09-19
from read-only probes of the Pi and the laptop (unsandboxed SSH; the sandbox netns is
loopback-only and cannot reach the LAN). Plan: `plans/feature/local-url-alias/local-url-alias.md`.

## Goal

Let LAN clients open chores4irl on the Pi as **`http://c4i.local/`** (mDNS — any
mDNS-capable phone/laptop) and **`http://c4i/`** (router DNS + DHCP search domain — e.g.
Windows/WSL/iOS) instead of `http://192.168.1.214/`, with:

- no app code changes (nginx has `server_name _`; the frontend uses relative `/api` URLs);
- no new daemons on the Pi and nothing to install on clients;
- everything additive — `http://192.168.1.214/` keeps working;
- a reproducible, idempotent host-side script in `deploy/pi/` so the change survives a
  re-image, plus docs that double as the runbook.

## Probe results (2026-09-19)

### Pi (`MilarachiC4I`, Debian 13 trixie arm64, user `rmilarachi`, passwordless sudo)

- **Hostname**: `MilarachiC4I` (`/etc/hostname`, `hostnamectl`).
- **Avahi / nss-mdns**: `avahi-daemon` 0.8 **active**; `libnss-mdns` installed;
  `/etc/nsswitch.conf` `hosts: files mdns4_minimal [NOTFOUND=return] dns` — mDNS is already
  on. `/etc/avahi/avahi-daemon.conf` has **no** `host-name=` override, so Avahi advertises
  `<system hostname>.local` (today `milarachic4i.local`). Empty `/etc/avahi/hosts` and
  `/etc/avahi/services/`. No `avahi-utils`, no `dnsmasq`.
- **NetworkManager / DHCP**: NetworkManager active; connection
  `netplan-wlan0-wedonthavewifi` on `wlan0`; DHCP lease `192.168.1.214/24`, gateway and DNS
  `192.168.1.1`; `ipv4.dhcp-hostname` **unset** → NM sends the system hostname as DHCP
  option 12. `systemd-resolved` inactive.
- **`/etc/resolv.conf`**: `search mynetworksettings.com` + `nameserver 192.168.1.1` (both
  pushed by the router via DHCP).
- **cloud-init hostname management**: cloud-init 25.2, NoCloud datasource seeded from
  `/boot/firmware` (`seedfrom: file:///boot/firmware`); `cloud-init status` =
  `degraded done` at the last boot (2026-09-14 — pre-existing, not an F6 effect); by the
  F6 pre-flight on 2026-09-19 it read `status: done`, which is the baseline the post-reboot
  check was compared against (see Verification log).
  `/etc/cloud/cloud.cfg` has `preserve_hostname: false` and runs `set_hostname`,
  `update_hostname`, `update_etc_hosts`; `/boot/firmware/user-data` has
  `hostname: MilarachiC4I` and `manage_etc_hosts: true`;
  `/var/lib/cloud/data/previous-hostname` = `MilarachiC4I`. Consequence: a bare
  `hostnamectl set-hostname` would keep `/etc/hostname` (cloud-init treats a differing
  `/etc/hostname` as "user maintained") but the `127.0.1.1` line in `/etc/hosts` would be
  re-rendered from user-data's `MilarachiC4I` on every boot →
  `sudo: unable to resolve host c4i` noise. cloud-init merges user-data ON TOP of `/etc/cloud/cloud.cfg.d/*`, so a drop-in
  alone cannot turn `manage_etc_hosts` off while user-data still says `true`. `user-data`
  also holds `users:` (a password hash) — never print the file; edit only its `hostname:`
  and `manage_etc_hosts:` lines in place.
- **Docker port publish**: only `0.0.0.0:80->80/tcp` (frontend nginx) is published; the
  backend is reachable solely through nginx's `/api` proxy. `docker info` Name is cosmetic.
- **Repo hooks**: `deploy.sh` (gitignored by the unanchored `.gitignore:55` `*.sh`) targets
  `rmilarachi@MilarachiC4I`; `git config core.fileMode` = `false`. Tracked references to
  the Pi are only placeholders (`<pi-host>`, `<pi-ip>` in the root `README.md`). The app
  surface is name-agnostic: `nginx.conf` `server_name _`,
  `frontend/src/services/choreApi.ts` and `frontend/src/hooks/useChoreEvents.ts` use
  relative `/api/...` URLs, kiosk Chromium stays on `http://localhost/`.

### Laptop (WSL2 on Windows, `networkingMode=mirrored`)

- **`getent` outputs**: `getent ahostsv4 MilarachiC4I` →
  `192.168.1.214 MilarachiC4I.mynetworksettings.com` (plus an IPv6 AAAA) — the **router
  DNS already resolves the Pi's hostname**, learned from the Pi's DHCP request (option 12) and
  qualified by the DHCP-pushed search domain `mynetworksettings.com`. This is exactly how
  `deploy.sh`'s `rmilarachi@MilarachiC4I` works today; mDNS plays no part in bare-name
  resolution.
- `getent hosts milarachic4i.local` → empty: WSL has no `nss-mdns`, so `.local` names do
  not resolve from the WSL CLI. Windows itself (browsers, `ping.exe`) resolves `.local`
  via its built-in mDNS responder; WSL's mirrored mode shares the Windows network stack
  but not its name resolver.
- Tools available for the plan's laptop-side checks: `curl`, `getent`, `ssh`/`scp`,
  `ping.exe` (`/mnt/c/windows/system32/ping.exe`), `awk`; no `shellcheck`, no Docker.

## Options evaluated

| Option | Gives | Client coverage | Setup | Verdict |
|---|---|---|---|---|
| (a) Rename the Pi hostname `MilarachiC4I` → `c4i` | `c4i.local` via Avahi (advertises the hostname) **and** bare `c4i` via router DNS (DHCP option 12 + search domain) | mDNS clients get `.local`; DHCP-search-domain clients (Windows/WSL/iOS) get bare `c4i` | Zero new config files for the name itself; needs a cloud-init drop-in + user-data edit so cloud-init stops re-rendering the old name; changes the SSH/deploy target (`deploy.sh`, `known_hosts`) | **chosen** — both existing resolvers copy the hostname; fewest moving parts; hostname and mDNS name stay consistent |
| (b) Keep hostname; Avahi `[server] host-name=c4i` + NetworkManager `ipv4.dhcp-hostname=c4i` | Same two names as (a) | Same as (a) | Two versioned knobs in two daemons that must be kept in sync; still changes the router-side name (so SSH via router DNS moves anyway) | Rejected — same outcome as (a) with more state to drift |
| (c) Avahi `host-name=c4i` only | `c4i.local` only | mDNS clients only; bare `c4i` never resolves | One Avahi config line; keeps `MilarachiC4I` for SSH/router DNS | Rejected — no bare-name URL for Windows/WSL/iOS; two names to remember |
| (d) Avahi `host-name=c4i` + router-UI static DNS entry with a DHCP reservation | `c4i.local` via Avahi; bare `c4i` via a hand-entered router record | Same as (a) while the router record exists | Bare name lives in the router UI (unversioned, lost on router reset) and couples to a fixed IP via a reservation | Rejected — the "why" leaves the repo and the name is tied to an IP |
| (e) `dnsmasq` on the Pi as the LAN DNS server | Any name the Pi chooses to serve | All clients — but only after every client's DNS/DHCP is re-pointed at the Pi | New daemon on the Pi; router DHCP must hand out the Pi as DNS (or every client edited); Pi becomes a LAN single point of failure | Rejected — disproportionate for one alias |
| (f) hosts-file entries on each client | Any name, per client | Only the clients edited; phones effectively impossible | One edit per device, repeated on every new device and on any IP change | Rejected by META-PLAN — doesn't scale |

## Decision

- **Name**: `c4i` → URLs `http://c4i.local/` (mDNS) and `http://c4i/` (router DNS + DHCP
  search domain). Lower-case, single label, DNS/mDNS-safe.
- **Mechanism**: rename the Pi's hostname to `c4i`, held by three edits (each load-bearing
  for a different failure mode, see Probe results):
  1. an in-place edit of `/boot/firmware/user-data` — `hostname:` → `c4i` and
     `manage_etc_hosts: true` → `false` — because user-data out-ranks `cloud.cfg.d` for
     that key, and so a later `cloud-init clean` or seed re-read cannot resurrect the old
     name;
  2. `/etc/hosts` (`127.0.1.1` line) first, then `hostnamectl set-hostname c4i`, to apply
     the change now (hosts first so every `sudo` after the rename still resolves the host);
     a reboot afterwards makes DHCP re-register the new name with the router;
  3. a versioned cloud-init drop-in `/etc/cloud/cloud.cfg.d/99-c4i-hostname.cfg`
     (`preserve_hostname: true`, `manage_etc_hosts: false`) — takes cloud-init's
     `set_hostname` / `update_hostname` / `update_etc_hosts` modules out of the loop on
     every boot, whether or not the seed is re-read.
  (The order matches the script's `[1/4]` → `[3/4]` steps.)
  Shipped as `deploy/pi/set-hostname.sh <name>` (idempotent, backup-then-write, mirrors
  `install-display-config.sh`) plus the tracked drop-in
  `deploy/pi/cloud-init/99-c4i-hostname.cfg`.
- **Why**: both resolvers already in play copy the hostname by default — Avahi advertises
  `<hostname>.local` and the router registers each DHCP client's hostname in its
  `mynetworksettings.com` zone and pushes that search domain to clients — so one rename
  yields both URLs with no new daemons, no client-side setup, and nothing but additive
  behaviour (`http://192.168.1.214/` keeps working). The user does not need to keep
  `MilarachiC4I`.
- Steady state after F6: cloud-init no longer manages the hostname or `/etc/hosts` on this
  Pi (`preserve_hostname: true`; `manage_etc_hosts: false`); editing `hostname:` in
  user-data is inert — change the name with `deploy/pi/set-hostname.sh <name>` only.

## Client caveats

These drive the docs (root `README.md`, `deploy/pi/README.md`), not the code.

- `c4i.local` needs an mDNS resolver — iOS/macOS native, Windows 10 1703+ native, Android
  12+ (older Android: no), Linux with `libnss-mdns`, WSL CLI no.
- Bare `c4i` needs router DNS **and** the DHCP search domain — Windows/WSL/iOS yes,
  Android ignores DHCP search domains (use `c4i.local`).
- Browsers treat a single label as a search: type `c4i/` or `http://c4i` the first time;
  `c4i.local` (has a dot) is always treated as a URL.
- The router keeps the old lease name until the Pi's next DHCP request (reboot
  re-registers) and Windows may cache the old answer (`ipconfig /flushdns`).
- SSH `known_hosts` keys by name → first `ssh c4i` prompts to trust the (unchanged) host
  key; `deploy.sh` and any `~/.ssh/config` `Host` entry must move to `c4i`.
- Everything is additive: `http://192.168.1.214/` keeps working.

| Client | `http://c4i.local/` (mDNS) | `http://c4i/` (router DNS + search domain) |
|---|---|---|
| iOS / macOS | yes (native) | yes |
| Windows 10 1703+ (browser, `ping.exe`) | yes (native) | yes |
| WSL CLI (`curl`, `getent`) | no (no `nss-mdns`) | yes |
| Android 12+ | yes | no (ignores DHCP search domains) |
| Android < 12 | no | no |
| Linux with `libnss-mdns` | yes | yes (if DHCP search domain applied) |
| The Pi itself | yes — but `getent hosts c4i.local` answers `172.18.0.1` (its Docker Compose bridge), not the wlan0 `192.168.1.214`: Avahi publishes on every interface by default and `nss-mdns` returns the first; nginx is on `0.0.0.0:80` so the app still answers (observed 2026-09-19, see Verification log) | yes (`127.0.1.1` via `/etc/hosts`) |

## Verification log

Observed Step 4 outputs (one `` `<command>` → `<result>` `` line per probe). LAN-reaching
commands ran unsandboxed from the WSL laptop (DD-4); nothing on the Pi was hand-edited.

**Date:** 2026-09-19. `<PI_IP>` = `192.168.1.214` (the DHCP lease did not move across the reboot).

Pre-flight (before the rename):

- `getent ahostsv4 MilarachiC4I | awk 'NR==1{print $1, $3}'` → `192.168.1.214 MilarachiC4I.mynetworksettings.com`
- `ssh -o BatchMode=yes rmilarachi@MilarachiC4I 'hostname; cloud-init status; sudo -n true'` → `MilarachiC4I` / `status: done` / sudo OK — **baseline = `done`** (the `degraded done` seen on 2026-09-14 had cleared by itself; not an F6 effect either way)
- `sudo grep -E "^hostname:" /var/lib/cloud/instance/cloud-config.txt` (cached cloud-init config) → `hostname: MilarachiC4I`
- `cat /var/lib/cloud/data/instance-id` / `sudo grep -E "^instance-id:" /boot/firmware/meta-data` → `rpi-imager-1772074782562` in both (unchanged instance-id → cloud-init reuses its cached config on reboot; the drop-in + user-data flip cover that case)
- `ls /etc/cloud/cloud.cfg.d/` → `05_logging.cfg 99_raspberry-pi.cfg README` (no pre-existing `99-c4i-hostname.cfg` → no `.cfg.bak` expected)
- `grep -rn "^ssh_deletekeys" /etc/cloud/cloud.cfg /etc/cloud/cloud.cfg.d/ || true; sudo grep -n "^ssh_deletekeys" /boot/firmware/user-data || true` → `/etc/cloud/cloud.cfg.d/99_raspberry-pi.cfg:17:ssh_deletekeys: false`; key absent from user-data (so a `cloud-init clean` recovery would have kept the host keys)

Rename (script shipped with `scp` to `~/chores4irl/deploy/pi/` + `cloud-init/`):

- `ssh rmilarachi@MilarachiC4I 'chmod +x ~/chores4irl/deploy/pi/set-hostname.sh && ~/chores4irl/deploy/pi/set-hostname.sh c4i'` → `exit 0`; `[1/4]` `backed up -> /boot/firmware/user-data.bak`, `hostname: -> c4i`, `manage_etc_hosts: -> false`; `[2/4]` `backed up -> /etc/hosts.bak`, `127.0.1.1 -> c4i c4i`, `hostnamectl hostname c4i`; `[3/4] installed.` (no `.bak` — none pre-existed); `[4/4]` verify lines all as expected (`hostname: c4i`, `manage_etc_hosts: false`, `c4i`, `127.0.1.1 c4i c4i`, `preserve_hostname: true`, `manage_etc_hosts: false`, avahi `active`); the only `WARNING:` was the laptop reminder (`deploy.sh / ~/.ssh/config targets 'MilarachiC4I' -> 'c4i'`); no `sudo: unable to resolve host` line appeared
- `ssh rmilarachi@MilarachiC4I 'sudo reboot'` → connection dropped at 17:31:09 (expected)
- `getent ahostsv4 c4i | awk 'NR==1{print $1, $3}'` → `192.168.1.214 c4i.mynetworksettings.com` at 17:31:59 — resolved on the first poll, ~50 s after the reboot command (DHCP re-registration lag ≈ the reboot itself)
- **DD-3 rung taken: `rung 0`** — bare `c4i` resolved without escalation; rung 1 (`systemd-run --unit=c4i-release …` re-lease) and rung 2 (router UI) were not needed
- **`deploy.sh` target written:** `sed -i 's/rmilarachi@MilarachiC4I/rmilarachi@c4i/g' deploy.sh` → both the `scp` and `ssh` lines now read `rmilarachi@c4i` (rung 0–2 form; local, gitignored file)

Post-reboot proof (`ssh -o StrictHostKeyChecking=accept-new rmilarachi@c4i '…'`, rc=0; ssh printed `Permanently added 'c4i' (ED25519)` — same host key, new name):

- `cloud-init status --wait` → `status: done`
- `hostname` → `c4i`
- `grep 127.0.1.1 /etc/hosts` → `127.0.1.1 c4i c4i` (cloud-init did not re-render the old name)
- `sudo grep -E '^(hostname|manage_etc_hosts):' /boot/firmware/user-data` → `hostname: c4i` + `manage_etc_hosts: false`
- `sudo grep -E '^(preserve_hostname|manage_etc_hosts):' /etc/cloud/cloud.cfg.d/99-c4i-hostname.cfg` → `preserve_hostname: true` + `manage_etc_hosts: false`
- `cloud-init status` → `status: done` (= pre-flight baseline; no new `degraded`/`error`)
- `systemctl is-active avahi-daemon chores4irl` → `active` / `active` (Avahi followed the hostname change without a restart, as documented)
- `systemctl cat chores4irl.service | grep -ci milarachic4i || true` → `0` (the Pi-side unit carries no hostname)
- `docker ps --format "{{.Names}} {{.Status}}"` → `chores4irl-frontend-1 Up 7 seconds (healthy)` / `chores4irl-backend-1 Up 30 seconds (healthy)`
- `sudo grep -c "preserve_hostname' is set" /var/log/cloud-init.log` → `1` (drop-in was read — `cc_update_hostname` skipped)
- `sudo grep -c "manage_etc_hosts' is not set" /var/log/cloud-init.log` → `1` (the user-data flip, not the cached `true`, won — `cc_update_etc_hosts` skipped)
- `sudo journalctl -b -u cloud-init.service -u cloud-init-local.service -u cloud-init-main.service | grep -c "user maintained" || true` → `0` (informational only; with `preserve_hostname: true` the hostname modules never reach that message)
- `sudo cloud-init clean && sudo reboot` recovery rung → **not needed** (`/etc/hosts` held `c4i` after the reboot)
- `sudo rm -f /boot/firmware/user-data.bak /etc/hosts.bak /etc/cloud/cloud.cfg.d/99-c4i-hostname.cfg.bak` → done (DD-8; rollback is now `set-hostname.sh MilarachiC4I` alone)

Laptop-side name checks (IPv4 throughout — the stack listens on IPv4 only):

- `curl -4 -s -o /dev/null -w '%{http_code}\n' http://c4i/api/chores` → `200` (bare name, router DNS + search domain)
- `curl -4 -s -o /dev/null -w '%{http_code}\n' http://192.168.1.214/api/chores` → `200` (raw IP still works)
- `/mnt/c/windows/system32/ping.exe -4 -n 1 c4i.local` → `Pinging c4i.local [192.168.1.214]` / reply `TTL=64` (Windows' built-in mDNS resolver; address family IPv4)
- `ssh -o StrictHostKeyChecking=accept-new rmilarachi@c4i 'getent hosts c4i.local'` → `172.18.0.1      c4i.local` — **not** `192.168.1.214`: the Pi resolves its own mDNS name to its Docker Compose bridge `br-c35bfa1e87f1` (`172.18.0.1/16`), because `avahi-daemon.conf` uses defaults (no `allow-interfaces=` / `deny-interfaces=` / `publish-addresses=`), Avahi publishes an address on every interface it runs on, and `nss-mdns` returns the first one. LAN clients are unaffected (the `ping.exe` line above shows `192.168.1.214`; nginx is published on `0.0.0.0:80`, so even `172.18.0.1` serves the app). Caveat recorded in `## Client caveats` and `deploy/pi/README.md`; a defensive `[server] deny-interfaces=br-…` (or `allow-interfaces=wlan0`) in `avahi-daemon.conf` was **not** applied — the bridge name is Compose-generated and can change on `docker compose down`/`up`, so pinning it would be its own maintenance item.

Relayed to the user, not acted on (DD-7 — subagents stay out of `~/.ssh/` and `.claude/settings*.json`): rename the `~/.ssh/config` alias `Host milarachic4i` → `Host c4i` (`HostName c4i`); no `ssh-keygen -R` is needed (host key unchanged, `accept-new` added the `c4i` entry); the `Bash(ssh c4i:*)` / `Bash(ssh rmilarachi@c4i:*)` allow-rules and the removal of the old `milarachic4i` rules in `.claude/settings.local.json` are the user's call.

### Pending client checks (user)

Not verifiable from the laptop CLI (DD-5) — confirm at the `/run-feature` Phase B merge gate; a failing client goes into the caveats table in a follow-up commit:

- phone → `http://c4i.local/` (iOS/Android 12+ — mDNS)
- Windows browser → `http://c4i/` (type `c4i/` or `http://c4i` the first time) and `http://c4i.local/`

## Rollback

- Name rollback: on the Pi run `deploy/pi/set-hostname.sh MilarachiC4I` then `sudo reboot`
  (the drop-in and `manage_etc_hosts: false` stay — the old name is then held by
  hostnamectl + `/etc/hosts` the same way); wait for
  `getent ahostsv4 MilarachiC4I` to answer again, then update `deploy.sh` back to
  `rmilarachi@MilarachiC4I`.
- `.bak` copies (`/boot/firmware/user-data.bak`, `/etc/hosts.bak`, and
  `/etc/cloud/cloud.cfg.d/99-c4i-hostname.cfg.bak` if a drop-in pre-existed) exist only
  until the post-reboot proof — before that point `sudo cp <f>.bak <f>` restores them if
  the script itself is unusable, followed by `sudo hostnamectl set-hostname MilarachiC4I`
  so `/etc/hosts` and the running hostname move back together (a restored `/etc/hosts`
  with the hostname still `c4i` gives `sudo: unable to resolve host c4i` on every call,
  and with the drop-in in place cloud-init will not repair it); after that, rollback is
  the script. (Deleted 2026-09-19 once the post-reboot proof passed — see Verification log.)
- Full revert to cloud-init management: remove `/etc/cloud/cloud.cfg.d/99-c4i-hostname.cfg`, set `manage_etc_hosts: true` back in user-data, reboot.
- If the `sudo cloud-init clean && sudo reboot` recovery rung is needed (old name still in
  `/etc/hosts` after the post-rename reboot), check `ssh_deletekeys` in user-data first —
  `true` or absent means `clean` re-runs the per-instance `ssh` module and regenerates the
  Pi's SSH host keys, so the benign first-connect prompt becomes a "REMOTE HOST
  IDENTIFICATION HAS CHANGED" mismatch: re-trust deliberately (`ssh-keygen -R c4i`, then
  reconnect), never bypass host-key checking.
- Not reverted, by design: `known_hosts` entries added under the new name (same host key)
  and the script + `cloud-init/` copy under `~/chores4irl/deploy/pi/` on the Pi.

## Downstream (pi-kiosk / F15)

pi-kiosk `target_url` should become `http://c4i.local/` everywhere (wall Pi included) for consistency with the LAN name; RISK for F15: the kiosk then depends on Avahi + nss-mdns being up on the Pi at login (boot-order dependency) — F15 must weigh a `localhost` fallback.

Fold-back note for `/run-feature` Phase C (META-PLAN F15 section / Infra-track bullet, 2026-09-19): F6 is live — `target_url` → `http://c4i.local/`; carry the DD-11 risk (Avahi + nss-mdns must be up at login; weigh a `localhost` fallback) and the observed caveat that the Pi resolves `c4i.local` to its Docker bridge `172.18.0.1` (still served, but one more reason the wall Pi's kiosk should keep `http://localhost/`).
