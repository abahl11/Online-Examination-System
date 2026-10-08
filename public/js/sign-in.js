(function () {
  const { api, saveSession, currentUser, takeNotice, showError, HOME_BY_ROLE } = window.TestDesk;

  const existing = currentUser();
  if (existing && localStorage.getItem('testdesk.token')) {
    window.location.replace(HOME_BY_ROLE[existing.role] || '/');
    return;
  }

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const noticeBox = document.getElementById('notice');

  const notice = takeNotice();
  if (notice) {
    noticeBox.textContent = notice;
    noticeBox.classList.remove('hidden');
  }

  document.querySelectorAll('.switcher [data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      document.querySelectorAll('.switcher [data-mode]').forEach((b) => b.classList.toggle('is-active', b === btn));
      loginForm.classList.toggle('hidden', mode !== 'login');
      registerForm.classList.toggle('hidden', mode !== 'register');
    });
  });

  async function enter(form, path) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const { data } = await api(path, { method: 'POST', body, guest: true });
      saveSession(data);
      window.location.href = HOME_BY_ROLE[data.user.role] || '/';
    } catch (error) {
      showError(error, form);
    } finally {
      button.disabled = false;
    }
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    enter(loginForm, '/auth/login');
  });
  registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    enter(registerForm, '/auth/register');
  });
})();
