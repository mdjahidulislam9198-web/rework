/**
 * ═══ InventoryTests.gs: PHASE 2b TEST SUITE ═══
 * RUN: spreadsheet menu → Store Setup → Run Phase 2b inventory tests. TEST database only.
 * Uses throw-away products and users; relies on globals from Tests.gs (FK1, FK2, SALT) and EngineTests.gs (TEST_CRASH_AT).
 */
function runInventoryTests() {
  var ui = SpreadsheetApp.getUi();
  if (props_().getProperty('MODE') !== 'TEST') { ui.alert('Refused: inventory tests run only on a TEST database.'); return; }
  var results = [], tag = String(Date.now()).slice(-6), n = 0, A = { user: { Role: 'ADMIN', Username: 'zt' } }, S = { user: { Role: 'STAFF', Username: 'zs' } };
  function t(name, fn) { try { var r = fn(); results.push((r === false ? 'FAIL  ' : 'PASS  ') + name); } catch (e) { TEST_CRASH_AT = ''; results.push('FAIL  ' + name + ' → ' + (e.code ? e.code + ': ' : '') + e.message); } }
  function key() { return 'it' + tag + '-' + (++n); }
  function eq(a, b, w) { if (a !== b) throw new Error((w || 'value') + ': expected ' + b + ', got ' + a); return true; }
  function fails(fn, code) { try { fn(); } catch (e) { if (e.code === code) return true; throw new Error('expected ' + code + ' but got ' + (e.code || e.message)); } throw new Error('expected ' + code + ' but nothing failed'); }
  function mk(extra) { return Inventory_create(A, Object.assign({ sku: 'sk' + tag + (++n), name: 'Test cable ' + n, category: 'Cable', brand: 'Acme', unit: 'm', sellingPrice: 15000, purchasePrice: 10000, minStock: 0 }, extra || {})); }
  function buy(pid, qty, cost) {
    var k = key(); return postTxn_({ type: 'TEST_PURCHASE', requestKey: k, user: 't', build: function (st) { st.stockIn(pid, qty, cost, 'PURCHASE', k); return { date: todayDhaka_(), description: 'x', sourceType: 'TEST_PURCHASE', sourceId: k, lines: [{ account: '1200', debit: cost }, { account: '2100', credit: cost }] }; } });
  }
  function adj(pid, q, reason, note, unitCost) { return Inventory_adjust(A, { reasonCode: reason, reasonNote: note, items: [{ productId: pid, qtyChange: q, unitCost: unitCost }] }, { requestKey: key() }); }
  function bal(a) { var b = ledgerBalances_()[a] || { debit: 0, credit: 0 }; return b.debit - b.credit; }
  function prod(id) { return Inventory_list(A, { includeInactive: true }).filter(function (x) { return x.productId === id; })[0]; }
  function user(name, role) { var c = withLock_(function () { return createUser_(name, 'Test ' + name, role, 'it'); }); dispatch_({ action: 'activateAccount', payload: { username: name, setupCode: c.setupCode, key: FK1, salt: SALT, iterations: MIN_ITERATIONS }, apiVersion: API_VERSION }); return dispatch_({ action: 'login', payload: { username: name, key: FK1 }, apiVersion: API_VERSION }).data.token; }
  function call(action, payload, token) { return dispatch_({ action: action, payload: payload || {}, token: token, requestKey: key(), apiVersion: API_VERSION }); }

  t('I1 Create product: valid, with zero stock; bad input refused', function () {
    var p = mk(); eq(p.qty, 0, 'qty'); eq(p.value, 0, 'value'); eq(p.isActive, true, 'active');
    fails(function () { mk({ name: 'x' }); }, 'BAD_INPUT'); fails(function () { mk({ sellingPrice: -5 }); }, 'BAD_INPUT'); fails(function () { mk({ sellingPrice: 10.5 }); }, 'BAD_INPUT'); return true;
  });
  t('I2 Duplicate SKU refused (case-insensitive)', function () { var p = mk(); fails(function () { mk({ sku: p.sku.toLowerCase() }); }, 'DUPLICATE'); return true; });
  t('I3 Edit product; stock fields cannot be edited directly', function () {
    var p = mk(); var u = Inventory_update(A, { productId: p.productId, sellingPrice: 17500, name: 'Renamed cable' });
    eq(u.sellingPrice, 17500, 'price'); eq(u.name, 'Renamed cable', 'name'); fails(function () { Inventory_update(A, { productId: p.productId, qty: 5000 }); }, 'BAD_INPUT');
    return eq(prod(p.productId).qty, 0, 'qty unchanged');
  });
  t('I4 Search by name and SKU; low-stock filter', function () {
    var p = mk({ name: 'Zeta Breaker ' + tag, minStock: 5000 }); buy(p.productId, 3000, 30000);
    eq(Inventory_list(A, { search: 'zeta breaker ' + tag }).length, 1, 'by name'); eq(Inventory_list(A, { search: p.sku.toLowerCase() }).length, 1, 'by sku');
    return Inventory_list(A, { lowOnly: true }).some(function (x) { return x.productId === p.productId; }) && eq(Inventory_list(A, { search: p.sku, lowOnly: true })[0].low, true, 'flag');
  });
  t('I5 Damaged: 150 units worth BDT 16,000, write off 3 → loss BDT 320.00, 147 units worth 15,680', function () {
    var p = mk(), l0 = bal('5300'), i0 = bal('1200'); buy(p.productId, 100000, 1000000); buy(p.productId, 50000, 600000);
    var r = adj(p.productId, -3000, 'DAMAGED', 'Water damage in storeroom'); var x = prod(p.productId);
    eq(r.totalValueChange, -32000, 'value change'); eq(x.qty, 147000, 'qty'); eq(x.value, 1568000, 'value'); eq(bal('5300') - l0, 32000, 'loss account'); eq(bal('1200') - i0, 1568000, 'inventory ledger'); return true;
  });
  t('I6 Reason and note are mandatory; cannot write off more than on hand; nothing written on refusal', function () {
    var p = mk(); buy(p.productId, 5000, 50000); var reg = sheet_('TxnRegistry').getLastRow();
    fails(function () { adj(p.productId, -1000, 'BOGUS', 'long enough note'); }, 'BAD_INPUT'); fails(function () { adj(p.productId, -1000, 'LOST', 'no'); }, 'BAD_INPUT');
    fails(function () { adj(p.productId, -5001, 'LOST', 'Missing after stock count'); }, 'INSUFFICIENT_STOCK'); eq(sheet_('TxnRegistry').getLastRow(), reg, 'registry rows'); return eq(prod(p.productId).qty, 5000, 'qty');
  });
  t('I7 Increase uses current average cost; zero-stock product needs a unit cost', function () {
    var p = mk(); buy(p.productId, 147000, 1568000); var g0 = bal('5300');
    var r = adj(p.productId, 3000, 'FOUND', 'Found in old shelf'); eq(r.totalValueChange, 32000, 'at average'); eq(bal('5300') - g0, -32000, 'gain credited');
    var z = mk(); fails(function () { adj(z.productId, 2000, 'COUNT_CORRECTION', 'Count was wrong'); }, 'BAD_INPUT');
    var r2 = adj(z.productId, 2000, 'COUNT_CORRECTION', 'Count was wrong', 5000); return eq(r2.totalValueChange, 10000, 'with unit cost') && eq(prod(z.productId).value, 10000, 'value');
  });
  t('I8 Adjustment is idempotent', function () {
    var p = mk(); buy(p.productId, 5000, 50000); var k = key(), body = { reasonCode: 'LOST', reasonNote: 'Lost on delivery', items: [{ productId: p.productId, qtyChange: -1000 }] };
    var a = Inventory_adjust(A, body, { requestKey: k }), b = Inventory_adjust(A, body, { requestKey: k }); return eq(a.txnId, b.txnId, 'txn') && eq(prod(p.productId).qty, 4000, 'qty');
  });
  t('I9 Valuation report: totals match the ledger; as-of an earlier date excludes today', function () {
    var p = mk(); buy(p.productId, 10000, 100000); var r = Inventory_valuation(A, {}), row = r.rows.filter(function (x) { return x.productId === p.productId; })[0];
    eq(row.value, 100000, 'row value'); eq(row.avgCost, 10000, 'avg cost per unit'); eq(row.marginPerUnit, 5000, 'margin'); eq(r.matches, true, 'ledger match');
    var y = new Date(Date.now() + 6 * 3600000 - 86400000).toISOString().slice(0, 10), old = Inventory_valuation(A, { asOf: y });
    var then = old.rows.filter(function (x) { return x.productId === p.productId; })[0]; return eq(then.qty, 0, 'no stock yesterday') && eq(then.value, 0, 'no value yesterday') && eq(old.matches, true, 'ledger match then');
  });
  t('I10 Cannot disable a product with stock; can at zero; disabled product refused by the engine', function () {
    var p = mk(); buy(p.productId, 1000, 1000); fails(function () { Inventory_setActive(A, { productId: p.productId, isActive: false }); }, 'HAS_STOCK');
    adj(p.productId, -1000, 'DAMAGED', 'All units broken'); Inventory_setActive(A, { productId: p.productId, isActive: false });
    fails(function () { buy(p.productId, 1000, 1000); }, 'INACTIVE_PRODUCT'); return eq(Inventory_list(A, { search: p.sku }).length, 0, 'hidden from list');
  });
  t('I11 History shows valid movements only (a crashed adjustment never appears)', function () {
    var p = mk(); buy(p.productId, 5000, 50000);
    TEST_CRASH_AT = 'afterJournal'; fails(function () { adj(p.productId, -1000, 'LOST', 'Crash simulation'); }, 'SIMULATED_CRASH'); TEST_CRASH_AT = '';
    adj(p.productId, -2000, 'LOST', 'Real adjustment ok');
    var h = Inventory_history(A, { productId: p.productId }); eq(h.length, 2, 'movements'); eq(h[0].qtyChange, -2000, 'latest first'); return eq(prod(p.productId).qty, 3000, 'qty');
  });
  t('I12 Staff: can list but never sees costs; cannot create, edit, adjust or run valuation', function () {
    var tok = user('zt_staff' + tag, 'STAFF'), p = mk(), l = call('listProducts', { search: p.sku }, tok);
    eq(l.ok, true, 'list ok'); eq('avgCost' in l.data[0] || 'purchasePrice' in l.data[0] || 'value' in l.data[0], false, 'costs hidden'); eq(l.data[0].sellingPrice, 15000, 'sees selling price');
    eq(call('createProduct', {}, tok).code, 'FORBIDDEN', 'create'); eq(call('updateProduct', {}, tok).code, 'FORBIDDEN', 'update'); eq(call('adjustStock', {}, tok).code, 'FORBIDDEN', 'adjust'); eq(call('inventoryValuation', {}, tok).code, 'FORBIDDEN', 'valuation');
    var h = call('getProductHistory', { productId: p.productId }, tok); return eq(h.ok, true, 'history ok');
  });
  t('I13 Engine reconciliation is still clean after all inventory activity', function () { var r = reconcile_(); if (!r.ok) throw new Error(r.issues.join('; ')); return true; });

  var failed = results.filter(function (r) { return r.indexOf('FAIL') === 0; }).length;
  ui.alert('Inventory tests: ' + (results.length - failed) + ' passed, ' + failed + ' failed\n\n' + results.join('\n'));
}
