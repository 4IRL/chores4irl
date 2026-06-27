# Pi host artifacts (`deploy/pi/`)

Host-side configuration that lives **on the Raspberry Pi**, outside Docker. These
files are **not** part of the container images and are **never touched by a
redeploy** (`git archive` → tarball → `docker compose build` only rebuilds the
two containers). They are version-controlled here so a wiped or drifted Pi can be
restored with one command — the canonical copies are the live files on the Pi.

Target Pi: Debian 13 (trixie) / RPi PIXEL desktop, compositor **labwc**, user
`rmilarachi`, single HDMI touchscreen (panel `DZX Z3`, 1024×600), USB touch
panel `yldzkj USB2IIC_CTP_CONTROL`.

## Files

| Repo file | Lives on the Pi at | Purpose |
|---|---|---|
| `chores4irl-backup.service` / `.timer` | `/etc/systemd/system/` | Weekly SQLite volume backup |
| `display/kanshi-config` | `~/.config/kanshi/config` | Display rotation |
| `display/labwc-rc.xml.fragment` | merge into `~/.config/labwc/rc.xml` | Touch rotation (libinput `calibrationMatrix`) |
| `install-display-config.sh` | run on the Pi | Idempotently apply both of the above |

## Display rotation & touch alignment

Two independent settings — rotating the **display** does **not** rotate **touch**:

1. **Display** — kanshi (`~/.config/kanshi/config`), launched by the RPi desktop
   from `/etc/xdg/labwc/autostart`.
2. **Touch** — a libinput `calibrationMatrix` in `~/.config/labwc/rc.xml`. labwc's
   `mapToOutput` does not rotate touch with the output.

**They must agree.** Pick the row for the orientation you want and use both values
from it. (Verified known-good anchor: `transform 270` ↔ `0 1 0 -1 0 1`.)

| Upright needs | kanshi `transform` | labwc `calibrationMatrix` |
|---|---|---|
| no rotation | `normal` | `1 0 0 0 1 0` |
| 90°  | `90`  | `0 -1 1 1 0 0` |
| 180° | `180` | `-1 0 1 0 -1 1` |
| 270° | `270` | `0 1 0 -1 0 1` |

Current shipped values: **`transform 90`** ↔ **`0 -1 1 1 0 0`** (the panel was
remounted since first deploy, so the original `270` is now 180° upside down).

**Find the right row live, without rebooting:**

```sh
wlr-randr                                   # list outputs + current Transform
wlr-randr --output "DZX Z3 0000000000000" --transform 90   # try until upright
```

Then set the matching `calibrationMatrix` in `rc.xml` and `labwc --reconfigure`,
and drag the date scrubber to confirm touch lands correctly.

### Port-independent output matching (the durable fix)

kanshi matches an output by **name** *or* by **make/model/serial description**.
Connector names drift between `HDMI-A-1` and `HDMI-A-2` depending on which
micro-HDMI port the cable is in; when the name drifts, the profile silently stops
applying — the screen goes unrotated and touch looks misaligned (the matrix still
assumes a rotated display). This is what looked like a "deploy broke rotation"
regression on 2026-06-27; the deploy was unrelated.

The shipped config matches by description (`output "DZX Z3 0000000000000"`), which
survives port swaps. Re-verify the string with `wlr-randr` only if the panel is
replaced.

## Apply / restore onto a Pi

```sh
# From the repo checkout on the Pi:
deploy/pi/install-display-config.sh        # installs kanshi config + touch matrix
labwc --reconfigure                         # apply touch without a full reboot
```

The script is idempotent (safe to re-run), backs up `rc.xml` before touching it,
and refuses to clobber an existing `<libinput>` block — printing instructions
instead. Verify after a cold boot: screen upright, touch aligned.
