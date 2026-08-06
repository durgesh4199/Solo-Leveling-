# Hunter Protocol — Art Asset Manifest

This is the exact file list for replacing the procedural SVG art
(`src/art/portraits.ts`, `src/art/icons.ts`) with real images. Drop files
into `public/art/` using **these exact names** — once they're in place,
wiring the code to use them is a mechanical follow-up (swap each
`<svg>`-returning function for an `<img src="...">`), not a guessing game.

Nothing needs to change in the codebase to add the files themselves -
`public/` is served as-is by Vite (and copied into `dist/` unchanged at
build time), so paths stay predictable. **Don't wire anything up until
you tell me the images are in** - half-swapped art (some portraits real,
some still procedural) would look worse than the current consistent
style, so this lands as one clean pass once the files exist.

## Format guidance (all categories)

- **PNG, transparent background**, square canvas (1:1 aspect ratio -
  512×512 or 1024×1024 both work fine).
- Portraits get displayed inside a circular frame with glow effects
  *behind* them (`border-radius:50%; overflow:hidden` over a radial
  gradient) - a bust/headshot composition centered in the square reads
  best; a full-body shot will get cropped by the circle.
- Keep the subject reasonably centered with a little breathing room at
  the edges - the circular crop clips anything near the corners anyway.

## 1. Hunter (the player) - 1 image

```
public/art/hunter/hunter.png
```

One portrait, no rank variants needed - the "player aura" (the glowing
ring effect that changes color as you rank up) is a separate CSS overlay
already, layered on top of whatever portrait image is underneath it, so
it doesn't need a different image per rank.

## 2. Enemies - 6 images (one per monster family)

Every monster in the game (~120 named species across 20 gates) draws
from just 6 silhouette families ("archetypes") - swapping these 6 covers
every enemy, boss, and Shadow in the game:

```
public/art/enemies/goblin.png   (E-rank family - Goblin Scout, Goblin Raider, ...)
public/art/enemies/orc.png      (D-rank family - Orc Brute, Orc Grunt, ...)
public/art/enemies/wraith.png   (C-rank family - Ice Wraith, Frost Specter, ...)
public/art/enemies/knight.png   (B-rank family - Blood Knight, Fallen Knight, ...)
public/art/enemies/beast.png    (A-rank family - Shadow Beast, Dire Fang, ...)
public/art/enemies/wyrm.png     (S-rank family - Ancient Wyrm, Storm Wyrm, ...)
```

Bosses reuse the same image as their gate's family (just rendered
bigger, with a rotating ring) - no separate boss art needed unless you
want it.

**Shadows** (your arisen army) also reuse these same 6 images with a CSS
desaturation filter already applied in code (the "ghostly" monochrome
look) - no separate Shadow art needed either, unless you want a visually
distinct Shadow version per family (optional - tell me if so and I'll
add 6 more slots for it).

## 3. Gates - 6 images (one per rank) *or* 20 (one per gate) - your call

Today gate art is rank-tinted, not gate-specific (all 4 E-rank gates
share one look). Simplest match to the current design:

```
public/art/gates/rank-e.png
public/art/gates/rank-d.png
public/art/gates/rank-c.png
public/art/gates/rank-b.png
public/art/gates/rank-a.png
public/art/gates/rank-s.png
```

If you'd rather have unique art per gate instead (Crumbling Ruins looks
different from Wailing Marsh even though both are E-rank), use the gate
ids instead - `g1` through `g20`:

```
public/art/gates/g1.png   (Crumbling Ruins)
public/art/gates/g2.png   (Wailing Marsh)
... through ...
public/art/gates/g20.png  (Worldless Throne)
```

Pick one approach (rank-based is 6 files, per-gate is 20) - don't need
both.

## 4. Equipment - 6 images (one per slot)

```
public/art/items/weapon.png
public/art/items/helmet.png
public/art/items/chest.png    (Body Armor)
public/art/items/legs.png
public/art/items/ring.png
public/art/items/amulet.png
```

**Heads up on rarity coloring**: right now every item icon is
recolored per-rarity live in the browser (a Common weapon icon and a
Legendary weapon icon are the *same* SVG, tinted gold vs. grey via CSS).
A flat-color PNG can't be recolored the same way. Two options once the
files are here:
- Keep it simple: the image stays one fixed color, and rarity still
  shows via the colored border/glow already around each item slot (this
  is probably the better trade-off - one image per slot, no extra work).
- Or give me a colored variant per rarity per slot (6 slots × 7 rarities
  = 42 images) if you want the icon itself to shift color - a lot more
  files for a subtle effect, not recommended unless you really want it.

Defaulting to the first option unless you say otherwise.

## Optional: UI icons (not "enemies/player/items", skip unless wanted)

`src/art/icons.ts` also has ~30 small procedural icons for buttons and
stat rows (sword, shield, coin, flame, lightning, flask, ...) - these are
generic interface iconography, not character/item art. Only worth
touching if you want the whole UI's visual language to change, not just
the portraits. Say the word if you want a manifest for these too.

## What to send me when ready

Just the images in `public/art/...` with the names above, committed to
the repo (or tell me they're there and I'll pull/check). I'll then:
1. Rewrite the relevant functions in `src/art/portraits.ts` (and
   `items` icon lookups in the screens) to render `<img>` tags pointing
   at these paths instead of generating SVG.
2. Extend the artifact-publishing script to base64-inline these images
   into the single-file build (same way it already inlines the CSS/JS) -
   the published Claude Artifact runs under a strict content policy that
   blocks loading images from external URLs, so they have to travel
   embedded in the one file, not referenced by path, for that version to
   keep working. The GitHub/Electron/Android builds can just reference
   the files normally.
