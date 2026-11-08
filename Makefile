# chore-reaper (tasktracker) — self-documenting Makefile.
# Thin wrappers around the npm workspace scripts + wrangler D1 tooling.
# `make help` (the default goal) lists every target.

NPM_ROOT    = npm run
NPM_BACKEND = npm run --workspace backend
WRANGLER    = npm exec --workspace backend -- wrangler
PASSPHRASE_ENV ?= D1_BACKUP_PASSPHRASE

.PHONY: help install dev build worktree-new worktree-rm \
        test test-backend test-frontend test-scripts test-e2e \
        lint lint-fix format format-check \
        migrate-local migrate-remote migrate-list migrate-list-remote migrate-new \
        backup-restore-local

.DEFAULT_GOAL := help

help: ## Show this help message
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' Makefile | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ── Dev / build ───────────────────────────────────────────────────────────────

install: ## npm ci (root workspaces)
	npm ci

dev: ## Run the full dev stack (jwks + backend + frontend, via concurrently)
	$(NPM_ROOT) dev

build: ## Build the frontend for production
	$(NPM_ROOT) build:frontend

# ── Worktrees ─────────────────────────────────────────────────────────────────
# Owned targets (column 0) so the stronghold's wt.sh dispatches here. See docs/worktrees.md.

worktree-new: ## Create a worktree: make worktree-new name=<slug> [b=<branch>] [base=<ref>]
	WT_NAME='$(subst ','\'',$(name))' WT_BRANCH='$(subst ','\'',$(b))' WT_BASE='$(subst ','\'',$(base))' node scripts/worktree.mjs new

worktree-rm: ## Remove this worktree (run inside it)
	node scripts/worktree.mjs rm

# ── Tests ─────────────────────────────────────────────────────────────────────

test: test-backend test-frontend test-scripts ## Run backend + frontend + scripts unit/integration tests

test-backend: ## Run backend tests (vitest, Workers pool + real D1)
	$(NPM_ROOT) test:backend

test-frontend: ## Run frontend unit tests (vitest)
	$(NPM_ROOT) test:frontend

test-scripts: ## Run scripts/ unit tests
	$(NPM_ROOT) test:scripts

test-e2e: ## Run Playwright end-to-end tests
	$(NPM_ROOT) test:e2e

# ── Lint / format ─────────────────────────────────────────────────────────────

lint: ## Lint the repo (eslint)
	$(NPM_ROOT) lint

lint-fix: ## Lint and auto-fix (eslint --fix)
	$(NPM_ROOT) lint:fix

format: ## Format the repo (prettier --write)
	$(NPM_ROOT) format

format-check: ## Check formatting without writing (prettier --check)
	$(NPM_ROOT) format:check

# ── Database migrations (Cloudflare D1) ───────────────────────────────────────
# Migration files live in backend/migrations/*.sql, applied in numbered order.
# They are immutable once merged — corrections are new numbered files.

migrate-local: ## Apply pending migrations to the local (Miniflare) D1 — the everyday dev upgrade
	$(NPM_BACKEND) migrate:local

migrate-remote: ## Apply pending migrations to the REMOTE production D1 (chores4irl) — CI does this on main push; manual for hotfix/rollback
	$(NPM_BACKEND) migrate:remote

migrate-list: ## Show applied/pending migration status for the local D1
	$(WRANGLER) d1 migrations list DB --local

migrate-list-remote: ## Show applied/pending migration status for the remote production D1
	$(WRANGLER) d1 migrations list DB --remote

migrate-new: ## Scaffold a new numbered migration file: make migrate-new name=<snake_case_desc>
	@test -n "$(name)" || { echo 'Usage: make migrate-new name=<snake_case_desc>' >&2; exit 1; }
	$(WRANGLER) d1 migrations create DB "$(name)"

backup-restore-local: ## Restore a D1 backup into a throwaway local D1: make backup-restore-local FILE=<.sql|.sql.gpg> [PASSPHRASE_ENV=NAME]
	@test -n "$(FILE)" || { echo 'Usage: make backup-restore-local FILE=<path to .sql or .sql.gpg> [PASSPHRASE_ENV=D1_BACKUP_PASSPHRASE]' >&2; exit 1; }
	node scripts/d1-restore.mjs "$(FILE)" --passphrase-env "$(PASSPHRASE_ENV)"
