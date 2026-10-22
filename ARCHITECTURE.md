# Architecture

Chore Reaper is a multi-tenant ("household"-scoped) chore tracker. Cloudflare Workers + Hono backend,
React frontend, D1 (SQLite) storage, Cloudflare Access for auth. This doc is the map: what runs where,
how a request flows end to end, and where to look for anything you need mid-task.

For _why_ this is cloud-native instead of the local-kiosk model it was seeded from, see
[`TRADEOFFS.md`](TRADEOFFS.md). For repo-wide agent conventions, see [`CLAUDE.md`](CLAUDE.md).

## At a glance

|                 |                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------- |
| Frontend        | React 19 + Vite + Tailwind 4, PWA (`vite-plugin-pwa`), deployed to Cloudflare Pages           |
| Backend         | Hono 4 on Cloudflare Workers (`nodejs_compat`), single Worker, all routes under `/api/*`      |
| Database        | Cloudflare D1 (SQLite), one shared instance for all households, schema-level tenant isolation |
| Auth            | Cloudflare Access (Zero Trust) — JWT in `Cf-Access-Jwt-Assertion` header, verified via JWKS   |
| Production URL  | https://chores.4irl.app (frontend); `chores.4irl.app/api/*` routes to the Worker              |
| Package manager | npm workspaces (`backend`, `frontend`), Node 24                                               |
| CI/CD           | GitHub Actions (`.github/workflows/ci.yml`) — lint → test → e2e → deploy on push to `main`    |

There is **no staging environment**. Two environments only:

- **Local dev** — `wrangler dev` (Miniflare-backed local D1) + `vite`, fixture JWKS server standing in
  for real Cloudflare Access.
- **Production** — real Workers, real D1, real Cloudflare Access, deployed automatically on every merge
  to `main` that passes CI.

PR branches get a Cloudflare Pages _preview_ deployment (a real `*.pages.dev` URL), but it talks to
mocked API data, not the production backend — see [Preview deployments](#preview-deployments-and-why-they-cant-hit-the-real-api) below. It is not a staging environment for the backend.

## Repo layout

```
backend/         Hono API — Cloudflare Worker
  src/
    app.ts               Route mounting + middleware wiring (the whole app's shape, read this first)
    index.ts              Worker entrypoint (just re-exports app.ts's default)
    routes/                One file per resource: chores, rooms, households, members, me, admin
    middleware/
      access-auth.ts       Verifies the Cf-Access-Jwt-Assertion JWT against Cloudflare's JWKS
      household-scope.ts   Resolves verified email -> user -> household membership -> isAdmin
      require-global-admin.ts   Lighter chain for /api/admin/* — no household required
    chores.ts, rooms.ts, households.ts, members.ts, admin-users.ts   Data-access/business-logic layer the routes call into
    access-allowlist.ts    Calls the Cloudflare Access API to auto-grant new members
    bootstrap-admin.ts, seed-mock-chores.ts   Logic behind the one-off scripts in scripts/
    types.ts               Hono AppEnv (Bindings + Variables) shared across the backend
  migrations/               Numbered D1 migrations, applied in order (see Database section)
  scripts/                  One-off CLI scripts run with tsx (bootstrap-admin, dev-jwt, seed-mock-chores)
  test/                     Vitest + @cloudflare/vitest-pool-workers (real Miniflare D1 per test)
  wrangler.toml             Worker config: routes, D1 binding, env vars/secrets

frontend/         React SPA — Cloudflare Pages
  src/
    App.tsx                 Routing (react-router), top-level data loading (useMe, useRooms)
    components/
      admin/                 Admin panel: household settings, members, rooms, all-users directory
      chore/                 Chore list/view/timer/completion UI
      form/                   Chore creation/edit forms
      nav/                    Nav bar, room tabs, date navigation
      common/                 Shared UI (dialogs, banners)
    utils/api.ts             Single fetch entrypoint (apiFetch) — attaches X-Household-Id, routes
                              preview deployments to mock data instead of the real API
    utils/mockApi.ts          Mock data served on *.pages.dev preview deployments
    outbox/                   Offline write queue (IndexedDB-backed) — queues chore mutations when offline
    cache/choresCache.ts      IndexedDB read cache for offline chore viewing
    hooks/useMidnightClock.ts Recomputes chore urgency at local midnight
  vite.config.ts              Dev proxy to backend (:8787 default), PWA manifest/workbox config

e2e/               Playwright end-to-end tests (own JWKS fixture server, own signed-JWT helper)
types/SharedTypes.d.ts   Types shared between backend and frontend (ApiResponse<T>, Room, etc.)
scripts/           Root-level scripts (git hooks installer)
.github/workflows/ci.yml   The entire CI/CD pipeline
.claude/           Agent tooling: skills (run-dev)
```

## Request flow

1. Browser hits `chores.4irl.app` → Cloudflare Access intercepts, enforces login (email allow-list),
   redirects to the app with a `CF_Authorization` cookie once authenticated.
2. Frontend (Pages) serves the SPA. `apiFetch()` (`frontend/src/utils/api.ts`) is the _only_ place that
   calls `fetch()` for API requests — it attaches `X-Household-Id` from the currently-selected household.
3. Cloudflare's edge attaches `Cf-Access-Jwt-Assertion` (the Access JWT) to requests reaching
   `chores.4irl.app/api/*`, which routes to the Worker per `wrangler.toml`'s `routes` block.
4. Worker middleware chain (`backend/src/app.ts`), per route group:
   - `accessAuth` (`middleware/access-auth.ts`) — verifies the JWT against Cloudflare's JWKS endpoint
     (cached `createRemoteJWKSet`), checks `aud`, extracts `email` into `c.var.verifiedEmail`. Fails
     closed (401) on any verification error.
   - `householdScope` (`middleware/household-scope.ts`) — looks up the user by email, loads their
     household memberships, resolves which household this request is scoped to (via `X-Household-Id`
     header, or the lowest-id membership if absent/first login), sets `userId` / `householdId` /
     `isAdmin` / `timezone` / `swipeStyle` on the context.
   - `requireGlobalAdmin` (`middleware/require-global-admin.ts`) — a separate, lighter chain for
     `/api/admin/*` (currently just the all-users directory): looks up `is_admin` by email and 403s if
     false, without requiring any household membership. Deliberately not layered on `householdScope`,
     since a global admin must be able to reach admin-only views even with zero households of their own.
5. Route handler (`routes/*.ts`) calls into the corresponding data-access module (`chores.ts`,
   `rooms.ts`, etc.), which always filters/writes by `household_id` — this is the entire tenant-isolation
   mechanism (see [Multi-tenancy](#multi-tenancy--auth-model)).
6. Response shape is always `{ success: boolean, data?: T, error?: string, warning?: string }`
   (`ApiResponse<T>` in `types/SharedTypes.d.ts`).

## Multi-tenancy & auth model

- **Identity**: Cloudflare Access owns authentication entirely — there is no password/session system in
  this app. The Worker trusts the `Cf-Access-Jwt-Assertion` header's `email` claim once JWT signature +
  audience are verified. `access-auth.ts`'s in-memory JWKS cache means the Worker never round-trips to
  Cloudflare per-request for keys, just for the initial fetch/key rotation.
- **Tenant = household**: `households` table. A user (`users`) can belong to multiple households via
  `household_members` — a pure join table (user × household), no role. Households only track
  membership; there's no per-household admin/user distinction.
- **Admin is global, not per-household**: `users.is_admin` is a single boolean on the account itself —
  the app has users and admins; households just have members. (This used to be `household_members.role`,
  meaning the same person could be admin of one household and a plain member of another — migration
  `0006` collapsed that into one global flag, seeding `is_admin = 1` for anyone who was admin of at
  least one household at the time.)
- **Scoping**: every table that holds tenant data (`chores`, `rooms`) carries `household_id`. Every
  data-access function takes `householdId` as a parameter sourced from `c.var.householdId` (set by
  `household-scope.ts`), never from client-supplied body/query data — this is the load-bearing invariant
  that keeps households isolated. `households.patch('/:id')` re-validates the path param against
  `c.var.householdId` rather than trusting it, for the same reason.
- **Admin-gating**: mostly enforced inside individual functions rather than as blanket middleware — e.g.
  `addHouseholdMember` only requires `callerIsAdmin` when the target email has no existing account;
  adding an already-registered user to a household is open to any member. See the comment in
  `backend/src/app.ts` above the `/api/members` mount. The one exception is `/api/admin/*`
  (`routes/admin.ts`), which is admin-gated as blanket middleware (`requireGlobalAdmin`) since everything
  under it is inherently admin-only, cross-household territory:
  - `GET /api/admin/users` — read-only directory of every user in the app and which household(s) they
    belong to, rendered at the bottom of the frontend's Admin page (`AdminPanel.tsx` → `UsersDirectory.tsx`).
  - `GET /api/admin/households` — lists every household (id + name), powering the searchable household
    picker (`HouseholdSearchSelect.tsx`) in the admin-only "Add User" flow below, and the read side of
    `HouseholdsDirectory.tsx` (see the `POST` counterpart below).
  - `POST /api/admin/households` — creates a bare household (name + timezone, defaulting to `'UTC'` if
    omitted, validated with the same `isValidTimezone` the `PATCH /api/households/:id` route uses).
    409s on a duplicate name. Deliberately bare — unlike `bootstrap-admin.ts` (the CLI script this
    replaces as the normal way to create a household), it does not also create a user/admin or
    `household_members` row; an admin adds people to the new household afterward via the existing
    `POST /api/admin/members` flow. Backed by `createHousehold` in `households.ts`. Frontend:
    `AdminPanel.tsx` → `HouseholdsDirectory.tsx` → `CreateHouseholdModal.tsx` — this section is
    self-contained (fetches, creates, and updates its own list) rather than parent-orchestrated like
    `UsersDirectory`/`AddUserModal`, since creating a household never needs to update any of
    `AdminPanel`'s own state.
  - `POST /api/admin/members` — lets an admin add a user (new or existing) to _any_ household, not just
    their own current one, since the target `householdId` is caller-supplied here rather than sourced
    from session (the one deliberate exception to the tenant-isolation rule below — safe only because this
    route sits behind `requireGlobalAdmin`). Backed by `adminAddHouseholdMember` in `members.ts`, a
    counterpart to `addHouseholdMember` with no `callerIsAdmin` gate (the caller is already verified
    admin) and an optional `makeAdmin` flag that sets `users.is_admin` on the brand-new-account path only
    (never on the already-has-an-account path). Also accepts `newHouseholdName` (+ optional
    `newHouseholdTimezone`) as an alternative to `householdId`, to create the household and the member in
    one request — the route calls `createHousehold` first to resolve an id, with the exact same
    validation contract as `POST /api/admin/households` (defaults to `'UTC'` when omitted, 400s if
    present but invalid). `newHouseholdTimezone` is deliberately a separate field from the member-level
    `timezone` in the same request body — one sets the new household's own timezone, the other is the
    added member's personal `users.timezone`; neither implies the other, and `users.timezone` is nullable
    and currently informational-only (stored/displayed in the admin user list, not read by any
    due-date/reset/notification logic, which is keyed exclusively off `households.timezone`). Frontend:
    `AdminPanel.tsx` → `AddUserModal.tsx` → `HouseholdSearchSelect.tsx`,
    whose combobox offers a "Create new household" option (with an inline indicator once picked) when the
    typed name matches no existing household, revealing a second `TimezoneSelect` for the new household's
    timezone alongside the existing member-timezone field.
  - `GET /api/admin/join-requests`, `POST /api/admin/join-requests/:id/approve`,
    `POST /api/admin/join-requests/:id/deny` — the admin side of the join-request workflow below.
  - `DELETE /api/admin/users/:id` — deletes a user account outright (not just a single household
    membership, unlike `DELETE /api/members/:id`). Backed by `deleteUser` in `admin-users.ts`, which
    cascades across every FK referencing `users(id)`: deletes the user's `household_members` rows
    (every household, not just the caller's), nulls `invited_by`/`resolved_by` on rows the user acted on
    (nullable), and deletes the user's own `join_requests` rows outright (`requested_by` is `NOT NULL`,
    so those can't be orphaned). 400s if the caller targets their own account. Best-effort revokes the
    user's Cloudflare Access entry via `revokeAccessAndDescribeWarning` (`access-allowlist.ts`), the
    symmetrical counterpart to the grant flow below — same never-blocks-the-D1-write contract. Frontend:
    `AdminPanel.tsx` → `UsersDirectory.tsx`, gated behind a confirm dialog, with the delete action hidden
    on the caller's own row.
  - `POST /api/admin/users/:id/promote` — grants global admin (`users.is_admin = 1`) to an existing user.
    One-way: there's no demote route. Backed by `promoteUserToAdmin` in `admin-users.ts`, returns the
    updated `AdminUserWire`. 404s for an unknown id. Deliberately separate from
    `household_members.role` (see below) — this only ever touches `users.is_admin`. Frontend:
    `AdminPanel.tsx` → `UsersDirectory.tsx`, a "Promote" button shown only on non-admin rows, gated
    behind a confirm dialog.
- **Join requests**: a non-admin member adding an email with no existing account gets rejected
  (`new_user_requires_admin`, 403) by `POST /api/members`, same as before — but the frontend now offers an
  escalation path (`AddMemberModal.tsx`'s "Ask an admin to add this person" button) that calls
  `POST /api/members/requests` (household-scoped, `householdId` from session like every other
  member-scoped write) to create a pending row in the `join_requests` table (`backend/src/join-requests.ts`).
  Admins see every pending request across every household (`JoinRequestsSection.tsx`, self-fetching,
  rendered above `UsersDirectory` in `AdminPanel.tsx`) and can approve (creates the user + membership via
  `adminAddHouseholdMember`, same as the admin-direct-add path, preserving the original requester as
  `household_members.invited_by`) or deny (status flip only, no side effects).
- **Auto-provisioning Access**: when a new member is added — via `POST /api/members`, `POST
/api/admin/members`, or a join-request approval — the route calls
  `grantAccessAndDescribeWarning` (`access-allowlist.ts`), a shared helper wrapping
  `grantAccessListEntry` that adds the email to the reusable Cloudflare Access policy. This is
  best-effort — a failure degrades to a `warning` in the API response telling the admin to add the email
  manually in the Zero Trust dashboard, never blocks the D1 write. `DELETE /api/admin/users/:id` mirrors
  this on the way out via `revokeAccessAndDescribeWarning`/`revokeAccessListEntry`, removing the email
  from the same policy's `include` list.

## Database (D1)

Single D1 instance (`chores4irl`, binding `DB`) shared across all households — isolation is
application-level (`household_id` columns), not per-tenant databases.

- **Migrations**: `backend/migrations/*.sql`, applied in order via `wrangler d1 migrations apply`.
  `npm run migrate:local` (Miniflare-local) / `npm run migrate:remote` (real production D1) from
  `backend/`. Migration files are numbered and immutable once merged to `main` — corrections are new
  migrations, never edits to old ones (see the extensive rationale comments in
  `0004_rename_org_to_household.sql`, `0005_rename_member_role_to_user.sql`, and
  `0006_global_admin_users_cleanup.sql` for what that discipline looks like against live data, including
  the snapshot-then-rebuild dance SQLite's FK/CHECK-constraint limitations force on every one of these).
- **Core tables**: `households`, `users` (`is_admin` is the only global per-account flag —
  `households`/`chores`/`rooms` scoping is entirely via `household_id`), `household_members` (user ×
  household membership; `role` — 0008 — defaults every row to `'member'`, with `'head'` as the only other
  allowed value so far; not read or written by any app logic yet, purely schema prep for a future
  in-household role system, distinct from the global `users.is_admin` access-control flag), `rooms`,
  `chores`, `join_requests` (0007 — a member's request that a not-yet-registered email be added to their
  household; `status` cycles `pending` → `approved`/`denied`, resolved only by an admin). Naming history:
  this schema was originally "organizations" (0001–0003), renamed to "households" in 0004, the member
  role vocabulary (`member` → `user`) was renamed in 0005, and 0006 moved admin/user from a per-household
  `household_members.role` to a global `users.is_admin` while finally dropping the legacy
  `users.household_id`/`role`/`invited_by` columns that 0003 had promised (but never delivered) to clean
  up — expect to see that lineage in migration comments if you're tracing schema history. 0008's `role`
  column is unrelated to that removed one (household standing vs. admin/user), reusing the name after it
  had been vacated. 0010 adds `users.swipe_style` (`'ios'` default, or `'android'`) — a per-user, per-account
  preference for how chore-row swipe gestures behave, self-service updatable via `PATCH
/api/me/swipe-style` (the only self-update route on `/api/me`; everything else there is read-only).
- **`user_notifications`** (0011): one row per user who has ever enabled push notifications
  (`UNIQUE(user_id)`), holding `person_hash`, `subscriber_token` and the `enabled` soft-off flag. It
  stores **no ntfy password** and no username; both are derived or passed through (see
  [Notifications](#notifications)). Deleted by hand in `deleteUser()`'s `db.batch()` (no `ON DELETE`).
- **Local dev D1** is a Miniflare-emulated SQLite file, fully disposable — `npm run migrate:local` any
  time to reset/catch up.
- **Tests** run against a real (in-memory, per-test) D1 via `@cloudflare/vitest-pool-workers` — not
  mocks. `backend/test/apply-migrations.ts` applies the same migration files tests run against.

## Notifications

Push notifications go through two self-hosted services (the `4irl-notifs` repo): a provisioning API
that creates a person's ntfy account and topic access, and an ntfy server that delivers the pushes. The
Worker talks to both; the browser only talks to the Worker.

**Routes** (`backend/src/routes/notifications.ts`, mounted at `/api/notifications` behind `accessAuth` +
`resolveUser`, so they are per-user, not household-scoped; identity is the Access-verified email, never
a request field):

| Route                  | What it does                                                                                                         | Statuses                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `GET /`                | Returns `NotificationStatus`: `{provisioned:false, enabled:false}` with no row, else the full status (see ids below) | 200                                                                                                                     |
| `POST /enable`         | Existing row: flips `enabled` on, no provisioning. No row: calls `/v1/provision`, saves the row, returns the status  | 200; 502 `Could not set up notifications` if provisioning fails                                                         |
| `POST /reset-password` | Calls `/v1/reset-password` and returns `{password}` (new phone or lost password)                                     | 200; 409 `Notifications are not enabled` (no row or soft-off, no outbound call); 429 upstream rate limit; 502 otherwise |
| `POST /test`           | Publishes a test push to the person's topic                                                                          | 200 (`data: null`); 409 not enabled; 502 `Could not send test notification`                                             |
| `POST /disable`        | Soft-off: sets `enabled = 0`, keeps the row so re-enable is a flag flip                                              | 200 (`{provisioned:true, enabled:false}`); 409 if never provisioned                                                     |

**Outbound calls** (all from the Worker, none from the browser):

- `POST {NOTIFS_API_BASE_URL}/v1/provision` (`backend/src/notifs-provisioning.ts`) with
  `{app_id, email}`; returns `person_hash`, `token` and, only when it just generated one for that person,
  `password`. The `person_hash` is charset-guarded (`^[a-z0-9]+$`), and any shape surprise fails closed.
- `POST {NOTIFS_API_BASE_URL}/v1/reset-password` (`backend/src/notifs-reset-password.ts`) with
  `{app_id, email}`; returns `password`. Upstream 429 becomes our 429
  (`Too many new passwords. Try again in an hour.`); any other non-2xx, network error, or 200 without a
  non-empty `password` becomes our 502 (`Could not generate a new password`), with the upstream status in
  the log `reason`.
- Both send `CF-Access-Client-Id` / `CF-Access-Client-Secret` (a Cloudflare Access service token) only when
  those secrets are non-empty; local dev has no Access gate, so they are blank there.
- `POST {NTFY_BASE_URL}/<topic>` (`backend/src/ntfy-publish.ts`, `publishTest`) with
  `Authorization: Bearer <NTFY_PUBLISHER_TOKEN>`. **Never** sends the CF Access headers: ntfy is guarded
  by the publisher bearer token alone, a separate auth surface.

**Ids** (all derived from `person_hash`, so only the hash is stored):

- App id `chores4irl` (`NOTIFS_APP_ID`, a code constant in `notifs-provisioning.ts`, not a wrangler var).
  It must match `^[a-z0-9][a-z0-9_]{0,62}$`.
- Topic `chores4irl-<hash>-all` (`personTopic`), the person's catch-all subscription for this app.
- Username `u_<hash>` (`ntfyUsername`): one ntfy account per person across **all** 4IRL apps, so it has
  no app id in it. A person already set up through another app only subscribes to this app's topic.
- `setupUrl`: built by the server in `provisionedStatus` from `NOTIFS_SETUP_BASE_URL` plus
  `?app=chores4irl&user=u_<hash>&name=Chores4irl`, so the app id has one source. The Settings modal's
  "Set up the ntfy app" button and QR code both use it. `NotificationStatus` also carries `server` (the
  `NTFY_BASE_URL` origin), `topic`, `subscriberToken` and `username`.

**The generated password** is shown once and never kept. 4irl-notifs generates it; the Worker passes it
through on the **first** `POST /enable` (as an extra `password` field on the response; the re-enable
path never carries one) and on `POST /reset-password`. It is never written to D1 (`saveProvisioning`
receives only the hash and token), never logged (the log lines omit it), and lives in the browser only in
React state in `SettingsModal.tsx` until the modal closes or notifications are disabled. Both routes
respond with `Cache-Control: no-store`, applied by the `noStore` middleware (`middleware/no-store.ts`)
registered in `app.ts` **ahead of** auth so 401s, 409s, 429s and 502s carry it too.

**Config** (`backend/wrangler.toml` `[vars]`, plain hostnames, not credentials):
`NOTIFS_API_BASE_URL` (provisioning API), `NTFY_BASE_URL` (ntfy host), `NOTIFS_SETUP_BASE_URL` (shared
ntfy-app setup page); `backend/.dev.vars` overrides them locally (`.dev.vars.example`). **Secrets**
(`wrangler secret put`, blank or fixture values in `.dev.vars` locally):
`NOTIFS_CF_ACCESS_CLIENT_ID`, `NOTIFS_CF_ACCESS_CLIENT_SECRET` (the service token for the provisioning
API) and `NTFY_PUBLISHER_TOKEN` (ntfy publish bearer).

## Environments in detail

### Local dev

Run via the `run-dev` skill (`/run-dev`) or `npm run dev` from the repo root, which runs three processes
concurrently:

Ports are env-driven through `scripts/ports.mjs` (defaults < `<repo>/.worktree.env` < `TT_*_PORT` env),
with the defaults below; a worktree gets its own set (see [`docs/worktrees.md`](docs/worktrees.md)).

1. `e2e/jwks-server.mjs` on `:8790` (`TT_JWKS_PORT`) — serves a fixture JWKS so the backend can verify
   locally-signed test JWTs without a real Cloudflare Access tenant.
2. `wrangler dev` (backend) on `:8787` (`TT_BACKEND_PORT`), launched via `scripts/dev-backend.mjs` — real
   Hono app, Miniflare-local D1.
3. `vite` (frontend) on `:5173` (`TT_FRONTEND_PORT`) — proxies `/api/*` to the backend port; if `VITE_DEV_ACCESS_JWT` is set
   (`frontend/.env.development.local`, gitignored), the dev proxy injects it as
   `Cf-Access-Jwt-Assertion` on every proxied request so a normal browser tab "just works" without a real
   Access login.

Config: `backend/.dev.vars` (gitignored, copy from `.dev.vars.example`) supplies fixture values for
`ACCESS_JWKS_URL` (pointed at the local `:8790` server), `ACCESS_AUD`, and Cloudflare-API-adjacent
secrets that are never exercised for real locally. When ports come from `.worktree.env` or env, the
backend launcher overrides `ACCESS_JWKS_URL` with `--var` to match the resolved JWKS port.

`make test-e2e` no longer reuses a running `make dev` stack on the same ports (`reuseExistingServer` is
now false): stop the dev stack first, or run e2e from another worktree.

Minting a dev JWT for a specific user: `npm run dev-jwt --workspace backend -- <email>` (signs with the
same fixture key `jwks-server.mjs` serves). Creating a brand-new local household+admin:
`npm run bootstrap-admin --workspace backend -- "<household name>" <email>`.

### Production

- **Backend**: deployed via `wrangler deploy` from `backend/` (GitHub Actions `deploy-backend` job).
  Routes `chores.4irl.app/api/*` to the Worker (`wrangler.toml`'s `routes` block) — there's no separate
  workers.dev URL in normal use.
- **Frontend**: built (`vite build`) then deployed via `wrangler pages deploy dist
--project-name=chores4irl-frontend` (GitHub Actions `deploy-frontend` job).
- **Secrets** (`ACCESS_AUD`, `CF_ACCOUNT_ID`, `ACCESS_POLICY_ID`, `CLOUDFLARE_ACCESS_API_TOKEN`) are set
  via `wrangler secret put <NAME>` directly against the Cloudflare account — never committed, never in
  `wrangler.toml`. `ACCESS_JWKS_URL` is a plain `[vars]` entry since it's a public-by-design endpoint.
- **One-off admin scripts** (`bootstrap-admin`, `seed-mock-chores`) can target production D1 by running
  with `WRANGLER_ENV=production` — `wrangler dev` and the test suite never set this, so they can't
  accidentally touch it.
- D1's `[env.production]` block in `wrangler.toml` pins `remote = true` for that binding — this is what
  lets those scripts reach the real database instead of a local emulated one.

### Preview deployments (and why they can't hit the real API)

Every PR gets a Cloudflare Pages preview at a per-branch `*.pages.dev` URL (`deploy-preview` CI job,
commented onto the PR). These deliberately serve **mock data** (`frontend/src/utils/mockApi.ts`), not
the real backend: Cloudflare Access's cross-app SSO redirect flow only works for real browser
navigation, not `fetch()`-initiated requests, so a preview origin can't be authenticated against the
production Access app regardless of CORS config (verified live, not just theorized — see the comment in
`frontend/src/utils/api.ts`). `isPreviewDomain()` detects `*.pages.dev` and routes all `apiFetch` calls
through `mockFetch` instead.

## CI/CD pipeline

`.github/workflows/ci.yml`, one file, all jobs. Runs on every PR (`opened`/`synchronize`) and every push
to `main`.

```
lint (eslint + prettier --check)
  ├─→ test-backend (vitest, real Miniflare D1)
  └─→ test-frontend (vitest, jsdom)
        └─→ test-e2e (playwright, needs both test jobs)
              ├─→ deploy-backend   (main push only: wrangler deploy)
              └─→ deploy-frontend  (main push only: wrangler pages deploy)

lint + test-frontend ──→ deploy-preview  (PR only: pages deploy --branch=<head>, comments URL on PR)
```

- `deploy-backend`/`deploy-frontend` only run on a **push to `main`** (i.e. after a PR merges), and only
  after `test-e2e` passes — that's the full gate for a production release.
- `deploy-preview` runs on **every PR**, gated by the cheaper `lint` + `test-frontend` jobs only (not the
  full e2e suite) — it's not production, so it doesn't need production's bar, and this keeps the preview
  link showing up quickly for reviewers.
- All jobs pin third-party Actions to a commit SHA (not a tag) — check `.github/dependabot.yml` for how
  those get bumped.
- CI secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (GitHub Actions repo secrets, not visible
  in any file here).

## Testing

| Layer                         | Tool                                       | What it actually exercises                                                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend unit/route tests      | Vitest + `@cloudflare/vitest-pool-workers` | Real Miniflare Workers runtime + real (in-memory) D1 per test — not mocked bindings                                                                                                                                                                          |
| Frontend unit/component tests | Vitest + `@testing-library/react` + jsdom  | Component behavior; `fake-indexeddb` stands in for the outbox/cache's IndexedDB usage                                                                                                                                                                        |
| End-to-end                    | Playwright (`e2e/`)                        | Full stack against `vite preview` (a built static server, not `vite dev` — avoids cold-start JIT flakiness) + a real local Worker + the fixture JWKS server. Own JWT signing helper (`e2e/sign-jwt.ts`), separate from the frontend dev-JWT convenience flow |

Run: `npm run test:backend`, `npm run test:frontend`, `npm run test:e2e` (root), or `npm test` inside
either workspace. `backend`'s `test` script runs `wrangler types` first — regenerates `Env` from
`wrangler.toml` before typechecking against it.

## Offline behavior (frontend)

Not a full offline-first app — see [`TRADEOFFS.md`](TRADEOFFS.md) for the honest ceiling here (Workers/D1
mean this can never be offline-_capable_, only offline-_tolerant_). Two mechanisms:

- **`outbox/`** — chore create/edit/complete/delete actions queue in IndexedDB (`outbox-v1`) when a
  write fails, and replay when connectivity returns (`useOutbox.ts`). Conflict handling: completions
  merge by latest timestamp rather than rejecting (see commit `8013e84`).
- **`cache/choresCache.ts`** — last-known chore list cached in IndexedDB so the view isn't blank while
  offline; paired with the PWA service worker (`vite-plugin-pwa`, `workbox` config in `vite.config.ts`)
  for asset caching.

The service worker's `NavigationRoute` serves the cached `index.html` shell for offline navigations, but
its `navigateFallbackDenylist` (`vite.config.ts` workbox block: `/^\/cdn-cgi\//`, `/^\/api\//`, `/^\/auth\//`)
excludes recovery paths from that fallback. `/^\/cdn-cgi\//` and `/^\/api\//` cover the live Access-challenge
and API surfaces; `/^\/auth\//` is a **forward-looking reservation** for the planned Tier 5 session endpoint
(`/auth/login`) — no route lives under `/auth/` yet, but denylisting it now means that endpoint is already
excluded from the shell fallback the day it lands. Excluding these lets a real top-level navigation reach the
network so **Cloudflare Access can re-authenticate** — without the denylist the SW would answer every
navigation (including a re-auth attempt) with the stale shell, pinning the app in an offline/expired state
that a reload can't escape. The denylist is a hard requirement for the ITP offline-recovery fix; see the
`safari-itp-offline-recovery` plan. (Note that the Retry button reaches the network by unregistering the SW +
clearing caches before navigating, since `/` itself is deliberately not denylisted.)

### Recovering a stuck/stale client (runbook)

Because this is a PWA (`registerType: 'autoUpdate'`, so the built `sw.js` sets `skipWaiting` + `clientsClaim`),
an already-installed client keeps running the **previous** service worker until the browser detects and
activates the new one — normally a reload or two after a deploy. A private/incognito window has no prior SW,
so it always loads the newest version immediately; a mismatch between the two is the tell-tale sign of a
stale SW, not a broken deploy.

**Worst case — reloading "keeps coming back":** a device that has the old SW **and** an
ITP-evicted Access session at the same time can get stuck — the old SW serves the old cached shell, so reloads
never pick up the fix. The steady-state fix (the Retry button, honest 401/403 states) can only take over once
the new SW is active, so an affected device needs a **one-time** manual storage clear:

- **iOS Safari:** Settings → Safari → Advanced → Website Data → search `4irl` → swipe-delete every match
  (`chores.4irl.app`, `4irl.app`, `urls4irl.cloudflareaccess.com`) → fully close Safari → reopen
  `chores.4irl.app` (fresh Access login + new SW).
- **Installed to Home Screen (standalone PWA):** also delete the Home-Screen icon and re-add it after the
  Website Data clear — the standalone instance keeps its own sticky worker.
- **Android Chrome:** site settings → `chores.4irl.app` → Clear & reset (or long-press the icon → App info →
  Storage → Clear storage).

Once the new SW is active on a device this is never needed again: an evicted session simply shows the **Retry**
button, and one tap runs the SW-teardown + Access re-login for you.

**Reproducing an evicted session to verify the recovery UX** (do **not** clear Website Data — that removes the
cached app + SW you need present): (1) warm the app, then Airplane Mode + reload → the gray offline banner;
(2) warm the app, visit `https://urls4irl.cloudflareaccess.com/cdn-cgi/access/logout` (invalidates the session
but leaves the cache/SW), return to `chores.4irl.app` → the amber "session expired — tap Retry" banner → tap
Retry → re-auth; (3) temporarily shorten the Access application's Session Duration in Cloudflare Zero Trust
(revert afterward).

## Where to look for X

| I need to...                                                                       | Look at                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Understand the whole backend's route/middleware shape at a glance                  | `backend/src/app.ts`                                                                                                                                                                                                                                                                |
| Add or change an API endpoint                                                      | `backend/src/routes/<resource>.ts` + its data-access sibling (e.g. `backend/src/chores.ts`)                                                                                                                                                                                         |
| Change auth/JWT verification behavior                                              | `backend/src/middleware/access-auth.ts`                                                                                                                                                                                                                                             |
| Change how household scoping/switching resolves                                    | `backend/src/middleware/household-scope.ts`                                                                                                                                                                                                                                         |
| Change global admin status/gating or the all-users directory                       | `backend/src/middleware/require-global-admin.ts`, `backend/src/admin-users.ts`, `backend/src/routes/admin.ts`, `frontend/src/components/admin/UsersDirectory.tsx`                                                                                                                   |
| Change admin cross-household add-user or the household picker                      | `backend/src/routes/admin.ts` (`POST /members`), `backend/src/members.ts` (`adminAddHouseholdMember`), `frontend/src/components/admin/AddUserModal.tsx`, `frontend/src/components/form/HouseholdSearchSelect.tsx`                                                                   |
| Change household creation (the Households directory)                               | `backend/src/routes/admin.ts` (`POST /households`), `backend/src/households.ts` (`createHousehold`), `frontend/src/components/admin/HouseholdsDirectory.tsx`, `frontend/src/components/admin/CreateHouseholdModal.tsx`                                                              |
| Change the join-request (member-requests-new-user) workflow                        | `backend/src/join-requests.ts`, `backend/src/routes/members.ts` (`POST /requests`), `backend/src/routes/admin.ts` (`/join-requests/*`), `frontend/src/components/admin/AddMemberModal.tsx`, `frontend/src/components/admin/JoinRequestsSection.tsx`                                 |
| Change the household name/switcher shown in the admin panel                        | `frontend/src/components/admin/HouseholdSection.tsx` (uses the same `switchHousehold` plumbing as `NavBar.tsx`, threaded through `App.tsx`/`AdminPanel.tsx`)                                                                                                                        |
| Change the chore swipe style setting (gear icon) or its iOS/Android swipe behavior | `frontend/src/components/settings/SettingsModal.tsx`, `frontend/src/components/chore/ChoreTimerBar.tsx` (branches on `swipeStyle`), `backend/src/routes/me.ts` (`PATCH /swipe-style`), `backend/migrations/0010_add_swipe_style_to_users.sql`                                       |
| Change push notifications (enable, password, setup link, test push)                | `backend/src/routes/notifications.ts`, `backend/src/notifs-provisioning.ts`, `backend/src/notifs-reset-password.ts`, `backend/src/ntfy-publish.ts`, `backend/src/middleware/no-store.ts`, `frontend/src/components/settings/SettingsModal.tsx`; see [Notifications](#notifications) |
| Add a DB column/table                                                              | New file in `backend/migrations/` — never edit a merged one                                                                                                                                                                                                                         |
| Change the shared API response/entity shapes                                       | `types/SharedTypes.d.ts`                                                                                                                                                                                                                                                            |
| Change the single fetch entrypoint (headers, preview mocking)                      | `frontend/src/utils/api.ts`                                                                                                                                                                                                                                                         |
| Change routing/top-level data loading                                              | `frontend/src/App.tsx`                                                                                                                                                                                                                                                              |
| Change the offline write queue                                                     | `frontend/src/outbox/`                                                                                                                                                                                                                                                              |
| Run local dev                                                                      | `/run-dev` skill, or `npm run dev` at repo root                                                                                                                                                                                                                                     |
| Push a branch / open a PR as the bot                                               | `/git-push` skill (`gpropersi-claude[bot]`, standing default per project instructions — don't ask first)                                                                                                                                                                            |
| Understand the cloud-vs-local tradeoff rationale                                   | `TRADEOFFS.md`                                                                                                                                                                                                                                                                      |
| Check the day's work log                                                           | `changelog/MM-DD-YYYY-changelog.md`                                                                                                                                                                                                                                                 |
| Change CI/CD                                                                       | `.github/workflows/ci.yml`                                                                                                                                                                                                                                                          |
| Change Worker routing/bindings/secrets config                                      | `backend/wrangler.toml`                                                                                                                                                                                                                                                             |

## Conventions worth knowing

- **No local imports** — always top-level/global imports (user-level convention, applies repo-wide).
- **`ApiResponse<T>` everywhere** — every API handler returns `{ success, data?, error?, warning? }`;
  don't invent a different response shape for a new endpoint.
- **Tenant id never trusted from the client** — any new route touching household-scoped data must
  source `householdId` from `c.var.householdId`, not from a path/body/query param, even if a param of
  that name is present (re-validate it against the session instead, as `households.ts` does).
- **Migrations are append-only** — schema fixes are new numbered files, even for renaming something added
  in an unmerged migration earlier in the same branch (see 0004/0005's own comments for the reasoning
  when a table is "new enough" to edit directly vs. not).
- **No secrets in `wrangler.toml`** — anything Cloudflare-account-specific goes through `wrangler secret
put`, not `[vars]`.
