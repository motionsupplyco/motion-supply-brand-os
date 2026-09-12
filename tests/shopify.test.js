import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, csvObjects, summarizeShopifyCsv } from '../public/shopify.js';

test('CSV parser handles quoted commas and escaped quotes', () => {
  const rows = parseCsv('Name,Notes\n#1,"hello, world"\n#2,"say ""yo"""\n');
  assert.equal(rows[1][1], 'hello, world');
  assert.equal(rows[2][1], 'say "yo"');
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

test('Shopify transaction history calculates captured minus refunds', () => {
  const csv = [
    'Order,Name,Payment Method,Kind,Gateway,Created At,Status,Amount,Currency,Card Type',
    '1,#1001,card,sale,stripe,2026-09-01,success,100,USD,Visa',
    '1,#1001,card,refund,stripe,2026-09-02,success,20,USD,Visa',
    '2,#1002,card,sale,stripe,2026-09-03,success,50,USD,Visa',
  ].join('\n');
  const x = summarizeShopifyCsv(csv);
  assert.equal(x.capturedSales, 150);
  assert.equal(x.refunds, 20);
  assert.equal(x.netCapturedPayments, 130);
});
