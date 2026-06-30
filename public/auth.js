/* =====================================================
   한국어 Flash — Logique des pages d'authentification
===================================================== */

const AVATARS = ['🌸', '🐯', '🦊', '🐰', '🐼', '🐱', '🐶', '🦉', '🐸', '🦋'];

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

function showError(el, message) {
  el.textContent = message;
  el.classList.remove('hidden');
}

function hideError(el) {
  el.classList.add('hidden');
}

// ── Page de réinitialisation (reset-password.html) ──────
function initResetPage() {
  const form    = document.getElementById('reset-form');
  const errorEl = document.getElementById('reset-error');
  const successEl = document.getElementById('reset-success');

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (!token) {
    showError(errorEl, 'Lien invalide : aucun jeton trouvé. Refaites une demande depuis la page de connexion.');
    form.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(errorEl);
    successEl.classList.add('hidden');

    const newPassword = document.getElementById('reset-password').value;
    const { ok, data } = await postJson('/api/auth/reset-password', { token, newPassword });

    if (!ok) {
      showError(errorEl, data.error || 'Une erreur est survenue.');
      return;
    }

    successEl.textContent = data.message || 'Mot de passe mis à jour !';
    successEl.classList.remove('hidden');
    form.querySelector('button[type="submit"]').disabled = true;
    setTimeout(() => { window.location.href = '/login'; }, 2000);
  });
}

// ── Page de connexion / inscription (login.html) ────────
function initLoginPage() {
  // Message contextuel si la page a été atteinte après une déconnexion
  // automatique (inactivité ou session expirée)
  const reason = new URLSearchParams(window.location.search).get('reason');
  if (reason) {
    const messages = {
      inactivity: 'Vous avez été déconnecté(e) après 15 minutes d\'inactivité.',
      expired: 'Votre session a expiré, veuillez vous reconnecter.',
    };
    const messageEl = document.getElementById('session-message');
    if (messageEl && messages[reason]) {
      messageEl.textContent = messages[reason];
      messageEl.classList.remove('hidden');
    }
  }

  // Bascule entre les onglets Connexion / Inscription
  const tabs = document.querySelectorAll('.auth-tab');
  const forms = {
    login: document.getElementById('login-form'),
    register: document.getElementById('register-form'),
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      Object.values(forms).forEach((f) => f.classList.add('hidden'));
      document.getElementById('forgot-form').classList.add('hidden');
      forms[tab.dataset.tab].classList.remove('hidden');
    });
  });

  // Sélecteur d'avatar (inscription)
  const avatarPicker = document.getElementById('avatar-picker');
  let selectedAvatar = AVATARS[0];
  AVATARS.forEach((avatar, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar-option' + (i === 0 ? ' selected' : '');
    btn.textContent = avatar;
    btn.addEventListener('click', () => {
      selectedAvatar = avatar;
      avatarPicker.querySelectorAll('.avatar-option').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    avatarPicker.appendChild(btn);
  });

  // Connexion
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('login-error');
    hideError(errorEl);

    const identifier = document.getElementById('login-identifier').value.trim();
    const password    = document.getElementById('login-password').value;

    const { ok, data } = await postJson('/api/auth/login', { identifier, password });
    if (!ok) return showError(errorEl, data.error || 'Connexion impossible.');

    window.location.href = '/app';
  });

  // Inscription
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('register-error');
    hideError(errorEl);

    const username = document.getElementById('register-username').value.trim();
    const email    = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;

    const { ok, data } = await postJson('/api/auth/register', {
      username, email, password, avatar: selectedAvatar,
    });
    if (!ok) return showError(errorEl, data.error || 'Inscription impossible.');

    window.location.href = '/app';
  });

  // Mot de passe oublié
  document.getElementById('btn-forgot-password').addEventListener('click', () => {
    Object.values(forms).forEach((f) => f.classList.add('hidden'));
    tabs.forEach((t) => t.classList.remove('active'));
    document.getElementById('forgot-form').classList.remove('hidden');
  });

  document.getElementById('btn-back-to-login').addEventListener('click', () => {
    document.getElementById('forgot-form').classList.add('hidden');
    document.querySelector('.auth-tab[data-tab="login"]').classList.add('active');
    forms.login.classList.remove('hidden');
  });

  document.getElementById('forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl   = document.getElementById('forgot-error');
    const successEl = document.getElementById('forgot-success');
    hideError(errorEl);
    successEl.classList.add('hidden');

    const email = document.getElementById('forgot-email').value.trim();
    const { ok, data } = await postJson('/api/auth/forgot-password', { email });

    if (!ok) return showError(errorEl, data.error || 'Une erreur est survenue.');

    successEl.textContent = data.message;
    successEl.classList.remove('hidden');
  });
}

// ── Lancement selon la page ──────────────────────────────
const currentScript = document.currentScript;
if (currentScript && currentScript.dataset.page === 'reset') {
  initResetPage();
} else {
  initLoginPage();
}
