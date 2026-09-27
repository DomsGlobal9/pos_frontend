/**
 * verify-returns-ui -- returns and exchanges driven through the real screens. Phase 6.
 *
 *     (backend on 4007, frontend on 5175, local database running)
 *     node scripts/verify-returns-ui.mjs [screenshot-folder]
 *
 * The backend suite (verify-returns) proves the rules. This proves a cashier can actually USE them:
 * that the buttons are where a person would look, that a manager's PIN appears in place, that the
 * figure on the screen is the figure on the credit note, and that a refusal is explained on the
 * screen BEFORE anyone presses the button.
 *
 * Bills are set up through the API (as the till would make them), then everything that matters is
 * done with clicks and typing in real Chrome. Uses the dev cashier, so every return needs a PIN.
 */
import { execSync } from 'node:child_process';
import { chromium } from 'file:///D:/villy/api-super-admin/node_modules/playwright/index.mjs';

const WEB = 'http://localhost:5175';
const API = 'http://localhost:4007/api/v1';
const SHOTS = process.argv[2] ?? null;
const PIN = { pin: '2468', reason: 'Set up by the UI test' };

let passed = 0;
let failed = 0;
const ok = (name, condition, detail = '') => {
  if (condition) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.error(`  FAIL  ${name}${detail ? `\n          ${detail}` : ''}`); }
};

async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json();
  if (!json.success) throw new Error(`${method} ${path}: ${json.message}`);
  return json.data;
}

const run = Date.now();
const key = (n) => `ui-ret-${run}-${n}`;
const shop = await call('GET', '/shop');
const counterId = shop.counters[0].id;
const item = async (code) => (await call('GET', `/sales/items?q=${code}`)).items.find(i => i.code === code);
const cotton = await item('COT-010');
const silk = await item('KAN-001');

const created = await call('POST', '/customers', { phone: '97' + String(run).slice(-8), name: `Kavya ${String(run).slice(-4)}` });
const kavya = created.customer ?? created;
const sell = (name, lines, payments, extra = {}) =>
  call('POST', '/sales', { onceKey: key(name), counterId, lines, payments, ...extra }).then(r => r.sale);

// Kavya has Rs 1,299 of store credit from an earlier return.
const earlier = await sell('earlier', [{ itemId: cotton.id, qty: 1 }], [{ method: 'CASH', amountPaise: 129900 }], { customerId: kavya.id });
await call('POST', `/returns/bill/${earlier.id}`, {
  onceKey: key('earlier-r'), lines: [{ saleLineId: earlier.lines[0].id, qty: 1 }],
  reason: 'Changed mind', refund: { method: 'STORE_CREDIT' }, approval: PIN
});
const silkBill = await sell('silk', [{ itemId: silk.id, qty: 1 }], [{ method: 'CASH', amountPaise: 1299900 }], { customerId: kavya.id });
const unsure = await sell('unsure', [{ itemId: cotton.id, qty: 1 }], [{ method: 'UPI', amountPaise: 129900, unconfirmed: true }]);
const late = await sell('late', [{ itemId: cotton.id, qty: 2 }], [{ method: 'CASH', amountPaise: 259800 }]);

// Ten days old. Only the database can make a bill old, so this one step goes round the API.
execSync(
  `npx ts-node -T -e "require('./src/lib/prisma').prisma.sale.update({ where: { id: '${late.id}' }, data: { createdAt: new Date(Date.now() - 10 * 86400000) } }).then(() => process.exit(0))"`,
  { cwd: 'D:/villy/pos/backend', stdio: 'ignore' }
);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const text = () => page.locator('body').innerText();
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };

console.log('\nverify-returns-ui\n');

// ============================================================================================
console.log('an exchange for something dearer, paid partly from store credit');
// ============================================================================================
await page.goto(`${WEB}/bills/${silkBill.id}`, { waitUntil: 'networkidle' });
ok('the bill offers Exchange', await page.getByRole('link', { name: 'Exchange' }).isVisible());
await page.getByRole('link', { name: 'Exchange' }).click();
await page.getByRole('heading', { name: 'Coming back' }).waitFor();

ok('the button explains what is missing before anything is chosen', (await text()).includes('Choose what is coming back.'));
ok('and is not pressable', await page.getByRole('button', { name: 'Record exchange' }).isDisabled());

await page.getByRole('button', { name: /One more Kanchipuram/ }).click();
await page.getByRole('button', { name: 'Wrong size' }).click();
await page.getByLabel('Find the replacement').fill('KAN-002');
await page.getByRole('button', { name: 'Find' }).click();
await page.getByText('Customer pays').waitFor();
ok('the screen says the customer pays only the Rs 2,000 difference', (await text()).includes('Customer pays ₹2,000'));
await shot('exchange-desktop');

await page.getByRole('button', { name: 'Take ₹2,000' }).click();
await page.getByText('Difference to pay').waitFor();
ok('the payment panel offers her store credit', await page.getByRole('button', { name: 'Store credit' }).isVisible());
await page.getByRole('button', { name: 'Store credit' }).click();
await page.getByLabel('Amount for payment 1').fill('1299');
ok('with the balance shown', (await text()).includes('₹1,299 available'));
await page.getByRole('button', { name: /Split/ }).click();
ok('the rest defaults to what is left', (await page.getByLabel('Amount for payment 2').inputValue()) === '701');
await page.getByRole('button', { name: 'Complete sale' }).click();

await page.getByText('Manager approval needed').waitFor();
ok('a manager is asked for, in place', (await text()).includes('Cashiers need a manager for any return.'));
await page.getByLabel('Reason', { exact: true }).last().fill('Size exchange');
await page.getByLabel('Manager PIN').fill('2468');
await page.getByRole('button', { name: 'Approve' }).click();

await page.waitForURL(/\/returns\//);
await page.getByText('CREDIT NOTE').waitFor();
const note = await text();
ok('the credit note says what settled the new bill', note.includes('Put towards the new bill') && note.includes('₹12,999'));
ok('and links to the new bill', /New bill INV\/\d{4}-\d{2}\/\d+ →/.test(note));
await shot('credit-note-desktop');

await page.getByRole('link', { name: /New bill/ }).first().click();
await page.getByText('Exchange credit').waitFor();
const newBill = await text();
ok('the new bill shows exchange credit, store credit and cash', ['Exchange credit', 'Store credit', 'Cash'].every(w => newBill.includes(w)));
ok('and what it was against', newBill.includes(`Exchange against ${silkBill.invoiceNo}`));

// ============================================================================================
console.log('\na bill that cannot take a return yet');
// ============================================================================================
await page.goto(`${WEB}/bills/${unsure.id}/return`, { waitUntil: 'networkidle' });
ok('an unchecked UPI is explained, not refused later', (await text()).includes('still being checked'));
ok('with the way to fix it', await page.getByRole('link', { name: /Payment checks/ }).isVisible());

// ============================================================================================
console.log('\na late return');
// ============================================================================================
await page.goto(`${WEB}/bills/${late.id}/return`, { waitUntil: 'networkidle' });
ok('a 10-day-old bill says it is past the window, before anything is chosen',
  (await text()).includes('Sold 10 days ago — past the 7-day return window. A manager will need to approve it.'));
await page.getByRole('button', { name: 'All of it' }).click();
await page.getByRole('button', { name: 'Damaged' }).click();
await page.getByRole('button', { name: 'Cash' }).click();
await page.getByText('Refund ₹2,598').waitFor();
await page.getByRole('button', { name: 'Record return' }).click();
await page.getByText('Manager approval needed').waitFor();
ok('the approval says how late it is', (await text()).includes('which is 10 days old. The shop takes returns for 7 days.'));
await page.getByRole('button', { name: 'Back' }).click();
ok('Back leaves everything chosen in place', (await text()).includes('Refund ₹2,598'));

// ============================================================================================
console.log('\ncredit that was spent cannot come back as cash');
// ============================================================================================
// Her first credit went on the exchange above -- and the till rightly refuses to spend it twice.
// Give her some more, the way a shop would: another return to store credit.
const again = await sell('again', [{ itemId: cotton.id, qty: 1 }], [{ method: 'CASH', amountPaise: 129900 }], { customerId: kavya.id });
await call('POST', `/returns/bill/${again.id}`, {
  onceKey: key('again-r'), lines: [{ saleLineId: again.lines[0].id, qty: 1 }],
  reason: 'Changed mind', refund: { method: 'STORE_CREDIT' }, approval: PIN
});
const onCredit = await sell('oncredit', [{ itemId: cotton.id, qty: 1 }], [{ method: 'CREDIT', amountPaise: 129900 }], { customerId: kavya.id })
  .catch(e => { ok('Kavya can spend credit at the till', false, e.message); return null; });
if (onCredit) {
  await page.goto(`${WEB}/bills/${onCredit.id}/return`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /One more/ }).click();
  await page.getByRole('button', { name: 'Changed mind' }).click();
  await page.getByRole('button', { name: 'Cash' }).click();
  ok('choosing cash explains why not, before pressing anything',
    (await text()).includes('Nothing on this bill was paid in money. Give it as store credit.'));
  ok('and the button waits', await page.getByRole('button', { name: 'Record return' }).isDisabled());
  await page.getByRole('button', { name: 'Store credit' }).click();
  ok('store credit is fine', await page.getByRole('button', { name: 'Record return' }).isEnabled());
}

// ============================================================================================
console.log('\nthe customer card and Home');
// ============================================================================================
await page.goto(`${WEB}/customers/${kavya.id}`, { waitUntil: 'networkidle' });
const cardText = await text();
ok('her card shows store credit with where it came from', /store credit:/i.test(cardText) && /Given · CN\//.test(cardText));
ok('and where it went', /Spent · INV\//.test(cardText));
ok('the exchanged bill is marked returned in her history', cardText.includes(`${silkBill.invoiceNo} · returned`));

await page.goto(`${WEB}/`, { waitUntil: 'networkidle' });
ok('Home shows returns today on their own line', /Returns today: ₹[\d,]+ \(\d+\)/.test(await text()));

// ============================================================================================
console.log('\nphone, tablet, desktop');
// ============================================================================================
for (const [label, width, height] of [['phone', 375, 812], ['tablet', 768, 1024], ['desktop', 1440, 900]]) {
  await page.setViewportSize({ width, height });
  for (const path of [`/bills/${late.id}/return`, `/bills/${silkBill.id}`]) {
    await page.goto(`${WEB}${path}`, { waitUntil: 'networkidle' });
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    ok(`${label}: ${path.endsWith('return') ? 'return screen' : 'returned bill'} does not scroll sideways`, !sideways);
  }
  await page.goto(`${WEB}/bills/${late.id}/return`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'All of it' }).click();
  await page.getByRole('button', { name: 'Damaged' }).click();
  await page.getByRole('button', { name: 'Cash' }).click();
  await page.getByText('Refund ₹2,598').waitFor();
  const button = await page.getByRole('button', { name: 'Record return' }).boundingBox();
  ok(`${label}: Record return is on screen without scrolling`, button && button.y + button.height <= height, JSON.stringify(button));
  await shot(`return-${label}`);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
await browser.close();
process.exit(failed ? 1 : 0);
