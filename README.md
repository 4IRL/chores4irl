# chores4irl

A household chore-tracking app designed to run on a Raspberry Pi 4 with an attached touchscreen in kiosk mode. Two containers — an Express + SQLite API and an Nginx-served React/Vite frontend — wired together with a persistent Docker volume so chore history survives restarts.

## Architecture

- **Backend** (`backend/`) — Express + TypeScript, `better-sqlite3` in WAL mode. Serves `/api/*`. DB location is controlled by the `DB_PATH` env var (defaults to a file at repo root in dev; `/data/data.db` in the container).
- **Frontend** (`frontend/`) — React + Vite + Tailwind. Calls the API via relative URLs (`fetch('/api/chores')`) so it must share an origin with the backend in production.
- **Nginx** (`nginx.conf`) — serves the built frontend and reverse-proxies `/api/*` to the backend over the Compose network. That shared origin is what lets the frontend's relative URLs work.

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

For the full rationale, step-by-step validation, and troubleshooting, see [`plans/deploy/docker-raspberry-pi/docker-raspberry-pi.md`](plans/deploy/docker-raspberry-pi/docker-raspberry-pi.md).

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
scp /tmp/chores4irl-src.tar.gz <pi-user>@<pi-host>:~/chores4irl-src.tar.gz
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

### First-boot Pi setup

Once the containers are running, configure the Pi host so it boots straight into the app:

- **Timezone** — `sudo timedatectl set-timezone <your-zone>` (e.g. `America/New_York`). Chore urgency/completion dates depend on this. The systemd unit and Docker Compose propagate the host's `TZ` through to the backend container.
- **NTP** — `sudo timedatectl set-ntp true`. Primary time source while online.
- **Offline timekeeping** — the Pi 4 has **no on-board RTC**. Raspberry Pi OS enables `fake-hwclock` by default, which restores the last-saved time on boot so the clock never falls back to 1970 (verify with `systemctl is-enabled fake-hwclock` → `enabled`; force a save with `sudo fake-hwclock save`). After a long offline stretch the restored time can be stale until NTP resyncs. For true battery-backed offline time, fit an external I2C/HAT RTC (e.g. a DS3231): add `dtoverlay=i2c-rtc,ds3231` to `/boot/firmware/config.txt`, reboot, then `sudo hwclock --systohc --utc` once NTP has synced and disable `fake-hwclock`.
- **Chromium kiosk mode** — install `chromium-browser` and `unclutter`, then drop a `chores4irl-kiosk.desktop` file into `~/.config/autostart/` that launches Chromium with `--kiosk --incognito http://localhost/` (plus `xset` calls to disable screen blanking).
- **Display rotation** — depends on session type (`echo $XDG_SESSION_TYPE`):
  - **Wayland** (Bookworm default): `wlr-randr --output <name> --transform 90` (discover `<name>` by running `wlr-randr` with no args). Add the command to the autostart `.desktop` `Exec=` line before `chromium-browser` so rotation applies every login.
  - **X11**: `display_rotate=1` in `/boot/firmware/config.txt` for DSI panels (rotates both framebuffer and touch); `xrandr --output HDMI-1 --rotate left` for HDMI.
- **Autostart on boot** — a systemd unit (`/etc/systemd/system/chores4irl.service`) brings the Compose stack up before the desktop autostart launches Chromium.

Full copy-pasteable snippets for all of the above are in the deployment plan.

### Backup strategy

Household chore history lives in a single Docker volume on an SD card — and SD cards fail. A weekly SQLite online backup is scheduled via cron:

- Script: `bin/chores4irl-backup.sh` — runs `better-sqlite3`'s online `db.backup()` against the live container, copies the snapshot to `~/backups/chores4irl-<timestamp>.db`, and prunes older backups.
- Retention: last **14 weeks**.
- Cron: `0 3 * * 0 /home/pi/bin/chores4irl-backup.sh >> /home/pi/backups/backup.log 2>&1` (Sundays 03:00 local).

Optional: add an `rsync` line to the script to copy `~/backups/` off the Pi to a NAS or another LAN host.

### Updating an existing Pi deployment

Same shipping workflow — the `chores-data` volume is not touched by builds, so chore data persists across upgrades:

```bash
# On the laptop:
tar --exclude-from=.dockerignore -czf /tmp/chores4irl-src.tar.gz .
scp /tmp/chores4irl-src.tar.gz pi@<pi-host>:~/chores4irl-src.tar.gz

# On the Pi:
tar -xzf ~/chores4irl-src.tar.gz -C ~/chores4irl    # re-extract over the existing dir
cd ~/chores4irl
docker compose up -d --build
```

`docker compose down -v` would wipe chore data — use plain `docker compose down` (or the systemd unit's `ExecStop`) when restarting.
