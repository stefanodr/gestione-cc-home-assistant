/* Pure financial-domain helpers. No network, storage or account-specific assumptions. */
(function (root) {
  'use strict';
  const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  const monthOf = date => String(date || '').slice(0, 7);
  const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const median = values => {
    const a = values.filter(Number.isFinite).sort((x, y) => x - y);
    if (!a.length) return 0;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };

  function classifyHierarchy(accounts, transactions, overrides = {}) {
    const children = new Map(accounts.map(a => [String(a.id), []]));
    for (const account of accounts) {
      if (account.parentId != null && children.has(String(account.parentId))) {
        children.get(String(account.parentId)).push(account);
      }
    }
    const direct = new Set();
    for (const tx of transactions || []) {
      if (tx.status !== 'confirmed') continue;
      if (tx.counterpartAccountId != null) direct.add(String(tx.counterpartAccountId));
      for (const split of tx.counterpartSplits || []) if (split.accountId != null) direct.add(String(split.accountId));
    }
    return accounts.map(account => {
      const id = String(account.id), hasChildren = (children.get(id) || []).length > 0;
      const proposed = !hasChildren ? 'Conto' : direct.has(id) ? 'Mastro e conto' : 'Mastro';
      const override = overrides[id] || account.hierarchyTypeOverride || null;
      return { ...account, hierarchyType: override || proposed,
        hierarchyTypeSource: override ? 'manuale' : 'automatico',
        hierarchyTypeProposal: proposed, hasChildren, hasDirectMovements: direct.has(id) };
    });
  }

  function consolidateBalances(accounts, directBalances = {}) {
    const byId = new Map(accounts.map(a => [String(a.id), a]));
    const children = new Map(accounts.map(a => [String(a.id), []]));
    for (const a of accounts) if (a.parentId != null && children.has(String(a.parentId))) children.get(String(a.parentId)).push(a);
    const result = {}, visiting = new Set(), done = new Set();
    function visit(id) {
      if (done.has(id)) return result[id];
      if (visiting.has(id)) throw new Error('Gerarchia dei conti ciclica: ' + id);
      const account = byId.get(id);
      if (!account) return 0;
      visiting.add(id);
      const direct = account.hierarchyType === 'Mastro' ? 0 : Number(directBalances[id] ?? directBalances[account.id] ?? 0);
      const total = round2(direct + (children.get(id) || []).reduce((sum, child) => sum + visit(String(child.id)), 0));
      visiting.delete(id); done.add(id); result[id] = { direct: round2(direct), consolidated: total };
      return total;
    }
    for (const a of accounts) visit(String(a.id));
    return result;
  }

  const PERIODS = [
    ['settimanale', 7], ['quindicinale', 14], ['mensile', 30.4375],
    ['bimestrale', 60.875], ['trimestrale', 91.3125],
    ['quadrimestrale', 121.75], ['semestrale', 182.625], ['annuale', 365.25]
  ];
  function inferFrequency(dates) {
    const sorted = [...new Set(dates.filter(Boolean))].sort();
    if (sorted.length < 3) return null;
    const days = [];
    for (let i = 1; i < sorted.length; i++) {
      const delta = (Date.parse(sorted[i] + 'T12:00:00Z') - Date.parse(sorted[i - 1] + 'T12:00:00Z')) / 86400000;
      if (delta > 0) days.push(delta);
    }
    if (days.length < 2) return null;
    const typical = median(days);
    const candidate = PERIODS.map(([label, length]) => ({ label, length, error: Math.abs(typical - length) / length }))
      .sort((a, b) => a.error - b.error)[0];
    return candidate.error <= 0.22 ? { frequency: candidate.label, intervalDays: candidate.length, confidence: Math.max(0, 1 - candidate.error) } : null;
  }

  function detectRecurrences(transactions, options = {}) {
    const groups = new Map();
    for (const tx of transactions || []) {
      if (tx.status !== 'confirmed' || !tx.date) continue;
      const description = norm(tx.description || tx.payee || tx.causale);
      if (!description) continue;
      const splits = tx.counterpartSplits?.length ? tx.counterpartSplits : [{ accountId: tx.counterpartAccountId, value: tx.amount }];
      for (const split of splits) {
        const amount = Math.abs(Number(split.value) || 0);
        if (!amount) continue;
        const key = [description, split.accountId || ''].join('|');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ date: tx.date, amount, accountId: split.accountId || null, description: tx.description || tx.payee || '' });
      }
    }
    const proposals = [];
    for (const items of groups.values()) {
      const inferred = inferFrequency(items.map(x => x.date));
      if (!inferred) continue;
      const last = items.map(x => x.date).sort().at(-1);
      const next = new Date(last + 'T12:00:00');
      next.setDate(next.getDate() + Math.round(inferred.intervalDays));
      proposals.push({ description: items[0].description, normalizedDescription: norm(items[0].description),
        accountId: items[0].accountId, amount: round2(median(items.map(x => x.amount))),
        frequency: inferred.frequency, nextDate: next.toISOString().slice(0, 10),
        occurrences: items.length, confidence: round2(inferred.confidence), status: 'proposta', source: 'automatico' });
    }
    return proposals.sort((a, b) => b.confidence - a.confidence);
  }

  function buildBudgetSnapshot({ month, categories, monthlyHistory = {}, actuals = {}, recurring = [], minHistoryMonths = 3, version = 1 }) {
    const lines = categories.filter(c => c.type === 'EXPENSE' && c.hierarchyType !== 'Mastro')
      .map(category => {
        const values = (monthlyHistory[category.id] || []).filter(v => Number.isFinite(Number(v))).map(Number);
        const history = values.length >= minHistoryMonths ? values : (monthlyHistory[category.id + ':previous'] || []).map(Number);
        const estimate = round2(median(history));
        const fixed = round2(recurring.filter(r => r.status === 'confermato' && r.accountId === category.id && monthOf(r.nextDate) === month)
          .reduce((sum, r) => sum + Math.abs(Number(r.amount) || 0), 0));
        const budget = round2(estimate + fixed);
        const spent = round2(Number(actuals[category.id]) || 0);
        return { accountId: category.id, budget, spent, remaining: round2(budget - spent),
          utilization: budget > 0 ? round2(spent / budget * 100) : null, historySource: values.length >= minHistoryMonths ? 'anno_corrente' : 'anno_precedente' };
      });
    return { month, version, createdAt: new Date().toISOString(), status: 'proposta',
      lines, totalBudget: round2(lines.reduce((s, x) => s + x.budget, 0)),
      totalActual: round2(lines.reduce((s, x) => s + x.spent, 0)),
      totalRemaining: round2(lines.reduce((s, x) => s + x.remaining, 0)) };
  }

  function isDuplicateOccurrence(occurrence, transactions, tolerance = 0.02, windowDays = 5) {
    const occurrenceDate = occurrence.date || occurrence.nextDate;
    if (!occurrenceDate) return false;
    const target = Date.parse(occurrenceDate + 'T12:00:00Z');
    return (transactions || []).some(tx => {
      if (tx.status !== 'confirmed' || !tx.date) return false;
      const splits = tx.counterpartSplits?.length ? tx.counterpartSplits : [{ accountId: tx.counterpartAccountId, value: tx.amount }];
      const accountMatch = splits.some(s => String(s.accountId || '') === String(occurrence.accountId || ''));
      const amountMatch = splits.some(s => Math.abs(Math.abs(Number(s.value) || 0) - Math.abs(Number(occurrence.amount) || 0)) <= tolerance);
      const days = Math.abs(Date.parse(tx.date + 'T12:00:00Z') - target) / 86400000;
      return accountMatch && amountMatch && days <= windowDays &&
        (!occurrence.description || norm(tx.description || tx.payee) === norm(occurrence.description));
    });
  }

  function buildLiquidityForecast({ openingBalance, startMonth, asOfDate = startMonth + '-01', horizonMonths = 12, transactions = [], commitments = [], recurring = [], estimates = {} }) {
    let balance = Number(openingBalance) || 0;
    const rows = [];
    for (let i = 0; i < horizonMonths; i++) {
      const date = new Date(Number(startMonth.slice(0, 4)), Number(startMonth.slice(5, 7)) - 1 + i, 1);
      const month = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
      const actual = transactions.filter(t => t.status === 'confirmed' && monthOf(t.date) === month && t.date > asOfDate)
        .reduce((s, t) => s + (Number(t.signedAmount) || 0), 0);
      const planned = [...commitments, ...recurring].filter(x => x.status === 'confermato' && monthOf(x.date || x.nextDate) === month && !isDuplicateOccurrence(x, transactions));
      const incomeCertain = round2(planned.filter(x => x.direction === 'entrata' || (!x.direction && Number(x.signedAmount ?? x.amount) > 0)).reduce((s, x) => s + Math.abs(Number(x.signedAmount ?? x.amount)), 0));
      const expenseCertain = round2(planned.filter(x => x.direction === 'uscita' || (!x.direction && Number(x.signedAmount ?? x.amount) < 0)).reduce((s, x) => s + Math.abs(Number(x.signedAmount ?? x.amount)), 0));
      const estimate = estimates[month] || {};
      const estimatedIncome = round2(Number(estimate.income) || 0), estimatedExpense = round2(Number(estimate.expense) || 0);
      const netActual = i === 0 ? actual : 0;
      const opening = round2(balance);
      balance = round2(balance + netActual + incomeCertain - expenseCertain + estimatedIncome - estimatedExpense);
      rows.push({ month, openingBalance: opening, actualNet: netActual, incomeCertain, expenseCertain,
        estimatedIncome, estimatedExpense, closingBalance: balance });
    }
    return rows;
  }

  root.GestioneFinancialEngine = Object.freeze({ classifyHierarchy, consolidateBalances, inferFrequency,
    detectRecurrences, buildBudgetSnapshot, isDuplicateOccurrence, buildLiquidityForecast, normalizeDescription: norm });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GestioneFinancialEngine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
