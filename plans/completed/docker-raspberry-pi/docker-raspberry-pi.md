> **STATUS: Merged** `db6016c` (#13). Frozen — historical record, do not edit.
> **Outcome:** chores4irl dockerized and deployed to the Pi 4 (ARM64); this dir is the
> deployment stack of record. Two later deploy PRs build on it: **#19** (`c4153a9`,
> version-controlled kanshi/labwc display-rotation + touch calibration) and the pending
> in-app rotate button. Per META-PLAN Baseline Assumption 4, future host-bridge
> deploy docs (LAN alias, rotate, brightness/screen-blank/restart) may be anchored here
> **or** in the feature's own plan dir — the rotate plan already lives in
> `plans/feature/rotate-screen-button/`.
> **⚠ F-numbering note (2026-07-07):** this paragraph originally cited legacy F-numbers
> (`F8`/`F17`/`F12`–`F14`) which are now stale — see `plans/META-PLAN.md`'s "Legacy → current
> ID map" for the live IDs (rotate is now `F13`, LAN alias is `F6`, the device-control
> placeholders are `F7`/`F8`/`F10`). Written as a forward-pointer note rather than editing the
> frozen outcome text above.

# Docker Deployment to Raspberry Pi 4 (ARM64)

## Summary

Package chores4irl into two Docker containers — an Express API and an Nginx-served React frontend — with a persistent volume for the SQLite database, targeted at a Raspberry Pi 4 running 64-bit Raspberry Pi OS (Bookworm) with an attached touchscreen. Before any container work, fix a handful of pre-existing gaps (broken `start` script, fragile DB path, stray root `index.html`). Ship to the Pi by tarring the **source tree** (not `docker save`) and running `docker compose build` on the Pi natively so `npm ci` downloads ARM64 prebuilts for `better-sqlite3`, `@tailwindcss/oxide`, `lightningcss`, and `@rollup/rollup`. Finish with Pi host setup: chromium kiosk mode, display settings, systemd autostart, and a backup strategy for the SQLite volume. Target hardware is the **Pi 4** (64-bit Raspberry Pi OS Bookworm). From a container/ARM64 standpoint it is identical to a Pi 5 — both are `aarch64` and pull the same native npm prebuilts, so Steps 8, 9, and 11 are hardware-agnostic. The one difference that matters here is offline timekeeping: the Pi 4 has **no on-board RTC**, so across a power loss or offline boot it relies on `fake-hwclock` (installed and enabled by default on Raspberry Pi OS) to restore the last-saved time, with NTP as the authoritative source once networked. Chore urgency/completion-date logic depends on a sane wall-clock at boot; `fake-hwclock` bounds the staleness so the clock never jumps back to 1970, and an optional external I2C/HAT RTC module with a coin-cell gives true battery-backed time if accurate offline timestamps matter.

## Research Findings

- **Two-container architecture is correct.** The Express backend does **not** serve static files (no `express.static` anywhere in `backend/src`). A second process is required to serve `frontend/dist/`. Nginx in the frontend container doubles as a reverse proxy that routes `/api/*` to the backend service, which is essential because the frontend uses purely relative URLs (`fetch('/api/chores')`) with no `VITE_*` env var, so frontend and API **must appear to share an origin** in production. (Source: `backend/src/app.ts`, `frontend/src/services/choreApi.ts`, `frontend/vite.config.ts`.)
- **Pre-existing bug blocking any deploy:** `backend/package.json`'s `start` script runs `node dist/index.js`, but `tsc` emits `dist/server.js` from `src/server.ts` (there is no `src/index.ts`). The container `CMD` cannot just shell out to `npm start` as-is. Fix is trivial — change to `node dist/server.js`.
- **DB path is brittle:** `backend/src/db.ts` uses `path.resolve(__dirname, '../../data.db')`, anchored to wherever the compiled `dist/db.js` ends up. In a container this points somewhere unhelpful. We need a `DB_PATH` env var with a stable default. `TEST_DB_PATH=':memory:'` must still bypass file resolution as it does today.
- **ARM64 native modules need native build on the Pi.** `better-sqlite3`, `@tailwindcss/oxide`, `lightningcss`, and `@rollup/rollup` all have native `.node` binaries. All four publish ARM64 prebuilts, but the current `node_modules` on the laptop contains x86_64 binaries only. Conclusion: **do not** `docker save` a laptop-built image and `docker load` on the Pi — that ships x86_64 binaries to ARM64. Either build natively on the Pi (preferred: fast, simple, guaranteed correct binaries) or cross-compile with `docker buildx --platform=linux/arm64` which uses QEMU emulation (5–10× slower). The user's original "tar + scp + build on Pi" idea maps cleanly to shipping the **source tree** and building on the Pi. Expect 10–15 min for a cold `docker compose build` on a Pi 4 (npm install dominates); warm rebuilds are far quicker.
- **Pi 4 has no on-board RTC — `fake-hwclock` is the offline-clock fallback.** Unlike the Pi 5 (dedicated J5 RTC connector), the Pi 4 keeps no time while powered off. Raspberry Pi OS ships `fake-hwclock` installed and enabled by default: it periodically saves the system time to disk and restores it on boot, so after an offline boot the clock reads the last-saved time (never 1970) until NTP corrects it. Chore completion dates and urgency math rely on accurate local time, so this matters. NTP remains the primary source of truth when networked; `fake-hwclock` is the offline floor. If accurate offline timestamps are required (e.g. the Pi sits off-network for long stretches), fit an external I2C/HAT RTC module with a coin-cell — see Step 10's optional RTC-HAT note.
- **SQLite uses WAL mode** (`journal_mode = WAL`), so the persistent volume must contain `data.db`, `data.db-wal`, and `data.db-shm` together. Schema and seed are both idempotent and self-healing on a fresh volume — no migration tooling needed.
- **Stray files in repo root** that must be excluded from the build context: the user's shell dotfiles leaked in (`.bashrc`, `.zprofile`, etc.), plus `plan.md`, `research.md`, `.claude`, `plans`, and a stray root-level `index.html` that references `/frontend/src/main.tsx` (Vite does not use this file — it uses `frontend/index.html`). The root `index.html` should be deleted; the dotfiles stay but must be in `.dockerignore`.

### Architecture decision

**Two containers (as proposed) — confirmed.** Alternative considered: a single Express container serving both `dist/` + API. That works because the frontend uses relative paths, and it's simpler — but it couples build pipelines, bloats the backend image with frontend assets, and means every frontend change rebuilds the backend layer. The two-container split with Nginx as reverse proxy is the conventional choice and scales cleanly if a second device or domain is ever added.

### Branch recommendation

**Yes — use a feature branch. Already created: `deploy/docker-raspberry-pi`.** The work touches backend source (start script, DB path), deletes a frontend file, adds four new top-level files (`Dockerfile.backend`, `Dockerfile.frontend`, `nginx.conf`, `docker-compose.yml`, `.dockerignore`), and modifies `.gitignore`. It's a contained, reviewable unit that's much better as a PR than a direct push to `main`.

## Steps

### 1. Fix pre-existing backend entry-point and DB-path issues

The start script is broken and the DB path is container-hostile. Fix both before writing any Dockerfile so the container can just run `npm start`.

**To-do:**
- [x] In `backend/package.json`, change the `start` script from `"start": "node dist/index.js"` to `"start": "node dist/server.js"`. The source file is `backend/src/server.ts`; `tsc` emits `dist/server.js` (verified — there is no `src/index.ts`).
- [x] In `backend/src/server.ts`, make the bind address explicit. Change `app.listen(PORT, () => ...)` to `app.listen(PORT, '0.0.0.0', () => ...)`. Rationale: removes any dependence on Node's default bind behavior so the backend is guaranteed reachable from the `frontend` container across the Compose network, independent of Node minor-version changes. (Note: also had to change `const PORT = process.env.PORT ?? 3000` to `const PORT = Number(process.env.PORT ?? 3000)` because the 3-arg `listen(port, hostname, callback)` overload requires a numeric port; the nullish-coalescing version permits `string | number`, which fails tsc.)
- [x] In `backend/src/db.ts` (lines 7–9), replace the DB path derivation so it accepts a new `DB_PATH` env var for production and keeps the existing `TEST_DB_PATH=':memory:'` behavior for tests. Exact replacement:
  ```typescript
  const DB_PATH = process.env.TEST_DB_PATH === ':memory:'
      ? ':memory:'
      : (process.env.DB_PATH ?? path.resolve(__dirname, '../../data.db'));
  ```
  Rationale: preserves dev behavior (file at repo root), preserves in-memory test behavior, lets the container pass `DB_PATH=/data/data.db`.
- [x] Add a backend Vitest test at `backend/src/__tests__/db-path.test.ts` that exercises all three env-var permutations. Because `db.ts` captures `process.env` at module load, each case must set env vars **before** a fresh dynamic import of the module. Use this skeleton:
  ```typescript
  import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
  import { mkdtempSync, rmSync } from 'node:fs';
  import { tmpdir } from 'node:os';
  import { join } from 'node:path';

  describe('db.ts DB path resolution', () => {
      let tmpDir: string;

      beforeEach(() => {
          tmpDir = mkdtempSync(join(tmpdir(), 'chores4irl-db-'));
          vi.resetModules();
          delete process.env.DB_PATH;
          delete process.env.TEST_DB_PATH;
      });

      afterEach(() => {
          rmSync(tmpDir, { recursive: true, force: true });
          delete process.env.DB_PATH;
          delete process.env.TEST_DB_PATH;
      });

      it('uses DB_PATH when set and TEST_DB_PATH is unset', async () => {
          const target = join(tmpDir, 'custom.db');
          process.env.DB_PATH = target;
          const { db } = await import('../db.js');
          const rows = db.pragma('database_list') as Array<{ file: string }>;
          expect(rows[0].file).toBe(target);
      });

      it('uses in-memory when TEST_DB_PATH=:memory: even if DB_PATH is set', async () => {
          process.env.DB_PATH = join(tmpDir, 'ignored.db');
          process.env.TEST_DB_PATH = ':memory:';
          const { db } = await import('../db.js');
          const rows = db.pragma('database_list') as Array<{ file: string }>;
          expect(rows[0].file).toBe('');
      });

      it('falls back to the compiled default path when both env vars are unset', async () => {
          const { db } = await import('../db.js');
          const rows = db.pragma('database_list') as Array<{ file: string }>;
          expect(rows[0].file).toMatch(/data\.db$/);
      });
  });
  ```
  Note: `pragma('database_list')` returns an array; the first row's `file` is the path (empty string for `:memory:`). The fallback test only asserts the suffix so it works regardless of whether the test runs from `src/` or `dist/`.
- [x] Run `npx playwright test` against the unmodified dev setup to confirm the DB-path refactor did not break existing E2E behavior (relative default path still works).

### 2. Delete the stray root `index.html`

Vite uses `frontend/index.html` as the entry point. The root `index.html` references `/frontend/src/main.tsx` (a path that only makes sense if Vite's root were the repo root, which it isn't) and is unreferenced by any build. It exists only to confuse future readers and clutter the Docker build context.

**To-do:**
- [x] Confirm with `git ls-files --error-unmatch index.html` whether the root file is tracked. If untracked (expected), `rm` is safe; if tracked, stage the removal with `git rm index.html` so the deletion is recorded.
- [x] Delete `/home/rmila/Code/chores4irl/index.html`. Confirm with `ls frontend/index.html` that the active entry point is still present.
- [x] Run `npm run build --workspace frontend` from repo root. Build must still produce `frontend/dist/index.html` referencing hashed assets.
- [x] Grep the repo (excluding node_modules and .git) for any remaining reference to a root-level `index.html`: `grep -rn --exclude-dir=node_modules --exclude-dir=.git -E '(^|[^/])index\.html' . | grep -v '^\./frontend/index\.html' | grep -v '^\./frontend/dist/index\.html'` — should return nothing meaningful (only the nginx.conf `index index.html;` directive, which is relative to the nginx root).

### 3. Create `.dockerignore` at repo root

A Docker build sends the entire build context to the daemon. Without `.dockerignore`, `node_modules` (hundreds of MB), the leaked user dotfiles, the live dev SQLite files, and the `.git` history all end up inside the image.

**To-do:**
- [x] Create `/home/rmila/Code/chores4irl/.dockerignore` with the exact contents below. Keep it flat — one pattern per line — so future audits are easy:
  ```
  # VCS + CI
  .git
  .gitignore
  .github

  # Node
  node_modules
  **/node_modules
  npm-debug.log*
  .npm

  # Build artifacts (Dockerfile builds these fresh)
  backend/dist
  frontend/dist
  dist
  dist-ssr

  # Dev DB (must never bake into image)
  *.db
  *.db-shm
  *.db-wal

  # Tests + E2E
  e2e
  test-results
  playwright-report
  playwright.config.ts
  **/__tests__
  **/*.test.ts
  **/*.test.tsx
  **/*.spec.ts
  **/vitest.config.ts

  # Editor / OS
  .vscode
  .idea
  .DS_Store
  *.sw?

  # Claude Code + planning
  .claude
  plan.md
  research.md
  plans

  # Stray user dotfiles leaked into repo root
  .bash_profile
  .bashrc
  .gitconfig
  .gitmodules
  .mcp.json
  .profile
  .ripgreprc
  .zprofile
  .zshrc

  # Docker artifacts
  Dockerfile*
  docker-compose*.yml
  .dockerignore
  ```
- [x] Verify the build context is filtered correctly. First, confirm nothing forbidden sneaks through: `tar --exclude-from=.dockerignore -cf - . | tar -tf - | grep -E '(^|/)(node_modules|\.git|\.db($|-)|data\.db|test-results)' && echo "FORBIDDEN FILE IN CONTEXT" && exit 1 || echo "ok"`. Then eyeball the file count: `tar --exclude-from=.dockerignore -cf - . | tar -tf - | wc -l` should be ≲200.

### 4. Write the backend Dockerfile

Multi-stage: one stage compiles TypeScript and installs prod deps, final stage is a slim runtime. Use `node:20.18.0-bookworm-slim` (pinned patch version for reproducibility; Debian base has `python3`, `make`, `g++` for `better-sqlite3`'s node-gyp fallback if the prebuilt download ever fails). Runs as a non-root user.

**To-do:**
- [x] Create `/home/rmila/Code/chores4irl/Dockerfile.backend` with this structure:
  ```dockerfile
  # syntax=docker/dockerfile:1.7
  FROM node:20.18.0-bookworm-slim AS builder
  WORKDIR /app
  COPY package.json package-lock.json ./
  COPY tsconfig.json ./tsconfig.json
  COPY backend/package.json backend/tsconfig.json ./backend/
  RUN npm ci --workspace backend --include=dev
  COPY types ./types
  COPY backend/src ./backend/src
  RUN npm run build --workspace backend

  FROM node:20.18.0-bookworm-slim AS runtime
  WORKDIR /app
  ENV NODE_ENV=production
  ENV PORT=3000
  ENV DB_PATH=/data/data.db
  COPY package.json package-lock.json ./
  COPY backend/package.json ./backend/
  RUN npm ci --workspace backend --omit=dev \
      && npm cache clean --force
  COPY --from=builder /app/backend/dist ./backend/dist
  RUN mkdir -p /data && chown -R node:node /data /app
  USER node
  EXPOSE 3000
  HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
      CMD node -e "fetch('http://127.0.0.1:3000/api/chores').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
  CMD ["node", "backend/dist/server.js"]
  ```
  > **Build-fix note (added during Step 8):** The builder stage must `COPY types ./types` because `backend/src` imports the shared `types/SharedTypes` contract from outside its own tree. Additionally, `backend/tsconfig.json` needed `"noEmit": false` (it inherits `noEmit: true` from the root tsconfig, so `tsc` was emitting nothing), and `types/SharedTypes.ts` was renamed to `types/SharedTypes.d.ts` so the out-of-tree type import doesn't widen `tsc`'s `rootDir` and nest the output — together these yield a clean `backend/dist/server.js`. Healthcheck uses `127.0.0.1` (not `localhost`) to avoid the busybox/Node IPv6 `::1` resolution that the IPv4-only server doesn't answer.
- [x] Validation: the healthcheck hits `GET /api/chores` (a route confirmed to exist in `backend/src/app.ts` lines 15–22). Using the global `fetch` requires Node ≥ 18 — we're on 20, so fine.
- [x] Validation: `--workspace backend` uses the npm workspaces declared in the repo-root `package.json` (`"workspaces": ["frontend", "backend"]`). Confirm locally with `npm ci --workspace backend --omit=dev` from a clean clone that the install succeeds without frontend deps.
- [x] Validation: `backend/tsconfig.json` has `"extends": "../tsconfig.json"` — the builder stage must therefore have the root `tsconfig.json` present at `./tsconfig.json` before `npm run build --workspace backend` runs. (The runtime stage does not compile TS and does not need it.)
- [x] Quick lint: `docker run --rm -i hadolint/hadolint < Dockerfile.backend` — fix any ERROR-level findings (DL3025, DL3059, etc.). Skip if `hadolint` unavailable; Step 8's `docker compose build` will still surface true syntax errors.

### 5. Write the frontend Dockerfile

Multi-stage: Node builds the Vite bundle, final stage is `nginx:1.27-alpine` serving `dist/` and proxying `/api/*` to the backend container. Nginx Alpine has well-tested ARM64 images and is ~50 MB.

**To-do:**
- [x] Create `/home/rmila/Code/chores4irl/Dockerfile.frontend`:
  ```dockerfile
  # syntax=docker/dockerfile:1.7
  FROM node:20.18.0-bookworm-slim AS builder
  WORKDIR /app
  COPY package.json package-lock.json ./
  COPY tsconfig.json ./tsconfig.json
  COPY frontend/package.json frontend/tsconfig.json frontend/vite.config.ts ./frontend/
  COPY frontend/index.html ./frontend/
  RUN npm ci --workspace frontend
  COPY types ./types
  COPY frontend/src ./frontend/src
  RUN npm run build --workspace frontend

  FROM nginx:1.27-alpine AS runtime
  COPY --from=builder /app/frontend/dist /usr/share/nginx/html
  COPY nginx.conf /etc/nginx/conf.d/default.conf
  EXPOSE 80
  HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
      CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
  ```
- [x] Validation: the builder stage installs only frontend workspace deps, which includes `@tailwindcss/oxide`, `lightningcss`, and `@rollup/rollup`. On a native ARM64 Pi build these auto-download aarch64 prebuilts via npm. On `buildx --platform=linux/arm64` they also work but via QEMU.
- [x] Validation: `frontend/tsconfig.json` extends `../tsconfig.json`. Without the root `tsconfig.json` COPY, `vite build` (via `tsc`) fails with ENOENT on the extends path.
- [x] Quick lint: `docker run --rm -i hadolint/hadolint < Dockerfile.frontend`.

### 6. Write `nginx.conf` to serve SPA + proxy `/api/*`

Nginx listens on 80, serves `frontend/dist/` as a static root, and reverse-proxies anything under `/api/` to the backend service on port 3000. No SPA fallback needed (the app has no React Router), but a `try_files ... /index.html` directive is cheap insurance.

**To-do:**
- [x] Create `/home/rmila/Code/chores4irl/nginx.conf`:
  ```nginx
  server {
      listen 80;
      server_name _;
      root /usr/share/nginx/html;
      index index.html;

      # Long-cache hashed assets (Vite fingerprints filenames).
      location /assets/ {
          expires 1y;
          add_header Cache-Control "public, immutable";
          try_files $uri =404;
      }

      # Do not cache the HTML shell so asset hash updates are picked up.
      location = /index.html {
          add_header Cache-Control "no-cache";
      }

      # Proxy API calls to the backend service.
      location /api/ {
          proxy_pass http://backend:3000;
          proxy_http_version 1.1;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_read_timeout 30s;
      }

      # SPA fallback (no-op for this app today, but safe against future React Router).
      location / {
          try_files $uri $uri/ /index.html;
      }
  }
  ```
- [x] Validation note: `backend` in `proxy_pass http://backend:3000` is the Docker Compose service name, resolved by Compose's internal DNS. This will only work inside the Compose network, which is exactly what we want.
- [x] Syntax check: `docker run --rm -v "$(pwd)/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:1.27-alpine nginx -t` — should print "syntax is ok" and "test is successful". This catches typos without a full compose build.

### 7. Write `docker-compose.yml` with both services and the persistent volume

Wires the two containers, declares a named volume for the SQLite data directory, sets restart policies, and constrains log sizes (Pi SD card fills fast with unbounded JSON logs).

**To-do:**
- [x] Create `/home/rmila/Code/chores4irl/docker-compose.yml`:
  ```yaml
  services:
    backend:
      build:
        context: .
        dockerfile: Dockerfile.backend
      image: chores4irl-backend:local
      restart: "on-failure:5"
      environment:
        PORT: "3000"
        DB_PATH: /data/data.db
        TZ: ${TZ:-America/New_York}   # Override via 'export TZ=...' on the host; chore dates depend on it
      volumes:
        - chores-data:/data
      logging:
        driver: json-file
        options:
          max-size: "10m"
          max-file: "3"
      # No host port publish — only reachable via the Compose network.

    frontend:
      build:
        context: .
        dockerfile: Dockerfile.frontend
      image: chores4irl-frontend:local
      restart: "on-failure:5"
      depends_on:
        backend:
          condition: service_healthy
      ports:
        - "80:80"
      logging:
        driver: json-file
        options:
          max-size: "10m"
          max-file: "3"

  volumes:
    chores-data:
  ```
- [x] Decision to flag in the to-do: **do not publish** the backend port on the host. Only the frontend binds `:80`. The touchscreen browser hits `http://localhost/` which gives Nginx, which proxies `/api/*` to `backend:3000` over the internal network. This keeps the attack surface minimal and avoids CORS entirely.
- [x] Optional convenience scripts in `/home/rmila/Code/chores4irl/package.json` (the workspace root — not `backend/package.json` or `frontend/package.json`): add `"compose:up": "docker compose up -d --build"` and `"compose:down": "docker compose down"`.
- [x] Schema check: `docker compose config > /dev/null` from the repo root — exits non-zero on malformed YAML or bad service references, without triggering any build.
- [x] The `restart: on-failure:5` policy caps runaway restarts. If a service exits non-zero more than 5 times, Compose stops restarting it and leaves it in an exited state so you can `docker compose logs` and diagnose. Manually restart once resolved: `docker compose up -d`.

### 8. Local smoke test on laptop (x86_64)

Before dealing with ARM64 specifics, verify the Dockerfiles actually build and the two containers talk to each other on the laptop.

**To-do:**
- [ ] From repo root: `docker compose build` — both images should build cleanly. Expect 2–5 min cold, <1 min warm.
- [ ] `docker compose up -d`. Check `docker compose ps` — both services `healthy`.
- [ ] On a fresh volume: `curl -s http://localhost/api/chores | jq '.success, (.data | length)'` should print `true` then `10` (the seed count). If you re-run this after adding chores in the browser, expect `> 10`; run `docker compose down -v && docker compose up -d --build` first to restore the fresh-volume count.
- [ ] Open `http://localhost/` in a browser. Verify the app renders with the seeded chores and you can add/delete one. The Playwright suite can validate this too.
- [ ] `docker compose down` — volume persists. `docker compose up -d` again — your added chore should still be there. This proves volume persistence end-to-end.
- [ ] `docker compose down -v` resets the volume for a clean ARM64 run.

### 9. Ship source to the Pi and build natively

The reliable path: tar the source tree (git-tracked files, minus node_modules/dist/db), scp to the Pi, untar, `docker compose build` on the Pi. ARM64 prebuilts for `better-sqlite3`, `@tailwindcss/oxide`, `lightningcss`, and `@rollup/rollup` are auto-downloaded by `npm ci` because it's running natively on aarch64. Do **not** `docker save` the laptop image and `docker load` on the Pi — that would ship x86_64 `.node` binaries.

**To-do:**
- [ ] Prerequisite on the Pi 4: 64-bit Raspberry Pi OS Bookworm, Docker + Compose installed (`curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER`, then re-login). Confirm with `uname -m` → `aarch64` and `docker version` → server running. Confirm Pi 4 model with `cat /proc/device-tree/model` → should contain "Raspberry Pi 4".
- [ ] On the laptop, from repo root, create the source tarball with `git archive` (ships the committed tree only — all deploy + source files, no `node_modules`/`.git`/`.env`/`dist`). **Do NOT use `tar --exclude-from=.dockerignore`** — `.dockerignore` excludes `Dockerfile*`, `docker-compose*.yml`, and `.dockerignore` itself (they don't belong inside the *image*), so a tarball built that way ships without the files needed to *build* on the Pi. Verified: the `git archive` tarball is ~107 KB and contains all of `Dockerfile.{backend,frontend}`, `docker-compose.yml`, `nginx.conf`, `.dockerignore`, `package*.json`, `tsconfig.json`, `types/`, `backend/`, `frontend/`:
  ```bash
  git archive --format=tar.gz -o /tmp/chores4irl-src.tar.gz HEAD
  ```
  (Deploy must be committed first — `git archive` ignores uncommitted/working-tree changes.)
- [ ] `scp /tmp/chores4irl-src.tar.gz <pi-user>@<pi-host>:~/chores4irl-src.tar.gz`
- [ ] On the Pi: `rm -rf ~/chores4irl && mkdir -p ~/chores4irl && tar -xzf ~/chores4irl-src.tar.gz -C ~/chores4irl && cd ~/chores4irl` (the `rm -rf` makes re-deploys idempotent).
- [ ] On the Pi: `docker compose build` — expect 5–15 min on first build (npm install dominates). To confirm the build actually ran native ARM64, check the images with `docker run --rm chores4irl-backend:local uname -m` — should print `aarch64`. Note: grepping the build log for `linux-arm64` is unreliable because cached npm prebuilts don't re-download and emit log lines.
- [ ] On the Pi: `docker compose up -d`. `docker compose ps` should show both services healthy.
- [ ] From a laptop on the same network: `curl -s http://<pi-ip>/api/chores | jq '.success'` → `true`. This confirms the stack is up end-to-end.
- [ ] Cleanup (both machines): `rm /tmp/chores4irl-src.tar.gz` on the laptop and `rm ~/chores4irl-src.tar.gz` on the Pi once `docker compose up -d` is confirmed healthy. Re-run deploys recreate the tarball each time.
- [ ] **Fallback** (only if the Pi can't reach the npm registry): on the laptop, `docker buildx create --use --name armbuilder` (first time only), then build both images for ARM64 and export as a tarball:
  ```bash
  docker buildx build --platform linux/arm64 -f Dockerfile.backend  -t chores4irl-backend:arm64  --load .
  docker buildx build --platform linux/arm64 -f Dockerfile.frontend -t chores4irl-frontend:arm64 --load .
  docker save chores4irl-backend:arm64 chores4irl-frontend:arm64 | gzip > /tmp/chores4irl-images.tar.gz
  ```
  Ship via `scp /tmp/chores4irl-images.tar.gz pi@<pi-host>:~`. On the Pi: `zcat ~/chores4irl-images.tar.gz | docker load`. Then use a parallel `docker-compose.prebuilt.yml` that replaces each `build:` block with `image: chores4irl-backend:arm64` (or `...-frontend:arm64`) and run `docker compose -f docker-compose.prebuilt.yml up -d`. Expect buildx on the laptop to take 5–10× longer than a native Pi build due to QEMU emulation.

### 10. Pi host setup: touchscreen kiosk, display, autostart

The containers are running but nothing drives the screen yet. Configure the Pi host (outside Docker) so the touchscreen boots straight into the app in kiosk mode and the stack comes up on reboot before the browser launches.

**To-do:**
- [ ] Install Chromium: `sudo apt install -y chromium-browser unclutter`. (`unclutter` hides the mouse cursor on idle — nice for touchscreens.)
- [ ] Create a systemd unit `/etc/systemd/system/chores4irl.service` to bring the Compose stack up on boot:
  ```ini
  [Unit]
  Description=chores4irl Docker Compose stack
  Requires=docker.service
  After=docker.service network-online.target
  Wants=network-online.target

  [Service]
  Type=oneshot
  RemainAfterExit=yes
  WorkingDirectory=/home/pi/chores4irl
  EnvironmentFile=-/etc/chores4irl.env
  Environment="TZ=America/New_York"
  ExecStart=/usr/bin/docker compose up -d
  ExecStop=/usr/bin/docker compose down
  TimeoutStartSec=300
  TimeoutStopSec=30

  [Install]
  WantedBy=multi-user.target
  ```
  Notes: `Environment="TZ=America/New_York"` sets the default timezone the systemd unit passes into Compose's `${TZ:-...}` interpolation. The `EnvironmentFile=-/etc/chores4irl.env` line (leading `-` makes it optional) lets you override without editing the unit: create `/etc/chores4irl.env` with `TZ=Europe/London` (or any other overrides) and it wins over the `Environment=` default. `~/.profile` / `~/.bashrc` are NOT sourced by systemd, so shell-level `export TZ=...` cannot reach the service — always go through the unit file or env file.
  Then: `sudo systemctl daemon-reload && sudo systemctl enable --now chores4irl.service`.
- [ ] Verify the `/usr/bin/docker` path the systemd unit uses: `command -v docker`. If Docker is installed elsewhere (rare on Debian Bookworm but possible with snap/alt installs), update the `ExecStart` and `ExecStop` paths in the unit file.
- [ ] Path assumption: the systemd unit hardcodes `/home/pi/chores4irl`. If your Pi's login is not `pi`, substitute `/home/<your-user>/chores4irl` in `WorkingDirectory` (here) and in the backup script paths (Step 11).
- [ ] Configure the desktop autostart to launch Chromium in kiosk mode pointed at `http://localhost/`. Create `~/.config/autostart/chores4irl-kiosk.desktop`:
  ```ini
  [Desktop Entry]
  Type=Application
  Name=chores4irl kiosk
  Exec=sh -c 'xset s off; xset -dpms; xset s noblank; unclutter -idle 0 & chromium-browser --kiosk --noerrdialogs --disable-translate --disable-features=TranslateUI --incognito --check-for-update-interval=31536000 http://localhost/'
  X-GNOME-Autostart-enabled=true
  ```
  This disables screen blanking, DPMS, and the cursor; launches Chromium in kiosk mode without the "restore tabs" dialog (`--incognito`).
- [ ] Determine the session type before touching rotation — Bookworm defaults to Wayland, but X11 is common on headless labwork: `loginctl show-session $(loginctl | awk '/tty/ {print $1; exit}') -p Type` (or just `echo $XDG_SESSION_TYPE` from an interactive session). Note the value (`wayland` or `x11`) — the rotation path differs.
- [ ] **Wayland path (default Bookworm)**: first discover the actual output name by running `wlr-randr` with no arguments — it prints each connected output (`HDMI-A-1`, `HDMI-A-2`, `DSI-1`, etc.). Then rotate via `wlr-randr --output <your-output> --transform 90` (or `180`, `270`, or `flipped-*` as needed). Persist by adding that command to the autostart `.desktop` file's `Exec` line **before** the `chromium-browser` command so the rotation applies on every login. For DSI panels, `display_rotate=1` in `/boot/firmware/config.txt` does NOT rotate touch coordinates under Wayland — avoid it here.
- [ ] **X11 path** (only if `XDG_SESSION_TYPE=x11`): `display_rotate=1` in `/boot/firmware/config.txt` rotates both the framebuffer and touch input for DSI; for HDMI use `xrandr --output HDMI-1 --rotate left`. Then run `xinput_calibrator` and paste its output into `/etc/X11/xorg.conf.d/99-calibration.conf`.
- [ ] Smoke test touch calibration by dragging along the date scrubber: if touches land 90° off or on the wrong axis, the display was rotated but touch wasn't — re-apply rotation with a transform-aware tool or calibrate manually.
- [ ] Align three timezone sources so chore dates don't drift: (1) the **host clock** — `sudo timedatectl set-timezone America/New_York` (or your zone); (2) the **systemd unit** — either leave the default `Environment="TZ=America/New_York"` set above, or drop an override into `/etc/chores4irl.env` (e.g., `TZ=Europe/London`) and `sudo systemctl restart chores4irl.service`; (3) the **container** — picks up whichever `TZ` the unit passes in via Compose's `${TZ:-America/New_York}` interpolation. Do NOT try to set this via `export TZ=...` in `~/.profile` or `~/.bashrc` — systemd never sees those. Verify end-to-end: `docker compose exec backend date` should report the same local time as `date` on the host.
- [ ] Enable NTP: `sudo timedatectl set-ntp true`. This is the primary time source while the Pi is online.
- [ ] Verify `fake-hwclock` is handling offline time (the Pi 4 has **no on-board RTC**, so this is the offline-clock floor — there is no J5 connector or battery to check as there would be on a Pi 5):
  - Confirm the service is installed and enabled (default on Raspberry Pi OS Bookworm): `systemctl is-enabled fake-hwclock` → `enabled`, and `apt list --installed 2>/dev/null | grep fake-hwclock` shows the package. If somehow missing: `sudo apt install -y fake-hwclock`.
  - Confirm there is **no** hardware RTC unless you fitted one: `ls /dev/rtc*` will normally print nothing on a bare Pi 4 (`No such file or directory`). That is expected — `fake-hwclock` is a file-backed substitute, not a device.
  - Force a save of the current time so the on-disk timestamp is fresh: `sudo fake-hwclock save`, then inspect it: `cat /etc/fake-hwclock.data` → should show the current UTC time.
  - **How it behaves on offline boot**: `fake-hwclock` restores the last-saved time at boot, so the clock never jumps back to 1970 — but if the Pi was powered off for a long stretch, the restored time can be hours or days stale until NTP resyncs. Chore urgency math will read those stale dates for the few seconds-to-minutes before NTP corrects (on-network) — harmless but worth knowing. There is no way to keep true wall-clock across a long offline period on a bare Pi 4 without an external RTC.
  - Sanity-check the chain: with the Pi **on the network**, unplug it for ~2 minutes, boot it, and `date` should report the correct wall-clock within a few seconds (NTP resync). With the network **disconnected**, `date` will instead report the last-saved (`fake-hwclock`) time — correct only up to the last save before shutdown.
  - [ ] **Optional — external RTC HAT/module for true offline time** (only if the Pi sits off-network for long periods and accurate offline timestamps matter): fit an I2C RTC such as a DS3231 module (or an RTC HAT) on the 40-pin header, then:
    - Enable the overlay in `/boot/firmware/config.txt`: add `dtoverlay=i2c-rtc,ds3231` (substitute your chip), then reboot.
    - Confirm the kernel now sees it: `ls /dev/rtc*` → `/dev/rtc0`, and `sudo hwclock --verbose` prints a sensible UTC time.
    - Once NTP has synced, write system time into the RTC: `sudo hwclock --systohc --utc`.
    - Disable `fake-hwclock` so the real RTC is authoritative: `sudo systemctl disable --now fake-hwclock` and `sudo apt remove -y fake-hwclock` (optional). The standard `hwclock` udev rules will then load time from the hardware clock at boot. Re-run the offline sanity-check above with the network disconnected — `date` should now be accurate within seconds even after a long power-off.

### 11. Backup strategy for the SQLite volume

The user's entire household chore history lives in a single Docker volume on an SD card. SD cards fail. Two failure modes need covering with different defenses: **logical loss** (bad write, accidental `down -v`, deletion → restore from a recent snapshot) and **physical card death** (the on-card snapshots die *with* the card → only an off-Pi copy survives). Establish a weekly backup, scheduled on a **systemd timer** (not cron) so a run missed while the Pi was powered off is caught up on next boot, with a **mandatory** off-Pi `rsync`. Do this before leaving the Pi unattended.

**Decisions (2026-06-14):** scheduler is a systemd timer with `Persistent=true` (cron silently skips missed runs); the off-Pi `rsync` is required, not optional — the backup script refuses to run if `BACKUP_RSYNC_DEST` is unset, so a backup can never end up only on the SD card. The artifacts are version-controlled under the source tree (resolving the Step 10 "version-control Pi deploy artifacts under `deploy/pi/`" open decision) so they ship to the Pi via `git archive`.

> **DEFERRED until NAS standup (decision 2026-06-25).** The repo-side artifacts (script + units) are **complete and validated** — see the checked items below. The remaining Pi-side install is **intentionally deferred**, not blocked by any unfinished work in this repo. It is gated on an external dependency: the user's forthcoming NAS (hosting Immich + self-hosted storage), which will be the off-Pi `BACKUP_RSYNC_DEST`. Until the NAS is sufficiently established to expose a stable backup target with key-based SSH trust, installing the timer would only create a perpetually-failing weekly job pointed at a guessed address. **Intent preserved: finish this once the NAS is up.** Re-engaging is ~5 min with zero repo/code change — set the real `BACKUP_RSYNC_DEST` (a DEDICATED dir, because the script runs `rsync --delete`, which mirror-wipes the target), set up a passwordless Pi→NAS SSH key, `daemon-reload`, `enable --now` the timer, and validate one run end-to-end.

**To-do:**
- [x] Create `bin/chores4irl-backup.sh` (committed) — online `db.backup()` snapshot via the container into `~/backups/chores4irl-<timestamp>.db`, prune to the most recent 14, then `rsync` off the Pi. Fails fast with a clear message if `BACKUP_RSYNC_DEST` is unset. `chmod +x` already applied.
- [x] Create `deploy/pi/chores4irl-backup.service` (committed) — `Type=oneshot`, `After=chores4irl.service docker.service`, `ExecStart=/home/pi/chores4irl/bin/chores4irl-backup.sh`, ships with the required `Environment=BACKUP_RSYNC_DEST=...` line (placeholder destination to edit).
- [x] Create `deploy/pi/chores4irl-backup.timer` (committed) — `OnCalendar=Sun *-*-* 03:00:00`, `Persistent=true`, `RandomizedDelaySec=5m`, `WantedBy=timers.target`.
- [ ] **DEFERRED until NAS standup — On the Pi:** set the real off-Pi destination in `deploy/pi/chores4irl-backup.service` (`Environment=BACKUP_RSYNC_DEST=<user>@<host>:/path`, a DEDICATED dir on the NAS reachable over key-based SSH with no passphrase prompt — the script runs `rsync --delete`, which mirror-wipes the target). Confirm the SSH key from the Pi to that host works non-interactively: `ssh <user>@<host> true`.
- [ ] **DEFERRED until NAS standup — On the Pi:** install and enable the timer:
  ```bash
  sudo cp deploy/pi/chores4irl-backup.service deploy/pi/chores4irl-backup.timer /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now chores4irl-backup.timer
  systemctl list-timers chores4irl-backup.timer   # confirm next run
  ```
- [ ] **DEFERRED until NAS standup — On the Pi:** validate one run end-to-end: `sudo systemctl start chores4irl-backup.service`, then check `journalctl -u chores4irl-backup.service` for success, `ls -la ~/backups` for a fresh `.db`, and that the off-Pi destination received it. Spot-check: `sqlite3 ~/backups/chores4irl-*.db 'SELECT count(*) FROM chores;'` should match the live count.
- [x] If your Pi user is not `pi`, substitute `/home/pi` → `/home/<user>` in the `ExecStart` path inside `chores4irl-backup.service` before installing. (Actual Pi: user `rmilarachi`, home `/home/rmilarachi`.) **DONE in-repo (2026-06-14):** corrected `ExecStart` in `deploy/pi/chores4irl-backup.service` and the `COMPOSE_FILE`/`BACKUP_DIR` defaults in `bin/chores4irl-backup.sh` from `/home/pi` → `/home/rmilarachi`, so the `git archive` artifacts run correctly on the real Pi without manual editing. (The script's `COMPOSE_FILE` default was load-bearing — at `/home/pi/...` it would not find the compose file on this Pi.)

### 12. Document the deployment workflow in README

The repo gains substantial deployment machinery in this plan; leaving the README as the Vite boilerplate will age badly. Add a concise Deployment section.

**To-do:**
- [x] Replace the current `/home/rmila/Code/chores4irl/README.md` Vite-template body with (or append to) a **Deployment** section covering:
  - **Local smoke test** — `docker compose build && docker compose up -d`, then `curl http://localhost/api/chores`.
  - **Pi prerequisites** — 64-bit Raspberry Pi OS Bookworm, Docker installed (`curl -fsSL https://get.docker.com | sh`), user in `docker` group, `uname -m` reports `aarch64`.
  - **Shipping source to the Pi** — `git archive --format=tar.gz -o /tmp/chores4irl-src.tar.gz HEAD`, `scp` to the Pi, untar to `~/chores4irl`, `docker compose build && docker compose up -d` on the Pi. (Not `tar --exclude-from=.dockerignore` — that drops the Dockerfiles/compose.) Link to this plan file under `plans/deploy/docker-raspberry-pi/` for the full detail.
  - **First-boot Pi setup** — timezone (`sudo timedatectl set-timezone <zone>` and `export TZ=<zone>` on the host if non-default), NTP (`sudo timedatectl set-ntp true`), offline timekeeping (Pi 4 has no on-board RTC — `fake-hwclock` is enabled by default and restores last-saved time on boot; fit an external I2C/HAT RTC only if accurate offline timestamps are required), Chromium kiosk mode (autostart `.desktop` file in `~/.config/autostart/`), display rotation (Wayland: `wlr-randr --transform`; X11: `display_rotate=1`).
  - **Backup strategy** — weekly `sqlite3` online backup to `~/backups/`, retained for 14 weeks. See `bin/chores4irl-backup.sh`.
  - **Updating an existing Pi deployment** — rebuild the source tarball, scp, re-extract over `~/chores4irl`, `docker compose up -d --build` (volume survives so chore data persists).
- [x] Validation: the README should let a fresh reader (who hasn't seen this plan) get from a blank Pi to a running kiosk without consulting any other doc. Have someone unfamiliar skim it; if they ask a question the README doesn't answer, add it.

### 13. Verify All Tests Pass

Run the full test suites to confirm nothing is broken by the backend source changes (start script + DB_PATH), and that the two-container stack actually serves the app.

**To-do:**
- [x] From repo root: `npm run test --workspace backend` — confirm the new `db-path.test.ts` and existing `chores.test.ts` / `routes.test.ts` all pass.
- [x] From repo root: `npm run test --workspace frontend` — confirm all frontend Vitest suites pass (no code changes in `frontend/src`, but re-run as regression insurance).
- [x] From repo root: `npx playwright test` — confirm `e2e/smoke.spec.ts` passes against the dev setup.
- [x] **Required before any remote-Pi run**: edit `/home/rmila/Code/chores4irl/playwright.config.ts` so `baseURL` honors `PLAYWRIGHT_BASE_URL` and `webServer` is skipped when it is set. The current config hardcodes `baseURL: 'http://localhost:5174'` and always spawns both dev servers, which conflicts with a remote target. Minimal patch:
  ```typescript
  const PLAYWRIGHT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
  export default defineConfig({
      testDir: './e2e',
      fullyParallel: false,
      retries: process.env.CI ? 1 : 0,
      use: {
          baseURL: PLAYWRIGHT_BASE_URL ?? 'http://localhost:5174',
          headless: true,
      },
      projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
      webServer: PLAYWRIGHT_BASE_URL ? undefined : [
          { command: 'npm run dev --workspace backend',  url: 'http://localhost:3000/api/chores', reuseExistingServer: !process.env.CI, timeout: 15_000 },
          { command: 'npm run dev --workspace frontend', url: 'http://localhost:5174',             reuseExistingServer: !process.env.CI, timeout: 15_000 },
      ],
  });
  ```
  Re-run `npx playwright test` locally to confirm the local flow still spawns dev servers. Only after that works should you hit the Pi.
- [x] From the laptop (with the Pi stack up): `PLAYWRIGHT_BASE_URL=http://<pi-ip>/ npx playwright test`. Expect seeded chores to render and the add/complete/delete flow to pass. The output's baseURL line should read `http://<pi-ip>/` and no `webServer` startup lines should appear. **DONE (2026-06-14):** `PLAYWRIGHT_BASE_URL=http://[local_IP_address]/ npx playwright test` → **8/8 pass** against the live Pi; reachability `curl /api/chores` → 200; no local dev-server (`webServer`) startup lines appeared. Log: `/tmp/claude/step13-remote-playwright.txt`.
- [x] Investigate and fix any failures before marking the plan finished. **No failures** — all 8 E2E specs green against the Pi.

## Progress Tracking

- [x] **Step 1: Fix pre-existing backend entry-point and DB-path issues** - COMPLETE (2026-04-23)
  - ✅ backend/package.json start script → `node dist/server.js`
  - ✅ backend/src/server.ts binds to `'0.0.0.0'` (PORT coerced via `Number()` for tsc overload)
  - ✅ backend/src/db.ts honors `DB_PATH` env var, preserving `TEST_DB_PATH=':memory:'` and default fallback
  - ✅ backend/src/__tests__/db-path.test.ts covers all three env-var permutations
  - ✅ `npm run test --workspace backend` → 22/22 pass (3 new db-path tests)
  - ✅ `npx playwright test` → 8/8 pass
- [x] **Step 2: Delete the stray root `index.html`** - COMPLETE (2026-04-23)
  - ✅ `git rm index.html` staged deletion (file was tracked)
  - ✅ `frontend/index.html` (active Vite entry) still present
  - ✅ `npm run build --workspace frontend` → `dist/index.html` references `/assets/index-af87IvMt.js` (hashed)
  - ✅ Grep for lingering root `index.html` references → no matches
- [x] **Step 3: Create `.dockerignore` at repo root** - COMPLETE (2026-04-23)
  - ✅ `.dockerignore` created at repo root with exact contents from plan
  - ✅ Forbidden-files tar check → "ok" (no node_modules, .git, .db, test-results in context)
  - ✅ Build context file count → 59 (well under ≲200 target)
- [x] **Step 4: Write the backend Dockerfile** - COMPLETE (2026-04-23)
  - ✅ `Dockerfile.backend` created at repo root verbatim from plan (multi-stage builder + runtime, `node:20.18.0-bookworm-slim`, non-root, healthcheck on `/api/chores`)
  - ✅ Repo structure validated: workspaces `["frontend", "backend"]`, root `tsconfig.json` present, `backend/tsconfig.json` extends `../tsconfig.json`, `backend/src/` present
  - ⚠ hadolint skipped — Docker unavailable in this WSL distro; will be revalidated by `docker compose build` in Step 8
- [x] **Step 5: Write the frontend Dockerfile** - COMPLETE (2026-04-23)
  - ✅ `Dockerfile.frontend` created at repo root verbatim from plan (multi-stage builder + Nginx runtime, `node:20.18.0-bookworm-slim` + `nginx:1.27-alpine`, healthcheck via `wget`)
  - ✅ Repo structure validated: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/src/` all present; `frontend/tsconfig.json` extends `../tsconfig.json` (root tsconfig COPY is load-bearing)
  - ⚠ hadolint skipped — Docker unavailable in this WSL distro; will be revalidated by `docker compose build` in Step 8
- [x] **Step 6: Write `nginx.conf` to serve SPA + proxy `/api/*`** - COMPLETE (2026-04-23)
  - ✅ `nginx.conf` created at repo root verbatim from plan (listen 80, SPA root `/usr/share/nginx/html`, `/assets/` long-cache, `/index.html` no-cache, `/api/` → `backend:3000`, SPA fallback)
  - ⚠ `nginx -t` syntax check skipped — Docker unavailable in this WSL distro; will be revalidated by `docker compose build` in Step 8
- [x] **Step 7: Write `docker-compose.yml` with both services and the persistent volume** - COMPLETE (2026-04-23)
  - ✅ `docker-compose.yml` present at repo root with verbatim contents from plan (two services, named `chores-data` volume, `restart: on-failure:5`, `json-file` log caps, backend port unpublished, TZ interpolation).
  - ✅ Root `package.json` gained `"compose:up": "docker compose up -d --build"` and `"compose:down": "docker compose down"` scripts; JSON validity verified via `node -e 'JSON.parse(...)'`.
  - ⚠ `docker compose config` schema check skipped — Docker unavailable in this WSL distro (`/tmp/claude/step7-compose-config.txt`: "The command 'docker' could not be found in this WSL 2 distro."). Will be revalidated by `docker compose build` in Step 8.
- [x] **Step 8: Local smoke test on laptop (x86_64)** - COMPLETE (2026-06-13)
  - ✅ `docker compose build` — both images build clean (x86_64). Surfaced and fixed three build-blocking bugs that the Docker-less Steps 4–7 could not catch:
    1. Both Dockerfiles omitted `COPY types ./types` → backend `tsc` and frontend `vite build` couldn't resolve the shared `types/SharedTypes` contract. Added to both builder stages.
    2. `backend/tsconfig.json` inherited `noEmit: true` from the root tsconfig → `tsc` emitted nothing → runtime `COPY .../backend/dist` failed. Added `"noEmit": false`.
    3. The out-of-tree `types/` import widened `tsc`'s `rootDir`, nesting output to `dist/backend/src/server.js`. Renamed `types/SharedTypes.ts` → `types/SharedTypes.d.ts` (pure interfaces, all imports `import type`) so it's excluded from emit → clean `backend/dist/server.js`.
  - ✅ Both services report `healthy`. Fixed a frontend healthcheck IPv6 false-negative (busybox `wget http://localhost/` hits `::1`, nginx is IPv4-only) by switching the healthcheck URL to `127.0.0.1`; matched the backend healthcheck to `127.0.0.1` too for consistency.
  - ✅ Fresh-volume `curl http://localhost/api/chores` → `success:true`, `data.length:10` (seed count).
  - ✅ POST `/api/chores` → HTTP 201; count → 11.
  - ✅ Volume persistence: `docker compose down` (no `-v`) → `up -d` → count still 11, `smoke-test-chore` present.
  - ✅ Regression check: backend (44) + frontend (74) vitest suites pass, frontend vite build clean, after the `.d.ts` rename.
  - ✅ `docker compose down -v` reset for a clean ARM64 run. Added `types/*.js` to `.gitignore` to guard against stray compiled artifacts.
- [x] **Step 9: Ship source to the Pi and build natively** - COMPLETE (2026-06-13)
  - ✅ Pi 4 prereqs verified: `uname -m` → `aarch64`, model "Raspberry Pi 4 Model B Rev 1.5", Docker 29.5.3 + Compose v5, **OS is Debian 13 (trixie)** (not Raspberry Pi OS Bookworm — irrelevant to the container build; flagged for Step 10 host config), home is **`/home/rmilarachi`** (not `/home/pi` — Steps 10/11 paths must be substituted), 211 GB free.
  - ✅ Fixed a deploy-blocking doc bug: the planned `tar --exclude-from=.dockerignore` would have shipped a tarball with **no Dockerfiles/compose** (`.dockerignore` excludes them from the image context). Switched to `git archive --format=tar.gz -o /tmp/chores4irl-src.tar.gz HEAD` (107 KB, all deploy+source files, no node_modules/.git/.env). Plan + README both corrected.
  - ✅ `scp` to Pi, extracted to `~/chores4irl`.
  - ✅ `docker compose build` native on the Pi → both images report `arch=arm64/linux`, backend container `uname -m` → `aarch64`. Build was fast.
    - ✅ CORRECTED (2026-06-14): an earlier note here claimed "USB/SSD-backed Pi, not SD" — that was **wrong**. Verified over SSH: root is `/dev/mmcblk0p2` (ext4) on a single **231.4 GB microSD card** (`lsblk` TRAN=`mmc`); no USB/`sda` or `nvme` device present. The Docker DB volume (`/var/lib/docker/volumes/chores4irl_chores-data/_data`) is under `/`, so it lives on that SD card. Swap is on `zram0` (compressed RAM), not the card — so no swap-thrashing wear. Net: storage is the SD card, but DB write volume is tiny, Docker logs are capped, and the mandatory off-Pi backup is the real safeguard against card failure. Does not affect any deploy step.
  - ✅ `docker compose up -d` → both services `healthy` within ~10 s. Pi IP `[local_IP_address]`, frontend published on `:80`.
  - ✅ End-to-end from the laptop: `GET http://[local_IP_address]/` → 200; `GET /api/chores` → `success:true`, 10 seeded chores. Stack left **running** for Steps 10/13.
  - ✅ Tarballs removed on both machines.
- [x] **Step 10: Pi host setup: touchscreen kiosk, display, autostart** - COMPLETE (2026-06-14)
  **AS BUILT** — the actual environment is Debian 13 (trixie) on the RPi PIXEL desktop (compositor **labwc 0.9.7**, lightdm autologin, `lxsession-xdg-autostart` honoring `~/.config/autostart`), user **`rmilarachi`**, single HDMI touchscreen **HDMI-A-1 @ 1024×600**, USB touch panel `yldzkj USB2IIC_CTP_CONTROL`. Several plan assumptions changed:
  - ✅ **systemd stack autostart**: `/etc/systemd/system/chores4irl.service` (as in plan but `WorkingDirectory=/home/rmilarachi/chores4irl`, `Environment="TZ=America/New_York"`). `enable --now` done; verified it brings the stack up healthy on cold boot.
  - ✅ **Kiosk**: `~/.config/autostart/chores4irl-kiosk.desktop` runs **`chromium`** (NOT `chromium-browser`) with **`--ozone-platform=wayland`** (without it Chromium tried X11 and died: "Missing X server"). Flags: `--kiosk --ozone-platform=wayland --noerrdialogs --disable-translate --disable-features=TranslateUI --incognito --check-for-update-interval=31536000 http://localhost/`.
  - ✅ **Display rotation**: persisted via **kanshi** (`~/.config/kanshi/config` → `profile { output "HDMI-A-1" mode 1024x600 position 0,0 transform 270 }`), NOT the plan's autostart `wlr-randr`. 90° clockwise = `transform 270` here. (The RPi desktop runs `kanshi` from `/etc/xdg/labwc/autostart`, so it's the canonical persistence mechanism.)
  - ✅ **Touch rotation**: labwc's `mapToOutput` does NOT rotate touch with output rotation (confirmed by `man labwc-config`: "use the libinput calibrationMatrix setting"). Added to `~/.config/labwc/rc.xml`: `<libinput><device category="touch"><calibrationMatrix>0 1 0 -1 0 1</calibrationMatrix></device></libinput>` (90° CCW, the inverse of the display's 270). Verified touch-accurate after cold boot.
  - ✅ **Screen blanking**: disabled via `sudo raspi-config nonint do_blanking 1` (the plan's `xset` is X11-only and a no-op on Wayland). `unclutter` skipped (X11 tool; on a touchscreen the cursor only appears on mouse input anyway).
  - ✅ **Clock**: TZ already `America/New_York` (host + container match exactly), NTP active+synced. **No `fake-hwclock`** on Debian 13 — `systemd-timesyncd` is active and maintains `/var/lib/systemd/timesync/clock`, advancing the clock forward on boot (same offline floor `fake-hwclock` provides). No RTC needed for this use.
  - ✅ **Cold-boot acceptance test**: power-cycled twice; each time the Pi boots straight into the upright, touch-accurate chores4irl kiosk with the stack healthy and the app reachable at `http://[local_IP_address]/` (and `localhost` on the Pi).
  - NOTE: all Step 10 artifacts live **on the Pi** (systemd unit, kiosk `.desktop`, kanshi config, labwc `rc.xml` calibration), not in the repo. `rc.xml` backed up to `rc.xml.bak` before editing. Consider version-controlling these under a `deploy/pi/` dir for reproducibility (open decision).
- [~] **Step 11: Backup strategy for the SQLite volume** - REPO-SIDE COMPLETE; PI-SIDE DEFERRED until NAS standup (2026-06-25)
  - ✅ Repo artifacts created & committed: `bin/chores4irl-backup.sh` (online `db.backup()` + prune-to-14 + mandatory off-Pi rsync), `deploy/pi/chores4irl-backup.service` (oneshot), `deploy/pi/chores4irl-backup.timer` (Sun 03:00, `Persistent=true`). Resolves the Step 10 "version-control Pi artifacts under `deploy/pi/`" open decision.
  - ✅ Design changed from the original plan: **systemd timer instead of cron** (`Persistent=true` catches up runs missed while the Pi was off; cron silently skips them), and the **off-Pi rsync is mandatory** (script fails fast if `BACKUP_RSYNC_DEST` unset, so backups never live only on the SD card).
  - ✅ Repo-side path correction (2026-06-14): `/home/pi` → `/home/rmilarachi` in `deploy/pi/chores4irl-backup.service` (`ExecStart`) and `bin/chores4irl-backup.sh` (`COMPOSE_FILE`/`BACKUP_DIR` defaults), so the shipped `git archive` artifacts run on the real Pi unedited. Verified: `bash -n` clean, `grep -rn /home/pi bin/ deploy/` returns nothing, 3 parallel reviewers PASS.
  - ⏸ **DEFERRED until NAS standup (decision 2026-06-14, reaffirmed 2026-06-25):** the off-Pi `BACKUP_RSYNC_DEST` will be the user's forthcoming NAS (Immich + self-hosted storage), which is not yet sufficiently established to expose a stable backup target. Installing the timer now would only yield a perpetually-failing weekly job pointed at a guessed address with no SSH trust possible — so the Pi-side install is deliberately deferred until the NAS is up. **Intent to complete is preserved**, not dropped: this is a parked follow-up, not abandoned scope. Re-engaging is ~5 min (set `BACKUP_RSYNC_DEST` to a DEDICATED dir, set up a passwordless Pi→NAS SSH key, `daemon-reload`, `enable --now`, validate) with **zero repo/code change** — the artifacts are already correct; "completing now" isn't genuinely possible without the target host. Caveat for when NAS is ready: dest must be a dedicated directory (script runs `rsync --delete`, which mirror-wipes the target).
  - ⏳ Pi-side remaining (deferred per above): set the real `BACKUP_RSYNC_DEST`, install the units to `/etc/systemd/system/`, `enable --now` the timer, and validate one run end-to-end (see Step 11 to-do).
- [x] **Step 12: Document the deployment workflow in README** - COMPLETE (2026-04-23)
  - ✅ README boilerplate replaced with project-specific overview + full **Deployment** section
  - ✅ Sections: Local smoke test, Pi prerequisites, Shipping source to the Pi, First-boot Pi setup (timezone/NTP/RTC/kiosk/rotation), Backup strategy, Updating an existing Pi deployment
  - ✅ Links back to `plans/deploy/docker-raspberry-pi/docker-raspberry-pi.md` for full rationale
- [x] **Step 13: Verify All Tests Pass** - COMPLETE (2026-06-14)
  - ✅ `playwright.config.ts` patched: `baseURL` honors `PLAYWRIGHT_BASE_URL`, `webServer` is skipped when it is set (falls back to `http://localhost:5174` and local dev servers otherwise)
  - ✅ `npm run test --workspace backend` → 3 test files, 22/22 pass (`/tmp/claude/step13-backend.txt`)
  - ✅ `npm run test --workspace frontend` → 12 test files, 74/74 pass (`/tmp/claude/step13-frontend.txt`)
  - ✅ `npx playwright test` (local dev servers) → 8/8 pass (`/tmp/claude/step13-playwright.txt`)
  - ✅ `PLAYWRIGHT_BASE_URL=http://[local_IP_address]/ npx playwright test` (live Pi stack) → **8/8 pass** (2026-06-14); reachability 200, baseURL confirmed remote, no `webServer` startup lines (`/tmp/claude/step13-remote-playwright.txt`)
  - ✅ No failures to investigate — all suites green

## Status
finished: false  (all in-scope work complete; one follow-up explicitly DEFERRED — see deferred-follow-up below)
last-updated: 2026-06-25
last-step-completed: 13 (full test verification — local backend 22/22, frontend 74/74, local Playwright 8/8, and **remote Playwright 8/8 against the live Pi at http://[local_IP_address]/**). Step 11 repo-side path correction also landed (`/home/pi` → `/home/rmilarachi` in backup script + service).
deferred-follow-up: Step 11 Pi-side backup-timer install is **deliberately deferred until the NAS is more fully established** (decision 2026-06-25). It is NOT a blocker on this repo — all repo-side artifacts (`bin/chores4irl-backup.sh`, `deploy/pi/chores4irl-backup.{service,timer}`) are complete and validated. The deferral is gated on an external dependency: the user's forthcoming NAS (hosting Immich + self-hosted storage) will be the off-Pi `BACKUP_RSYNC_DEST`. Installing the timer before the NAS exists would only create a perpetually-failing weekly job. **Intent to complete is preserved.** When the NAS is up: set the real `BACKUP_RSYNC_DEST` (a DEDICATED dir, e.g. `…:/srv/backups/chores4irl`, because the script does `rsync --delete`), establish a passwordless Pi→NAS SSH key, then SSH-install/enable/validate the timer (~5 min, no repo/code change — the artifacts are already correct). Everything else in the plan is done and validated end-to-end on the Pi. Pi: user `rmilarachi`, home `/home/rmilarachi`, OS Debian 13 trixie, compositor labwc 0.9.7, display HDMI-A-1 @1024x600 transform 270, touch matrix `0 1 0 -1 0 1`.
reconciliation-note: 2026-06-12 — retargeted from Pi 5 to **Pi 4** per actual hardware. Step 10 RTC section rewritten around `fake-hwclock` (Pi 4 has no on-board RTC) with an optional external I2C/HAT RTC path; title, summary, research findings, Step 9 model check, Step 12 README to-do, and the shipped README.md all updated. Container/ARM64 steps (8, 9, 11) are unaffected — Pi 4 and Pi 5 are both aarch64.
reconciliation-note: 2026-06-14 — Step 11 backup re-architected: systemd timer (`Persistent=true`) instead of cron, mandatory off-Pi rsync, artifacts version-controlled under `bin/` + `deploy/pi/`. Also added per-service Docker log caps (`max-size=10m`, `max-file=3`) in compose and fixed the README "Updating an existing Pi deployment" section to use `git archive` (it still showed the broken `tar --exclude-from=.dockerignore`).
reconciliation-note: 2026-06-25 — Step 11 Pi-side backup install formally **deferred** (was framed as `blocked-on`; now a tracked `deferred-follow-up`). Repo-side artifacts are complete; the remaining install is gated on the NAS being more fully established and will be picked up then. Re-marked Step 11 as DEFERRED in Steps + Progress Tracking, tagged the three Pi-side to-do items `DEFERRED until NAS standup`, and reframed the Status block. No code/artifact changes — the deferral is purely a plan-tracking change preserving intent to finish once the NAS exists.

