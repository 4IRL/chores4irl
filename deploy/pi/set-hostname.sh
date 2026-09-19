#!/usr/bin/env bash
#
# chores4irl — set the Pi's hostname (default: c4i) so LAN clients can use
# http://c4i.local/ (Avahi mDNS) and http://c4i/ (router DNS) instead of the IP.
#
# Idempotent: safe to re-run. The Pi hostname is cloud-init-managed via
# /boot/firmware/user-data (`hostname:` + `manage_etc_hosts: true`), which would
# re-render /etc/hosts with the previous name on every boot. So this script:
#   (a) installs the drop-in cloud-init/99-c4i-hostname.cfg -> /etc/cloud/cloud.cfg.d/
#       (`preserve_hostname: true`, `manage_etc_hosts: false`) so cloud-init stops
#       touching /etc/hostname and /etc/hosts;
#   (b) rewrites user-data's `hostname:` line AND flips its `manage_etc_hosts:` to
#       `false` — user-data out-ranks cloud.cfg.d for that key, so the drop-in
#       alone would be overridden;
#   (c) applies the change immediately: /etc/hosts first, then hostnamectl.
# Both Avahi (<name>.local) and the router's DHCP-registered name follow the
# hostname; reboot afterwards so DHCP re-registers the new name.
#
# Notes:
#   - run as the normal user; `$SUDO` is prefixed per command and MUST stay unquoted
#     so `SUDO=` (empty) disables it — `"$SUDO" cmd` would fail with
#     `: command not found`; running via `sudo ./set-hostname.sh` is harmless
#     (double sudo)
#   - partial run is safe to re-run from the top (each file has its own
#     up-to-date guard)
#   - user-data also holds `users:` credentials — this script never prints it,
#     only the `hostname:` / `manage_etc_hosts:` lines.
#
#   deploy/pi/set-hostname.sh <new-hostname>   # default c4i when no arg
#   sudo reboot                                # so DHCP re-registers the name
#
# Overridable paths (for dry runs against temp files):
#   HOSTNAME_FILE, HOSTS_FILE, USER_DATA_FILE, CLOUD_CFG_D_FILE
#   SUDO=            disables sudo
#   APPLY_LIVE=0     skips hostnamectl / findmnt / avahi checks
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLOUD_INIT_DROPIN_SRC="$SCRIPT_DIR/cloud-init/99-c4i-hostname.cfg"

HOSTNAME_FILE="${HOSTNAME_FILE:-/etc/hostname}"
HOSTS_FILE="${HOSTS_FILE:-/etc/hosts}"
USER_DATA_FILE="${USER_DATA_FILE:-/boot/firmware/user-data}"
CLOUD_CFG_D_FILE="${CLOUD_CFG_D_FILE:-/etc/cloud/cloud.cfg.d/99-c4i-hostname.cfg}"
SUDO="${SUDO-sudo}"
APPLY_LIVE="${APPLY_LIVE:-1}"

info() { printf '  %s\n' "$*"; }
warn() { printf '  WARNING: %s\n' "$*" >&2; }

# --- pre-flight: validate the name, read the current one, check the source ----
NEW="${1:-c4i}"
# RFC 1123 label. Case-insensitive on purpose: DNS/mDNS/SSH are case-insensitive
# and hostnamectl/cloud-init accept mixed case — mixed case is accepted so a
# rollback to the previous name validates.
if ! [[ "$NEW" =~ ^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$ ]]; then
  warn "invalid hostname '$NEW' — must match an RFC 1123 label (letters, digits, hyphens; 1-63 chars; no leading/trailing hyphen)"
  exit 1
fi

# `|| true` is load-bearing: under `set -euo pipefail` a missing $HOSTNAME_FILE
# would abort the assignment before the `hostname` fallback can run.
CURRENT="$(cat "$HOSTNAME_FILE" 2>/dev/null | tr -d '[:space:]' || true)"; [ -n "$CURRENT" ] || CURRENT="$(hostname)"

# Fail before any side effect if the drop-in was not shipped alongside the script.
[ -f "$CLOUD_INIT_DROPIN_SRC" ] || { warn "no drop-in source at $CLOUD_INIT_DROPIN_SRC — ship deploy/pi/cloud-init/ alongside this script"; exit 1; }

# --- 1. cloud-init user-data (hostname: + manage_etc_hosts: false) -------------
echo "[1/4] cloud-init user-data -> $USER_DATA_FILE"
if [ "$APPLY_LIVE" = 1 ] && [ "$USER_DATA_FILE" = /boot/firmware/user-data ]; then
  findmnt -no OPTIONS /boot/firmware 2>/dev/null | grep -q '^rw' || { warn "/boot/firmware is not mounted read-write"; exit 1; }
fi
if [ ! -f "$USER_DATA_FILE" ]; then
  warn "no cloud-init user-data at $USER_DATA_FILE — skipping (hostname persists only if cloud-init is not managing it)"
else
  if ! $SUDO grep -qE '^hostname:' "$USER_DATA_FILE"; then
    warn "no 'hostname:' key in $USER_DATA_FILE — cloud-init would re-apply the old name on reboot; add one and re-run"
    exit 1
  fi
  need_hostname=1
  if $SUDO grep -qiE "^hostname:[[:space:]]*$NEW[[:space:]]*$" "$USER_DATA_FILE"; then
    need_hostname=0
  fi
  need_meh=0
  if $SUDO grep -qE '^manage_etc_hosts:' "$USER_DATA_FILE"; then
    if ! $SUDO grep -qE '^manage_etc_hosts:[[:space:]]*false[[:space:]]*$' "$USER_DATA_FILE"; then
      need_meh=1
    fi
  else
    info "no 'manage_etc_hosts:' key in $USER_DATA_FILE — nothing to flip (the drop-in's manage_etc_hosts: false applies)."
  fi
  if [ "$need_hostname" = 0 ] && [ "$need_meh" = 0 ]; then
    info "user-data already up to date."
  else
    # Separate statements (not an &&-chain) so a failed backup aborts under set -e.
    $SUDO cp "$USER_DATA_FILE" "$USER_DATA_FILE.bak"
    info "backed up -> $USER_DATA_FILE.bak"
    # One sed -i so both keys change in a single temp-file rename (no half state).
    exprs=()
    if [ "$need_hostname" = 1 ]; then exprs+=(-e "s/^(hostname:[[:space:]]*).*/\1$NEW/"); fi
    if [ "$need_meh" = 1 ]; then exprs+=(-e "s/^(manage_etc_hosts:[[:space:]]*).*/\1false/"); fi
    $SUDO sed -i -E "${exprs[@]}" "$USER_DATA_FILE"
    if [ "$need_hostname" = 1 ]; then info "hostname: -> $NEW"; fi
    if [ "$need_meh" = 1 ]; then info "manage_etc_hosts: -> false"; fi
  fi
fi

# --- 2. /etc/hosts FIRST, then hostname (so sudo resolves the new name) -------
echo "[2/4] /etc/hosts + hostname -> $HOSTS_FILE / $HOSTNAME_FILE"
if [ -f "$HOSTS_FILE" ] && grep -qiE "^[[:space:]]*127\.0\.1\.1[[:space:]]+$NEW([[:space:]]+$NEW)?[[:space:]]*$" "$HOSTS_FILE"; then
  info "hosts already up to date."
elif [ -f "$HOSTS_FILE" ] && grep -qE '^[[:space:]]*127\.0\.1\.1[[:space:]]' "$HOSTS_FILE"; then
  $SUDO cp "$HOSTS_FILE" "$HOSTS_FILE.bak"
  info "backed up -> $HOSTS_FILE.bak"
  # cloud-init's hosts.debian.tmpl shape: `127.0.1.1 {{fqdn}} {{hostname}}`.
  $SUDO sed -i -E "s/^[[:space:]]*127\.0\.1\.1[[:space:]].*/127.0.1.1 $NEW $NEW/" "$HOSTS_FILE"
  info "127.0.1.1 -> $NEW $NEW"
else
  # Additive: nothing is overwritten, so no backup on this path.
  printf '127.0.1.1 %s %s\n' "$NEW" "$NEW" | $SUDO tee -a "$HOSTS_FILE" >/dev/null
  info "127.0.1.1 -> $NEW $NEW"
fi

if [ "${CURRENT,,}" = "${NEW,,}" ]; then
  info "hostname already up to date."
elif [ "$APPLY_LIVE" = 1 ]; then
  if $SUDO hostnamectl hostname "$NEW"; then
    info "hostnamectl hostname $NEW"
  else
    echo "$NEW" | $SUDO tee "$HOSTNAME_FILE" >/dev/null
    warn "hostnamectl failed — wrote $HOSTNAME_FILE directly; the running hostname changes at reboot"
  fi
else
  echo "$NEW" | $SUDO tee "$HOSTNAME_FILE" >/dev/null
  info "(dry run) wrote $HOSTNAME_FILE"
fi

# --- 3. cloud-init drop-in (takes cloud-init out of the hostname loop) --------
echo "[3/4] cloud-init drop-in -> $CLOUD_CFG_D_FILE"
if [ -f "$CLOUD_CFG_D_FILE" ] && cmp -s "$CLOUD_INIT_DROPIN_SRC" "$CLOUD_CFG_D_FILE"; then
  info "cloud-init drop-in already up to date."
else
  if [ -f "$CLOUD_CFG_D_FILE" ]; then
    $SUDO cp "$CLOUD_CFG_D_FILE" "$CLOUD_CFG_D_FILE.bak"
    info "backed up -> $CLOUD_CFG_D_FILE.bak"
  fi
  $SUDO cp "$CLOUD_INIT_DROPIN_SRC" "$CLOUD_CFG_D_FILE"
  info "installed."
fi

# --- 4. verify (every check guarded: never aborts, never leaves a non-zero exit)
echo "[4/4] verify"
if [ -f "$USER_DATA_FILE" ]; then
  # grep only — never cat: the file carries credentials.
  $SUDO grep -E '^(hostname|manage_etc_hosts):' "$USER_DATA_FILE" || true
fi
cat "$HOSTNAME_FILE" 2>/dev/null || warn "no $HOSTNAME_FILE"
grep -E '^127\.0\.1\.1' "$HOSTS_FILE" || warn "no 127.0.1.1 line in $HOSTS_FILE"
grep -E '^(preserve_hostname|manage_etc_hosts):' "$CLOUD_CFG_D_FILE" || true
if [ "$APPLY_LIVE" = 1 ]; then
  # Avahi 0.8 follows hostname changes on its own; no restart needed.
  systemctl is-active avahi-daemon || warn "avahi-daemon is not active — $NEW.local will not be advertised"
else
  info "(dry run) avahi check skipped"
fi

echo "Done. Reboot the Pi so DHCP re-registers '$NEW' with the router: sudo reboot"
echo "Backups (if any): $USER_DATA_FILE.bak, $HOSTS_FILE.bak, $CLOUD_CFG_D_FILE.bak — delete them once the reboot verification passes; after that, rollback is: $0 <old-name>"
if [ "${CURRENT,,}" != "${NEW,,}" ]; then
  warn "update the laptop: deploy.sh / ~/.ssh/config targets '$CURRENT' -> '$NEW'"
fi
