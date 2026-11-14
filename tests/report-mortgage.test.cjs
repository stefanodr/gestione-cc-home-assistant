const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '../gestione_cc/www/app.js'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '../gestione_cc/www/index.html'), 'utf8');

test('mortgage accounts are excluded from transfer totals and inherited by subaccounts', () => {
  assert.match(app, /function isMortgageAccount\(account\)[\s\S]*?if \(current\.mortgage === true\) return true/);
  assert.match(app, /account\?\.classification === 'Patrimoniale' && !isMortgageAccount\(account\)/);
});

test('mortgage accounts are included in report expense classification independently of Budget/Report', () => {
  assert.match(app, /account\.classification === 'Patrimoniale' && \(account\.includeInBudget === true \|\| isMortgageAccount\(account\)\)/);
  assert.match(app, /if \(isReportExpenseAccount\(account\)\)/);
});

test('mortgage flag does not change budget or forecast eligibility', () => {
  assert.match(app, /function budgetEligibleAccounts\(\)[\s\S]*?a\.includeInBudget === true && !isLiquidAccount\(a\)/);
  assert.match(app, /const categories=state\.accounts\.filter[\s\S]*?a\.includeInBudget===true&&!isLiquidAccount\(a\)/);
});

test('Chart of Accounts exposes Budget/Report and Mortgage controls', () => {
  assert.match(index, /<th>Budget\/Report<\/th><th>Mutuo<\/th>/);
  assert.match(app, /data-mortgage-account/);
  assert.match(app, /account\.mortgage=input\.checked/);
});
