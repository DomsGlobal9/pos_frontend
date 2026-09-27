/**
 * verify-phase10-ui -- digital receipts, the UPI QR, devices and the camera scan, in real Chrome.
 *
 *     (backend on 4007, frontend on 5175, local database running)
 *     node scripts/verify-phase10-ui.mjs [screenshot-folder]
 *
 * The owner half (setting the UPI ID, renaming a device) runs against a second backend on 4008 with
 * DEV_ACTOR=dev-owner, as the other UI suites do for managers.
 *
 * THE CAMERA IS TESTED FOR REAL: Chrome is given a fake camera that shows an actual EAN-13 barcode
 * (drawn by scripts/make-barcode-video.py -- the cotton saree's code), and the item has to arrive in
 * the basket through the same decoder, search and basket a phone would use.
 */
import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { chromium } from 'file:///D:/villy/api-super-admin/node_modules/playwright/index.mjs';

const WEB = 'http://localhost:5175';
const API = 'http://localhost:4007/api/v1';
const OWN = 'http://localhost:4008/api/v1';
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

const ownerServer = spawn('npx', ['ts-node', '-T', 'src/server.ts'], {
  cwd: 'D:/villy/pos/backend', shell: true, stdio: 'ignore',
  env: { ...process.env, PORT: '4008', DEV_ACTOR: 'dev-owner', DISABLE_BACKGROUND_JOBS: 'true' }
});
const stopOwner = () => { try { execSync(`taskkill /pid ${ownerServer.pid} /T /F`, { stdio: 'ignore' }); } catch {} };
process.on('exit', stopOwner);
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${OWN}/health`)).ok) break; } catch {}
  await new Promise(r => setTimeout(r, 1000));
}

// A bill with a customer, as the till would make it.
const shop = await call(API, 'GET', '/shop');
const counterId = shop.counters[0].id;
const cotton = (await call(API, 'GET', '/sales/items?q=COT-010')).items.find(i => i.code === 'COT-010');
const created = await call(API, 'POST', '/customers', { phone: '96' + String(Date.now()).slice(-8), name: 'Receipt UI test' });
const customer = created.customer ?? created;
const sale = (await call(API, 'POST', '/sales', {
  onceKey: `p10ui-${Date.now()}`, counterId, customerId: customer.id, lines: [{ itemId: cotton.id, qty: 1 }],
  payments: [{ method: 'CASH', amountPaise: cotton.pricePaise }]
})).sale;
const token = sale.receiptUrl.split('/r/')[1];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const text = () => page.locator('body').innerText();
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };

console.log('\nverify-phase10-ui\n');

// ============================================================================================
console.log('the receipt');
// ============================================================================================
await page.goto(`${WEB}/bills/${sale.id}`, { waitUntil: 'networkidle' });
await page.getByAltText('QR code for this bill online').waitFor();
ok('the receipt carries a QR for the bill online', await page.getByAltText('QR code for this bill online').isVisible());
const pdfHref = await page.getByRole('link', { name: 'PDF' }).getAttribute('href');
const pdfRes = await page.request.get(WEB + pdfHref);
ok('the PDF button gives a real PDF', pdfRes.ok() && (await pdfRes.body()).subarray(0, 5).toString() === '%PDF-', pdfHref);
const before = JSON.stringify(await call(API, 'GET', `/bills/${sale.id}`));
await page.getByRole('button', { name: 'WhatsApp' }).click();
await page.getByText(/WhatsApp receipts are not set up for this till yet/).waitFor();
ok('WhatsApp not set up: said plainly, with what to do instead', (await text()).includes('Print the bill, or show the QR code'));
ok('and the bill is untouched', JSON.stringify(await call(API, 'GET', `/bills/${sale.id}`)) === before);
await shot('p10-bill');

// ============================================================================================
console.log('\nthe customer\'s digital receipt');
// ============================================================================================
const guest = await browser.newPage({ viewport: { width: 390, height: 844 } });
await guest.goto(`${WEB}/r/${token}`, { waitUntil: 'networkidle' });
await guest.getByText(sale.invoiceNo).first().waitFor();
const g = await guest.locator('body').innerText();
ok('opens the bill with no sign-in', g.includes(sale.invoiceNo) && g.includes('Your bill from'));
ok('without the till\'s menus', !(await guest.getByRole('navigation').count()));
ok('the number masked', !g.includes(customer.phone) && g.includes(customer.phone.slice(-4)));
const gpdf = await guest.request.get(WEB + await guest.getByRole('link', { name: 'PDF' }).getAttribute('href'));
ok('its PDF downloads too', gpdf.ok() && gpdf.headers()['content-type'] === 'application/pdf');
ok('fits a phone', !(await guest.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)));
if (SHOTS) await guest.screenshot({ path: `${SHOTS}/p10-public-receipt.png`, fullPage: true });
await guest.goto(`${WEB}/r/${'x'.repeat(24)}`, { waitUntil: 'networkidle' });
await guest.getByText('This bill could not be opened.').waitFor();
ok('a wrong link says so, in words', (await guest.locator('body').innerText()).includes('Check it against the paper receipt'));
await guest.close();

// ============================================================================================
console.log('\nthe UPI QR (owner sets the UPI ID, cashier takes payment)');
// ============================================================================================
await page.route('**/api/v1/**', route => route.continue({ url: route.request().url().replace(':5175/api/v1', ':4008/api/v1') }));
await page.goto(`${WEB}/settings`, { waitUntil: 'networkidle' });
await page.getByLabel('UPI ID').fill('LakshmiSilks@okhdfcbank');
await page.getByRole('button', { name: 'Save' }).click();
await page.getByText(/The payment screen will show a QR/).waitFor();
ok('the owner sets the UPI ID', (await call(API, 'GET', '/shop')).shop.upiId === 'lakshmisilks@okhdfcbank');
await shot('p10-settings');

// Devices, while we are the owner.
await page.goto(`${WEB}/devices`, { waitUntil: 'networkidle' });
await page.getByText('This device').waitFor();
ok('this browser registered itself', (await text()).includes('This device'));
const appVersion = JSON.parse(fs.readFileSync('D:/villy/pos/frontend/package.json', 'utf8')).version;
ok('with the app version', (await text()).includes(`version ${appVersion}`));
await page.getByRole('button', { name: 'Change' }).first().click();
await page.getByLabel('Device name').fill('Counter 1 PC');
await page.getByRole('button', { name: '58 mm paper' }).click();
await page.getByRole('button', { name: 'Save' }).click();
await page.getByText('Counter 1 PC').first().waitFor();
ok('the owner names it and sets 58 mm paper', (await text()).includes('Counter 1 PC') && (await text()).includes('58 mm'));
await shot('p10-devices');
await page.unroute('**/api/v1/**');

// Back to the cashier's till, with a fresh page so the shop (and its UPI ID) is re-read.
await page.goto(`${WEB}/sell`, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.getByLabel('Find an item').fill('COT-010');
await page.getByLabel('Find an item').press('Enter');
await page.getByRole('button', { name: 'Take payment' }).waitFor();
await page.getByRole('button', { name: 'Take payment' }).click();
await page.getByRole('button', { name: 'UPI', exact: true }).click();
const qrBox = page.locator('[data-upi]');
await qrBox.waitFor();
const link = await qrBox.getAttribute('data-upi');
ok('choosing UPI shows a QR', await page.getByAltText(/UPI QR for/).isVisible());
ok('for the shop\'s UPI ID, the exact amount, in rupees', link.startsWith('upi://pay?pa=lakshmisilks%40okhdfcbank') && link.includes(`am=${(cotton.pricePaise / 100).toFixed(2)}`) && link.includes('cu=INR'), link);
await shot('p10-upi-qr');
await page.getByLabel('Amount for payment 1').fill('500');
ok('the QR follows the amount typed', (await qrBox.getAttribute('data-upi')).includes('am=500.00'));
await page.getByRole('button', { name: 'Back' }).click();
await call(OWN, 'PUT', '/shop/upi', { upiId: null });

// ============================================================================================
console.log('\nthe camera scan, with a fake camera showing a real barcode');
// ============================================================================================
const y4m = path.join(os.tmpdir(), `cotton-${Date.now()}.y4m`);
execSync(`python scripts/make-barcode-video.py 8901234500033 "${y4m}"`, { stdio: 'ignore' });
const cam = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`]
});
const phone = await cam.newPage({ viewport: { width: 390, height: 844 } });
await phone.context().grantPermissions(['camera'], { origin: WEB });
await phone.goto(`${WEB}/sell`, { waitUntil: 'networkidle' });
// Empty the basket first so we see exactly what the camera added.
await phone.evaluate(() => localStorage.removeItem('pos.basket.v2'));
await phone.reload({ waitUntil: 'networkidle' });
await phone.getByRole('button', { name: 'Scan with camera' }).click();
await phone.getByRole('dialog', { name: 'Scan with camera' }).waitFor();
let added = false;
for (let i = 0; i < 40 && !added; i++) {
  await phone.waitForTimeout(500);
  added = (await phone.locator('body').innerText()).includes('COT-010');
}
ok('the camera read the barcode and the cotton saree is in the basket', added);
ok('and the camera closed itself', !(await phone.getByRole('dialog', { name: 'Scan with camera' }).count()));
if (SHOTS) await phone.screenshot({ path: `${SHOTS}/p10-camera-added.png` });
await cam.close();
fs.rmSync(y4m, { force: true });

// ============================================================================================
console.log('\nphone, tablet, desktop');
// ============================================================================================
for (const [label, width, height] of [['phone', 390, 844], ['tablet', 768, 1024], ['desktop', 1440, 900]]) {
  await page.setViewportSize({ width, height });
  for (const p of ['/settings', '/devices', `/bills/${sale.id}`]) {
    await page.goto(`${WEB}${p}`, { waitUntil: 'networkidle' });
    ok(`${label}: ${p.split('/')[1]} does not scroll sideways`, !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)));
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
await browser.close();
stopOwner();
process.exit(failed ? 1 : 0);
