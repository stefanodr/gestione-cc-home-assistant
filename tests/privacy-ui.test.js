'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

(async () => {
  const source = fs.readFileSync('gestione_cc/www/app.js', 'utf8');
  const start = source.indexOf('  function maskNumericText(root)');
  const end = source.indexOf('  const DB_NAME', start);
  assert.ok(start >= 0 && end > start, 'Funzioni privacy non trovate');
  const dom = new JSDOM(`<!doctype html><body>
    <label class="privacy-toggle"><input id="privacyToggle" type="checkbox" role="switch"><span>Nascondi importi</span></label>
    <p id="transaction">Movimento del 14/11/2026: <span class="amount-cell">-1.234,56 €</span></p>
    <p id="currency">Totale € 99,90</p>
    <p id="date">Documento 14/11/2026 · codice 123456</p>
    <p id="report">Confronto 2025 · variazione +12,3% · scostamento +45,90 €</p>
    <input id="editable" value="1234.56">
    <canvas id="chart"></canvas>
  </body>`, { pretendToBeVisual: true });
  const context = {
    document: dom.window.document, Node: dom.window.Node, NodeFilter: dom.window.NodeFilter,
    MutationObserver: dom.window.MutationObserver,
    $: selector => dom.window.document.querySelector(selector)
  };
  vm.createContext(context);
  vm.runInContext(`let privacyMode = false; let privacyObserver = null;\n${source.slice(start, end)}
    this.setupPrivacyControls = setupPrivacyControls;
  `, context);
  context.setupPrivacyControls();
  const doc = dom.window.document, toggle = doc.querySelector('#privacyToggle');
  const amount = doc.querySelector('.amount-cell'), currency = doc.querySelector('#currency');
  const date = doc.querySelector('#date'), report = doc.querySelector('#report'), input = doc.querySelector('#editable');

  assert.equal(toggle.checked, false, 'Lo switch deve partire OFF');
  assert.equal(amount.textContent, '-1.234,56 €');
  assert.match(date.textContent, /14\/11\/2026/);
  toggle.checked = true; toggle.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(toggle.checked, true);
  assert.match(amount.textContent, /\*+/, 'Gli importi identificati come tali devono essere mascherati');
  assert.match(currency.textContent, /\*+/, 'Anche gli importi riconosciuti dal simbolo euro devono essere mascherati');
  assert.match(date.textContent, /14\/11\/2026/, 'Le date e i codici non monetari devono restare leggibili');
  assert.equal(input.value, '1234.56', 'I campi di inserimento devono restare modificabili');

  const dynamic = doc.createElement('td');
  dynamic.className = 'amount-out';
  dynamic.textContent = '-45,90 €';
  doc.body.append(dynamic);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(dynamic.textContent, /\*+/, 'Gli importi aggiunti dinamicamente devono essere mascherati');

  toggle.checked = false; toggle.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(amount.textContent, '-1.234,56 €', 'OFF deve ripristinare l’importo originale');
  assert.equal(currency.textContent, 'Totale € 99,90');
  assert.equal(dynamic.textContent, '-45,90 €', 'OFF deve ripristinare anche i contenuti dinamici');
  assert.equal(date.textContent, 'Documento 14/11/2026 · codice 123456');
  assert.equal(report.textContent, 'Confronto 2025 · variazione +12,3% · scostamento +45,90 €');
  assert.equal(input.value, '1234.56');
  console.log('OK: switch privacy OFF/ON, importi statici e dinamici, date/codici e campi modificabili.');
  dom.window.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
