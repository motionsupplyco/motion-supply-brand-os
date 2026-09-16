// Shopify CSV utilities. Designed for the current Shopify Orders export and
// Transaction history export. Parsing occurs in the browser; raw customer rows
// do not need to leave the user's device.

const csvError = message => new Error(`Invalid CSV: ${message}`);

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false, quoteClosed = false;
  const input = String(text ?? '').replace(/^\uFEFF/, '');

  const pushField = () => {
    row.push(field);
    field = '';
    quoteClosed = false;
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i++) {
    const c = input[i];

    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        quoteClosed = true;
      } else {
        field += c;
      }
      continue;
    }

    if (quoteClosed) {
      if (c === ',') pushField();
      else if (c === '\n') pushRow();
      else if (c === '\r' && input[i + 1] === '\n') { pushRow(); i++; }
      else throw csvError('unexpected characters after a closing quote.');
      continue;
    }

    if (c === '"') {
      if (field.length) throw csvError('a quote appeared inside an unquoted field.');
      quoted = true;
    } else if (c === ',') {
      pushField();
    } else if (c === '\n') {
      pushRow();
    } else if (c === '\r' && input[i + 1] === '\n') {
      pushRow();
      i++;
    } else {
      field += c;
    }
  }

  if (quoted) throw csvError('an unterminated quoted field was found.');
  if (field.length || row.length || quoteClosed) pushRow();
  return rows.filter(r => r.some(v => String(v).trim() !== ''));
}

export function csvObjects(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const headers = rows[0].map(h => String(h).trim());
  if (headers.some(h => !h)) throw csvError('a blank column header was found.');
  const seen = new Set();
  for (const header of headers) {
    if (seen.has(header)) throw csvError(`duplicate column header "${header}".`);
    seen.add(header);
  }
  return rows.slice(1).map(cols => Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? ''])));
}

const money = (v) => {
  const raw = String(v ?? '').trim();
  if (!raw) return 0;
  const x = Number(raw.replace(/[$,]/g, ''));
  if (!Number.isFinite(x)) throw csvError(`non-numeric money value "${raw}".`);
  return x;
};
const qty = (v) => {
  const raw = String(v ?? '').trim();
  if (!raw) return 0;
  const x = Number(raw);
  if (!Number.isFinite(x)) throw csvError(`non-numeric quantity value "${raw}".`);
  return x;
};

export function detectShopifyCsv(rows) {
  if (!rows.length) return 'unknown';
  const keys = new Set(Object.keys(rows[0]));
  if (keys.has('Name') && keys.has('Lineitem quantity') && keys.has('Total')) return 'orders';
  if (keys.has('Order') && keys.has('Kind') && keys.has('Amount') && keys.has('Gateway')) return 'transactions';
  return 'unknown';
}

export function summarizeShopifyOrders(rows) {
  const orders = new Map();
  const sku = new Map();
  let units = 0;
  let lineItemValue = 0;

  // Shopify exports additional line items on separate rows and often leaves
  // order-level fields blank on those continuation rows. Carry the last order
  // Name forward only for grouping line items, never to invent order totals.
  let currentName = '';
  for (const r of rows) {
    if (String(r.Name || '').trim()) currentName = String(r.Name).trim();
    if (!currentName) continue;

    if (!orders.has(currentName)) {
      orders.set(currentName, {
        name: currentName,
        email: r.Email || '',
        createdAt: r['Created at'] || '',
        financialStatus: r['Financial Status'] || '',
        fulfillmentStatus: r['Fulfillment Status'] || '',
        subtotal: money(r.Subtotal), shipping: money(r.Shipping), taxes: money(r.Taxes),
        total: money(r.Total), discount: money(r['Discount Amount']), canceledAt: r['Canceled at'] || ''
      });
    } else {
      const o = orders.get(currentName);
      // Fill only blank order-level values from later rows if Shopify happens to repeat them.
      if (!o.email && r.Email) o.email = r.Email;
      if (!o.createdAt && r['Created at']) o.createdAt = r['Created at'];
      if (!o.financialStatus && r['Financial Status']) o.financialStatus = r['Financial Status'];
      if (!o.fulfillmentStatus && r['Fulfillment Status']) o.fulfillmentStatus = r['Fulfillment Status'];
      if (!o.subtotal && money(r.Subtotal)) o.subtotal = money(r.Subtotal);
      if (!o.shipping && money(r.Shipping)) o.shipping = money(r.Shipping);
      if (!o.taxes && money(r.Taxes)) o.taxes = money(r.Taxes);
      if (!o.total && money(r.Total)) o.total = money(r.Total);
      if (!o.discount && money(r['Discount Amount'])) o.discount = money(r['Discount Amount']);
    }

    const q = qty(r['Lineitem quantity']);
    const price = money(r['Lineitem price']);
    if (q > 0) {
      units += q;
      lineItemValue += q * price;
      const key = String(r['Lineitem SKU'] || r['Lineitem name'] || 'Unlabeled item').trim() || 'Unlabeled item';
      const prev = sku.get(key) || { sku: key, units: 0, value: 0 };
      prev.units += q; prev.value += q * price; sku.set(key, prev);
    }
  }

  const list = [...orders.values()];
  const sum = (key) => list.reduce((a, o) => a + money(o[key]), 0);
  const customerEmails = new Set(list.map(o => String(o.email).trim().toLowerCase()).filter(Boolean));
  const fulfilled = list.filter(o => /fulfilled/i.test(o.fulfillmentStatus)).length;
  const canceled = list.filter(o => o.canceledAt).length;
  const refundedStatus = list.filter(o => /refund/i.test(o.financialStatus)).length;
  const nonCanceled = list.filter(o => !o.canceledAt);
  const nonCanceledOrderTotal = nonCanceled.reduce((a,o)=>a+money(o.total),0);
  const dates = list.map(o => o.createdAt).filter(Boolean).sort();

  return {
    kind: 'orders',
    orderCount: list.length,
    nonCanceledOrderCount: nonCanceled.length,
    uniqueCustomerEmails: customerEmails.size,
    units,
    csvSubtotal: sum('subtotal'),
    csvShipping: sum('shipping'),
    csvTaxes: sum('taxes'),
    csvOrderTotal: sum('total'),
    nonCanceledOrderTotal,
    csvDiscountAmount: sum('discount'),
    lineItemValue,
    fulfilledOrders: fulfilled,
    canceledOrders: canceled,
    refundedStatusOrders: refundedStatus,
    averageOrderTotal: list.length ? sum('total') / list.length : 0,
    averageCsvSubtotal: list.length ? sum('subtotal') / list.length : 0,
    startDate: dates[0] || '', endDate: dates[dates.length - 1] || '',
    topSkus: [...sku.values()].sort((a,b) => b.units - a.units).slice(0, 10),
    orders: list
  };
}

export function summarizeShopifyTransactions(rows) {
  let capturedSales = 0, refunds = 0, successfulTransactions = 0;
  const byOrder = new Map();
  for (const r of rows) {
    if (!/^success$/i.test(String(r.Status || '').trim())) continue;
    successfulTransactions++;
    const kind = String(r.Kind || '').trim().toLowerCase();
    const amount = money(r.Amount);
    if (['sale', 'capture'].includes(kind)) capturedSales += amount;
    if (kind === 'refund') refunds += Math.abs(amount);
    const name = String(r.Name || r.Order || 'Unknown').trim();
    const x = byOrder.get(name) || { sales: 0, refunds: 0 };
    if (['sale', 'capture'].includes(kind)) x.sales += amount;
    if (kind === 'refund') x.refunds += Math.abs(amount);
    byOrder.set(name, x);
  }
  return {
    kind: 'transactions', successfulTransactions, capturedSales, refunds,
    netCapturedPayments: capturedSales - refunds,
    orderCountWithTransactions: byOrder.size
  };
}

export function summarizeShopifyCsv(text) {
  const rows = csvObjects(text);
  const kind = detectShopifyCsv(rows);
  if (kind === 'orders') return summarizeShopifyOrders(rows);
  if (kind === 'transactions') return summarizeShopifyTransactions(rows);
  throw new Error('This does not look like a Shopify Orders export or Transaction history export.');
}
