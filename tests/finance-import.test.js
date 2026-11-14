'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

(async () => {

const source = fs.readFileSync('gestione_cc/www/app.js', 'utf8');
function extract(name, nextName) {
  const asyncStart = source.indexOf('async function ' + name + '(');
  const start = asyncStart >= 0 ? asyncStart : source.indexOf('function ' + name + '(');
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
// The forecast starts from the last closed month, so it includes the full
// current month even when a scheduled day is earlier than today's date.
assert.deepEqual(Array.from(forecastContext.forecastRecurringItems('2026-11', selected), r => r.id), ['past', 'future']);
const annualRule = { id: 'annual', active: true, bankAccountId: 'bank', description: 'Assicurazione', amount: -300, frequency: 'annual', day: 13, startDate: '2024-11-13' };
const italianAnnualRule = { ...annualRule, id: 'italian-annual', frequency: 'annuale', startDate: '2025-03-01', day: 1 };
assert.deepEqual(Array.from(forecastContext.recurringOccurrenceDates(annualRule, '2026-11')), ['2026-11-13']);
assert.deepEqual(Array.from(forecastContext.recurringOccurrenceDates(italianAnnualRule, '2027-03')), ['2027-03-01']);
assert.deepEqual(Array.from(forecastContext.recurringOccurrenceDates({ ...annualRule, active: false }, '2026-11')), []);
const matchingTx = { status: 'confirmed', bankAccountId: 'bank', date: '2026-11-16', amount: -700, description: 'Affitto' };
forecastContext.state.transactions = [matchingTx];
assert.equal(forecastContext.transactionIsExplicitlyRecurring(matchingTx, 'rent', '2026-11', selected), true);
assert.equal(forecastContext.recurringAlreadyRealized(futureRule, '2026-11-15'), true);
forecastContext.state.transactions = [{ ...matchingTx, amount: -900 }];
assert.equal(forecastContext.recurringAlreadyRealized(futureRule, '2026-11-15'), false);


const accountContext = {
  state: {
    accounts: [
      { id: 'bank', name: 'Conto', path: 'Attività:Conto', type: 'BANK' },
      { id: 'savings', name: 'Risparmi', path: 'Attività:Risparmi', type: 'BANK' },
      { id: 'card', name: 'Carta', path: 'Passività:Carta', type: 'CREDIT' },
      { id: 'expense', name: 'Uscite', path: 'Uscite', type: 'EXPENSE' },
      { id: 'food', name: 'Alimentari', path: 'Uscite:Alimentari', type: 'EXPENSE', parentId: 'expense' },
      { id: 'home', name: 'Casa', path: 'Uscite:Casa', type: 'EXPENSE', parentId: 'expense' }
    ]
  },
  normalize: value => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
  accountById: id => accountContext.state.accounts.find(a => a.id === id)
};
vm.createContext(accountContext);
vm.runInContext(extract('isLiquidAccount', 'periodTransactions') + '\n' +
  extract('budgetSpentByCategory', 'renderBudgetView') + '\n' +
  extract('forecastTransactionFlow', 'median') + '\n' +
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
assert.equal(budgetTotals.get('expense'), 220);


const forecastBuildContext = {
  state: {
    accounts: accountContext.state.accounts,
    bankAccountId: 'bank',
    openingBalance: 1000,
    forecastSettings: { accountIds: [] },
    budgetSnapshots: [],
    transactions: [
      { id: 'income', status: 'confirmed', date: '2026-11-01', bankAccountId: 'bank', counterpartAccountId: 'salary', amount: 200 },
      { id: 'transfer', status: 'confirmed', date: '2026-11-02', bankAccountId: 'bank', counterpartAccountId: 'savings', amount: -100, counterpartSplits: [{ accountId: 'savings', value: 100 }] },
      { id: 'savings-expense', status: 'confirmed', date: '2026-11-03', bankAccountId: 'savings', counterpartAccountId: 'food', amount: -50 },
      { id: 'pending', status: 'pending', date: '2026-11-04', bankAccountId: 'bank', counterpartAccountId: 'food', amount: -999 },
      { id: 'future', status: 'confirmed', date: '2026-12-01', bankAccountId: 'bank', counterpartAccountId: 'salary', amount: 400 }
    ],
    recurringRules: []
  },
  normalize: value => String(value || '').toLowerCase().trim(),
  transactionDescription: tx => tx.description || '',
  localDateKey: () => '2026-11-09',
  requestAnimationFrame: callback => setImmediate(callback),
  accountById: id => forecastBuildContext.state.accounts.find(a => a.id === id)
};
vm.createContext(forecastBuildContext);
const buildHelpers = [
  extract('isLiquidAccount', 'periodTransactions'),
  extract('forecastSelectedAccounts', 'monthKeyFromDate'),
  extract('monthKeyFromDate', 'monthOccurrence'),
  extract('monthOccurrence', 'recurringOccursInMonth'),
  extract('recurringOccursInMonth', 'transactionMatchesRecurringRule'),
  extract('transactionMatchesRecurringRule', 'recurringAlreadyRealized'),
  extract('recurringAlreadyRealized', 'forecastRecurringItems'),
  extract('forecastRecurringItems', 'transactionIsExplicitlyRecurring'),
  extract('transactionIsExplicitlyRecurring', 'forecastTransactionFlow'),
  extract('forecastTransactionFlow', 'median'),
  extract('median', 'renderRecurringRules'),
  extract('activeBudgetSnapshot', 'budgetEligibleAccounts'),
  extract('buildForecast', 'renderForecastSelection')
].join('\n');
vm.runInContext(buildHelpers + '\nthis.buildForecast = buildForecast;', forecastBuildContext);
const allForecast = await forecastBuildContext.buildForecast();
assert.equal(allForecast.currentBalance, 1000);
assert.equal(allForecast.openingBalanceUnknown.length, 1);
forecastBuildContext.state.forecastSettings.accountIds = ['bank'];
const bankForecast = await forecastBuildContext.buildForecast();
assert.equal(bankForecast.currentBalance, 1000);
assert.equal(bankForecast.openingBalanceUnknown.length, 0);
forecastBuildContext.state.forecastSettings.accountIds = ['savings'];
const savingsForecast = await forecastBuildContext.buildForecast();
assert.equal(savingsForecast.currentBalance, 0);
assert.equal(savingsForecast.openingBalanceUnknown.length, 1);

const annualRecurrenceContext = {
  state: {
    transactions: [
      { status: 'confirmed', date: '2024-10-15', bankAccountId: 'bank', counterpartAccountId: 'insurance', amount: -350, description: 'Assicurazione auto' },
      { status: 'confirmed', date: '2025-10-15', bankAccountId: 'bank', counterpartAccountId: 'insurance', amount: -360, description: 'Assicurazione auto' }
    ],
    recurringRules: [],
    recurringProposals: []
  },
  normalize: value => String(value || '').toLowerCase().trim(),
  transactionDescription: tx => tx.description || '',
  transactionCausale: tx => tx.memo || '',
  localDateKey: date => date.toISOString().slice(0,10),
  uid: prefix => prefix + '-test',
  renderRecurringProposals: () => {},
  saveState: () => {}
};
vm.createContext(annualRecurrenceContext);
vm.runInContext(extract('detectRecurringProposals', 'renderRecurringProposals') + '\nthis.detect = detectRecurringProposals;', annualRecurrenceContext);
annualRecurrenceContext.detect();
assert.equal(annualRecurrenceContext.state.recurringProposals.length, 1);
assert.equal(annualRecurrenceContext.state.recurringProposals[0].frequency, 'yearly');
assert.equal(annualRecurrenceContext.state.recurringProposals[0].occurrences, 2);

console.log('OK: OFX, ricorrenze, trasferimenti, budget e saldi previsionali su più conti.');
})().catch(error => { console.error(error); process.exitCode = 1; });
