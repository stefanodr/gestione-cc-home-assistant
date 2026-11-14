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
    <div class="privacy-control">
      <button data-privacy-mode="1">1 · Tutto visibile</button>
      <button data-privacy-mode="2">2 · Saldi nascosti</button>
      <button data-privacy-mode="3">3 · Tutto nascosto</button>
    </div>
    <p id="ordinary">Movimento del 14/11/2026: 1.234,56 euro</p>
    <strong id="balance" class="privacy-balance">1.234,56 €</strong>
    <input id="editable" value="1234.56">
    <canvas id="chart"></canvas>
  </body>`, { pretendToBeVisual: true });
  const context = {
    document: dom.window.document,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    MutationObserver: dom.window.MutationObserver
  };
  vm.createContext(context);
  vm.runInContext(`let privacyMode = '1'; let privacyObserver = null;\n${source.slice(start, end)}
    this.setupPrivacyControls = setupPrivacyControls;
  `, context);
  context.setupPrivacyControls();
  const doc = dom.window.document;
  const balance = doc.querySelector('#balance');
  const ordinary = doc.querySelector('#ordinary');
  const editable = doc.querySelector('#editable');

  assert.equal(doc.body.dataset.privacy, '1');
  assert.equal(balance.classList.contains('privacy-hidden'), false);
  assert.match(ordinary.textContent, /1\.234,56/);
  assert.equal(doc.querySelector('[data-privacy-mode="1"]').getAttribute('aria-pressed'), 'true');

  doc.querySelector('[data-privacy-mode="2"]').click();
  assert.equal(doc.body.dataset.privacy, '2');
  assert.equal(balance.classList.contains('privacy-hidden'), true);
  assert.match(ordinary.textContent, /1\.234,56/, 'La modalità 2 deve lasciare visibili gli importi non classificati come saldo');
  assert.equal(editable.value, '1234.56');
  assert.equal(doc.querySelector('[data-privacy-mode="2"]').getAttribute('aria-pressed'), 'true');

  doc.querySelector('[data-privacy-mode="3"]').click();
  assert.equal(doc.body.dataset.privacy, '3');
  assert.equal(balance.classList.contains('privacy-hidden'), true);
  assert.doesNotMatch(ordinary.textContent, /\d/, 'La modalità 3 deve oscurare tutte le cifre del testo');
  assert.match(ordinary.textContent, /\*+/, 'La modalità 3 deve sostituire le cifre con asterischi');
  assert.equal(editable.value, '1234.56', 'I campi modificabili devono restare leggibili');
  assert.equal(doc.querySelector('[data-privacy-mode="3"]').getAttribute('aria-pressed'), 'true');

  const dynamic = doc.createElement('p');
  dynamic.id = 'dynamic';
  dynamic.textContent = 'Documento 20261114 · totale 99,90';
  doc.body.append(dynamic);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.doesNotMatch(dynamic.textContent, /\d/, 'Anche i contenuti aggiunti dinamicamente devono essere oscurati');

  doc.querySelector('[data-privacy-mode="1"]').click();
  assert.equal(doc.body.dataset.privacy, '1');
  assert.equal(balance.classList.contains('privacy-hidden'), false);
  assert.match(ordinary.textContent, /1\.234,56/, 'La modalità 1 deve ripristinare i valori originali');
  assert.equal(dynamic.textContent, 'Documento 20261114 · totale 99,90', 'La modalità 1 deve ripristinare anche i contenuti dinamici');
  assert.equal(editable.value, '1234.56');
  console.log('OK: privacy 1, 2 e 3; aggiornamenti dinamici; campi di modifica.');
  dom.window.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
