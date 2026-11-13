# Prepare Images for the Website

## Objective
Turn large source photos (camera or phone files, often 3000 × 4000 px and 2–10 MB) into small web images in `images/`, with the background removed so the PC sits directly on the site's red background, framed like the other build photos.

## When to use
- Adding new build photos or other product shots to the site
- A photo has a coloured studio backdrop that clashes with the site's colours
- An image on the page is slow to load or larger than about 300 KB

## Required inputs
- **Source files**: one or more `.png` or `.jpg` paths. The STPcs originals live in `Ownwebsiteinspo/Website/`.
- Optional: output folder, target height, quality, and how to remove the background (see "Choosing a route")

## Choosing a route
- **Plain green backdrop** (the original studio shots): `tools/prep_images.mjs --key-green`. Fast, no model needed.
- **Real scene** (desk, wall, room, such as `whiteout.jpg`): first `tools/remove_background.py` to cut the PC out, then `tools/prep_images.mjs --fit` to frame and compress it.

## Tool
`tools/prep_images.mjs` (Node + Puppeteer). Run from the project root. The image work happens inside headless Chrome, so no Python image library is needed (Pillow is not installed on this machine).

```
node tools/prep_images.mjs <input...> [options]
```

| Option | Default | What it does |
|---|---|---|
| `--out` | `images` | Output folder. Created if missing. |
| `--height` | `1200` | Maximum height in pixels. Images are scaled down to fit, never up. 1200 px is sharp on high-density screens for the card sizes on the site. |
| `--quality` | `0.86` | WebP quality, 0 to 1. |
| `--key-green` | off | Makes a green backdrop transparent and removes green tint from the subject's edges. |
| `--fit` | none | `w,h` as fractions, e.g. `0.88,0.78`. For cut-outs that are already transparent: trims the empty space, then centres the subject on a 3:4 canvas as large as fits in that share of the canvas. `0.88,0.78` matches the existing build photos. |

Example (the STPcs build photos):
```
node tools/prep_images.mjs Ownwebsiteinspo/Website/hero.png Ownwebsiteinspo/Website/workstation.png Ownwebsiteinspo/Website/optiplex.png --key-green --out images --height 1200
```

### Background removal for real scenes: `tools/remove_background.py`
Uses `rembg`, an open-source (MIT) model that runs locally. It is installed in the project's `.venv` (Homebrew Python 3.13; the system Python 3.9 is too old). Recreate it if missing:
```
/opt/homebrew/bin/python3.13 -m venv .venv && .venv/bin/pip install "rembg[cpu,cli]"
```
```
.venv/bin/python tools/remove_background.py <input...> [--model birefnet-general] [--out .tmp/cutouts] [--fill "x,y x,y ..."] [--erase "x,y x,y ..."]
```
- `--model`: use `birefnet-general` for PCs (best result; about 1 GB, downloaded once to `~/.rembg/models/`). `isnet-general-use` and `birefnet-general-lite` are smaller but failed on the white PC (see lessons).
- `--fill` / `--erase`: polygons, in the output's pixel coordinates (after the default 2400 px scaling), forced fully opaque or fully transparent. Use them to repair holes or leftovers the model gets wrong. To find coordinates, draw a grid over the cut-out or the original with Pillow from `.venv`, and view it.
- The output keeps the original photo's colours under the final mask, so filled areas show the real pixels.

Example (the Whiteout build):
```
.venv/bin/python tools/remove_background.py Ownwebsiteinspo/Website/whiteout.jpg --model birefnet-general --out .tmp/cutouts --fill "1430,365 1747,375 1745,1765 1500,2290 1430,2000"
node tools/prep_images.mjs .tmp/cutouts/whiteout.png --fit 0.88,0.78 --out images --height 1200
```

## Steps
1. Run the tool on the source files.
2. Read the `saved ...` lines. Each shows the output size, file size and, with `--key-green`, the share of pixels removed.
3. Check the result on a red background before using it. Either view the page with the screenshot workflow (`workflows/screenshot_page.md`, with `--scroll-to "#builds"`), or open the images over a red test page in the scratchpad.
4. Reference the `.webp` file in `index.html` with `width` and `height` attributes that match the output size (for example `width="900" height="1200"`).

## Expected output
- `<out>/<name>.webp` for each input, keeping the original file name. Re-running overwrites the previous output.
- For 3000 × 4000 sources at the defaults: 900 × 1200 px, about 110–160 KB each.

## Edge cases and lessons learned
- **How much should be keyed out**: for the three STPcs build photos, about 45–55% of pixels. If a result shows well under 40%, part of the backdrop is probably still there.
- **Dark backdrop areas need a lower threshold.** The first version measured how far green exceeded red and blue in absolute terms. That missed the dark green at the top of the gradient backdrop (only 19–27% keyed). The tool now uses green's lead as a share of its own brightness, with a lower threshold for very dark pixels.
- **The top of the green backdrop is actually dark teal** (about RGB 21, 38, 37: green and blue equal, red lower), so a "green beats blue" test leaves a semi-transparent band across the top. It was invisible in tall cards but showed as a box around each PC once the 2 × 2 builds grid gave the photos more room, because the drop shadow outlined it. The tool now also removes dark teal, but **only where it connects to the photo's edge**. Applied everywhere, the same rule punched red holes in dark tinted glass and shadows inside the cases.
- **Near-invisible leftovers** (alpha below 14) are cleared on every keyed or fitted image, for the same reason: any shadow makes them visible.
- **Quick check after keying**: open the `.webp` in Pillow (`.venv/bin/python`) and print `getchannel('A').getbbox()`. It should hug the PC, not start at `(0, 0)`. If it starts at the image corner, backdrop is left over.
- The CSS edge fade on `.pc img, .build-media img` in `index.html` stays as a safety net.
- **Green subjects**: the key removes anything strongly green. A PC with green RGB lighting or green parts would get holes. In that case, skip `--key-green` and pick a photo with a different backdrop, or ask the user for one.
- **`height` attribute stretches images**: an `<img>` with `height="1200"` keeps that height unless CSS overrides it. If CSS sets only the width, add `height: auto` (or set both, as the build cards do). This caused a stretched hero photo once.
- **Founder photo**: the founder card expects `images/founder.jpg` at 576 × 1024. That file is used as-is and does not need this tool.
- **White PC on a white desk is hard for small models.** For `whiteout.jpg`, `isnet-general-use` kept only 18% of the frame and cut away most of the white case. `birefnet-general-lite` kept the case but dropped the glass side panel. `birefnet-general` kept 63% including the glass, with a ragged right edge, fixed with one `--fill` polygon over the glass panel (66% after the fix).
- **Glass panels**: models often treat glass as background because the wall shows through it. The panel is a simple four-sided shape, so a `--fill` polygon over it is the reliable fix.
- **rembg blanks the colour of removed pixels**, so a filled hole showed black at first. The tool now reapplies the final mask to the original photo to avoid this.
