# chores4irl — Project Instructions

`ARCHITECTURE.md` is the main documentation for this app — stack, dev/staging/prod environments,
frontend/backend design, CI/CD, database/migrations, auth model, and a "where to look for X" index.
Read it first for any non-trivial task. **Keep it current**: when a change alters anything it documents
(routes, middleware, schema/migrations, environments, CI/CD, deploy process, repo layout), update the
relevant section of `ARCHITECTURE.md` in the same piece of work — treat it as load-bearing docs, not a
one-time snapshot.

Read `README.md` in the repo root for architecture/design rationale. The Cloudflare setup and cutover
plan (formerly `CLOUDFLARE.md`/`CLOUD_PLAN.md`) is complete — Part A and Part B are both fully done, the
app is live at chores.4irl.app, and those planning docs have been removed.

## Commit attribution

Standing rule (user instruction, 2026-07-06, carried over from the removed repo-local `bot-push` skill):
commits and PRs on this repo show **bot-only attribution** — no `Co-Authored-By: Claude` or
`Claude-Session:` trailer and no human co-author. Commits are authored as the `Bot identity` below
(`/git-commit` does this). After opening a PR, confirm with
`~/code/.claude/scripts/gh-bot.sh pr view <N> --json author,commits` and expect only
`gpropersi-claude[bot]`; fix any second login before reporting done.

## Claude Config

<!-- Consumed by the stronghold's central generic skills (see ~/code/CLAUDE.md).
     Stable keys — do not rename. This repo now uses the SHARED consolidated bot
     (`gpropersi-claude`, one GitHub App across all repos) via the central push script + the
     tracked stronghold generator (`~/code/.claude/scripts/generate-gh-token.sh`) — the old
     repo-local `chore-reaper-claude` App toolkit that lived under .claude/scripts/ has been removed. Account-specific App/install IDs and GraphQL IDs are NOT
     inlined here (secrets policy); only the public bot login + noreply email are recorded. -->

- **Repo slug:** `4IRL/chores4irl` (directory `chores4irl`, live at chores.4irl.app; the old `GPropersi/chore-reaper` repo is abandoned, and runtime ids such as the Worker name `chore-reaper-backend` keep their old names)
- **Default branch:** `main`
- **Plans store (central):** `~/code/plans/chores4irl/{open,completed,research}/<topic>/` <!-- reviews/mocks/plan-research co-located per plan; full rules in ~/code/CLAUDE.md "Central Plans Store" -->
- **Plans bucket:** `chores4irl` <!-- directory under ~/code/plans/ for this repo's plans; explicit, never inferred from the slug or the directory name -->
- **Push gate:** (suites a push must pass; first matching row wins per changed path, all matched suites run sequentially)
  | Paths (space-separated globs)                         | Command                      |
  | ----------------------------------------------------- | ---------------------------- |
  | `docs/** changelog/** *.md LICENSE .claude/skills/**` | na docs and skill prose only |
  | `**`                                                  | `make lint test build`       |
- **Bot identity:** `gpropersi-claude[bot]` `141576524+gpropersi-claude[bot]@users.noreply.github.com` <!-- consolidated shared bot; replaced repo-local c4i-claude-bot -->
- **Bot push script:** `~/code/.claude/scripts/gh-app-push.sh` (central, repo-agnostic; derives the repo from `origin`, pushes as the shared bot)
- **Token generator:** `~/code/.claude/scripts/generate-gh-token.sh` (tracked in the stronghold — the shared consolidated `gpropersi-claude` App; one generator serves every repo, auto-resolves the installation from the repo's owner. Only the private key `~/.claude/u4i-app.pem` lives outside git)
- **Container runtime:** n/a (Node/TS monorepo run via npm workspaces; no root docker-compose — deploys to Cloudflare Workers/D1)
- **App URL (Playwright MCP):** `http://localhost:5173` by default (Playwright `baseURL`; the port is `TT_FRONTEND_PORT` from `.worktree.env` in a worktree, run `node scripts/ports.mjs print`; e2e webServer builds frontend then `vite preview` on it, backend dev on `TT_BACKEND_PORT` (8787), jwks on `TT_JWKS_PORT` (8790))
- **Test login:** n/a (e2e seeds a household via `e2e/global-setup.ts` against a local D1; no interactive login recorded — TODO if a login flow is needed)
- **Commands:** (via root `Makefile` — thin wrappers around the npm workspace scripts; `make help` lists all)
  | Purpose            | Command                                                                           |
  | ------------------ | --------------------------------------------------------------------------------- |
  | Integration tests  | `make test-backend` (backend workspace vitest)                                    |
  | UI/e2e tests       | `make test-e2e` (Playwright)                                                      |
  | JS/unit tests      | `make test-frontend` (frontend workspace vitest)                                  |
  | Build              | `make build` (frontend production build)                                          |
  | Lint / format      | `make lint` (eslint) / `make format` (prettier) — lint-staged also runs on commit |
  | Dev                | `make dev` (concurrently: jwks + backend + frontend)                              |
  | DB migrate (local) | `make migrate-local` (apply pending migrations to local Miniflare D1)             |
  | DB migrate (prod)  | `make migrate-remote` (apply to remote production D1 — deploy-time)               |
  | DB migrate status  | `make migrate-list` (local) / `make migrate-list-remote` (prod)                   |
  | New migration      | `make migrate-new name=<snake_case_desc>` (scaffold next numbered file)           |
  | Script tests       | `make test-scripts` (`scripts/*.test.mjs`, node:test)                             |
  | Install deps       | `make install` (`npm ci`)                                                         |
  | New worktree       | `make worktree-new name=<slug> [b=<branch>] [base=<ref>]` (see docs/worktrees.md) |
  | Remove worktree    | `make worktree-rm` (run inside the worktree)                                      |
- **GitHub project board:** n/a
- **Issue labels:** resolve at runtime via `gh label list --repo 4IRL/chores4irl` (do not invent labels)
- **PR reviewer:** GPropersi
- **Worktree policy:** `full`
- **Worktree link:** `backend/.dev.vars frontend/.env.development.local`
- **Worktree setup:** `install migrate-local` <!-- informational; the owned worktree-new target runs setup itself -->
- **Worktree teardown:** `n/a`
- **Worktree ports:** `n/a` <!-- no docker; the owned worktree-new target resolves ports -->
- **Worktree allowed targets:** `n/a`
- **Worktree guarded targets:** `n/a`
