# Design Tradeoffs

This repo was seeded from `chores4irl`, a single-household, Raspberry Pi kiosk version of the same
product — fully local, LAN-only, zero internet dependency, one physical device per household. This
document carries forward the tradeoff analysis that informed building cloud-native here instead of
staying with that model. It's inherited context, not a literal before/after within this repo — chore-reaper
never had a local mode to compare against directly.

## What the cloud-native model buys

**Sharability.** No hardware requirement per household, no one needs to own or maintain a physical
device to use this. A real public URL, gated by Cloudflare Access, reachable from anywhere.

**Real authentication.** Every request is tied to a verified identity and scoped to a household —
not "anyone on this network has full access," which was the honest state of the sibling project's local
model.

**Managed durability.** D1's built-in backups replace what would otherwise be a bespoke SD-card backup
system (weekly snapshots, mandatory off-site copy, systemd timers) — a real reduction in what has to be
maintained, not a relocation of the problem. A weekly encrypted export to R2 adds an independent second
copy beyond Time Travel; its limit is that the bucket lives in the same Cloudflare account as D1, so it
does not protect against losing the account.

## What it costs, inherited from that same analysis

**No local-first reliability.** The sibling project's local app has zero internet dependency — it works
if the ISP is down, if Cloudflare has a bad day, if there's no internet at all. This app doesn't have
that property and structurally can't: the moment it needs anything from the database, it needs Cloudflare
reachable, because Workers and D1 only exist on the internet. `CLOUDFLARE.md` §7's offline outbox and
service-worker caching make this _offline-tolerant_ — a brief wifi blip degrades gracefully — but not
_offline-capable-forever_ the way a fully local deployment is. Worth being honest about this ceiling
rather than implying push-based sync or caching fully closes the gap.

**Data lives with a third party.** Household and user data live in Cloudflare's infrastructure, and
identity is verified through Cloudflare Access rather than something self-hosted. Reasonable for most
use cases, but a real dependency, not a neutral default.

**Deep vendor lock-in.** The design is low-complexity specifically _because_ it leans hard into
Cloudflare-specific products — Workers isn't "just Node," D1's client API isn't a portable SQLite file
handle, Access's JWT-header model is Cloudflare's own auth mechanism. Leaving Cloudflare later means
rebuilding the compute model, the data-access layer, and auth from scratch — the exact things this
design exists to avoid building in the first place.

**Free-tier ceilings are a real constraint, not just a cost line.** Growth is bounded by Workers request
quota, D1 read/write quotas, and Access's seat cap. Comfortable at small scale, but "add more
households" becomes "am I still inside the free tier" — a question a self-hosted deployment never has
to ask, since its only limit is hardware you fully own.

**Running infrastructure other people's data lives in.** Whoever operates this is now responsible for
uptime and safety of every household's data on it — an ongoing obligation that a fully local,
one-household-per-device model never creates, since each deployment there is self-contained and someone
else's problem if it breaks.

## Net take

This is the same trade the sibling project's analysis landed on: reach and shared infrastructure, in
exchange for the self-sufficiency a fully local deployment has by construction. Worth remembering when
evaluating a future feature request that assumes "just like it always works" — some of what "always
works" meant in the local version isn't fully recoverable here, only approximated.
