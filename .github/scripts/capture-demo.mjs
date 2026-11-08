import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve('docs/screenshots');
fs.mkdirSync(outputDir, { recursive: true });

function demoState() {
  const now = new Date();
  const yearNow = now.getFullYear();
  const monthNow = now.getMonth();
  const accounts = [
    { id: 'root', name: 'Conti', path: 'Conti', type: 'ROOT', classification: 'Strutturale', parentId: null },
    { id: 'assets', name: 'Attività', path: 'Attività', type: 'ASSET', classification: 'Patrimoniale', parentId: 'root' },
    { id: 'bank', name: 'Conto corrente', path: 'Attività:Conto corrente', type: 'BANK', classification: 'Patrimoniale', parentId: 'assets' },
    { id: 'savings', name: 'Risparmi', path: 'Attività:Risparmi', type: 'BANK', classification: 'Patrimoniale', parentId: 'assets' },
    { id: 'liabilities', name: 'Passività', path: 'Passività', type: 'LIABILITY', classification: 'Patrimoniale', parentId: 'root' },
    { id: 'card', name: 'Carta di credito', path: 'Passività:Carta di credito', type: 'CREDIT', classification: 'Patrimoniale', parentId: 'liabilities' },
    { id: 'equity', name: 'Patrimonio netto', path: 'Patrimonio netto', type: 'EQUITY', classification: 'Patrimoniale', parentId: 'root' },
    { id: 'income', name: 'Entrate', path: 'Entrate', type: 'INCOME', classification: 'Economica', parentId: 'root' },
    { id: 'salary', name: 'Stipendio', path: 'Entrate:Stipendio', type: 'INCOME', classification: 'Economica', parentId: 'income' },
    { id: 'income-other', name: 'Altre entrate', path: 'Entrate:Altre entrate', type: 'INCOME', classification: 'Economica', parentId: 'income' },
    { id: 'expense', name: 'Uscite', path: 'Uscite', type: 'EXPENSE', classification: 'Economica', parentId: 'root' },
    { id: 'grocery', name: 'Alimentari', path: 'Uscite:Alimentari', type: 'EXPENSE', classification: 'Economica', parentId: 'expense' },
    { id: 'home', name: 'Casa', path: 'Uscite:Casa', type: 'EXPENSE', classification: 'Economica', parentId: 'expense' },
    { id: 'transport', name: 'Trasporti', path: 'Uscite:Trasporti', type: 'EXPENSE', classification: 'Economica', parentId: 'expense' },
    { id: 'utilities', name: 'Utenze', path: 'Uscite:Utenze', type: 'EXPENSE', classification: 'Economica', parentId: 'expense' },
    { id: 'health', name: 'Salute', path: 'Uscite:Salute', type: 'EXPENSE', classification: 'Economica', parentId: 'expense' },
    { id: 'other-expense', name: 'Varie', path: 'Uscite:Varie', type: 'EXPENSE', classification: 'Economica', parentId: 'expense' },
    { id: 'trading', name: 'Trading', path: 'Trading', type: 'TRADING', classification: 'Tecnica', parentId: 'root' }
  ];
  const transactions = [];
  for (let year = yearNow - 3; year <= yearNow; year++) {
    const monthLimit = year === yearNow ? monthNow : 11;
    for (let month = 0; month <= monthLimit; month++) {
      const mm = String(month + 1).padStart(2, '0');
      const jitter = ((year * 7 + month * 13) % 31) - 15;
      transactions.push({ id: `demo-salary-${year}-${mm}`, date: `${year}-${mm}-27`, amount: 2050 + (year - (yearNow - 3)) * 85, payee: 'Datore di lavoro', memo: 'Stipendio mensile', bankAccountId: 'bank', counterpartAccountId: 'salary', status: 'confirmed', confidence: 1, source: 'demo' });
      transactions.push({ id: `demo-market-${year}-${mm}`, date: `${year}-${mm}-05`, amount: -(185 + (month % 4) * 11 + jitter), payee: 'Market Alfa', memo: 'Spesa alimentare', bankAccountId: 'bank', counterpartAccountId: 'grocery', status: 'confirmed', confidence: 1, source: 'demo' });
      transactions.push({ id: `demo-home-${year}-${mm}`, date: `${year}-${mm}-03`, amount: -690, payee: 'Affitto', memo: 'Canone mensile', bankAccountId: 'bank', counterpartAccountId: 'home', status: 'confirmed', confidence: 1, source: 'demo' });
      transactions.push({ id: `demo-transit-${year}-${mm}`, date: `${year}-${mm}-13`, amount: -(48 + (month % 3) * 6), payee: 'Mobilità', memo: 'Trasporti', bankAccountId: 'bank', counterpartAccountId: 'transport', status: 'confirmed', confidence: 1, source: 'demo' });
      if (month % 3 === 0) transactions.push({ id: `demo-energy-${year}-${mm}`, date: `${year}-${mm}-18`, amount: -(92 + (month % 4) * 8), payee: 'Energia', memo: 'Utenza domestica', bankAccountId: 'bank', counterpartAccountId: 'utilities', status: 'confirmed', confidence: 1, source: 'demo' });
      if (month === 4 || month === 10) transactions.push({ id: `demo-health-${year}-${mm}`, date: `${year}-${mm}-11`, amount: -(22 + month), payee: 'Farmacia', memo: 'Acquisto salute', bankAccountId: 'bank', counterpartAccountId: 'health', status: 'confirmed', confidence: 1, source: 'demo' });
    }
  }
  transactions.push({ id: 'demo-pending-1', date: `${yearNow}-${String(monthNow + 1).padStart(2, '0')}-06`, amount: -36.5, payee: 'Caffè Aurora', memo: 'Pagamento carta', bankAccountId: 'bank', counterpartAccountId: null, status: 'pending', confidence: 0.2, source: 'demo' });
  transactions.push({ id: 'demo-pending-2', date: `${yearNow}-${String(monthNow + 1).padStart(2, '0')}-04`, amount: 74, payee: 'Rimborso', memo: 'Accredito', bankAccountId: 'bank', counterpartAccountId: null, status: 'pending', confidence: 0.2, source: 'demo' });
  const rules = [
    ['Market Alfa', 'grocery', 8], ['Affitto', 'home', 8], ['Mobilità', 'transport', 8],
    ['Energia', 'utilities', 4], ['Datore di lavoro', 'salary', 8]
  ].map(([payee, accountId, hits], i) => ({ id: `demo-rule-${i}`, field: 'payee', token: payee.toLowerCase(), accountId, hits, source: 'demo' }));
  const previous = new Date(yearNow, monthNow - 1, 1);
  const selectedMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
  return { version: 1, demo: true, accounts, transactions, rules, bankAccountId: 'bank', reportAccountId: 'bank', openingBalance: 1840, selectedMonth, lastSaved: now.toISOString() };
}

const state = demoState();
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => console.error('Browser page error:', error.message));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/state' && route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ csrf: 'fictional-demo-token', revision: 1, state }) });
    }
    if (url.pathname === '/api/state' && route.request().method() === 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ revision: 2 }) });
    }
    if (url.pathname === '/api/storage-info') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ exists: true, path: 'ARCHIVIO DIMOSTRATIVO', size_bytes: 128000 }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.classList.contains('app-ready'), { timeout: 30000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outputDir, 'panoramica.png'), fullPage: false });

  await page.locator('.nav-item[data-view="transactions"]').click();
  await page.waitForFunction(() => document.querySelector('#view-transactions')?.classList.contains('active'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outputDir, 'movimenti.png'), fullPage: false });

  await page.locator('.nav-item[data-view="reports"]').click();
  await page.waitForFunction(() => document.querySelector('#view-reports')?.classList.contains('active'));
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outputDir, 'report.png'), fullPage: false });
  console.log('Created three screenshots from the actual Gestione C/C frontend using fictional demo data only.');
} finally {
  await browser.close();
}
