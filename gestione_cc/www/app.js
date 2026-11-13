(() => {
  'use strict';

  const APP_VERSION = '1.7.13';
  const DB_NAME = 'ContiChiariPrototype';
  const DB_VERSION = 1;
  const DB_STORE = 'app';
  let csrfToken = '';
  let stateRevision = 0;
  let saveQueue = Promise.resolve();
  let state;
  let reportMode = 'monthly';
  let transactionPage = 0;
  let documentSearchOffset = 0;
  let advancedSearchResults = [];
  let attachmentCounts = {};
  let transactionSelection = new Set();
  let confirmCallback = null;
  let resizeTimer;
  let editingRecurringId = null;
  let editingDocumentId = null;

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, useGrouping: true });
  const shortEuro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: true });
  const reportNumber = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
  const reportShortNumber = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: true });

  function uid(prefix = 'm') { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
  function localDateKey(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function parseDate(value) {
    if (!value) return '';
    const match = String(value).trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : localDateKey(d);
  }
  function parseQifDate(value) {
    const raw = String(value || '').trim().replace(/\[[^\]]+\]/g, '').replace(/'/g, '/').replace(/-/g, '/');
    let m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      let year = Number(m[3]);
      if (year < 100) year += year < 70 ? 2000 : 1900;
      // Italian bank exports normally use day/month/year.
      return `${year}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
    }
    m = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[3])).padStart(2, '0')}`;
    return parseDate(value);
  }
  const amountInputFormat = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
  function ungroupAmountField(input) {
    const value = parseAmount(input.value);
    if (Number.isFinite(value)) input.value = value.toFixed(2);
  }
  function groupAmountField(input) {
    const value = parseAmount(input.value);
    if (Number.isFinite(value)) input.value = amountInputFormat.format(value);
  }
  function parseAmount(value) {
    if (typeof value === 'number') return value;
    let s = String(value ?? '').trim().replace(/[€$£\s]/g, '').replace(/[A-Z]{3}$/i, '').replace(/[()]/g, '');
    if (!s) return NaN;
    const negative = /^-/.test(s) || /^\(.*\)$/.test(String(value).trim());
    s = s.replace(/^[+-]/, '').replace(/\.$/, '');
    const comma = s.lastIndexOf(',');
    const dot = s.lastIndexOf('.');
    if (comma >= 0 && dot >= 0) {
      if (comma > dot) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (comma >= 0) {
      const tail = s.length - comma - 1;
      s = tail === 3 ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if ((s.match(/\./g) || []).length > 1) {
      const last = s.lastIndexOf('.');
      s = s.slice(0, last).replace(/\./g, '') + s.slice(last);
    }
    const n = Number(s);
    return Number.isFinite(n) ? (negative ? -n : n) : NaN;
  }
  function normalize(text) {
    return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  }
  function safeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function formatDate(value) {
    if (!value) return '—';
    const [y, m, d] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d));
  }
  function transactionDescription(tx) { return String(tx?.description ?? tx?.payee ?? '').trim(); }
  function transactionCausale(tx) {
    const value = String(tx?.causale ?? tx?.memo ?? '').trim();
    return normalize(value) === normalize(transactionDescription(tx)) ? '' : value;
  }
  function monthName(value) {
    const [y, m] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
  }
  function syncReportPeriodPicker(monthKey, mode = reportMode) {
    const [yearInput, monthInput] = (monthKey || localDateKey(new Date()).slice(0, 7)).split('-').map(Number);
    const today = new Date();
    const step = mode === 'quarterly' ? 3 : mode === 'halfyearly' ? 6 : mode === 'annual' ? 12 : 1;
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const safeYear = Math.min(yearInput, currentYear);
    const safeMonth = safeYear === currentYear ? Math.min(monthInput, currentMonth) : monthInput;
    const periodEnd = safeYear === currentYear ? Math.min(currentMonth, mode === 'annual' ? currentMonth : Math.ceil(safeMonth / step) * step) : Math.min(12, Math.ceil(safeMonth / step) * step);
    const selected = `${safeYear}-${String(periodEnd).padStart(2, '0')}`;
    const years = state.transactions.map(tx => Number(String(tx.date || '').slice(0, 4))).filter(Number.isFinite);
    const minYear = Math.min(currentYear - 8, years.length ? Math.min(...years) : currentYear - 8, yearInput);
    const maxYear = currentYear;
    const labels = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
    const options = [];
    for (let y = maxYear; y >= minYear; y--) {
      if (mode === 'monthly') {
        const lastMonth = y === today.getFullYear() ? today.getMonth() + 1 : 12;
        for (let m = lastMonth; m >= 1; m--) {
          const value = `${y}-${String(m).padStart(2, '0')}`;
          options.push(`<option value="${value}">${safeText(monthName(value))}</option>`);
        }
      } else if (mode === 'quarterly') {
        const lastQuarter = y === today.getFullYear() ? Math.ceil((today.getMonth() + 1) / 3) : 4;
        for (let q = lastQuarter; q >= 1; q--) {
          const start = (q - 1) * 3, end = start + 2;
          const valueMonth = y === today.getFullYear() && q === lastQuarter ? today.getMonth() + 1 : end + 1;
          const value = `${y}-${String(valueMonth).padStart(2, '0')}`;
          options.push(`<option value="${value}">${q}° trimestre · ${labels[start]}–${labels[end]} ${y}</option>`);
        }
      } else if (mode === 'halfyearly') {
        const lastHalf = y === today.getFullYear() ? (today.getMonth() + 1 <= 6 ? 1 : 2) : 2;
        for (let half = lastHalf; half >= 1; half--) {
          const start = (half - 1) * 6, end = start + 5;
          const valueMonth = y === today.getFullYear() && half === lastHalf ? today.getMonth() + 1 : end + 1;
          const value = `${y}-${String(valueMonth).padStart(2, '0')}`;
          options.push(`<option value="${value}">${half}° semestre · ${labels[start]}–${labels[end]} ${y}</option>`);
        }
      } else {
        const annualEnd = y === today.getFullYear() ? today.getMonth() + 1 : 12;
        options.push(`<option value="${y}-${String(annualEnd).padStart(2, '0')}">Anno ${y}</option>`);
      }
    }
    const picker = $('#reportMonth');
    picker.innerHTML = options.join('');
    picker.value = selected;
    return selected;
  }
  function overviewMonthForReportPeriod(periodKey, mode = reportMode) {
    const [year, periodMonth] = periodKey.split('-').map(Number);
    const now = new Date(), nowMonth = now.getMonth() + 1;
    if (mode === 'monthly') return periodKey;
    if (year === now.getFullYear()) {
      if (mode === 'annual') return `${year}-${String(nowMonth).padStart(2, '0')}`;
      const span = mode === 'quarterly' ? 3 : 6;
      const start = Math.floor((periodMonth - 1) / span) * span + 1;
      const end = start + span - 1;
      if (nowMonth >= start && nowMonth <= end && periodMonth > nowMonth) return `${year}-${String(nowMonth).padStart(2, '0')}`;
    }
    return periodKey;
  }

  function defaultAccounts() {
    return [
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
  }

  function createDemoState() {
    const accounts = defaultAccounts();
    const tx = [];
    const now = new Date();
    const endYear = now.getFullYear();
    const endMonth = now.getMonth();
    const merchants = [
      ['Market Alfa', 'grocery', -1], ['Affitto', 'home', -1], ['Mobilità', 'transport', -1],
      ['Energia', 'utilities', -1], ['Farmacia', 'health', -1]
    ];
    for (let year = endYear - 3; year <= endYear; year++) {
      const monthLimit = year === endYear ? endMonth : 11;
      for (let month = 0; month <= monthLimit; month++) {
        const mm = String(month + 1).padStart(2, '0');
        const amountJitter = ((year * 7 + month * 13) % 31) - 15;
        tx.push({ id: `demo-salary-${year}-${mm}`, date: `${year}-${mm}-27`, amount: 2050 + (year - (endYear - 3)) * 85, payee: 'Datore di lavoro', memo: 'Stipendio mensile', bankAccountId: 'bank', counterpartAccountId: 'salary', status: 'confirmed', confidence: 1, source: 'demo' });
        tx.push({ id: `demo-market-${year}-${mm}`, date: `${year}-${mm}-05`, amount: -(185 + (month % 4) * 11 + amountJitter), payee: 'Market Alfa', memo: 'Spesa alimentare', bankAccountId: 'bank', counterpartAccountId: 'grocery', status: 'confirmed', confidence: 1, source: 'demo' });
        tx.push({ id: `demo-home-${year}-${mm}`, date: `${year}-${mm}-03`, amount: -690, payee: 'Affitto', memo: 'Canone mensile', bankAccountId: 'bank', counterpartAccountId: 'home', status: 'confirmed', confidence: 1, source: 'demo' });
        tx.push({ id: `demo-transit-${year}-${mm}`, date: `${year}-${mm}-13`, amount: -(48 + (month % 3) * 6), payee: 'Mobilità', memo: 'Trasporti', bankAccountId: 'bank', counterpartAccountId: 'transport', status: 'confirmed', confidence: 1, source: 'demo' });
        if (month % 3 === 0) tx.push({ id: `demo-energy-${year}-${mm}`, date: `${year}-${mm}-18`, amount: -(92 + (month % 4) * 8), payee: 'Energia', memo: 'Utenza domestica', bankAccountId: 'bank', counterpartAccountId: 'utilities', status: 'confirmed', confidence: 1, source: 'demo' });
        if (month === 4 || month === 10) tx.push({ id: `demo-health-${year}-${mm}`, date: `${year}-${mm}-11`, amount: -(22 + month), payee: 'Farmacia', memo: 'Acquisto salute', bankAccountId: 'bank', counterpartAccountId: 'health', status: 'confirmed', confidence: 1, source: 'demo' });
      }
    }
    tx.push({ id: 'demo-pending-1', date: localDateKey(new Date(endYear, endMonth, Math.min(now.getDate(), 22))), amount: -36.5, payee: 'Caffè Aurora', memo: 'Pagamento carta', bankAccountId: 'bank', counterpartAccountId: null, status: 'pending', confidence: 0.2, source: 'demo' });
    tx.push({ id: 'demo-pending-2', date: localDateKey(new Date(endYear, endMonth, Math.max(1, Math.min(now.getDate() - 2, 20)))), amount: 74, payee: 'Rimborso', memo: 'Accredito', bankAccountId: 'bank', counterpartAccountId: null, status: 'pending', confidence: 0.2, source: 'demo' });
    const rules = [
      { id: uid('r'), field: 'payee', token: normalize('Market Alfa'), accountId: 'grocery', hits: 8, source: 'demo' },
      { id: uid('r'), field: 'payee', token: normalize('Affitto'), accountId: 'home', hits: 8, source: 'demo' },
      { id: uid('r'), field: 'payee', token: normalize('Mobilità'), accountId: 'transport', hits: 8, source: 'demo' },
      { id: uid('r'), field: 'payee', token: normalize('Energia'), accountId: 'utilities', hits: 4, source: 'demo' },
      { id: uid('r'), field: 'payee', token: normalize('Datore di lavoro'), accountId: 'salary', hits: 8, source: 'demo' }
    ];
    return { version: 1, demo: true, accounts, transactions: tx, rules, bankAccountId: 'bank', openingBalance: 1840, lastSaved: new Date().toISOString() };
  }

  async function apiRequest(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    if (options.method && options.method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;
    const response = await fetch(path, { ...options, headers, credentials: 'same-origin', cache: 'no-store' });
    const contentType = response.headers.get('Content-Type') || '';
    const result = contentType.includes('application/json') ? await response.json() : null;
    if (response.status === 401) { location.replace('/login'); throw new Error('Sessione scaduta. Effettua nuovamente l’accesso.'); }
    if (!response.ok) throw new Error(result?.error || `Errore server (${response.status})`);
    return result;
  }
  async function dbGet(key) {
    if (key !== 'state') return undefined;
    const result = await apiRequest('/api/state');
    stateRevision = Number.isInteger(result.revision) ? result.revision : 0;
    return result.state;
  }
  async function dbPut(key, value) {
    if (key !== 'state') return;
    const result = await apiRequest('/api/state', { method: 'POST', body: JSON.stringify({ state: value, revision: stateRevision }) });
    stateRevision = result.revision;
  }
  async function refreshStorageInfo() {
    try {
      const info = await apiRequest('/api/storage-info');
      const path = $('#databasePath'), size = $('#databaseSize');
      if (path) path.textContent = info.path || 'Non disponibile';
      if (size) {
        const bytes = Math.max(0, Number(info.size_bytes) || 0);
        if (!info.exists) size.textContent = 'file non ancora creato';
        else if (bytes < 1024) size.textContent = bytes + ' B';
        else if (bytes < 1024 * 1024) size.textContent = (bytes / 1024).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' KB';
        else size.textContent = (bytes / (1024 * 1024)).toLocaleString('it-IT', { maximumFractionDigits: 2 }) + ' MB';
      }
    } catch (error) {
      const size = $('#databaseSize');
      if (size) size.textContent = 'non disponibile';
    }
  }
  async function saveState() {
    if (!state) return false;
    state.lastSaved = new Date().toISOString();
    const snapshot = JSON.parse(JSON.stringify(state));
    saveQueue = saveQueue.catch(() => {}).then(async () => {
      await dbPut('state', snapshot);
      $('#saveStatus').textContent = 'Salvato sul server domestico';
    });
    try {
      await saveQueue;
      void refreshStorageInfo();
      return true;
    } catch (error) {
      $('#saveStatus').textContent = 'Salvataggio non riuscito: ' + (error.message || 'verifica la connessione');
      return false;
    }
  }
  async function refreshDriveStatus() {
    try {
      const result = await apiRequest('/api/drive/status');
      const status = $('#driveBackupStatus');
      if (status) status.textContent = result.connected ? 'Collegato' : 'Non collegato';
      const sessionAt = $('#driveSessionBackupAt');
      const nightlyAt = $('#driveNightlyBackupAt');
      const sessionResult = $('#driveSessionBackupResult');
      if (sessionAt) sessionAt.textContent = result.last_session_backup || 'Non ancora eseguito';
      if (nightlyAt) nightlyAt.textContent = result.last_nightly_backup || 'Non ancora eseguito';
      if (sessionResult) {
        const job = result.last_session_job;
        sessionResult.textContent = !job ? 'Nessun logout con backup registrato' :
          job.status === 'done' ? (job.result?.skipped ? 'Ultimo logout: nessun backup necessario' : 'Ultimo backup di sessione completato') :
          job.status === 'failed' ? 'Ultimo backup non riuscito: ' + (job.error || 'errore non specificato') :
          'Ultimo backup: ' + job.status;
        if (job?.at) sessionResult.textContent += ' · ' + job.at;
      }
      const select = $('#driveBackupSelect');
      if (select) {
        const selected = select.value;
        select.innerHTML = '<option value="">Seleziona un backup…</option>';
        (result.backups || []).sort((a,b) => String(b.modifiedTime || '').localeCompare(String(a.modifiedTime || ''))).forEach(file => {
          const option = document.createElement('option');
          option.value = file.id;
          option.textContent = file.name + (file.modifiedTime ? ' · ' + new Date(file.modifiedTime).toLocaleString('it-IT') : '');
          select.append(option);
        });
        if ([...select.options].some(option => option.value === selected)) select.value = selected;
      }
      const connected = !!result.connected;
      const connectDetails = document.querySelector('.drive-connect-details');
      if (connectDetails) connectDetails.hidden = connected;
      ['driveBackupNow','restoreDriveBackup','disconnectDrive','driveBackupSelect'].forEach(id => {
        const element = $('#' + id);
        if (element) element.disabled = !connected || (id === 'restoreDriveBackup' && !result.backups?.length);
      });
    } catch (error) {
      const status = $('#driveBackupStatus');
      if (status) status.textContent = 'Stato non disponibile';
    }
  }
  async function writeDriveBackup() {
    try {
      const result = await apiRequest('/api/drive/backup', { method: 'POST', body: '{}' });
      await refreshDriveStatus();
      showNotice('Backup Google Drive completato', result.skipped ? result.reason : 'Il backup di sessione è stato aggiornato su Google Drive.');
    } catch (error) { showNotice('Backup Google Drive non riuscito', error.message || String(error)); }
  }
  async function connectDriveFolder() {
    const clientId = $('#driveClientId')?.value.trim() || '';
    const clientSecret = $('#driveClientSecret')?.value.trim() || '';
    const token = $('#driveTokenJson')?.value.trim() || '';
    if (!clientId || !clientSecret || !token) {
      showNotice('Dati mancanti', 'Inserisci Client ID, Client Secret e il token restituito da rclone authorize.');
      return;
    }
    const button = $('#connectDriveFolder');
    if (button) button.disabled = true;
    try {
      await apiRequest('/api/drive/connect', { method: 'POST', body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, token }) });
      $('#driveClientSecret').value = '';
      $('#driveTokenJson').value = '';
      await refreshDriveStatus();
      showNotice('Google Drive collegato', 'Autorizzazione verificata. La cartella Gestione C-C Backup è pronta nel tuo Google Drive.');
    } catch (error) {
      showNotice('Collegamento non riuscito', error.message || String(error));
    } finally { if (button) button.disabled = false; }
  }
  async function restoreDriveBackup() {
    const fileId = $('#driveBackupSelect')?.value || '';
    if (!fileId) {
      showNotice('Seleziona un backup', 'Scegli prima il file da ripristinare dall’elenco di Google Drive.');
      return;
    }
    const fileName = $('#driveBackupSelect').selectedOptions[0]?.textContent || 'backup selezionato';
    showConfirm('Ripristinare il backup da Google Drive?', 'Il database corrente sarà sostituito con "' + fileName + '". Prima del ripristino il server creerà una copia preventiva locale. Dopo il ripristino dovrai accedere nuovamente con il PIN contenuto nel backup.', async () => {
      const result = await apiRequest('/api/drive/restore', { method: 'POST', body: JSON.stringify({ file_id: fileId }) });
      if (result.ok) location.replace('/login');
    });
  }
  async function disconnectDrive() {
    showConfirm('Scollegare Google Drive?', 'Verrà rimossa dal server l’autorizzazione salvata. I backup già presenti su Google Drive non verranno cancellati.', async () => {
      await apiRequest('/api/drive/disconnect', { method: 'POST', body: '{}' });
      await refreshDriveStatus();
      showNotice('Google Drive scollegato', 'I file di backup già presenti nel tuo Drive sono rimasti intatti.');
    });
  }
  async function initialize() {
    const retryButton = $('#retryAppLoading');
    retryButton?.addEventListener('click', () => {
      if (retryButton.disabled) return;
      retryButton.disabled = true;
      retryButton.textContent = 'Riprovo…';
      location.reload();
    });
    let needsSave = false;
    try {
      const controller = new AbortController();
      const loadingTimeout = window.setTimeout(() => controller.abort(), 15000);
      let archive;
      try {
        archive = await apiRequest('/api/state', { signal: controller.signal });
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error('Il server non ha risposto entro 15 secondi. Verifica la connessione e riprova.');
        throw error;
      } finally {
        window.clearTimeout(loadingTimeout);
      }
      csrfToken = archive.csrf || '';
      stateRevision = Number.isInteger(archive.revision) ? archive.revision : 0;
      state = archive.state;
      if (!state) {
        state = { version: 1, demo: false, accounts: defaultAccounts(), transactions: [], rules: [], bankAccountId: 'bank', openingBalance: 0, lastSaved: new Date().toISOString() };
        needsSave = true;
      }
    } catch (error) {
      $('#appLoading')?.classList.add('app-loading-error');
      $('#appLoadingTitle').textContent = 'Archivio non disponibile';
      const loadingText = $('#appLoadingText');
      if (loadingText) {
        loadingText.textContent = 'Non è stato possibile caricare il database centralizzato. Nessun dato dimostrativo è stato creato. Dettaglio: ' + (error.message || 'verifica la rete');
        loadingText.hidden = false;
      }
      $('#retryAppLoading').hidden = false;
      $('#saveStatus').textContent = 'Server non raggiungibile';
      return;
    }
    if (normalizeState()) needsSave = true;
    reportMode = ['monthly', 'quarterly', 'halfyearly', 'annual'].includes(state.reportMode) ? state.reportMode : 'monthly';
    $('#reportPeriodMode').value = reportMode;
    setupControls();
    const versionLabel = $('#appVersion');
    if (versionLabel) versionLabel.innerHTML = '<span>Gestione C/C · app ' + APP_VERSION + ' · add-on 1.0.25</span><span class="sidebar-copyright">© Stefano Di Ricco</span>';
    const currentMonth = localDateKey(new Date()).slice(0, 7);
    const storedMonth = String(state.selectedMonth || '');
    const selectedMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(storedMonth) ? storedMonth : currentMonth;
    if (state.selectedMonth !== selectedMonth) { state.selectedMonth = selectedMonth; needsSave = true; }
    $('#monthPicker').value = selectedMonth;
    syncReportPeriodPicker(selectedMonth);
    if (needsSave) await saveState();
    
    $('#welcomeDate').textContent = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).toUpperCase();
    document.body.classList.add('app-ready');
    $('#appLoading')?.classList.add('hidden');
    navigate('overview');
    void refreshStorageInfo();
    void refreshDriveStatus();
    const refreshOverview = () => requestAnimationFrame(() => requestAnimationFrame(() => {
      if ($('#view-overview')?.classList.contains('active')) { renderOverview(); drawFlowChart(); }
    }));
    if (document.fonts?.ready) document.fonts.ready.then(refreshOverview); else refreshOverview();
  }
  function normalizeState() {
    let changed = false;
    if (!state.accounts) { state.accounts = defaultAccounts(); changed = true; }
    if (!state.transactions) { state.transactions = []; changed = true; }
    if (!state.rules) { state.rules = []; changed = true; }
    // Additive finance-feature state: preserve existing archives and unknown fields.
    if (!Array.isArray(state.budgets)) { state.budgets = []; changed = true; }
    if (!Array.isArray(state.budgetSnapshots)) { state.budgetSnapshots = []; changed = true; }
    if (state.budgets.length) {
      const month = localDateKey(new Date()).slice(0,7);
      if (!state.budgetSnapshots.some(snapshot => snapshot.month === month)) {
        const lines = state.budgets.filter(item => item && item.accountId).map(item => {
          const spent = budgetActualDirect(month, item.accountId), budget = Math.max(0, Number(item.amount) || 0);
          return { accountId: item.accountId, budget, spent, remaining: Math.round((budget-spent)*100)/100,
            utilization: budget > 0 ? Math.round(spent/budget*10000)/100 : null, historySource: 'budget_precedente', manualOverride: true };
        });
        state.budgetSnapshots.push({ month, version: 1, createdAt: new Date().toISOString(), status: 'confermato',
          historySource: 'budget_precedente', historyMonths: 0, lines, totalBudget: lines.reduce((sum,line)=>sum+line.budget,0),
          totalActual: lines.reduce((sum,line)=>sum+line.spent,0), incomeForecast:budgetIncomeForecastForMonth(month).amount, actualIncome:state.accounts.filter(a=>a.type==='INCOME'&&a.hierarchyType!=='Mastro').reduce((sum,account)=>sum+budgetActualDirect(month,account.id),0), migrated: true });
        changed = true;
      }
    }
    if (!Array.isArray(state.recurringRules)) { state.recurringRules = []; changed = true; }
    if (!Array.isArray(state.recurringProposals)) { state.recurringProposals = []; changed = true; }
    if (!Array.isArray(state.savedFilters)) { state.savedFilters = []; changed = true; }
    if (!Array.isArray(state.importProfiles)) { state.importProfiles = []; changed = true; }
    if (!state.forecastSettings || typeof state.forecastSettings !== 'object' || Array.isArray(state.forecastSettings)) {
      state.forecastSettings = { horizonMonths: 12, accountIds: [] };
      changed = true;
    } else {
      if (state.forecastSettings.horizonMonths !== 12) { state.forecastSettings.horizonMonths = 12; changed = true; }
      if (!Array.isArray(state.forecastSettings.accountIds)) { state.forecastSettings.accountIds = []; changed = true; }
    }
    // Classificazione gerarchica: ricalcola solo la proposta automatica e conserva gli override manuali.
    const validHierarchy = ['Mastro', 'Mastro e conto', 'Conto'];
    const childCounts = new Map(state.accounts.map(a => [String(a.id), 0]));
    state.accounts.forEach(a => { if (a.parentId != null && childCounts.has(String(a.parentId))) childCounts.set(String(a.parentId), childCounts.get(String(a.parentId)) + 1); });
    const directPostings = new Set();
    state.transactions.forEach(tx => {
      if (tx.status !== 'confirmed') return;
      if (tx.bankAccountId) directPostings.add(String(tx.bankAccountId));
      if (tx.counterpartAccountId) directPostings.add(String(tx.counterpartAccountId));
      (tx.counterpartSplits || []).forEach(split => { if (split.accountId) directPostings.add(String(split.accountId)); });
    });
    if (window.GestioneFinancialEngine?.classifyHierarchy) {
      const calculated = window.GestioneFinancialEngine.classifyHierarchy(state.accounts, state.transactions);
      calculated.forEach(item => {
        const account = state.accounts.find(a => String(a.id) === String(item.id));
        if (account) Object.assign(account, { hierarchyType: item.hierarchyType, hierarchyTypeProposal: item.hierarchyTypeProposal,
          hierarchyTypeSource: item.hierarchyTypeSource, hasChildren: item.hasChildren, hasDirectMovements: item.hasDirectMovements });
      });
    }
    state.accounts.forEach(account => {
      const hasChildren = (childCounts.get(String(account.id)) || 0) > 0;
      const proposal = hasChildren ? (directPostings.has(String(account.id)) ? 'Mastro e conto' : 'Mastro') : 'Conto';
      const override = validHierarchy.includes(account.hierarchyTypeOverride) ? account.hierarchyTypeOverride : null;
      const nextType = override || proposal;
      if (account.hierarchyTypeProposal !== proposal || account.hierarchyType !== nextType || account.hierarchyTypeSource !== (override ? 'manuale' : 'automatico')) changed = true;
      account.hierarchyTypeProposal = proposal;
      account.hierarchyType = nextType;
      account.hierarchyTypeSource = override ? 'manuale' : 'automatico';
      account.hasChildren = hasChildren;
      account.hasDirectMovements = directPostings.has(String(account.id));
    });
    if (state.openingBalance == null) { state.openingBalance = 0; changed = true; }
    if (!state.bankAccountId) {
      state.bankAccountId = state.accounts.find(a => a.type === 'BANK')?.id || state.accounts[0]?.id;
      changed = true;
    }
    if (!state.reportAccountId) { state.reportAccountId = state.bankAccountId; changed = true; }
    // GnuCash books may have several successive checking accounts. The report
    // default must include them all; retain an explicit user selection.
    if (state.transactions.some(tx => tx.source === 'gnucash') && !state.reportAccountDefaultMigrated) {
      state.reportAccountId = 'all';
      state.reportAccountDefaultMigrated = true;
      changed = true;
    }
    return changed;
  }

  function setupControls() {
    // Wire modal controls first so a missing optional UI element cannot leave
    // the confirmation dialog with inert Cancel/Continue buttons.
    $$('[data-close-modal]').forEach(button => button.addEventListener('click', closeModals));
    $('#confirmAction')?.addEventListener('click', async () => {
      const fn = confirmCallback; closeModals();
      if (!fn) return;
      showNotice('Operazione in corso', 'Attendi il completamento. L’elaborazione resta su questo computer.');
      try { await fn(true); }
      catch (error) { console.error('Operazione di conferma non completata', error); closeModals(); showNotice('Operazione non completata', error?.message || String(error) || 'Errore inatteso dopo la conferma.'); }
    });
    $('#confirmExclude')?.addEventListener('click', async () => { const fn=confirmCallback; closeModals(); if(!fn)return; showNotice('Operazione in corso','Attendi il completamento.'); try{await fn(false);}catch(error){showNotice('Operazione non completata',error.message||String(error));} });
    $$('.nav-item').forEach(button => button.addEventListener('click', () => navigate(button.dataset.view)));
    $('#closeAttachmentsModal')?.addEventListener('click',()=>$('#attachmentsModal').classList.add('hidden'));
    $('#doneAttachmentsModal')?.addEventListener('click',()=>$('#attachmentsModal').classList.add('hidden'));
    $('#uploadAttachmentButton')?.addEventListener('click',()=>$('#attachmentFilePicker').click());
    $('#attachmentFilePicker')?.addEventListener('change',async event=>{const file=event.target.files?.[0];event.target.value='';if(file)await uploadTransactionAttachment(file);});
    $('#saveDocumentMetadata')?.addEventListener('click',async()=>{
      if(!editingDocumentId)return;
      const payload={id:editingDocumentId,supplier:$('#editDocumentSupplier').value,amount:$('#editDocumentAmount').value,
        document_date:$('#editDocumentDate').value,document_number:$('#editDocumentNumber').value};
      try{await apiRequest('/api/documents/metadata',{method:'POST',body:JSON.stringify(payload)});
        $('#documentMetadataModal').classList.add('hidden');editingDocumentId=null;await searchDocuments();
        showNotice('Documento aggiornato','Le correzioni manuali sono state salvate e saranno mantenute anche dopo una nuova scansione OCR.');
      }catch(error){showNotice('Modifica non salvata',error.message||String(error));}
    });
    $('#cancelDocumentMetadata')?.addEventListener('click',()=>{$('#documentMetadataModal').classList.add('hidden');editingDocumentId=null;});
    $('#closeDocumentMetadata')?.addEventListener('click',()=>{$('#documentMetadataModal').classList.add('hidden');editingDocumentId=null;});
    $('#runDocumentSearch')?.addEventListener('click',()=>searchDocuments(true));
    $('#clearDocumentSearch')?.addEventListener('click',()=>{$('#documentSearchText').value='';$('#documentSearchCategory').value='';searchDocuments(true);});
    $('#documentSearchText')?.addEventListener('keydown',event=>{if(event.key==='Enter')searchDocuments(true);});
    $('#documentSearchCategory')?.addEventListener('change',()=>searchDocuments(true));
    $('#documentPrev')?.addEventListener('click',()=>{documentSearchOffset=Math.max(0,documentSearchOffset-100);searchDocuments();});
    $('#documentNext')?.addEventListener('click',()=>{documentSearchOffset+=100;searchDocuments();});

    $$('[data-goto]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.goto)));
    $('#monthPicker').addEventListener('change', () => { state.selectedMonth = $('#monthPicker').value; syncReportPeriodPicker(state.selectedMonth);  saveState(); renderAll(); });
    $('#reportMonth').addEventListener('change', () => { state.selectedMonth = overviewMonthForReportPeriod($('#reportMonth').value, reportMode); $('#monthPicker').value = state.selectedMonth;  saveState(); renderAll(); });
    $('#monthPrev')?.addEventListener('click', () => moveSelectedPeriod(-1, 'overview'));
    $('#monthNext')?.addEventListener('click', () => moveSelectedPeriod(1, 'overview'));
    $('#reportPeriodPrev')?.addEventListener('click', () => moveSelectedPeriod(-1, 'report'));
    $('#reportPeriodNext')?.addEventListener('click', () => moveSelectedPeriod(1, 'report'));
    $('#accountPicker').addEventListener('change', () => { state.reportAccountId = $('#accountPicker').value; $('#reportAccountPicker').value = state.reportAccountId; saveState(); renderAll(); });
    $('#reportAccountPicker').addEventListener('change', () => { state.reportAccountId = $('#reportAccountPicker').value; $('#accountPicker').value = state.reportAccountId; saveState(); renderAll(); });
    const resetTransactionFilters = () => { transactionSelection.clear(); transactionPage = 0; renderTransactions(); };
    $('#transactionFilter').addEventListener('change', resetTransactionFilters);
    $('#transactionDateFrom')?.addEventListener('change', resetTransactionFilters);
    $('#transactionDateTo')?.addEventListener('change', resetTransactionFilters);
    $('#transactionCounterpartFilter')?.addEventListener('change', resetTransactionFilters);
    $('#clearTransactionDates')?.addEventListener('click', () => {
      $('#transactionDateFrom').value = '';
      $('#transactionDateTo').value = '';
      resetTransactionFilters();
    });
    $('#transactionPrev').addEventListener('click', () => { transactionPage = Math.max(0, transactionPage - 1); renderTransactions(); });
    $('#transactionNext').addEventListener('click', () => { transactionPage++; renderTransactions(); });
    $('#transactionSelectAll')?.addEventListener('click', selectAllFilteredTransactions);
    $('#transactionDeselectAll')?.addEventListener('click', clearTransactionSelection);
    $('#transactionBulkCounterpart')?.addEventListener('change', () => updateTransactionBulkUi());
    $('#applyBulkCounterpart')?.addEventListener('click', applyBulkCounterpartChange);
    $('#addManualTransaction')?.addEventListener('click', openManualTransaction);
    $('#closeManualTransaction')?.addEventListener('click', closeManualTransaction);
    $('#cancelManualTransaction')?.addEventListener('click', closeManualTransaction);
    $('#manualBankAccount')?.addEventListener('change', populateManualCounterAccounts);
    $('#saveManualTransaction')?.addEventListener('click', saveManualTransaction);
    $('#reportPeriodMode')?.addEventListener('change', event => { reportMode = event.target.value || 'monthly'; const next = syncReportPeriodPicker(state.selectedMonth); state.selectedMonth = overviewMonthForReportPeriod(next); $('#monthPicker').value = state.selectedMonth;  state.reportMode = reportMode; saveState(); renderAll(); });
    $('#importBank').addEventListener('click', () => $('#bankFile').click());
    $('#importBankSecondary').addEventListener('click', () => $('#bankFile').click());
    $('#emptyImport').addEventListener('click', () => $('#bankFile').click());
    $('#importGnucash').addEventListener('click', () => $('#gnucashFile').click());
    $('#bankFile').addEventListener('change', onBankFile);
    $('#gnucashFile').addEventListener('change', onGnuCashFile);
    $('#exportBackup').addEventListener('click', exportBackup);
    $('#changePinForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const currentPin = $('#currentPin').value.replace(/\D/g, '').slice(0, 6);
      const newPin = $('#newPin').value.replace(/\D/g, '').slice(0, 6);
      const confirmPin = $('#confirmPin').value.replace(/\D/g, '').slice(0, 6);
      const message = $('#changePinMessage');
      const button = $('#changePinButton');
      message.textContent = '';
      if (!/^[0-9]{6}$/.test(currentPin) || !/^[0-9]{6}$/.test(newPin)) { message.textContent = 'Ogni PIN deve contenere esattamente 6 cifre.'; return; }
      if (newPin !== confirmPin) { message.textContent = 'I due nuovi PIN non coincidono.'; return; }
      if (newPin === currentPin) { message.textContent = 'Il nuovo PIN deve essere diverso da quello attuale.'; return; }
      button.disabled = true;
      try {
        await apiRequest('/api/change-pin', { method: 'POST', body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }) });
        $('#changePinForm').reset();
        message.textContent = 'PIN aggiornato. Le altre sessioni sono state disconnesse.';
      } catch (error) { message.textContent = error.message || 'Impossibile aggiornare il PIN.'; }
      finally { button.disabled = false; }
    });
    $('#serverLogout')?.addEventListener('click', async () => {
      const button = $('#serverLogout');
      if (button) { button.disabled = true; button.textContent = 'Backup…'; }
      try {
        await saveQueue;
        await apiRequest('/api/logout', { method: 'POST', body: '{}' });
        location.replace('/login');
      } catch (error) {
        if (button) { button.disabled = false; button.textContent = 'Esci'; }
        showNotice('Uscita non completata', error.message || 'Il backup non è riuscito. La sessione resta aperta.');
      }
    });
    $('#exportBackupSecondary').addEventListener('click', exportBackup);
    $('#exportSqliteBackup')?.addEventListener('click', downloadSqliteBackup);
    $('#restoreSqliteBackup')?.addEventListener('click', () => $('#sqliteBackupFile')?.click());
    $('#sqliteBackupFile')?.addEventListener('change', restoreSqliteBackup);
    $('#connectDriveFolder')?.addEventListener('click', connectDriveFolder);
    $('#driveBackupNow')?.addEventListener('click', writeDriveBackup);
    $('#restoreDriveBackup')?.addEventListener('click', restoreDriveBackup);
    $('#disconnectDrive')?.addEventListener('click', disconnectDrive);
    $('#exportStatementPdf')?.addEventListener('click', exportStatementPdf);
    $('#exportOverviewStatementPdf')?.addEventListener('click', exportOverviewStatementPdf);
    $('#exportOverviewStatementXlsx')?.addEventListener('click', exportOverviewStatementXlsx);
    $('#exportStatementXlsx')?.addEventListener('click', exportStatementXlsx);
    $('#exportReportPdf')?.addEventListener('click', exportReportPdf);
    $('#exportReportXlsx')?.addEventListener('click', exportReportXlsx);
    $('#exitApp')?.addEventListener('click', exitApp);
    $('#deletePersonalData')?.addEventListener('click', deletePersonalData);
    $('#importBackup').addEventListener('click', () => $('#backupFile').click());
    $('#backupFile').addEventListener('change', importBackup);
    $('#resetDemo')?.addEventListener('click', () => showConfirm('Ripristinare i dati dimostrativi?', 'Il contenuto attuale del prototipo sarà sostituito. Esporta un backup prima di continuare, se vuoi conservarlo.', async () => {
      state = createDemoState(); await saveState(); renderAll(); showNotice('Prototipo ripristinato', 'I dati dimostrativi sono di nuovo disponibili.');
    }));
    $('#addAccount').addEventListener('click', openAddAccount);
    $('#accountEconomicCheckbox')?.addEventListener('change', () => $('#accountEconomicTypeWrap')?.classList.toggle('hidden', !$('#accountEconomicCheckbox').checked));
    $('#cancelAddAccount')?.addEventListener('click', closeAddAccount);
    $('#closeAddAccount')?.addEventListener('click', closeAddAccount);
    $('#saveNewAccount')?.addEventListener('click', addAccount);
    $('#importAccountsExcel')?.addEventListener('click', () => $('#accountFile').click());
    $('#accountFile')?.addEventListener('change', importAccountsFromExcel);
    $('#downloadAccountTemplate')?.addEventListener('click', downloadAccountTemplate);
    $('#view-transactions').addEventListener('change', onAccountSelection);
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { drawFlowChart(); drawReportChart(); }, 120); });
  }
  function moveSelectedPeriod(direction, source) {
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const mode = source === 'report' ? reportMode : 'monthly';
    const span = mode === 'quarterly' ? 3 : mode === 'halfyearly' ? 6 : mode === 'annual' ? 12 : 1;
    const currentValue = source === 'report' ? ($('#reportMonth').value || monthSelection()) : monthSelection();
    const [year, month] = currentValue.split('-').map(Number);
    const target = new Date(year, month - 1 + direction * span, 1);
    const clamped = target > currentMonth ? currentMonth : target;
    const nextMonth = `${clamped.getFullYear()}-${String(clamped.getMonth() + 1).padStart(2, '0')}`;
    if (source === 'report') {
      const selected = syncReportPeriodPicker(nextMonth, reportMode);
      state.selectedMonth = overviewMonthForReportPeriod(selected, reportMode);
    } else {
      state.selectedMonth = nextMonth;
      syncReportPeriodPicker(nextMonth, reportMode);
    }
    $('#monthPicker').value = state.selectedMonth;
    
    saveState();
    renderAll();
  }
  function updatePeriodNavigation() {
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const [oy, om] = monthSelection().split('-').map(Number);
    const overviewDate = new Date(oy, om - 1, 1);
    if ($('#monthNext')) $('#monthNext').disabled = overviewDate >= currentMonth;
    const selected = $('#reportMonth')?.value || monthSelection();
    const [ry, rm] = selected.split('-').map(Number);
    const reportDate = new Date(ry, rm - 1, 1);
    if ($('#reportPeriodNext')) $('#reportPeriodNext').disabled = reportDate >= currentMonth;
  }

  function searchControls() {
    const get = id => document.getElementById(id);
    const text = get('searchText')?.value.trim().toLocaleLowerCase('it') || '';
    const from = get('searchFrom')?.value || '', to = get('searchTo')?.value || '';
    const min = get('searchMin')?.value === '' ? null : Number(get('searchMin').value);
    const max = get('searchMax')?.value === '' ? null : Number(get('searchMax').value);
    const direction = get('searchDirection')?.value || 'all', status = get('searchStatus')?.value || 'all';
    const accountText = get('searchAccount')?.value.trim() || '';
    const matchedAccount = accountText ? state.accounts.find(a => accountDisplayLabel(a) === accountText || a.path === accountText) : null;
    const account = !accountText ? 'all' : (matchedAccount?.id || '__no_matching_account__');
    return { text, from, to, min, max, direction, status, account };
  }
  function renderSavedFilters() {
    const picker = $('#savedFilterPicker'); if (!picker) return;
    const current = picker.value;
    picker.innerHTML = '<option value="">Filtri salvati…</option>' + state.savedFilters.map(f => '<option value="' + safeText(f.id) + '">' + safeText(f.name) + '</option>').join('');
    if (state.savedFilters.some(f => f.id === current)) picker.value = current;
  }
  function searchAccountAllocation(tx, accountId) {
    if (accountId === 'all') return { matches: true, amount: Number(tx.amount) || 0, labels: [] };
    if (tx.bankAccountId === accountId) return { matches: true, amount: Number(tx.amount) || 0, labels: [] };
    const splits = Array.isArray(tx.counterpartSplits) ? tx.counterpartSplits : [];
    if (splits.length) {
      const isWithinSelectedAccount = splitAccountId => {
        let account = accountById(splitAccountId), guard = new Set();
        while (account && !guard.has(String(account.id))) {
          if (String(account.id) === String(accountId)) return true;
          guard.add(String(account.id));
          account = account.parentId ? accountById(account.parentId) : null;
        }
        return false;
      };
      const matched = splits.filter(split => isWithinSelectedAccount(split.accountId));
      if (!matched.length) return { matches: false, amount: 0, labels: [] };
      // Nel riparto il valore è opposto al movimento bancario: lo invertiamo
      // per mostrare l'importo e il segno dal punto di vista dell'entrata/uscita.
      return { matches: true, amount: -matched.reduce((sum, split) => sum + (Number(split.value) || 0), 0),
        labels: matched.map(split => accountLabel(split.accountId)) };
    }
    if (tx.counterpartAccountId === accountId) return { matches: true, amount: Number(tx.amount) || 0, labels: [] };
    return { matches: false, amount: 0, labels: [] };
  }
  function runAdvancedSearch() {
    const f = searchControls();
    const results = state.transactions.map(tx => ({ tx, allocation: searchAccountAllocation(tx, f.account) })).filter(({tx, allocation}) => {
      const date = String(tx.date || '');
      const amount = Math.abs(allocation.amount);
      const haystack = [transactionDescription(tx), transactionCausale(tx), tx.payee, tx.memo].join(' ').toLocaleLowerCase('it');
      if (f.from && date < f.from || f.to && date > f.to) return false;
      if (f.text && !haystack.includes(f.text)) return false;
      if (!allocation.matches) return false;
      if (f.min !== null && Number.isFinite(f.min) && amount < f.min) return false;
      if (f.max !== null && Number.isFinite(f.max) && amount > f.max) return false;
      if (f.direction === 'income' && allocation.amount <= 0 || f.direction === 'expense' && allocation.amount >= 0) return false;
      if (f.status !== 'all' && tx.status !== f.status) return false;
      return true;
    }).sort((a,b) => String(b.tx.date).localeCompare(String(a.tx.date)));
    $('#searchResultCount').textContent = results.length + ' movimenti trovati';
    advancedSearchResults = results;
    const totals = results.reduce((sum, row) => { if (row.allocation.amount >= 0) sum.income += row.allocation.amount; else sum.expense += Math.abs(row.allocation.amount); return sum; }, {income:0,expense:0});
    $('#searchResultCount').textContent = results.length + ' movimenti trovati · Entrate ' + euro.format(totals.income) + ' · Uscite ' + euro.format(totals.expense) + ' · Netto ' + euro.format(totals.income-totals.expense);
    $('#advancedSearchBody').innerHTML = results.slice(0,1000).map(({tx,allocation}) => '<tr><td>' + safeText(formatDate(tx.date)) + '</td><td class="name-cell">' + safeText(transactionDescription(tx) || transactionCausale(tx) || 'Movimento') + (allocation.labels.length ? '<small class="name-secondary">Riparto: ' + safeText(allocation.labels.join(' · ')) + '</small>' : '') + '</td><td class="' + (allocation.amount>=0?'amount-in':'amount-out') + '">' + euro.format(allocation.amount) + '</td><td>' + safeText(accountLabel(tx.bankAccountId)) + '</td><td>' + safeText(allocation.labels.length ? allocation.labels.join(' · ') : accountLabel(tx.counterpartAccountId)) + '</td><td>' + (tx.status === 'confirmed' ? 'Confermato' : 'Da classificare') + '</td></tr>').join('') || '<tr><td colspan="6" class="empty-inline">Nessun movimento corrisponde ai filtri.</td></tr>';
    if (results.length > 1000) $('#searchResultCount').textContent += ' · mostrati i primi 1.000';
  }
  function advancedSearchSummaryRows() {
    const rows = advancedSearchResults || [];
    const months = new Map(), years = new Map(), counterparts = new Map(), counterpartYears = new Map();
    let income = 0, expense = 0;
    for (const {tx, allocation} of rows) {
      const amount = Number(allocation.amount) || 0, date = String(tx.date || '');
      if (amount >= 0) income += amount; else expense += Math.abs(amount);
      const month = date.slice(0,7), year = date.slice(0,4);
      if (month) { const item=months.get(month)||{income:0,expense:0,net:0}; if(amount>=0)item.income+=amount;else item.expense+=Math.abs(amount);item.net+=amount;months.set(month,item); }
      if (year) { const item=years.get(year)||{income:0,expense:0,net:0}; if(amount>=0)item.income+=amount;else item.expense+=Math.abs(amount);item.net+=amount;years.set(year,item); }
      const labels = allocation.labels.length ? allocation.labels : [accountLabel(tx.counterpartAccountId)];
      for (const label of labels) {
        if (!label || label === '—') continue;
        const key = month + '|' + label, item=counterparts.get(key)||{month,label,income:0,expense:0,net:0};
        if(amount>=0)item.income+=amount;else item.expense+=Math.abs(amount);item.net+=amount;counterparts.set(key,item);
        const yearKey=year+'|'+label, annual=counterpartYears.get(yearKey)||{year,label,income:0,expense:0,net:0};
        if(amount>=0)annual.income+=amount;else annual.expense+=Math.abs(amount);annual.net+=amount;counterpartYears.set(yearKey,annual);
      }
    }
    return {rows,income,expense,net:income-expense,months:[...months].sort((a,b)=>a[0].localeCompare(b[0])),years:[...years].sort((a,b)=>a[0].localeCompare(b[0])),counterparts:[...counterparts.values()].sort((a,b)=>a.month.localeCompare(b.month)||a.label.localeCompare(b.label,'it')),counterpartYears:[...counterpartYears.values()].sort((a,b)=>a.year.localeCompare(b.year)||a.label.localeCompare(b.label,'it'))};
  }
  function exportAdvancedSearchPdf() {
    if (!advancedSearchResults.length) { showNotice('Nessun risultato','Esegui prima una ricerca avanzata.'); return; }
    const data=advancedSearchSummaryRows(), filters=searchControls();
    const labelMonth=key=>{const [y,m]=key.split('-').map(Number);return new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(new Date(y,m-1,1));};
    const monthly=data.months.map(([key,v])=>'<tr><td>'+safeText(labelMonth(key))+'</td><td class="num">'+euro.format(v.income)+'</td><td class="num">'+euro.format(v.expense)+'</td><td class="num">'+euro.format(v.net)+'</td></tr>').join('');
    const annual=data.years.map(([key,v])=>'<tr><td>'+safeText(key)+'</td><td class="num">'+euro.format(v.income)+'</td><td class="num">'+euro.format(v.expense)+'</td><td class="num">'+euro.format(v.net)+'</td></tr>').join('');
    const counterpartRows=data.counterparts.map(v=>'<tr><td>'+safeText(labelMonth(v.month))+'</td><td>'+safeText(v.label)+'</td><td class="num">'+euro.format(v.income)+'</td><td class="num">'+euro.format(v.expense)+'</td><td class="num">'+euro.format(v.net)+'</td></tr>').join('');
    const counterpartYearRows=data.counterpartYears.map(v=>'<tr><td>'+safeText(v.year)+'</td><td>'+safeText(v.label)+'</td><td class="num">'+euro.format(v.income)+'</td><td class="num">'+euro.format(v.expense)+'</td><td class="num">'+euro.format(v.net)+'</td></tr>').join('');
    const max=Math.max(1,...data.months.flatMap(([,v])=>[v.income,v.expense]));
    const bars=data.months.map(([key,v])=>'<div style="display:grid;grid-template-columns:120px 1fr 1fr;gap:8px;align-items:center;margin:7px 0"><span>'+safeText(labelMonth(key))+'</span><span style="background:#4d9a7a;height:12px;width:'+Math.max(1,v.income/max*100)+'%"></span><span style="background:#c66c61;height:12px;width:'+Math.max(1,v.expense/max*100)+'%"></span></div>').join('');
    const topCounterparts=[...new Set(data.counterparts.map(v=>v.label))].map(label=>({label,total:data.counterparts.filter(v=>v.label===label).reduce((sum,v)=>sum+v.income+v.expense,0)})).sort((a,b)=>b.total-a.total).slice(0,6).map(v=>v.label);
    const counterpartMax=Math.max(1,...data.counterparts.filter(v=>topCounterparts.includes(v.label)).map(v=>Math.abs(v.net)));
    const counterpartBars=data.counterparts.filter(v=>topCounterparts.includes(v.label)).map(v=>'<div style="display:grid;grid-template-columns:130px 100px 1fr;gap:8px;align-items:center;margin:5px 0"><span>'+safeText(v.label)+'</span><span>'+safeText(labelMonth(v.month))+'</span><span style="display:block;height:10px;width:'+Math.max(1,Math.abs(v.net)/counterpartMax*100)+'%;background:'+(v.net>=0?'#4d9a7a':'#c66c61')+'"></span></div>').join('');
    const counterpartAnnualMax=Math.max(1,...data.counterpartYears.filter(v=>topCounterparts.includes(v.label)).map(v=>Math.abs(v.net)));
    const counterpartAnnualBars=data.counterpartYears.filter(v=>topCounterparts.includes(v.label)).map(v=>'<div style="display:grid;grid-template-columns:130px 100px 1fr;gap:8px;align-items:center;margin:5px 0"><span>'+safeText(v.label)+'</span><span>'+safeText(v.year)+'</span><span style="display:block;height:10px;width:'+Math.max(1,Math.abs(v.net)/counterpartAnnualMax*100)+'%;background:'+(v.net>=0?'#4d9a7a':'#c66c61')+'"></span></div>').join('');
    const txRows=data.rows.map(({tx,allocation})=>'<tr><td>'+safeText(formatDate(tx.date))+'</td><td>'+safeText(transactionDescription(tx)||transactionCausale(tx)||'Movimento')+'</td><td>'+safeText(allocation.labels.join(' · ')||accountLabel(tx.counterpartAccountId))+'</td><td class="num">'+euro.format(allocation.amount)+'</td><td>'+safeText(tx.status==='confirmed'?'Confermato':'Da classificare')+'</td></tr>').join('');
    const content='<h1>Ricerca avanzata · Gestione C/C</h1><p>Periodo: '+safeText(filters.from||'inizio archivio')+' – '+safeText(filters.to||'oggi')+' · '+data.rows.length+' movimenti</p><div class="summary"><div><b>Entrate</b><strong>'+euro.format(data.income)+'</strong></div><div><b>Uscite</b><strong>'+euro.format(data.expense)+'</strong></div><div><b>Saldo netto</b><strong>'+euro.format(data.net)+'</strong></div></div><h2>Andamento mensile</h2><p>Entrate (verde) · Uscite (rosso)</p>'+bars+'<h2>Andamento mensile delle principali contropartite</h2><p>Saldo netto per mese (verde positivo, rosso negativo)</p>'+counterpartBars+'<h2>Andamento annuale delle principali contropartite</h2><p>Saldo netto per anno</p>'+counterpartAnnualBars+'<h2>Riepilogo mensile</h2><table><thead><tr><th>Mese</th><th>Entrate</th><th>Uscite</th><th>Netto</th></tr></thead><tbody>'+monthly+'</tbody></table><h2>Riepilogo annuale</h2><table><thead><tr><th>Anno</th><th>Entrate</th><th>Uscite</th><th>Netto</th></tr></thead><tbody>'+annual+'</tbody></table><h2>Andamento mensile per contropartita</h2><table><thead><tr><th>Mese</th><th>Contropartita</th><th>Entrate</th><th>Uscite</th><th>Netto</th></tr></thead><tbody>'+counterpartRows+'</tbody></table><h2>Andamento annuale per contropartita</h2><table><thead><tr><th>Anno</th><th>Contropartita</th><th>Entrate</th><th>Uscite</th><th>Netto</th></tr></thead><tbody>'+counterpartYearRows+'</tbody></table><h2>Movimenti trovati</h2><table><thead><tr><th>Data</th><th>Descrizione</th><th>Contropartita</th><th>Importo</th><th>Stato</th></tr></thead><tbody>'+txRows+'</tbody></table>';
    printHtml('Ricerca-avanzata',content);
  }
  function exportAdvancedSearchXlsx() {
    if (!advancedSearchResults.length) { showNotice('Nessun risultato','Esegui prima una ricerca avanzata.'); return; }
    const data=advancedSearchSummaryRows(), filters=searchControls();
    const months=[['Mese','Entrate','Uscite','Saldo netto'],...data.months.map(([key,v])=>[key,v.income,v.expense,v.net])];
    const years=[['Anno','Entrate','Uscite','Saldo netto'],...data.years.map(([key,v])=>[key,v.income,v.expense,v.net])];
    const counterpartRows=[['Mese','Contropartita','Entrate','Uscite','Saldo netto'],...data.counterparts.map(v=>[v.month,v.label,v.income,v.expense,v.net])];
    const counterpartYearRows=[['Anno','Contropartita','Entrate','Uscite','Saldo netto'],...data.counterpartYears.map(v=>[v.year,v.label,v.income,v.expense,v.net])];
    const transactions=[['Data','Descrizione','Conto corrente','Contropartita','Importo','Stato'],...data.rows.map(({tx,allocation})=>[tx.date,transactionDescription(tx)||transactionCausale(tx)||'Movimento',accountLabel(tx.bankAccountId),allocation.labels.join(' · ')||accountLabel(tx.counterpartAccountId),allocation.amount,tx.status==='confirmed'?'Confermato':'Da classificare'])];
    const summary=[['GESTIONE C/C · RICERCA AVANZATA'],['Dal',filters.from||'—'],['Al',filters.to||'—'],['Movimenti',data.rows.length],['Entrate',data.income],['Uscite',data.expense],['Saldo netto',data.net]];
    const topCounterparts=[...new Set(data.counterparts.map(v=>v.label))].map(label=>({label,total:data.counterparts.filter(v=>v.label===label).reduce((sum,v)=>sum+v.income+v.expense,0)})).sort((a,b)=>b.total-a.total).slice(0,6).map(v=>v.label);
    const monthlyPivot=[['Mese',...topCounterparts],...data.months.map(([month])=>[month,...topCounterparts.map(label=>data.counterparts.find(v=>v.month===month&&v.label===label)?.net||0)])];
    const annualPivot=[['Anno',...topCounterparts],...data.years.map(([year])=>[year,...topCounterparts.map(label=>data.counterpartYears.find(v=>v.year===year&&v.label===label)?.net||0)])];
    const counterpartSeries=topCounterparts.map((label,index)=>({sheet:'Trend contropartite',col:index+1,nameCol:index+1}));
    const counterpartAnnualSeries=topCounterparts.map((label,index)=>({sheet:'Trend contropartite anno',col:index+1,nameCol:index+1}));
    const charts=[{title:'Entrate e uscite per mese',categorySheet:'Andamento mensile',categoryCol:0,firstDataRow:2,lastDataRow:months.length,series:[{sheet:'Andamento mensile',col:1,nameCol:1},{sheet:'Andamento mensile',col:2,nameCol:2}],startCol:0,startRow:1,endCol:14,endRow:18}];
    if(topCounterparts.length) charts.push({title:'Andamento mensile per contropartita · saldo netto',categorySheet:'Trend contropartite',categoryCol:0,firstDataRow:2,lastDataRow:monthlyPivot.length,series:counterpartSeries,startCol:16,startRow:1,endCol:31,endRow:18});
    if(years.length>2) charts.push({title:'Entrate e uscite per anno',categorySheet:'Andamento annuale',categoryCol:0,firstDataRow:2,lastDataRow:years.length,series:[{sheet:'Andamento annuale',col:1,nameCol:1},{sheet:'Andamento annuale',col:2,nameCol:2}],startCol:0,startRow:20,endCol:14,endRow:37});
    const annualCharts=topCounterparts.length?[{title:'Andamento annuale per contropartita · saldo netto',categorySheet:'Trend contropartite anno',categoryCol:0,firstDataRow:2,lastDataRow:annualPivot.length,series:counterpartAnnualSeries,startCol:16,startRow:1,endCol:31,endRow:18}]:[];
    downloadXlsx('Ricerca-avanzata.xlsx',[
      {name:'Riepilogo',rows:summary,titleRow:0,headerRow:0,currencyColumns:[1]},
      {name:'Movimenti',rows:transactions,dateColumns:[0],currencyColumns:[4]},
      {name:'Andamento mensile',rows:months,currencyColumns:[1,2,3],charts},
      {name:'Andamento annuale',rows:years,currencyColumns:[1,2,3],charts:annualCharts},
      {name:'Contropartite',rows:counterpartRows,dateColumns:[0],currencyColumns:[2,3,4]},
      {name:'Contropartite anno',rows:counterpartYearRows,currencyColumns:[2,3,4]},
      {name:'Trend contropartite',rows:monthlyPivot,currencyColumns:topCounterparts.map((_,i)=>i+1)},
      {name:'Trend contropartite anno',rows:annualPivot,currencyColumns:topCounterparts.map((_,i)=>i+1)}
    ]);
  }
  function setupFinanceViews() {
    if (setupFinanceViews.listenersBound) { if(state.transactions.length&&state.recurringDetectionLastTransactionCount!==state.transactions.length)detectRecurringProposals(); renderBudgetView(); renderForecastSelection(); return; }
    setupFinanceViews.listenersBound = true;
    const account = $('#searchAccount');
    if (account) {
      const old = account.value;
      const categoryOrder = path => {
        const root = normalize(String(path || '').split(':')[0]);
        if (root === 'attivita') return 0;
        if (root === 'passivita') return 1;
        if (root === 'uscite') return 2;
        if (root === 'entrate') return 3;
        if (root === 'patrimonio netto') return 4;
        return 5;
      };
      const orderedAccounts = state.accounts.filter(a=>a.type!=='ROOT')
        .sort((a,b)=>categoryOrder(a.path)-categoryOrder(b.path) || a.path.localeCompare(b.path,'it',{sensitivity:'base'}));
      const searchList = $('#searchAdvancedAccountOptions');
      if (searchList) searchList.innerHTML = orderedAccounts.map(a=>'<option value="' + safeText(accountDisplayLabel(a)) + '"></option>').join('');
      if (old && orderedAccounts.some(a=>a.id===old)) account.value=accountDisplayLabel(accountById(old));
      else if (!old || old === 'all') account.value='';
    }
    renderSavedFilters();
    const budgetMonth = $('#budgetMonth');
    if (budgetMonth && !budgetMonth.value) budgetMonth.value = localDateKey(new Date()).slice(0,7);
    const forecast = $('#forecastAccountChoices');
    if (forecast) {
      const ids = Array.isArray(state.forecastSettings?.accountIds) ? state.forecastSettings.accountIds : [];
      const eligible = state.accounts.filter(isLiquidAccount);
      const all = ids.length === 0 || eligible.every(a=>ids.includes(a.id));
      $('#forecastAllAccounts').checked = all;
      forecast.innerHTML = eligible.map(a=>'<label style="display:flex;gap:9px;align-items:center;margin:9px 0"><input type="checkbox" data-forecast-account="' + safeText(a.id) + '" ' + (all || ids.includes(a.id) ? 'checked' : '') + '> ' + safeText(accountDisplayLabel(a)) + '</label>').join('') || '<p class="panel-subtitle">Nessun conto liquido riconosciuto nel piano dei conti.</p>';
      forecast.querySelectorAll('[data-forecast-account]').forEach(box=>box.addEventListener('change',()=>{
        const selected=[...forecast.querySelectorAll('[data-forecast-account]:checked')].map(x=>x.dataset.forecastAccount);
        state.forecastSettings.accountIds=selected.length===eligible.length?[]:selected;
        $('#forecastAllAccounts').checked=state.forecastSettings.accountIds.length===0;
        saveState();renderForecastSelection();
      }));
    }
    $('#forecastAllAccounts')?.addEventListener('change',()=>{
      state.forecastSettings.accountIds=[];
      setupFinanceViews();
      saveState();
    });
    $('#runAdvancedSearch')?.addEventListener('click',runAdvancedSearch);
    $('#exportAdvancedPdf')?.addEventListener('click',exportAdvancedSearchPdf);
    $('#exportAdvancedXlsx')?.addEventListener('click',exportAdvancedSearchXlsx);
    $('#clearAdvancedSearch')?.addEventListener('click',()=>{
      ['searchFrom','searchTo','searchText','searchMin','searchMax'].forEach(id=>$('#'+id).value='');
      $('#searchDirection').value='all';$('#searchStatus').value='all';$('#searchAccount').value='';runAdvancedSearch();
    });
    $('#saveAdvancedFilter')?.addEventListener('click',()=>{
      const name=window.prompt('Nome da assegnare al filtro:');
      if(!name?.trim())return;
      state.savedFilters.push({id:uid('f'),name:name.trim().slice(0,60),criteria:searchControls()});
      saveState();renderSavedFilters();
    });
    $('#savedFilterPicker')?.addEventListener('change',()=>{
      const f=state.savedFilters.find(x=>x.id===$('#savedFilterPicker').value);if(!f)return;
      const c=f.criteria||{};
      $('#searchFrom').value=c.from||'';$('#searchTo').value=c.to||'';$('#searchText').value=c.text||'';
      $('#searchMin').value=c.min??'';$('#searchMax').value=c.max??'';
      $('#searchDirection').value=c.direction||'all';$('#searchStatus').value=c.status||'all';$('#searchAccount').value=c.account==='all'?'':(accountById(c.account)?accountDisplayLabel(accountById(c.account)):c.account||'');runAdvancedSearch();
    });
    $('#budgetMonth')?.addEventListener('change',renderBudgetView);
    $('#generateBudgetProposal')?.addEventListener('click',generateBudgetForSelectedMonth);
    $('#generateHistoricalBudgets')?.addEventListener('click',generateHistoricalBudgets);
    $('#confirmBudgetSnapshot')?.addEventListener('click',confirmBudgetForSelectedMonth);
    $('#saveBudgetEdits')?.addEventListener('click',saveBudgetEdits);
    renderBudgetView();
    $('#addRecurringRule')?.addEventListener('click',addRecurringRule);
    $('#detectRecurringRules')?.addEventListener('click',detectRecurringProposals);
    renderRecurringProposals();
    if(state.transactions.length&&state.recurringDetectionLastTransactionCount!==state.transactions.length)detectRecurringProposals();
    if ($('#recStart') && !$('#recStart').value) $('#recStart').value=localDateKey(new Date());
    renderForecastSelection();
  }
  function budgetSpentByCategory(transactions,month) {
    const totals=new Map();
    const addExpense=(accountId,amount)=>{
      let account=accountById(accountId),guard=new Set();
      while(account&&account.type==='EXPENSE'&&!guard.has(account.id)){
        guard.add(account.id);
        totals.set(account.id,(totals.get(account.id)||0)+amount);
        account=account.parentId?accountById(account.parentId):null;
      }
    };
    for(const tx of transactions||[]){
      if(tx.status!=='confirmed'||String(tx.date||'').slice(0,7)!==month)continue;
      const splits=Array.isArray(tx.counterpartSplits)&&tx.counterpartSplits.length?tx.counterpartSplits:null;
      if(splits){
        for(const split of splits)addExpense(split.accountId,Math.abs(Number(split.value)||0));
      } else addExpense(tx.counterpartAccountId,Math.abs(Number(tx.amount)||0));
    }
    return totals;
  }

  function budgetIncomeHistory(targetMonth) {
    const now=new Date(),[targetYear,targetMonthNumber]=String(targetMonth||localDateKey(now).slice(0,7)).split('-').map(Number);
    const currentYear=now.getFullYear();
    const cutoff=targetYear<currentYear?targetMonthNumber-1:Math.min(targetMonthNumber-1,now.getMonth());
    const currentMonths=Array.from({length:Math.max(0,cutoff)},(_,i)=>targetYear+'-'+String(i+1).padStart(2,'0'));
    const accounts=state.accounts.filter(a=>a.type==='INCOME'&&a.hierarchyType!=='Mastro');
    const coverage=currentMonths.filter(key=>accounts.some(account=>budgetActualDirect(key,account.id)>0)).length;
    const months=coverage>=3?currentMonths:Array.from({length:12},(_,i)=>(targetYear-1)+'-'+String(i+1).padStart(2,'0'));
    return {accounts,months,source:coverage>=3?'anno_corrente':'anno_precedente'};
  }
  function budgetIncomeForecastForMonth(month) {
    const history=budgetIncomeHistory(month);
    const amount=history.accounts.reduce((sum,account)=>sum+history.months.reduce((total,key)=>total+budgetActualDirect(key,account.id),0)/Math.max(1,history.months.length),0);
    return {amount:Math.round(amount*100)/100,source:history.source,months:history.months.length};
  }
  function budgetActualDirect(month, accountId) {
    let total = 0;
    for (const tx of state.transactions) {
      if (tx.status !== 'confirmed' || String(tx.date || '').slice(0, 7) !== month) continue;
      const splits = Array.isArray(tx.counterpartSplits) && tx.counterpartSplits.length ? tx.counterpartSplits : null;
      if (splits) for (const split of splits) { if (split.accountId === accountId) total += Math.abs(Number(split.value) || 0); }
      else if (tx.counterpartAccountId === accountId) total += Math.abs(Number(tx.amount) || 0);
    }
    return Math.round((total + Number.EPSILON) * 100) / 100;
  }
  function activeBudgetSnapshot(month) {
    return state.budgetSnapshots.filter(x => x.month === month).sort((a,b) => Number(b.version || 0) - Number(a.version || 0))[0] || null;
  }
  function budgetEligibleAccounts() {
    return state.accounts.filter(a => a.hierarchyType !== 'Mastro' &&
      (a.type === 'EXPENSE' || (a.classification === 'Patrimoniale' && a.includeInBudget === true && !isLiquidAccount(a))));
  }
  function budgetExpenseHistory(month, accounts) {
    const now=new Date(),[year,targetMonth]=month.split('-').map(Number),currentYear=now.getFullYear();
    const cutoff=year<currentYear?targetMonth-1:Math.min(targetMonth-1,now.getMonth());
    const currentMonths=Array.from({length:Math.max(0,cutoff)},(_,i)=>year+'-'+String(i+1).padStart(2,'0'));
    const coverage=currentMonths.filter(key=>accounts.some(account=>budgetActualDirect(key,account.id)>0)).length;
    const months=coverage>=3?currentMonths:Array.from({length:12},(_,i)=>(year-1)+'-'+String(i+1).padStart(2,'0'));
    return {months,source:coverage>=3?'anno_corrente':'anno_precedente'};
  }
  function generateBudgetSnapshot(month) {
    const categories = budgetEligibleAccounts().sort((a,b)=>a.path.localeCompare(b.path,'it'));
    const expenseHistory=budgetExpenseHistory(month,categories);
    const sourceMonths=expenseHistory.months;
    const historySource=expenseHistory.source;
    const lines = categories.map(account => {
      const fixedForMonth = key => state.recurringRules.filter(rule=>rule.active&&rule.categoryId===account.id&&Number(rule.amount)<0)
        .flatMap(rule=>recurringOccurrenceDates(rule,key).map(date=>({rule,date})))
        .reduce((sum,item)=>sum+Math.abs(Number(item.rule.amount)||0),0);
      const variableHistory = sourceMonths.map(key => {
        const actual=budgetActualDirect(key,account.id);
        const realizedFixed=state.recurringRules.filter(rule=>rule.active&&rule.categoryId===account.id&&Number(rule.amount)<0)
          .reduce((sum,rule)=>sum+state.transactions.filter(tx=>tx.status==='confirmed'&&String(tx.date||'').slice(0,7)===key&&String(tx.date||'')>=String(rule.historyStartDate||rule.startDate||'')&&transactionMatchesRecurringRule(tx,rule)).reduce((subtotal,tx)=>subtotal+Math.abs(Number(tx.amount)||0),0),0);
        return Math.max(0,actual-realizedFixed);
      });
      const variable = variableHistory.reduce((sum,value)=>sum+value,0)/Math.max(1,variableHistory.length);
      const recurring = fixedForMonth(month);
      const budget = Math.round((variable+recurring+Number.EPSILON)*100)/100;
      const spent = budgetActualDirect(month, account.id);
      return { accountId: account.id, budget, recurring:Math.round(recurring*100)/100, variable:Math.round(variable*100)/100,
        spent, remaining: Math.round((budget-spent)*100)/100,
        utilization: budget > 0 ? Math.round(spent/budget*10000)/100 : null, historySource };
    });
    const incomeHistory=budgetIncomeHistory(month);
    const incomeLines=incomeHistory.accounts.sort((a,b)=>a.path.localeCompare(b.path,'it')).map(account=>{
      const history=incomeHistory.months.map(key=>budgetActualDirect(key,account.id));
      const budget=Math.round((history.reduce((sum,value)=>sum+value,0)/Math.max(1,history.length)+Number.EPSILON)*100)/100;
      const actual=budgetActualDirect(month,account.id);
      return {accountId:account.id,budget,spent:actual,remaining:Math.round((budget-actual)*100)/100,
        utilization:budget>0?Math.round(actual/budget*10000)/100:null,historySource:incomeHistory.source};
    });
    const previous = activeBudgetSnapshot(month);
    const version = (previous?.version || 0) + 1;
    return { month, version, createdAt: new Date().toISOString(), status: 'proposta', historySource, historyMonths: sourceMonths.length,
      lines, totalBudget: lines.reduce((sum,x)=>sum+x.budget,0), totalActual: lines.reduce((sum,x)=>sum+x.spent,0),
      totalRecurringExpenses:lines.reduce((sum,x)=>sum+(x.recurring||0),0), totalVariableExpenses:lines.reduce((sum,x)=>sum+(x.variable||0),0),
      incomeLines, totalIncomeBudget:incomeLines.reduce((sum,x)=>sum+x.budget,0),
      actualIncome:incomeLines.reduce((sum,x)=>sum+x.spent,0),
      incomeHistorySource:incomeHistory.source, incomeHistoryMonths:incomeHistory.months.length };
  }
  function renderBudgetView() {
    const body=$('#budgetBody');if(!body)return;
    const month=$('#budgetMonth')?.value||localDateKey(new Date()).slice(0,7);
    let snapshot=activeBudgetSnapshot(month);
    const currentMonth=localDateKey(new Date()).slice(0,7);
    if(!snapshot&&month>=currentMonth){snapshot=generateBudgetSnapshot(month);state.budgetSnapshots.push(snapshot);void saveState().then(()=>renderBudgetView());}
    const categories=budgetEligibleAccounts().sort((a,b)=>a.path.localeCompare(b.path,'it'));
    const incomeCategories=state.accounts.filter(a=>a.type==='INCOME'&&a.hierarchyType!=='Mastro').sort((a,b)=>a.path.localeCompare(b.path,'it'));
    const actuals=new Map(categories.map(a=>[a.id,budgetActualDirect(month,a.id)]));
    const lines=new Map((snapshot?.lines||[]).map(x=>[x.accountId,x]));
    const incomeLines=new Map((snapshot?.incomeLines||[]).map(x=>[x.accountId,x]));
    const totalActual=categories.reduce((sum,account)=>sum+(actuals.get(account.id)||0),0);
    const totalBudget=snapshot?.totalBudget||0;
    const incomeActual=incomeCategories.reduce((sum,account)=>sum+budgetActualDirect(month,account.id),0);
    const incomeBudget=snapshot?.totalIncomeBudget??snapshot?.incomeForecast??budgetIncomeForecastForMonth(month).amount;
    const summaryValues={
      budgetIncome:incomeBudget,budgetTotal:totalBudget,budgetRecurring:snapshot?.totalRecurringExpenses||0,
      budgetVariable:snapshot?.totalVariableExpenses||0,budgetActual:totalActual,
      budgetRemaining:totalBudget-totalActual,budgetNet:incomeBudget-totalBudget,
      budgetIncomeActual:incomeActual
    };
    Object.entries(summaryValues).forEach(([id,value])=>{const el=$('#'+id);if(el)el.textContent=euro.format(value);});
    const incomeBody=$('#budgetIncomeBody');
    if(incomeBody) incomeBody.innerHTML=incomeCategories.map(a=>{
      const line=incomeLines.get(a.id),budget=Number(line?.budget??line?.forecast)||0,spent=budgetActualDirect(month,a.id),remaining=budget-spent,pct=budget>0?spent/budget*100:null;
      return '<tr><td class="name-primary">'+safeText(a.path)+'</td><td><input type="number" min="0" step="0.01" data-budget-income-account="'+safeText(a.id)+'" value="'+(line?budget:'')+'" placeholder="Non impostato" style="width:130px;padding:7px;border:1px solid #dce5e2;border-radius:6px" '+(snapshot?'':'disabled')+'></td><td>'+euro.format(spent)+'</td><td class="'+(remaining<0?'amount-out':'amount-in')+'">'+(line?euro.format(remaining):'—')+'</td><td>'+(line&&budget>0?Math.round(pct)+'%':'—')+'</td></tr>';
    }).join('')||'<tr><td colspan="5" class="empty-inline">Nessuna categoria di entrata disponibile.</td></tr>';
    body.innerHTML=categories.map(a=>{
      const line=lines.get(a.id),budget=Number(line?.budget)||0,spent=actuals.get(a.id)||0,remaining=budget-spent,pct=budget>0?spent/budget*100:null;
      return '<tr><td class="name-primary">'+safeText(a.path)+(a.hierarchyType==='Mastro e conto'?' <small>· conto e mastro</small>':'')+'</td><td><input type="number" min="0" step="0.01" data-budget-account="'+safeText(a.id)+'" value="'+(line?budget:'')+'" placeholder="Non impostato" style="width:130px;padding:7px;border:1px solid #dce5e2;border-radius:6px" '+(snapshot?'':'disabled')+'>'+(line?'<small style="display:block;color:#71817d">'+(line.manualOverride?'Modificato manualmente':'Fisse '+euro.format(line.recurring||0)+' · Variabili '+euro.format(line.variable||0))+'</small>':'')+'</td><td>'+euro.format(spent)+'</td><td class="'+(remaining<0?'amount-out':'amount-in')+'">'+(line?euro.format(remaining):'—')+'</td><td>'+(line&&budget>0?Math.round(pct)+'%':'—')+'</td></tr>';
    }).join('')||'<tr><td colspan="5" class="empty-inline">Nessuna categoria di spesa utilizzabile nel budget.</td></tr>';
    const status=$('#budgetSnapshotStatus');
    if(status)status.textContent=snapshot?'Versione '+snapshot.version+' · '+(snapshot.status==='confermato'?'Confermato':'Proposta')+' · base: '+(snapshot.historySource==='anno_corrente'?'anno corrente':'anno precedente')+' · '+snapshot.historyMonths+' mesi':'Nessun budget salvato per questo mese. Genera una proposta per iniziare.';
    const generate=$('#generateBudgetProposal'),confirm=$('#confirmBudgetSnapshot'),save=$('#saveBudgetEdits');
    if(generate)generate.textContent=snapshot?'Genera nuova versione':'Genera proposta automatica';
    if(confirm)confirm.disabled=!snapshot||snapshot.status==='confermato';
    if(save)save.disabled=!snapshot;
  }
  async function generateBudgetForSelectedMonth() {
    const month=$('#budgetMonth')?.value||localDateKey(new Date()).slice(0,7),previous=activeBudgetSnapshot(month);
    if(previous){showConfirm('Generare una nuova versione del budget?', 'La versione esistente resterà conservata nello storico. Verrà creata una nuova proposta per '+monthName(month)+'.', async()=>{state.budgetSnapshots.push(generateBudgetSnapshot(month));await saveState();renderBudgetView();});return;}
    state.budgetSnapshots.push(generateBudgetSnapshot(month));await saveState();renderBudgetView();
  }
  async function generateHistoricalBudgets() {
    const now=new Date(),year=now.getFullYear(),lastCompletedMonth=now.getMonth();
    if(lastCompletedMonth<1){showNotice('Nessun mese storico disponibile','La funzione sarà disponibile dal mese successivo.');return;}
    const months=Array.from({length:lastCompletedMonth},(_,i)=>year+'-'+String(i+1).padStart(2,'0'));
    showConfirm('Ricalcolare i budget storici?', 'Saranno create nuove proposte da gennaio a '+monthName(months[months.length-1])+' '+year+'. Le versioni già presenti non verranno cancellate: resteranno nello storico.', async()=>{
      months.forEach(month=>state.budgetSnapshots.push(generateBudgetSnapshot(month)));
      await saveState();renderBudgetView();
      showNotice('Budget storici generati',months.length+' nuove versioni create. Seleziona i mesi precedenti per confrontare previsto ed effettivo.');
    });
  }
  async function confirmBudgetForSelectedMonth() {
    const month=$('#budgetMonth')?.value||localDateKey(new Date()).slice(0,7),snapshot=activeBudgetSnapshot(month);if(!snapshot)return;
    snapshot.status='confermato';snapshot.confirmedAt=new Date().toISOString();await saveState();renderBudgetView();
  }
  async function saveBudgetEdits() {
    const month=$('#budgetMonth')?.value||localDateKey(new Date()).slice(0,7),snapshot=activeBudgetSnapshot(month);if(!snapshot)return;
    const next=JSON.parse(JSON.stringify(snapshot));next.version=Number(snapshot.version||1)+1;next.createdAt=new Date().toISOString();next.status='proposta';delete next.confirmedAt;
    $('#budgetBody').querySelectorAll('[data-budget-account]').forEach(input=>{const line=next.lines.find(x=>x.accountId===input.dataset.budgetAccount);if(line){line.budget=Math.max(0,Number(input.value)||0);line.manualOverride=true;line.remaining=Math.round((line.budget-line.spent)*100)/100;line.utilization=line.budget>0?Math.round(line.spent/line.budget*10000)/100:null;}});
    $('#budgetIncomeBody')?.querySelectorAll('[data-budget-income-account]').forEach(input=>{const line=next.incomeLines?.find(x=>x.accountId===input.dataset.budgetIncomeAccount);if(line){line.budget=Math.max(0,Number(input.value)||0);line.manualOverride=true;line.remaining=Math.round((line.budget-line.spent)*100)/100;line.utilization=line.budget>0?Math.round(line.spent/line.budget*10000)/100:null;}});
    next.totalIncomeBudget=(next.incomeLines||[]).reduce((sum,x)=>sum+(Number(x.budget)||0),0);
    next.incomeForecast=next.totalIncomeBudget;
    next.actualIncome=(next.incomeLines||[]).reduce((sum,x)=>sum+(Number(x.spent)||0),0);
    next.totalBudget=next.lines.reduce((sum,x)=>sum+x.budget,0);next.totalRecurringExpenses=next.lines.reduce((sum,x)=>sum+(x.recurring||0),0);next.totalVariableExpenses=next.lines.reduce((sum,x)=>sum+(x.manualOverride?Math.max(0,x.budget-(x.recurring||0)):(x.variable||0)),0);state.budgetSnapshots.push(next);await saveState();renderBudgetView();
  }

  function forecastSelectedAccounts() {
    const ids=Array.isArray(state.forecastSettings?.accountIds)?state.forecastSettings.accountIds:[];
    return state.accounts.filter(isLiquidAccount).filter(a=>ids.length===0||ids.includes(a.id));
  }
  function monthKeyFromDate(d) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
  function shiftMonthKey(key,offset) {
    const [y,m]=key.split('-').map(Number);const d=new Date(y,m-1+offset,1);
    return monthKeyFromDate(d);
  }
  function monthLabel(key) {
    const [y,m]=key.split('-').map(Number);
    return new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(new Date(y,m-1,1));
  }
  function monthOccurrence(rule,key) {
    const [y,m]=key.split('-').map(Number),last=new Date(y,m,0).getDate();
    const day=Math.min(Math.max(1,Number(rule.day)||1),last);
    return key+'-'+String(day).padStart(2,'0');
  }
  function recurringOccursInMonth(rule,key) {
    if(!rule.active)return false;
    const start=String(rule.startDate||''),end=String(rule.endDate||'');
    const [sy,sm,sd]=start.split('-').map(Number),[y,m]=key.split('-').map(Number);
    if(!sy||!sm||!sd)return false;
    const monthDiff=(y-sy)*12+(m-sm);
    if(rule.frequency==='once')return monthDiff===0;
    const periods={monthly:1,bimonthly:2,quarterly:3,fourmonthly:4,halfyearly:6,yearly:12};
    if(rule.frequency==='weekly'||rule.frequency==='biweekly'){
      const first=new Date(y,m-1,1),last=new Date(y,m,0),origin=new Date(sy,sm-1,sd);
      const step=rule.frequency==='weekly'?7:14;
      let due=new Date(origin);while(due<first)due.setDate(due.getDate()+step);
      while(due<=last){const keyDate=localDateKey(due);if(keyDate>=start&&(!end||keyDate<=end))return true;due.setDate(due.getDate()+step);}
      return false;
    }
    const period=periods[rule.frequency];
    if(!period||monthDiff<0||monthDiff%period!==0)return false;
    const date=monthOccurrence(rule,key);
    return date>=start&&(!end||date<=end);
  }
  function transactionMatchesRecurringRule(tx,rule) {
    const target=normalize(rule.description);
    const tolerance=Math.max(1,Math.abs(Number(rule.amount)||0)*0.05);
    const splits=Array.isArray(tx.counterpartSplits)?tx.counterpartSplits:[];
    const relevantAmount=rule.categoryId&&splits.length
      ? splits.filter(split=>split.accountId===rule.categoryId).reduce((sum,split)=>sum+Math.abs(Number(split.value)||0),0)
      : Math.abs(Number(tx.amount)||0);
    return tx.status==='confirmed' && tx.bankAccountId===rule.bankAccountId &&
      Math.abs(relevantAmount-Math.abs(Number(rule.amount)||0))<=tolerance &&
      Boolean(target) && normalize(transactionDescription(tx)||transactionCausale(tx))===target;
  }
  function recurringOccurrenceDates(rule,key) {
    if(!recurringOccursInMonth(rule,key))return [];
    const start=String(rule.startDate||''),end=String(rule.endDate||'');
    const [sy,sm,sd]=start.split('-').map(Number),[y,m]=key.split('-').map(Number);
    if(rule.frequency==='weekly'||rule.frequency==='biweekly'){
      const first=new Date(y,m-1,1),last=new Date(y,m,0),origin=new Date(sy,sm-1,sd),step=rule.frequency==='weekly'?7:14,dates=[];
      let due=new Date(origin);while(due<first)due.setDate(due.getDate()+step);
      while(due<=last){const date=localDateKey(due);if(date>=start&&(!end||date<=end))dates.push(date);due.setDate(due.getDate()+step);}
      return dates;
    }
    const date=monthOccurrence(rule,key);
    return date>=start&&(!end||date<=end)?[date]:[];
  }
  function recurringAlreadyRealized(rule,date) {
    return state.transactions.some(tx=>{
      if(tx.status!=='confirmed'||!tx.date||!transactionMatchesRecurringRule(tx,rule))return false;
      const days=Math.abs((Date.parse(tx.date+'T12:00:00Z')-Date.parse(date+'T12:00:00Z'))/86400000);
      return days<=5;
    });
  }
  function forecastRecurringItems(key,selectedIds) {
    const today=localDateKey(new Date());
    return state.recurringRules.filter(r=>r.active&&selectedIds.has(r.bankAccountId))
      .flatMap(rule=>recurringOccurrenceDates(rule,key).filter(date=>(key!==today.slice(0,7)||date>=today)&&!recurringAlreadyRealized(rule,date))
        .map(date=>({...rule,occurrenceDate:date})));
  }
  function transactionIsExplicitlyRecurring(tx,categoryId,key,selectedIds) {
    return state.recurringRules.some(rule=>rule.active&&rule.categoryId===categoryId&&selectedIds.has(rule.bankAccountId)&&
      String(tx.date||'')>=String(rule.historyStartDate||rule.startDate||'')&&transactionMatchesRecurringRule(tx,rule));
  }
  function forecastTransactionFlow(tx,selectedIds) {
    if(tx.status!=='confirmed'||tx.status==='duplicate')return 0;
    const bankSelected=selectedIds.has(tx.bankAccountId);
    const splits=Array.isArray(tx.counterpartSplits)&&tx.counterpartSplits.length?tx.counterpartSplits:null;
    if(splits){
      const selectedCounterparts=splits.filter(split=>selectedIds.has(split.accountId)&&isLiquidAccount(accountById(split.accountId)));
      if(bankSelected)return (Number(tx.amount)||0)+selectedCounterparts.reduce((sum,split)=>sum+(Number(split.value)||0),0);
      return selectedCounterparts.reduce((sum,split)=>sum+(Number(split.value)||0),0);
    }
    if(bankSelected){
      if(selectedIds.has(tx.counterpartAccountId)&&isLiquidAccount(accountById(tx.counterpartAccountId)))return 0;
      return Number(tx.amount)||0;
    }
    // The selected account is the counterpart of a transaction booked on an excluded account.
    if(selectedIds.has(tx.counterpartAccountId)&&isLiquidAccount(accountById(tx.counterpartAccountId)))return -(Number(tx.amount)||0);
    return 0;
  }
  function median(values) {
    if(!values.length)return 0;
    const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);
    return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
  }
  function renderRecurringRules() {
    const body=$('#recurringBody');if(!body)return;
    const labels={once:'Una tantum',weekly:'Settimanale',biweekly:'Quindicinale',monthly:'Mensile',bimonthly:'Bimestrale',quarterly:'Trimestrale',fourmonthly:'Quadrimestrale',halfyearly:'Semestrale',yearly:'Annuale'};
    body.innerHTML=state.recurringRules.map(r=>'<tr><td>'+safeText(r.description)+'</td><td>'+euro.format(r.amount)+'</td><td>'+labels[r.frequency]+'</td><td>'+safeText(r.startDate)+'</td><td>'+(r.active?'Attiva':'Sospesa')+'</td><td><button class="row-action" data-edit-rec="'+safeText(r.id)+'">Modifica</button> <button class="row-action" data-toggle-rec="'+safeText(r.id)+'">'+(r.active?'Sospendi':'Attiva')+'</button> <button class="row-action row-action-danger" data-delete-rec="'+safeText(r.id)+'">Elimina</button></td></tr>').join('')||'<tr><td colspan="6" class="empty-inline">Nessuna ricorrenza configurata.</td></tr>';
    body.querySelectorAll('[data-edit-rec]').forEach(b=>b.addEventListener('click',()=>{const r=state.recurringRules.find(x=>x.id===b.dataset.editRec);if(!r)return;editingRecurringId=r.id;$('#recDescription').value=r.description;$('#recAmount').value=r.amount;$('#recBankAccount').value=r.bankAccountId;$('#recCategory').value=r.categoryId||'';$('#recFrequency').value=r.frequency;$('#recDay').value=r.day||1;$('#recStart').value=r.startDate;$('#recEnd').value=r.endDate||'';$('#addRecurringRule').textContent='Salva modifica';$('#recDescription').focus();}));
    body.querySelectorAll('[data-toggle-rec]').forEach(b=>b.addEventListener('click',()=>{const r=state.recurringRules.find(x=>x.id===b.dataset.toggleRec);if(r)r.active=!r.active;saveState();renderForecastSelection();}));
    body.querySelectorAll('[data-delete-rec]').forEach(b=>b.addEventListener('click',()=>{state.recurringRules=state.recurringRules.filter(x=>x.id!==b.dataset.deleteRec);saveState();renderForecastSelection();}));
  }
  function detectRecurringProposals() {
    const groups=new Map();
    for(const tx of state.transactions){
      if(tx.status!=='confirmed'||!tx.date||tx.status==='duplicate')continue;
      const description=transactionDescription(tx)||transactionCausale(tx);if(!description)continue;
      const counterpart=tx.counterpartSplits?.length===1?tx.counterpartSplits[0].accountId:tx.counterpartAccountId;
      if(!counterpart)continue;
      const key=[normalize(description),tx.bankAccountId||'',counterpart,Math.sign(Number(tx.amount)||0)].join('|');
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(tx);
    }
    const labels=[['weekly',7],['biweekly',14],['monthly',30.44],['bimonthly',60.88],['quarterly',91.31],['fourmonthly',121.75],['halfyearly',182.63],['yearly',365.25]];
    const proposals=[];
    for(const items of groups.values()){
      const sorted=items.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
      if(sorted.length<2)continue;
      const gaps=[];for(let i=1;i<sorted.length;i++){const days=(Date.parse(sorted[i].date+'T12:00:00Z')-Date.parse(sorted[i-1].date+'T12:00:00Z'))/86400000;if(days>0)gaps.push(days);}
      if(gaps.length<1)continue;
      const ordered=[...gaps].sort((a,b)=>a-b),mid=Math.floor(ordered.length/2),typical=ordered.length%2?ordered[mid]:(ordered[mid-1]+ordered[mid])/2;
      const candidate=labels.map(([frequency,days])=>({frequency,days,error:Math.abs(typical-days)/days})).sort((a,b)=>a.error-b.error)[0];
      // Due annualità consecutive sono sufficienti per proporre una ricorrenza annuale;
      // per frequenze più ravvicinate restano necessarie almeno tre occorrenze.
      if(candidate.frequency!=='yearly'&&sorted.length<3)continue;
      if(candidate.error > (candidate.frequency === 'yearly' && sorted.length === 2 ? 0.15 : 0.22))continue;
      const amounts=sorted.map(tx=>Math.abs(Number(tx.amount)||0)).sort((a,b)=>a-b),am= Math.floor(amounts.length/2);
      const amountMagnitude=amounts.length%2?amounts[am]:(amounts[am-1]+amounts[am])/2;
      if(!amountMagnitude)continue;
      const amountDeviation=amounts.reduce((sum,value)=>sum+Math.abs(value-amountMagnitude),0)/amounts.length/amountMagnitude;
      if(amountDeviation>0.35)continue;
      const amount=Math.sign(Number(sorted[sorted.length-1].amount)||1)*amountMagnitude;
      const last=sorted[sorted.length-1].date,next=new Date(last+'T12:00:00');
      next.setDate(next.getDate()+Math.round(candidate.days));
      const description=transactionDescription(sorted[0])||transactionCausale(sorted[0]);
      proposals.push({id:uid('rp'),description,amount,bankAccountId:sorted[0].bankAccountId,categoryId:sorted[0].counterpartSplits?.length===1?sorted[0].counterpartSplits[0].accountId:sorted[0].counterpartAccountId,
        frequency:candidate.frequency,day:Number(last.slice(8,10)),startDate:sorted[0].date,historyStartDate:sorted[0].date,nextDate:localDateKey(next),endDate:null,occurrences:sorted.length,confidence:Math.round((1-candidate.error)*(1-amountDeviation)*100),status:'proposta'});
    }
    state.recurringProposals=proposals.filter(p=>!state.recurringRules.some(rule=>rule.active&&rule.bankAccountId===p.bankAccountId&&rule.categoryId===p.categoryId&&normalize(rule.description)===normalize(p.description))).sort((a,b)=>b.confidence-a.confidence);
    state.recurringDetectionLastTransactionCount=state.transactions.length;
    renderRecurringProposals();saveState();
  }
  function renderRecurringProposals() {
    const body=$('#recurringProposalsBody');if(!body)return;
    const labels={weekly:'Settimanale',biweekly:'Quindicinale',monthly:'Mensile',bimonthly:'Bimestrale',quarterly:'Trimestrale',fourmonthly:'Quadrimestrale',halfyearly:'Semestrale',yearly:'Annuale'};
    body.innerHTML=state.recurringProposals.map(p=>'<tr><td>'+safeText(p.description)+'</td><td>'+euro.format(p.amount)+'</td><td>'+labels[p.frequency]+'</td><td>'+safeText(formatDate(p.nextDate))+'</td><td>'+p.occurrences+'</td><td>'+p.confidence+'%</td><td><button class="row-action" data-accept-proposal="'+safeText(p.id)+'">Conferma</button> <button class="row-action row-action-danger" data-dismiss-proposal="'+safeText(p.id)+'">Ignora</button></td></tr>').join('')||'<tr><td colspan="7" class="empty-inline">Nessuna proposta. Analizza i movimenti confermati per cercare ricorrenze.</td></tr>';
    body.querySelectorAll('[data-accept-proposal]').forEach(button=>button.addEventListener('click',async()=>{const p=state.recurringProposals.find(x=>x.id===button.dataset.acceptProposal);if(!p)return;state.recurringRules.push({id:uid('r'),description:p.description,amount:p.amount,bankAccountId:p.bankAccountId,categoryId:p.categoryId,frequency:p.frequency,day:p.day,startDate:p.nextDate,historyStartDate:p.startDate,endDate:p.endDate,active:true,createdAt:new Date().toISOString(),source:'rilevata'});state.recurringProposals=state.recurringProposals.filter(x=>x.id!==p.id);await saveState();renderForecastSelection();}));
    body.querySelectorAll('[data-dismiss-proposal]').forEach(button=>button.addEventListener('click',async()=>{state.recurringProposals=state.recurringProposals.filter(x=>x.id!==button.dataset.dismissProposal);await saveState();renderRecurringProposals();}));
  }
  function addRecurringRule() {
    const description=$('#recDescription').value.trim(),amount=Number($('#recAmount').value),bankAccountId=$('#recBankAccount').value,categoryId=$('#recCategory').value;
    const frequency=$('#recFrequency').value,startDate=$('#recStart').value,endDate=$('#recEnd').value,day=frequency==='once'?Number(startDate.slice(8,10)):Math.min(31,Math.max(1,Number($('#recDay').value)||1));
    if(!description||!Number.isFinite(amount)||amount===0||!bankAccountId||!startDate){showNotice('Dati incompleti','Inserisci descrizione, importo diverso da zero, conto e prima occorrenza.');return;}
    if(endDate&&endDate<startDate){showNotice('Date non valide','L’ultima occorrenza non può precedere la prima.');return;}
    if(editingRecurringId){const existing=state.recurringRules.find(rule=>rule.id===editingRecurringId);if(existing)Object.assign(existing,{description,amount,bankAccountId,categoryId:categoryId||null,frequency,day,startDate,endDate:endDate||null});editingRecurringId=null;}else state.recurringRules.push({id:uid('r'),description,amount,bankAccountId,categoryId:categoryId||null,frequency,day,startDate,endDate:endDate||null,active:true,createdAt:new Date().toISOString(),source:'manuale'});
    saveState();['recDescription','recAmount','recEnd'].forEach(id=>$('#'+id).value='');$('#addRecurringRule').textContent='Aggiungi impegno manuale';renderForecastSelection();
  }
  function buildForecast() {
    const accounts=forecastSelectedAccounts(),ids=new Set(accounts.map(a=>a.id)),today=localDateKey(new Date()),currentMonth=today.slice(0,7);
    const txs=state.transactions.filter(t=>t.status==='confirmed'&&t.date<=today&&t.status!=='duplicate'&&
      (ids.has(t.bankAccountId)||ids.has(t.counterpartAccountId)||(Array.isArray(t.counterpartSplits)&&t.counterpartSplits.some(sp=>ids.has(sp.accountId)))));
    const primaryAccountId=state.bankAccountId;
    const opening=ids.has(primaryAccountId)?(Number(state.openingBalance)||0):0;
    const openingBalanceUnknown=accounts.filter(account=>account.id!==primaryAccountId);
    const lastClosedMonth=shiftMonthKey(currentMonth,-1);
    const cutoff=lastClosedMonth+'-'+String(new Date(Number(lastClosedMonth.slice(0,4)),Number(lastClosedMonth.slice(5,7)),0).getDate()).padStart(2,'0');
    const closedTxs=txs.filter(tx=>String(tx.date||'')<=cutoff);
    const openingBalance=opening+closedTxs.reduce((sum,tx)=>sum+forecastTransactionFlow(tx,ids),0);
    const categories=state.accounts.filter(a=>a.hierarchyType!=='Mastro'&&
      (['INCOME','EXPENSE'].includes(a.type)||(a.classification==='Patrimoniale'&&a.includeInBudget===true&&!isLiquidAccount(a))));
    const historyMonths=Array.from({length:12},(_,i)=>shiftMonthKey(lastClosedMonth,-11+i));
    const previousYearMonths=Array.from({length:12},(_,i)=>(Number(currentMonth.slice(0,4))-1)+'-'+String(i+1).padStart(2,'0'));
    const categoryMonthly=(accountId,month)=>{
      let total=0;
      for(const tx of txs){
        if(String(tx.date||'').slice(0,7)!==month)continue;
        if(tx.counterpartSplits?.length){for(const split of tx.counterpartSplits)if(split.accountId===accountId)total+=Math.abs(Number(split.value)||0);}
        else if(tx.counterpartAccountId===accountId)total+=Math.abs(Number(tx.amount)||0);
      }
      return total;
    };
    const recurringMonthly=(accountId,month)=>{
      const due=state.recurringRules.filter(rule=>rule.active&&rule.categoryId===accountId&&recurringOccursInMonth(rule,month));
      return due.reduce((sum,rule)=>sum+Math.abs(Number(rule.amount)||0),0);
    };
    const budgetFor=(account,month)=>{
      const exact=activeBudgetSnapshot(month);
      const snapshots=state.budgetSnapshots.filter(snapshot=>snapshot&&snapshot.month&&snapshot.month<=month)
        .sort((a,b)=>String(b.month).localeCompare(String(a.month))||Number(b.version||0)-Number(a.version||0));
      const snapshot=exact||snapshots[0]||null;
      const lines=account.type==='INCOME'?(snapshot?.incomeLines||[]):(snapshot?.lines||[]);
      const line=lines.find(item=>item.accountId===account.id);
      const value=Number(line?.budget);
      return Number.isFinite(value)&&value>0?{amount:value,source:'budget'}:null;
    };
    const historyEstimate=(account,month)=>{
      const currentYearMonths=historyMonths.filter(key=>key.slice(0,4)===currentMonth.slice(0,4)&&key<currentMonth);
      const currentValues=currentYearMonths.map(key=>categoryMonthly(account.id,key));
      const priorValues=previousYearMonths.map(key=>categoryMonthly(account.id,key));
      const currentActive=currentValues.filter(value=>value>0).length;
      const priorActive=priorValues.filter(value=>value>0).length;
      const usePrior=currentActive<3&&priorActive>=3;
      const values=usePrior?priorValues:currentValues;
      const active=values.filter(value=>value>0);
      if(active.length<3)return {amount:0,source:'sporadico'};
      return {amount:median(active),source:usePrior?'anno_precedente':'anno_corrente'};
    };
    const forecast=[];
    let balance=openingBalance;
    const sources=new Set();
    for(let i=0;i<12;i++){
      const key=shiftMonthKey(currentMonth,i);
      const due=forecastRecurringItems(key,ids).filter(rule=>i!==0||rule.occurrenceDate>=today);
      const programmedIncome=due.filter(rule=>Number(rule.amount)>0).reduce((sum,rule)=>sum+Number(rule.amount),0);
      const programmedExpense=due.filter(rule=>Number(rule.amount)<0).reduce((sum,rule)=>sum+Math.abs(Number(rule.amount)),0);
      let actualIncome=0,actualExpense=0;
      if(i===0){
        for(const tx of txs.filter(tx=>String(tx.date||'')>cutoff&&String(tx.date||'')<=today)){
          const flow=forecastTransactionFlow(tx,ids);if(flow>=0)actualIncome+=flow;else actualExpense+=Math.abs(flow);
        }
      }
      let estimateIncome=0,estimateExpense=0;
      for(const account of categories){
        const budget=budgetFor(account,key);
        const historic=budget||historyEstimate(account,key);
        if(historic.source==='sporadico')continue;
        sources.add(historic.source);
        const scheduledRemaining=due.filter(rule=>rule.categoryId===account.id).reduce((sum,rule)=>sum+Math.abs(Number(rule.amount)||0),0);
        const already= i===0?categoryMonthly(account.id,key):0;
        const residual=Math.max(0,historic.amount-scheduledRemaining-already);
        if(account.type==='INCOME')estimateIncome+=residual;else estimateExpense+=residual;
      }
      estimateIncome=Math.round(estimateIncome*100)/100;
      estimateExpense=Math.round(estimateExpense*100)/100;
      const opening=balance;
      balance=Math.round((balance+actualIncome-actualExpense+programmedIncome-programmedExpense+estimateIncome-estimateExpense)*100)/100;
      forecast.push({key,openingBalance:opening,actualIncome,actualExpense,programmedIncome,programmedExpense,estimateIncome,estimateExpense,
        programmed:programmedIncome-programmedExpense,estimate:estimateIncome-estimateExpense,balance});
    }
    const minimum=forecast.reduce((a,b)=>b.balance<a.balance?b:a,forecast[0]||{balance:openingBalance,key:currentMonth});
    const source=sources.size>1?'budget e storico misti':sources.has('budget')?'budget':sources.has('anno_precedente')?'anno precedente':'anno corrente';
    const historyCount=historyMonths.filter(key=>txs.some(tx=>String(tx.date||'').slice(0,7)===key)).length;
    return {accounts,currentBalance:openingBalance,forecast,minimum,historyCount,estimatedNet:forecast.reduce((sum,row)=>sum+row.estimateIncome-row.estimateExpense,0),estimates:{source},openingBalanceUnknown,lastClosedMonth};
  }
  function renderForecastSelection() {
    const ids=Array.isArray(state.forecastSettings?.accountIds)?state.forecastSettings.accountIds:[];
    const count=forecastSelectedAccounts().length;
    const status=$('#forecastStatus');if(status)status.textContent='Conti inclusi: '+count+'. Selezione vuota = tutti i conti liquidi.';
    const liquid=state.accounts.filter(isLiquidAccount);
    const bank=$('#recBankAccount'),category=$('#recCategory');
    if(bank){const prior=bank.value;bank.innerHTML=liquid.map(a=>'<option value="'+safeText(a.id)+'">'+safeText(accountDisplayLabel(a))+'</option>').join('');if(liquid.some(a=>a.id===prior))bank.value=prior;}
    if(category){const prior=category.value;category.innerHTML='<option value="">Senza categoria</option>'+state.accounts.filter(a=>['INCOME','EXPENSE'].includes(a.type)||(a.classification==='Patrimoniale'&&a.includeInBudget===true&&!isLiquidAccount(a))).map(a=>'<option value="'+safeText(a.id)+'">'+safeText(accountDisplayLabel(a))+'</option>').join('');if([...category.options].some(o=>o.value===prior))category.value=prior;}
    renderRecurringRules();
    const result=buildForecast();
    $('#forecastOpening').textContent=euro.format(result.currentBalance);
    $('#forecastMinimum').textContent=euro.format(result.minimum.balance);
    $('#forecastMinimumMonth').textContent=monthLabel(result.minimum.key);
    $('#forecastEnding').textContent=euro.format(result.forecast.at(-1)?.balance??result.currentBalance);
    $('#forecastReliability').textContent='Saldo al '+monthLabel(result.lastClosedMonth)+' · base '+result.estimates.source+' · stima indicativa'+(result.openingBalanceUnknown.length?' · saldo iniziale non configurato per '+result.openingBalanceUnknown.length+' conto/i':''); 
    if(status&&result.openingBalanceUnknown.length)status.textContent+=' ATTENZIONE: il saldo iniziale è disponibile solo per '+(accountById(state.bankAccountId)?.path||'il conto principale')+'. Per gli altri conti selezionati il saldo storico potrebbe essere incompleto.';
    $('#forecastBody').innerHTML=result.forecast.map(row=>'<tr><td>'+safeText(monthLabel(row.key))+'</td><td>'+euro.format(row.openingBalance)+'</td><td>'+euro.format(row.actualIncome)+'</td><td>'+euro.format(row.actualExpense)+'</td><td>'+euro.format(row.programmedIncome)+'</td><td>'+euro.format(row.programmedExpense)+'</td><td>'+euro.format(row.estimateIncome)+'</td><td>'+euro.format(row.estimateExpense)+'</td><td class="'+(row.balance>=0?'amount-in':'amount-out')+'">'+euro.format(row.balance)+'</td></tr>').join('');
  }

  function navigate(view) {
    $$('.content-view').forEach(section => section.classList.toggle('active', section.id === `view-${view}`));
    $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));
    const names = { overview: 'Panoramica', transactions: 'Movimenti', search: 'Ricerca avanzata', documents: 'Archivio documenti', budget: 'Budget', forecast: 'Previsioni', reports: 'Report', accounts: 'Piano dei conti', rules: 'Regole apprese', settings: 'Impostazioni' };
    $('#currentSection').textContent = names[view] || 'Panoramica';
    renderAll();
    if (view === 'reports') requestAnimationFrame(drawReportChart);
    if (view === 'documents') void searchDocuments();
  }
  function accountById(id) { return state.accounts.find(a => a.id === id); }
  function accountDisplayLabel(account) {
    if (!account) return 'Da classificare';
    const tags = Array.isArray(account.tags) ? account.tags : [];
    return accountPathAt(account, localDateKey(new Date())) + (tags.length ? ' · [' + tags.join(', ') + ']' : '');
  }
  function accountLabel(id) { return accountDisplayLabel(accountById(id)); }
  function accountReportLabel(account) {
    if (!account) return 'Da classificare';
    const tags = Array.isArray(account.tags) ? account.tags.map(tag => String(tag ?? '').trim()).filter(Boolean) : [];
    return accountPathAt(account, localDateKey(new Date())) + (tags.length ? ' ' + tags.join(' ') : '');
  }
  function accountReportLabelById(id) { return accountReportLabel(accountById(id)); }
  function accountPathAt(account, date) {
    if (!account) return 'Da classificare';
    const key = String(date || localDateKey(new Date()));
    if (account.validFrom && key < account.validFrom) {
      const old = [...(account.nameHistory || [])].reverse().find(item => !item.from || key >= item.from);
      if (old) return old.path;
    }
    const old = (account.nameHistory || []).find(item => item.from && item.to && key >= item.from && key <= item.to);
    return old?.path || account.path;
  }
  function renameAccount(accountId) {
    const account = accountById(accountId); if (!account) return;
    const nextPath = window.prompt('Nuova denominazione completa del conto (percorso con : se necessario):', account.path);
    if (!nextPath?.trim() || nextPath.trim() === account.path) return;
    const effectiveDate = window.prompt('Data di decorrenza (AAAA-MM-GG). I report precedenti manterranno il vecchio nome:', localDateKey(new Date()));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate || '') || Number.isNaN(Date.parse(effectiveDate + 'T12:00:00'))) {
      showNotice('Data non valida','Inserisci la data nel formato AAAA-MM-GG.'); return;
    }
    const oldPrefix = account.path, newPrefix = nextPath.trim();
    const affected = state.accounts.filter(item => item.id === account.id || String(item.path || '').startsWith(oldPrefix + ':'));
    const previousDay = new Date(effectiveDate + 'T12:00:00'); previousDay.setDate(previousDay.getDate() - 1);
    const historyEnd = localDateKey(previousDay);
    for (const item of affected) {
      const oldPath = item.path;
      item.nameHistory = Array.isArray(item.nameHistory) ? item.nameHistory : [];
      item.nameHistory.push({ path: oldPath, from: item.validFrom || '', to: historyEnd });
      item.path = newPrefix + oldPath.slice(oldPrefix.length);
      item.name = item.path.split(':').at(-1);
      item.validFrom = effectiveDate;
    }
    saveState().then(()=>{renderAll();showNotice('Conto rinominato','ID e movimenti sono rimasti invariati. I nomi precedenti sono conservati per la consultazione storica.');});
  }
  async function editAccountTags(accountId) {
    const account = accountById(accountId); if (!account) return;
    const current = Array.isArray(account.tags) ? account.tags : [];
    const answer = window.prompt('Inserisci uno o più tag personalizzati, uno per riga. È ammesso qualsiasi testo. Esempi:\nIBAN: IT00 00000 00000 000000000000\nCONTO CHIUSO\nCONTO PRINCIPALE\nRISPARMI\nSTIPENDIO\nCONTO SECONDARIO\nCARTA PREPAGATA\nCONTO FAMILIARE\nDA NON UTILIZZARE. Lascia vuoto per rimuovere tutti i tag.', current.join('\n'));
    if (answer === null) return;
    const requested = answer.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    const unique = [];
    const seen = new Set();
    for (const tag of requested) {
      const key = tag.toLocaleLowerCase('it-IT');
      if (!seen.has(key)) { seen.add(key); unique.push(tag); }
    }
    account.tags = unique;
    await saveState(); renderAll();
  }
  function renderAccountFilters() {
    const eligible = state.accounts.filter(isLiquidAccount);
    const options = `<option value="all">Tutti i conti liquidi</option>${eligible.map(a => `<option value="${safeText(a.id)}">${safeText(accountDisplayLabel(a))}</option>`).join('')}`;
    for (const selector of ['#accountPicker', '#reportAccountPicker']) {
      const control = $(selector); const prior = state.reportAccountId || state.bankAccountId || eligible[0]?.id || 'all';
      control.innerHTML = options;
      control.value = prior === 'all' || eligible.some(a => a.id === prior) ? prior : eligible[0]?.id || 'all';
    }
  }
  function classifyType(type) {
    const t = String(type || '').toUpperCase();
    if (['INCOME', 'EXPENSE'].includes(t)) return 'Economica';
    if (['BANK', 'CASH', 'ASSET', 'CREDIT', 'LIABILITY', 'STOCK', 'MUTUAL', 'CURRENCY', 'EQUITY', 'RECEIVABLE', 'PAYABLE', 'CREDITLINE'].includes(t)) return 'Patrimoniale';
    if (t === 'TRADING') return 'Tecnica';
    if (t === 'ROOT') return 'Strutturale';
    return 'Da verificare';
  }
  function isLiquidAccount(account) {
    if (!account) return false;
    // CREDIT represents a liability (credit card), not immediately available liquidity.
    if (['BANK', 'CASH'].includes(String(account.type || '').toUpperCase())) return true;
    // Some GnuCash books classify named current-account subaccounts as ASSET.
    // Recognize this common hierarchy so they are not silently omitted.
    const normalizedPath = normalize(account.path || '');
    return String(account.type || '').toUpperCase() === 'ASSET' &&
      (normalizedPath.includes('attivita correnti') ||
       normalizedPath.includes('conto corrente') ||
       normalizedPath.includes('conto deposito') ||
       normalizedPath.includes('banca') ||
       normalizedPath.includes('cassa') ||
       normalizedPath.includes('liquidita') ||
       normalizedPath.includes('disponibilita liquide'));
  }
  function periodTransactions(year, startMonth, endMonth, endDay = 31) {
    const start = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`;
    const end = `${year}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    const accountFilter = state.reportAccountId || state.bankAccountId;
    return state.transactions.filter(tx => tx.date >= start && tx.date <= end && tx.status !== 'duplicate' && (accountFilter === 'all' || !accountFilter || tx.bankAccountId === accountFilter));
  }
  function cashFlowTotals(transactions) {
    let income = 0, expense = 0, transfers = 0;
    for (const tx of transactions) {
      if (tx.amount > 0) income += tx.amount;
      else expense += Math.abs(tx.amount);
      if (Array.isArray(tx.counterpartSplits) && tx.counterpartSplits.length) {
        const transferParts = tx.counterpartSplits.filter(split => accountById(split.accountId)?.classification === 'Patrimoniale');
        transfers += transferParts.reduce((sum, split) => sum + Math.abs(split.value), 0);
      } else if (accountById(tx.counterpartAccountId)?.classification === 'Patrimoniale') transfers += Math.abs(tx.amount);
    }
    return { income, expense, net: income - expense, transfers };
  }
  function monthSelection() { return $('#monthPicker').value || localDateKey(new Date()).slice(0, 7); }
  function monthComparisons(monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    const endDay = new Date(year, month, 0).getDate();
    const dayLimit = year === new Date().getFullYear() && month === new Date().getMonth() + 1 ? Math.min(new Date().getDate(), endDay) : endDay;
    return [0, 1, 2, 3].map(back => {
      const y = year - back;
      const tx = periodTransactions(y, month - 1, month - 1, Math.min(dayLimit, new Date(y, month, 0).getDate()));
      return { year: y, data: cashFlowTotals(tx), tx };
    });
  }
  function yearComparisons(year, cutoffMonth) {
    const isCurrentPartial = year === new Date().getFullYear();
    const monthEnd = isCurrentPartial ? Math.min(cutoffMonth, new Date().getMonth()) : 11;
    const dayEnd = isCurrentPartial && monthEnd === new Date().getMonth() ? new Date().getDate() : new Date(year, monthEnd + 1, 0).getDate();
    return [0, 1, 2, 3].map(back => {
      const y = year - back;
      const tx = periodTransactions(y, 0, monthEnd, Math.min(dayEnd, new Date(y, monthEnd + 1, 0).getDate()));
      return { year: y, data: cashFlowTotals(tx), tx };
    });
  }
  function selectedComparisons() {
    if (reportMode === 'monthly') return monthComparisons(monthSelection());
    const [year] = monthSelection().split('-').map(Number);
    const [, month] = monthSelection().split('-').map(Number);
    if (reportMode === 'annual') return yearComparisons(year, year === new Date().getFullYear() ? new Date().getMonth() : 11);
    const startMonth = reportMode === 'quarterly' ? Math.floor((month - 1) / 3) * 3 : Math.floor((month - 1) / 6) * 6;
    const endMonth = reportMode === 'quarterly' ? startMonth + 2 : startMonth + 5;
    const now = new Date(), currentYear = now.getFullYear(), currentMonth = now.getMonth();
    const periodIncludesToday = year === currentYear && currentMonth >= startMonth && currentMonth <= endMonth;
    const actualEndMonth = periodIncludesToday ? currentMonth : endMonth;
    const actualEndDay = periodIncludesToday ? now.getDate() : new Date(year, endMonth + 1, 0).getDate();
    return [0, 1, 2, 3].map(back => {
      const y = year - back;
      const day = Math.min(actualEndDay, new Date(y, actualEndMonth + 1, 0).getDate());
      const tx = periodTransactions(y, startMonth, actualEndMonth, day);
      return { year: y, data: cashFlowTotals(tx), tx };
    });
  }
  function reportPeriodLabel() {
    const [year, month] = monthSelection().split('-').map(Number);
    if (reportMode === 'monthly') return monthName(monthSelection());
    if (reportMode === 'annual') return `Anno ${year}`;
    const start = reportMode === 'quarterly' ? Math.floor((month - 1) / 3) * 3 : Math.floor((month - 1) / 6) * 6;
    const end = reportMode === 'quarterly' ? start + 2 : start + 5;
    const months = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
    return `${reportMode === 'quarterly' ? 'Trimestre' : 'Semestre'} ${months[start]}–${months[end]} ${year}`;
  }
  function reportFilenameCode() {
    const [year, month] = monthSelection().split('-').map(Number);
    const months = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];
    const comparisons = selectedComparisons();
    const sign = comparisons[0].data.expense > comparisons[0].data.income ? 'NEGATIVO' : 'POSITIVO';
    if (reportMode === 'monthly') return `${month}_${months[month - 1]}${year}_${sign}`;
    if (reportMode === 'annual') return `${year}_${sign}`;
    const span = reportMode === 'quarterly' ? 3 : 6;
    const start = Math.floor((month - 1) / span) * span;
    const end = start + span - 1;
    const prefix = reportMode === 'quarterly' ? `${Math.floor(start / 3) + 1}T` : `${Math.floor(start / 6) + 1}S`;
    return `${prefix}_${months[start]}-${months[end]}${year}_${sign}`;
  }
  function pendingTransactions() { return state.transactions.filter(tx => tx.status === 'pending'); }
  function currentAccountBalance(monthKey) {
    const accountFilter = state.reportAccountId || state.bankAccountId || 'all';
    const today = localDateKey(new Date());
    const [year, month] = monthKey.split('-').map(Number);
    const monthEnd = localDateKey(new Date(year, month, 0));
    const cutoff = monthEnd > today ? today : monthEnd;
    const transactions = state.transactions.filter(tx => tx.date <= cutoff && tx.status !== 'duplicate' && (accountFilter === 'all' || tx.bankAccountId === accountFilter));
    const openingBase = accountFilter === 'all' || accountFilter === state.bankAccountId ? Number(state.openingBalance || 0) : 0;
    return { balance: openingBase + transactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0), transactions, cutoff, monthKey };
  }

  function renderAll() {
    if (!state) return;
    try {
      renderAccountFilters();
      renderOverview(); renderTransactions(); renderReports(); setupFinanceViews(); renderAccounts(); renderRules(); renderSettings();
      const pendingCount = pendingTransactions().length;
      $('#pendingNavCount').textContent = String(pendingCount);
      $('#pendingNavCount').classList.toggle('hidden', pendingCount === 0);
      $('#pendingNavCount').title = `${pendingCount} movimenti da classificare`;
      $('#demoBanner').classList.toggle('hidden', !state.demo);
      updatePeriodNavigation();
      requestAnimationFrame(() => { drawFlowChart(); drawReportChart(); });
    } catch (error) {
      console.error('Aggiornamento schermate non riuscito', error);
      const message = error?.message || String(error) || 'Errore inatteso';
      if ($('#view-reports')?.classList.contains('active')) {
        $('#reportComparisonNote').textContent = `Errore nell’aggiornamento del report: ${message}`;
        showNotice('Report non aggiornato', message);
      } else showNotice('Schermata non aggiornata', message);
    }
  }
  function renderOverview() {
    const comparisons = monthComparisons(monthSelection());
    const current = comparisons[0].data;
    $('#incomeMetric').textContent = euro.format(current.income);
    $('#expenseMetric').textContent = euro.format(current.expense);
    $('#netMetric').textContent = euro.format(current.net);
    $('#netMetric').className = current.net >= 0 ? 'amount-in' : 'amount-out';
    const balance = currentAccountBalance(monthSelection());
    $('#balanceMetric').textContent = euro.format(balance.balance);
    $('#balanceMetric').className = balance.balance >= 0 ? 'amount-in' : 'amount-out';
    const latestBalanceDate = balance.transactions.map(tx => parseDate(tx.date)).filter(Boolean).sort().at(-1);
    $('#balanceFootnote').textContent = `periodo ${monthName(balance.monthKey)} · saldo al ${formatDate(balance.cutoff)}${latestBalanceDate ? ` · ultimo movimento ${formatDate(latestBalanceDate)}` : ' · nessun movimento importato'}`;
    $('#pendingMetric').textContent = String(pendingTransactions().length);
    $('#pendingHint').textContent = pendingTransactions().length ? 'conferma per insegnare una regola' : 'tutti i movimenti sono classificati';
    $('#incomeCompare').textContent = `vs ${comparisons[1].year}: ${signedPercent(current.income, comparisons[1].data.income)}`;
    $('#expenseCompare').textContent = `vs ${comparisons[1].year}: ${signedPercent(current.expense, comparisons[1].data.expense)}`;
    $('#mainChartTitle').textContent = `Flussi di ${monthName(monthSelection())}`;
    $('#mainChartSubtitle').textContent = 'Entrate e uscite economiche rispetto allo stesso mese dei tre anni precedenti';
    $('#categoryPeriodLabel').textContent = monthName(monthSelection());
    renderComparisonTable('#comparisonBody', comparisons);
    renderCategoryBars(comparisons[0].tx);
    renderPendingPreview();
  }
  function signedPercent(current, previous) {
    if (!previous) return current ? 'nuovo dato' : 'nessun dato precedente';
    const value = ((current - previous) / previous) * 100;
    return `${value > 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}%`;
  }
  function renderComparisonTable(selector, comparisons) {
    const body = $(selector);
    body.innerHTML = comparisons.map((item, i) => `<tr class="${i === 0 ? 'current-year' : ''}"><td>${item.year}${i === 0 ? ' · periodo scelto' : ''}</td><td>${reportShortEuro(item.data.income)}</td><td>${reportShortEuro(item.data.expense)}</td><td class="${item.data.net >= 0 ? 'amount-in' : 'amount-out'}">${reportShortEuro(item.data.net)}</td></tr>`).join('');
  }
  function renderCategoryBars(transactions) {
    const totals = new Map();
    for (const tx of transactions) {
      const account = accountById(tx.counterpartAccountId);
      if (account?.type !== 'EXPENSE') continue;
      const label = account.name;
      totals.set(label, (totals.get(label) || 0) + Math.abs(tx.amount));
    }
    const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = Math.max(1, ...rows.map(r => r[1]));
    $('#categoryBars').innerHTML = rows.length ? rows.map(([label, amount]) => `<div class="category-row"><span class="category-label">${safeText(label)}</span><div class="category-track"><div class="category-fill" style="width:${Math.max(2, amount / max * 100)}%"></div></div><span class="category-amount">${shortEuro.format(amount)}</span></div>`).join('') : '<div class="empty-inline">Nessuna uscita economica nel periodo.</div>';
  }
  function renderPendingPreview() {
    const pending = pendingTransactions().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
    $('#pendingBadge').textContent = `${pendingTransactions().length} da rivedere`;
    $('#pendingPreview').innerHTML = pending.length ? pending.map(tx => `<div class="pending-item"><div><div class="pending-name">${safeText(transactionDescription(tx) || transactionCausale(tx) || 'Movimento importato')}</div><div class="pending-date">${formatDate(tx.date)}</div></div><div class="pending-amount ${tx.amount >= 0 ? 'amount-in' : 'amount-out'}">${euro.format(tx.amount)}</div><div class="pending-suggest">Suggerimento: ${safeText(tx.suggestionLabel || 'da classificare')}</div></div>`).join('') : '<div class="empty-inline">Ottimo: non ci sono movimenti in attesa.</div>';
  }
  function drawFlowChart() {
    const comps = monthComparisons(monthSelection());
    drawBarChart($('#flowChart'), comps.map(c => ({ label: String(c.year), income: c.data.income, expense: c.data.expense })), $('#flowLegend'));
  }
  function drawReportChart() {
    if (reportMode !== 'annual') {
      const comparisons = selectedComparisons();
      drawBarChart($('#reportChart'), comparisons.map(c => ({ label: String(c.year), income: c.data.income, expense: c.data.expense })), $('#reportLegend'));
      $('#reportChartTitle').textContent = `${reportPeriodLabel()} · confronto con i tre anni precedenti`;
      return;
    }
    const [year, selectedMonth] = monthSelection().split('-').map(Number);
    const startMonth = 0;
    let cutoffMonth = year === new Date().getFullYear() ? Math.min(selectedMonth - 1, new Date().getMonth()) : 11;
    const monthLabels = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const rows = monthLabels.slice(startMonth, cutoffMonth + 1).map((label, offset) => {
      const month = startMonth + offset;
      const tx = periodTransactions(year, month, month, new Date(year, month + 1, 0).getDate());
      const totals = cashFlowTotals(tx);
      return { label, income: totals.income, expense: totals.expense };
    });
    drawBarChart($('#reportChart'), rows, $('#reportLegend'));
    $('#reportChartTitle').textContent = reportMode === 'annual' ? `Entrate e uscite mese per mese · ${year}` : `${reportPeriodLabel()} · flussi mensili`;
  }
  function canvasContext(canvas) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width: rect.width, height: rect.height };
  }
  const chartColors = ['#287d73', '#d67864', '#6688bb', '#c29645'];
  const flowColors = { income: '#21836e', expense: '#bf6456' };
  function drawBarChart(canvas, rows, legend) {
    const info = canvasContext(canvas); if (!info) return;
    const { ctx, width: w, height: h } = info;
    ctx.clearRect(0, 0, w, h);
    const left = 42, right = 12, top = 15, bottom = 28;
    const chartW = w - left - right, chartH = h - top - bottom;
    const max = Math.max(1, ...rows.flatMap(r => [r.income, r.expense]));
    const step = max / 4;
    ctx.font = '10px Segoe UI, Arial'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const y = top + chartH - (i / 4) * chartH;
      ctx.strokeStyle = '#edf1f0'; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(w - right, y); ctx.stroke();
      ctx.fillStyle = '#9aa6a3'; ctx.fillText(shortEuro.format(step * i), left - 7, y);
    }
    const groupW = chartW / Math.max(1, rows.length);
    const barW = Math.min(21, groupW * .27);
    rows.forEach((r, i) => {
      const cx = left + i * groupW + groupW / 2;
      const ih = r.income / max * chartH, eh = r.expense / max * chartH;
      ctx.fillStyle = flowColors.income; ctx.beginPath(); roundRect(ctx, cx - barW - 2, top + chartH - ih, barW, ih, 4); ctx.fill();
      ctx.fillStyle = flowColors.expense; ctx.beginPath(); roundRect(ctx, cx + 2, top + chartH - eh, barW, eh, 4); ctx.fill();
      ctx.fillStyle = '#7f8e8a'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(r.label, cx, h - 18);
    });
    if (!rows.some(row => row.income > 0 || row.expense > 0)) {
      ctx.fillStyle = '#879591'; ctx.font = '11px Segoe UI, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Nessun flusso nel periodo selezionato', left + chartW / 2, top + chartH / 2);
    }
    legend.innerHTML = `<span class="legend-item"><i class="legend-swatch" style="background:${flowColors.income}"></i>Entrate</span><span class="legend-item"><i class="legend-swatch" style="background:${flowColors.expense}"></i>Uscite</span>`;
  }
  function drawLineChart(canvas, series, legend) {
    const info = canvasContext(canvas); if (!info) return;
    const { ctx, width: w, height: h } = info; ctx.clearRect(0, 0, w, h);
    const left = 49, right = 12, top = 17, bottom = 31;
    const chartW = w - left - right, chartH = h - top - bottom;
    const vals = series.flatMap(s => s.values.filter(v => v !== null && Number.isFinite(v)));
    let min = Math.min(0, ...vals), max = Math.max(0, ...vals); if (min === max) max = min + 1;
    const span = max - min;
    ctx.font = '10px Segoe UI, Arial'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const val = min + span * i / 4, y = top + chartH - chartH * i / 4;
      ctx.strokeStyle = '#edf1f0'; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(w - right, y); ctx.stroke();
      ctx.fillStyle = '#9aa6a3'; ctx.fillText(shortEuro.format(val), left - 7, y);
    }
    const monthLabels = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    monthLabels.forEach((label, i) => {
      const x = left + chartW * (i / 11);
      ctx.fillStyle = '#899793'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(label, x, h - 19);
    });
    series.forEach((s, index) => {
      ctx.strokeStyle = chartColors[index]; ctx.fillStyle = chartColors[index]; ctx.lineWidth = index === 0 ? 2.5 : 1.7;
      ctx.setLineDash(index === 0 ? [] : [4, 4]);
      ctx.beginPath(); let started = false;
      s.values.forEach((v, i) => {
        if (v === null || !Number.isFinite(v)) { started = false; return; }
        const x = left + chartW * (i / 11), y = top + chartH - ((v - min) / span) * chartH;
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      });
      ctx.stroke(); ctx.setLineDash([]);
      s.values.forEach((v, i) => { if (v === null || !Number.isFinite(v)) return; const x = left + chartW * (i / 11), y = top + chartH - ((v - min) / span) * chartH; ctx.beginPath(); ctx.arc(x, y, index === 0 ? 3 : 2.3, 0, Math.PI * 2); ctx.fill(); });
    });
    legend.innerHTML = series.map((s, i) => `<span class="legend-item"><i class="legend-swatch" style="background:${chartColors[i]}"></i>${s.year}${i === 0 ? ' · selezionato' : ''}</span>`).join('');
  }
  function roundRect(ctx, x, y, width, height, radius) {
    if (height <= 0) return;
    const r = Math.min(radius, width / 2, height / 2);
    ctx.moveTo(x + r, y); ctx.arcTo(x + width, y, x + width, y + height, r); ctx.arcTo(x + width, y + height, x, y + height, r); ctx.arcTo(x, y + height, x, y, r); ctx.arcTo(x, y, x + width, y, r); ctx.closePath();
  }

  function isBulkEditableTransaction(item) {
    return !(Array.isArray(item.counterpartSplits) && item.counterpartSplits.length > 1);
  }
  function filteredTransactions() {
    const filter = $('#transactionFilter')?.value || 'all';
    const dateFrom = $('#transactionDateFrom')?.value || '';
    const dateTo = $('#transactionDateTo')?.value || '';
    const counterpartFilter = $('#transactionCounterpartFilter')?.value || 'all';
    let tx = [...state.transactions].sort((a, b) => parseDate(b.date).localeCompare(parseDate(a.date)));
    if (filter === 'pending') tx = tx.filter(t => t.status === 'pending');
    if (filter === 'confirmed') tx = tx.filter(t => t.status === 'confirmed');
    if (dateFrom) tx = tx.filter(t => parseDate(t.date) >= dateFrom);
    if (dateTo) tx = tx.filter(t => parseDate(t.date) <= dateTo);
    if (counterpartFilter !== 'all') {
      tx = tx.filter(item => {
        const ids = [item.counterpartAccountId, item.suggestionId, ...(item.counterpartSplits || []).map(split => split.accountId)].filter(Boolean);
        return ids.includes(counterpartFilter);
      });
    }
    return tx;
  }
  function populateTransactionCounterpartControls() {
    const accounts = state.accounts.filter(a => !['ROOT', 'TRADING'].includes(a.type))
      .sort((a, b) => a.path.localeCompare(b.path, 'it', { sensitivity: 'base' }));
    const filter = $('#transactionCounterpartFilter');
    if (filter) {
      const selected = filter.value || 'all';
      filter.innerHTML = '<option value="all">Tutte le contropartite</option>' +
        accounts.map(a => `<option value="${safeText(a.id)}">${safeText(accountDisplayLabel(a))}</option>`).join('');
      filter.value = accounts.some(a => a.id === selected) ? selected : 'all';
    }
    const bulk = $('#transactionBulkCounterpart');
    if (bulk) {
      const selected = bulk.value || '';
      bulk.innerHTML = '<option value="">Scegli nuova contropartita…</option>' +
        accounts.map(a => `<option value="${safeText(a.id)}">${safeText(accountDisplayLabel(a))}</option>`).join('');
      bulk.value = accounts.some(a => a.id === selected) ? selected : '';
    }
  }
  function updateTransactionBulkUi(filtered = filteredTransactions()) {
    const validIds = new Set(state.transactions.filter(isBulkEditableTransaction).map(item => item.id));
    transactionSelection = new Set([...transactionSelection].filter(id => validIds.has(id)));
    const eligible = filtered.filter(isBulkEditableTransaction);
    const count = $('#transactionSelectionCount');
    if (count) count.textContent = `${transactionSelection.size} selezionati`;
    const selectAll = $('#transactionSelectAll');
    if (selectAll) selectAll.disabled = eligible.length === 0;
    const deselect = $('#transactionDeselectAll');
    if (deselect) deselect.disabled = transactionSelection.size === 0;
    const apply = $('#applyBulkCounterpart');
    if (apply) apply.disabled = transactionSelection.size === 0 || !$('#transactionBulkCounterpart')?.value;
    const toolbar = $('#transactionBulkToolbar');
    if (toolbar) toolbar.classList.toggle('hidden', eligible.length === 0 && transactionSelection.size === 0);
  }
  function selectAllFilteredTransactions() {
    filteredTransactions().filter(isBulkEditableTransaction).forEach(item => transactionSelection.add(item.id));
    renderTransactions();
  }
  function clearTransactionSelection() {
    transactionSelection.clear();
    renderTransactions();
  }
  function applyBulkCounterpartChange() {
    const accountId = $('#transactionBulkCounterpart')?.value || '';
    const account = accountById(accountId);
    const selected = [...transactionSelection]
      .map(id => state.transactions.find(item => item.id === id))
      .filter(item => item && isBulkEditableTransaction(item));
    if (!selected.length) {
      showNotice('Nessun movimento selezionato', 'Seleziona almeno un movimento modificabile nell’elenco.');
      return;
    }
    if (!account) {
      showNotice('Scegli la nuova contropartita', 'Seleziona il conto da assegnare ai movimenti selezionati.');
      return;
    }
    const conflicts = selected.filter(item => item.bankAccountId === accountId);
    if (conflicts.length) {
      showNotice('Contropartita non valida', 'La nuova contropartita coincide con il conto corrente di ' + conflicts.length + ' movimento/i selezionato/i. Scegli un altro conto.');
      return;
    }
    showConfirm(
      'Confermare la modifica massiva?',
      `La contropartita "${account.path}" verrà assegnata esclusivamente a ${selected.length} movimenti selezionati. Data, importo, descrizione, causale e conto corrente resteranno invariati.`,
      async () => {
        const previousValues = selected.map(item => ({
          item,
          counterpartAccountId: item.counterpartAccountId,
          counterpartSplits: Array.isArray(item.counterpartSplits) ? JSON.parse(JSON.stringify(item.counterpartSplits)) : item.counterpartSplits,
          suggestionId: item.suggestionId,
          suggestionLabel: item.suggestionLabel,
          status: item.status,
          confidence: item.confidence
        }));
        selected.forEach(item => {
          item.counterpartAccountId = accountId;
          item.counterpartSplits = [{ accountId, value: -Number(item.amount || 0), memo: item.memo || '' }];
          item.suggestionId = accountId;
          item.suggestionLabel = account.path;
          item.status = 'confirmed';
          item.confidence = 1;
        });
        const saved = await saveState();
        if (!saved) {
          previousValues.forEach(previous => {
            previous.item.counterpartAccountId = previous.counterpartAccountId;
            previous.item.counterpartSplits = previous.counterpartSplits;
            previous.item.suggestionId = previous.suggestionId;
            previous.item.suggestionLabel = previous.suggestionLabel;
            previous.item.status = previous.status;
            previous.item.confidence = previous.confidence;
          });
          throw new Error('Il salvataggio non è riuscito. Le modifiche sono state annullate in memoria; verifica la connessione prima di riprovare.');
        }
        transactionSelection.clear();
        renderAll();
        showNotice('Contropartita aggiornata', `Modificata la contropartita di ${selected.length} movimenti. Gli altri dati sono rimasti invariati.`);
      }
    );
  }
  async function refreshAttachmentCounts() {
    try {
      const result = await apiRequest('/api/attachments/counts');
      attachmentCounts = result.counts || {};
      const body = $('#transactionsBody');
      if (!body) return;
      body.querySelectorAll('[data-attachments-tx]').forEach(button => {
        const count = Number(attachmentCounts[button.dataset.attachmentsTx] || 0);
        let badge = button.parentElement.querySelector('.attachment-count-badge');
        if (!badge) { badge = document.createElement('span'); badge.className = 'attachment-count-badge'; button.parentElement.appendChild(badge); }
        badge.textContent = String(count);
        badge.classList.toggle('hidden', count === 0);
        badge.setAttribute('aria-label', count + ' allegati');
      });
    } catch (error) { /* Il registro resta utilizzabile anche se il conteggio non è disponibile. */ }
  }
  function renderTransactions() {
    refreshAccountSearchOptions();
    populateTransactionCounterpartControls();
    const tx = filteredTransactions();
    const body = $('#transactionsBody'); if (!body) return;
    $('#emptyTransactions').classList.toggle('hidden', tx.length > 0);
    const pageSize = 100;
    const pageCount = Math.max(1, Math.ceil(tx.length / pageSize));
    transactionPage = Math.min(transactionPage, pageCount - 1);
    const pageItems = tx.slice(transactionPage * pageSize, (transactionPage + 1) * pageSize);
    const dates = tx.map(item => parseDate(item.date)).filter(Boolean).sort();
    $('#transactionPageStatus').textContent = tx.length ? `Movimenti ${transactionPage * pageSize + 1}–${Math.min((transactionPage + 1) * pageSize, tx.length)} di ${tx.length} · dal ${formatDate(dates[0])} al ${formatDate(dates.at(-1))} · più recenti prima` : 'Nessun movimento';
    $('#transactionPrev').disabled = transactionPage === 0;
    $('#transactionNext').disabled = transactionPage >= pageCount - 1;
    body.innerHTML = pageItems.map(item => {
      const suggested = item.counterpartAccountId || item.suggestionId || '';
      const description = transactionDescription(item);
      const causale = transactionCausale(item);
      const primaryText = description || causale || 'Movimento importato';
      const primaryLabel = description ? 'Descrizione: ' : causale ? 'Causale: ' : '';
      const secondaryLabel = item.source === 'qif' ? 'Dettagli:' : 'Causale:';
      const causaleRow = description && causale ? `<span class="name-secondary transaction-causale"><strong>${secondaryLabel}</strong> ${safeText(causale)}</span>` : '';
      const isSplit = Array.isArray(item.counterpartSplits) && item.counterpartSplits.length > 1;
      const selectionCell = `<input type="checkbox" data-select-tx="${safeText(item.id)}" aria-label="Seleziona movimento ${safeText(primaryText)}" ${isSplit ? 'disabled title="Movimento ripartito: modifica le contropartite singolarmente"' : ''} ${transactionSelection.has(item.id) ? 'checked' : ''}>`;
      const accountCell = isSplit
        ? '<span class="account-type">Ripartito</span>'
        : item.status === 'confirmed'
          ? `<span class="name-secondary">${safeText(accountPathAt(accountById(item.counterpartAccountId), item.date))}</span>`
          : `<input class="account-select account-search" type="text" list="accountSearchOptions" data-tx="${safeText(item.id)}" value="${suggested ? safeText(accountLabel(suggested)) : ''}" placeholder="Cerca conto…" autocomplete="off" aria-label="Cerca conto di contropartita">`;
      const conf = item.status === 'confirmed' ? 1 : (item.confidence || 0.1);
      const confidenceClass = conf >= .8 ? 'high' : conf >= .5 ? 'medium' : 'low';
      const confidenceLabel = item.status === 'confirmed' ? 'Confermata' : conf >= .8 ? 'Alta' : conf >= .5 ? 'Media' : 'Bassa';
      const actions = isSplit
        ? `<button class="row-action row-action-split" data-split-tx="${safeText(item.id)}">Modifica riparto</button>`
        : item.status === 'confirmed'
          ? `<button class="row-action row-action-review" data-edit-tx="${safeText(item.id)}">Rivedi</button> <button class="row-action row-action-split" data-split-tx="${safeText(item.id)}">Ripartisci</button>`
          : `<button class="row-action row-action-split" data-split-tx="${safeText(item.id)}">Dividi</button> <button class="row-action row-action-review" data-confirm-tx="${safeText(item.id)}">Conferma</button>`;
      const attachmentCount = Number(attachmentCounts[item.id] || 0);
      return `<tr><td class="tx-select-cell">${selectionCell}</td><td class="date-cell">${formatDate(item.date)}</td><td class="name-cell"><span class="name-primary"><strong>${primaryLabel}</strong>${safeText(primaryText)}</span>${causaleRow}</td><td class="amount-cell ${item.amount >= 0 ? 'amount-in' : 'amount-out'}">${euro.format(item.amount)}</td><td><span class="name-secondary">${safeText(accountPathAt(accountById(item.bankAccountId), item.date))}</span></td><td>${accountCell}</td><td><span class="confidence ${confidenceClass}">${confidenceLabel}</span></td><td><span class="status-chip ${item.counterpartSplits?.length > 1 ? 'status-confirmed' : item.status === 'confirmed' ? 'status-confirmed' : 'status-pending'}">${item.counterpartSplits?.length > 1 ? 'Suddiviso' : item.status === 'confirmed' ? 'Confermato' : 'Da rivedere'}</span></td><td class="transaction-actions">${actions} <span class="attachment-action-wrap"><button class="row-action" data-attachments-tx="${safeText(item.id)}">Allegati</button><span class="attachment-count-badge ${attachmentCount ? '' : 'hidden'}" aria-label="${attachmentCount} allegati">${attachmentCount}</span></span> <button class="row-action" data-history-tx="${safeText(item.id)}">Storico</button> <button class="row-action row-action-danger" data-delete-tx="${safeText(item.id)}">Elimina</button></td></tr>`;
    }).join('');
    $$('[data-select-tx]', body).forEach(input => input.addEventListener('change', () => {
      if (input.checked) transactionSelection.add(input.dataset.selectTx);
      else transactionSelection.delete(input.dataset.selectTx);
      updateTransactionBulkUi(tx);
    }));
    $$('[data-confirm-tx]', body).forEach(btn => btn.addEventListener('click', () => confirmTransaction(btn.dataset.confirmTx)));
    $$('[data-split-tx]', body).forEach(btn => btn.addEventListener('click', () => openSplitEditor(btn.dataset.splitTx)));
    $$('[data-edit-tx]', body).forEach(btn => btn.addEventListener('click', async () => {
      const item = state.transactions.find(t => t.id === btn.dataset.editTx); if (!item) return;
      item.suggestionId = item.counterpartAccountId; item.counterpartAccountId = null; item.status = 'pending';
      await saveState(); renderTransactions(); renderPendingPreview();
    }));
    $$('[data-delete-tx]', body).forEach(btn => btn.addEventListener('click', async () => {
      const item = state.transactions.find(t => t.id === btn.dataset.deleteTx); if (!item) return;
      const label = item.payee || item.memo || 'movimento senza descrizione';
      if (!window.confirm(`Eliminare il movimento “${label}” del ${formatDate(item.date)} (${euro.format(item.amount)}) dall’archivio di Gestione C/C?`)) return;
      state.transactions = state.transactions.filter(t => t.id !== item.id);
      transactionSelection.delete(item.id);
      transactionPage = Math.min(transactionPage, Math.max(0, Math.ceil(state.transactions.length / pageSize) - 1));
      await saveState(); renderAll();
      showNotice('Movimento eliminato', 'È stato rimosso dall’archivio locale di Gestione C/C. Il file GnuCash o bancario originale non è stato modificato.');
    }));
    Array.from(body.querySelectorAll('[data-attachments-tx]')).forEach(btn => btn.addEventListener('click', () => manageTransactionAttachments(btn.dataset.attachmentsTx)));
    void refreshAttachmentCounts();
    $$('[data-history-tx]', body).forEach(btn => btn.addEventListener('click', () => showTransactionHistory(btn.dataset.historyTx)));
    updateTransactionBulkUi(tx);
  }
  let activeAttachmentTransactionId = null;
  async function manageTransactionAttachments(id) {
    const tx=state.transactions.find(item=>item.id===id);if(!tx)return;
    activeAttachmentTransactionId=id;
    $('#attachmentsTransactionLabel').textContent=(tx.payee||tx.memo||'Movimento')+' · '+formatDate(tx.date);
    $('#attachmentsModal').classList.remove('hidden');
    try{await refreshTransactionAttachments();}catch(error){showNotice('Allegati non disponibili',error.message||String(error));}
  }
  async function refreshTransactionAttachments() {
    if(!activeAttachmentTransactionId)return;
    const result=await apiRequest('/api/attachments?transaction_id='+encodeURIComponent(activeAttachmentTransactionId));
    const files=result.items||[];
    const total=files.reduce((sum,file)=>sum+Number(file.size||0),0);
    $('#attachmentLimitHint').textContent='Spazio usato: '+(total/1024/1024).toFixed(2)+' MB su 15 MB · massimo 5 MB per file.';
    $('#attachmentList').innerHTML=files.length?files.map(file=>'<div class="attachment-row"><div class="attachment-file-info"><strong>'+safeText(file.filename)+'</strong><small>'+Math.max(1,Math.round(file.size/1024))+' KB · '+safeText(formatDate(String(file.created_at||'').slice(0,10)))+'</small></div><div class="attachment-row-actions"><button class="row-action" type="button" data-download-attachment="'+safeText(file.id)+'">Scarica</button><button class="row-action row-action-danger" type="button" data-delete-attachment="'+safeText(file.id)+'">Elimina</button></div></div>').join(''):'<p class="empty-state">Nessun allegato associato a questo movimento.</p>';
    $('#attachmentList').querySelectorAll('[data-download-attachment]').forEach(button=>button.addEventListener('click',async()=>{const file=files.find(item=>item.id===button.dataset.downloadAttachment);if(!file)return;const response=await fetch('/api/attachments/download?id='+encodeURIComponent(file.id),{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('Download non riuscito.');downloadBlob(await response.blob(),file.filename);}));
    $('#attachmentList').querySelectorAll('[data-delete-attachment]').forEach(button=>button.addEventListener('click',async()=>{const file=files.find(item=>item.id===button.dataset.deleteAttachment);if(!file||!window.confirm('Eliminare definitivamente "'+file.filename+'"?'))return;try{await apiRequest('/api/attachments/delete',{method:'POST',body:JSON.stringify({id:file.id})});await refreshTransactionAttachments();void refreshAttachmentCounts();}catch(error){showNotice('Eliminazione non riuscita',error.message||String(error));}}));
  }
  async function uploadTransactionAttachment(file) {
    if(!file||!activeAttachmentTransactionId)return;
    if(file.size>5*1024*1024){showNotice('File troppo grande','Il singolo allegato non può superare 5 MB.');return;}
    const form=new FormData();form.append('transaction_id',activeAttachmentTransactionId);form.append('file',file);
    try{
      const response=await fetch('/api/attachments/upload',{method:'POST',body:form,headers:{'X-CSRF-Token':csrfToken},credentials:'same-origin',cache:'no-store'});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Caricamento non riuscito.');
      await refreshTransactionAttachments();
      void refreshAttachmentCounts();
      if(data.storage_warning)showNotice('Archivio documenti oltre 100 MB','È stato raggiunto il livello di avviso. Puoi continuare a caricare documenti.');
    }catch(error){showNotice('Caricamento non riuscito',error.message||String(error));}
  }
  async function searchDocuments(resetPage = false) {
    if(resetPage)documentSearchOffset=0;
    const term=$('#documentSearchText').value.trim(),category=$('#documentSearchCategory').value;
    const params=new URLSearchParams();if(term)params.set('q',term);if(category)params.set('category',category);params.set('offset',String(documentSearchOffset));
    try{
      const result=await apiRequest('/api/documents/search?'+params.toString());
      const items=result.items||[];
      $('#documentResultCount').textContent=Number(result.total_count||0)+' documenti trovati';
      $('#documentPageStatus').textContent=items.length?'Documenti '+(documentSearchOffset+1)+'–'+(documentSearchOffset+items.length)+' di '+Number(result.total_count||0):'Nessun documento';
      $('#documentPrev').disabled=documentSearchOffset<=0;
      $('#documentNext').disabled=documentSearchOffset+items.length>=Number(result.total_count||0);
      $('#documentStorageTotal').textContent=(Number(result.total_bytes||0)/1024/1024).toFixed(2)+' MB complessivi';
      $('#documentStorageWarning').classList.toggle('hidden',!result.warning);
      $('#documentsBody').innerHTML=items.length?items.map(item=>'<tr><td class="name-cell"><strong>'+safeText(item.filename)+'</strong><small class="document-excerpt">'+safeText(item.excerpt||'Testo non ancora disponibile')+'</small></td><td><select class="document-category-select" data-document-category="'+safeText(item.id)+'"><option value="fattura" '+(item.category==='fattura'?'selected':'')+'>Fattura</option><option value="f24" '+(item.category==='f24'?'selected':'')+'>F24</option><option value="bollettino" '+(item.category==='bollettino'?'selected':'')+'>Bollettino</option><option value="altro" '+(item.category==='altro'?'selected':'')+'>Altro</option></select></td><td>'+safeText(item.supplier||'—')+'</td><td>'+safeText(item.amount||'—')+'</td><td>'+safeText(item.document_date||'—')+'</td><td>'+safeText(item.document_number||'—')+'</td><td>'+safeText(({queued:'In attesa',done:'Completato',failed:'Errore'})[item.ocr_status]||'In attesa')+'</td><td><button class="row-action" type="button" data-doc-open="'+safeText(item.id)+'">Apri</button> <button class="row-action" type="button" data-doc-edit="'+safeText(item.id)+'">Modifica</button> <button class="row-action" type="button" data-doc-download="'+safeText(item.id)+'">Scarica</button> <button class="row-action" type="button" data-doc-transaction="'+safeText(item.transaction_id)+'">Movimento</button></td></tr>').join(''):'<tr><td colspan="8" class="empty-state">Nessun documento trovato.</td></tr>';
      $('#documentsBody').querySelectorAll('[data-doc-edit]').forEach(button=>button.addEventListener('click',()=>{
        const item=items.find(x=>x.id===button.dataset.docEdit);if(!item)return;
        editingDocumentId=item.id;
        $('#editDocumentSupplier').value=item.supplier||'';
        $('#editDocumentAmount').value=item.amount||'';
        const rawDate=String(item.document_date||'');
        const dmy=rawDate.match(/^(\\d{1,2})[./-](\\d{1,2})[./-](\\d{2,4})$/);
        $('#editDocumentDate').value=dmy?(String(dmy[3].length===2?(Number(dmy[3])<70?'20':'19')+dmy[3]:dmy[3])+'-'+String(dmy[2]).padStart(2,'0')+'-'+String(dmy[1]).padStart(2,'0')):parseDate(rawDate);
        $('#editDocumentNumber').value=item.document_number||'';
        $('#documentMetadataModal').classList.remove('hidden');
        $('#editDocumentSupplier').focus();
      }));
      $('#documentsBody').querySelectorAll('[data-doc-download]').forEach(button=>button.addEventListener('click',async()=>{const item=items.find(x=>x.id===button.dataset.docDownload);if(!item)return;const response=await fetch('/api/attachments/download?id='+encodeURIComponent(item.id),{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('Download non riuscito.');downloadBlob(await response.blob(),item.filename);}));
      $('#documentsBody').querySelectorAll('[data-doc-open]').forEach(button=>button.addEventListener('click',()=>{const item=items.find(x=>x.id===button.dataset.docOpen);if(!item)return;const preview=window.open('/api/attachments/download?id='+encodeURIComponent(item.id)+'&inline=1','_blank');if(preview)preview.opener=null;else showNotice('Anteprima bloccata','Consenti le finestre a comparsa per aprire il documento.');}));
      $('#documentsBody').querySelectorAll('[data-document-category]').forEach(select=>select.addEventListener('change',async()=>{try{await apiRequest('/api/documents/update',{method:'POST',body:JSON.stringify({id:select.dataset.documentCategory,category:select.value})});}catch(error){showNotice('Categoria non aggiornata',error.message||String(error));}}));
      $('#documentsBody').querySelectorAll('[data-doc-transaction]').forEach(button=>button.addEventListener('click',()=>{
        const txId=button.dataset.docTransaction;
        $('#transactionFilter').value='all';
        $('#transactionDateFrom').value='';
        $('#transactionDateTo').value='';
        $('#transactionCounterpartFilter').value='all';
        const ordered=filteredTransactions();
        const index=ordered.findIndex(tx=>tx.id===txId);
        if(index<0){showNotice('Movimento non disponibile','Il documento è conservato nell’Archivio documenti, ma il movimento originale non è più presente nel registro.');return;}
        transactionPage=Math.floor(index/100);
        navigate('transactions');
        const target=$('[data-attachments-tx="'+CSS.escape(txId)+'"]');
        target?.closest('tr')?.scrollIntoView({behavior:'smooth',block:'center'});
        target?.closest('tr')?.classList.add('document-row-highlight');
      }));
    }catch(error){$('#documentResultCount').textContent='Archivio non disponibile';showNotice('Ricerca documenti non riuscita',error.message||String(error));}
  }
  async function showTransactionHistory(id) {
    try{const result=await apiRequest('/api/transactions/audit?transaction_id='+encodeURIComponent(id));const items=result.items||[];
      const summary=items.map(entry=>{const changes=Object.entries(entry.changes||{}).map(([field,value])=>field+': '+JSON.stringify(value.old)+' → '+JSON.stringify(value.new)).join('\n');return new Date(entry.at).toLocaleString('it-IT')+' · '+entry.event+'\n'+changes;}).join('\n\n');
      window.alert(items.length?summary:'Nessuna modifica storica registrata per questo movimento.');
    }catch(error){showNotice('Storico non disponibile',error.message||String(error));}
  }
  function refreshAccountSearchOptions() {
    const list = $('#accountSearchOptions'); if (!list || !state) return;
    const accounts = state.accounts.filter(a => !['ROOT', 'TRADING'].includes(a.type)).sort((a, b) => a.path.localeCompare(b.path, 'it', { sensitivity: 'base' }));
    list.innerHTML = accounts.map(a => `<option value="${safeText(accountDisplayLabel(a))}"></option>`).join('');
  }
  function openManualTransaction() {
    const banks = state.accounts.filter(isLiquidAccount).sort((a, b) => a.path.localeCompare(b.path, 'it'));
    $('#manualBankAccount').innerHTML = banks.map(a => `<option value="${safeText(a.id)}">${safeText(accountDisplayLabel(a))}</option>`).join('');
    const selected = state.reportAccountId && banks.some(a => a.id === state.reportAccountId) ? state.reportAccountId : state.bankAccountId;
    if (selected && banks.some(a => a.id === selected)) $('#manualBankAccount').value = selected;
    $('#manualDate').value = localDateKey(new Date());
    $('#manualPayee').value = ''; $('#manualAmount').value = '';
    populateManualCounterAccounts();
    $('#manualTransactionModal').classList.remove('hidden');
    $('#manualPayee').focus();
  }
  function populateManualCounterAccounts() {
    refreshAccountSearchOptions();
  }
  function closeManualTransaction() { $('#manualTransactionModal').classList.add('hidden'); }
  $('#manualAmount')?.addEventListener('focus', event => ungroupAmountField(event.currentTarget));
  $('#manualAmount')?.addEventListener('blur', event => groupAmountField(event.currentTarget));
  async function saveManualTransaction() {
    const date = $('#manualDate').value, payee = $('#manualPayee').value.trim();
    const amount = parseAmount($('#manualAmount').value), bankAccountId = $('#manualBankAccount').value;
    const counterpartText = $('#manualCounterAccount').value.trim();
    const chosenCounterpart = counterpartText ? state.accounts.find(a => normalize(a.path) === normalize(counterpartText)) : null;
    const counterpartAccountId = chosenCounterpart?.id || null;
    if (!date || !payee || !bankAccountId || !Number.isFinite(amount) || amount === 0) {
      showNotice('Completa il movimento', 'Inserisci data, descrizione, conto corrente e un importo diverso da zero.'); return;
    }
    if (counterpartText && (!counterpartAccountId || counterpartAccountId === bankAccountId)) { showNotice('Scegli una voce valida', 'Digita una categoria e selezionala dall’elenco alfabetico, oppure lascia il campo vuoto.'); return; }
    const tx = { id: uid('m'), date, amount, payee, memo: '', bankAccountId, counterpartAccountId, counterpartSplits: counterpartAccountId ? [{ accountId: counterpartAccountId, value: -amount, memo: '' }] : [], status: counterpartAccountId ? 'confirmed' : 'pending', confidence: counterpartAccountId ? 1 : 0.1, source: 'manual' };
    state.transactions.push(tx);
    if (counterpartAccountId) learnRule('payee', payee, counterpartAccountId);
    closeManualTransaction(); await saveState(); renderAll();
    showNotice('Movimento aggiunto', counterpartAccountId ? 'È stato inserito e classificato.' : 'È stato inserito tra i movimenti da classificare.');
  }
  async function onAccountSelection(event) {
    const select = event.target.closest('.account-select'); if (!select) return;
    const tx = state.transactions.find(t => t.id === select.dataset.tx); if (!tx) return;
    const chosen = state.accounts.find(a => normalize(a.path) === normalize(select.value));
    if (select.value && (!chosen || chosen.id === tx.bankAccountId)) { showNotice('Scegli una voce valida', 'Digita il nome e seleziona una contropartita dall’elenco alfabetico.'); return; }
    tx.suggestionId = chosen?.id || null;
    if (tx.status === 'confirmed') { tx.status = 'pending'; tx.counterpartAccountId = null; tx.counterpartSplits = []; }
    renderTransactions(); renderPendingPreview(); await saveState();
  }
  async function confirmTransaction(id) {
    const tx = state.transactions.find(t => t.id === id); if (!tx) return;
    const select = $(`.account-select[data-tx="${CSS.escape(id)}"]`);
    const accountId = select ? state.accounts.find(a => normalize(a.path) === normalize(select.value))?.id : tx.suggestionId;
    if (!accountId) { showNotice('Scegli un conto', 'Seleziona il conto di contropartita prima di confermare.'); return; }
    tx.counterpartAccountId = accountId; tx.counterpartSplits = [{ accountId, value: -tx.amount, memo: tx.memo || '' }]; tx.suggestionId = accountId; tx.status = 'confirmed'; tx.confidence = 1;
    learnRule('payee', tx.payee, accountId);
    learnRule('memo', tx.memo, accountId);
    state.transactions.filter(other => other.status === 'pending').forEach(other => {
      const suggestion = suggestionFor(other);
      other.suggestionId = suggestion.id; other.suggestionLabel = suggestion.label; other.confidence = suggestion.confidence;
    });
    await saveState(); renderAll();
  }
  let splitEditingId = null;
  function openSplitEditor(id) {
    const tx = state.transactions.find(t => t.id === id); if (!tx) return;
    refreshAccountSearchOptions();
    splitEditingId = id;
    $('#splitTitle').textContent = tx.payee || 'Movimento importato';
    $('#splitSubtitle').textContent = `${formatDate(tx.date)} · ${tx.amount < 0 ? 'suddividi l’uscita' : 'suddividi l’entrata'} di ${euro.format(Math.abs(tx.amount))} tra una o più voci. La somma da assegnare è ${euro.format(-tx.amount)}.`;
    const rows = tx.counterpartSplits?.length ? tx.counterpartSplits : [{ accountId: tx.counterpartAccountId || tx.suggestionId || defaultCounterAccount(tx.amount), value: -tx.amount, memo: tx.memo || '' }];
    $('#splitRows').innerHTML = rows.map(row => splitRowHtml(row)).join('');
    $('#splitModal').classList.remove('hidden');
    bindSplitRows();
    updateSplitTotals();
  }
  function defaultCounterAccount(bankAmount) {
    const type = bankAmount < 0 ? 'EXPENSE' : 'INCOME';
    return state.accounts.find(a => a.type === type && a.id !== accountById(state.bankAccountId)?.id)?.id || '';
  }
  function splitRowHtml(row = {}) {
    return `<div class="split-row"><input class="split-account-search" type="text" list="accountSearchOptions" value="${row.accountId ? safeText(accountLabel(row.accountId)) : ''}" placeholder="Cerca categoria o conto…" autocomplete="off" aria-label="Cerca categoria o conto di contropartita"><input class="split-amount" type="text" inputmode="decimal" value="${amountInputFormat.format(Number(row.value || 0))}" aria-label="Importo della contropartita"><button class="split-remove" type="button" aria-label="Rimuovi riga">×</button></div>`;
  }
  function bindSplitRows() {
    Array.from($('#splitRows').querySelectorAll('.split-account-search, .split-amount')).forEach(input => input.addEventListener('input', updateSplitTotals));
    Array.from($('#splitRows').querySelectorAll('.split-amount')).forEach(input => {
      input.addEventListener('focus', () => ungroupAmountField(input));
      input.addEventListener('blur', () => groupAmountField(input));
    });
    Array.from($('#splitRows').querySelectorAll('.split-remove')).forEach(button => button.addEventListener('click', () => { button.closest('.split-row').remove(); updateSplitTotals(); }));
  }
  function updateSplitTotals() {
    const tx = state.transactions.find(t => t.id === splitEditingId); if (!tx) return;
    const rows = $$('.split-row', $('#splitRows'));
    const amounts = rows.map(row => parseAmount($('.split-amount', row).value));
    const total = amounts.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
    $('#splitTotal').textContent = euro.format(total);
    const remaining = -tx.amount - total;
    $('#splitRemaining').textContent = euro.format(remaining);
    $('#splitRemaining').className = Math.abs(remaining) <= .005 ? 'split-balance-ok' : 'split-balance-missing';
    const complete = rows.length > 0 && rows.every((row, index) => {
      const path = $('.split-account-search', row).value.trim();
      const account = state.accounts.find(a => normalize(a.path) === normalize(path));
      return account && account.id !== tx.bankAccountId && Number.isFinite(amounts[index]) && amounts[index] !== 0;
    });
    $('#saveSplit').disabled = Math.abs(remaining) > .005 || !complete;
  }
  $('#addSplitRow')?.addEventListener('click', () => { $('#splitRows').insertAdjacentHTML('beforeend', splitRowHtml({ accountId: defaultCounterAccount(state.transactions.find(t => t.id === splitEditingId)?.amount || -1), value: 0 })); bindSplitRows(); updateSplitTotals(); });
  $('#cancelSplit')?.addEventListener('click', () => $('#splitModal').classList.add('hidden'));
  $('#closeSplitTop')?.addEventListener('click', () => $('#splitModal').classList.add('hidden'));
  $('#saveSplit')?.addEventListener('click', async () => {
    const tx = state.transactions.find(t => t.id === splitEditingId); if (!tx) return;
    const splits = $$('.split-row', $('#splitRows')).map(row => {
      const selectedPath = $('.split-account-search', row).value.trim();
      const account = state.accounts.find(a => normalize(a.path) === normalize(selectedPath));
      return { accountId: account?.id || '', value: parseAmount($('.split-amount', row).value), memo: tx.memo || '' };
    });
    if (splits.some(s => !s.accountId || s.accountId === tx.bankAccountId || !Number.isFinite(s.value) || s.value === 0)) { showNotice('Completa le righe', 'Per ogni riga seleziona una categoria dall’elenco e inserisci un importo diverso da zero.'); return; }
    const sum = splits.reduce((total, s) => total + s.value, 0);
    if (Math.abs(sum + tx.amount) > .005) { showNotice('Il riparto non quadra', `La somma deve essere ${euro.format(-tx.amount)}; la differenza è ${euro.format(-tx.amount - sum)}.`); return; }
    tx.counterpartSplits = splits; tx.counterpartAccountId = splits.length === 1 ? splits[0].accountId : null; tx.suggestionId = tx.counterpartAccountId; tx.status = 'confirmed'; tx.confidence = 1;
    if (splits.length === 1) { learnRule('payee', tx.payee, splits[0].accountId); learnRule('memo', tx.memo, splits[0].accountId); }
    $('#splitModal').classList.add('hidden'); await saveState(); renderAll();
  });
  function learnRule(field, raw, accountId) {
    const token = normalize(raw);
    if (!token || token.length < 3) return;
    let rule = state.rules.find(r => r.field === field && r.token === token && r.accountId === accountId);
    if (rule) { rule.hits = (rule.hits || 1) + 1; rule.source = 'conferma'; }
    else state.rules.push({ id: uid('r'), field, token, accountId, hits: 1, source: 'conferma' });
  }
  function suggestionFor(tx) {
    const candidates = [];
    for (const field of ['payee', 'memo']) {
      const token = normalize(tx[field]); if (!token) continue;
      state.rules.filter(r => r.field === field && r.token === token).forEach(rule => candidates.push({ accountId: rule.accountId, score: field === 'payee' ? .92 : .84, field, hits: rule.hits || 1 }));
    }
    if (tx.category) {
      const found = findAccountByLabel(tx.category);
      if (found) candidates.push({ accountId: found.id, score: .96, field: 'category', hits: 1 });
    }
    if (!candidates.length) {
      const t = normalize(`${tx.payee || ''} ${tx.memo || ''}`);
      const heuristics = [
        [/supermerc|aliment|market|grocery|spesa/, 'grocery'], [/affitto|mutuo|condomin|casa|locazione/, 'home'],
        [/benzina|carbur|treno|bus|metro|trasport|pedaggio/, 'transport'], [/farmac|medic|salute/, 'health'],
        [/luce|energia|gas|acqua|utenza|telefon/, 'utilities'], [/stipend|salary|retribuz/, 'salary']
      ];
      const hint = heuristics.find(([pattern]) => pattern.test(t));
      if (hint && accountById(hint[1])) candidates.push({ accountId: hint[1], score: .54, field: 'testo', hits: 0 });
    }
    if (!candidates.length) return { id: null, label: 'Da classificare', confidence: .1, reason: 'Nessuna regola trovata' };
    const grouped = new Map();
    candidates.forEach(c => { const old = grouped.get(c.accountId); if (!old || c.score * (1 + Math.log1p(c.hits) / 8) > old.weight) grouped.set(c.accountId, { ...c, weight: c.score * (1 + Math.log1p(c.hits) / 8) }); });
    const sorted = [...grouped.values()].sort((a, b) => b.weight - a.weight);
    const top = sorted[0];
    const ambiguous = sorted[1] && Math.abs(sorted[1].weight - top.weight) < .08;
    return { id: top.accountId, label: accountLabel(top.accountId), confidence: ambiguous ? Math.min(.49, top.score) : top.score, reason: ambiguous ? 'Più conti possibili' : `Corrispondenza ${top.field}` };
  }
  function findAccountByLabel(label) {
    const clean = String(label || '').split(' · [')[0].trim();
    const n = normalize(clean);
    return state.accounts.find(a => normalize(a.path) === n || normalize(a.name) === n || normalize(a.path.replace(/:/g, ' ')) === n ||
      (a.nameHistory || []).some(item => normalize(item.path) === n || normalize(item.path.replace(/:/g, ' ')) === n));
  }

  function renderReports() {
    const comparisons = selectedComparisons();
    const current = comparisons[0].data;
    $('#reportIncome').textContent = euro.format(current.income);
    $('#reportExpense').textContent = euro.format(current.expense);
    $('#reportNet').textContent = euro.format(current.net);
    $('#reportNet').className = current.net >= 0 ? 'amount-in' : 'amount-out';
    $('#reportTransfers').textContent = euro.format(current.transfers);
    const accountHeading = state.reportAccountId === 'all' ? 'Tutti i conti liquidi' : accountReportLabelById(state.reportAccountId);
    $('#reportNameCode').textContent = `Attività: ${accountHeading} · Nome del report: ${reportFilenameCode()}`;
    renderComparisonTable('#reportComparisonBody', comparisons);
    const periodNotes = { monthly: 'Confronto con lo stesso mese dei tre anni precedenti.', quarterly: 'Confronto con lo stesso trimestre dei tre anni precedenti.', halfyearly: 'Confronto con lo stesso semestre dei tre anni precedenti.', annual: 'Confronto con gli stessi mesi degli anni precedenti.' };
    const periodNote = periodNotes[reportMode] || periodNotes.monthly;
    const accountNote = state.reportAccountId === 'all' ? 'Tutti i conti liquidi' : accountReportLabelById(state.reportAccountId);
    const transactionCount = comparisons[0].tx.length;
    const txNote = transactionCount ? `${transactionCount} movimenti nel periodo.` : 'Nessun movimento nel periodo selezionato: prova un altro mese o Tutti i conti liquidi.';
    $('#reportComparisonNote').textContent = `${periodNote} Conto: ${accountNote}. ${txNote}`;
    renderCategoryComparison(comparisons);
    renderReportAssessment(comparisons);
  }
  function economicExpenseTotals(transactions) {
    const totals = new Map();
    const addExpenseWithAncestors = (accountId, rawAmount) => {
      const amount = Math.abs(Number(rawAmount) || 0);
      if (!amount) return;
      let account = accountById(accountId);
      const visited = new Set();
      while (account && !visited.has(String(account.id))) {
        visited.add(String(account.id));
        if (account.type === 'EXPENSE' || (account.classification === 'Patrimoniale' && account.includeInBudget === true)) {
          totals.set(account.id, (totals.get(account.id) || 0) + amount);
        }
        account = account.parentId ? accountById(account.parentId) : null;
      }
    };
    for (const tx of transactions) {
      if (tx.counterpartSplits?.length) {
        for (const split of tx.counterpartSplits) addExpenseWithAncestors(split.accountId, split.value);
      } else {
        addExpenseWithAncestors(tx.counterpartAccountId, tx.amount);
      }
    }
    return totals;
  }
  function economicIncomeTotals(transactions) {
    const totals = new Map();
    for (const tx of transactions) {
      if (tx.counterpartSplits?.length) {
        for (const split of tx.counterpartSplits) {
          const account = accountById(split.accountId);
          if (account?.type === 'INCOME') totals.set(account.id, (totals.get(account.id) || 0) + Math.abs(Number(split.value) || 0));
        }
      } else {
        const account = accountById(tx.counterpartAccountId);
        if (account?.type === 'INCOME') totals.set(account.id, (totals.get(account.id) || 0) + Math.abs(tx.amount));
      }
    }
    return totals;
  }
  function renderReportAssessment(comparisons) {
    const current = comparisons[0].data, previous = comparisons[1].data;
    const active = current.net > 0.005, passive = current.net < -0.005;
    const badge = $('#reportVerdictBadge');
    $('#reportVerdict').textContent = active ? 'Periodo ATTIVO' : passive ? 'Periodo PASSIVO' : 'Periodo IN PAREGGIO';
    $('#reportVerdict').className = active ? 'amount-in' : passive ? 'amount-out' : '';
    badge.textContent = active ? 'ATTIVO' : passive ? 'PASSIVO' : 'IN PAREGGIO';
    badge.className = `report-verdict-badge ${active ? 'verdict-positive' : passive ? 'verdict-negative' : 'verdict-even'}`;
    const periodLabel = reportPeriodLabel();
    $('#reportVerdictNote').textContent = `${periodLabel}: saldo netto dei movimenti sul conto selezionato.`;
    const incomeDelta = current.income - previous.income;
    const expenseDelta = current.expense - previous.expense;
    const netDelta = current.net - previous.net;
    $('#reportIncomeDelta').textContent = `${signedEuro(incomeDelta)} rispetto a ${comparisons[1].year}`;
    $('#reportIncomeDelta').className = incomeDelta < 0 ? 'amount-out' : 'report-value-positive';
    $('#reportExpenseDelta').textContent = `${signedEuro(expenseDelta)} rispetto a ${comparisons[1].year}`;
    $('#reportExpenseDelta').className = expenseDelta < 0 ? 'amount-out' : 'report-value-positive';
    $('#reportNetDelta').textContent = `${signedEuro(netDelta)} rispetto a ${comparisons[1].year}`;
    $('#reportNetDelta').className = netDelta < 0 ? 'amount-out' : 'report-value-positive';
    const deviations = reportDeviationRows(comparisons);
    const averageDeviations = deviations.filter(row => row.delta >= 0.01).sort((a, b) => b.delta - a.delta);
    $('#reportTopExpenses').innerHTML = averageDeviations.length ? averageDeviations.slice(0, 5).map((row, i) => `<div class="report-top-expense"><span class="report-rank">${i + 1}</span><span class="report-expense-name">${safeText(row.name)}</span><strong class="${row.delta < 0 ? 'amount-out' : 'amount-in'}">${row.delta > 0 ? '+' : '−'}${euro.format(Math.abs(row.delta))} (${row.percent === null ? 'n.d.' : `${row.percent > 0 ? '+' : ''}${row.percent.toFixed(0)}%`})</strong></div>`).join('') : '<div class="empty-inline">Non ci sono spese classificate sufficienti per calcolare uno scostamento dalla media.</div>';
    const unclassifiedTotal = comparisons[0].tx.filter(reportExpenseIsUnclassified).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const largest = averageDeviations[0];
    const deviationNote = largest ? `${largest.name} è ${largest.delta >= 0 ? 'sopra' : 'sotto'} la media dei periodi precedenti dello stesso anno di ${euro.format(Math.abs(largest.delta))}${largest.percent === null ? '' : ` (${Math.abs(largest.percent).toFixed(0)}%)`}.` : 'Non emergono spese superiori alla media degli altri periodi disponibili dello stesso anno.';
    $('#reportAssessmentText').textContent = `${active ? 'ATTIVO: le entrate superano le uscite' : passive ? 'PASSIVO: le uscite superano le entrate' : 'IN PAREGGIO: entrate e uscite si equivalgono'} di ${euro.format(Math.abs(current.net))}. ${deviationNote}${unclassifiedTotal ? ` Sono inoltre presenti ${euro.format(unclassifiedTotal)} di uscite da classificare.` : ''} I trasferimenti tra conti sono esclusi dall’analisi delle spese.`;
  }
  function signedEuro(value) { return `${value > 0 ? '+' : value < 0 ? '−' : ''}${euro.format(Math.abs(value))}`; }
  function economicExpenseAmount(tx) {
    if (tx.counterpartSplits?.length) return tx.counterpartSplits.reduce((sum, split) => sum + (accountById(split.accountId)?.type === 'EXPENSE' ? Math.abs(Number(split.value) || 0) : 0), 0);
    return accountById(tx.counterpartAccountId)?.type === 'EXPENSE' ? Math.abs(tx.amount) : 0;
  }
  function reportExpenseIsUnclassified(tx) { return tx.status === 'pending' && tx.amount < 0 && !tx.counterpartAccountId && !tx.counterpartSplits?.length; }
  function reportExpenseAmount(tx) { return economicExpenseAmount(tx) || (reportExpenseIsUnclassified(tx) ? Math.abs(tx.amount) : 0); }

  function aggregateDeviationRows(rows) {
    // economicExpenseTotals stores each movement on its account and every
    // eligible ancestor. Aggregate only the highest eligible account in each
    // branch, otherwise parent totals and their children are counted twice.
    const rowIds = new Set(rows.map(row => String(row.id)));
    const roots = rows.filter(row => {
      let parent = accountById(accountById(row.id)?.parentId);
      const visited = new Set();
      while (parent && !visited.has(String(parent.id))) {
        visited.add(String(parent.id));
        const eligible = parent.type === 'EXPENSE' ||
          (parent.classification === 'Patrimoniale' && parent.includeInBudget === true);
        if (eligible && rowIds.has(String(parent.id))) return false;
        parent = parent.parentId ? accountById(parent.parentId) : null;
      }
      return true;
    });
    const total = roots.reduce((sum, row) => {
      sum.actual += row.actual; sum.previousYear += row.previousYear; sum.yearDelta += row.yearDelta;
      sum.expected += row.expected; sum.delta += row.delta; return sum;
    }, { actual: 0, previousYear: 0, yearDelta: 0, expected: 0, delta: 0 });
    total.yearPercent = total.previousYear > 0.005 ? total.yearDelta / total.previousYear * 100 : null;
    total.percent = total.expected > 0.005 ? total.delta / total.expected * 100 : null;
    return total;
  }
  function reportCashFlowDeviationTotal(comparisons) {
    // "Uscite" always reports the cash-flow total. When its actual amount
    // reconciles with the classified "Spese" total, use the same expected
    // amount as "Spese" so the deviation and percentage cannot diverge.
    const actual = comparisons[0]?.data?.expense || 0;
    const previousYear = comparisons[1]?.data?.expense || 0;
    const expenseRows = reportDeviationRows(comparisons, true);
    const expenseTotal = aggregateDeviationRows(expenseRows);
    const actualMatchesExpenses = expenseRows.length > 0 &&
      Math.abs(expenseTotal.actual - actual) <= 0.01;
    const [year, selectedMonth] = monthSelection().split('-').map(Number);
    const now = new Date();
    const currentYear = now.getFullYear();
    const span = reportMode === 'monthly' ? 1 : reportMode === 'quarterly' ? 3 : reportMode === 'halfyearly' ? 6 : 12;
    const start = reportMode === 'monthly' ? selectedMonth - 1 : reportMode === 'annual' ? 0 : Math.floor((selectedMonth - 1) / span) * span;
    const periodEnd = reportMode === 'annual' ? 11 : reportMode === 'monthly' ? start : start + span - 1;
    const lastCompleteMonth = year === currentYear ? now.getMonth() - 1 : 11;
    let expected = 0;
    if (reportMode === 'monthly' && selectedMonth <= 2) {
      expected = previousYear;
    } else {
      const referenceMonths = [];
      if (reportMode === 'annual') {
        for (let m = 0; m <= Math.min(lastCompleteMonth, 10); m++) referenceMonths.push(m);
      } else {
        for (let m = 0; m <= Math.min(lastCompleteMonth, 11); m++) {
          if (m < start) referenceMonths.push(m);
        }
      }
      if (!referenceMonths.length) {
        expected = previousYear;
      } else {
        const monthlyAverage = referenceMonths.reduce((sum, month) => {
          const dayEnd = new Date(year, month + 1, 0).getDate();
          return sum + cashFlowTotals(periodTransactions(year, month, month, dayEnd)).expense;
        }, 0) / referenceMonths.length;
        const currentPeriodPartial = year === currentYear && now.getMonth() >= start && now.getMonth() <= periodEnd;
        const exposure = reportMode === 'annual'
          ? Math.max(1, now.getMonth() + now.getDate() / new Date(year, now.getMonth() + 1, 0).getDate())
          : reportMode === 'monthly' ? 1
            : currentPeriodPartial
              ? Math.max(0.01, now.getMonth() - start + now.getDate() / new Date(year, now.getMonth() + 1, 0).getDate())
              : span;
        expected = monthlyAverage * exposure;
      }
    }
    if (actualMatchesExpenses) expected = expenseTotal.expected;
    const delta = actual - expected;
    const yearDelta = actual - previousYear;
    return {
      actual, previousYear, yearDelta,
      yearPercent: previousYear > 0.005 ? yearDelta / previousYear * 100 : null,
      expected, delta, percent: expected > 0.005 ? delta / expected * 100 : null
    };
  }
  function reportExpenseCategory(account) {
    let current = account, parent = accountById(current?.parentId);
    while (parent?.type === 'EXPENSE') {
      const grandparent = accountById(parent.parentId);
      if (grandparent?.type !== 'EXPENSE') return current;
      current = parent; parent = grandparent;
    }
    return account;
  }
  function reportDeviationDisplayRows(comparisons = selectedComparisons()) {
    const flatRows = reportDeviationRows(comparisons);
    if (!flatRows.length) return [];
    const groups = new Map(), ungrouped = [];
    for (const row of flatRows) {
      const account = accountById(row.id);
      if (!account || account.type !== 'EXPENSE') { ungrouped.push(row); continue; }
      const category = reportExpenseCategory(account);
      if (!groups.has(category.id)) groups.set(category.id, { account: category, rows: [] });
      groups.get(category.id).rows.push(row);
    }
    const categoryRows = [];
    const orderedGroups = [...groups.values()].sort((a, b) => a.account.name.localeCompare(b.account.name, 'it'));
    for (const group of orderedGroups) {
      const aggregate = aggregateDeviationRows(group.rows);
      const details = group.rows.filter(row => row.id !== group.account.id && Math.abs(row.delta) >= 0.01)
        .sort((a, b) => a.name.localeCompare(b.name, 'it'));
      if (Math.abs(aggregate.delta) < 0.01 && !details.length) continue;
      categoryRows.push({ kind: 'category', id: group.account.id, name: group.account.name, ...aggregate });
      for (const detail of details) {
        const account = accountById(detail.id);
        const depth = Math.max(1, String(account?.path || '').split(':').length - String(group.account.path || '').split(':').length);
        categoryRows.push({ ...detail, kind: 'detail', depth });
      }
    }
    const total = aggregateDeviationRows(flatRows);
    const cashFlowTotal = reportCashFlowDeviationTotal(comparisons);
    return [{ kind: 'summary', name: 'Spese', ...total }, ...categoryRows,
      ...ungrouped.filter(row => Math.abs(row.delta) >= 0.01).map(row => ({ ...row, kind: 'detail', depth: 1 })),
      { kind: 'total', name: 'Uscite', ...cashFlowTotal }];
  }
  function deviationYearLabel(row) {
    const amount = `€ ${row.yearDelta >= 0 ? '+' : '−'}${reportNumber.format(Math.abs(row.yearDelta))}`;
    const percent = row.yearPercent === null ? 'n.d.' : `${row.yearPercent > 0 ? '+' : ''}${row.yearPercent.toFixed(1).replace('.', ',')}%`;
    return `${amount} (${percent})`;
  }
  function reportEuro(value) { return `€ ${reportNumber.format(value)}`; }
  function reportShortEuro(value) { return `€ ${reportShortNumber.format(value)}`; }
  function deviationRowHtml(row) {
    const bold = row.kind === 'summary' || row.kind === 'total', italic = row.kind === 'detail';
    const indent = row.kind === 'category' ? 12 : row.kind === 'detail' ? Math.min(4, row.depth || 1) * 18 : 0;
    const style = bold ? 'font-weight:700;' : italic ? 'font-style:italic;' : '';
    const deltaClass = row.delta < 0 ? 'delta-negative' : 'delta-positive';
    const yearClass = row.yearDelta < 0 ? 'delta-negative' : 'delta-positive';
    const percentClass = row.percent < 0 ? 'delta-negative' : 'delta-positive';
    const percent = row.percent === null ? 'n.d.' : `${row.percent > 0 ? '+' : ''}${row.percent.toFixed(1).replace('.', ',')}%`;
    return `<tr class="deviation-${row.kind}-row" style="${style}"><td><span class="deviation-name" style="display:block;padding-left:${indent}px">${safeText(row.name)}</span></td><td class="num">${reportEuro(row.actual)}</td><td class="num">${reportEuro(row.previousYear)}</td><td class="num ${yearClass}">${deviationYearLabel(row)}</td><td class="num">${reportEuro(row.expected)}</td><td class="num ${deltaClass}">€ ${row.delta >= 0 ? '+' : '−'}${reportNumber.format(Math.abs(row.delta))}</td><td class="num ${percentClass}">${percent}</td></tr>`;
  }

  function renderCategoryComparison(comparisons) {
    const rows = reportDeviationRows(comparisons);
    $('#deviationBaselineNote').textContent = reportMode === 'monthly' && Number(monthSelection().slice(5, 7)) <= 2 ? 'Per gennaio e febbraio il riferimento è lo stesso mese dell’anno precedente. Da marzo, gli scostamenti sono calcolati sugli altri mesi completi disponibili dello stesso anno. Il confronto annuo resta solo informativo.' : 'Gli scostamenti sono calcolati rispetto alla media degli altri periodi completi disponibili dello stesso anno. Il confronto con l’anno precedente resta separato e non genera segnalazioni.';
    const displayRows = reportDeviationDisplayRows(comparisons);
    $('#categoryCompareBody').innerHTML = displayRows.length ? displayRows.map(deviationRowHtml).join('') : '<tr><td colspan="7" class="empty-inline">Nessuno scostamento calcolabile nel periodo.</td></tr>';
  }

  function renderAccounts() {
    const accounts = state.accounts.filter(a => a.type !== 'ROOT').sort((a, b) => a.path.localeCompare(b.path, 'it'));
    const counts = { Patrimoniale: 0, Economica: 0, Tecnica: 0 };
    accounts.forEach(a => { if (counts[a.classification] !== undefined) counts[a.classification]++; });
    $('#accountSummary').innerHTML = Object.entries(counts).map(([label, count]) => `<div class="account-summary-card"><span>Conti ${label.toLowerCase()}</span><strong>${count}</strong></div>`).join('');
    $('#accountsBody').innerHTML = accounts.map(a => {
      const txCount = state.transactions.filter(t => t.counterpartAccountId === a.id || t.bankAccountId === a.id || (t.counterpartSplits || []).some(sp => sp.accountId === a.id)).length;
      const cls = a.classification === 'Economica' ? 'class-economic' : a.classification === 'Patrimoniale' ? 'class-balance' : a.classification === 'Tecnica' ? 'class-technical' : 'class-structural';
      const options = ['automatico','Mastro','Mastro e conto','Conto'].map(v => `<option value="${v}" ${(v === 'automatico' ? !a.hierarchyTypeOverride : a.hierarchyType === v && a.hierarchyTypeSource === 'manuale') ? 'selected' : ''}>${v === 'automatico' ? 'Automatico · ' + safeText(a.hierarchyTypeProposal || a.hierarchyType) : v}</option>`).join('');
      const budgetEligible=a.classification==='Patrimoniale'&&!isLiquidAccount(a)&&a.hierarchyType!=='Mastro';
      const tags=Array.isArray(a.tags)?a.tags:[];
      const tagMarkup=tags.length?'<small class="account-tags">'+tags.map(tag=>'<span>'+safeText(tag)+'</span>').join(' ')+'</small>':'';
      return `<tr><td class="name-primary account-path-cell" title="${safeText(a.path)}">${safeText(a.path)}${tagMarkup}<div class="account-row-actions"><button class="row-action" data-rename-account="${safeText(a.id)}">Rinomina</button><button class="row-action" data-tags-account="${safeText(a.id)}">Tag</button></div></td><td><span class="account-type">${safeText(a.type || '—')}</span></td><td><span class="account-class ${cls}">${safeText(a.classification || 'Da verificare')}</span></td><td><select data-hierarchy-account="${safeText(a.id)}" aria-label="Classificazione gerarchica di ${safeText(a.path)}" style="max-width:190px;padding:6px;border:1px solid #dce5e2;border-radius:6px">${options}</select><small style="display:block;color:#71817d">${a.hasChildren ? (a.hasDirectMovements ? 'Ha sottoconti e movimenti diretti' : 'Ha sottoconti') : 'Conto senza sottoconti'}</small></td><td>${txCount}</td><td>${budgetEligible ? '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-budget-include-account="'+safeText(a.id)+'" '+(a.includeInBudget===true?'checked':'')+'> Includi nel budget</label>' : '—'}</td></tr>`;
    }).join('');
    $('#accountsBody').querySelectorAll('[data-rename-account]').forEach(button=>button.addEventListener('click',()=>renameAccount(button.dataset.renameAccount)));
    $('#accountsBody').querySelectorAll('[data-tags-account]').forEach(button=>button.addEventListener('click',()=>editAccountTags(button.dataset.tagsAccount)));
    $('#accountsBody').querySelectorAll('[data-hierarchy-account]').forEach(select => select.addEventListener('change', async () => {
      const account = accountById(select.dataset.hierarchyAccount); if (!account) return;
      if (select.value === 'automatico') delete account.hierarchyTypeOverride;
      else account.hierarchyTypeOverride = select.value;
      normalizeState(); await saveState(); renderAccounts(); renderBudgetView(); renderForecastSelection();
    }));
    $('#accountsBody').querySelectorAll('[data-budget-include-account]').forEach(input=>input.addEventListener('change',async()=>{
      const account=accountById(input.dataset.budgetIncludeAccount);if(!account)return;
      account.includeInBudget=input.checked;
      await saveState();renderAccounts();renderBudgetView();renderForecastSelection();
    }));
  }
  function renderRules() {
    const body = $('#rulesBody');
    const rules = [...state.rules].filter(r => r.source !== 'demo').sort((a, b) => (b.hits || 0) - (a.hits || 0));
    $('#ruleCountBadge').textContent = `${rules.length} regole`;
    $('#emptyRules').classList.toggle('hidden', rules.length > 0);
    body.innerHTML = rules.slice(0, 250).map(rule => `<tr><td class="name-primary">${safeText(rule.token)}</td><td>${rule.field === 'payee' ? 'Beneficiario' : rule.field === 'memo' ? 'Memo' : 'Categoria'}</td><td>${safeText(accountLabel(rule.accountId))}</td><td>${rule.hits || 1}</td><td><button class="row-action" data-delete-rule="${safeText(rule.id)}">Rimuovi</button></td></tr>`).join('');
    $$('[data-delete-rule]', body).forEach(button => button.addEventListener('click', async () => { state.rules = state.rules.filter(r => r.id !== button.dataset.deleteRule); await saveState(); renderAll(); }));
  }
  function renderSettings() {
    $('#settingsTxCount').textContent = String(state.transactions.length);
    $('#settingsAccountCount').textContent = String(state.accounts.filter(a => !['ROOT'].includes(a.type)).length);
    $('#settingsRuleCount').textContent = String(state.rules.filter(r => r.source !== 'demo').length);
  }
  async function importAccountsFromExcel(event) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const ext = file.name.toLowerCase().split('.').pop();
      const rows = ext === 'xlsx' ? await parseXlsx(file, true) : ext === 'csv' ? parseCsvRows(await file.text()) : null;
      if (!rows) throw new Error('Seleziona un file Excel .xlsx oppure CSV.');
      const hi = rows.findIndex(row => row.some(v => /percorso|conto|account/i.test(String(v))) && row.some(v => /tipo|type|classificazione/i.test(String(v))));
      if (hi < 0) throw new Error('Intestazioni non riconosciute. Scarica e usa il modello Excel.');
      const headers = rows[hi].map(v => normalize(v));
      const pc = headers.findIndex(v => /percorso|conto|account/.test(v));
      const tc = headers.findIndex(v => /tipo|type/.test(v));
      const cc = headers.findIndex(v => /classificazione/.test(v));
      if (pc < 0 || (tc < 0 && cc < 0)) throw new Error('Servono Percorso conto e Tipo GnuCash o Classificazione.');
      const aliases = { ENTRATA:'INCOME', ENTRATE:'INCOME', RICAVO:'INCOME', USCITA:'EXPENSE', USCITE:'EXPENSE', SPESA:'EXPENSE', SPESE:'EXPENSE', PATRIMONIALE:'ASSET', TECNICA:'TRADING' };
      const allowed = ['ROOT','ASSET','BANK','CASH','CREDIT','LIABILITY','EQUITY','INCOME','EXPENSE','TRADING','STOCK','MUTUAL','CURRENCY','RECEIVABLE','PAYABLE','CREDITLINE'];
      const parsed = rows.slice(hi+1).filter(row => String(row[pc] ?? '').trim()).map(row => {
        const path = String(row[pc]).trim().replace(/^:+|:+$/g,''); const raw = normalize(tc >= 0 ? row[tc] : row[cc]).toUpperCase(); const type = aliases[raw] || raw;
        if (!path || !allowed.includes(type)) throw new Error('Tipo non valido per il conto ' + path + ': ' + type); return {path,type};
      });
      if (!parsed.length) throw new Error('Il foglio non contiene conti.');
      const seen = new Set(); const unique = parsed.filter(a => !seen.has(a.path) && seen.add(a.path));
      const old = new Set(state.accounts.map(a => a.path)); const fresh = unique.filter(a => !old.has(a.path)); const dup = unique.length-fresh.length;
      showConfirm('Importare il piano dei conti?', 'Trovati '+unique.length+' conti: '+fresh.length+' nuovi e '+dup+' già presenti. I conti esistenti non saranno sovrascritti.', async () => {
        for (const item of fresh.sort((a,b)=>a.path.split(':').length-b.path.split(':').length)) {
          const parentPath=item.path.split(':').slice(0,-1).join(':'); const parent=state.accounts.find(a=>a.path===parentPath);
          if (parentPath && !parent) throw new Error('Manca il conto padre '+parentPath+'. Includilo nel foglio.');
          state.accounts.push({id:uid('a'),name:item.path.split(':').pop(),path:item.path,type:item.type,classification:classifyType(item.type),parentId:parent?.id||'root'});
        }
        state.demo=false; await saveState(); renderAll(); showNotice('Piano dei conti importato',fresh.length+' conti aggiunti. '+dup+' già presenti lasciati invariati.');
      });
    } catch(error) { showNotice('Importazione piano dei conti non riuscita',error.message||'File non leggibile.'); }
    event.target.value='';
  }
  function downloadAccountTemplate() {
    downloadXlsx('Modello-piano-dei-conti.xlsx',[{name:'Piano dei conti',rows:[['Percorso conto','Tipo GnuCash','Classificazione'],['Attività','ASSET','Patrimoniale'],['Attività:Conto corrente','BANK','Patrimoniale'],['Uscite','EXPENSE','Economica'],['Uscite:Casa','EXPENSE','Economica'],['Entrate','INCOME','Economica']],widths:[42,22,24]}]);
  }
  function openAddAccount() {
    $('#accountNameInput').value = '';
    $('#accountEconomicCheckbox').checked = false;
    $('#accountEconomicTypeWrap').classList.add('hidden');
    $('#accountEconomicType').value = 'EXPENSE';
    $('#accountModal').classList.remove('hidden');
    $('#accountNameInput').focus();
  }
  function closeAddAccount() {
    $('#accountModal').classList.add('hidden');
  }
  async function addAccount() {
    const rawName = $('#accountNameInput').value.trim();
    if (!rawName) {
      showNotice('Nome conto mancante', 'Inserisci il nome o il percorso del nuovo conto.');
      $('#accountNameInput').focus();
      return;
    }
    const parts = rawName.split(':').map(part => part.trim());
    if (parts.some(part => !part)) {
      showNotice('Percorso conto non valido', 'Controlla il percorso: i nomi dei livelli devono essere separati da due punti, senza segmenti vuoti.');
      return;
    }
    const path = parts.join(':');
    if (state.accounts.some(account => normalize(account.path) === normalize(path))) {
      showNotice('Conto già presente', 'Nel piano dei conti esiste già un conto con questo percorso.');
      return;
    }
    const parentPath = parts.slice(0, -1).join(':');
    const parentGuess = parentPath ? state.accounts.find(account => normalize(account.path) === normalize(parentPath)) : null;
    const economic = $('#accountEconomicCheckbox').checked;
    const type = economic ? ($('#accountEconomicType').value === 'INCOME' ? 'INCOME' : 'EXPENSE') : 'ASSET';
    const account = { id: uid('a'), name: parts.at(-1), path, type, classification: classifyType(type), parentId: parentGuess?.id || 'root' };
    state.accounts.push(account);
    const saved = await saveState();
    if (!saved) {
      state.accounts = state.accounts.filter(item => item.id !== account.id);
      showNotice('Conto non salvato', 'Il server non ha confermato il salvataggio. Verifica la connessione e riprova.');
      return;
    }
    closeAddAccount();
    renderAll();
    showNotice('Conto creato', 'Il conto “' + path + '” è stato aggiunto al piano dei conti.');
  }

  async function onBankFile(event) {
    const file=event.target.files?.[0]; if(!file)return;
    try {
      let imported; const ext=file.name.toLowerCase().split('.').pop();
      if(ext==='qif'||ext==='txt') imported=parseQif(await file.text()); else if(ext==='ofx') imported=parseOfx(await file.text()); else if(ext==='csv') imported=parseCsv(await file.text()); else if(ext==='xlsx') imported=await parseXlsx(file); else throw new Error('Formato non supportato.');
      if(!imported.length) throw new Error('Non ho trovato movimenti con data e importo.');
      const start=replaceDemo=>{
        if(replaceDemo) state={...createDemoState(),accounts:defaultAccounts(),transactions:[],rules:[],demo:false,openingBalance:0};
        const known=new Set(state.transactions.filter(tx=>tx.status!=='duplicate').map(transactionFingerprint));
        const duplicates=findImportDuplicates(imported);
        const commit=include=>{
          const selected=state.reportAccountId&&state.reportAccountId!=='all'&&isLiquidAccount(accountById(state.reportAccountId))?state.reportAccountId:state.bankAccountId;
          const batchKeys=new Set();
          const chosen=imported.filter(tx=>{const key=transactionFingerprint(tx);const duplicate=known.has(key)||batchKeys.has(key);batchKeys.add(key);return include||!duplicate;});
          chosen.forEach(tx=>{const key=transactionFingerprint(tx);const suggestion=tx.split?{id:null,label:'Movimento suddiviso · rivedi le righe',confidence:.1}:suggestionFor(tx);tx.suggestionId=suggestion.id;tx.suggestionLabel=suggestion.label;tx.confidence=suggestion.confidence;if(tx.category){const cat=findAccountByLabel(tx.category);if(cat){tx.suggestionId=cat.id;tx.suggestionLabel=cat.path;tx.confidence=.96;}}tx.id=uid();tx.status='pending';tx.bankAccountId=selected;tx.source=ext;if(known.has(key))tx.duplicateOverride=true;});
          state.transactions.push(...chosen);state.demo=false;const latest=imported.map(tx=>tx.date).filter(Boolean).sort().at(-1);
          if(latest){state.selectedMonth=latest.slice(0,7);$('#monthPicker').value=state.selectedMonth;syncReportPeriodPicker(state.selectedMonth);}
          state.reportAccountId=selected;$('#accountPicker').value=selected;$('#reportAccountPicker').value=selected;
          saveState().then(()=>{renderAll();navigate('transactions');showNotice('Importazione completata',chosen.length+' movimenti aggiunti. '+(duplicates.length?(include?duplicates.length+' duplicati inseriti comunque.':duplicates.length+' duplicati esclusi.'):'')+' '+chosen.filter(t=>t.status==='pending').length+' da classificare.');});
        };
        if(duplicates.length) showDuplicateChoice('Movimenti già presenti','Trovati '+duplicates.length+' possibili duplicati su '+imported.length+' righe. Scegli se escluderli oppure importarli comunque.',commit); else commit(false);
      };
      if(state.demo) showConfirm('Sostituire i dati dimostrativi?','Ho trovato '+imported.length+' movimenti. I dati dimostrativi saranno rimossi.',()=>start(true)); else start(false);
    }catch(error){showNotice('Importazione non riuscita',error.message||'Non riesco a leggere il file.');}event.target.value='';
  }  function isDuplicate(candidate) {
    const key = transactionFingerprint(candidate);
    return state.transactions.some(tx => tx.status !== 'duplicate' && transactionFingerprint(tx) === key);
  }
  function transactionFingerprint(tx) { if(tx.fitid)return 'OFX|'+String(tx.fitid).trim()+'|'+parseDate(tx.date)+'|'+Number(tx.amount).toFixed(2); return [parseDate(tx.date), Number(tx.amount).toFixed(2), normalize(transactionDescription(tx)), normalize(transactionCausale(tx))].join('|'); }
  function findImportDuplicates(rows) {
    const seen = new Set(state.transactions.filter(tx => tx.status !== 'duplicate').map(transactionFingerprint));
    const duplicates = [];
    rows.forEach(tx => { const key = transactionFingerprint(tx); if (seen.has(key)) duplicates.push(tx); seen.add(key); });
    return duplicates;
  }

  function parseOfxDate(value) {
    const m=String(value||'').match(/^(\d{4})(\d{2})(\d{2})/);
    return m?m[1]+'-'+m[2]+'-'+m[3]:'';
  }
  function parseOfx(content) {
    const source=String(content||'').replace(/^\uFEFF/,'');
    const blocks=source.match(/<STMTTRN\b[^>]*>[\s\S]*?(?:<\/STMTTRN>|(?=<STMTTRN\b)|$)/gi)||[];
    const read=(block,tag)=>{
      const match=block.match(new RegExp('<'+tag+'\\s*>([^<\\r\\n]*)','i'));
      return match?String(match[1]).trim():'';
    };
    return blocks.map(block=>{
      const date=parseOfxDate(read(block,'DTPOSTED'));
      const amount=parseAmount(read(block,'TRNAMT'));
      const fitid=read(block,'FITID');
      const name=read(block,'NAME')||read(block,'PAYEE')||'';
      const memo=read(block,'MEMO')||'';
      return {id:uid('o'),date,amount,fitid,description:name,payee:name,memo,causale:memo};
    }).filter(tx=>tx.date&&Number.isFinite(tx.amount));
  }

  function parseQif(content) {
    const records = []; let record = {};
    const append = (field, value) => { if (!value) return; record[field] = record[field] ? `${record[field]} ${value}` : value; };
    const lines = String(content).replace(/^\uFEFF/, '').split(/\r?\n/);
    for (const line of lines) {
      if (!line) continue;
      if (line.trim() === '^') { if (record.T || record.amount) records.push(record); record = {}; continue; }
      const key = line[0], value = line.slice(1).trim();
      if (key === '!') continue;
      if (key === 'D') record.dateRaw = value;
      else if (key === 'T') record.amount = parseAmount(value);
      else if (key === 'P') append('payee', value);
      else if (key === 'M') append('memo', value);
      else if (key === 'L') record.category = value;
      else if (key === 'N') record.number = value;
      else if (key === 'S') record.splitCategory = value;
      else if (key === '$') record.splitAmount = parseAmount(value);
      else if (key === 'E') append('splitMemo', value);
    }
    if (record.T || record.amount) records.push(record);
    return records.map(r => {
      const description = r.payee || '';
      const causale = [r.memo, r.splitMemo].filter(Boolean).join(' · ');
      return { id: uid('q'), date: parseQifDate(r.dateRaw), amount: r.amount, description, causale, payee: description, memo: causale, category: r.category || '', split: Boolean(r.splitCategory || r.splitAmount !== undefined) };
    })
      .filter(tx => tx.date && Number.isFinite(tx.amount));
  }
  function parseCsv(text) {
    const rows = parseCsvRows(text);
    if (rows.length < 2) return [];
    const headerIndex = detectHeaderRow(rows);
    if (headerIndex < 0) throw new Error('Non ho trovato le intestazioni nel CSV.');
    return parseGridRows(rows, headerIndex);
  }
  function parseCsvRows(text) {
    const delimiter = (text.split(/\r?\n/).find(line => line.trim()) || '').split(';').length > (text.split(/\r?\n/).find(line => line.trim()) || '').split(',').length ? ';' : ',';
    const rows = []; let row = [], cell = '', quoted = false;
    const s = String(text).replace(/^\uFEFF/, '');
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"' && quoted && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = !quoted;
      else if (ch === delimiter && !quoted) { row.push(cell); cell = ''; }
      else if ((ch === '\n' || ch === '\r') && !quoted) { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.map(r => r.map(v => String(v).trim()));
  }
  async function parseXlsx(file, returnGrid = false) {
    if (!window.JSZip) throw new Error('Lettore Excel non disponibile. Riprova usando il file CSV esportato da Excel.');
    const zip = await JSZip.loadAsync(file);
    const workbookXml = await readZipText(zip, 'xl/workbook.xml');
    const workbookDoc = parseXml(workbookXml);
    const sheetNode = [...workbookDoc.getElementsByTagName('*')].find(el => el.localName === 'sheet');
    if (!sheetNode) throw new Error('Il foglio Excel non contiene una tabella leggibile.');
    const relId = sheetNode.getAttribute('r:id') || sheetNode.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const relsDoc = parseXml(await readZipText(zip, 'xl/_rels/workbook.xml.rels'));
    const rel = [...relsDoc.getElementsByTagName('*')].find(el => el.localName === 'Relationship' && el.getAttribute('Id') === relId);
    if (!rel) throw new Error('Non riesco a trovare il foglio selezionato nel file Excel.');
    let target = rel.getAttribute('Target').replace(/^\//, '');
    if (!target.startsWith('xl/')) target = `xl/${target}`;
    const sheetDoc = parseXml(await readZipText(zip, target));
    const shared = zip.file('xl/sharedStrings.xml') ? parseXml(await readZipText(zip, 'xl/sharedStrings.xml')) : null;
    const sharedStrings = shared ? [...shared.getElementsByTagName('*')].filter(el => el.localName === 'si').map(si => [...si.getElementsByTagName('*')].filter(el => el.localName === 't').map(t => t.textContent).join('')) : [];
    const dateStyles = await getExcelDateStyles(zip);
    const rows = [];
    const sheetRows = [...sheetDoc.getElementsByTagName('*')].filter(el => el.localName === 'row');
    for (const rowNode of sheetRows) {
      const row = [];
      for (const cell of [...rowNode.children].filter(el => el.localName === 'c')) {
        const ref = cell.getAttribute('r') || '';
        const col = columnIndex(ref);
        while (row.length <= col) row.push('');
        const type = cell.getAttribute('t');
        const valNode = [...cell.children].find(el => el.localName === 'v');
        const inline = [...cell.getElementsByTagName('*')].filter(el => el.localName === 't').map(el => el.textContent).join('');
        let value = valNode?.textContent ?? inline;
        if (type === 's') value = sharedStrings[Number(value)] ?? '';
        else if (type === 'inlineStr' || type === 'str') value = inline || value;
        else if (value !== '' && type !== 'b') {
          const num = Number(value);
          if (Number.isFinite(num)) value = dateStyles.has(cell.getAttribute('s')) ? excelSerialDate(num) : num;
        }
        row[col] = value;
      }
      rows.push(row);
    }
    if (returnGrid) return rows;
    const headerIndex = detectHeaderRow(rows);
    if (headerIndex < 0) throw new Error('Non ho riconosciuto la riga di intestazione nel foglio Excel. Per questo prototipo, esporta una tabella CSV con intestazioni e riprova.');
    return parseGridRows(rows, headerIndex);
  }
  async function readZipText(zip, path) {
    const file = zip.file(path); if (!file) throw new Error(`Nel file Excel manca una parte necessaria: ${path}`);
    return file.async('string');
  }
  function parseXml(text) {
    const xml = new DOMParser().parseFromString(text, 'application/xml');
    if (xml.getElementsByTagName('parsererror').length) throw new Error('Il file contiene XML non valido.');
    return xml;
  }
  async function getExcelDateStyles(zip) {
    const file = zip.file('xl/styles.xml'); if (!file) return new Set();
    const doc = parseXml(await file.async('string'));
    const custom = new Map();
    [...doc.getElementsByTagName('*')].filter(el => el.localName === 'numFmt').forEach(el => custom.set(el.getAttribute('numFmtId'), el.getAttribute('formatCode')));
    const xfs = [...doc.getElementsByTagName('*')].find(el => el.localName === 'cellXfs');
    if (!xfs) return new Set();
    const dateIds = new Set(['14','15','16','17','18','19','20','21','22','45','46','47']);
    return new Set([...xfs.children].map((xf, i) => {
      const id = xf.getAttribute('numFmtId') || '0';
      const fmt = custom.get(id) || '';
      return dateIds.has(id) || /[dy]/i.test(fmt) ? String(i) : null;
    }).filter(Boolean));
  }
  function excelSerialDate(serial) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
    return date.toISOString().slice(0, 10);
  }
  function columnIndex(ref) {
    const letters = ref.match(/^[A-Z]+/i)?.[0]?.toUpperCase() || 'A';
    let n = 0; for (const c of letters) n = n * 26 + c.charCodeAt(0) - 64; return n - 1;
  }
  function detectHeaderRow(rows) {
    // Bank statements often contain a title, account balances and filters
    // before the actual transaction table. Identify the header by its labels,
    // not by assuming that the very next row contains numeric Excel cells.
    const limit = Math.min(rows.length, 120);
    for (let i = 0; i < limit; i++) {
      const headers = (rows[i] || []).map(value => normalize(value));
      const hasDate = headers.some(value => /^(data|data cont|data contabil|data valuta|date|booking date|value date)$/.test(value));
      const hasAmount = headers.some(value => /importo|amount|totale|dare|avere|addebito|accredito|uscita|entrata/.test(value));
      const hasDescription = headers.some(value => /descrizion|description|beneficiario|beneficiary|payee|esercente|merchant|causale|causal|memo|dettaglio|note/.test(value));
      if (hasDate && hasAmount && hasDescription) return i;
    }
    // Keep compatibility with simpler CSV/XLSX exports whose column names
    // are less descriptive than those used by Italian bank statements.
    for (let i = 0; i < Math.min(rows.length - 1, 60); i++) {
      const textCount = rows[i].filter(v => typeof v === 'string' && v.trim()).length;
      const next = rows[i + 1] || [];
      const nextCount = next.filter(v => v !== '' && v !== null && v !== undefined).length;
      const nextNumbers = next.filter(v => typeof v === 'number').length;
      if (textCount >= 4 && nextCount >= 4 && nextNumbers >= 1) return i;
    }
    return -1;
  }
  function parseGridRows(rows, headerIndex) {
    const headers = rows[headerIndex].map(h => normalize(h));
    const data = rows.slice(headerIndex + 1).filter(row => row.some(v => v !== '' && v !== null && v !== undefined));
    const dateCols = headers.map((h, i) => /data|date/.test(h) ? i : -1).filter(i => i >= 0);
    const amountCols = headers.map((h, i) => /importo|amount|totale|dare|avere|addebito|accredito|uscita|entrata/.test(h) ? i : -1).filter(i => i >= 0);
    const descCols = headers.map((h, i) => /descr|causal|benef|payee|esercente|merchant|operazione|movimento|memo|dettaglio|note/.test(h) ? i : -1).filter(i => i >= 0);
    const descriptionCol = headers.findIndex(h => /descrizion|description|beneficiario|beneficiary|payee|esercente|merchant/.test(h));
    const causaleCol = headers.findIndex((h, i) => i !== descriptionCol && /causale|causal|memo|dettaglio|note|operazione|movimento/.test(h));
    const categoryCol = headers.findIndex(h => /categor|conto di contropartita/.test(h));
    const dateCol = dateCols[0] ?? findMostDateLike(data);
    const textCol = (descriptionCol >= 0 ? descriptionCol : causaleCol >= 0 ? causaleCol : descCols.find(i => i !== dateCol)) ?? findMostTextColumn(data, dateCol, amountCols);
    const debitCol = headers.findIndex(h => /dare|addebito|uscita/.test(h));
    const creditCol = headers.findIndex(h => /avere|accredito|entrata/.test(h));
    let amountCol = amountCols.find(i => i !== debitCol && i !== creditCol);
    if (amountCol === undefined || amountCol < 0) amountCol = findMostNumericColumn(data, [dateCol, textCol, categoryCol]);
    const fallbackText = descCols.filter(i => i !== dateCol && i !== amountCol && i !== textCol);
    const memoCol = causaleCol >= 0 && causaleCol !== textCol ? causaleCol : fallbackText[0];
    if (dateCol < 0 || textCol < 0 || amountCol < 0) throw new Error('Per importare il foglio Excel servono colonne riconoscibili per data, descrizione e importo.');
    return data.map(row => {
      const dateValue = row[dateCol];
      const date = typeof dateValue === 'number' ? excelSerialDate(dateValue) : parseFlexibleDate(dateValue);
      let amount;
      if (debitCol >= 0 && creditCol >= 0) amount = Math.abs(parseAmount(row[creditCol] || 0)) - Math.abs(parseAmount(row[debitCol] || 0));
      else amount = parseAmount(row[amountCol]);
      const textValue = String(row[textCol] ?? '').trim();
      const description = descriptionCol >= 0 ? String(row[descriptionCol] ?? '').trim() : (causaleCol === textCol ? '' : textValue);
      const causale = memoCol >= 0 ? String(row[memoCol] ?? '').trim() : (causaleCol === textCol ? textValue : '');
      const payee = description || (descriptionCol < 0 && causaleCol < 0 ? textValue : '');
      return { id: uid('x'), date, amount, description, causale, payee, memo: causale, category: categoryCol >= 0 ? String(row[categoryCol] ?? '').trim() : '' };
    }).filter(tx => tx.date && Number.isFinite(tx.amount));
  }
  function parseFlexibleDate(value) {
    if (typeof value === 'number') return excelSerialDate(value);
    const s = String(value || '').trim();
    const dmy = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
    if (dmy) { let y = Number(dmy[3]); if (y < 100) y += y < 70 ? 2000 : 1900; return `${y}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`; }
    return parseDate(s);
  }
  function findMostDateLike(rows) {
    const cols = Math.max(0, ...rows.map(r => r.length));
    let best = -1, bestCount = 0;
    for (let c = 0; c < cols; c++) {
      const count = rows.filter(r => typeof r[c] === 'string' && parseFlexibleDate(r[c])).length;
      if (count > bestCount) { best = c; bestCount = count; }
    }
    return best;
  }
  function findMostTextColumn(rows, exclude, others) {
    const cols = Math.max(0, ...rows.map(r => r.length)); let best = -1, bestCount = 0;
    for (let c = 0; c < cols; c++) { if (c === exclude || others.includes(c)) continue; const n = rows.filter(r => typeof r[c] === 'string' && r[c].trim()).length; if (n > bestCount) { best = c; bestCount = n; } }
    return best;
  }
  function findMostNumericColumn(rows, exclude) {
    const cols = Math.max(0, ...rows.map(r => r.length)); let best = -1, bestCount = 0;
    for (let c = 0; c < cols; c++) { if (exclude.includes(c)) continue; const n = rows.filter(r => typeof r[c] === 'number' || Number.isFinite(parseAmount(r[c]))).length; if (n > bestCount) { best = c; bestCount = n; } }
    return best;
  }

  async function onGnuCashFile(event) {
    const file=event.target.files?.[0];if(!file)return;
    try{
      const bytes=new Uint8Array(await file.arrayBuffer());const sig=new TextDecoder('ascii').decode(bytes.subarray(0,16));
      if(sig.startsWith('SQLite format 3'))throw new Error('Il file GnuCash è SQLite. Aprilo in GnuCash e salva una copia XML, senza sovrascrivere l’originale.');
      let xml;if(bytes[0]===0x1f&&bytes[1]===0x8b){if(!('DecompressionStream'in window))throw new Error('Browser senza supporto gzip.');xml=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();}else xml=new TextDecoder('utf-8').decode(bytes);
      if(!xml.trimStart().startsWith('<?xml')&&!xml.trimStart().startsWith('<gnc-v2'))throw new Error('Il file non sembra un libro GnuCash XML leggibile.');
      const parsed=parseGnuCashXml(xml);if(!parsed.accounts.length)throw new Error('Nel file non ho trovato un piano dei conti leggibile.');
      const duplicateCount=findImportDuplicates(parsed.transactions).length;
      const merge=async include=>{
        const byPath=new Map();state.accounts.forEach(ac=>{byPath.set(ac.path,ac);(ac.nameHistory||[]).forEach(item=>{if(item.path)byPath.set(item.path,ac);});});const idMap=new Map();
        parsed.accounts.forEach(ac=>{if(ac.type==='ROOT'){idMap.set(ac.id,state.accounts.find(x=>x.type==='ROOT')?.id||'root');return;}const old=byPath.get(ac.path);idMap.set(ac.id,old?old.id:uid('a'));});
        const additions=parsed.accounts.filter(ac=>ac.type!=='ROOT'&&!byPath.has(ac.path)).map(ac=>({...ac,id:idMap.get(ac.id),parentId:idMap.get(ac.parentId)||'root'}));state.accounts.push(...additions);
        const keys=new Set(state.transactions.filter(tx=>tx.status!=='duplicate').map(transactionFingerprint));const seen=new Set();
        const chosen=parsed.transactions.filter(tx=>{const key=transactionFingerprint(tx);const duplicate=keys.has(key)||seen.has(key);seen.add(key);return include||!duplicate;});
        const imported=chosen.map(tx=>({...tx,id:uid('g'),bankAccountId:idMap.get(tx.bankAccountId)||tx.bankAccountId,counterpartAccountId:idMap.get(tx.counterpartAccountId)||tx.counterpartAccountId,counterpartSplits:(tx.counterpartSplits||[]).map(sp=>({...sp,accountId:idMap.get(sp.accountId)||sp.accountId})),duplicateOverride:keys.has(transactionFingerprint(tx))}));
        state.transactions.push(...imported);const ruleKeys=new Set(state.rules.map(r=>[r.field,r.token,r.accountId].join('|')));
        parsed.rules.forEach(rule=>{const accountId=idMap.get(rule.accountId)||rule.accountId;const key=[rule.field,rule.token,accountId].join('|');if(!ruleKeys.has(key)){state.rules.push({...rule,id:uid('r'),accountId});ruleKeys.add(key);}});
        state.demo=false;state.bankAccountId=parsed.bankAccountId?(idMap.get(parsed.bankAccountId)||state.bankAccountId):state.bankAccountId;state.reportAccountId='all';state.reportAccountDefaultMigrated=true;
        const dates=imported.map(tx=>parseDate(tx.date)).filter(Boolean).sort();if(dates.length)state.selectedMonth=dates.at(-1).slice(0,7);
        const saved=await saveState();transactionPage=0;if(dates.length){const m=dates.at(-1).slice(0,7);$('#monthPicker').value=m;syncReportPeriodPicker(m);}renderAll();navigate('transactions');showNotice(saved?'Libro GnuCash importato':'Importazione non salvata',additions.length+' conti aggiunti; '+imported.length+' movimenti importati. '+(duplicateCount?(include?duplicateCount+' duplicati inseriti comunque.':duplicateCount+' duplicati esclusi.'):'')+' I dati esistenti sono stati conservati.');
      };
      if(duplicateCount)showDuplicateChoice('Movimenti GnuCash già presenti','Trovati '+duplicateCount+' possibili duplicati su '+parsed.transactions.length+' movimenti. Scegli se escluderli oppure importarli comunque.',merge);
      else showConfirm('Importare il libro GnuCash?','Saranno aggiunti '+parsed.accounts.length+' conti e '+parsed.transactions.length+' movimenti. I dati esistenti non saranno sostituiti.',()=>merge(false));
    }catch(error){showNotice('Importazione GnuCash non riuscita',error.message||'Non riesco a leggere il file.');}event.target.value='';
  }  function parseGnuCashXml(text) {
    const doc = parseXml(text);
    const all = [...doc.getElementsByTagName('*')];
    const accountNodes = all.filter(el => el.localName === 'account' && childText(el, 'name') !== null && childText(el, 'type') !== null);
    const rawAccounts = accountNodes.map(el => ({ id: childText(el, 'id'), name: childText(el, 'name'), type: String(childText(el, 'type') || '').toUpperCase(), parentId: childText(el, 'parent') }));
    const rawById = new Map(rawAccounts.map(a => [a.id, a]));
    const pathMemo = new Map();
    const getPath = (id, stack = new Set()) => {
      if (pathMemo.has(id)) return pathMemo.get(id);
      const a = rawById.get(id); if (!a) return '';
      if (a.type === 'ROOT') { pathMemo.set(id, ''); return ''; }
      if (stack.has(id)) return a.name;
      stack.add(id); const p = a.parentId && rawById.has(a.parentId) ? getPath(a.parentId, stack) : '';
      const full = p ? `${p}:${a.name}` : a.name; pathMemo.set(id, full); return full;
    };
    const accounts = rawAccounts.map(a => ({ ...a, path: getPath(a.id), classification: classifyType(a.type) }));
    const accountsById = new Map(accounts.map(a => [a.id, a]));
    const transactionNodes = all.filter(el => el.localName === 'transaction' && childText(el, 'description') !== null && directChild(el, 'splits'));
    const transactions = [], rules = [];
    for (const node of transactionNodes) {
      const description = childText(node, 'description') || '';
      const posted = directChild(node, 'date-posted');
      const date = parseDate(childText(posted, 'date'));
      const splitsNode = directChild(node, 'splits');
      const splitNodes = [...(splitsNode?.children || [])].filter(el => el.localName === 'split');
      const splits = splitNodes.map(sp => ({ accountId: childText(sp, 'account'), value: parseRational(childText(sp, 'value')), memo: childText(sp, 'memo') || '' })).filter(s => s.accountId && Number.isFinite(s.value));
      const bankSplits = splits.filter(s => isLiquidAccount(accountsById.get(s.accountId)));
      for (const bankSplit of bankSplits) {
        const counterpart = splits.filter(s => s !== bankSplit);
        const uniqueIds = [...new Set(counterpart.map(s => s.accountId))];
        const singleAccountId = uniqueIds.length === 1 ? uniqueIds[0] : null;
        const tx = { id: uid('g'), date, amount: bankSplit.value, payee: description, memo: bankSplit.memo, bankAccountId: bankSplit.accountId, counterpartAccountId: singleAccountId, status: 'confirmed', confidence: 1, source: 'gnucash', counterpartSplits: counterpart };
        transactions.push(tx);
        if (singleAccountId && date) {
          addTrainingRule(rules, 'payee', description, singleAccountId);
          addTrainingRule(rules, 'memo', bankSplit.memo, singleAccountId);
        }
      }
    }
    const ruleMap = new Map();
    for (const rule of rules) {
      const key = `${rule.field}\u0000${rule.token}\u0000${rule.accountId}`;
      const existing = ruleMap.get(key);
      if (existing) existing.hits++;
      else ruleMap.set(key, rule);
    }
    const uniqueRules = [...ruleMap.values()];
    return { accounts, transactions: transactions.filter(t => t.date), rules: uniqueRules, bankAccountId: accounts.find(a => a.type === 'BANK')?.id || accounts.find(isLiquidAccount)?.id };
  }
  function directChild(node, localName) { return [...(node?.children || [])].find(child => child.localName === localName) || null; }
  function childText(node, localName) { const child = directChild(node, localName); return child ? child.textContent.trim() : null; }
  function parseRational(text) {
    if (!text) return NaN; const [num, den] = String(text).split('/').map(Number); return den ? num / den : num;
  }
  function addTrainingRule(rules, field, raw, accountId) {
    const token = normalize(raw); if (!token || token.length < 3) return;
    rules.push({ id: uid('r'), field, token, accountId, hits: 1, source: 'gnucash' });
  }

  function renderMonthPicker() {
    const value = $('#monthPicker').value || localDateKey(new Date()).slice(0, 7);
    $('#monthPicker').value = value; syncReportPeriodPicker(value);
  }
  async function exportBackup() {
    try {
      const response = await fetch('/api/export', { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 401) { location.replace('/login'); return; }
      if (!response.ok) throw new Error('Il server non ha potuto creare il backup.');
      const backup = await response.json();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `gestione-cc-backup-${localDateKey(new Date())}.json`);
      showNotice('Backup esportato', 'È stata scaricata una copia dell’archivio centralizzato.');
    } catch (error) { showNotice('Backup non riuscito', error.message); }
  }
  async function downloadSqliteBackup() {
    try {
      const response = await fetch('/api/sqlite-backup', { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 401) { location.replace('/login'); return; }
      if (!response.ok) throw new Error('Il server non ha potuto creare la copia SQLite.');
      const blob = await response.blob();
      downloadBlob(blob, 'gestione-cc-database-' + localDateKey(new Date()) + '.sqlite3');
      showNotice('Backup database completato', 'È stata scaricata una copia completa e coerente del database SQLite.');
    } catch (error) { showNotice('Backup database non riuscito', error.message); }
  }
  async function restoreSqliteBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    showConfirm('Ripristinare il database completo?', 'Il file sostituirà archivio, account amministratore e registri del database. Il server creerà automaticamente una copia preventiva. Dopo il ripristino dovrai accedere di nuovo con le credenziali contenute nel backup.', async () => {
      const response = await fetch('/api/sqlite-restore', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/octet-stream' },
        body: file
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Ripristino SQLite non riuscito.');
      location.replace('/login');
    });
    event.target.value = '';
  }
  function exportPeriodTransactions(monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    const accountFilter = state.reportAccountId || 'all';
    return state.transactions.filter(tx => tx.date >= start && tx.date <= end && tx.status !== 'duplicate' && (accountFilter === 'all' || tx.bankAccountId === accountFilter)).sort((a, b) => parseDate(b.date).localeCompare(parseDate(a.date)));
  }
  function reportCategoryRows(comparisons) {
    const byYear = new Map();
    for (const comparison of comparisons) byYear.set(comparison.year, economicExpenseTotals(comparison.tx));
    const ids = new Set([...byYear.values()].flatMap(map => [...map.keys()]));
    return [...ids].map(id => ({ label: accountLabel(id).replace(/^.*:/, ''), values: comparisons.map(c => byYear.get(c.year).get(id) || 0) })).sort((a, b) => b.values[0] - a.values[0]);
  }
  function reportDeviationRows(comparisons = selectedComparisons(), includeZeroDelta = false) {
    const actualMap = economicExpenseTotals(comparisons[0].tx);
    const baseline = new Map();
    const [year, selectedMonth] = monthSelection().split('-').map(Number);
    const now = new Date();
    const currentYear = now.getFullYear();
    const span = reportMode === 'monthly' ? 1 : reportMode === 'quarterly' ? 3 : reportMode === 'halfyearly' ? 6 : 12;
    const start = reportMode === 'monthly' ? selectedMonth - 1 : reportMode === 'annual' ? 0 : Math.floor((selectedMonth - 1) / span) * span;
    const periodEnd = reportMode === 'annual' ? 11 : reportMode === 'monthly' ? start : start + span - 1;
    // Never use the current incomplete month as a reference period.
    const lastCompleteMonth = year === currentYear ? now.getMonth() - 1 : 11;
    const referenceMonths = [];
    let baselinePeriods = 0;
    let exposure = 1;

    // January and February are the only monthly reports allowed to fall back
    // to the same month of the previous year.
    if (reportMode === 'monthly' && selectedMonth <= 2) {
      // In the first two months, use the same month of the previous year.
      const priorYearMap = economicExpenseTotals(comparisons[1]?.tx || []);
      for (const [id, value] of priorYearMap) baseline.set(id, value);
      baselinePeriods = 1;
    } else {
      if (reportMode === 'annual') {
        for (let m = 0; m <= Math.min(lastCompleteMonth, 10); m++) referenceMonths.push(m);
      } else {
        for (let m = 0; m <= Math.min(lastCompleteMonth, 11); m++) {
          // The selected period is compared only with completed periods
          // that precede it; later months must never influence its baseline.
          if (m < start) referenceMonths.push(m);
        }
      }
      baselinePeriods = referenceMonths.length;
      for (const m of referenceMonths) {
        const dayEnd = new Date(year, m + 1, 0).getDate();
        const monthTotals = economicExpenseTotals(periodTransactions(year, m, m, dayEnd));
        for (const [id, value] of monthTotals) baseline.set(id, (baseline.get(id) || 0) + value / Math.max(1, baselinePeriods));
      }
      // For a current-year Q1/H1/annual report generated in January or February,
      // use the equivalent elapsed period from the previous year if there are
      // fewer than two complete same-year reference months.
      if (year === currentYear && now.getMonth() <= 1 && baselinePeriods < 2) {
        baseline.clear();
        const priorPeriodMap = economicExpenseTotals(comparisons[1]?.tx || []);
        for (const [id, value] of priorPeriodMap) baseline.set(id, value);
        baselinePeriods = 1;
        exposure = 1;
      } else {
        const currentPeriodPartial = year === currentYear && now.getMonth() >= start && now.getMonth() <= periodEnd;
        exposure = reportMode === 'annual'
          ? Math.max(1, now.getMonth() + (now.getDate() / new Date(year, now.getMonth() + 1, 0).getDate()))
          : reportMode === 'monthly' ? 1
            : currentPeriodPartial
              ? Math.max(0.01, now.getMonth() - start + (now.getDate() / new Date(year, now.getMonth() + 1, 0).getDate()))
              : span;
        for (const [id, value] of baseline) baseline.set(id, value * exposure);
      }
    }

    const previousMap = economicExpenseTotals(comparisons[1]?.tx || []);
    const ids = new Set([...actualMap.keys(), ...baseline.keys(), ...previousMap.keys()]);
    return [...ids].map(id => {
      const actual = actualMap.get(id) || 0, expected = baseline.get(id) || 0;
      const delta = actual - expected;
      const previousYear = previousMap.get(id) || 0, yearDelta = actual - previousYear;
      const periodDate = comparisons[0].tx.map(tx=>tx.date).filter(Boolean).sort()[0] || monthSelection() + '-01';
      return { id, name: accountPathAt(accountById(id), periodDate).replace(/^.*:/, ''), actual, previousYear, yearDelta, yearPercent: previousYear > 0.005 ? yearDelta / previousYear * 100 : null, expected, delta, percent: expected > 0.005 ? delta / expected * 100 : null };
    }).filter(row => baselinePeriods > 0 && (includeZeroDelta || Math.abs(row.delta) >= 0.01))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }
  function reportChartRows() {
    const comparisons = selectedComparisons();
    if (reportMode !== 'annual') return comparisons.map(c => ({ label: String(c.year), income: c.data.income, expense: c.data.expense }));
    const [year, selectedMonth] = monthSelection().split('-').map(Number);
    const cutoff = year === new Date().getFullYear() ? new Date().getMonth() : 11;
    const labels = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return labels.slice(0, cutoff + 1).map((label, month) => {
      const dayEnd = year === new Date().getFullYear() && month === new Date().getMonth() ? new Date().getDate() : new Date(year, month + 1, 0).getDate();
      const totals = cashFlowTotals(periodTransactions(year, month, month, dayEnd));
      return { label, income: totals.income, expense: totals.expense };
    });
  }
  function reportChartSvg() {
    const rows = reportChartRows(), width = 760, height = 280, left = 54, right = 16, top = 30, bottom = 42;
    const chartHeight = height - top - bottom, chartWidth = width - left - right;
    const max = Math.max(1, ...rows.flatMap(r => [r.income, r.expense]));
    const slot = chartWidth / Math.max(1, rows.length), barWidth = Math.min(24, slot * 0.28);
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Grafico di entrate e uscite">`];
    for (let i = 0; i <= 4; i++) {
      const y = top + chartHeight * i / 4, val = max * (1 - i / 4);
      parts.push(`<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#dce5e2"/><text x="${left - 7}" y="${y + 4}" text-anchor="end" font-size="10" fill="#657671">${Math.round(val).toLocaleString('it-IT')}</text>`);
    }
    rows.forEach((row, i) => {
      const cx = left + slot * (i + .5), h1 = row.income / max * chartHeight, h2 = row.expense / max * chartHeight;
      parts.push(`<rect x="${cx - barWidth - 2}" y="${top + chartHeight - h1}" width="${barWidth}" height="${h1}" rx="3" fill="#222"/><rect x="${cx + 2}" y="${top + chartHeight - h2}" width="${barWidth}" height="${h2}" rx="3" fill="#999"/><text x="${cx}" y="${height - 17}" text-anchor="middle" font-size="10" fill="#40534e">${xmlEscape(row.label)}</text>`);
    });
    parts.push(`<rect x="${left + 8}" y="8" width="10" height="10" rx="2" fill="#222"/><text x="${left + 24}" y="17" font-size="10" fill="#40534e">Entrate</text><rect x="${left + 90}" y="8" width="10" height="10" rx="2" fill="#999"/><text x="${left + 106}" y="17" font-size="10" fill="#40534e">Uscite</text></svg>`);
    return parts.join('');
  }
  function xmlEscape(value) {
    return String(value ?? '').replace(/[<>&"']/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[ch]));
  }
  function excelColumn(number) {
    let value = number + 1, label = '';
    while (value) { const remainder = (value - 1) % 26; label = String.fromCharCode(65 + remainder) + label; value = Math.floor((value - 1) / 26); }
    return label;
  }
  async function downloadXlsx(filename, sheets) {
    if (!window.JSZip) { showNotice('Esportazione Excel non disponibile', 'Il componente Excel non è caricato. Riavvia l’app e riprova.'); return; }
    try {
      const zip = new JSZip();
      zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
      zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
      zip.folder('xl').file('workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, i) => `<sheet name="${xmlEscape(sheet.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
      zip.folder('xl').file('styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="€ #,##0.00;[Red]-€ #,##0.00;€ 0.00"/><numFmt numFmtId="165" formatCode="0.0%;[Red]-0.0%"/></numFmts><fonts count="6"><font><sz val="11"/><color rgb="FF243431"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF173E39"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF174B43"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF243431"/><name val="Calibri"/></font><font><i/><sz val="11"/><color rgb="FF243431"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF176E66"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF3F0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFDCE5E2"/></left><right style="thin"><color rgb="FFDCE5E2"/></right><top style="thin"><color rgb="FFDCE5E2"/></top><bottom style="thin"><color rgb="FFDCE5E2"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="17"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="14" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/><xf numFmtId="164" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1"/><xf numFmtId="165" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1"/><xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/><xf numFmtId="164" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1"/><xf numFmtId="165" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
      zip.folder('xl').folder('_rels').file('workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
      const worksheets = zip.folder('xl').folder('worksheets');
      sheets.forEach((sheet, sheetIndex) => {
        const rows = sheet.rows.map((row, rowIndex) => `<row r="${rowIndex + 1}"${sheet.rowHeights?.[rowIndex] ? ` ht="${sheet.rowHeights[rowIndex]}" customHeight="1"` : ''}>${row.map((value, colIndex) => {
          const ref = `${excelColumn(colIndex)}${rowIndex + 1}`;
          const isTitle = rowIndex === (sheet.titleRow ?? -1);
          const isHeader = rowIndex === (sheet.headerRow ?? 0) || sheet.headerRows?.includes(rowIndex);
          const isSummary = sheet.summaryRows?.includes(rowIndex);
          let cellValue = value, style = isTitle ? 5 : isHeader ? 1 : isSummary ? 9 : 6;
          if (typeof value === 'string' && sheet.dateColumns?.includes(colIndex) && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const [y, m, d] = value.split('-').map(Number); cellValue = (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; style = isSummary ? 9 : 8;
          } else if (typeof value === 'number' && Number.isFinite(value)) {
            if (isSummary) style = 10;
            else if (sheet.percentColumns?.includes(colIndex)) style = 3;
            else if (sheet.currencyColumns?.includes(colIndex) || sheet.currencyColumns === undefined) style = 7;
          }
          const rowFont = sheet.rowFontStyles?.[rowIndex];
          if (rowFont && style !== 1 && style !== 5 && style !== 9 && style !== 10) {
            const fontStyles = rowFont === 'bold' ? { 6: 11, 7: 12, 3: 13 } : { 6: 14, 7: 15, 3: 16 };
            style = fontStyles[style] ?? style;
          }
          return typeof cellValue === 'number' && Number.isFinite(cellValue) ? `<c r="${ref}"${style ? ` s="${style}"` : ''}><v>${cellValue}</v></c>` : `<c r="${ref}"${style ? ` s="${style}"` : ''} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cellValue)}</t></is></c>`;
        }).join('')}</row>`).join('');
        const colXml = sheet.widths?.length ? `<cols>${sheet.widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>` : '';
        const headerRow = (sheet.headerRow ?? 0) + 1, lastRow = sheet.rows.length, lastCol = Math.max(1, ...sheet.rows.map(row => row.length));
        const pane = `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`;
        const filterEndRow = sheet.autoFilterEndRow ?? lastRow;
        const filter = sheet.autoFilter !== false && filterEndRow > headerRow ? `<autoFilter ref="A${headerRow}:${excelColumn(lastCol - 1)}${filterEndRow}"/>` : '';
        worksheets.file(`sheet${sheetIndex + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${colXml}<sheetData>${rows}</sheetData>${filter}</worksheet>`);
      });
      const chartSheets = sheets.map((sheet, index) => ({ sheet, index })).filter(item => item.sheet.charts && item.sheet.charts.length);
      if (chartSheets.length) {
        const chartParts = [];
        let chartNumber = 0;
        for (const item of chartSheets) {
          const sheet = item.sheet, sheetIndex = item.index, drawingId = sheetIndex + 1;
          const anchors = [], relationships = [];
          for (let i = 0; i < sheet.charts.length; i++) {
            const chart = sheet.charts[i], chartId = ++chartNumber, relId = 'rId' + (i + 1);
            const colStart = chart.startCol || 0, rowStart = chart.startRow || (i * 18 + 1);
            const colEnd = chart.endCol || 14, rowEnd = chart.endRow || (rowStart + 16);
            const colName = n => excelColumn(n);
            const range = (name, col, first, last) => "'" + String(name).replace(/'/g, "''") + "'!$" + colName(col) + "$" + first + ":$" + colName(col) + "$" + last;
            let seriesXml = '';
            chart.series.forEach((series, seriesIndex) => {
              const nameRow = series.nameRow || 1, first = chart.firstDataRow || 2, last = chart.lastDataRow;
              seriesXml += '<c:ser><c:idx val="' + seriesIndex + '"/><c:order val="' + seriesIndex + '"/><c:tx><c:strRef><c:f>' + xmlEscape(range(series.sheet, series.nameCol === undefined ? series.col : series.nameCol, nameRow, nameRow)) + '</c:f></c:strRef></c:tx><c:cat><c:strRef><c:f>' + xmlEscape(range(chart.categorySheet, chart.categoryCol || 0, first, last)) + '</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>' + xmlEscape(range(series.sheet, series.col, first, last)) + '</c:f></c:numRef></c:val></c:ser>';
            });
            const chartTitle = xmlEscape(chart.title || 'Grafico report');
            const chartXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="it-IT" sz="1400" b="1"/><a:t>' + chartTitle + '</a:t></a:r><a:endParaRPr lang="it-IT"/></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/>' + seriesXml + '<c:gapWidth val="65"/><c:axId val="100001"/><c:axId val="100002"/></c:barChart><c:catAx><c:axId val="100001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="100002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="100002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="#,##0.00" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="100001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx></c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="zero"/></c:chart></c:chartSpace>';
            zip.folder('xl').folder('charts').file('chart' + chartId + '.xml', chartXml);
            chartParts.push('/xl/charts/chart' + chartId + '.xml');
            relationships.push('<Relationship Id="' + relId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart' + chartId + '.xml"/>');
            anchors.push('<xdr:twoCellAnchor><xdr:from><xdr:col>' + colStart + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + rowStart + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>' + colEnd + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + rowEnd + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="' + chartId + '" name="Grafico ' + chartId + '"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="' + relId + '"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>');
          }
          const drawingXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' + anchors.join('') + '</xdr:wsDr>';
          zip.folder('xl').folder('drawings').file('drawing' + drawingId + '.xml', drawingXml);
          zip.folder('xl').folder('drawings').folder('_rels').file('drawing' + drawingId + '.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + relationships.join('') + '</Relationships>');
          const sheetFile = zip.file('xl/worksheets/sheet' + (sheetIndex + 1) + '.xml');
          const sheetXml = await sheetFile.async('string');
          zip.file('xl/worksheets/sheet' + (sheetIndex + 1) + '.xml', sheetXml.replace('</worksheet>', '<drawing xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></worksheet>'));
          zip.folder('xl').folder('worksheets').folder('_rels').file('sheet' + (sheetIndex + 1) + '.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing' + drawingId + '.xml"/></Relationships>');
        }
        const typesFile = zip.file('[Content_Types].xml');
        let typesXml = await typesFile.async('string');
        const drawingTypes = chartSheets.map(item => '<Override PartName="/xl/drawings/drawing' + (item.index + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>').join('');
        const chartTypes = chartParts.map(path => '<Override PartName="' + path + '" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>').join('');
        typesXml = typesXml.replace('</Types>', drawingTypes + chartTypes + '</Types>');
        zip.file('[Content_Types].xml', typesXml);
      }
      const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, filename);
      showNotice('File Excel pronto', `Creato ${filename}. Puoi aprirlo con Excel o LibreOffice.`);
    } catch (error) { showNotice('Esportazione Excel non riuscita', error?.message || String(error)); }
  }
  function printHtml(title, content, options = {}) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { showNotice('Finestra di stampa bloccata', 'Consenti l’apertura della finestra del report e riprova.'); return; }
    const reportToolbar = options.reportToolbar ? `<div class="report-toolbar"><div><strong>${safeText(options.toolbarTitle || 'Report Gestione C/C')}</strong><span>Anteprima del documento</span></div><div class="report-toolbar-actions"><button type="button" id="reportPrintAction">STAMPA/ESPORTA PDF</button></div></div>` : '';
    const reportScript = options.reportToolbar ? '' : `<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script>`;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeText(title)}</title><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#213330;margin:0}h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:20px 0 8px}.sub{color:#667772;margin-bottom:18px}.summary{display:flex;gap:12px;margin:14px 0}.summary div{border:1px solid #dce5e2;padding:10px;flex:1}.summary strong{display:block;font-size:15px;margin-top:5px}.summary span{display:block;font-size:9px;color:#63736f;margin-top:4px}.chart{width:100%;margin:8px 0 18px;break-inside:avoid}.chart svg{display:block;width:100%;height:auto;max-height:100mm}table{width:100%;border-collapse:collapse;font-size:10px;margin:8px 0 16px}th,td{border-bottom:1px solid #dce5e2;text-align:left;padding:6px 5px}th{background:#f0f5f3;font-weight:700}td.num,th.num{text-align:right}.foot{font-size:9px;color:#647570;margin-top:16px}.report-toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 18px;margin:0 0 22px;background:#f3f7f5;border-bottom:1px solid #dce5e2;font-family:Arial,sans-serif}.report-toolbar strong{display:block;font-size:13px}.report-toolbar span{display:block;margin-top:3px;color:#71817c;font-size:10px}.report-toolbar-actions{display:flex;gap:8px}.report-toolbar button{border:1px solid #cbdad5;border-radius:7px;background:#fff;color:#294d45;padding:9px 13px;font-size:12px;font-weight:650;cursor:pointer}.report-toolbar button:hover{background:#e6f1ed;border-color:#8eafa4}.report-document{max-width:1100px;margin:0 auto;padding:0 22px 28px}@media print{thead{display:table-header-group}table{width:100%;border-collapse:collapse;break-inside:auto;page-break-inside:auto}tr{break-inside:avoid;page-break-inside:avoid}td,th{padding:5px 4px}.statement-opening{break-inside:avoid;page-break-inside:avoid;margin:12px 0 18px;padding:10px 12px;border:1px solid #dce5e2;font-size:12px}.statement-opening strong{margin-left:12px;font-size:15px}.statement-ending{break-inside:avoid;page-break-inside:avoid;margin-top:18px}.statement-ending .summary{display:flex;gap:10px}.statement-ending .summary div{flex:1}.report-toolbar{display:none!important}.report-document{max-width:none;margin:0;padding:0}}@media(max-width:600px){.report-toolbar{align-items:flex-start;flex-direction:column}.report-toolbar-actions{width:100%}.report-toolbar button{flex:1}}.statement-opening{margin:12px 0 18px;padding:10px 12px;border:1px solid #dce5e2;border-radius:6px}.statement-opening strong{margin-left:12px;font-size:15px}.statement-ending{margin-top:20px}.statement-ending .summary{display:flex;gap:10px}.statement-ending .summary div{flex:1}</style></head><body>${reportToolbar}<main class="report-document">${content}<p class="foot">Creato da Gestione C/C · ${new Date().toLocaleString('it-IT')}</p></main>${reportScript}</body></html>`);
    printWindow.document.close();
    if (options.reportToolbar) {
      const printButton = printWindow.document.getElementById('reportPrintAction');
      if (printButton) printButton.addEventListener('click', () => {
        printWindow.focus();
        printWindow.print();
      });
    }
  }
  function statementContext() {
    const monthKey = monthSelection();
    const transactions = exportPeriodTransactions(monthKey);
    return { monthKey, transactions, totals: cashFlowTotals(transactions), accountName: state.reportAccountId === 'all' ? 'Tutti i conti liquidi' : accountReportLabelById(state.reportAccountId) };
  }
  function overviewStatementContext() {
    const monthKey = monthSelection();
    const [year, month] = monthKey.split('-').map(Number);
    const start = year + '-' + String(month).padStart(2, '0') + '-01';
    const end = year + '-' + String(month).padStart(2, '0') + '-' + String(new Date(year, month, 0).getDate()).padStart(2, '0');
    const accountFilter = state.reportAccountId || state.bankAccountId || 'all';
    const belongsToAccount = tx => accountFilter === 'all' || tx.bankAccountId === accountFilter;
    const validTransactions = state.transactions.filter(tx => tx.status !== 'duplicate' && belongsToAccount(tx) && parseDate(tx.date));
    const openingBase = accountFilter === 'all' || accountFilter === state.bankAccountId ? Number(state.openingBalance || 0) : 0;
    const opening = openingBase + validTransactions.filter(tx => tx.date < start).reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const transactions = validTransactions.filter(tx => tx.date >= start && tx.date <= end)
      .sort((a, b) => parseDate(a.date).localeCompare(parseDate(b.date)) || String(a.id || '').localeCompare(String(b.id || '')));
    let running = opening;
    const rows = transactions.map(tx => {
      const amount = Number(tx.amount) || 0;
      running += amount;
      return { tx, income: amount > 0 ? amount : 0, expense: amount < 0 ? Math.abs(amount) : 0, balance: running };
    });
    return { monthKey, start, end, opening, closing: running, transactions, rows,
      accountName: accountFilter === 'all' ? 'Tutti i conti liquidi' : accountReportLabelById(accountFilter),
      totals: cashFlowTotals(transactions) };
  }
  function exportOverviewStatementPdf() {
    const ctx = overviewStatementContext();
    const rows = ctx.rows.map(({ tx, income, expense, balance }) => {
      const description = transactionDescription(tx) || transactionCausale(tx) || 'Movimento';
      return '<tr><td>' + formatDate(tx.date) + '</td><td>' + safeText(description) + '</td><td class="num">' + (income ? euro.format(income) : '') + '</td><td class="num">' + (expense ? euro.format(expense) : '') + '</td><td class="num">' + euro.format(balance) + '</td></tr>';
    }).join('');
    const content = '<h1>Estratto conto</h1><div class="sub">' + safeText(monthName(ctx.monthKey)) + ' · ' + safeText(ctx.accountName) + '</div><div class="statement-opening">Saldo iniziale <strong>' + euro.format(ctx.opening) + '</strong></div><table class="statement-table"><thead><tr><th>Data</th><th>Descrizione</th><th class="num">Entrate</th><th class="num">Uscite</th><th class="num">Saldo progressivo</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5">Nessun movimento nel periodo selezionato.</td></tr>') + '</tbody></table><section class="statement-ending"><h2>Riepilogo del periodo</h2><div class="summary"><div>Entrate<strong>' + euro.format(ctx.totals.income) + '</strong></div><div>Uscite<strong>' + euro.format(ctx.totals.expense) + '</strong></div><div>Saldo finale<strong>' + euro.format(ctx.closing) + '</strong></div></div><div class="foot">' + ctx.transactions.length + ' movimenti · Periodo dal ' + formatDate(ctx.start) + ' al ' + formatDate(ctx.end) + '. Prospetto personale non sostitutivo dell’estratto ufficiale della banca.</div></section>';
    printHtml('Estratto-conto-' + ctx.monthKey, content, { reportToolbar: true, toolbarTitle: 'Estratto conto' });
  }
  function exportOverviewStatementXlsx() {
    const ctx = overviewStatementContext();
    const rows = [
      ['ESTRATTO CONTO · GESTIONE C/C'],
      ['Periodo', monthName(ctx.monthKey)],
      ['Conto', ctx.accountName],
      ['Saldo iniziale', ctx.opening],
      [],
      ['Data', 'Descrizione', 'Causale', 'Entrate', 'Uscite', 'Saldo progressivo', 'Contropartita', 'Stato'],
      ...ctx.rows.map(({ tx, income, expense, balance }) => [
        tx.date, transactionDescription(tx) || transactionCausale(tx) || 'Movimento',
        transactionCausale(tx), income || '', expense || '', balance,
        tx.counterpartSplits?.length ? tx.counterpartSplits.map(s => accountLabel(s.accountId)).join('; ') : accountLabel(tx.counterpartAccountId),
        tx.status || ''
      ]),
      []
    ];
    const summaryStart = rows.length;
    rows.push(
      ['RIEPILOGO DEL PERIODO'],
      ['Totale entrate', ctx.totals.income],
      ['Totale uscite', ctx.totals.expense],
      ['Saldo finale', ctx.closing]
    );
    downloadXlsx('Estratto-conto-' + ctx.monthKey + '.xlsx', [{
      name: 'Estratto conto', rows, titleRow: 0, headerRow: 5,
      summaryRows: [summaryStart, summaryStart + 1, summaryStart + 2, summaryStart + 3],
      currencyColumns: [1, 3, 4, 5], dateColumns: [0],
      widths: [15, 42, 38, 18, 18, 21, 42, 16],
      autoFilter: true, autoFilterEndRow: 6 + ctx.rows.length,
      rowHeights: { 0: 26, 5: 30 }
    }]);
  }
  function exportStatementPdf() {
    const { monthKey, transactions, totals, accountName } = statementContext();
    const rows = transactions.map(tx => {
      const counterpart = tx.counterpartSplits?.length ? tx.counterpartSplits.map(s => accountLabel(s.accountId)).join('; ') : accountLabel(tx.counterpartAccountId);
      return `<tr><td>${formatDate(tx.date)}</td><td>${safeText(transactionDescription(tx) || transactionCausale(tx) || 'Movimento')}</td><td>${safeText(transactionCausale(tx))}</td><td>${safeText(counterpart)}</td><td class="num">${tx.amount > 0 ? euro.format(tx.amount) : ''}</td><td class="num">${tx.amount < 0 ? euro.format(Math.abs(tx.amount)) : ''}</td></tr>`;
    }).join('');
    const content = `<h1>Prospetto movimenti mensile</h1><div class="sub">${safeText(monthName(monthKey))} · ${safeText(accountName)}</div><div class="summary"><div>Entrate<strong>${euro.format(totals.income)}</strong></div><div>Uscite<strong>${euro.format(totals.expense)}</strong></div><div>Saldo netto del periodo<strong>${euro.format(totals.net)}</strong></div></div><table><thead><tr><th>Data</th><th>Descrizione</th><th>Causale</th><th>Contropartita</th><th class="num">Entrate</th><th class="num">Uscite</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Nessun movimento nel periodo selezionato.</td></tr>'}</tbody></table><div class="foot">${transactions.length} movimenti. Prospetto personale non sostitutivo dell’estratto ufficiale della banca.</div>`;
    printHtml(`Movimenti ${monthKey}`, content);
  }
  function exportReportPdf() {
    const comparisons = selectedComparisons(), current = comparisons[0].data, previous = comparisons[1].data;
    const deviations = reportDeviationRows(comparisons);
    const averageDeviations = deviations.filter(row => row.delta >= 0.01).sort((a, b) => b.delta - a.delta);
    const verdict = current.net > .005 ? 'ATTIVO' : current.net < -.005 ? 'PASSIVO' : 'IN PAREGGIO';
    const rows = reportDeviationDisplayRows(comparisons).map(deviationRowHtml).join('');
    const periodRows = comparisons.map(c => `<tr><td>${c.year}</td><td class="num">${reportEuro(c.data.income)}</td><td class="num">${reportEuro(c.data.expense)}</td><td class="num" style="color:${c.data.net < 0 ? '#b00020' : '#171b1a'};font-weight:${c.data.net < 0 ? '700' : '400'}">${reportEuro(c.data.net)}</td><td class="num">${reportEuro(c.data.transfers)}</td></tr>`).join('');
    const scope = state.reportAccountId === 'all' ? 'Tutti i conti liquidi' : accountReportLabelById(state.reportAccountId);
    const label = reportPeriodLabel(), code = reportFilenameCode();
    const baselineText = reportMode === 'monthly' && Number(monthSelection().slice(5, 7)) <= 2 ? 'Confronto con lo stesso mese dell’anno precedente' : 'Media degli altri periodi completi disponibili dello stesso anno';
    const chart = reportChartSvg();
    const content = `<h1>Report Gestione C/C</h1><div class="sub">Attività: ${safeText(scope)} · ${safeText(code)} · ${safeText(label)}</div><div class="summary"><div>Entrate<strong>${euro.format(current.income)}</strong><span style="color:${current.income - previous.income < 0 ? '#b00020' : '#171b1a'}">Confronto precedente: ${signedEuro(current.income - previous.income)}</span></div><div>Uscite<strong>${euro.format(current.expense)}</strong><span style="color:${current.expense - previous.expense < 0 ? '#b00020' : '#171b1a'}">Confronto precedente: ${signedEuro(current.expense - previous.expense)}</span></div><div>Saldo netto<strong style="color:${current.net < 0 ? '#b00020' : '#171b1a'};font-weight:${current.net < 0 ? '700' : '400'}">${euro.format(current.net)}</strong><span style="color:${current.net - previous.net < 0 ? '#b00020' : '#171b1a'}">${verdict} · variazione ${signedEuro(current.net - previous.net)}</span></div></div><h2>Flusso del periodo</h2><div class="chart">${chart}</div><h2>Valutazione e scostamenti</h2><p><strong style="color:${current.net < 0 ? '#b00020' : '#171b1a'}">${verdict}</strong>: ${current.net > .005 ? 'le entrate hanno superato le uscite.' : current.net < -.005 ? 'le uscite hanno superato le entrate.' : 'entrate e uscite sono in pareggio.'} I trasferimenti sono separati dall’analisi delle spese.</p><p>${averageDeviations[0] ? `Lo scostamento maggiore è ${safeText(averageDeviations[0].name)}: ${averageDeviations[0].delta > 0 ? 'sopra' : 'sotto'} la media di ${euro.format(Math.abs(averageDeviations[0].delta))}.` : 'Non emergono scostamenti confrontabili dalla media.'}</p><h2>Scostamenti di spesa · ${safeText(baselineText)}</h2><table><thead><tr><th>Categoria</th><th class="num">Spesa periodo</th><th class="num">Anno prec.</th><th class="num">Var. annua</th><th class="num">Media attesa</th><th class="num">Scostamento</th><th class="num">Var. % media</th></tr></thead><tbody>${rows || '<tr><td colspan="7">Nessuno scostamento calcolabile.</td></tr>'}</tbody></table><h2>Confronto con gli anni precedenti</h2><table><thead><tr><th>Anno</th><th class="num">Entrate</th><th class="num">Uscite</th><th class="num">Netto</th><th class="num">Trasferimenti</th></tr></thead><tbody>${periodRows}</tbody></table>`;
    printHtml('Report-' + code, content, { reportToolbar: true });
  }
  function exportStatementXlsx() {
    const { monthKey, transactions, totals, accountName } = statementContext();
    const rows = [['Data', 'Descrizione', 'Causale', 'Conto corrente', 'Contropartita', 'Importo', 'Stato'], ...transactions.map(tx => [tx.date, transactionDescription(tx) || transactionCausale(tx) || 'Movimento', transactionCausale(tx), accountLabel(tx.bankAccountId), tx.counterpartSplits?.length ? tx.counterpartSplits.map(s => accountLabel(s.accountId)).join('; ') : accountLabel(tx.counterpartAccountId), tx.amount, tx.status]), [], ['Mese', monthKey], ['Conto', accountName], ['Entrate', totals.income], ['Uscite', totals.expense], ['Saldo netto', totals.net]];
    downloadXlsx(`Movimenti-${monthKey}.xlsx`, [{ name: 'Movimenti', rows }]);
  }
  function exportReportXlsx() {
    const comparisons = selectedComparisons();
    const mode = reportPeriodLabel();
    const deviations = reportDeviationRows(comparisons);
    const categories = reportDeviationDisplayRows(comparisons);
    const current = comparisons[0].data, previous = comparisons[1].data;
    const verdict = current.net > .005 ? 'ATTIVO' : current.net < -.005 ? 'PASSIVO' : 'IN PAREGGIO';
    const account = state.reportAccountId === 'all' ? 'Tutti i conti liquidi' : accountReportLabelById(state.reportAccountId);
    const [selectedYear] = monthSelection().split('-').map(Number);
    const now = new Date();
    const lastMonth = selectedYear === now.getFullYear() ? now.getMonth() : 11;
    const monthLabels = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    const trendRows = [['Mese', 'Entrate', 'Uscite', 'Saldo netto'], ...monthLabels.slice(0, lastMonth + 1).map((label, month) => {
      const dayEnd = selectedYear === now.getFullYear() && month === now.getMonth() ? now.getDate() : new Date(selectedYear, month + 1, 0).getDate();
      const totals = cashFlowTotals(periodTransactions(selectedYear, month, month, dayEnd));
      return [label, totals.income, totals.expense, totals.net];
    })];
    const summaryRows = [
      ['GESTIONE C/C · REPORT DEI FLUSSI'],
      ['Codice report', reportFilenameCode()],
      ['Periodo', mode],
      ['Attività', account],
      ['Esito del periodo', verdict],
      [],
      ['Indicatore', 'Periodo scelto', 'Stesso periodo anno precedente', 'Variazione annua'],
      ['Entrate', current.income, previous.income, current.income - previous.income],
      ['Uscite', current.expense, previous.expense, current.expense - previous.expense],
      ['Saldo netto', current.net, previous.net, current.net - previous.net],
      ['Trasferimenti', current.transfers, previous.transfers, current.transfers - previous.transfers],
      ['Movimenti', comparisons[0].tx.length + ' nel periodo', comparisons[1].tx.length + ' nel periodo', '']
    ];
    const flowRows = [['Anno', 'Entrate', 'Uscite', 'Saldo netto', 'Trasferimenti', 'Numero movimenti'], ...comparisons.map(c => [String(c.year), c.data.income, c.data.expense, c.data.net, c.data.transfers, c.tx.length])];
    const categoryRows = [['Categoria', 'Spesa periodo', 'Anno prec.', 'Var. annua', 'Media attesa', 'Scostamento', 'Var. % media'], ...categories.map(row => [`${row.kind === 'detail' ? '   '.repeat(Math.min(4, row.depth || 1)) : row.kind === 'category' ? '  ' : ''}${row.name}`, row.actual, row.previousYear, deviationYearLabel(row), row.expected, row.delta, row.percent === null ? 'n.d.' : row.percent / 100])];
    const categoryFontStyles = Object.fromEntries(categories.map((row, index) => [index + 1, row.kind === 'detail' ? 'italic' : row.kind === 'summary' || row.kind === 'total' ? 'bold' : null]).filter(([, style]) => style));
    const chartCategoryRows = [['Categoria', 'Spesa periodo', 'Stesso periodo anno precedente', 'Variazione annua', 'Variazione annua %', 'Media attesa stesso anno', 'Scostamento dalla media', 'Variazione dalla media %'], ...deviations.filter(row => Math.abs(row.delta) >= 0.01).map(row => [row.name, row.actual, row.previousYear, row.yearDelta, row.yearPercent === null ? 'n.d.' : row.yearPercent / 100, row.expected, row.delta, row.percent === null ? 'n.d.' : row.percent / 100])];
    const txRows = [['Data', 'Descrizione completa', 'Causale', 'Conto corrente', 'Importo', 'Contropartita/e', 'Stato'], ...comparisons[0].tx.map(tx => [tx.date, transactionDescription(tx) || transactionCausale(tx) || 'Movimento', transactionCausale(tx), accountLabel(tx.bankAccountId), tx.amount, tx.counterpartSplits?.length ? tx.counterpartSplits.map(s => accountLabel(s.accountId) + ' (' + euro.format(s.value) + ')').join('; ') : accountLabel(tx.counterpartAccountId), tx.status])];
    const mainDeviations = deviations.filter(row => row.delta >= 0.01).sort((a, b) => b.delta - a.delta).slice(0, 5);
    if (mainDeviations.length) summaryRows.push([], ['Scostamenti principali rispetto agli altri periodi disponibili dello stesso anno'], ['Categoria', 'Spesa periodo', 'Media attesa', 'Scostamento'], ...mainDeviations.map(row => [row.name, row.actual, row.expected, row.delta]));
    const charts = [
      { title: 'Andamento mensile di entrate e uscite', categorySheet: 'Andamento', categoryCol: 0, firstDataRow: 2, lastDataRow: trendRows.length, series: [{ sheet: 'Andamento', col: 1, nameCol: 1 }, { sheet: 'Andamento', col: 2, nameCol: 2 }], startCol: 0, startRow: 1, endCol: 14, endRow: 18 }
    ];
    if (chartCategoryRows.length > 1) charts.push({
      title: 'Spese del periodo e media di riferimento', categorySheet: 'Dati grafico', categoryCol: 0, firstDataRow: 2, lastDataRow: chartCategoryRows.length,
      series: [{ sheet: 'Dati grafico', col: 1, nameCol: 1 }, { sheet: 'Dati grafico', col: 5, nameCol: 5 }],
      startCol: 0, startRow: 20, endCol: 14, endRow: 37
    });
    downloadXlsx(reportFilenameCode() + '.xlsx', [
      { name: 'Riepilogo', rows: summaryRows, titleRow: 0, headerRow: 6, headerRows: [14], currencyColumns: [1, 2, 3], widths: [48, 22, 32, 22], autoFilter: false },
      { name: 'Confronto', rows: flowRows, currencyColumns: [1, 2, 3, 4], widths: [14, 19, 19, 19, 19, 18] },
      { name: 'Scostamenti', rows: categoryRows, currencyColumns: [1, 2, 4, 5], percentColumns: [6], rowFontStyles: categoryFontStyles, widths: [30, 20, 20, 30, 20, 20, 18] },
      { name: 'Dati grafico', rows: chartCategoryRows, currencyColumns: [1, 2, 3, 5, 6], percentColumns: [4, 7], widths: [28, 20, 27, 20, 18, 24, 22, 22] },
      { name: 'Andamento', rows: trendRows, currencyColumns: [1, 2, 3], widths: [18, 20, 20, 20] },
      { name: 'Grafici', rows: [['GRAFICI DEL REPORT'], ['Grafici modificabili in Excel e LibreOffice.'], ['Dati di origine nei fogli Andamento e Scostamenti.']], titleRow: 0, headerRow: 0, autoFilter: false, charts: charts },
      { name: 'Movimenti', rows: txRows, currencyColumns: [4], dateColumns: [0], widths: [15, 48, 42, 36, 18, 55, 17] }
    ]);
  }
  async function exitApp() {
    try {
      await saveQueue;
    } catch (error) {
      console.error('Salvataggio finale non riuscito', error);
      window.alert('Non posso uscire in sicurezza: il salvataggio finale non è riuscito. Verifica la connessione e riprova.');
      return;
    }
    try {
      await apiRequest('/api/logout', { method: 'POST', body: '{}' });
      csrfToken = null;
      document.body.innerHTML = '<main style="font:16px Segoe UI,Arial;padding:48px;color:#1b2a2a;max-width:720px"><h1>Logout completato</h1><p>La sessione è stata chiusa e il backup è stato affidato al server Home Assistant.</p><p>Puoi chiudere subito questa finestra del browser: il backup continuerà in background anche senza la scheda aperta.</p><p>Al prossimo accesso potrai controllare l’esito nella sezione Google Drive delle Impostazioni.</p></main>';
    } catch (error) {
      console.error('Logout non confermato dal server', error);
      window.alert('Non è stato possibile confermare il logout con il server. La sessione potrebbe essere ancora attiva: verifica la connessione e riprova prima di chiudere il browser.');
    }
  }
  function deletePersonalData() {
    showConfirm('Eliminare movimenti e regole?', 'Saranno cancellati tutti i movimenti e le regole apprese dal browser. I conti resteranno. Se il backup Drive è attivo, verrà aggiornato senza la cronologia.', async () => {
      state.transactions = []; state.rules = []; state.demo = false; await saveState(); renderAll(); showNotice('Cronologia cancellata', 'Movimenti e regole apprese sono stati rimossi dall’archivio locale.');
    });
  }
  async function importBackup(event) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const loaded = parsed.state || parsed;
      if (parsed.format && parsed.format !== 'conti-chiari-local-backup') throw new Error('Formato backup non riconosciuto.');
      if (!Array.isArray(loaded.accounts) || !Array.isArray(loaded.transactions)) throw new Error('Il file selezionato non è un backup compatibile.');
      if (loaded.accounts.length > 10000 || loaded.transactions.length > 250000) throw new Error('Il backup supera i limiti consentiti.');
      showConfirm('Ripristinare questo backup?', `Saranno caricati ${loaded.accounts.length} conti e ${loaded.transactions.length} movimenti, sostituendo l’archivio centralizzato. Prima di continuare, assicurati di avere esportato una copia dei dati correnti.`, async () => {
        const result = await apiRequest('/api/import', { method: 'POST', body: JSON.stringify({ format: 'conti-chiari-local-backup', state: loaded, attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [], revision: stateRevision }) });
        stateRevision = result.revision;
        state = loaded; normalizeState(); renderAll();
        showNotice('Backup ripristinato', `Importati ${result.accounts} conti e ${result.transactions} movimenti nel database centrale.`);
      });
    } catch (error) { showNotice('Backup non valido', error.message || 'Non riesco a leggere il backup.'); }
    event.target.value = '';
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function showNotice(title, text) {
    $('#noticeTitle').textContent = title; $('#noticeText').textContent = text; $('#noticeModal').classList.remove('hidden');
  }
  function showConfirm(title, text, callback) {
    $('#confirmTitle').textContent = title; $('#confirmText').textContent = text; confirmCallback = callback; $('#confirmModal').classList.remove('hidden');
  }
  function showDuplicateChoice(title,text,callback){
    $('#confirmTitle').textContent=title;$('#confirmText').textContent=text;confirmCallback=callback;
    $('#confirmAction').textContent='Inserisci comunque';$('#confirmExclude')?.classList.remove('hidden');$('#confirmModal').classList.remove('hidden');
  }
  function closeModals() { $$('.modal-backdrop').forEach(m => m.classList.add('hidden')); confirmCallback = null; $('#confirmExclude')?.classList.add('hidden'); if($('#confirmAction')) $('#confirmAction').textContent='Continua'; }

  initialize();
})();
