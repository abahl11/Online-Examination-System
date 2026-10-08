(function () {
  const TOKEN_KEY = 'testdesk.token';
  const USER_KEY = 'testdesk.user';
  const NOTICE_KEY = 'testdesk.notice';

  const HOME_BY_ROLE = { admin: '/admin.html', instructor: '/instructor.html', student: '/student.html' };

  function saveSession({ token, user }) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function currentUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  }

  function bounceToSignIn(message) {
    clearSession();
    if (message) sessionStorage.setItem(NOTICE_KEY, message);
    window.location.href = '/';
  }

  function takeNotice() {
    const text = sessionStorage.getItem(NOTICE_KEY);
    sessionStorage.removeItem(NOTICE_KEY);
    return text;
  }

  async function api(path, options = {}) {
    const headers = {};
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(`/api${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (options.raw && response.ok) return response;

    const payload = await response.json().catch(() => ({}));

    if (response.status === 401 && !options.guest) {
      bounceToSignIn(payload.message || 'Please sign in again.');
      throw new Error(payload.message || 'Signed out');
    }
    if (!response.ok || payload.success === false) {
      const error = new Error(payload.message || `Request failed (${response.status})`);
      error.status = response.status;
      error.code = payload.code;
      error.details = payload.details;
      throw error;
    }
    return payload;
  }

  async function download(path, fallbackName) {
    const response = await api(path, { raw: true });
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = match ? match[1] : fallbackName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  }

  function guardPage(role) {
    const user = currentUser();
    if (!user || !localStorage.getItem(TOKEN_KEY)) {
      bounceToSignIn();
      return null;
    }
    if (role && user.role !== role) {
      window.location.href = HOME_BY_ROLE[user.role] || '/';
      return null;
    }

    const nameSlot = document.querySelector('[data-slot="user-name"]');
    const roleSlot = document.querySelector('[data-slot="user-role"]');
    if (nameSlot) nameSlot.textContent = user.fullName;
    if (roleSlot) roleSlot.textContent = user.role;

    const signOut = document.querySelector('[data-action="sign-out"]');
    if (signOut) {
      signOut.addEventListener('click', async () => {
        try {
          await api('/auth/logout', { method: 'POST', guest: true });
        } catch {}
        bounceToSignIn('You have signed out.');
      });
    }
    return user;
  }

  function wireSideMenu(onShow) {
    const buttons = document.querySelectorAll('.sidemenu [data-goto]');
    const show = (name) => {
      buttons.forEach((b) => b.classList.toggle('is-active', b.dataset.goto === name));
      document.querySelectorAll('[data-view]').forEach((v) => v.classList.toggle('hidden', v.dataset.view !== name));
      onShow(name);
    };
    buttons.forEach((b) => b.addEventListener('click', () => show(b.dataset.goto)));
    return show;
  }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function when(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function minutesAndSeconds(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds || 0));
    return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  }

  function badge(text, tone = '') {
    return `<span class="badge ${tone}">${esc(text)}</span>`;
  }

  function toast(message, tone = 'ok') {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    const note = document.createElement('div');
    note.className = `toast ${tone}`;
    note.textContent = message;
    stack.appendChild(note);
    setTimeout(() => note.remove(), 4000);
  }

  function showError(error, form) {
    if (form) {
      form.querySelectorAll('.field-error').forEach((el) => el.remove());
      (error.details || []).forEach(({ field, message }) => {
        const input = form.querySelector(`[name="${field.split('.')[0]}"]`);
        if (!input) return;
        const hint = document.createElement('div');
        hint.className = 'field-error';
        hint.textContent = message;
        (input.closest('.field') || input.parentElement).appendChild(hint);
      });
    }
    toast(error.message || 'Something went wrong', 'fail');
  }

  function openDialog({ title, body, buttons = [], wide = false }) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="dialog ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
        <div class="dialog-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Close">&times;</button></div>
        <div class="dialog-body">${body}</div>
        ${buttons.length ? '<div class="dialog-foot"></div>' : ''}
      </div>`;

    const close = () => overlay.remove();
    overlay.querySelector('[data-close]').addEventListener('click', close);
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close();
    });

    const foot = overlay.querySelector('.dialog-foot');
    buttons.forEach(({ label, tone = '', onClick }) => {
      const btn = document.createElement('button');
      btn.className = `btn ${tone}`;
      btn.textContent = label;
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await (onClick ? onClick(close) : close());
        } finally {
          btn.disabled = false;
        }
      });
      foot.appendChild(btn);
    });

    document.body.appendChild(overlay);
    const firstInput = overlay.querySelector('input, select, textarea');
    if (firstInput) firstInput.focus();
    return { root: overlay, close };
  }

  function confirmAction(message, confirmLabel = 'Yes, continue') {
    return new Promise((resolve) => {
      let answered = false;
      const dialog = openDialog({
        title: 'Please confirm',
        body: `<p>${esc(message)}</p>`,
        buttons: [
          { label: 'Cancel', tone: 'btn-quiet', onClick: (close) => { answered = true; resolve(false); close(); } },
          { label: confirmLabel, tone: 'btn-warn', onClick: (close) => { answered = true; resolve(true); close(); } },
        ],
      });
      new MutationObserver((_m, observer) => {
        if (!document.body.contains(dialog.root)) {
          observer.disconnect();
          if (!answered) resolve(false);
        }
      }).observe(document.body, { childList: true });
    });
  }

  function fillRows(tbody, rows, toHtml, columns, emptyText = 'Nothing to show yet.') {
    tbody.innerHTML = rows.length
      ? rows.map(toHtml).join('')
      : `<tr><td class="empty" colspan="${columns}">${esc(emptyText)}</td></tr>`;
  }

  function drawPager(container, meta, goTo) {
    if (!meta) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = `
      <span>${meta.total} record(s) · page ${meta.page} of ${meta.pages}</span>
      <span class="btn-group">
        <button class="btn btn-quiet btn-sm" data-page="${meta.page - 1}" ${meta.page <= 1 ? 'disabled' : ''}>&larr; Prev</button>
        <button class="btn btn-quiet btn-sm" data-page="${meta.page + 1}" ${meta.page >= meta.pages ? 'disabled' : ''}>Next &rarr;</button>
      </span>`;
    container.querySelectorAll('[data-page]').forEach((btn) =>
      btn.addEventListener('click', () => goTo(Number(btn.dataset.page)))
    );
  }

  function queryString(params) {
    const usable = Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null);
    return usable.length ? `?${new URLSearchParams(usable).toString()}` : '';
  }

  function debounce(fn, wait = 350) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  window.TestDesk = {
    HOME_BY_ROLE,
    saveSession,
    clearSession,
    currentUser,
    takeNotice,
    api,
    download,
    guardPage,
    wireSideMenu,
    esc,
    when,
    minutesAndSeconds,
    badge,
    toast,
    showError,
    openDialog,
    confirmAction,
    fillRows,
    drawPager,
    queryString,
    debounce,
  };
})();
