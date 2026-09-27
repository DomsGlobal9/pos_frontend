/**
 * verify-responsive -- does the till actually reflow when the window changes size?
 *
 *     npm --prefix D:\villy\pos\frontend run dev     (in another terminal)
 *     node scripts/verify-responsive.mjs
 *
 * WHY THIS EXISTS AS A SEPARATE SCRIPT. The browser pane inside the desktop app swaps the viewport
 * WITHOUT dispatching `resize` or `matchMedia` change events -- measured: both counters stayed at
 * zero while `innerWidth` genuinely changed from 1440 to 375. So a device switch there only ever
 * tests the FIRST read, never the live reflow. A tablet rotated from portrait to landscape crosses
 * 768 and 1024, and that path has to be proven somewhere.
 *
 * This drives the real installed Chrome, which does dispatch them.
 *
 * Playwright is borrowed from the Gateway repo rather than added as a dependency of the till: it is
 * a dev-only check, and a headless browser is a heavy thing to put in a PWA's package.json. If that
 * path moves, fix it here.
 */
import { chromium } from 'file:///D:/villy/api-super-admin/node_modules/playwright/index.mjs';

const URL = process.env.POS_URL ?? 'http://localhost:5175/sell';

/** phone and tablet get a bottom bar and one column; desktop gets a left rail and a split. */
const EXPECTED = [
  { width: 375, height: 812, label: 'phone', rail: false, split: false },
  { width: 768, height: 1024, label: 'tablet', rail: false, split: false },
  { width: 1024, height: 800, label: 'desktop, narrowest', rail: true, split: true },
  { width: 1440, height: 900, label: 'desktop', rail: true, split: true },
  { width: 375, height: 812, label: 'back to phone', rail: false, split: false }
];

const shape = (page) => page.evaluate(() => {
  const nav = document.querySelector('nav');
  const main = document.querySelector('main');
  const r = nav.getBoundingClientRect();
  return {
    width: window.innerWidth,
    rail: Math.round(r.left) === 0 && r.height > 400 && r.width < 200,
    split: getComputedStyle(main).gridTemplateColumns.split(' ').length > 1,
    horizontalScroll: document.documentElement.scrollWidth > window.innerWidth
  };
});

let failed = 0;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: 'networkidle' });

console.log('\nverify-responsive\n');

for (const want of EXPECTED) {
  // Resized WITHOUT reloading, deliberately: a reload would only re-test the first read.
  await page.setViewportSize({ width: want.width, height: want.height });
  await page.waitForTimeout(300);
  const got = await shape(page);

  const problems = [];
  if (got.rail !== want.rail) problems.push(`nav should ${want.rail ? '' : 'not '}be a left rail`);
  if (got.split !== want.split) problems.push(`basket should ${want.split ? '' : 'not '}be split`);
  if (got.horizontalScroll) problems.push('page scrolls sideways');

  if (problems.length === 0) {
    console.log(`  ok  ${want.label} (${want.width}px)`);
  } else {
    failed++;
    console.error(`  FAIL  ${want.label} (${want.width}px): ${problems.join('; ')}`);
  }
}

await browser.close();
console.log(failed === 0 ? '\nall sizes reflow correctly\n' : `\n${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
