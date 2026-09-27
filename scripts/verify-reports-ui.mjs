/**
 * verify-reports-ui -- the Reports screen, as a cashier and as a manager. Phase 9.
 *
 *     (backend on 4007, frontend on 5175, local database running)
 *     node scripts/verify-reports-ui.mjs [screenshot-folder]
 *
 * The server's figures are proven to reconcile by verify-reports. This proves the screen shows THOSE
 * figures -- the number on the screen is the number the server added up -- and that a cashier gets
 * their own day and no more. The manager half runs against a second backend on 4008 with
 * DEV_ACTOR=dev-manager, as verify-shifts-ui does.
 */
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'file:///D:/villy/api-super-admin/node_modules/playwright/index.mjs';

const WEB = 'http://localhost:5175';
const API = 'http://localhost:4007/api/v1';
const MGR = 'http://localhost:4008/api/v1';
const SHOTS = process.argv[2] ?? null;

let passed = 0;
let failed = 0;
const ok = (name, condition, detail = '') => {
  if (condition) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.error(`  FAIL  ${name}${detail ? `\n          ${detail}` : ''}`); }
};
const get = async (base, path) => (await (await fetch(base + path)).json()).data;
const rupees = (p) => {
  const v = Math.abs(p) / 100;
  return (p < 0 ? '-' : '') + '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: Math.abs(p) % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 });
};

const manager = spawn('npx', ['ts-node', '-T', 'src/server.ts'], {
  cwd: 'D:/villy/pos/backend', shell: true, stdio: 'ignore',
  env: { ...process.env, PORT: '4008', DEV_ACTOR: 'dev-manager', DISABLE_BACKGROUND_JOBS: 'true' }
});
const stopManager = () => { try { execSync(`taskkill /pid ${manager.pid} /T /F`, { stdio: 'ignore' }); } catch {} };
process.on('exit', stopManager);
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${MGR}/health`)).ok) break; } catch {}
  await new Promise(r => setTimeout(r, 1000));
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const text = () => page.locator('body').innerText();
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };

console.log('\nverify-reports-ui\n');

// ============================================================================================
console.log('a cashier');
// ============================================================================================
const mine = await get(API, '/reports');
await page.goto(`${WEB}/reports`, { waitUntil: 'networkidle' });
await page.getByText('Net sales').waitFor();
const t1 = await text();
ok('sees "Your sales today"', t1.includes('Your sales today'));
ok('with no choice of period', !(await page.getByRole('button', { name: 'Last 7 days' }).count()));
ok('the net figure on screen is the server\'s', t1.includes(rupees(mine.sales.netPaise)), rupees(mine.sales.netPaise));
ok('and nothing about cash, dues or day closes', !/cash counts|money owed|day closes/i.test(t1));
ok('told the full reports are for managers', t1.includes('The full reports are for managers and the owner.'));
await shot('reports-cashier');

// ============================================================================================
console.log('\na manager');
// ============================================================================================
await page.route('**/api/v1/**', (route) => route.continue({ url: route.request().url().replace(':5175/api/v1', ':4008/api/v1') }));
await page.goto(`${WEB}/reports`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Last 7 days' }).click();
await page.waitForTimeout(800);
const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
const ymd = (x) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
const from = new Date(); from.setDate(from.getDate() - 6);
const week = await get(MGR, `/reports?from=${ymd(from)}&to=${ymd(d)}`);
const t2 = await text();
ok('sees Reports with a choice of period', /^Reports$/m.test(t2) || t2.includes('Reports'));
ok('the week\'s net sales on screen are the server\'s', t2.includes(rupees(week.sales.netPaise)), rupees(week.sales.netPaise));
ok('bills too', t2.includes(String(week.sales.bills)));
ok('every payment method the server reported is listed', week.paidIn.every(p => t2.includes(rupees(p.amountPaise))));
ok('each cashier is there', week.byCashier.every(c => t2.includes(c.name)));
ok('a GST line for every rate', week.tax.every(t => t2.includes(`${t.rate}%`)));
ok('the cash counts and money owed are shown', /cash counts/i.test(t2) && /money owed on kept orders/i.test(t2));
ok('owed total matches', t2.includes(rupees(week.dues.totalPaise)));
await shot('reports-manager');

await page.getByRole('button', { name: 'Choose dates' }).click();
await page.getByLabel('From').fill('2003-01-01');
await page.getByLabel('To').fill('2003-01-02');
await page.waitForTimeout(800);
ok('a custom range with nothing in it says so, not an error', (await text()).includes('No bills.'));

// ============================================================================================
console.log('\nphone, tablet, desktop');
// ============================================================================================
for (const [label, width, height] of [['phone', 390, 844], ['tablet', 768, 1024], ['desktop', 1440, 900]]) {
  await page.setViewportSize({ width, height });
  await page.goto(`${WEB}/reports`, { waitUntil: 'networkidle' });
  await page.getByText('Net sales').waitFor();
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  ok(`${label}: no sideways scroll`, !sideways);
  await shot(`reports-${label}`);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
await browser.close();
stopManager();
process.exit(failed ? 1 : 0);
