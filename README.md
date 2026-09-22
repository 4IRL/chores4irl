# chores4irl

A household chore-tracking app designed to run on a Raspberry Pi 4 with an attached touchscreen in kiosk mode. Two containers — an Express + SQLite API and an Nginx-served React/Vite frontend — wired together with a persistent Docker volume so chore history survives restarts.

## Architecture

- **Backend** (`backend/`) — Express + TypeScript, `better-sqlite3` in WAL mode. Serves `/api/*`. DB location is controlled by the `DB_PATH` env var (defaults to a file at repo root in dev; `/data/data.db` in the container). `db.ts` also runs an idempotent, `pragma table_info`-guarded schema migration at boot (currently: drop the legacy `details`/`long_term_task` columns).
- **Frontend** (`frontend/`) — React + Vite + Tailwind. Calls the API via relative URLs (`fetch('/api/chores')`) so it must share an origin with the backend in production.
- **Nginx** (`nginx.conf`) — serves the built frontend and reverse-proxies `/api/*` to the backend over the Compose network. That shared origin is what lets the frontend's relative URLs work.

## How prioritization works

Rather than a flat to-do list, chores are sorted into three **status buckets** by the colour
their timer bar shows — **red** (overdue), **orange** (due soon: 37.5 % or less of its cycle
left) and **green** — using the same classifier the bar paints with
(`frontend/src/utils/choreBarMath.ts`, `classifyStatus`). Within each bucket chores are
ranked by what matters for that colour:

- **Red** — by how overdue the chore is relative to its frequency
  (`(daysSinceLastCompleted − frequency) / frequency`), multiplied by its urgency
  (Low 0.75, Medium or unset 1, High 1.5); on a tie, the longer chore (by duration) goes first.
- **Orange** — closest to due first.
- **Green** — most recently completed first.

The first 8 slots (roughly one unscrolled kiosk screen) show 4 red, 2 orange and 2 green
chores; any slot a bucket can't fill is donated red → orange → green. Each red chore that is
overdue by at least one full frequency — i.e. 2× its frequency has elapsed, after urgency
weighting — moves one more of those slots to red (taken from orange first, then green), so
four or more such chores fill all 8 slots with red. Everything past the first 8 follows in
bucket order: remaining reds, then oranges, then greens. Urgency affects the sort only, never
the bar colour.

The order changes only at midnight (and when stepping the simulated date) — completing a
chore leaves it in place until then. There is still no separate tier for infrequent
maintenance chores: a quarterly chore sits in whichever status bucket its bar shows and
competes there like daily upkeep. The sort lives in `frontend/src/utils/choreSort.ts`
(`orderChores`); the fold size, base quotas, escalation threshold and urgency multipliers are
tunables in `frontend/src/assets/constants.ts`.

Each chore renders as a timer bar that drains as its due date approaches and turns red once
overdue (`frontend/src/utils/choreBarMath.ts`). The displayed date can be stepped forward to
preview how the bars will look on future days.

### Adding and editing chores

- **Dates are local calendar days** — the form's Last Completed field is parsed and shown as
  the browser's local date (`frontend/src/utils/formDate.ts`), so a chore added today reads
  "0 days ago" in any timezone. Chores created before this fix were stored as UTC midnight
  and can read one day early in zones behind UTC until their next tap-to-complete; re-saving
  them from the edit form does not drift further.
- **Add-form defaults** — Last Completed starts as today (the real date, even while
  previewing a future day) and Room starts as the active room tab (blank under *All*); both
  stay editable.
- **Feedback toast** — add/save/delete confirmations appear as a green pill at the bottom of
  the screen for ~2.5 s; failures show a red pill that stays until it is dismissed with a tap
  (or its ✕) or a later add/save/delete/tap-to-complete succeeds
  (`frontend/src/components/common/Toast.tsx`).

### Data model

The `Chore` shape is shared between frontend and backend via `types/SharedTypes.d.ts` (the
monorepo's single source of truth, imported with `import type` on both sides):

```typescript
interface Chore {
    id: number;
    name: string;
    room: string;
    dateLastCompleted: Date;
    duration: number;        // minutes — how long the task takes
    frequency: number;       // days — how often it should be done
    urgency?: 'low' | 'medium' | 'high';
}
```

## Local development

```bash
npm ci
npm run dev --workspace backend      # :3000
npm run dev --workspace frontend     # :5174
```

Tests:

```bash
npm run test --workspace backend     # vitest
npm run test --workspace frontend    # vitest
npx playwright test                  # e2e
```

## Deployment

The production target is a Raspberry Pi 4 (ARM64) running 64-bit Raspberry Pi OS Bookworm. Deployment ships the **source tree** to the Pi and builds natively there, because `better-sqlite3`, `@tailwindcss/oxide`, `lightningcss`, and `@rollup/rollup` all have platform-specific native binaries — building the image on an x86_64 laptop and `docker save`/`docker load`-ing to the Pi would ship the wrong binaries.

For the full rationale, step-by-step validation, and troubleshooting, see [`plans/completed/docker-raspberry-pi/docker-raspberry-pi.md`](plans/completed/docker-raspberry-pi/docker-raspberry-pi.md).

### Local smoke test

Before shipping anything, verify the stack builds and runs end-to-end on the laptop:

```bash
docker compose build
docker compose up -d
curl http://localhost/api/chores      # expect {"success":true,"data":[...]}
```

Open `http://localhost/` in a browser to confirm the frontend renders and the add/complete/delete flow works. `docker compose down -v` resets the volume when you're done.

### Pi prerequisites

On a fresh Raspberry Pi 4:

- 64-bit Raspberry Pi OS Bookworm.
- Docker installed:
  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER   # re-login after this
  ```
- Confirm the architecture and Docker daemon:
  ```bash
  uname -m          # → aarch64
  docker version    # server section should be populated
  ```

### Shipping source to the Pi

From the repo root on the laptop, build the tarball with `git archive` — it ships
exactly the committed tree (Dockerfiles, compose, nginx.conf, source) and omits
`node_modules`, `.git`, `.env`, and build artifacts. (Do **not** use
`tar --exclude-from=.dockerignore`: `.dockerignore` excludes `Dockerfile*` and
`docker-compose*.yml` from the image build context, so a tarball built that way
would ship without the files needed to build on the Pi.)

```bash
git archive --format=tar.gz -o /tmp/chores4irl-src.tar.gz HEAD
scp /tmp/chores4irl-src.tar.gz <pi-user>@c4i:~/chores4irl-src.tar.gz
```

Then on the Pi:

```bash
rm -rf ~/chores4irl && mkdir -p ~/chores4irl
tar -xzf ~/chores4irl-src.tar.gz -C ~/chores4irl
cd ~/chores4irl
docker compose build     # native ARM64 build; npm install dominates
docker compose up -d
```

From another machine on the LAN: `curl http://<pi-ip>/api/chores` to confirm the stack is up.
The Pi also answers as `http://c4i.local/` (mDNS) and `http://c4i/` (router DNS) — see [`deploy/pi/README.md`](deploy/pi/README.md) § LAN name for the client matrix; the raw IP keeps working.

### First-boot Pi setup

Once the containers are running, configure the Pi host so it boots straight into the app:

- **Timezone** — `sudo timedatectl set-timezone <your-zone>` (e.g. `America/New_York`). Chore urgency/completion dates depend on this (the add/edit form stores the browser's local calendar day — see § Adding and editing chores above). The systemd unit and Docker Compose propagate the host's `TZ` through to the backend container.
- **NTP** — `sudo timedatectl set-ntp true`. Primary time source while online.
- **Offline timekeeping** — the Pi 4 has **no on-board RTC**. Raspberry Pi OS enables `fake-hwclock` by default, which restores the last-saved time on boot so the clock never falls back to 1970 (verify with `systemctl is-enabled fake-hwclock` → `enabled`; force a save with `sudo fake-hwclock save`). After a long offline stretch the restored time can be stale until NTP resyncs. For true battery-backed offline time, fit an external I2C/HAT RTC (e.g. a DS3231): add `dtoverlay=i2c-rtc,ds3231` to `/boot/firmware/config.txt`, reboot, then `sudo hwclock --systohc --utc` once NTP has synced and disable `fake-hwclock`.
- **Chromium kiosk mode** — install `chromium-browser` and `unclutter`, then drop a `chores4irl-kiosk.desktop` file into `~/.config/autostart/` that launches Chromium with `--kiosk --incognito http://localhost/` (plus `xset` calls to disable screen blanking).
- **Display rotation** — depends on session type (`echo $XDG_SESSION_TYPE`):
  - **Wayland** (Bookworm default): `wlr-randr --output <name> --transform 90` (discover `<name>` by running `wlr-randr` with no args). Add the command to the autostart `.desktop` `Exec=` line before `chromium-browser` so rotation applies every login.
  - **X11**: `display_rotate=1` in `/boot/firmware/config.txt` for DSI panels (rotates both framebuffer and touch); `xrandr --output HDMI-1 --rotate left` for HDMI.
- **Autostart on boot** — a systemd unit (`/etc/systemd/system/chores4irl.service`) brings the Compose stack up before the desktop autostart launches Chromium.
- **Reaching the app by name** — run `deploy/pi/set-hostname.sh` (then reboot) so the Pi is named `c4i` and reachable by name from LAN clients (the `c4i.local` / `c4i` URLs above); see [`deploy/pi/README.md`](deploy/pi/README.md) § LAN name. The kiosk itself stays on `http://localhost/`.

Full copy-pasteable snippets for all of the above are in the deployment plan.

### Backup strategy

Household chore history lives in a single Docker volume on an SD card — and SD cards fail. Two distinct failure modes need covering, and they need different defenses:

- **Logical loss** — a bug, a bad write, an accidental `docker compose down -v`, or fat-fingered deletion. Restore from a recent snapshot.
- **Physical card death** — the on-card snapshots die *with* the card, so the only protection is a copy kept **off** the Pi.

A weekly SQLite **online** backup (`better-sqlite3`'s `db.backup()` against the live container — safe with WAL mode, unlike copying the file directly) plus a mandatory off-Pi `rsync` covers both. Backups run on a **systemd timer**, not cron: with `Persistent=true`, a run missed because the Pi was powered off at the scheduled time is caught up on next boot — plain cron silently skips it.

Files (shipped in the source tree, so they reach the Pi via `git archive`):

- `bin/chores4irl-backup.sh` — takes the snapshot into `~/backups/chores4irl-<timestamp>.db`, prunes to the most recent **14**, then rsyncs the backup dir off the Pi. **Refuses to run** unless `BACKUP_RSYNC_DEST` is set, so a backup can never end up only on the SD card.
- `deploy/pi/chores4irl-backup.service` — oneshot that runs the script.
- `deploy/pi/chores4irl-backup.timer` — Sundays 03:00 local, `Persistent=true`.

Install on the Pi (substitute `/home/pi` if your login differs). First set the off-Pi destination in the service unit — `Environment=BACKUP_RSYNC_DEST=user@nas:/srv/backups/chores4irl` (a LAN host / NAS reachable over key-based SSH) — then:

```bash
sudo cp deploy/pi/chores4irl-backup.service deploy/pi/chores4irl-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now chores4irl-backup.timer
systemctl list-timers chores4irl-backup.timer   # confirm the next scheduled run
```

Validate once immediately: `sudo systemctl start chores4irl-backup.service && ls -la ~/backups`. Check logs with `journalctl -u chores4irl-backup.service`. Spot-check the snapshot: `sqlite3 ~/backups/chores4irl-*.db 'SELECT count(*) FROM chores;'` should match the live count.

### Updating an existing Pi deployment

Same shipping workflow — the `chores-data` volume is not touched by builds, so chore data persists across upgrades:

```bash
# On the laptop (ships the committed tree — commit first):
git archive --format=tar.gz -o /tmp/chores4irl-src.tar.gz HEAD
scp /tmp/chores4irl-src.tar.gz pi@c4i:~/chores4irl-src.tar.gz

# On the Pi:
tar -xzf ~/chores4irl-src.tar.gz -C ~/chores4irl    # re-extract over the existing dir
cd ~/chores4irl
docker compose up -d --build
```

`docker compose down -v` would wipe chore data — use plain `docker compose down` (or the systemd unit's `ExecStop`) when restarting.

Releases that carry a schema migration alter `/data/data.db` on first boot. Take a snapshot first (`sudo systemctl start chores4irl-backup.service`) before `docker compose up -d --build`; the previous image cannot write to a migrated DB, so rolling back means restoring that snapshot as well. If the frontend never comes up after the rebuild, run `docker compose logs backend` — a failed migration aborts the backend on purpose rather than masking a migration failure.
