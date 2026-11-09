const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../gestione_cc/www/financial-engine.js');

test('classifies parent with direct postings as Mastro e conto and leaf as Conto', () => {
  const accounts=[{id:'root'},{id:'auto',parentId:'root'},{id:'fuel',parentId:'auto'}];
  const result=engine.classifyHierarchy(accounts,[{status:'confirmed',counterpartAccountId:'auto'}]);
  assert.equal(result.find(a=>a.id==='root').hierarchyType,'Mastro');
  assert.equal(result.find(a=>a.id==='auto').hierarchyType,'Mastro e conto');
  assert.equal(result.find(a=>a.id==='fuel').hierarchyType,'Conto');
});

test('recognizes direct postings on the bank side of a transaction', () => {
  const result=engine.classifyHierarchy([{id:'bank-parent'},{id:'bank',parentId:'bank-parent'}],
    [{status:'confirmed',bankAccountId:'bank-parent'}]);
  assert.equal(result.find(a=>a.id==='bank-parent').hierarchyType,'Mastro e conto');
});

test('manual hierarchy override wins over automatic proposal', () => {
  const result=engine.classifyHierarchy([{id:'p',hierarchyTypeOverride:'Mastro e conto'},{id:'c',parentId:'p'}],[]);
  assert.equal(result[0].hierarchyType,'Mastro e conto');
  assert.equal(result[0].hierarchyTypeSource,'manuale');
});

test('consolidates direct parent amount plus child totals exactly once', () => {
  const accounts=[{id:'out'},{id:'auto',parentId:'out'},{id:'fuel',parentId:'auto'},{id:'park',parentId:'auto'}]
    .map(a=>({...a,hierarchyType:a.id==='out'?'Mastro':a.id==='auto'?'Mastro e conto':'Conto'}));
  const totals=engine.consolidateBalances(accounts,{auto:127,fuel:50,park:23});
  assert.equal(totals.auto.direct,127);
  assert.equal(totals.auto.consolidated,200);
  assert.equal(totals.out.consolidated,200);
});

test('rejects cyclic account trees', () => {
  assert.throws(()=>engine.consolidateBalances([{id:'a',parentId:'b'},{id:'b',parentId:'a'}]),/ciclica/);
});

test('recognizes monthly recurring transactions', () => {
  const inferred=engine.inferFrequency(['2026-01-10','2026-02-09','2026-03-11','2026-04-10']);
  assert.equal(inferred.frequency,'mensile');
});

test('detects recurring payments despite small amount variations', () => {
  const proposals=engine.detectRecurrences([
    {status:'confirmed',date:'2026-01-10',description:'Bolletta luce',counterpartAccountId:'energy',amount:-80},
    {status:'confirmed',date:'2026-02-09',description:'Bolletta luce',counterpartAccountId:'energy',amount:-82},
    {status:'confirmed',date:'2026-03-11',description:'Bolletta luce',counterpartAccountId:'energy',amount:-79},
    {status:'confirmed',date:'2026-04-10',description:'Bolletta luce',counterpartAccountId:'energy',amount:-81}
  ]);
  assert.equal(proposals.length,1);
  assert.equal(proposals[0].frequency,'mensile');
  assert.equal(proposals[0].amount,80.5);
});

test('budget snapshots preserve negative remaining and do not balance deficit away', () => {
  const snapshot=engine.buildBudgetSnapshot({month:'2026-11',categories:[{id:'food',type:'EXPENSE',hierarchyType:'Conto'}],
    monthlyHistory:{food:[100,120,110]},actuals:{food:140}});
  assert.equal(snapshot.lines[0].budget,110);
  assert.equal(snapshot.lines[0].remaining,-30);
});

test('forecast rolls each closing balance into next opening and separates flows', () => {
  const rows=engine.buildLiquidityForecast({openingBalance:1000,startMonth:'2026-11',horizonMonths:2,
    commitments:[{status:'confermato',date:'2026-11-15',direction:'uscita',amount:100}],
    estimates:{'2026-11':{income:50,expense:20},'2026-12':{income:50,expense:20}}});
  assert.equal(rows[0].closingBalance,930);
  assert.equal(rows[1].openingBalance,930);
  assert.equal(rows[1].closingBalance,960);
});
