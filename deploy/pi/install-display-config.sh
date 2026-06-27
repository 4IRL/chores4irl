#!/usr/bin/env bash
#
# chores4irl — install Pi display rotation + touch calibration.
#
# Idempotent: safe to re-run. Installs the kanshi display-rotation profile and
# merges the libinput touch calibrationMatrix into labwc's rc.xml. Run this on
# the Pi after a fresh deploy or a wiped ~/.config. It does NOT touch Docker.
#
#   deploy/pi/install-display-config.sh
#   labwc --reconfigure        # apply touch without a full reboot
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KANSHI_SRC="$SCRIPT_DIR/display/kanshi-config"
TOUCH_FRAGMENT="$SCRIPT_DIR/display/labwc-rc.xml.fragment"

KANSHI_DEST="$HOME/.config/kanshi/config"
RC_XML="$HOME/.config/labwc/rc.xml"

info() { printf '  %s\n' "$*"; }
warn() { printf '  WARNING: %s\n' "$*" >&2; }

# --- 1. kanshi display rotation (full-file, always safe to overwrite) ---------
echo "[1/2] kanshi display rotation -> $KANSHI_DEST"
mkdir -p "$(dirname "$KANSHI_DEST")"
if [ -f "$KANSHI_DEST" ] && cmp -s "$KANSHI_SRC" "$KANSHI_DEST"; then
  info "already up to date."
else
  # Separate statements (not an &&-chain): under `set -e` only the final command
  # in an &&-list aborts on failure, so a chained backup `cp` could fail silently
  # and let the overwrite below proceed with no backup.
  if [ -f "$KANSHI_DEST" ]; then
    cp "$KANSHI_DEST" "$KANSHI_DEST.bak"
    info "backed up -> $KANSHI_DEST.bak"
  fi
  cp "$KANSHI_SRC" "$KANSHI_DEST"
  info "installed."
fi

# --- 2. labwc touch calibrationMatrix (guarded merge into existing rc.xml) ----
echo "[2/2] labwc touch calibration -> $RC_XML"
if [ ! -f "$RC_XML" ]; then
  warn "no rc.xml found. Create ~/.config/labwc/rc.xml with a <labwc_config> root,"
  warn "then re-run, or paste the fragment from:"
  warn "  $TOUCH_FRAGMENT"
  exit 1
fi

if grep -q '<calibrationMatrix>' "$RC_XML"; then
  info "a <calibrationMatrix> is already present — leaving it untouched."
  info "to change orientation, edit it by hand (see deploy/pi/README.md table)."
elif grep -q '<libinput>' "$RC_XML"; then
  warn "rc.xml already has a <libinput> block but no <calibrationMatrix>."
  warn "merge by hand to avoid clobbering other libinput settings; fragment at:"
  warn "  $TOUCH_FRAGMENT"
  exit 1
else
  # No libinput block at all — safe to insert the whole fragment before </labwc_config>.
  cp "$RC_XML" "$RC_XML.bak"
  info "backed up -> $RC_XML.bak"
  # Strip the XML comment header from the fragment; keep only the <libinput>
  # block. Anchor to start-of-line so the "<libinput>" mention inside the
  # comment header is not matched. Write to a temp file and read it into awk
  # via getline (not `-v`, which would interpret backslash escapes in the
  # block). Write the merged result to a temp file and mv into place so a
  # mid-stream awk failure can never leave rc.xml truncated/empty.
  block_file="$RC_XML.fragment.tmp"
  merged_tmp="$RC_XML.merged.tmp"
  sed -n '/^<libinput>/,/^<\/libinput>/p' "$TOUCH_FRAGMENT" > "$block_file"
  awk -v fragfile="$block_file" '
    /<\/labwc_config>/ && !done {
      while ((getline line < fragfile) > 0) print line
      done=1
    }
    { print }
  ' "$RC_XML.bak" > "$merged_tmp"
  mv "$merged_tmp" "$RC_XML"
  rm -f "$block_file"
  info "inserted touch calibrationMatrix."
fi

echo "Done. Run 'labwc --reconfigure' (or reboot) to apply touch; kanshi applies on next login."
