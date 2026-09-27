/**
 * verify-stock-ui -- the "pieces left" figure on the sell screen moves with sales and returns.
 * Phase 8 (POS side).
 *
 *     (backend on 4007, frontend on 5175, local database running)
 *     node scripts/verify-stock-ui.mjs
 *
 * Before Phase 8 the figure was set once and never changed, so the till said "4 left" of a saree
 * that had sold out. This reads it off the screen, sells one, reads it again, returns it, reads it
 * a third time.
 */
import { chromium } from 'file:///D:/villy/api-super-admin/node_modules/playwright/index.mjs';

const WEB = 'http://localhost:5175';
const API = 'http://localhost:4007/api/v1';

let passed = 0;
let failed = 0;
const ok = (name, condition, detail = '') => {
  if (condition) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.error(`  FAIL  ${name}${detail ? `\n          ${detail}` : ''}`); }
};
async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (!json.success) throw new Error(`${method} ${path}: ${json.message}`);
  return json.data;
}

const shop = await call('GET', '/shop');
const counterId = shop.counters[0].id;
const dup = (await call('GET', '/sales/items?q=DUP-201')).items.find(i => i.code === 'DUP-201');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

async function leftOnScreen() {
  await page.goto(`${WEB}/sell`, { waitUntil: 'networkidle' });
  await page.getByLabel('Find an item').fill('dupatta');
  await page.getByLabel('Find an item').press('Enter');
  await page.getByText('Banarasi dupatta').first().waitFor();
  const row = await page.getByRole('button', { name: /Banarasi dupatta/ }).first().innerText();
  const m = /(\d+) left|last one|none left/.exec(row);
  return m ? (m[1] ? Number(m[1]) : m[0] === 'last one' ? 1 : 0) : null;
}

console.log('\nverify-stock-ui\n');
const start = await leftOnScreen();
ok('the sell screen shows how many are left', typeof start === 'number', String(start));

const sale = await call('POST', '/sales', {
  onceKey: `ui-stock-${Date.now()}`, counterId, lines: [{ itemId: dup.id, qty: 1 }],
  payments: [{ method: 'CASH', amountPaise: dup.pricePaise }]
});
const afterSale = await leftOnScreen();
ok('after selling one, the screen shows one fewer', afterSale === Math.max(0, start - 1) || (start <= 0 && afterSale === 0), `${start} -> ${afterSale}`);

await call('POST', `/returns/bill/${sale.sale.id}`, {
  onceKey: `ui-stock-r-${Date.now()}`, lines: [{ saleLineId: sale.sale.lines[0].id, qty: 1 }],
  reason: 'UI stock test', refund: { method: 'CASH' }, counterId,
  approval: { pin: '2468', reason: 'UI stock test' }
});
const afterReturn = await leftOnScreen();
ok('after it is returned, it is back', afterReturn === start, `${afterSale} -> ${afterReturn}`);

console.log(`\n${passed} passed, ${failed} failed\n`);
await browser.close();
process.exit(failed ? 1 : 0);
