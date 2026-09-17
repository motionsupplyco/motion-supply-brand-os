import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, csvObjects, summarizeShopifyCsv } from '../public/shopify.js';

test('CSV parser handles quoted commas and escaped quotes', () => {
  const rows = parseCsv('Name,Notes\n#1,"hello, world"\n#2,"say ""yo"""\n');
  assert.equal(rows[1][1], 'hello, world');
  assert.equal(rows[2][1], 'say "yo"');
});

test('CSV parser strips BOM, accepts CRLF, multiline quoted fields, and trailing empty values', () => {
  const rows = parseCsv('\uFEFFName,Notes,Empty\r\n#1,"first line\r\nsecond, line",\r\n');
  assert.deepEqual(rows[0], ['Name', 'Notes', 'Empty']);
  assert.deepEqual(rows[1], ['#1', 'first line\r\nsecond, line', '']);
});

test('CSV parser rejects unterminated and structurally invalid quoted fields', () => {
  assert.throws(() => parseCsv('Name,Notes\n#1,"never closes'), /Invalid CSV: an unterminated quoted field/i);
  assert.throws(() => parseCsv('Name,Notes\n#1,bad"quote'), /Invalid CSV: a quote appeared inside an unquoted field/i);
  assert.throws(() => parseCsv('Name,Notes\n#1,"closed"junk'), /Invalid CSV: unexpected characters after a closing quote/i);
});

test('CSV object conversion rejects blank and duplicate column headers', () => {
  assert.throws(() => csvObjects('Name,,Total\n#1,,10\n'), /Invalid CSV: a blank column header/i);
  assert.throws(() => csvObjects('Name,Total,Name\n#1,10,#1\n'), /Invalid CSV: duplicate column header "Name"/i);
});

test('Shopify order export dedupes order-level totals across line items', () => {
  const csv = [
    'Name,Email,Financial Status,Fulfillment Status,Subtotal,Shipping,Taxes,Total,Discount Amount,Created at,Lineitem quantity,Lineitem name,Lineitem price,Lineitem SKU,Canceled at',
    '#1001,a@example.com,paid,fulfilled,78,5,6,89,0,2026-09-01 10:00:00 -0400,1,Hoodie,78,HD-M,',
    ',,,,,,,,,,2,Socks,10,SOCK-BLK,',
    '#1002,b@example.com,paid,,34,0,2,36,0,2026-09-02 10:00:00 -0400,1,Tee,34,TEE-L,'
  ].join('\n');
  const x = summarizeShopifyCsv(csv);
  assert.equal(x.orderCount, 2);
  assert.equal(x.nonCanceledOrderCount, 2);
  assert.equal(x.nonCanceledOrderTotal, 125);
  assert.equal(x.units, 4);
  assert.equal(x.csvOrderTotal, 125);
  assert.equal(x.lineItemValue, 132);
  assert.equal(x.uniqueCustomerEmails, 2);
});

test('Shopify order-like export survives BOM, CRLF, quoted commas and multiline non-financial fields', () => {
  const csv = [
    '\uFEFFName,Email,Financial Status,Fulfillment Status,Subtotal,Shipping,Taxes,Total,Discount Amount,Created at,Lineitem quantity,Lineitem name,Lineitem price,Lineitem SKU,Canceled at,Notes',
    '#2001,c@example.com,paid,fulfilled,50,0,0,50,0,2026-09-03 10:00:00 -0400,1,"Heavyweight Tee, Black",50,TEE-BLK,,"customer note',
    'continued on another line"',
  ].join('\r\n');
  const x = summarizeShopifyCsv(csv);
  assert.equal(x.kind, 'orders');
  assert.equal(x.orderCount, 1);
  assert.equal(x.csvOrderTotal, 50);
  assert.equal(x.units, 1);
  assert.equal(x.topSkus[0].sku, 'TEE-BLK');
});

test('Shopify order export distinguishes canceled order total from non-canceled operating total', () => {
  const csv = [
    'Name,Email,Financial Status,Fulfillment Status,Subtotal,Shipping,Taxes,Total,Discount Amount,Created at,Lineitem quantity,Lineitem name,Lineitem price,Lineitem SKU,Canceled at',
    '#3001,a@example.com,paid,fulfilled,100,0,0,100,0,2026-09-01,1,Hoodie,100,H-1,',
    '#3002,b@example.com,refunded,,80,0,0,80,0,2026-09-02,1,Tee,80,T-1,2026-09-02',
  ].join('\n');
  const x = summarizeShopifyCsv(csv);
  assert.equal(x.orderCount, 2);
  assert.equal(x.canceledOrders, 1);
  assert.equal(x.refundedStatusOrders, 1);
  assert.equal(x.csvOrderTotal, 180);
  assert.equal(x.nonCanceledOrderTotal, 100);
});

test('Shopify transaction history calculates captured minus refunds and ignores failed transactions', () => {
  const csv = [
    'Order,Name,Payment Method,Kind,Gateway,Created At,Status,Amount,Currency,Card Type',
    '1,#1001,card,sale,stripe,2026-09-01,success,100,USD,Visa',
    '1,#1001,card,refund,stripe,2026-09-02,success,20,USD,Visa',
    '2,#1002,card,capture,stripe,2026-09-03,success,50,USD,Visa',
    '3,#1003,card,sale,stripe,2026-09-04,failure,999,USD,Visa',
  ].join('\n');
  const x = summarizeShopifyCsv(csv);
  assert.equal(x.successfulTransactions, 3);
  assert.equal(x.capturedSales, 150);
  assert.equal(x.refunds, 20);
  assert.equal(x.netCapturedPayments, 130);
  assert.equal(x.orderCountWithTransactions, 2);
});

test('Shopify CSV rejects unknown schemas instead of guessing an import type', () => {
  assert.throws(() => summarizeShopifyCsv('foo,bar\n1,2\n'), /does not look like a Shopify Orders export or Transaction history export/i);
  assert.throws(() => summarizeShopifyCsv(''), /does not look like a Shopify Orders export or Transaction history export/i);
});

test('Shopify CSV rejects non-numeric financial and quantity cells instead of converting them to zero', () => {
  const badMoney = [
    'Name,Total,Lineitem quantity,Lineitem price',
    '#1,not-money,1,10',
  ].join('\n');
  assert.throws(() => summarizeShopifyCsv(badMoney), /Invalid CSV: non-numeric money value "not-money"/i);

  const badQty = [
    'Name,Total,Lineitem quantity,Lineitem price',
    '#1,10,not-a-quantity,10',
  ].join('\n');
  assert.throws(() => summarizeShopifyCsv(badQty), /Invalid CSV: non-numeric quantity value "not-a-quantity"/i);
});
