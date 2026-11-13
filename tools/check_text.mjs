#!/usr/bin/env node
// Check the site's text at several widths and in both languages:
// lone last words, words split mid-word, numbers split from their units, text overflowing its box,
// sideways page scrolling, script errors and missing files.
//
// Usage (with the local server running, see workflows/screenshot_page.md):
//   node tools/check_text.mjs [--base http://127.0.0.1:4321] [--pages index.html,builds.html] [--widths 1440,1280,1024,820,390,360]
//
// Prints one line per problem with the widths it appears at. Two-word labels splitting evenly
// (e.g. "Whiteout / Build" on a small phone) are reported too; those are fine to leave.

import { parseArgs } from 'node:util';
import puppeteer from 'puppeteer';

const { values } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://127.0.0.1:4321' },
    pages: { type: 'string', default: 'index.html,builds.html' },
    widths: { type: 'string', default: '1440,1280,1024,820,390,360' },
  },
});

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
const loadProblems = new Set();
page.on('pageerror', (e) => loadProblems.add('script error: ' + e.message));
page.on('response', (r) => {
  // founder.jpg is expected to be missing until the photo is added
  if (r.status() >= 400 && !r.url().includes('founder.jpg')) loadProblems.add(`${r.status()} ${r.url()}`);
});

const issues = new Map();
try {
  for (const file of values.pages.split(',')) for (const lang of ['en', 'de']) for (const w of values.widths.split(',').map(Number)) {
    await page.setViewport({ width: w, height: 900 });
    await page.goto(`${values.base}/${file}?lang=${lang}`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    const found = await page.evaluate(() => {
      const out = [];
      if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth}px wide)`);
      const els = document.querySelectorAll('p, h1, h2, h3, h4, dd, dt, li, small, label, .btn, .notch a, .sheet a, .bp-tile span, .svc-cta, .back-link');
      for (const el of els) {
        if (el.closest('.sr-only, [aria-hidden="true"]') || !el.getClientRects().length) continue;
        if (el.matches('li') && el.querySelector('p, a, button')) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden') continue;
        // every word with the line it sits on
        const words = [];
        const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        while (walk.nextNode()) {
          const t = walk.currentNode, re = /\S+/g;
          let m;
          while ((m = re.exec(t.data))) {
            const r = document.createRange();
            r.setStart(t, m.index);
            r.setEnd(t, m.index + m[0].length);
            const rects = r.getClientRects();
            if (rects.length) words.push({ w: m[0], top: Math.round(rects[0].top), parts: rects.length });
          }
        }
        if (words.length < 2) continue;
        const lines = [];
        for (const wd of words) {
          const last = lines[lines.length - 1];
          if (last && Math.abs(last.top - wd.top) < 4) last.ws.push(wd.w);
          else lines.push({ top: wd.top, ws: [wd.w] });
        }
        const label = `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''} "${el.textContent.trim().replace(/\s+/g, ' ').slice(0, 50)}"`;
        if (words.some((x) => x.parts > 1)) out.push(`word split across lines: ${label}`);
        if (lines.length >= 2 && lines[lines.length - 1].ws.length === 1 && !el.matches('.name, .name-ghost')) {
          out.push(`lone last word "${lines[lines.length - 1].ws[0]}": ${label}`);
        }
        for (let i = 0; i < lines.length - 1; i++) {
          const end = lines[i].ws[lines[i].ws.length - 1], start = lines[i + 1].ws[0];
          if (/^\d+$/.test(end) && /^(GB|TB|W|mm|XT)\b/.test(start)) out.push(`number split from unit "${end} | ${start}": ${label}`);
        }
        if (el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible') out.push(`text overflows its box: ${label}`);
      }
      return out;
    });
    for (const f of found) {
      const key = `${file} ${lang}: ${f}`;
      if (!issues.has(key)) issues.set(key, []);
      issues.get(key).push(w);
    }
  }
} finally {
  await browser.close();
}

for (const [k, ws] of issues) console.log(`${k}  @ ${ws.join(', ')}`);
console.log(issues.size ? `${issues.size} text issue(s)` : 'no text issues');
console.log(loadProblems.size ? [...loadProblems].join('\n') : 'no script errors or missing files');
