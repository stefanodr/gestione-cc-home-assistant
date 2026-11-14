'use strict';
(async () => {
  const form = document.getElementById('loginForm');
  const error = document.getElementById('error');
  const button = document.getElementById('submit');
  const pin = document.getElementById('pin');
  const progress = document.getElementById('loginProgress');
  const progressBar = document.getElementById('loginProgressBar');
  const progressText = document.getElementById('loginProgressText');
  let progressTimer = 0;
  const showProgress = value => { const percent = Math.max(0, Math.min(100, Math.round(value))); progressBar.style.width = percent + '%'; progressText.textContent = 'Accesso in corso… ' + percent + '%'; };
  pin.addEventListener('input', () => { pin.value = pin.value.replace(/\D/g, '').slice(0, 6); });
  try {
    const status = await fetch('/api/status', { credentials: 'same-origin', cache: 'no-store' });
    if (status.ok && (await status.json()).authenticated) { location.replace('/'); return; }
  } catch (_) {}
  form.addEventListener('submit', async event => {
    event.preventDefault();
    error.textContent = '';
    if (!/^[0-9]{6}$/.test(pin.value)) { error.textContent = 'Inserisci tutte le 6 cifre del PIN.'; pin.focus(); return; }
    button.disabled = true;
    progress.hidden = false;
    showProgress(8);
    let progressValue = 8;
    progressTimer = window.setInterval(() => { progressValue = Math.min(88, progressValue + Math.max(1, (90 - progressValue) * 0.08)); showProgress(progressValue); }, 180);
    try {
      const response = await fetch('/api/login', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ pin: pin.value })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Accesso non riuscito');
      window.clearInterval(progressTimer);
      showProgress(100);
      progressText.textContent = 'Accesso completato. Apertura archivio…';
      sessionStorage.setItem('cc_csrf', result.csrf);
      location.replace('/');
    } catch (e) {
      window.clearInterval(progressTimer);
      progress.hidden = true;
      error.textContent = e.message || 'Errore di collegamento';
      pin.value = '';
      pin.focus();
    } finally { button.disabled = false; }
  });
})();