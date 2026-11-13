# Screenshot a Page

## Objective
Capture screenshots of a web page (full page, or one screen per section) at desktop and phone widths, in light and dark mode, so you can check the layout before sharing or publishing it. The tool also reports console errors and files that failed to load.

## When to use
- After building or changing a page, before publishing or sending it to anyone
- When the user reports something looks broken and you need to see it
- To compare before/after a design change

## Required inputs
- **Target**: a local HTML file (default `index.html`) or an `http(s)://` URL. The site is served locally at `http://127.0.0.1:4321/` (see "Local server" below); prefer that URL so the page loads exactly as a visitor sees it.
- Optional: widths, themes, output folder, sections to scroll to (defaults below)

## Tool
`tools/screenshot.mjs` (Node + Puppeteer). Run from the project root.

```
npm run screenshot                                     # index.html, 1440 + 390 wide, light + dark
node tools/screenshot.mjs <target> [options]
```

| Option | Default | What it does |
|---|---|---|
| `--widths` | `1440,390` | Comma-separated viewport widths. Widths of 600 or less render as a phone (2x pixels, touch, mobile viewport). |
| `--themes` | `light,dark` | Which `prefers-color-scheme` values to emulate. |
| `--height` | `900` | Viewport height. Only matters with `--viewport-only`. |
| `--out` | `.tmp/screenshots` | Output folder. Created if missing. |
| `--viewport-only` | off | Capture only the first screen instead of the full page. |
| `--scroll-to` | none | Comma-separated CSS selectors, e.g. `"#home,#builds,.founder,#contact"`. Captures one viewport-sized shot per selector, scrolled so that element is at the top. Use this instead of a full-page shot for pages with a fixed background or sticky sections (see lessons below). |

Examples:
```
node tools/screenshot.mjs http://127.0.0.1:4321/ --widths 1440 --themes dark --scroll-to "#home,#services,#builds,#process,.founder,#contact"
node tools/screenshot.mjs "http://127.0.0.1:4321/?lang=de" --widths 390 --themes dark --scroll-to "#home,#contact"
```

## Steps
1. Run the tool against the target.
2. Read the issue list printed at the end (see "Reading the output").
3. Open the screenshots that matter for the change. Start with `<name>-1440-light.png` for an overview, then check the phone and dark versions.
4. Fix what you find, then run the tool again to confirm the fix.

## Expected output
- PNG files named `<name>-<width>-<theme>.png` in `.tmp/screenshots/`, for example `index-390-dark.png`. For a URL, `<name>` is the hostname (`127-0-0-1` for the local server).
- With `--scroll-to`, one file per selector, named `<name>-<width>-<theme>-<selector letters>.png`, for example `127-0-0-1-1440-dark-contact.png`.
- A `saved ...` line per file, then a list of issues if any were seen.
- Screenshots are disposable. Regenerate them rather than keeping old ones.

## Reading the output
- **`console: Failed to load resource: ... 404`** (one of them) is expected on the STPcs page until the founder photo is saved as `images/founder.jpg` (576 × 1024). The page shows a placeholder in its place. Any other 404 is a real broken link or image.
- **`scroll-to: no element matches ...`** means a selector passed to `--scroll-to` doesn't exist on the page. Check the spelling or the section id.
- **`script error: ...`** means the page's JavaScript threw. Always fix this.
- **`failed to load: https://fonts...`** means web fonts didn't load, so the screenshot shows fallback fonts. Check the network connection or the font URL.
- Any other `console:` error is worth reading before you publish.

## Edge cases and lessons learned
- **Full-page phone screenshots are very tall** (the portfolio page is about 780 × 10,900 px). Image viewers and Claude's image reader shrink them, so small text becomes unreadable. To inspect detail, use `--viewport-only`, or a single width and theme.
- **The tool waits for the page to settle**: web fonts, every image (lazy images are switched to eager), and finite CSS animations such as the logo entrance. Infinite animations are not waited for, so a page with a looping animation is captured mid-loop.
- **`node: command not found`**: Node was installed with Homebrew at `/opt/homebrew/bin/node`. Make sure `/opt/homebrew/bin` is on the PATH, or reinstall with `brew install node`.
- **Puppeteer can't find Chrome**: Puppeteer uses its own Chrome in `~/.cache/puppeteer`, not the installed Google Chrome. If that cache was cleared, run `npx puppeteer browsers install chrome`.
- **`npm install` warns about install scripts for puppeteer**: npm 11 flags puppeteer's postinstall script, which downloads Chrome. Setup still worked on this machine. If Chrome is missing after a fresh install, run the browser install command above.
- **Paths with spaces** (such as `brand assets/`) work as targets. Wrap them in quotes on the command line.
- **Fixed backgrounds look wrong in full-page shots.** A full-page capture resizes the viewport to the whole page height (about 7,000 px for the STPcs page), so a `position: fixed` background canvas gets stretched across the page and the lower sections look flat black. Visitors never see that. Use `--scroll-to` to check how each section really looks over the background. Full-page shots are still fine for checking overall layout and spacing.
- **Sticky, scroll-driven sections** (the STPcs About statement, whose words light up as you scroll) show their starting state in a full-page shot. `--scroll-to` waits 600 ms after scrolling so these effects settle before capture.
- **The STPcs page is dark only**, so `--themes light` gives the same result as `dark`. Pass `--themes dark` to avoid duplicate files.
- **Page states via the URL**: `?lang=de` opens the German version of the STPcs page. (The archived v2 night-sky site used `?mode=day`.) The screenshot tool can't click buttons, so use these URL parameters to capture other states.
- **Local server**: start it from the project root with `python3 -m http.server 4321 --bind 127.0.0.1` (runs until stopped; stop with `pkill -f "http.server 4321"`). Check it's up with `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4321/`, which should print `200`.

## Checking text and line breaks
`tools/check_text.mjs` loads every page in English and German at six widths (1440 down to 360 px) and lists lone last words, words split across lines, numbers split from their units, text overflowing its box, sideways scrolling, script errors and missing files. Run it after any text change, with the local server running:
```
node tools/check_text.mjs [--pages index.html,builds.html] [--widths 1440,1280,1024,820,390,360]
```
Two-word labels splitting evenly on small phones (e.g. "Whiteout / Build") are reported but fine to leave.
