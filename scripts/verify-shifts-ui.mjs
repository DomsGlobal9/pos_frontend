/**
 * verify-shifts-ui -- the drawer and the day, driven through the real screens. Phase 7.
 *
 *     (backend on 4007, frontend on 5175, local database running)
 *     node scripts/verify-shifts-ui.mjs [screenshot-folder]
 *
 * Two people, because the rules differ by who is asking:
 *
 *   - the CASHIER (the dev server on 4007): opens the drawer, records cash in and out, and closes
 *     with a BLIND count -- never shown what the till expects until the count is in
 *   - a MANAGER: a second copy of the backend started here on 4008 with DEV_ACTOR=dev-manager, and
 *     the browser's /api calls routed to it. Sees the expected figure, closes the day.
 *
 * Uses the till's own first counter, so it first closes any shift left open there.
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

async function call(base, method, path, body) {
  const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (!json.success) throw Object.assign(new Error(`${method} ${path}: ${json.message}`), { details: json.details });
  return json.data;
}

// ---- a manager's backend, for the manager half ------------------------------------------------
const manager = spawn('npx', ['ts-node', '-T', 'src/server.ts'], {
  cwd: 'D:/villy/pos/backend', shell: true, stdio: 'ignore',
  env: { ...process.env, PORT: '4008', DEV_ACTOR: 'dev-manager' }
});
const stopManager = () => { try { execSync(`taskkill /pid ${manager.pid} /T /F`, { stdio: 'ignore' }); } catch {} };
process.on('exit', stopManager);
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${MGR}/health`)).ok) break; } catch {}
  await new Promise(r => setTimeout(r, 1000));
}

const shop = await call(API, 'GET', '/shop');
const counter = shop.counters[0];
const run = Date.now();
const key = (n) => `ui-shf-${run}-${n}`;

// Start clean: nothing open on the till's counter.
const before = await call(API, 'GET', `/shifts/counter/${counter.id}`);
if (before.open) await call(MGR, 'POST', `/shifts/${before.open.id}/close`, { countedCashPaise: 0, note: 'Closed before the UI test' });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const text = () => page.locator('body').innerText();
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };

console.log('\nverify-shifts-ui\n');

// ============================================================================================
console.log('no shift open');
// ============================================================================================
await page.goto(`${WEB}/sell`, { waitUntil: 'networkidle' });
ok('the till says so, in words, and still lets you sell', (await text()).includes(`No shift open on ${counter.name}. Cash taken now won't count in any drawer.`)
  && await page.getByLabel('Find an item').isEnabled());
await page.goto(`${WEB}/`, { waitUntil: 'networkidle' });
ok('Home says no shift is open', (await text()).includes('No shift open. Open one before taking cash'));

// ============================================================================================
console.log('\nopening, cash in, cash out');
// ============================================================================================
await page.goto(`${WEB}/shift`, { waitUntil: 'networkidle' });
await page.getByLabel('Opening cash').fill('1000');
await page.getByRole('button', { name: 'Open shift' }).click();
await page.getByText('Open since').waitFor();
ok('the shift opens with the float', (await text()).includes('Float counted in: ₹1,000'));
ok('a cashier is not shown what the drawer should hold', !(await text()).includes('Should be in the drawer'));

await page.goto(`${WEB}/sell`, { waitUntil: 'networkidle' });
ok('the till bar has gone', !(await text()).includes('No shift open'));

// A cash sale at this counter, as the till would make it.
const cotton = (await call(API, 'GET', '/sales/items?q=COT-010')).items.find(i => i.code === 'COT-010');
await call(API, 'POST', '/sales', { onceKey: key('sale'), counterId: counter.id, lines: [{ itemId: cotton.id, qty: 1 }], payments: [{ method: 'CASH', amountPaise: 129900, tenderedPaise: 150000 }] });

await page.goto(`${WEB}/shift`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Cash in' }).click();
await page.getByLabel('Amount').fill('500');
await page.getByRole('button', { name: 'Change float top-up' }).click();
await page.getByRole('button', { name: 'Record' }).click();
await page.getByText('+₹500').waitFor();
ok('cash in is listed with its reason', (await text()).includes('Change float top-up'));

await page.getByRole('button', { name: 'Cash out' }).click();
await page.getByLabel('Amount').fill('200');
await page.getByRole('button', { name: 'Courier' }).click();
await page.getByRole('button', { name: 'Record' }).click();
await page.getByText('Manager approval needed').waitFor();
ok('a cashier taking cash out gets the manager sheet, saying exactly what', (await text()).includes('Taking ₹200 out of the drawer for "Courier".'));
await page.getByLabel('Reason', { exact: true }).fill('Courier for the Anna Nagar order');
await page.getByLabel('Manager PIN').fill('2468');
await page.getByRole('button', { name: 'Approve' }).click();
await page.getByText('−₹200').waitFor();
ok('and once approved it is listed', (await text()).includes('Courier'));
await shot('shift-cashier');

// ============================================================================================
console.log('\nthe blind close');
// ============================================================================================
await page.getByRole('button', { name: 'Close shift' }).click();
await page.getByLabel('Counted cash').fill('2000');
await page.getByRole('button', { name: 'Close shift' }).last().click();
await page.getByLabel('What happened').waitFor();
const mismatch = await page.getByRole('dialog', { name: 'Close shift' }).innerText() + (await page.locator('[role=status]').allInnerTexts()).join(' ');
ok('a wrong count is refused', mismatch.includes("That count doesn't match what the till expects"));
ok('without giving away the figure to aim for', !mismatch.includes('2,599'));
await page.getByLabel('Counted cash').fill('2599');
await page.getByRole('button', { name: 'Close shift' }).last().click();
await page.getByText('Shift closed').waitFor();
const closed = await text();
ok('counting again, correctly, closes it', closed.includes('The till expected') && closed.includes('₹2,599'));
ok('and the difference is exact', closed.includes('Exact'));
await shot('shift-closed');
await page.getByRole('button', { name: 'Done' }).click();
await page.getByLabel('Opening cash').waitFor();
ok('the closed shift is listed, with its result', (await text()).includes('Recent shifts') && (await text()).includes('Exact'));
ok('and its count is offered as the next float', (await page.getByLabel('Opening cash').inputValue()) === '2599');

// ============================================================================================
console.log('\nthe manager');
// ============================================================================================
await page.route('**/api/v1/**', (route) => route.continue({ url: route.request().url().replace(':5175/api/v1', ':4008/api/v1') }));

await page.goto(`${WEB}/shift`, { waitUntil: 'networkidle' });
await page.getByLabel('Opening cash').fill('500');
await page.getByRole('button', { name: 'Open shift' }).click();
await page.getByText('Open since').waitFor();
ok('a manager sees what the drawer should hold', (await text()).includes('Should be in the drawer'));

// A past day of our own, with one sale on it and a shift left open, so the close has something to say.
const base = new Date(2001, 0, 1); base.setDate(base.getDate() + (run % 8000));
const pad = (n) => String(n).padStart(2, '0');
const date = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
const daySale = await call(MGR, 'POST', '/sales', { onceKey: key('day-sale'), counterId: counter.id, lines: [{ itemId: cotton.id, qty: 1 }], payments: [{ method: 'UPI', amountPaise: 129900, reference: 'UPI-DAY' }] });
execSync(
  `npx ts-node -T -e "const {prisma}=require('./src/lib/prisma');const at=new Date(${base.getFullYear()},${base.getMonth()},${base.getDate()},11);` +
  `const late=new Date(${base.getFullYear()},${base.getMonth()},${base.getDate()},18);` +
  // The manager's open shift is moved to that evening too -- a drawer left open since that day,
  // which is exactly what the close has to call out.
  `Promise.all([prisma.sale.update({where:{id:'${daySale.sale.id}'},data:{createdAt:at}}),prisma.payment.updateMany({where:{saleId:'${daySale.sale.id}'},data:{createdAt:at}}),` +
  `prisma.shift.updateMany({where:{counterId:'${counter.id}',closedAt:null},data:{openedAt:late}})]).then(()=>process.exit(0))"`,
  { cwd: 'D:/villy/pos/backend', stdio: 'ignore' }
);

await page.goto(`${WEB}/day-close`, { waitUntil: 'networkidle' });
await page.getByLabel('Day').fill(date);
await page.getByText('Net sales').waitFor();
await page.waitForTimeout(500);
const dayText = await text();
ok('the day shows its sale, paid by UPI', dayText.includes('₹1,299') && dayText.includes('UPI'));
ok('and names the shift still open', dayText.includes(`${counter.name} is still open`));
await shot('day-close-manager');

page.once('dialog', async (dialog) => {
  ok('closing with a shift open asks, in words', /still open.*Close the day anyway\?/s.test(dialog.message()), dialog.message());
  await dialog.accept();
});
await page.getByRole('button', { name: 'Close the day' }).click();
await page.getByText(/^Closed by Meena/).waitFor();
const closedDay = await text();
ok('the closed day names who closed it, and that a shift was left open', /Closed by Meena.*1 shift was still open/s.test(closedDay));
ok('and there is no second Close button', !(await page.getByRole('button', { name: 'Close the day' }).count()));

// Leave the manager's shift closed.
const mgrShift = await call(MGR, 'GET', `/shifts/counter/${counter.id}`);
if (mgrShift.open) await call(MGR, 'POST', `/shifts/${mgrShift.open.id}/close`, { countedCashPaise: mgrShift.open.figures.expectedPaise });
await page.unroute('**/api/v1/**');

// ============================================================================================
console.log('\nthe cashier, on the day close');
// ============================================================================================
await page.goto(`${WEB}/day-close`, { waitUntil: 'networkidle' });
await page.getByText('Net sales').waitFor();
ok('a cashier can read the day but not close it', (await text()).includes('Only a manager or the owner can close the day.'));

// ============================================================================================
console.log('\nphone, tablet, desktop');
// ============================================================================================
for (const [label, width, height] of [['phone', 375, 812], ['tablet', 768, 1024], ['desktop', 1440, 900]]) {
  await page.setViewportSize({ width, height });
  for (const path of ['/shift', '/day-close', '/sell']) {
    await page.goto(`${WEB}${path}`, { waitUntil: 'networkidle' });
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    ok(`${label}: ${path} does not scroll sideways`, !sideways);
  }
  await page.goto(`${WEB}/shift`, { waitUntil: 'networkidle' });
  const btn = await page.getByRole('button', { name: 'Open shift' }).boundingBox();
  ok(`${label}: Open shift is on screen`, btn && btn.y + btn.height <= height, JSON.stringify(btn));
  await shot(`shift-${label}`);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
await browser.close();
stopManager();
process.exit(failed ? 1 : 0);
