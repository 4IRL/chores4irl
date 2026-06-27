# Pi host artifacts (`deploy/pi/`)

Host-side configuration that lives **on the Raspberry Pi**, outside Docker. These
files are **not** part of the container images and are **never touched by a
redeploy** (`git archive` → tarball → `docker compose build` only rebuilds the
two containers). They are version-controlled here only so a wiped or drifted Pi
can be restored quickly — the canonical copies are the live files on the Pi.

Target Pi: Debian 13 (trixie) / RPi PIXEL desktop, compositor **labwc**, user
`rmilarachi`, single HDMI touchscreen (panel `DZX Z3`, 1024×600), USB touch
panel `yldzkj USB2IIC_CTP_CONTROL`.

## Files

| Repo file | Lives on the Pi at | Purpose |
|---|---|---|
| `chores4irl-backup.service` / `.timer` | `/etc/systemd/system/` | Weekly SQLite volume backup |
| `display/kanshi-config` | `~/.config/kanshi/config` | Display rotation (90° CW = `transform 270`) |
| `display/labwc-rc.xml.fragment` | merge into `~/.config/labwc/rc.xml` | Touch rotation (libinput `calibrationMatrix`) |

## Display rotation & touch alignment

Two independent settings — rotating the **display** does **not** rotate **touch**:

1. **Display** — kanshi (`~/.config/kanshi/config`), launched by the RPi desktop
   from `/etc/xdg/labwc/autostart`. `transform 270` = 90° clockwise.
2. **Touch** — a libinput `calibrationMatrix` in `~/.config/labwc/rc.xml`
   (`0 1 0 -1 0 1`, the inverse of `transform 270`). labwc's `mapToOutput` does
   not rotate touch with the output.

### The output-name gotcha (cause of the 2026-06-27 regression)

kanshi matches its profile by **output name**. The touchscreen has enumerated as
both `HDMI-A-1` and `HDMI-A-2` depending on which micro-HDMI port the cable is in
(Pi 4 has two) and occasionally on boot enumeration. If the name in
`kanshi-config` does not match `wlr-randr`:

- the profile silently does **not** apply → screen stays upright
  (`Transform: normal`), **and**
- touch looks **misaligned**, because the `calibrationMatrix` still assumes a
  rotated display.

This presents as "rotation broke after a deploy/reboot" but the deploy is
unrelated — it's the connector name drifting out from under kanshi.

**Diagnose:** `wlr-randr` — note the output name (`HDMI-A-1` vs `HDMI-A-2`) and
that `Transform:` reads `normal` instead of the expected rotation.

**Fix (pick one):**
- Move the HDMI cable back to the original micro-HDMI port, **or**
- Update the `output "..."` name in `kanshi-config` to match `wlr-randr`, **or**
- (Recommended, port-independent) match by make/model/serial instead of
  connector name — see the comment in `display/kanshi-config`.

## Restore onto a Pi

```sh
# Display rotation
mkdir -p ~/.config/kanshi
cp deploy/pi/display/kanshi-config ~/.config/kanshi/config
# edit the output name to match `wlr-randr` if needed

# Touch rotation — MERGE the fragment into rc.xml (do not overwrite it)
cp ~/.config/labwc/rc.xml ~/.config/labwc/rc.xml.bak
# paste the <libinput> block from deploy/pi/display/labwc-rc.xml.fragment
# into ~/.config/labwc/rc.xml inside <labwc_config> ... </labwc_config>

labwc --reconfigure   # or re-login / reboot
```

Verify after a cold boot: screen is upright and dragging the date scrubber lands
touches on the correct spot.
