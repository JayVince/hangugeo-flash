/* =====================================================
   한국어 Flash — Panneau administrateur
===================================================== */

const LS_THEME = 'hgflash_theme';
const AVATARS  = ['🌸', '🐯', '🦊', '🐰', '🐼', '🐱', '🐶', '🦉', '🐸', '🦋'];

const state = {
  currentUser: null,
  usersPage: 1,
  usersSearch: '',
  auditPage: 1,
  vocab: [],
  editingVocabId: null,
  selectedUserId: null,
  selectedEditAvatar: null,
};

// ── Appels API ────────────────────────────────────────

async function apiRequest(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    window.location.href = '/login?reason=expired';
    throw new Error('Session expirée');
  }
  if (res.status === 403) {
    window.location.href = '/app';
    throw new Error('Accès refusé');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

const apiGet    = (url) => apiRequest('GET', url);
const apiPost   = (url, body) => apiRequest('POST', url, body);
const apiPut    = (url, body) => apiRequest('PUT', url, body);
const apiDelete = (url) => apiRequest('DELETE', url);

// ── Initialisation ───────────────────────────────────

async function init() {
  applyInitialTheme();
  setupTheme();
  setupNavigation();
  setupAccountMenu();
  setupInactivityLogout();

  try {
    const { user } = await apiGet('/api/auth/me');
    state.currentUser = user;
    document.getElementById('user-avatar').textContent = user.avatar;
    document.getElementById('user-username').textContent = user.username;
    document.getElementById('account-email').textContent = user.email;
  } catch (e) {
    return;
  }

  setupDashboard();
  setupUsers();
  setupVocab();
  setupAudit();

  await renderDashboard();
}

// ── Thème / compte / inactivité (identiques à l'app) ─────

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
}

function applyInitialTheme() {
  const saved = localStorage.getItem(LS_THEME);
  if (saved) return applyTheme(saved);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? 'dark' : 'light');
}

function setupTheme() {
  document.getElementById('btn-theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next    = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(LS_THEME, next);
  });
}

function setupAccountMenu() {
  const chip = document.getElementById('user-chip');
  const menu = document.getElementById('account-menu');
  chip.addEventListener('click', () => menu.classList.toggle('hidden'));
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && e.target !== chip && !chip.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });
  document.getElementById('btn-logout').addEventListener('click', () => logout());
}

async function logout(reason) {
  await apiPost('/api/auth/logout').catch(() => {});
  window.location.href = reason ? `/login?reason=${reason}` : '/login';
}

const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;
const INACTIVITY_CHECK_INTERVAL_MS = 30 * 1000;
let lastActivityAt = Date.now();
let loggedOutForInactivity = false;

function markActivity() { lastActivityAt = Date.now(); }

function setupInactivityLogout() {
  ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach((eventName) => {
    document.addEventListener(eventName, markActivity, { passive: true });
  });
  setInterval(() => {
    if (!loggedOutForInactivity && Date.now() - lastActivityAt >= INACTIVITY_LIMIT_MS) {
      loggedOutForInactivity = true;
      logout('inactivity');
    }
  }, INACTIVITY_CHECK_INTERVAL_MS);
}

// ── Navigation entre vues ────────────────────────────

function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.view;
      document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`view-${target}`).classList.add('active');

      if (target === 'dashboard') renderDashboard();
      if (target === 'users') renderUsers();
      if (target === 'vocab') renderVocab();
      if (target === 'audit') renderAudit();
    });
  });
}

// ══════════════════════════════════════════════════════
//  TABLEAU DE BORD
// ══════════════════════════════════════════════════════

function setupDashboard() {}

async function renderDashboard() {
  const { stats } = await apiGet('/api/admin/dashboard');

  const cards = [
    { label: 'Utilisateurs', value: stats.totalUsers },
    { label: 'Comptes actifs', value: stats.activeUsers },
    { label: 'Mots du programme', value: stats.totalVocabWords },
    { label: 'Cartes personnalisées', value: stats.totalCustomCards },
    { label: 'Sessions de quiz jouées', value: stats.totalQuizSessions },
  ];

  const grid = document.getElementById('dashboard-stats');
  grid.innerHTML = cards.map((c) => `
    <div class="admin-stat-card">
      <div class="admin-stat-value">${c.value}</div>
      <div class="admin-stat-label">${c.label}</div>
    </div>`).join('');

  const chartContainer = document.getElementById('signups-chart-container');
  if (!stats.signupsByDay.length) {
    chartContainer.innerHTML = `<div class="empty-state"><div class="empty-emoji">📊</div><p>Aucune inscription sur cette période.</p></div>`;
    return;
  }

  const maxCount = Math.max(...stats.signupsByDay.map((d) => d.count), 1);
  const chart = document.createElement('div');
  chart.className = 'history-chart';
  stats.signupsByDay.forEach((d) => {
    const pct = Math.round((d.count / maxCount) * 100);
    const date = new Date(d.date);
    const label = `${date.getDate()}/${date.getMonth() + 1}`;
    const wrap = document.createElement('div');
    wrap.className = 'history-bar-wrap';
    wrap.innerHTML = `
      <div class="history-bar" style="height:${Math.max(pct, 4)}%" title="${label} — ${d.count} inscription(s)"></div>
      <span class="history-bar-label">${label}</span>`;
    chart.appendChild(wrap);
  });
  chartContainer.innerHTML = '';
  chartContainer.appendChild(chart);
}

// ══════════════════════════════════════════════════════
//  UTILISATEURS
// ══════════════════════════════════════════════════════

function setupUsers() {
  let searchTimeout;
  document.getElementById('user-search').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.usersSearch = e.target.value.trim();
      state.usersPage = 1;
      renderUsers();
    }, 300);
  });

  document.getElementById('user-modal-close').addEventListener('click', closeUserModal);
  document.getElementById('user-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'user-modal-overlay') closeUserModal();
  });

  document.getElementById('user-edit-form').addEventListener('submit', saveUserProfile);
  document.getElementById('btn-toggle-active').addEventListener('click', toggleUserActive);
  document.getElementById('btn-toggle-role').addEventListener('click', toggleUserRole);
  document.getElementById('btn-force-reset').addEventListener('click', forceUserPasswordReset);
  document.getElementById('btn-delete-user').addEventListener('click', deleteSelectedUser);

  const avatarPicker = document.getElementById('edit-avatar-picker');
  AVATARS.forEach((avatar) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar-option';
    btn.textContent = avatar;
    btn.addEventListener('click', () => {
      state.selectedEditAvatar = avatar;
      avatarPicker.querySelectorAll('.avatar-option').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    avatarPicker.appendChild(btn);
  });
}

async function renderUsers() {
  const params = new URLSearchParams({ page: state.usersPage, pageSize: 20, search: state.usersSearch });
  const { users, page, totalPages, total } = await apiGet(`/api/admin/users?${params}`);

  const tbody = document.getElementById('users-table-body');

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="admin-empty-cell">Aucun utilisateur trouvé.</td></tr>`;
  } else {
    tbody.innerHTML = users.map((u) => `
      <tr class="admin-row" data-id="${u.id}">
        <td>${u.avatar}</td>
        <td>${escapeHtml(u.username)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${u.role === 'admin' ? 'Admin' : 'Utilisateur'}</span></td>
        <td><span class="badge ${u.isActive ? 'badge-active' : 'badge-suspended'}">${u.isActive ? 'Actif' : 'Suspendu'}</span></td>
        <td>${new Date(u.createdAt).toLocaleDateString('fr-FR')}</td>
        <td><button class="btn-table-action" data-id="${u.id}">Voir la fiche</button></td>
      </tr>`).join('');

    tbody.querySelectorAll('.btn-table-action').forEach((btn) => {
      btn.addEventListener('click', () => openUserModal(btn.dataset.id));
    });
  }

  const pagination = document.getElementById('users-pagination');
  pagination.innerHTML = `
    <button class="btn-icon" id="users-prev" ${page <= 1 ? 'disabled' : ''}>←</button>
    <span class="admin-pagination-label">Page ${page} / ${totalPages} (${total} au total)</span>
    <button class="btn-icon" id="users-next" ${page >= totalPages ? 'disabled' : ''}>→</button>`;

  const prevBtn = document.getElementById('users-prev');
  const nextBtn = document.getElementById('users-next');
  if (prevBtn) prevBtn.addEventListener('click', () => { state.usersPage--; renderUsers(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { state.usersPage++; renderUsers(); });
}

async function openUserModal(userId) {
  state.selectedUserId = Number(userId);
  const { user, stats } = await apiGet(`/api/admin/users/${userId}`);

  document.getElementById('edit-username').value = user.username;
  document.getElementById('edit-email').value = user.email;
  state.selectedEditAvatar = user.avatar;
  document.querySelectorAll('#edit-avatar-picker .avatar-option').forEach((b) => {
    b.classList.toggle('selected', b.textContent === user.avatar);
  });

  document.getElementById('user-modal-stats').innerHTML = `
    <div class="admin-stat-card small"><div class="admin-stat-value">${stats.masteredCount}</div><div class="admin-stat-label">Maîtrisées</div></div>
    <div class="admin-stat-card small"><div class="admin-stat-value">${stats.reviewCount}</div><div class="admin-stat-label">À revoir</div></div>
    <div class="admin-stat-card small"><div class="admin-stat-value">${stats.customCardsCount}</div><div class="admin-stat-label">Cartes perso</div></div>
    <div class="admin-stat-card small"><div class="admin-stat-value">${stats.quizSessionsCount}</div><div class="admin-stat-label">Quiz joués</div></div>
    <div class="admin-stat-card small"><div class="admin-stat-value">${stats.streak.current}</div><div class="admin-stat-label">Série actuelle</div></div>`;

  const isSelf = state.currentUser && state.currentUser.id === user.id;
  document.getElementById('btn-toggle-active').textContent = user.isActive ? 'Suspendre ce compte' : 'Réactiver ce compte';
  document.getElementById('btn-toggle-active').disabled = isSelf && user.isActive;
  document.getElementById('btn-toggle-role').textContent = user.role === 'admin' ? 'Rétrograder en utilisateur' : 'Promouvoir administrateur';
  document.getElementById('btn-toggle-role').disabled = isSelf;
  document.getElementById('btn-delete-user').disabled = isSelf;

  document.getElementById('user-modal-message').classList.add('hidden');
  document.getElementById('user-edit-error').classList.add('hidden');
  document.getElementById('user-modal-overlay').classList.remove('hidden');

  state.selectedUserSnapshot = user;
}

function closeUserModal() {
  document.getElementById('user-modal-overlay').classList.add('hidden');
  state.selectedUserId = null;
}

async function saveUserProfile(e) {
  e.preventDefault();
  const errorEl = document.getElementById('user-edit-error');
  errorEl.classList.add('hidden');

  try {
    await apiPut(`/api/admin/users/${state.selectedUserId}`, {
      username: document.getElementById('edit-username').value.trim(),
      email: document.getElementById('edit-email').value.trim(),
      avatar: state.selectedEditAvatar,
    });
    showModalMessage('Profil mis à jour.');
    renderUsers();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
}

async function toggleUserActive() {
  const nowActive = !state.selectedUserSnapshot.isActive;
  try {
    await apiPost(`/api/admin/users/${state.selectedUserId}/active`, { active: nowActive });
    showModalMessage(nowActive ? 'Compte réactivé.' : 'Compte suspendu.');
    await openUserModal(state.selectedUserId);
    renderUsers();
  } catch (err) {
    showModalMessage(err.message, true);
  }
}

async function toggleUserRole() {
  const newRole = state.selectedUserSnapshot.role === 'admin' ? 'user' : 'admin';
  if (!confirm(`Confirmer le changement de rôle vers "${newRole}" ?`)) return;
  try {
    await apiPost(`/api/admin/users/${state.selectedUserId}/role`, { role: newRole });
    showModalMessage('Rôle mis à jour.');
    await openUserModal(state.selectedUserId);
    renderUsers();
  } catch (err) {
    showModalMessage(err.message, true);
  }
}

async function forceUserPasswordReset() {
  if (!confirm('Envoyer un e-mail de réinitialisation de mot de passe à cet utilisateur ?')) return;
  try {
    const { message } = await apiPost(`/api/admin/users/${state.selectedUserId}/force-password-reset`);
    showModalMessage(message);
  } catch (err) {
    showModalMessage(err.message, true);
  }
}

async function deleteSelectedUser() {
  const username = state.selectedUserSnapshot ? state.selectedUserSnapshot.username : '';
  if (!confirm(`Supprimer définitivement le compte "${username}" et toutes ses données ? Cette action est irréversible.`)) return;
  try {
    await apiDelete(`/api/admin/users/${state.selectedUserId}`);
    closeUserModal();
    renderUsers();
  } catch (err) {
    showModalMessage(err.message, true);
  }
}

function showModalMessage(message, isError) {
  const el = document.getElementById('user-modal-message');
  el.textContent = message;
  el.className = isError ? 'auth-error' : 'auth-success';
  el.classList.remove('hidden');
}

// ══════════════════════════════════════════════════════
//  VOCABULAIRE
// ══════════════════════════════════════════════════════

function setupVocab() {
  document.getElementById('vocab-search').addEventListener('input', (e) => {
    renderVocabTable(e.target.value.trim().toLowerCase());
  });
  document.getElementById('btn-add-vocab').addEventListener('click', saveVocabWord);
  document.getElementById('btn-cancel-vocab-edit').addEventListener('click', cancelVocabEdit);
}

async function renderVocab() {
  const { vocab } = await apiGet('/api/admin/vocab');
  state.vocab = vocab;
  renderVocabTable(document.getElementById('vocab-search').value.trim().toLowerCase());
}

function renderVocabTable(filter) {
  const filtered = filter
    ? state.vocab.filter((v) =>
        v.hangeul.toLowerCase().includes(filter) ||
        v.translation.toLowerCase().includes(filter) ||
        v.category.toLowerCase().includes(filter))
    : state.vocab;

  const tbody = document.getElementById('vocab-table-body');

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="admin-empty-cell">Aucun mot trouvé.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((v) => `
    <tr>
      <td>${escapeHtml(v.hangeul)}</td>
      <td>${escapeHtml(v.romanisation)}</td>
      <td>${escapeHtml(v.translation)}</td>
      <td>${escapeHtml(v.category)}</td>
      <td class="admin-table-actions-cell">
        <button class="btn-edit" data-id="${v.id}" title="Modifier">✎</button>
        <button class="btn-delete" data-id="${v.id}" title="Supprimer">✕</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', () => startVocabEdit(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteVocabWord(btn.dataset.id));
  });
}

function startVocabEdit(id) {
  const word = state.vocab.find((v) => String(v.id) === String(id));
  if (!word) return;
  state.editingVocabId = word.id;
  document.getElementById('vocab-hangeul').value = word.hangeul;
  document.getElementById('vocab-roman').value = word.romanisation;
  document.getElementById('vocab-translation').value = word.translation;
  document.getElementById('vocab-category').value = word.category;
  document.getElementById('vocab-form-title').textContent = 'Modifier le mot';
  document.getElementById('btn-add-vocab').textContent = 'Enregistrer les modifications';
  document.getElementById('btn-cancel-vocab-edit').classList.remove('hidden');
  document.getElementById('vocab-hangeul').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelVocabEdit() {
  state.editingVocabId = null;
  ['vocab-hangeul', 'vocab-roman', 'vocab-translation', 'vocab-category'].forEach((id) => {
    document.getElementById(id).value = '';
  });
  document.getElementById('vocab-form-title').textContent = 'Ajouter un mot';
  document.getElementById('btn-add-vocab').textContent = '+ Ajouter le mot';
  document.getElementById('btn-cancel-vocab-edit').classList.add('hidden');
}

async function saveVocabWord() {
  const hangeul      = document.getElementById('vocab-hangeul').value.trim();
  const romanisation = document.getElementById('vocab-roman').value.trim();
  const translation  = document.getElementById('vocab-translation').value.trim();
  const category     = document.getElementById('vocab-category').value.trim();
  const errorEl      = document.getElementById('vocab-form-error');

  if (!hangeul || !romanisation || !translation || !category) {
    errorEl.textContent = 'Veuillez remplir tous les champs.';
    errorEl.classList.remove('hidden');
    return;
  }

  try {
    if (state.editingVocabId) {
      await apiPut(`/api/admin/vocab/${state.editingVocabId}`, { hangeul, romanisation, translation, category });
    } else {
      await apiPost('/api/admin/vocab', { hangeul, romanisation, translation, category });
    }
    errorEl.classList.add('hidden');
    cancelVocabEdit();
    renderVocab();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
}

async function deleteVocabWord(id) {
  const word = state.vocab.find((v) => String(v.id) === String(id));
  if (!confirm(`Supprimer "${word ? word.hangeul : ''}" du vocabulaire ?`)) return;
  try {
    await apiDelete(`/api/admin/vocab/${id}`);
    renderVocab();
  } catch (err) {
    alert(err.message);
  }
}

// ══════════════════════════════════════════════════════
//  JOURNAL D'AUDIT
// ══════════════════════════════════════════════════════

function setupAudit() {}

const AUDIT_ACTION_LABELS = {
  update_profile: 'Profil modifié',
  suspend_user: 'Compte suspendu',
  reactivate_user: 'Compte réactivé',
  change_role: 'Rôle modifié',
  delete_user: 'Compte supprimé',
  force_password_reset: 'Réinit. mot de passe forcée',
  create_vocab: 'Mot ajouté',
  update_vocab: 'Mot modifié',
  delete_vocab: 'Mot supprimé',
};

async function renderAudit() {
  const params = new URLSearchParams({ page: state.auditPage, pageSize: 30 });
  const { entries, page, totalPages, total } = await apiGet(`/api/admin/audit-log?${params}`);

  const tbody = document.getElementById('audit-table-body');

  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="admin-empty-cell">Aucune action enregistrée.</td></tr>`;
  } else {
    tbody.innerHTML = entries.map((e) => `
      <tr>
        <td>${new Date(e.createdAt).toLocaleString('fr-FR')}</td>
        <td>${escapeHtml(e.adminUsername)}</td>
        <td>${AUDIT_ACTION_LABELS[e.action] || escapeHtml(e.action)}</td>
        <td>${escapeHtml(e.targetType)} #${escapeHtml(String(e.targetId || ''))}</td>
        <td class="admin-audit-details">${e.details ? escapeHtml(JSON.stringify(e.details)) : ''}</td>
      </tr>`).join('');
  }

  const pagination = document.getElementById('audit-pagination');
  pagination.innerHTML = `
    <button class="btn-icon" id="audit-prev" ${page <= 1 ? 'disabled' : ''}>←</button>
    <span class="admin-pagination-label">Page ${page} / ${totalPages} (${total} au total)</span>
    <button class="btn-icon" id="audit-next" ${page >= totalPages ? 'disabled' : ''}>→</button>`;

  const prevBtn = document.getElementById('audit-prev');
  const nextBtn = document.getElementById('audit-next');
  if (prevBtn) prevBtn.addEventListener('click', () => { state.auditPage--; renderAudit(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { state.auditPage++; renderAudit(); });
}

// ── Utilitaires ──────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

init();
