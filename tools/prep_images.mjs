#!/usr/bin/env node
// Resize photos for the web and, optionally, remove a solid green backdrop (chroma key).
// Runs the image work inside headless Chrome (Puppeteer), so no Python image libraries are needed.
//
// Usage:
//   node tools/prep_images.mjs <input...> --out images [--height 1200] [--key-green] [--quality 0.86] [--fit 0.88,0.78]
//
// --fit w,h (for cut-outs that already have a transparent background): trims the empty space around the
// subject, then centres it on a 3:4 canvas (--height tall), as large as fits inside w × h of the canvas.
// 0.88,0.78 matches the framing of the existing build photos.
//
// Output: <out>/<name>.webp for each input. With --key-green the backdrop becomes transparent.
// Prints, per file, the output size and the share of pixels that were keyed out.

import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, basename, extname, join } from 'node:path';
import puppeteer from 'puppeteer';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string', default: 'images' },
    height: { type: 'string', default: '1200' },
    quality: { type: 'string', default: '0.86' },
    'key-green': { type: 'boolean', default: false },
    fit: { type: 'string', default: '' },
  },
});
if (!positionals.length) {
  console.error('usage: node tools/prep_images.mjs <input...> --out images [--height 1200] [--key-green]');
  process.exit(1);
}

const outDir = resolve(values.out);
await mkdir(outDir, { recursive: true });
const browser = await puppeteer.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><title>prep</title>');
  for (const input of positionals) {
    const ext = extname(input).slice(1).toLowerCase().replace('jpg', 'jpeg');
    const dataUrl = `data:image/${ext};base64,${(await readFile(resolve(input))).toString('base64')}`;
    const fit = values.fit ? values.fit.split(',').map(Number) : null;
    const result = await page.evaluate(async (src, maxH, key, quality, fit) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      let c, g, w, h;
      if (fit) {
        // find the subject: the box around every pixel that is more than faintly visible
        const full = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
        const fg = full.getContext('2d');
        fg.drawImage(img, 0, 0);
        const px = fg.getImageData(0, 0, full.width, full.height).data;
        let l = full.width, t = full.height, r = -1, b = -1;
        for (let y = 0; y < full.height; y++) for (let x = 0; x < full.width; x++) {
          if (px[(y * full.width + x) * 4 + 3] > 8) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
        }
        const bw = r - l + 1, bh = b - t + 1;
        h = maxH; w = Math.round(maxH * 3 / 4);
        const s = Math.min(fit[0] * w / bw, fit[1] * h / bh);
        c = new OffscreenCanvas(w, h);
        g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(full, l, t, bw, bh, (w - bw * s) / 2, (h - bh * s) / 2, bw * s, bh * s);
      } else {
        const scale = Math.min(1, maxH / img.naturalHeight);
        w = Math.round(img.naturalWidth * scale); h = Math.round(img.naturalHeight * scale);
        c = new OffscreenCanvas(w, h);
        g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, w, h);
      }
      let keyed = 0;
      if (key) {
        const data = g.getImageData(0, 0, w, h);
        const p = data.data;
        // A pixel is backdrop when green leads red and blue by a large share of its own brightness.
        // Using a share (not an absolute gap) also catches the dark green at the top of a gradient backdrop.
        // Very dark pixels carry little colour, so they get a lower threshold (otherwise a faint box remains).
        const n = w * h;
        const tGreen = new Float32Array(n), tTeal = new Float32Array(n);
        for (let k = 0; k < n; k++) {
          const i = k * 4, r = p[i], gr = p[i + 1], b = p[i + 2];
          const lead = gr - Math.max(r, b);
          const share = gr > 3 ? lead / gr : 0;
          const lo = gr < 48 ? .07 : .16, hi = gr < 48 ? .18 : .30;
          tGreen[k] = Math.min(1, Math.max(0, (share - lo) / (hi - lo)));
          // The dark top of a gradient backdrop is teal, not green (e.g. 21,38,37): green and blue tie, red lags.
          // Only dark pixels qualify, so blue LEDs and neutral parts are kept.
          const teal = Math.min(gr, b) - r;
          if (Math.max(r, gr, b) < 80 && teal > 6) tTeal[k] = Math.min(1, (teal - 6) / 8);
        }
        // The teal rule alone would also hit dark tinted glass inside a case. The backdrop always touches the
        // photo's edge, so teal only counts where it connects to the border through backdrop-like pixels.
        const reach = new Uint8Array(n), queue = new Int32Array(n);
        let head = 0, tail = 0;
        const isBack = (k) => tGreen[k] > .3 || tTeal[k] > .3;
        const seed = (k) => { if (!reach[k] && isBack(k)) { reach[k] = 1; queue[tail++] = k; } };
        for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
        for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
        while (head < tail) {
          const k = queue[head++], x = k % w;
          if (x > 0) seed(k - 1);
          if (x < w - 1) seed(k + 1);
          if (k >= w) seed(k - w);
          if (k < n - w) seed(k + w);
        }
        for (let k = 0; k < n; k++) {
          const i = k * 4, r = p[i], gr = p[i + 1], b = p[i + 2];
          const t = reach[k] ? Math.max(tGreen[k], tTeal[k]) : tGreen[k];
          const a = 1 - t * t * (3 - 2 * t); // smoothstep: soft edge between subject and backdrop
          if (a < 1) keyed += 1 - a;
          p[i + 3] = Math.round(p[i + 3] * a);
          if (gr > Math.max(r, b)) p[i + 1] = Math.max(r, b); // despill: strip the green cast from edges
        }
        g.putImageData(data, 0, 0);
      }
      if (key || fit) {
        // clear near-invisible leftovers in the backdrop: they show up as a faint box once a shadow is applied
        const data = g.getImageData(0, 0, w, h);
        const p = data.data;
        for (let i = 3; i < p.length; i += 4) if (p[i] < 14) p[i] = 0;
        g.putImageData(data, 0, 0);
      }
      const blob = await c.convertToBlob({ type: 'image/webp', quality });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { b64: btoa(bin), w, h, keyed: keyed / (w * h) };
    }, dataUrl, Number(values.height), values['key-green'], Number(values.quality), fit);

    const file = join(outDir, `${basename(input, extname(input))}.webp`);
    await writeFile(file, Buffer.from(result.b64, 'base64'));
    const kb = Math.round(Buffer.byteLength(result.b64, 'base64') / 1024);
    const keyedNote = values['key-green'] ? `, ${(result.keyed * 100).toFixed(0)}% keyed out` : '';
    console.log(`saved ${file} (${result.w}x${result.h}, ${kb} KB${keyedNote})`);
  }
} finally {
  await browser.close();
}
