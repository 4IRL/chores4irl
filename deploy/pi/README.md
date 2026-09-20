# Pi host artifacts (`deploy/pi/`)

Host-side configuration that lives **on the Raspberry Pi**, outside Docker. These
files are **not** part of the container images and are **never touched by a
redeploy** (`git archive` → tarball → `docker compose build` only rebuilds the
two containers). They are version-controlled here so a wiped or drifted Pi can be
restored with one command — the canonical copies are the live files on the Pi.

Target Pi: hostname `c4i` (LAN names `c4i.local` / `c4i`; formerly `MilarachiC4I`),
Debian 13 (trixie) / RPi PIXEL desktop, compositor **labwc**, user
`rmilarachi`, single HDMI touchscreen (panel `DZX Z3`, 1024×600), USB touch
panel `yldzkj USB2IIC_CTP_CONTROL`.

## Files

| Repo file | Lives on the Pi at | Purpose |
|---|---|---|
| `chores4irl-backup.service` / `.timer` | `/etc/systemd/system/` | Weekly SQLite volume backup |
| `display/kanshi-config` | `~/.config/kanshi/config` | Display rotation |
| `display/labwc-rc.xml.fragment` | merge into `~/.config/labwc/rc.xml` | Touch rotation (libinput `calibrationMatrix`) |
| `install-display-config.sh` | run on the Pi | Idempotently apply both of the above |
| `set-hostname.sh` | run on the Pi | Hostname → `c4i` (LAN name: `c4i.local` / `c4i`) |
| `cloud-init/99-c4i-hostname.cfg` | `/etc/cloud/cloud.cfg.d/` | Stop cloud-init managing hostname / `/etc/hosts` |

## Display rotation & touch alignment

Two independent settings — rotating the **display** does **not** rotate **touch**:

1. **Display** — kanshi (`~/.config/kanshi/config`), launched by the RPi desktop
   from `/etc/xdg/labwc/autostart`.
2. **Touch** — a libinput `calibrationMatrix` in `~/.config/labwc/rc.xml`. labwc's
   `mapToOutput` does not rotate touch with the output.

**They must agree.** Pick the row for the orientation you want and use both values
from it. (Verified known-good anchor: `transform 270` ↔ `0 1 0 -1 0 1`.)

| Upright needs | kanshi `transform` | labwc `calibrationMatrix` |
|---|---|---|
| no rotation | `normal` | `1 0 0 0 1 0` |
| 90°  | `90`  | `0 -1 1 1 0 0` |
| 180° | `180` | `-1 0 1 0 -1 1` |
| 270° | `270` | `0 1 0 -1 0 1` |

Current shipped values: **`transform 90`** ↔ **`0 -1 1 1 0 0`** (the panel was
remounted since first deploy, so the original `270` is now 180° upside down).

**Find the right row live, without rebooting:**

```bash
wlr-randr                                   # list outputs + current Transform
# wlr-randr identifies outputs by CONNECTOR NAME (e.g. HDMI-A-1 / HDMI-A-2) — the
# first token on each output line — NOT by the "DZX Z3 ..." description that kanshi
# matches on. Use the connector name printed above:
wlr-randr --output HDMI-A-1 --transform 90  # try until upright (sub in your name)
```

Then set the matching `calibrationMatrix` in `rc.xml` and `labwc --reconfigure`,
and drag the date scrubber to confirm touch lands correctly.

### Port-independent output matching (the durable fix)

kanshi matches an output by **name** *or* by **make/model/serial description**.
Connector names drift between `HDMI-A-1` and `HDMI-A-2` depending on which
micro-HDMI port the cable is in; when the name drifts, the profile silently stops
applying — the screen goes unrotated and touch looks misaligned (the matrix still
assumes a rotated display). This is what looked like a "deploy broke rotation"
regression on 2026-06-27; the deploy was unrelated.

The shipped config matches by description (`output "DZX Z3 0000000000000"`), which
survives port swaps. Re-verify the string with `wlr-randr` only if the panel is
replaced.

## Apply / restore onto a Pi

```bash
# From the repo checkout on the Pi:
deploy/pi/install-display-config.sh        # installs kanshi config + touch matrix
labwc --reconfigure                         # apply touch without a full reboot
```

The script is idempotent (safe to re-run), backs up `rc.xml` before touching it,
and refuses to clobber an existing `<libinput>` block — printing instructions
instead.

**Verify the install before rebooting** (catches a failed apply early):

```bash
diff deploy/pi/display/kanshi-config ~/.config/kanshi/config   # display profile landed
grep -A4 '<calibrationMatrix>' ~/.config/labwc/rc.xml          # touch matrix inserted
wlr-randr                                                       # output name + Transform
```

Then confirm after a cold boot: screen upright, touch aligned (drag the date scrubber).

## LAN name: `c4i.local` / `c4i` (hostname)

The app answers on two names as well as the raw IP:

- **`http://c4i.local/`** — mDNS. Avahi (`avahi-daemon` + `libnss-mdns`, already running
  on the Pi) advertises `<hostname>.local`.
- **`http://c4i/`** — router DNS. The router registers each DHCP client's hostname (DHCP
  option 12) in its own zone (`c4i.mynetworksettings.com` on this FiOS-style router) and
  pushes that search domain to its DHCP clients, so the bare name resolves.

Both resolvers copy the **hostname**, so the hostname is the single knob: the Pi is named
`c4i` and nothing else is configured (no `host-name=` in `avahi-daemon.conf`, no
`dhcp-hostname` in NetworkManager, no router-side static entry). Everything is additive —
`http://<pi-ip>/` keeps working.

### How the rename is held against cloud-init

The hostname is cloud-init-managed on this Pi: `/boot/firmware/user-data` carries
`hostname:` and `manage_etc_hosts: true`, and `/etc/cloud/cloud.cfg` has
`preserve_hostname: false`, so a bare `hostnamectl set-hostname` would be undone —
`/etc/hosts` gets re-rendered from the seed's old name on every boot (`sudo: unable to
resolve host …` noise). `set-hostname.sh` makes three edits, each load-bearing:

1. Rewrites the `hostname:` line in `/boot/firmware/user-data` to the new name (so a
   later `cloud-init clean` cannot resurrect the old name) and, because user-data
   out-ranks `cloud.cfg.d` for `manage_etc_hosts`, flips that key to `false` there too.
   user-data also holds `users:` credentials — the script edits those two lines in place
   and never prints the file.
2. Applies the change immediately: the `127.0.1.1` line in `/etc/hosts` first, then
   `hostnamectl`.
3. Installs the drop-in `cloud-init/99-c4i-hostname.cfg` → `/etc/cloud/cloud.cfg.d/`
   (`preserve_hostname: true`, `manage_etc_hosts: false`), which stops cloud-init
   re-applying the seed's hostname / re-rendering `/etc/hosts` every boot.

If a reboot still shows the old name in `/etc/hosts` (cloud-init used its cached config),
run `sudo cloud-init clean && sudo reboot` once.

**Steady state after F6:** cloud-init no longer manages the hostname or `/etc/hosts` on
this Pi (`preserve_hostname: true`; `manage_etc_hosts: false`); editing `hostname:` in
user-data is inert — change the name with `deploy/pi/set-hostname.sh <name>` only. The
cloud-init comment header at the top of `/etc/hosts` is stale after F6 (edits now
persist); it is left in place on purpose (minimal diff).

### Apply / re-apply

```bash
# From the shipped tree on the Pi (~/chores4irl) — the script lives in
# ~/chores4irl/deploy/pi/ and reads its drop-in from cloud-init/ next to it:
cd ~/chores4irl
deploy/pi/set-hostname.sh c4i && sudo reboot   # reboot so DHCP re-registers the name
```

The script is idempotent (a re-run reports "already up to date" for each target and
changes nothing) and backs up each file it rewrites to `<file>.bak`.

`deploy.sh` ships only the app, so `deploy/pi/` artifacts are not synced by a normal
redeploy: before a re-apply or rollback, `scp deploy/pi/set-hostname.sh` and
`deploy/pi/cloud-init/99-c4i-hostname.cfg` from the repo into `~/chores4irl/deploy/pi/` on
the Pi first (the copy applied on 2026-09-19 predates later hardening of the script).

### Verify

On the Pi:

```bash
hostname                                                         # → c4i
grep 127.0.1.1 /etc/hosts                                        # → 127.0.1.1 c4i c4i
sudo grep -E '^(hostname|manage_etc_hosts):' /boot/firmware/user-data    # → hostname: c4i / manage_etc_hosts: false
grep -E '^(preserve_hostname|manage_etc_hosts):' /etc/cloud/cloud.cfg.d/99-c4i-hostname.cfg   # → true / false
```

From a LAN client:

```bash
curl -4 -s http://c4i/api/chores        # bare name — WSL / Windows / macOS via router DNS + search domain
curl -s http://c4i.local/api/chores     # mDNS — only from an mDNS-capable client (macOS, Linux with
                                        # libnss-mdns); NOT the WSL CLI — see the matrix below
curl -s http://<pi-ip>/api/chores       # raw IP still works
```

From Windows, use `ping.exe -4 -n 1 c4i.local` or open `http://c4i.local/` in a browser.

### Client caveats

| Client | `c4i.local` | bare `c4i` |
|---|---|---|
| iOS / macOS | ✓ | ✓ |
| Windows 10+ | ✓ | ✓ |
| WSL CLI | ✗ (no `nss-mdns`) | ✓ |
| Android 12+ | ✓ | ✗ (ignores DHCP search domain) |
| Android < 12 | ✗ | ✗ (use the IP) |
| Linux | ✓ with `libnss-mdns` | ✓ if it uses router DNS + search domain |
| The Pi itself | ✓ but answers `172.18.0.1` (Docker bridge), see note | ✓ (`127.0.1.1` via `/etc/hosts`) |

- Browsers treat a single label as a search term: type `c4i/` or `http://c4i` the first
  time; `c4i.local` (has a dot) is always treated as a URL.
- The router keeps the old lease name until the Pi's next DHCP request (a reboot
  re-registers it); Windows may cache the old answer — `ipconfig /flushdns`.
- SSH `known_hosts` keys by name: the first `ssh c4i` prompts once to trust the
  (unchanged) host key. `deploy.sh` / any `~/.ssh/config` `Host` entry must move to `c4i`.
- On the Pi itself, `getent hosts c4i.local` returns `172.18.0.1` (the Docker Compose
  bridge `br-…`), not the wlan0 LAN IP: `avahi-daemon.conf` uses defaults (no
  `allow-interfaces=` / `deny-interfaces=` / `publish-addresses=`), so Avahi publishes an
  address on every interface and `nss-mdns` returns the first one. LAN clients are
  unaffected (Windows mDNS → the LAN IP; observed 2026-09-19), and the app still answers on
  the bridge address because nginx is published on `0.0.0.0:80`. Not applied, on purpose:
  pinning `[server] allow-interfaces=wlan0` (or `deny-interfaces=` for the bridge, whose
  name is Compose-generated) in `/etc/avahi/avahi-daemon.conf` would fix the answer but
  adds a config file to keep in step with the network layout.
- IPv6-only clients are not served: the stack is reachable over IPv4 only on this Pi
  (this follows from `docker-compose.yml`'s `"80:80"` mapping and `nginx.conf`'s
  `listen 80;` — an IPv4-only publish, inferred from config rather than a logged probe).
  Dual-stack clients fall back from the router's AAAA to A automatically.

### Full revert (cloud-init back in charge)

Only if cloud-init should manage the hostname again — not needed to change or roll back
the name: remove `/etc/cloud/cloud.cfg.d/99-c4i-hostname.cfg`, set
`manage_etc_hosts: true` back in `/boot/firmware/user-data`, reboot. cloud-init then
re-renders `/etc/hosts` from user-data's `hostname:` on the next boot.

### Rollback

```bash
cd ~/chores4irl
deploy/pi/set-hostname.sh MilarachiC4I && sudo reboot
```

The script's `.bak` copies (`/boot/firmware/user-data.bak`, `/etc/hosts.bak`, and
`/etc/cloud/cloud.cfg.d/99-c4i-hostname.cfg.bak` if a drop-in pre-existed) exist only
until the reboot verification passes — delete them then with
`sudo rm -f /boot/firmware/user-data.bak /etc/hosts.bak /etc/cloud/cloud.cfg.d/99-c4i-hostname.cfg.bak`
(`user-data.bak` carries credentials — never print it), after which rollback is the
script alone. The drop-in and `manage_etc_hosts: false` stay in place on rollback — the
old name is then held by hostnamectl + `/etc/hosts` exactly the same way.
