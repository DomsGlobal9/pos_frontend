/**
 * verify-offline-ui -- the line drops at the counter, and nothing is lost or charged twice. Phase 11.
 *
 *     (backend on 4007, frontend on 5175, local database running)
 *     node scripts/verify-offline-ui.mjs [screenshot-folder]
 *
 * Real Chrome, real server, and the line cut for real (Playwright's offline switch, which fails
 * every request the way a dropped Wi-Fi does). The database is read directly to count bills: the
 * screen saying "sent" is not proof that there is exactly one.
 *
 *   A  offline when Complete is pressed: kept on the till, sent by itself when the line is back
 *   B  the reply is lost (the sale DID arrive): kept, survives a reload, sent again -- still one bill
 *   C  the price changed while it waited: "needs a look" in plain words; the shift close and the
 *      day close both say something is waiting; Open in till brings the basket back with its key
 *   D  Remove, with the confirm answered no and then yes; nothing reaches the server
 *   and the Sync screen fits a phone, a tablet and a desktop
 */
import { spawn, execSync, execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
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
async function call(base, method, p, body) {
  const res = await fetch(base + p, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (!json.success) throw new Error(`${method} ${p}: ${json.message}`);
  return json.data;
}

// Straight to the database: how many bills really exist for a once-key.
const helper = path.join(os.tmpdir(), `pos-offline-db-${Date.now()}.cjs`);
fs.writeFileSync(helper, `
const { PrismaClient } = require('D:/villy/pos/backend/node_modules/@prisma/client');
const p = new PrismaClient();
const [cmd, a, b] = process.argv.slice(2);
(async () => {
  let out;
  if (cmd === 'sales') out = await p.sale.findMany({ where: { onceKey: a }, select: { id: true, invoiceNo: true, createdAt: true, madeOfflineAt: true } });
  if (cmd === 'price') out = await p.item.updateMany({ where: { code: a }, data: { pricePaise: Number(b) } });
  if (cmd === 'getprice') out = (await p.item.findFirst({ where: { code: a }, select: { pricePaise: true } })).pricePaise;
  process.stdout.write(JSON.stringify(out));
  await p.$disconnect();
})();
`);
const db = (...args) => JSON.parse(execFileSync('node', [helper, ...args], { cwd: 'D:/villy/pos/backend', encoding: 'utf8' }));

const managerServer = spawn('npx', ['ts-node', '-T', 'src/server.ts'], {
  cwd: 'D:/villy/pos/backend', shell: true, stdio: 'ignore',
  env: { ...process.env, PORT: '4008', DEV_ACTOR: 'dev-manager', DISABLE_BACKGROUND_JOBS: 'true' }
});
const stop = () => { try { execSync(`taskkill /pid ${managerServer.pid} /T /F`, { stdio: 'ignore' }); } catch {} try { fs.unlinkSync(helper); } catch {} };
process.on('exit', stop);
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${MGR}/health`)).ok) break; } catch {}
  await new Promise(r => setTimeout(r, 1000));
}

const shop = await call(API, 'GET', '/shop');
const counterId = shop.counters[0].id;
const blousePrice = db('getprice', 'BLO-101');
const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

// A shift on the counter, so the close sheet can be checked. Opened here only if none is.
const shiftBefore = await call(API, 'GET', `/shifts/counter/${counterId}`);
const openedShift = shiftBefore.open ? null : (await call(API, 'POST', '/shifts', { counterId, openingCashPaise: 100000 })).open?.id ?? (await call(API, 'GET', `/shifts/counter/${counterId}`)).open.id;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
page.on('dialog', d => (page.__answer === false ? d.dismiss() : d.accept()));
const text = () => page.locator('body').innerText();
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
const outbox = () => page.evaluate(() => JSON.parse(localStorage.getItem('pos.outbox.v1') ?? '[]'));
const chip = () => page.getByRole('link', { name: /waiting to send/ });
const basketLines = () => page.evaluate(() => (JSON.parse(localStorage.getItem('pos.basket.v2') ?? '{}').lines ?? []).length);
const until = async (fn, ms = 20_000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await page.waitForTimeout(250); } return false; };

async function sell(code) {
  await page.goto(`${WEB}/sell`, { waitUntil: 'networkidle' });
  await page.getByLabel('Find an item').fill(code);
  await page.getByLabel('Find an item').press('Enter');
  await page.getByRole('button', { name: 'Take payment' }).waitFor();
  await page.getByRole('button', { name: 'Take payment' }).click();
  await page.getByRole('button', { name: 'Complete sale' }).waitFor();
}

console.log('\nverify-offline-ui\n');
try {
  // ============================================================================================
  console.log('A  the line drops as Complete is pressed');
  // ============================================================================================
  await sell('COT-010');
  await context.setOffline(true);
  const pressedAt = Date.now();
  await page.getByRole('button', { name: 'Complete sale' }).click();
  await page.getByText('Sale saved on this till').waitFor();
  const t = await text();
  ok('POS-OFF-002 the sale is kept on the till, said plainly', t.includes('the bill number comes when the sale is sent'));
  ok('no error code, no "failed", no "network" on the screen', !/\b(4\d\d|5\d\d)\b|failed|network|ERR_/i.test(t), t.slice(0, 300));
  let box = await outbox();
  const keyA = box[0]?.onceKey;
  ok('one sale in the outbox, with its once-key and the time it was made', box.length === 1 && !!keyA && !!box[0].body.madeOfflineAt);
  ok('nothing on the server yet', db('sales', keyA).length === 0);
  ok('POS-SYNC-003 the header says it is waiting, not "All saved"', await chip().isVisible() && !(await text()).includes('All saved'));
  await shot('p11-saved-on-till');

  await page.getByRole('button', { name: 'Next sale' }).click();
  ok('the counter is clear for the next customer', await until(async () => (await basketLines()) === 0, 5000) && (await outbox()).length === 1);

  await chip().click();
  await page.getByRole('heading', { name: 'Waiting to sync' }).waitFor();
  const st = await text();
  ok('POS-SYNC-004 the Sync screen lists it: item, amount, how paid, when', st.includes('1 sale on this till') && /Cotton|COT/i.test(st) && st.includes('Cash') && st.includes('Made'), st.slice(0, 400));
  ok('the word "outbox" or "hold" is never shown', !/outbox|\bhold\b|queue/i.test(st));
  await shot('p11-sync-waiting');

  await context.setOffline(false);
  ok('the line is back: it goes by itself', await until(async () => (await outbox()).length === 0));
  let rows = db('sales', keyA);
  ok('exactly one bill for that sale', rows.length === 1, JSON.stringify(rows));
  ok('dated when the customer paid, not when it was sent', rows[0] && Math.abs(new Date(rows[0].createdAt).getTime() - pressedAt) < 5000 && !!rows[0].madeOfflineAt);
  await page.getByText('Everything is sent').waitFor();
  const sentText = await text();
  ok('the Sync screen shows the bill number it got', sentText.includes(rows[0].invoiceNo) && /sent from this till/i.test(sentText), sentText.slice(0, 400));
  ok('the header is back to "All saved"', await until(async () => (await text()).includes('All saved')));
  await page.getByRole('link', { name: rows[0].invoiceNo }).click();
  await page.waitForURL(/\/bills\//);
  ok('and the number opens the bill', await until(async () => !(await text()).includes('Opening the bill') && (await text()).includes(rows[0].invoiceNo), 10_000));
  await shot('p11-sync-sent');

  // ============================================================================================
  console.log('\nB  the sale arrives but the reply is lost');
  // ============================================================================================
  let lost = null;
  const isSale = (url) => new URL(url).pathname === '/api/v1/sales';
  const lose = async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    if (!lost) { lost = (await (await route.fetch()).json()).data.sale; }
    return route.abort('connectionreset');
  };
  await page.route(isSale, lose);
  await sell('BLO-101');
  await page.getByRole('button', { name: 'Complete sale' }).click();
  await page.getByText('Sale saved on this till').waitFor();
  box = await outbox();
  const keyB = box[0]?.onceKey;
  ok('the server made the bill, the till never heard', !!lost && db('sales', keyB).length === 1);
  ok('the till kept it to send again', box.length === 1);
  await page.reload({ waitUntil: 'networkidle' });
  ok('a reload loses nothing: still waiting', (await outbox()).length === 1 && await chip().isVisible());
  await page.unroute(isSale, lose);
  await chip().click();
  await page.getByRole('button', { name: 'Send now' }).click();
  ok('Send now sends it', await until(async () => (await outbox()).length === 0));
  rows = db('sales', keyB);
  ok('still exactly one bill -- the second send got the first bill back', rows.length === 1, JSON.stringify(rows));
  await page.getByText('Everything is sent').waitFor();
  ok('with the number the server gave the first time', (await text()).includes(lost.invoiceNo) && rows[0]?.invoiceNo === lost.invoiceNo);

  // ============================================================================================
  console.log('\nC  the price changes while the sale waits');
  // ============================================================================================
  await sell('BLO-101');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Complete sale' }).click();
  await page.getByText('Sale saved on this till').waitFor();
  const keyC = (await outbox())[0]?.onceKey;
  db('price', 'BLO-101', String(blousePrice + 5000));
  const pendingBase = (await call(MGR, 'GET', `/day-close/${todayStr}`)).live.pendingSync;
  await page.getByRole('button', { name: 'Next sale' }).click();
  await context.setOffline(false);
  ok('the server refuses it: it needs a look', await until(async () => (await outbox())[0]?.state === 'needs_attention'));
  await page.goto(`${WEB}/sync`, { waitUntil: 'networkidle' });
  await page.getByText('Needs a look', { exact: true }).first().waitFor();
  const why = await page.locator('li[data-once-key] p').first().innerText();
  ok('why, in the server\'s own plain words', why.length > 10 && !/\b(409|400|422)\b|Error|undefined|code/i.test(why), why);
  ok('nothing was charged', db('sales', keyC).length === 0);
  await shot('p11-needs-a-look');

  // POS-DAY-004: the device told the server; the day close counts it.
  ok('the till tells the server what it is holding', await until(async () => (await call(MGR, 'GET', `/day-close/${todayStr}`)).live.pendingSync === pendingBase + 1, 10_000));
  await page.route('**/api/v1/**', route => route.continue({ url: route.request().url().replace(':5175/api/v1', ':4008/api/v1') }));
  await page.goto(`${WEB}/day-close`, { waitUntil: 'networkidle' });
  ok('the day close says a sale is waiting on a till', /still waiting to send from a till/.test(await text()));
  await shot('p11-day-close');
  await page.unroute('**/api/v1/**');

  // The drawer: its expected figure is short by what has not been sent.
  await page.goto(`${WEB}/shift`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Close shift' }).click();
  await page.getByText('Count the drawer').waitFor();
  ok('closing the shift warns that a sale has not been sent', (await text()).includes('1 sale on this till has not been sent yet'));
  await shot('p11-shift-close');
  await page.getByRole('button', { name: 'Back' }).click();

  // Open in till, while a different sale is in progress: refused, nothing lost.
  await page.goto(`${WEB}/sell`, { waitUntil: 'networkidle' });
  await page.getByLabel('Find an item').fill('COT-010');
  await page.getByLabel('Find an item').press('Enter');
  ok('(a different sale is in progress on the Sell screen)', await until(async () => (await basketLines()) > 0, 10_000));
  await page.goto(`${WEB}/sync`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open in till' }).first().click();
  await page.getByText(/sale in progress/).waitFor();
  ok('Open in till over a sale in progress: refused, both kept', (await outbox()).length === 1 && page.url().endsWith('/sync'));
  await page.goto(`${WEB}/sell`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Clear bill' }).click();

  await page.goto(`${WEB}/sync`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open in till' }).first().click();
  await page.waitForURL(/\/sell$/);
  await page.getByRole('button', { name: 'Take payment' }).waitFor();
  ok('Open in till brings the basket back', /Blouse|BLO/i.test(await text()));
  ok('and takes it off the waiting list', (await outbox()).length === 0);
  ok('with its own once-key', await page.evaluate(k => JSON.parse(localStorage.getItem('pos.basket.v2') ?? '{}').onceKey === k, keyC));
  db('price', 'BLO-101', String(blousePrice));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Take payment' }).click();
  await page.getByRole('button', { name: 'Complete sale' }).click();
  await page.getByRole('button', { name: 'Next sale' }).waitFor();
  ok('completed from the till: one bill, under the same key', db('sales', keyC).length === 1);
  await page.getByRole('button', { name: 'Next sale' }).click();

  // ============================================================================================
  console.log('\nD  Remove');
  // ============================================================================================
  await sell('COT-010');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Complete sale' }).click();
  await page.getByText('Sale saved on this till').waitFor();
  const keyD = (await outbox())[0]?.onceKey;
  await page.getByRole('link', { name: 'See what is waiting' }).click();
  await page.getByRole('heading', { name: 'Waiting to sync' }).waitFor();

  for (const [w, h, name] of [[390, 844, 'phone'], [768, 1024, 'tablet'], [1366, 900, 'desktop']]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(200);
    ok(`the Sync screen fits a ${name} with no sideways scroll`, !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)));
    if (name === 'phone') await shot('p11-sync-phone');
  }

  page.__answer = false;
  await page.getByRole('button', { name: 'Remove' }).click();
  ok('Remove, answered "no": still there', (await outbox()).length === 1);
  page.__answer = true;
  await page.getByRole('button', { name: 'Remove' }).click();
  await page.getByText('Everything is sent').waitFor();
  ok('Remove, answered "yes": gone', (await outbox()).length === 0);
  await context.setOffline(false);
  await page.waitForTimeout(1500);
  ok('and it never reaches the server', db('sales', keyD).length === 0);
} finally {
  db('price', 'BLO-101', String(blousePrice));
  if (openedShift) {
    try { await call(API, 'POST', `/shifts/${openedShift}/close`, { countedCashPaise: 0, note: 'Closed by the offline UI test' }); } catch (e) { console.error('  (could not close the test shift)', e.message); }
  }
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed\n`);
stop();
process.exit(failed ? 1 : 0);
