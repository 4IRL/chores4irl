#!/usr/bin/env bash
# chores4irl SQLite backup.
#
# Takes a consistent online snapshot of the live database using better-sqlite3's
# db.backup() (safe with WAL mode — unlike copying data.db while it's open),
# prunes to the most recent N snapshots, and optionally rsyncs the backup
# directory off the Pi.
#
# Invoked weekly by chores4irl-backup.timer (systemd). See README "Backup strategy".
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-/home/pi/chores4irl/docker-compose.yml}"
DEST="${BACKUP_DIR:-/home/pi/backups}"
RETENTION="${BACKUP_RETENTION:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$DEST"

# Off-Pi copy is REQUIRED, not optional. A backup that never leaves the SD card
# protects against logical loss (bad write, accidental wipe) but NOT against the
# card physically dying — which takes the snapshots with it. Fail fast and loud
# rather than lull the operator into a false sense of safety.
if [ -z "${BACKUP_RSYNC_DEST:-}" ]; then
  echo "ERROR: BACKUP_RSYNC_DEST is not set — refusing to keep backups only on the SD card." >&2
  echo "Set it in chores4irl-backup.service, e.g. user@nas:/srv/backups/chores4irl" >&2
  echo "(see README 'Backup strategy')." >&2
  exit 1
fi

dc() { docker compose -f "$COMPOSE_FILE" "$@"; }

# Online backup inside the container, then copy the snapshot to the host.
dc exec -T backend node -e "(async()=>{const Database=(await import('better-sqlite3')).default;const db=new Database(process.env.DB_PATH);await db.backup('/data/backup-tmp.db');process.exit(0);})().catch(e=>{console.error(e);process.exit(1);})"
docker cp "$(dc ps -q backend):/data/backup-tmp.db" "$DEST/chores4irl-$STAMP.db"
dc exec -T backend rm -f /data/backup-tmp.db
echo "backup written: $DEST/chores4irl-$STAMP.db"

# Prune: keep the most recent $RETENTION snapshots, delete the rest.
ls -1t "$DEST"/chores4irl-*.db 2>/dev/null | tail -n +$((RETENTION + 1)) | xargs -r rm -f

# Off-Pi copy (required — validated at the top of this script).
rsync -a --delete "$DEST"/ "$BACKUP_RSYNC_DEST"/
echo "off-Pi sync complete: $BACKUP_RSYNC_DEST"
