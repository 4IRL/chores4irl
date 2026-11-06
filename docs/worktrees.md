# Worktrees

tasktracker supports running several checkouts side by side as git worktrees under
`.claude/worktrees/<slug>`. Each worktree gets its own ports and its own local D1 state, so dev stacks
and Playwright runs in different worktrees do not collide. The tooling is standalone (no stronghold
needed): `make worktree-new` and `make worktree-rm`.

## Primary clone first

Keep the primary clone (`tasktracker/`) set up first. The two untracked config files live there and are
symlinked into every worktree:

- `backend/.dev.vars` (copy from `backend/.dev.vars.example`)
- `frontend/.env.development.local`

If the primary has no `backend/.dev.vars`, the new worktree gets a copy of `.dev.vars.example` instead.
A missing `frontend/.env.development.local` is skipped with a warning. A real file already present in the
worktree is never overwritten.

## Create

Run from the primary clone:

```sh
make worktree-new name=<slug> [b=<branch>] [base=<ref>]
```

- `name` is the worktree directory slug (lowercased, non `[a-z0-9-]` characters become `-`, max 40
  chars). `b` defaults to `name`; `name` defaults to the slug of `b`.
- A new branch is cut from `origin/main` unless `base=<ref>` says otherwise. If the branch already exists
  locally or at `origin/<branch>`, it is checked out instead. A missing base ref fails before anything
  is created; run `git fetch origin` or pass an existing `base=`.
- After creation the target links the config files, claims ports (below), writes `.worktree.env`, then
  runs `make install migrate-local` inside the worktree (`npm ci` plus local D1 migrations).

If that setup step fails, the worktree is left in place for recovery:

```sh
make -C <path> install migrate-local   # retry setup
make -C <path> worktree-rm             # discard it
```

## How ports are chosen

The primary clone uses the defaults (slot 0): JWKS `8790`, backend `8787`, frontend `5173`.

Each worktree gets one slot `1..99`, derived from a CRC-32 of its slug (`(crc32(slug) % 99) + 1`), and
all three ports are `default + slot`. The result is recorded in the worktree's gitignored
`.worktree.env`:

```
SLUG=<slug>
PRIMARY_ROOT=<path>
IS_PRIMARY=0
TT_SLOT=<slot>
TT_JWKS_PORT=<port>
TT_BACKEND_PORT=<port>
TT_FRONTEND_PORT=<port>
```

- Slot 0 is never handed out, and slots recorded by sibling worktrees are skipped. A candidate is also
  rejected if any of its ports equals a port of a claimed slot (the JWKS and backend bases overlap
  across slots three apart). If the hashed slot is taken or a port is busy, the walk continues to the
  next slot, wrapping within `1..99`; exhausting all 99 fails with a message pointing at the env override.
- Claiming a slot is serialized by an exclusive lock directory, `<git-common-dir>/tt-worktree-slot.lock`.
  An overlapping `make worktree-new` fails fast with a message naming the lock. A stale lock (no live
  holder) is cleared automatically; if the message persists and no other `worktree-new` is running,
  remove that directory by hand.
- The port probe binds `0.0.0.0`, so it is IPv4-only and does not see `::`-only listeners. The claimed-slot
  set is therefore the main separation between worktrees; the strict-port failures (Vite `strictPort`,
  Playwright `reuseExistingServer: false`, wrangler's own bind error) are the backstop when something
  unrelated holds a port.

Every consumer (`vite.config.ts`, `playwright.config.ts`, `e2e/jwks-server.mjs`, `scripts/dev-backend.mjs`,
the specs) reads the ports through `scripts/ports.mjs`, with precedence defaults < `.worktree.env` < env.
The env keys are `TT_JWKS_PORT`, `TT_BACKEND_PORT` and `TT_FRONTEND_PORT`. To see what a checkout resolves
to, from any directory inside it, without `make`:

```sh
node scripts/ports.mjs print
```

Override per run with env, for example `TT_FRONTEND_PORT=6000 make dev`.

Behavior depends on where the ports came from:

- **No overrides** (primary with no `.worktree.env` and no env): exactly the old behavior. Bare
  `wrangler dev` using `.dev.vars`, Vite on its default `5173` without `strictPort`, and bare `vite preview`
  keeps its own default `4173`.
- **From `.worktree.env` or env**: `wrangler dev` gets `--port <backend>` and
  `--var ACCESS_JWKS_URL:http://localhost:<jwks>/jwks` (the CLI `--var` overrides the shared symlinked
  `.dev.vars`, which has `8790` baked in), and Vite `server`/`preview` use the port with `strictPort`, so
  a collision fails fast instead of drifting to another port.

Wrangler's inspector port is not managed; wrangler probes for a free one itself.

## What each worktree isolates

- Ports (above).
- `backend/.wrangler` (local D1 state). It is per checkout and never linked; `e2e/global-setup.ts` wipes
  and reseeds it on every e2e run.

Git hooks are shared: `scripts/install-git-hooks.mjs` installs them once into the common hooks directory
(`git rev-parse --git-path hooks`), so `npm ci` works inside a worktree and all checkouts use the same hook.

## Remove

Run inside the worktree:

```sh
make worktree-rm
```

This is a non-force `git worktree remove` of that directory. It also deletes the ignored files inside it
(`backend/.wrangler`, `.worktree.env`, `node_modules`). A dirty tree (tracked changes or untracked,
non-ignored files) is refused and nothing is deleted. It refuses the primary clone and any path outside
`<primary>/.claude/worktrees/`. The branch is always kept; delete it yourself with `git branch -D`.

## Naming rules

- The slug must not equal the repo directory name (`tasktracker`) or `chore-reaper`.
- A slug that already exists under `.claude/worktrees/` is refused.
- One worktree per branch (git enforces this).

## Parallelism limits

- One dev stack or e2e run per checkout at a time. Two checkouts at the same time are fine, each on its
  own ports and D1 state.
- `make test-e2e` no longer reuses a running `make dev` stack on the same ports (`reuseExistingServer` is
  now `false`). Stop the dev stack first, or run e2e from another worktree.

## Via the stronghold

From `~/code`, `make wt-new REPO=tasktracker BRANCH=<branch>` and `make wt-rm REPO=tasktracker BRANCH=<branch>`
detect the root Makefile's `worktree-new` / `worktree-rm` targets and delegate to them.

## Residual risk

The worktree policy is `full`, so nothing blocks `make migrate-remote` or `make migrate-list-remote`. CI applies migrations on a push to `main`, so a manual remote apply is rarely needed (and is idempotent).
They hit the production D1 from any worktree exactly as they do from the primary. Run them deliberately.
