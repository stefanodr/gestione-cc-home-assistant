(() => {
  'use strict';

  const APP_VERSION = '1.6';
  const DB_NAME = 'ContiChiariPrototype';
  const DB_VERSION = 1;
  const DB_STORE = 'app';
  let csrfToken = '';
  let stateRevision = 0;
  let saveQueue = Promise.resolve();
  let state;
  let reportMode = 'monthly';
  let transactionPage = 0;
  let confirmCallback = null;
  let resizeTimer;

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, useGrouping: true });
  const shortEuro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: true });

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
      if (sessionAt) sessionAt.textContent = result.last_session_backup || 'Non ancora eseguito';
      if (nightlyAt) nightlyAt.textContent = result.last_nightly_backup || 'Non ancora eseguito';
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
    if (versionLabel) versionLabel.textContent = 'Gestione C/C · app ' + APP_VERSION + ' · add-on 1.0.5';
    const currentMonth = localDateKey(new Date()).slice(0, 7);
    const storedMonth = String(state.selectedMonth || '');
    const selectedMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(storedMonth) ? storedMonth : currentMonth;
    if (state.selectedMonth !== selectedMonth) { state.selectedMonth = selectedMonth; needsSave = true; }
    $('#monthPicker').value = selectedMonth;
    syncReportPeriodPicker(selectedMonth);
    if (needsSave) await saveState();
    $('#statementMonth').value = selectedMonth;
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
    if (!Array.isArray(state.recurringRules)) { state.recurringRules = []; changed = true; }
    if (!Array.isArray(state.savedFilters)) { state.savedFilters = []; changed = true; }
    if (!Array.isArray(state.importProfiles)) { state.importProfiles = []; changed = true; }
    if (!state.forecastSettings || typeof state.forecastSettings !== 'object' || Array.isArray(state.forecastSettings)) {
      state.forecastSettings = { horizonMonths: 12, accountIds: [] };
      changed = true;
    } else {
      if (state.forecastSettings.horizonMonths !== 12) { state.forecastSettings.horizonMonths = 12; changed = true; }
      if (!Array.isArray(state.forecastSettings.accountIds)) { state.forecastSettings.accountIds = []; changed = true; }
    }
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
    $$('[data-goto]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.goto)));
    $('#monthPicker').addEventListener('change', () => { state.selectedMonth = $('#monthPicker').value; syncReportPeriodPicker(state.selectedMonth); $('#statementMonth').value = state.selectedMonth; saveState(); renderAll(); });
    $('#reportMonth').addEventListener('change', () => { state.selectedMonth = overviewMonthForReportPeriod($('#reportMonth').value, reportMode); $('#monthPicker').value = state.selectedMonth; $('#statementMonth').value = state.selectedMonth; saveState(); renderAll(); });
    $('#monthPrev')?.addEventListener('click', () => moveSelectedPeriod(-1, 'overview'));
    $('#monthNext')?.addEventListener('click', () => moveSelectedPeriod(1, 'overview'));
    $('#reportPeriodPrev')?.addEventListener('click', () => moveSelectedPeriod(-1, 'report'));
    $('#reportPeriodNext')?.addEventListener('click', () => moveSelectedPeriod(1, 'report'));
    $('#accountPicker').addEventListener('change', () => { state.reportAccountId = $('#accountPicker').value; $('#reportAccountPicker').value = state.reportAccountId; saveState(); renderAll(); });
    $('#reportAccountPicker').addEventListener('change', () => { state.reportAccountId = $('#reportAccountPicker').value; $('#accountPicker').value = state.reportAccountId; saveState(); renderAll(); });
    $('#transactionFilter').addEventListener('change', () => { transactionPage = 0; renderTransactions(); });
    $('#transactionPrev').addEventListener('click', () => { transactionPage = Math.max(0, transactionPage - 1); renderTransactions(); });
    $('#transactionNext').addEventListener('click', () => { transactionPage++; renderTransactions(); });
    $('#addManualTransaction')?.addEventListener('click', openManualTransaction);
    $('#closeManualTransaction')?.addEventListener('click', closeManualTransaction);
    $('#cancelManualTransaction')?.addEventListener('click', closeManualTransaction);
    $('#manualBankAccount')?.addEventListener('change', populateManualCounterAccounts);
    $('#saveManualTransaction')?.addEventListener('click', saveManualTransaction);
    $('#reportPeriodMode')?.addEventListener('change', event => { reportMode = event.target.value || 'monthly'; const next = syncReportPeriodPicker(state.selectedMonth); state.selectedMonth = overviewMonthForReportPeriod(next); $('#monthPicker').value = state.selectedMonth; $('#statementMonth').value = state.selectedMonth; state.reportMode = reportMode; saveState(); renderAll(); });
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
    $('#addAccount').addEventListener('click', addAccount);
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
    $('#statementMonth').value = state.selectedMonth;
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
    const account = get('searchAccount')?.value || 'all';
    return { text, from, to, min, max, direction, status, account };
  }
  function renderSavedFilters() {
    const picker = $('#savedFilterPicker'); if (!picker) return;
    const current = picker.value;
    picker.innerHTML = '<option value="">Filtri salvati…</option>' + state.savedFilters.map(f => '<option value="' + safeText(f.id) + '">' + safeText(f.name) + '</option>').join('');
    if (state.savedFilters.some(f => f.id === current)) picker.value = current;
  }
  function runAdvancedSearch() {
    const f = searchControls();
    const results = state.transactions.filter(tx => {
      const date = String(tx.date || '');
      const amount = Math.abs(Number(tx.amount) || 0);
      const haystack = [transactionDescription(tx), transactionCausale(tx), tx.payee, tx.memo].join(' ').toLocaleLowerCase('it');
      if (f.from && date < f.from || f.to && date > f.to) return false;
      if (f.text && !haystack.includes(f.text)) return false;
      if (f.min !== null && Number.isFinite(f.min) && amount < f.min) return false;
      if (f.max !== null && Number.isFinite(f.max) && amount > f.max) return false;
      if (f.direction === 'income' && Number(tx.amount) <= 0 || f.direction === 'expense' && Number(tx.amount) >= 0) return false;
      if (f.status !== 'all' && tx.status !== f.status) return false;
      if (f.account !== 'all' && tx.bankAccountId !== f.account && tx.counterpartAccountId !== f.account) return false;
      return true;
    }).sort((a,b) => String(b.date).localeCompare(String(a.date)));
    $('#searchResultCount').textContent = results.length + ' movimenti trovati';
    $('#advancedSearchBody').innerHTML = results.slice(0,1000).map(tx => '<tr><td>' + safeText(formatDate(tx.date)) + '</td><td class="name-cell">' + safeText(transactionDescription(tx) || transactionCausale(tx) || 'Movimento') + '</td><td class="' + (Number(tx.amount)>=0?'amount-in':'amount-out') + '">' + euro.format(Number(tx.amount)||0) + '</td><td>' + safeText(accountLabel(tx.bankAccountId)) + '</td><td>' + safeText(accountLabel(tx.counterpartAccountId)) + '</td><td>' + (tx.status === 'confirmed' ? 'Confermato' : 'Da classificare') + '</td></tr>').join('') || '<tr><td colspan="6" class="empty-inline">Nessun movimento corrisponde ai filtri.</td></tr>';
    if (results.length > 1000) $('#searchResultCount').textContent += ' · mostrati i primi 1.000';
  }
  function setupFinanceViews() {
    if (setupFinanceViews.listenersBound) { renderBudgetView(); renderForecastSelection(); return; }
    setupFinanceViews.listenersBound = true;
    const account = $('#searchAccount');
    if (account) {
      const old = account.value;
      account.innerHTML = '<option value="all">Tutti i conti</option>' + state.accounts.filter(a=>a.type!=='ROOT').map(a=>'<option value="' + safeText(a.id) + '">' + safeText(a.path) + '</option>').join('');
      if ([...account.options].some(o=>o.value===old)) account.value=old;
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
      forecast.innerHTML = eligible.map(a=>'<label style="display:flex;gap:9px;align-items:center;margin:9px 0"><input type="checkbox" data-forecast-account="' + safeText(a.id) + '" ' + (all || ids.includes(a.id) ? 'checked' : '') + '> ' + safeText(a.path) + '</label>').join('') || '<p class="panel-subtitle">Nessun conto liquido riconosciuto nel piano dei conti.</p>';
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
    $('#clearAdvancedSearch')?.addEventListener('click',()=>{
      ['searchFrom','searchTo','searchText','searchMin','searchMax'].forEach(id=>$('#'+id).value='');
      $('#searchDirection').value='all';$('#searchStatus').value='all';$('#searchAccount').value='all';runAdvancedSearch();
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
      $('#searchDirection').value=c.direction||'all';$('#searchStatus').value=c.status||'all';$('#searchAccount').value=c.account||'all';runAdvancedSearch();
    });
    $('#budgetMonth')?.addEventListener('change',renderBudgetView);
    renderBudgetView();
    $('#addRecurringRule')?.addEventListener('click',addRecurringRule);
    if ($('#recStart') && !$('#recStart').value) $('#recStart').value=localDateKey(new Date());
    renderForecastSelection();
  }
  function renderBudgetView() {
    const body=$('#budgetBody');if(!body)return;
    const month=$('#budgetMonth')?.value||localDateKey(new Date()).slice(0,7);
    const categories=state.accounts.filter(a=>a.type==='EXPENSE').sort((a,b)=>a.path.localeCompare(b.path,'it'));
    const totals=new Map();
    for(const tx of state.transactions){
      if(tx.status!=='confirmed'||String(tx.date||'').slice(0,7)!==month)continue;
      const splits=Array.isArray(tx.counterpartSplits)&&tx.counterpartSplits.length?tx.counterpartSplits:null;
      if(splits){for(const split of splits){const a=accountById(split.accountId);if(a?.type==='EXPENSE')totals.set(a.id,(totals.get(a.id)||0)+Math.abs(Number(split.value)||0));}}
      else {const a=accountById(tx.counterpartAccountId);if(a?.type==='EXPENSE')totals.set(a.id,(totals.get(a.id)||0)+Math.abs(Number(tx.amount)||0));}
    }
    body.innerHTML=categories.map(a=>{
      const budget=Number(state.budgets.find(x=>x.accountId===a.id)?.amount)||0,spent=totals.get(a.id)||0,remaining=budget-spent,pct=budget>0?spent/budget*100:0;
      return '<tr><td class="name-primary">'+safeText(a.path)+'</td><td><input type="number" min="0" step="0.01" data-budget-account="'+safeText(a.id)+'" value="'+(budget||'')+'" placeholder="Non impostato" style="width:130px;padding:7px;border:1px solid #dce5e2;border-radius:6px"></td><td>'+euro.format(spent)+'</td><td class="'+(remaining<0?'amount-out':'amount-in')+'">'+(budget?euro.format(remaining):'—')+'</td><td>'+(budget?Math.round(pct)+'%':'—')+'</td></tr>';
    }).join('')||'<tr><td colspan="5" class="empty-inline">Nessuna categoria di spesa nel piano dei conti.</td></tr>';
    body.querySelectorAll('[data-budget-account]').forEach(input=>input.addEventListener('change',()=>{
      const id=input.dataset.budgetAccount,amount=Math.max(0,Number(input.value)||0);
      const existing=state.budgets.find(x=>x.accountId===id);
      if(existing)existing.amount=amount;else state.budgets.push({accountId:id,amount});
      saveState();renderBudgetView();
    }));
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
    const start=String(rule.startDate||'');
    const end=String(rule.endDate||'');
    const date=monthOccurrence(rule,key);
    if(date<start || (end && date>end))return false;
    if(rule.frequency==='monthly')return true;
    const [sy,sm,sd]=start.split('-').map(Number);
    const [y,m]=key.split('-').map(Number);
    if(rule.frequency==='yearly')return sm===m;
    if(rule.frequency==='weekly'){
      const startDate=new Date(sy,sm-1,sd), target=new Date(y,m-1,Number(rule.day)||1);
      return Math.floor((target-startDate)/86400000)>=0 && Math.floor((target-startDate)/86400000)%7===0;
    }
    return false;
  }
  function recurringAlreadyRealized(rule,key) {
    const target=normalize(rule.description);
    const tolerance=Math.max(1,Math.abs(Number(rule.amount)||0)*0.05);
    return state.transactions.some(tx=>tx.status==='confirmed'&&String(tx.date||'').slice(0,7)===key&&tx.bankAccountId===rule.bankAccountId&&Math.abs(Math.abs(Number(tx.amount)||0)-Math.abs(Number(rule.amount)||0))<=tolerance&&target&&normalize(transactionDescription(tx))===target);
  }
  function forecastRecurringItems(key,selectedIds) {
    return state.recurringRules.filter(r=>r.active && selectedIds.has(r.bankAccountId) && recurringOccursInMonth(r,key) && !recurringAlreadyRealized(r,key));
  }
  function forecastTransactionFlow(tx,selectedIds) {
    if(tx.status!=='confirmed'||tx.status==='duplicate'||!selectedIds.has(tx.bankAccountId))return 0;
    let flow=Number(tx.amount)||0;
    // A split assigned to another selected liquid account is an internal transfer:
    // remove that portion from the external cash flow.
    if(Array.isArray(tx.counterpartSplits)&&tx.counterpartSplits.length){
      for(const split of tx.counterpartSplits){
        if(selectedIds.has(split.accountId) && isLiquidAccount(accountById(split.accountId)))flow+=Number(split.value)||0;
      }
    } else if(selectedIds.has(tx.counterpartAccountId) && isLiquidAccount(accountById(tx.counterpartAccountId))) {
      flow=0;
    }
    return flow;
  }
  function median(values) {
    if(!values.length)return 0;
    const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);
    return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
  }
  function renderRecurringRules() {
    const body=$('#recurringBody');if(!body)return;
    const labels={monthly:'Mensile',weekly:'Settimanale',yearly:'Annuale'};
    body.innerHTML=state.recurringRules.map(r=>'<tr><td>'+safeText(r.description)+'</td><td>'+euro.format(r.amount)+'</td><td>'+labels[r.frequency]+'</td><td>'+safeText(r.startDate)+'</td><td>'+(r.active?'Attiva':'Sospesa')+'</td><td><button class="row-action" data-toggle-rec="'+safeText(r.id)+'">'+(r.active?'Sospendi':'Attiva')+'</button> <button class="row-action row-action-danger" data-delete-rec="'+safeText(r.id)+'">Elimina</button></td></tr>').join('')||'<tr><td colspan="6" class="empty-inline">Nessuna ricorrenza configurata.</td></tr>';
    body.querySelectorAll('[data-toggle-rec]').forEach(b=>b.addEventListener('click',()=>{const r=state.recurringRules.find(x=>x.id===b.dataset.toggleRec);if(r)r.active=!r.active;saveState();renderForecastSelection();}));
    body.querySelectorAll('[data-delete-rec]').forEach(b=>b.addEventListener('click',()=>{state.recurringRules=state.recurringRules.filter(x=>x.id!==b.dataset.deleteRec);saveState();renderForecastSelection();}));
  }
  function addRecurringRule() {
    const description=$('#recDescription').value.trim(),amount=Number($('#recAmount').value),bankAccountId=$('#recBankAccount').value,categoryId=$('#recCategory').value;
    const frequency=$('#recFrequency').value,day=Math.min(31,Math.max(1,Number($('#recDay').value)||1)),startDate=$('#recStart').value,endDate=$('#recEnd').value;
    if(!description||!Number.isFinite(amount)||amount===0||!bankAccountId||!startDate){showNotice('Dati incompleti','Inserisci descrizione, importo diverso da zero, conto e prima occorrenza.');return;}
    if(endDate&&endDate<startDate){showNotice('Date non valide','L’ultima occorrenza non può precedere la prima.');return;}
    state.recurringRules.push({id:uid('r'),description,amount,bankAccountId,categoryId:categoryId||null,frequency,day,startDate,endDate:endDate||null,active:true,createdAt:new Date().toISOString()});
    saveState();['recDescription','recAmount','recEnd'].forEach(id=>$('#'+id).value='');renderForecastSelection();
  }
  function buildForecast() {
    const accounts=forecastSelectedAccounts(),ids=new Set(accounts.map(a=>a.id)),today=localDateKey(new Date()),currentMonth=today.slice(0,7);
    const txs=state.transactions.filter(t=>t.status==='confirmed'&&t.date<=today&&t.status!=='duplicate'&&ids.has(t.bankAccountId));
    const primaryAccountId=state.bankAccountId;
    const opening=ids.has(primaryAccountId)?(Number(state.openingBalance)||0):0;
    const currentBalance=opening+txs.reduce((sum,tx)=>sum+forecastTransactionFlow(tx,ids),0);
    const historyKeys=Array.from({length:12},(_,i)=>shiftMonthKey(currentMonth,-12+i));
    const recurringCategoryIds=new Set(state.recurringRules.filter(r=>r.active&&ids.has(r.bankAccountId)&&r.categoryId).map(r=>r.categoryId));
    const categories=state.accounts.filter(a=>['INCOME','EXPENSE'].includes(a.type));
    const estimates=new Map();
    for(const cat of categories){
      if(recurringCategoryIds.has(cat.id))continue;
      const monthly=historyKeys.map(key=>{
        let total=0;
        for(const tx of txs){
          if(String(tx.date).slice(0,7)!==key)continue;
          if(tx.counterpartSplits?.length){
            for(const sp of tx.counterpartSplits)if(sp.accountId===cat.id)total+=Math.abs(Number(sp.value)||0)*(cat.type==='INCOME'?1:-1);
          }else if(tx.counterpartAccountId===cat.id)total+=Math.abs(Number(tx.amount)||0)*(cat.type==='INCOME'?1:-1);
        }
        return total;
      });
      estimates.set(cat.id,median(monthly));
    }
    const estimatedNet=[...estimates.values()].reduce((a,b)=>a+b,0);
    const forecast=[];
    let balance=currentBalance;
    for(let i=0;i<12;i++){
      const key=shiftMonthKey(currentMonth,i),rules=forecastRecurringItems(key,ids);
      const programmed=rules.reduce((sum,r)=>sum+Number(r.amount||0),0);
      const estimate=i===0?0:estimatedNet;
      balance+=programmed+estimate;
      forecast.push({key,programmed,estimate,balance});
    }
    const minimum=forecast.reduce((a,b)=>b.balance<a.balance?b:a,forecast[0]||{balance:currentBalance,key:currentMonth});
    return {accounts,currentBalance,forecast,minimum,historyCount:historyKeys.filter(k=>txs.some(t=>String(t.date).slice(0,7)===k)).length,estimatedNet};
  }
  function renderForecastSelection() {
    const ids=Array.isArray(state.forecastSettings?.accountIds)?state.forecastSettings.accountIds:[];
    const count=forecastSelectedAccounts().length;
    const status=$('#forecastStatus');if(status)status.textContent='Conti inclusi: '+count+'. Selezione vuota = tutti i conti liquidi.';
    const liquid=state.accounts.filter(isLiquidAccount);
    const bank=$('#recBankAccount'),category=$('#recCategory');
    if(bank){const prior=bank.value;bank.innerHTML=liquid.map(a=>'<option value="'+safeText(a.id)+'">'+safeText(a.path)+'</option>').join('');if(liquid.some(a=>a.id===prior))bank.value=prior;}
    if(category){const prior=category.value;category.innerHTML='<option value="">Senza categoria</option>'+state.accounts.filter(a=>['INCOME','EXPENSE'].includes(a.type)).map(a=>'<option value="'+safeText(a.id)+'">'+safeText(a.path)+'</option>').join('');if([...category.options].some(o=>o.value===prior))category.value=prior;}
    renderRecurringRules();
    const result=buildForecast();
    $('#forecastOpening').textContent=euro.format(result.currentBalance);
    $('#forecastMinimum').textContent=euro.format(result.minimum.balance);
    $('#forecastMinimumMonth').textContent=monthLabel(result.minimum.key);
    $('#forecastEnding').textContent=euro.format(result.forecast.at(-1)?.balance??result.currentBalance);
    $('#forecastReliability').textContent='Storico disponibile: '+result.historyCount+' mesi · stima indicativa';
    $('#forecastBody').innerHTML=result.forecast.map(row=>'<tr><td>'+safeText(monthLabel(row.key))+'</td><td>'+euro.format(row.programmed)+'</td><td>'+euro.format(row.estimate)+'</td><td class="'+(row.balance>=0?'amount-in':'amount-out')+'">'+euro.format(row.balance)+'</td></tr>').join('');
  }

  function navigate(view) {
    $$('.content-view').forEach(section => section.classList.toggle('active', section.id === `view-${view}`));
    $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));
    const names = { overview: 'Panoramica', transactions: 'Movimenti', search: 'Ricerca avanzata', budget: 'Budget', forecast: 'Previsioni', reports: 'Report', accounts: 'Piano dei conti', rules: 'Regole apprese', settings: 'Impostazioni' };
    $('#currentSection').textContent = names[view] || 'Panoramica';
    renderAll();
    if (view === 'reports') requestAnimationFrame(drawReportChart);
  }
  function accountById(id) { return state.accounts.find(a => a.id === id); }
  function accountLabel(id) { return accountById(id)?.path || 'Da classificare'; }
  function renderAccountFilters() {
    const eligible = state.accounts.filter(isLiquidAccount);
    const options = `<option value="all">Tutti i conti liquidi</option>${eligible.map(a => `<option value="${safeText(a.id)}">${safeText(a.path)}</option>`).join('')}`;
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
    if (['BANK', 'CASH', 'CREDIT'].includes(String(account.type || '').toUpperCase())) return true;
    // Some GnuCash books classify named current-account subaccounts as ASSET.
    // Recognize this common hierarchy so they are not silently omitted.
    return String(account.type || '').toUpperCase() === 'ASSET' && normalize(account.path || '').includes('attivita correnti');
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
    body.innerHTML = comparisons.map((item, i) => `<tr class="${i === 0 ? 'current-year' : ''}"><td>${item.year}${i === 0 ? ' · periodo scelto' : ''}</td><td>${shortEuro.format(item.data.income)}</td><td>${shortEuro.format(item.data.expense)}</td><td class="${item.data.net >= 0 ? 'amount-in' : 'amount-out'}">${shortEuro.format(item.data.net)}</td></tr>`).join('');
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

  function renderTransactions() {
    refreshAccountSearchOptions();
    const filter = $('#transactionFilter')?.value || 'all';
    let tx = [...state.transactions].sort((a, b) => parseDate(b.date).localeCompare(parseDate(a.date)));
    if (filter === 'pending') tx = tx.filter(t => t.status === 'pending');
    if (filter === 'confirmed') tx = tx.filter(t => t.status === 'confirmed');
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
      const causaleRow = description && causale ? `<span class="name-secondary transaction-causale"><strong>Causale:</strong> ${safeText(causale)}</span>` : '';
      const isSplit = Array.isArray(item.counterpartSplits) && item.counterpartSplits.length > 1;
      const accountCell = isSplit
        ? '<span class="account-type">Ripartito</span>'
        : item.status === 'confirmed'
          ? `<span class="name-secondary">${safeText(accountLabel(item.counterpartAccountId))}</span>`
          : `<input class="account-select account-search" type="text" list="accountSearchOptions" data-tx="${safeText(item.id)}" value="${suggested ? safeText(accountLabel(suggested)) : ''}" placeholder="Cerca conto…" autocomplete="off" aria-label="Cerca conto di contropartita">`;
      const conf = item.status === 'confirmed' ? 1 : (item.confidence || 0.1);
      const confidenceClass = conf >= .8 ? 'high' : conf >= .5 ? 'medium' : 'low';
      const confidenceLabel = item.status === 'confirmed' ? 'Confermata' : conf >= .8 ? 'Alta' : conf >= .5 ? 'Media' : 'Bassa';
      const actions = isSplit
        ? `<button class="row-action row-action-split" data-split-tx="${safeText(item.id)}">Modifica riparto</button>`
        : item.status === 'confirmed'
          ? `<button class="row-action row-action-review" data-edit-tx="${safeText(item.id)}">Rivedi</button> <button class="row-action row-action-split" data-split-tx="${safeText(item.id)}">Ripartisci</button>`
          : `<button class="row-action row-action-split" data-split-tx="${safeText(item.id)}">Dividi</button> <button class="row-action row-action-review" data-confirm-tx="${safeText(item.id)}">Conferma</button>`;
      return `<tr><td class="date-cell">${formatDate(item.date)}</td><td class="name-cell"><span class="name-primary"><strong>${primaryLabel}</strong>${safeText(primaryText)}</span>${causaleRow}</td><td class="amount-cell ${item.amount >= 0 ? 'amount-in' : 'amount-out'}">${euro.format(item.amount)}</td><td><span class="name-secondary">${safeText(accountLabel(item.bankAccountId))}</span></td><td>${accountCell}</td><td><span class="confidence ${confidenceClass}">${confidenceLabel}</span></td><td><span class="status-chip ${item.counterpartSplits?.length > 1 ? 'status-confirmed' : item.status === 'confirmed' ? 'status-confirmed' : 'status-pending'}">${item.counterpartSplits?.length > 1 ? 'Suddiviso' : item.status === 'confirmed' ? 'Confermato' : 'Da rivedere'}</span></td><td>${actions} <button class="row-action row-action-danger" data-delete-tx="${safeText(item.id)}">Elimina</button></td></tr>`;
    }).join('');
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
      transactionPage = Math.min(transactionPage, Math.max(0, Math.ceil(state.transactions.length / pageSize) - 1));
      await saveState(); renderAll();
      showNotice('Movimento eliminato', 'È stato rimosso dall’archivio locale di Gestione C/C. Il file GnuCash o bancario originale non è stato modificato.');
    }));
  }
  function refreshAccountSearchOptions() {
    const list = $('#accountSearchOptions'); if (!list || !state) return;
    const accounts = state.accounts.filter(a => !['ROOT', 'TRADING'].includes(a.type)).sort((a, b) => a.path.localeCompare(b.path, 'it', { sensitivity: 'base' }));
    list.innerHTML = accounts.map(a => `<option value="${safeText(a.path)}"></option>`).join('');
  }
  function openManualTransaction() {
    const banks = state.accounts.filter(isLiquidAccount).sort((a, b) => a.path.localeCompare(b.path, 'it'));
    $('#manualBankAccount').innerHTML = banks.map(a => `<option value="${safeText(a.id)}">${safeText(a.path)}</option>`).join('');
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
    $('.split-account-search, .split-amount', $('#splitRows')).forEach(input => input.addEventListener('input', updateSplitTotals));
    $('.split-amount', $('#splitRows')).forEach(input => {
      input.addEventListener('focus', () => ungroupAmountField(input));
      input.addEventListener('blur', () => groupAmountField(input));
    });
    $('.split-remove', $('#splitRows')).forEach(button => button.addEventListener('click', () => { button.closest('.split-row').remove(); updateSplitTotals(); }));
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
    const n = normalize(label);
    return state.accounts.find(a => normalize(a.path) === n || normalize(a.name) === n || normalize(a.path.replace(/:/g, ' ')) === n);
  }

  function renderReports() {
    const comparisons = selectedComparisons();
    const current = comparisons[0].data;
    $('#reportIncome').textContent = euro.format(current.income);
    $('#reportExpense').textContent = euro.format(current.expense);
    $('#reportNet').textContent = euro.format(current.net);
    $('#reportNet').className = current.net >= 0 ? 'amount-in' : 'amount-out';
    $('#reportTransfers').textContent = euro.format(current.transfers);
    $('#reportNameCode').textContent = `Nome del report: ${reportFilenameCode()}`;
    renderComparisonTable('#reportComparisonBody', comparisons);
    const periodNotes = { monthly: 'Confronto con lo stesso mese dei tre anni precedenti.', quarterly: 'Confronto con lo stesso trimestre dei tre anni precedenti.', halfyearly: 'Confronto con lo stesso semestre dei tre anni precedenti.', annual: 'Confronto con gli stessi mesi degli anni precedenti.' };
    const periodNote = periodNotes[reportMode] || periodNotes.monthly;
    const accountNote = state.reportAccountId === 'all' ? 'Tutti i conti liquidi' : accountLabel(state.reportAccountId);
    const transactionCount = comparisons[0].tx.length;
    const txNote = transactionCount ? `${transactionCount} movimenti nel periodo.` : 'Nessun movimento nel periodo selezionato: prova un altro mese o Tutti i conti liquidi.';
    $('#reportComparisonNote').textContent = `${periodNote} Conto: ${accountNote}. ${txNote}`;
    renderCategoryComparison(comparisons);
    renderReportAssessment(comparisons);
  }
  function economicExpenseTotals(transactions) {
    const totals = new Map();
    for (const tx of transactions) {
      if (tx.counterpartSplits?.length) {
        for (const split of tx.counterpartSplits) {
          const account = accountById(split.accountId);
          if (account?.type === 'EXPENSE') totals.set(account.id, (totals.get(account.id) || 0) + Math.abs(Number(split.value) || 0));
        }
      } else {
        const account = accountById(tx.counterpartAccountId);
        if (account?.type === 'EXPENSE') totals.set(account.id, (totals.get(account.id) || 0) + Math.abs(tx.amount));
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
  function renderCategoryComparison(comparisons) {
    const rows = reportDeviationRows(comparisons);
    $('#deviationBaselineNote').textContent = reportMode === 'monthly' && Number(monthSelection().slice(5, 7)) <= 2 ? 'Per gennaio e febbraio il riferimento è lo stesso mese dell’anno precedente. Da marzo, gli scostamenti sono calcolati sugli altri mesi completi disponibili dello stesso anno. Il confronto annuo resta solo informativo.' : 'Gli scostamenti sono calcolati rispetto alla media degli altri periodi completi disponibili dello stesso anno. Il confronto con l’anno precedente resta separato e non genera segnalazioni.';
    $('#categoryCompareBody').innerHTML = rows.length ? rows.map(row => `<tr><td class="name-primary">${safeText(row.name)}</td><td>${shortEuro.format(row.actual)}</td><td>${shortEuro.format(row.previousYear)}</td><td class="${row.yearDelta < 0 ? 'delta-negative' : 'delta-positive'}">${row.yearDelta >= 0 ? '+' : '−'}${shortEuro.format(Math.abs(row.yearDelta))} (${row.yearPercent === null ? 'n.d.' : `${row.yearPercent > 0 ? '+' : ''}${row.yearPercent.toFixed(1).replace('.', ',')}%`})</td><td>${shortEuro.format(row.expected)}</td><td class="${row.delta < 0 ? 'delta-negative' : 'delta-positive'}">${row.delta >= 0 ? '+' : '−'}${shortEuro.format(Math.abs(row.delta))}</td><td class="${row.delta < 0 ? 'delta-negative' : 'delta-positive'}">${row.percent === null ? 'n.d.' : `${row.percent > 0 ? '+' : ''}${row.percent.toFixed(1).replace('.', ',')}%`}</td></tr>`).join('') : '<tr><td colspan="7" class="empty-inline">Nessuno scostamento calcolabile nel periodo.</td></tr>';
  }

  function renderAccounts() {
    const accounts = state.accounts.filter(a => a.type !== 'ROOT').sort((a, b) => a.path.localeCompare(b.path, 'it'));
    const counts = { Patrimoniale: 0, Economica: 0, Tecnica: 0 };
    accounts.forEach(a => { if (counts[a.classification] !== undefined) counts[a.classification]++; });
    $('#accountSummary').innerHTML = Object.entries(counts).map(([label, count]) => `<div class="account-summary-card"><span>Conti ${label.toLowerCase()}</span><strong>${count}</strong></div>`).join('');
    $('#accountsBody').innerHTML = accounts.map(a => {
      const txCount = state.transactions.filter(t => t.counterpartAccountId === a.id || t.bankAccountId === a.id).length;
      const cls = a.classification === 'Economica' ? 'class-economic' : a.classification === 'Patrimoniale' ? 'class-balance' : a.classification === 'Tecnica' ? 'class-technical' : 'class-structural';
      return `<tr><td class="name-primary account-path-cell" title="${safeText(a.path)}">${safeText(a.path)}</td><td><span class="account-type">${safeText(a.type || '—')}</span></td><td><span class="account-class ${cls}">${safeText(a.classification || 'Da verificare')}</span></td><td>${txCount}</td></tr>`;
    }).join('');
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
  async function addAccount() {
    const name = window.prompt('Nome del nuovo conto (es. Uscite:Abbonamenti):');
    if (!name?.trim()) return;
    const parentGuess = state.accounts.find(a => a.path === name.trim().split(':').slice(0, -1).join(':'));
    const chooseEconomic = window.confirm('Questo conto è economico (entrata o spesa)?\nScegli “Annulla” per inserirlo come patrimoniale.');
    const type = chooseEconomic ? window.confirm('È un conto di spesa?\nSì = Uscita. No = Entrata.') ? 'EXPENSE' : 'INCOME' : 'ASSET';
    const cleanName = name.trim().split(':').pop();
    const account = { id: uid('a'), name: cleanName, path: name.trim(), type, classification: classifyType(type), parentId: parentGuess?.id || 'root' };
    state.accounts.push(account); await saveState(); renderAll();
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
          if(latest){state.selectedMonth=latest.slice(0,7);$('#monthPicker').value=state.selectedMonth;syncReportPeriodPicker(state.selectedMonth);$('#statementMonth').value=state.selectedMonth;}
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
        const byPath=new Map(state.accounts.map(ac=>[ac.path,ac]));const idMap=new Map();
        parsed.accounts.forEach(ac=>{if(ac.type==='ROOT'){idMap.set(ac.id,state.accounts.find(x=>x.type==='ROOT')?.id||'root');return;}const old=byPath.get(ac.path);idMap.set(ac.id,old?old.id:uid('a'));});
        const additions=parsed.accounts.filter(ac=>ac.type!=='ROOT'&&!byPath.has(ac.path)).map(ac=>({...ac,id:idMap.get(ac.id),parentId:idMap.get(ac.parentId)||'root'}));state.accounts.push(...additions);
        const keys=new Set(state.transactions.filter(tx=>tx.status!=='duplicate').map(transactionFingerprint));const seen=new Set();
        const chosen=parsed.transactions.filter(tx=>{const key=transactionFingerprint(tx);const duplicate=keys.has(key)||seen.has(key);seen.add(key);return include||!duplicate;});
        const imported=chosen.map(tx=>({...tx,id:uid('g'),bankAccountId:idMap.get(tx.bankAccountId)||tx.bankAccountId,counterpartAccountId:idMap.get(tx.counterpartAccountId)||tx.counterpartAccountId,counterpartSplits:(tx.counterpartSplits||[]).map(sp=>({...sp,accountId:idMap.get(sp.accountId)||sp.accountId})),duplicateOverride:keys.has(transactionFingerprint(tx))}));
        state.transactions.push(...imported);const ruleKeys=new Set(state.rules.map(r=>[r.field,r.token,r.accountId].join('|')));
        parsed.rules.forEach(rule=>{const accountId=idMap.get(rule.accountId)||rule.accountId;const key=[rule.field,rule.token,accountId].join('|');if(!ruleKeys.has(key)){state.rules.push({...rule,id:uid('r'),accountId});ruleKeys.add(key);}});
        state.demo=false;state.bankAccountId=parsed.bankAccountId?(idMap.get(parsed.bankAccountId)||state.bankAccountId):state.bankAccountId;state.reportAccountId='all';state.reportAccountDefaultMigrated=true;
        const dates=imported.map(tx=>parseDate(tx.date)).filter(Boolean).sort();if(dates.length)state.selectedMonth=dates.at(-1).slice(0,7);
        const saved=await saveState();transactionPage=0;if(dates.length){const m=dates.at(-1).slice(0,7);$('#monthPicker').value=m;syncReportPeriodPicker(m);$('#statementMonth').value=m;}renderAll();navigate('transactions');showNotice(saved?'Libro GnuCash importato':'Importazione non salvata',additions.length+' conti aggiunti; '+imported.length+' movimenti importati. '+(duplicateCount?(include?duplicateCount+' duplicati inseriti comunque.':duplicateCount+' duplicati esclusi.'):'')+' I dati esistenti sono stati conservati.');
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
  function reportDeviationRows(comparisons = selectedComparisons()) {
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
          if (m < start || m > periodEnd) referenceMonths.push(m);
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
      return { id, name: accountLabel(id).replace(/^.*:/, ''), actual, previousYear, yearDelta, yearPercent: previousYear > 0.005 ? yearDelta / previousYear * 100 : null, expected, delta, percent: expected > 0.005 ? delta / expected * 100 : null };
    }).filter(row => baselinePeriods > 0 && Math.abs(row.delta) >= 0.01)
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
      zip.folder('xl').file('styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="€ #,##0.00;[Red]-€ #,##0.00;€ 0.00"/><numFmt numFmtId="165" formatCode="0.0%;[Red]-0.0%"/></numFmts><fonts count="4"><font><sz val="11"/><color rgb="FF243431"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF173E39"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF174B43"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF176E66"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF3F0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFDCE5E2"/></left><right style="thin"><color rgb="FFDCE5E2"/></right><top style="thin"><color rgb="FFDCE5E2"/></top><bottom style="thin"><color rgb="FFDCE5E2"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="11"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="14" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
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
    const monthKey = $('#statementMonth').value || monthSelection();
    const transactions = exportPeriodTransactions(monthKey);
    return { monthKey, transactions, totals: cashFlowTotals(transactions), accountName: state.reportAccountId === 'all' ? 'Tutti i conti liquidi' : accountLabel(state.reportAccountId) };
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
      accountName: accountFilter === 'all' ? 'Tutti i conti liquidi' : accountLabel(accountFilter),
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
      currencyColumns: [3, 4, 5], dateColumns: [0],
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
    const rows = deviations.map(row => `<tr><td>${safeText(row.name)}</td><td class="num">${euro.format(row.actual)}</td><td class="num">${euro.format(row.previousYear)}</td><td class="num" style="color:${row.yearDelta < 0 ? '#b00020' : '#171b1a'};font-weight:${row.yearDelta < 0 ? '700' : '400'}">${row.yearDelta >= 0 ? '+' : '−'}${euro.format(Math.abs(row.yearDelta))} (${row.yearPercent === null ? 'n.d.' : `${row.yearPercent.toFixed(1)}%`})</td><td class="num">${euro.format(row.expected)}</td><td class="num" style="color:${row.delta < 0 ? '#b00020' : '#171b1a'};font-weight:${row.delta < 0 ? '700' : '400'}">${row.delta >= 0 ? '+' : '−'}${euro.format(Math.abs(row.delta))}</td><td class="num" style="color:${row.percent < 0 ? '#b00020' : '#171b1a'};font-weight:${row.percent < 0 ? '700' : '400'}">${row.percent === null ? 'n.d.' : `${row.percent > 0 ? '+' : ''}${row.percent.toFixed(1)}%`}</td></tr>`).join('');
    const periodRows = comparisons.map(c => `<tr><td>${c.year}</td><td class="num">${euro.format(c.data.income)}</td><td class="num">${euro.format(c.data.expense)}</td><td class="num" style="color:${c.data.net < 0 ? '#b00020' : '#171b1a'};font-weight:${c.data.net < 0 ? '700' : '400'}">${euro.format(c.data.net)}</td><td class="num">${euro.format(c.data.transfers)}</td></tr>`).join('');
    const scope = state.reportAccountId === 'all' ? 'Tutti i conti liquidi' : accountLabel(state.reportAccountId);
    const label = reportPeriodLabel(), code = reportFilenameCode();
    const baselineText = reportMode === 'monthly' && Number(monthSelection().slice(5, 7)) <= 2 ? 'Confronto con lo stesso mese dell’anno precedente' : 'Media degli altri periodi completi disponibili dello stesso anno';
    const chart = reportChartSvg();
    const content = `<h1>Report Gestione C/C</h1><div class="sub">${safeText(code)} · ${safeText(label)} · ${safeText(scope)}</div><div class="summary"><div>Entrate<strong>${euro.format(current.income)}</strong><span style="color:${current.income - previous.income < 0 ? '#b00020' : '#171b1a'}">Confronto precedente: ${signedEuro(current.income - previous.income)}</span></div><div>Uscite<strong>${euro.format(current.expense)}</strong><span style="color:${current.expense - previous.expense < 0 ? '#b00020' : '#171b1a'}">Confronto precedente: ${signedEuro(current.expense - previous.expense)}</span></div><div>Saldo netto<strong style="color:${current.net < 0 ? '#b00020' : '#171b1a'};font-weight:${current.net < 0 ? '700' : '400'}">${euro.format(current.net)}</strong><span style="color:${current.net - previous.net < 0 ? '#b00020' : '#171b1a'}">${verdict} · variazione ${signedEuro(current.net - previous.net)}</span></div></div><h2>Flusso del periodo</h2><div class="chart">${chart}</div><h2>Valutazione e scostamenti</h2><p><strong style="color:${current.net < 0 ? '#b00020' : '#171b1a'}">${verdict}</strong>: ${current.net > .005 ? 'le entrate hanno superato le uscite.' : current.net < -.005 ? 'le uscite hanno superato le entrate.' : 'entrate e uscite sono in pareggio.'} I trasferimenti sono separati dall’analisi delle spese.</p><p>${averageDeviations[0] ? `Lo scostamento maggiore è ${safeText(averageDeviations[0].name)}: ${averageDeviations[0].delta > 0 ? 'sopra' : 'sotto'} la media di ${euro.format(Math.abs(averageDeviations[0].delta))}.` : 'Non emergono scostamenti confrontabili dalla media.'}</p><h2>Scostamenti di spesa · ${safeText(baselineText)}</h2><table><thead><tr><th>Categoria</th><th class="num">Spesa periodo</th><th class="num">Anno prec.</th><th class="num">Var. annua</th><th class="num">Media attesa</th><th class="num">Scostamento</th><th class="num">Var. % media</th></tr></thead><tbody>${rows || '<tr><td colspan="7">Nessuno scostamento calcolabile.</td></tr>'}</tbody></table><h2>Confronto con gli anni precedenti</h2><table><thead><tr><th>Anno</th><th class="num">Entrate</th><th class="num">Uscite</th><th class="num">Netto</th><th class="num">Trasferimenti</th></tr></thead><tbody>${periodRows}</tbody></table>`;
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
    const categories = reportDeviationRows(comparisons);
    const current = comparisons[0].data, previous = comparisons[1].data;
    const verdict = current.net > .005 ? 'ATTIVO' : current.net < -.005 ? 'PASSIVO' : 'IN PAREGGIO';
    const account = state.reportAccountId === 'all' ? 'Tutti i conti liquidi' : accountLabel(state.reportAccountId);
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
      ['Conto', account],
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
    const categoryRows = [['Categoria', 'Spesa periodo', 'Stesso periodo anno precedente', 'Variazione annua', 'Variazione annua %', 'Media attesa stesso anno', 'Scostamento dalla media', 'Variazione dalla media %'], ...categories.map(row => [row.name, row.actual, row.previousYear, row.yearDelta, row.yearPercent === null ? 'n.d.' : row.yearPercent / 100, row.expected, row.delta, row.percent === null ? 'n.d.' : row.percent / 100])];
    const txRows = [['Data', 'Descrizione completa', 'Causale', 'Conto corrente', 'Importo', 'Contropartita/e', 'Stato'], ...comparisons[0].tx.map(tx => [tx.date, transactionDescription(tx) || transactionCausale(tx) || 'Movimento', transactionCausale(tx), accountLabel(tx.bankAccountId), tx.amount, tx.counterpartSplits?.length ? tx.counterpartSplits.map(s => accountLabel(s.accountId) + ' (' + euro.format(s.value) + ')').join('; ') : accountLabel(tx.counterpartAccountId), tx.status])];
    const mainDeviations = categories.filter(row => row.delta >= 0.01).slice(0, 5);
    if (mainDeviations.length) summaryRows.push([], ['Scostamenti principali rispetto agli altri periodi disponibili dello stesso anno'], ['Categoria', 'Spesa periodo', 'Media attesa', 'Scostamento'], ...mainDeviations.map(row => [row.name, row.actual, row.expected, row.delta]));
    const charts = [
      { title: 'Andamento mensile di entrate e uscite', categorySheet: 'Andamento', categoryCol: 0, firstDataRow: 2, lastDataRow: trendRows.length, series: [{ sheet: 'Andamento', col: 1, nameCol: 1 }, { sheet: 'Andamento', col: 2, nameCol: 2 }], startCol: 0, startRow: 1, endCol: 14, endRow: 18 }
    ];
    if (categories.length) charts.push({
      title: 'Spese del periodo e media di riferimento', categorySheet: 'Scostamenti', categoryCol: 0, firstDataRow: 2, lastDataRow: categoryRows.length,
      series: [{ sheet: 'Scostamenti', col: 1, nameCol: 1 }, { sheet: 'Scostamenti', col: 5, nameCol: 5 }],
      startCol: 0, startRow: 20, endCol: 14, endRow: 37
    });
    downloadXlsx(reportFilenameCode() + '.xlsx', [
      { name: 'Riepilogo', rows: summaryRows, titleRow: 0, headerRow: 6, headerRows: [14], currencyColumns: [1, 2, 3], widths: [48, 22, 32, 22], autoFilter: false },
      { name: 'Confronto', rows: flowRows, currencyColumns: [1, 2, 3, 4], widths: [14, 19, 19, 19, 19, 18] },
      { name: 'Scostamenti', rows: categoryRows, currencyColumns: [1, 2, 3, 5, 6], percentColumns: [4, 7], widths: [28, 20, 27, 20, 18, 24, 22, 22] },
      { name: 'Andamento', rows: trendRows, currencyColumns: [1, 2, 3], widths: [18, 20, 20, 20] },
      { name: 'Grafici', rows: [['GRAFICI DEL REPORT'], ['Grafici modificabili in Excel e LibreOffice.'], ['Dati di origine nei fogli Andamento e Scostamenti.']], titleRow: 0, headerRow: 0, autoFilter: false, charts: charts },
      { name: 'Movimenti', rows: txRows, currencyColumns: [4], dateColumns: [0], widths: [15, 48, 42, 36, 18, 55, 17] }
    ]);
  }
  async function exitApp() {
    await saveState();
    try { await fetch('/__stop', { method: 'POST' }); } catch {}
    document.body.innerHTML = '<main style="font:16px Segoe UI,Arial;padding:48px;color:#1b2a2a"><h1>Gestione C/C è stata chiusa</h1><p>Il servizio locale è fermato. Puoi chiudere questa scheda del browser.</p></main>';
    window.close();
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
        const result = await apiRequest('/api/import', { method: 'POST', body: JSON.stringify({ format: 'conti-chiari-local-backup', state: loaded, revision: stateRevision }) });
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

  window.addEventListener('pagehide', () => {
    if (!csrfToken) return;
    try {
      const payload = new Blob([JSON.stringify({})], { type: 'application/json' });
      fetch('/api/drive/session-backup', { method: 'POST', body: payload, credentials: 'same-origin', keepalive: true, headers: { 'X-CSRF-Token': csrfToken } }).catch(() => {});
    } catch (_) {}
  });

  initialize();
})();
