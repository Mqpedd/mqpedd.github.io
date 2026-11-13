#!/usr/bin/env node
// Capture full-page screenshots of a page at several widths, in light and dark mode.
//
// Usage:
//   node tools/screenshot.mjs [target] [--widths 1440,390] [--themes light,dark] [--out .tmp/screenshots] [--viewport-only]
//                             [--scroll-to "#about,#contact"]
//
// --scroll-to captures one viewport-sized shot per selector, scrolled to that element. Use it for pages with
// fixed backgrounds or sticky sections, which a full-page shot stretches or flattens.
//
// target is a local file (default: index.html) or an http(s) URL.
// Files are written as <out>/<name>-<width>-<theme>.png. Console errors and failed loads are listed afterwards.

import { parseArgs } from 'node:util';
import { mkdir } from 'node:fs/promises';
import { resolve, basename, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    widths: { type: 'string', default: '1440,390' },
    themes: { type: 'string', default: 'light,dark' },
    height: { type: 'string', default: '900' },
    out: { type: 'string', default: '.tmp/screenshots' },
    'viewport-only': { type: 'boolean', default: false },
    'scroll-to': { type: 'string', default: '' },
  },
});

const target = positionals[0] ?? 'index.html';
const isUrl = /^(https?|file):/.test(target);
const url = isUrl ? target : pathToFileURL(resolve(target)).href;
const name = isUrl ? new URL(target).hostname.replace(/\W+/g, '-') : basename(target, extname(target));
const widths = values.widths.split(',').map(Number).filter(Boolean);
const themes = values.themes.split(',').map((t) => t.trim()).filter(Boolean);
const height = Number(values.height);
const outDir = resolve(values.out);
const PHONE_MAX = 600;

await mkdir(outDir, { recursive: true });
const browser = await puppeteer.launch({ headless: true });
const problems = new Set();

try {
  for (const width of widths) {
    for (const theme of themes) {
      const page = await browser.newPage();
      page.on('console', (msg) => { if (msg.type() === 'error') problems.add(`console: ${msg.text()}`); });
      page.on('pageerror', (err) => problems.add(`script error: ${err.message}`));
      page.on('requestfailed', (req) => problems.add(`failed to load: ${req.url()} (${req.failure()?.errorText})`));

      const phone = width <= PHONE_MAX;
      await page.setViewport({ width, height, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });

      // Load lazy images and web fonts, then let entrance animations finish so the shot shows the resting state.
      await page.evaluate(async () => {
        document.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
        await document.fonts.ready;
        await Promise.all(Array.from(document.images, (img) =>
          img.complete ? null : new Promise((done) => { img.addEventListener('load', done); img.addEventListener('error', done); })));
        await Promise.all(document.getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => {})));
      });

      const targets = values['scroll-to'].split(',').map((s) => s.trim()).filter(Boolean);
      if (targets.length) {
        for (const selector of targets) {
          const found = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return false;
            document.documentElement.style.scrollBehavior = 'auto';
            window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY);
            return true;
          }, selector);
          if (!found) { problems.add(`scroll-to: no element matches ${selector}`); continue; }
          await new Promise((done) => setTimeout(done, 600)); // let scroll-driven effects settle
          const file = join(outDir, `${name}-${width}-${theme}-${selector.replace(/\W+/g, '')}.png`);
          await page.screenshot({ path: file });
          console.log(`saved ${file}`);
        }
      } else {
        const file = join(outDir, `${name}-${width}-${theme}.png`);
        await page.screenshot({ path: file, fullPage: !values['viewport-only'] });
        console.log(`saved ${file}`);
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (problems.size) {
  console.log(`\n${problems.size} issue(s) seen while loading:`);
  for (const problem of problems) console.log(`  - ${problem}`);
}
