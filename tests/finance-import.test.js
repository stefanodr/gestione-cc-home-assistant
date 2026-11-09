'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('gestione_cc/www/app.js', 'utf8');
function extract(name, nextName) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'Funzione non trovata: ' + name);
  const end = source.indexOf('function ' + nextName + '(', start + 1);
  assert.notEqual(end, -1, 'Delimitatore non trovato: ' + nextName);
  return source.slice(start, end);
}
const parseAmount = extract('parseAmount', 'normalize');
const ofxParser = extract('parseOfxDate', 'parseQif');
const context = { uid: prefix => prefix + '-test', parseAmount: null };
vm.createContext(context);
vm.runInContext(parseAmount + '\n' + ofxParser + '\nthis.parseOfx = parseOfx;', context);
assert.equal(context.parseAmount('1.234,56'), 1234.56);
assert.equal(context.parseAmount('-45.90'), -45.9);
assert.equal(context.parseAmount('(12,50)'), -12.5);

const xml = `<?xml version="1.0"?>
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261015</DTPOSTED><TRNAMT>-45.90</TRNAMT><FITID>ABC-001</FITID><NAME>Supermercato</NAME><MEMO>Spesa settimanale</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20261020</DTPOSTED><TRNAMT>1250.00</TRNAMT><FITID>ABC-002</FITID><NAME>Stipendio</NAME></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
const parsedXml = context.parseOfx(xml);
assert.equal(parsedXml.length, 2);
assert.equal(parsedXml[0].date, '2026-10-15');
assert.equal(parsedXml[0].amount, -45.9);
assert.equal(parsedXml[0].fitid, 'ABC-001');
assert.equal(parsedXml[0].description, 'Supermercato');
assert.equal(parsedXml[1].amount, 1250);

const sgml = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261101
<TRNAMT>-9,99
<FITID>SGML-001
<NAME>Bar
<MEMO>Caffe
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261102
<TRNAMT>20.00
<FITID>SGML-002
<NAME>Rimborso
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;
const parsedSgml = context.parseOfx(sgml);
assert.equal(parsedSgml.length, 2);
assert.equal(parsedSgml[0].amount, -9.99);
assert.equal(parsedSgml[0].memo, 'Caffe');
assert.equal(parsedSgml[1].date, '2026-11-02');
assert.equal(context.parseOfx('<OFX></OFX>').length, 0);

const forecastHelpers = [
  extract('monthOccurrence', 'recurringOccursInMonth'),
  extract('recurringOccursInMonth', 'transactionMatchesRecurringRule'),
  extract('transactionMatchesRecurringRule', 'recurringAlreadyRealized'),
  extract('recurringAlreadyRealized', 'forecastRecurringItems'),
  extract('forecastRecurringItems', 'transactionIsExplicitlyRecurring'),
  extract('transactionIsExplicitlyRecurring', 'forecastTransactionFlow')
].join('\n');
const forecastContext = {
  state: { transactions: [], recurringRules: [] },
  normalize: value => String(value || '').toLowerCase().trim(),
  transactionDescription: tx => tx.description || '',
  localDateKey: () => '2026-11-09'
};
vm.createContext(forecastContext);
vm.runInContext(forecastHelpers, forecastContext);
const pastRule = { id: 'past', active: true, bankAccountId: 'bank', categoryId: 'rent', description: 'Affitto', amount: -700, frequency: 'monthly', day: 5, startDate: '2026-01-05' };
const futureRule = { id: 'future', active: true, bankAccountId: 'bank', categoryId: 'rent', description: 'Affitto', amount: -700, frequency: 'monthly', day: 15, startDate: '2026-01-15' };
forecastContext.state.recurringRules = [pastRule, futureRule];
const selected = new Set(['bank']);
assert.deepEqual(Array.from(forecastContext.forecastRecurringItems('2026-11', selected), r => r.id), ['future']);
const matchingTx = { status: 'confirmed', bankAccountId: 'bank', date: '2026-11-16', amount: -700, description: 'Affitto' };
forecastContext.state.transactions = [matchingTx];
assert.equal(forecastContext.transactionIsExplicitlyRecurring(matchingTx, 'rent', '2026-11', selected), true);
assert.equal(forecastContext.recurringAlreadyRealized(futureRule, '2026-11'), true);
forecastContext.state.transactions = [{ ...matchingTx, amount: -900 }];
assert.equal(forecastContext.recurringAlreadyRealized(futureRule, '2026-11'), false);


const accountContext = {
  state: {
    accounts: [
      { id: 'bank', name: 'Conto', path: 'Attività:Conto', type: 'BANK' },
      { id: 'savings', name: 'Risparmi', path: 'Attività:Risparmi', type: 'BANK' },
      { id: 'card', name: 'Carta', path: 'Passività:Carta', type: 'CREDIT' },
      { id: 'food', name: 'Alimentari', path: 'Uscite:Alimentari', type: 'EXPENSE' },
      { id: 'home', name: 'Casa', path: 'Uscite:Casa', type: 'EXPENSE' }
    ]
  },
  normalize: value => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
  accountById: id => accountContext.state.accounts.find(a => a.id === id)
};
vm.createContext(accountContext);
vm.runInContext(extract('isLiquidAccount', 'periodTransactions') + '\\n' +
  extract('budgetSpentByCategory', 'renderBudgetView') + '\\n' +
  extract('forecastTransactionFlow', 'median') + '\\n' +
  'this.isLiquidAccount = isLiquidAccount; this.budgetSpentByCategory = budgetSpentByCategory; this.forecastTransactionFlow = forecastTransactionFlow;', accountContext);
assert.equal(accountContext.isLiquidAccount(accountContext.accountById('bank')), true);
assert.equal(accountContext.isLiquidAccount(accountContext.accountById('savings')), true);
assert.equal(accountContext.isLiquidAccount(accountContext.accountById('card')), false);
const both = new Set(['bank', 'savings']);
const onlyBank = new Set(['bank']);
const onlySavings = new Set(['savings']);
const transfer = { status: 'confirmed', bankAccountId: 'bank', counterpartAccountId: 'savings', amount: -100, counterpartSplits: [{ accountId: 'savings', value: 100 }] };
assert.equal(accountContext.forecastTransactionFlow(transfer, both), 0);
assert.equal(accountContext.forecastTransactionFlow(transfer, onlyBank), -100);
assert.equal(accountContext.forecastTransactionFlow(transfer, onlySavings), 100);
const unsplitTransfer = { status: 'confirmed', bankAccountId: 'bank', counterpartAccountId: 'savings', amount: -75 };
assert.equal(accountContext.forecastTransactionFlow(unsplitTransfer, both), 0);
assert.equal(accountContext.forecastTransactionFlow(unsplitTransfer, onlySavings), 75);
const budgetTotals = accountContext.budgetSpentByCategory([
  { status: 'confirmed', date: '2026-11-02', amount: -100, counterpartAccountId: 'food' },
  { status: 'confirmed', date: '2026-11-03', amount: -120, counterpartSplits: [{ accountId: 'food', value: -70 }, { accountId: 'home', value: -50 }] },
  { status: 'pending', date: '2026-11-04', amount: -999, counterpartAccountId: 'food' },
  { status: 'confirmed', date: '2026-10-31', amount: -888, counterpartAccountId: 'food' }
], '2026-11');
assert.equal(budgetTotals.get('food'), 170);
assert.equal(budgetTotals.get('home'), 50);

console.log('OK: OFX, ricorrenze, conti liquidi, trasferimenti selezionati e budget con movimenti suddivisi.');
