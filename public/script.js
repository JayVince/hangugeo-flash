/* =====================================================
   한국어 Flash by OppaLingo — Script principal
   Toutes les données utilisateur sont synchronisées via l'API
   (base de données) ; seul le thème clair/sombre reste local.
===================================================== */

const LS_THEME = 'hgflash_theme'; // préférence d'appareil uniquement

// Intervalles (en jours) du système Leitner à 5 boîtes — affichage
// uniquement ; le calcul faisant autorité se fait côté serveur.
const LEITNER_INTERVALS = [0, 1, 3, 7, 14];

const state = {
  vocab:          [],   // mots du programme (depuis /api/vocab)
  custom:         [],   // cartes personnalisées (depuis /api/cards)
  progress:       {},   // clé "type_id" → { box, lastAction, nextReview }
  streak:         { current: 0, longest: 0 },
  filter:         'all',
  categoryFilter: 'all',
  currentIndex:   0,
  user:           null,
};

let currentCard = null;
let editingId    = null;

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
    const [meRes, vocabRes, cardsRes, progressRes, streakRes] = await Promise.all([
      apiGet('/api/auth/me'),
      apiGet('/api/vocab'),
      apiGet('/api/cards'),
      apiGet('/api/progress'),
      apiGet('/api/streak'),
    ]);

    state.user   = meRes.user;
    state.vocab  = vocabRes.vocab;
    state.custom = cardsRes.cards;
    state.streak = streakRes.streak;

    state.progress = {};
    progressRes.progress.forEach((p) => {
      state.progress[`${p.cardType}_${p.cardId}`] = p;
    });

    renderUserChip();
  } catch (e) {
    console.error('Échec du chargement initial :', e.message);
    return; // apiRequest redirige déjà vers /login en cas de 401
  }

  setupFlashcards();
  setupQuiz();
  setupMesCartes();
  refreshCategorySelects();
}

// ── Utilitaires date / texte ─────────────────────────

function todayStr() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeText(s) {
  return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyMatch(input, target) {
  const a = normalizeText(input);
  const b = normalizeText(target);
  if (!a) return false;
  if (a === b) return true;
  return a.length > 3 && levenshtein(a, b) <= 1;
}

// ── Audio (prononciation) ────────────────────────────

const audioPlayer = document.getElementById('audio-player');

function browserSpeak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch (e) { /* synthèse vocale indisponible — on ignore */ }
}

function speak(card) {
  if (!card || !card.hangeul || !audioPlayer) return;
  audioPlayer.onerror = () => browserSpeak(card.hangeul);
  audioPlayer.src = `/api/tts?text=${encodeURIComponent(card.hangeul)}`;
  const playPromise = audioPlayer.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => browserSpeak(card.hangeul));
  }
}

// ── Compte utilisateur ────────────────────────────────

function renderUserChip() {
  if (!state.user) return;
  document.getElementById('user-avatar').textContent = state.user.avatar;
  document.getElementById('user-username').textContent = state.user.username;
  document.getElementById('account-email').textContent = state.user.email;
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

// ── Déconnexion automatique par inactivité ───────────────
// L'utilisateur est déconnecté après 15 minutes sans aucune interaction
// (souris, clavier, défilement, écran tactile). Le cookie de session
// expire par ailleurs de lui-même à la fermeture du navigateur (voir
// lib/auth.js côté serveur, cookie sans maxAge).

const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
const INACTIVITY_CHECK_INTERVAL_MS = 30 * 1000; // vérifié toutes les 30s

let lastActivityAt = Date.now();
let loggedOutForInactivity = false;

function markActivity() {
  lastActivityAt = Date.now();
}

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

      if (target === 'mes-cartes') renderMyCards();
      if (target === 'flashcards') renderFlashcard();
      if (target === 'stats')      renderStats();
    });
  });
}

// ── Thème clair / sombre (préférence locale à l'appareil) ─

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
}

function applyInitialTheme() {
  const saved = localStorage.getItem(LS_THEME);
  if (saved) {
    applyTheme(saved);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
}

function setupTheme() {
  document.getElementById('btn-theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next    = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(LS_THEME, next);
  });
}

// ── Catégories ────────────────────────────────────────

function getAllCategories() {
  const cats = [...new Set(state.vocab.map((c) => c.category))];
  if (state.custom.length > 0) cats.push('Mes Cartes');
  return cats;
}

function refreshCategorySelects() {
  populateSelect(document.getElementById('category-filter'), 'Toutes les catégories');
  populateSelect(document.getElementById('quiz-category-select'), 'Toutes les catégories');
}

function populateSelect(selectEl, allLabel) {
  const previousValue = selectEl.value || 'all';
  selectEl.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = allLabel;
  selectEl.appendChild(allOption);

  getAllCategories().forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    selectEl.appendChild(opt);
  });

  if ([...selectEl.options].some((o) => o.value === previousValue)) {
    selectEl.value = previousValue;
  }
}

// ══════════════════════════════════════════════════════
//  FLASHCARDS
// ══════════════════════════════════════════════════════

function getAllCards() {
  const vocabCards  = state.vocab.map((c) => ({ ...c, type: 'vocab' }));
  const customCards = state.custom.map((c) => ({ ...c, type: 'custom', category: 'Mes Cartes' }));
  return [...vocabCards, ...customCards];
}

function progressKey(card) {
  return `${card.type}_${card.id}`;
}

function getFilteredCards() {
  let cards = getAllCards();

  if (state.categoryFilter !== 'all') {
    cards = cards.filter((c) => c.category === state.categoryFilter);
  }

  if (state.filter === 'review') {
    cards = cards.filter((c) => state.progress[progressKey(c)] && state.progress[progressKey(c)].lastAction === 'review');
  } else if (state.filter === 'mastered') {
    cards = cards.filter((c) => state.progress[progressKey(c)] && state.progress[progressKey(c)].lastAction === 'mastered');
  } else {
    const today = todayStr();
    cards = [...cards].sort((a, b) => {
      const pa = state.progress[progressKey(a)];
      const pb = state.progress[progressKey(b)];
      const dueA = !pa || pa.nextReview <= today ? 0 : 1;
      const dueB = !pb || pb.nextReview <= today ? 0 : 1;
      return dueA - dueB;
    });
  }

  return cards;
}

function renderFlashcard() {
  const cards = getFilteredCards();
  currentCard = cards[state.currentIndex] || null;

  document.getElementById('card-flip').classList.remove('flipped');

  if (!currentCard) {
    document.getElementById('card-hangeul-front').textContent = '🌸';
    document.getElementById('card-category').textContent      = '';
    document.getElementById('card-hangeul-back').textContent  = '';
    document.getElementById('card-romanisation').textContent  = '';
    document.getElementById('card-translation').textContent   = 'Aucune carte ici';
    document.getElementById('card-current').textContent = '0';
    document.getElementById('card-total').textContent   = '0';
    updateStats();
    return;
  }

  document.getElementById('card-hangeul-front').textContent = currentCard.hangeul;
  document.getElementById('card-category').textContent      = currentCard.category || '';
  document.getElementById('card-hangeul-back').textContent  = currentCard.hangeul;
  document.getElementById('card-romanisation').textContent  = currentCard.romanisation;
  document.getElementById('card-translation').textContent   = currentCard.translation;
  document.getElementById('card-current').textContent = state.currentIndex + 1;
  document.getElementById('card-total').textContent   = cards.length;

  updateStats();
}

function updateStats() {
  const allCards = getAllCards();
  let mastered = 0, review = 0;

  allCards.forEach((c) => {
    const entry = state.progress[progressKey(c)];
    if (entry) {
      if (entry.lastAction === 'mastered') mastered++;
      else if (entry.lastAction === 'review') review++;
    }
  });

  const unseen = Math.max(0, allCards.length - mastered - review);

  document.getElementById('stat-mastered').textContent = mastered;
  document.getElementById('stat-review').textContent   = review;
  document.getElementById('stat-unseen').textContent   = unseen;
}

async function markCard(action) {
  if (!currentCard) return;

  try {
    const { progress, streak } = await apiPost('/api/progress/mark', {
      cardType: currentCard.type,
      cardId: currentCard.id,
      action,
    });
    state.progress[progressKey(currentCard)] = progress;
    state.streak = streak;
  } catch (e) {
    console.error('Échec de la mise à jour de la progression :', e.message);
    return;
  }

  const updated = getFilteredCards();
  if (state.currentIndex >= updated.length) {
    state.currentIndex = Math.max(0, updated.length - 1);
  }
  renderFlashcard();
}

function setupFlashcards() {
  document.getElementById('card-scene').addEventListener('click', () => {
    document.getElementById('card-flip').classList.toggle('flipped');
  });

  document.getElementById('btn-prev').addEventListener('click', () => {
    const cards = getFilteredCards();
    if (!cards.length) return;
    state.currentIndex = (state.currentIndex - 1 + cards.length) % cards.length;
    renderFlashcard();
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    const cards = getFilteredCards();
    if (!cards.length) return;
    state.currentIndex = (state.currentIndex + 1) % cards.length;
    renderFlashcard();
  });

  document.getElementById('btn-mastered').addEventListener('click', () => markCard('mastered'));
  document.getElementById('btn-review').addEventListener('click',   () => markCard('review'));

  ['speak-front-btn', 'speak-back-btn'].forEach((id) => {
    document.getElementById(id).addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentCard) speak(currentCard);
    });
  });

  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.filter       = btn.dataset.filter;
      state.currentIndex = 0;
      renderFlashcard();
    });
  });

  document.getElementById('category-filter').addEventListener('change', (e) => {
    state.categoryFilter = e.target.value;
    state.currentIndex   = 0;
    renderFlashcard();
  });

  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('view-flashcards').classList.contains('active')) return;
    const cards = getFilteredCards();
    if (!cards.length) return;

    if (e.key === 'ArrowRight') {
      state.currentIndex = (state.currentIndex + 1) % cards.length;
      renderFlashcard();
    } else if (e.key === 'ArrowLeft') {
      state.currentIndex = (state.currentIndex - 1 + cards.length) % cards.length;
      renderFlashcard();
    } else if (e.key === ' ') {
      e.preventDefault();
      document.getElementById('card-flip').classList.toggle('flipped');
    }
  });

  renderFlashcard();
}

// ══════════════════════════════════════════════════════
//  QUIZ
// ══════════════════════════════════════════════════════

const quiz = {
  questions: [],
  current:   0,
  score:     0,
  answered:  false,
  settings:  { category: 'all', count: 5, mode: 'qcm' },
};

function setupQuiz() {
  document.getElementById('quiz-category-select').addEventListener('change', (e) => {
    quiz.settings.category = e.target.value;
  });

  document.querySelectorAll('#quiz-count-group .option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#quiz-count-group .option-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      quiz.settings.count = parseInt(btn.dataset.count, 10);
    });
  });

  document.querySelectorAll('#quiz-mode-group .option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#quiz-mode-group .option-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      quiz.settings.mode = btn.dataset.mode;
    });
  });

  document.getElementById('btn-start-quiz').addEventListener('click', startQuiz);
  document.getElementById('btn-retry').addEventListener('click', () => {
    document.getElementById('quiz-result').classList.add('hidden');
    document.getElementById('quiz-start').classList.remove('hidden');
  });

  document.getElementById('quiz-speak-btn').addEventListener('click', () => {
    const q = quiz.questions[quiz.current];
    if (q) speak(q);
  });

  document.getElementById('quiz-typing-submit').addEventListener('click', submitTypingAnswer);
  document.getElementById('quiz-typing-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitTypingAnswer();
  });
}

function startQuiz() {
  let pool = getAllCards();
  if (quiz.settings.category !== 'all') {
    pool = pool.filter((c) => c.category === quiz.settings.category);
  }

  const count = Math.min(quiz.settings.count, pool.length);
  quiz.questions = shuffle(pool).slice(0, count);
  quiz.current   = 0;
  quiz.score     = 0;

  document.getElementById('quiz-start').classList.add('hidden');
  document.getElementById('quiz-result').classList.add('hidden');
  document.getElementById('quiz-question').classList.remove('hidden');

  const isTyping = quiz.settings.mode === 'typing';
  document.getElementById('quiz-choices').classList.toggle('hidden', isTyping);
  document.getElementById('quiz-typing').classList.toggle('hidden', !isTyping);

  renderQuizQuestion();
}

function renderQuizQuestion() {
  const q = quiz.questions[quiz.current];
  quiz.answered = false;

  const pct = (quiz.current / quiz.questions.length) * 100;
  document.getElementById('quiz-progress-fill').style.width = `${pct}%`;
  document.getElementById('quiz-score-live').textContent  = quiz.score;
  document.querySelector('.quiz-meta span').innerHTML =
    `Question <strong id="quiz-q-num">${quiz.current + 1}</strong>/${quiz.questions.length}`;

  document.getElementById('quiz-hangeul').textContent      = q.hangeul;
  document.getElementById('quiz-romanisation').textContent = q.romanisation;

  if (quiz.settings.mode === 'typing') {
    renderTypingQuestion();
  } else {
    renderQcmQuestion(q);
  }
}

function renderQcmQuestion(q) {
  const allCards    = getAllCards();
  const distractors = shuffle(allCards.filter((c) => String(c.id) !== String(q.id) || c.type !== q.type)).slice(0, 3);
  const choices      = shuffle([q, ...distractors]);

  const container = document.getElementById('quiz-choices');
  container.innerHTML = '';

  choices.forEach((choice) => {
    const btn = document.createElement('button');
    btn.className   = 'choice-btn';
    btn.textContent = choice.translation;
    btn.dataset.id   = String(choice.id);
    btn.dataset.type = choice.type;

    btn.addEventListener('click', () => {
      if (quiz.answered) return;
      quiz.answered = true;

      const isCorrect = String(choice.id) === String(q.id) && choice.type === q.type;
      if (isCorrect) {
        btn.classList.add('correct');
        quiz.score++;
      } else {
        btn.classList.add('wrong');
        container.querySelectorAll('.choice-btn').forEach((b) => {
          if (b.dataset.id === String(q.id) && b.dataset.type === q.type) b.classList.add('correct');
        });
      }

      container.querySelectorAll('.choice-btn').forEach((b) => (b.disabled = true));
      setTimeout(goToNextQuestion, 1200);
    });

    container.appendChild(btn);
  });
}

function renderTypingQuestion() {
  const input    = document.getElementById('quiz-typing-input');
  const feedback = document.getElementById('quiz-typing-feedback');

  input.value    = '';
  input.disabled = false;
  feedback.classList.add('hidden');
  feedback.className = 'typing-feedback hidden';
  document.getElementById('quiz-typing-submit').disabled = false;

  setTimeout(() => input.focus(), 50);
}

function submitTypingAnswer() {
  if (quiz.answered) return;
  quiz.answered = true;

  const q        = quiz.questions[quiz.current];
  const input    = document.getElementById('quiz-typing-input');
  const feedback = document.getElementById('quiz-typing-feedback');
  const isCorrect = fuzzyMatch(input.value, q.translation);

  if (isCorrect) {
    quiz.score++;
    feedback.textContent = '✓ Correct !';
    feedback.className   = 'typing-feedback correct';
  } else {
    feedback.textContent = `✗ La réponse était : ${q.translation}`;
    feedback.className   = 'typing-feedback wrong';
  }
  feedback.classList.remove('hidden');

  input.disabled = true;
  document.getElementById('quiz-typing-submit').disabled = true;

  setTimeout(goToNextQuestion, 1400);
}

function goToNextQuestion() {
  quiz.current++;
  if (quiz.current < quiz.questions.length) {
    renderQuizQuestion();
  } else {
    showQuizResult();
  }
}

async function showQuizResult() {
  document.getElementById('quiz-question').classList.add('hidden');
  document.getElementById('quiz-result').classList.remove('hidden');
  document.getElementById('quiz-progress-fill').style.width = '100%';

  const score = quiz.score;
  const total = quiz.questions.length;
  const ratio = score / total;

  document.getElementById('result-score-num').textContent = score;
  document.querySelector('.result-total').textContent = `/${total}`;

  let emoji, title, message;
  if (ratio === 1) {
    emoji = '🏆'; title = 'Parfait !';
    message = "잘했어요 ! (Jal haesseoyo !) — Vous n'avez fait aucune erreur !";
  } else if (ratio >= 0.8) {
    emoji = '🎉'; title = 'Excellent !';
    message = '아주 잘했어요 ! (Aju jal haesseoyo !) — Encore un petit effort !';
  } else if (ratio >= 0.6) {
    emoji = '😊'; title = 'Bien joué !';
    message = '계속 공부하세요 ! (Gyesok gongbuhaseyo !) — Continuez à pratiquer !';
  } else if (ratio >= 0.4) {
    emoji = '💪'; title = 'Courage !';
    message = "더 연습해요 ! (Deo yeonseupaeyo !) — Il faut s'entraîner davantage.";
  } else {
    emoji = '📚'; title = 'À revoir !';
    message = '처음부터 시작해요 ! — Recommencez depuis le début, vous allez y arriver !';
  }

  document.getElementById('result-emoji').textContent   = emoji;
  document.getElementById('result-title').textContent   = title;
  document.getElementById('result-message').textContent = message;

  try {
    const { streak } = await apiPost('/api/quiz-history', {
      score, total, mode: quiz.settings.mode, category: quiz.settings.category,
    });
    state.streak = streak;
  } catch (e) {
    console.error("Échec de l'enregistrement du résultat de quiz :", e.message);
  }
}

// ══════════════════════════════════════════════════════
//  MES CARTES
// ══════════════════════════════════════════════════════

function setupMesCartes() {
  document.getElementById('btn-add-card').addEventListener('click', saveCard);
  document.getElementById('btn-cancel-edit').addEventListener('click', cancelEdit);

  ['input-hangeul', 'input-roman', 'input-translation'].forEach((id) => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveCard();
    });
  });

  renderMyCards();
}

async function saveCard() {
  const hangeul      = document.getElementById('input-hangeul').value.trim();
  const romanisation = document.getElementById('input-roman').value.trim();
  const translation  = document.getElementById('input-translation').value.trim();
  const errorEl      = document.getElementById('form-error');

  if (!hangeul || !romanisation || !translation) {
    errorEl.classList.remove('hidden');
    return;
  }
  errorEl.classList.add('hidden');

  try {
    if (editingId) {
      await apiPut(`/api/cards/${editingId}`, { hangeul, romanisation, translation });
      const card = state.custom.find((c) => c.id === editingId);
      if (card) { card.hangeul = hangeul; card.romanisation = romanisation; card.translation = translation; }
      cancelEdit();
    } else {
      const created = await apiPost('/api/cards', { hangeul, romanisation, translation });
      state.custom.push(created);
      clearForm();
    }
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.classList.remove('hidden');
    return;
  }

  refreshCategorySelects();
  renderMyCards();
}

function clearForm() {
  document.getElementById('input-hangeul').value     = '';
  document.getElementById('input-roman').value       = '';
  document.getElementById('input-translation').value = '';
}

function startEdit(card) {
  editingId = card.id;
  document.getElementById('input-hangeul').value      = card.hangeul;
  document.getElementById('input-roman').value        = card.romanisation;
  document.getElementById('input-translation').value  = card.translation;
  document.getElementById('form-title-text').textContent = 'Modifier la carte';
  document.getElementById('btn-add-card').textContent     = 'Enregistrer les modifications';
  document.getElementById('btn-cancel-edit').classList.remove('hidden');
  document.getElementById('input-hangeul').scrollIntoView({ behavior: 'smooth', block: 'center' });
  renderMyCards();
}

function cancelEdit() {
  editingId = null;
  clearForm();
  document.getElementById('form-title-text').textContent = 'Ajouter une carte';
  document.getElementById('btn-add-card').textContent     = '+ Ajouter la carte';
  document.getElementById('btn-cancel-edit').classList.add('hidden');
  renderMyCards();
}

async function deleteCard(id) {
  try {
    await apiDelete(`/api/cards/${id}`);
  } catch (e) {
    console.error('Échec de la suppression :', e.message);
    return;
  }
  state.custom = state.custom.filter((c) => c.id !== id);
  delete state.progress[`custom_${id}`];
  if (editingId === id) cancelEdit();
  refreshCategorySelects();
  renderMyCards();
}

function renderMyCards() {
  const container = document.getElementById('my-cards-container');
  const count     = state.custom.length;

  document.getElementById('my-cards-count').textContent = `(${count})`;

  if (count === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-emoji">🌸</div>
        <p>Vous n'avez pas encore de cartes personnalisées.<br>Ajoutez-en une ci-dessus !</p>
      </div>`;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'my-cards-grid';

  state.custom.forEach((card) => {
    const item = document.createElement('div');
    item.className = 'my-card-item' + (editingId === card.id ? ' editing' : '');
    item.innerHTML = `
      <div class="my-card-actions">
        <button class="btn-edit"   title="Modifier cette carte">✎</button>
        <button class="btn-delete" title="Supprimer cette carte">✕</button>
      </div>
      <div class="my-card-kr">${card.hangeul}</div>
      <div class="my-card-roman">${card.romanisation}</div>
      <div class="my-card-translation">${card.translation}</div>`;
    item.querySelector('.btn-edit').addEventListener('click', () => startEdit(card));
    item.querySelector('.btn-delete').addEventListener('click', () => deleteCard(card.id));
    grid.appendChild(item);
  });

  container.innerHTML = '';
  container.appendChild(grid);
}

// ══════════════════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════════════════

async function renderStats() {
  document.getElementById('streak-current').textContent = state.streak.current;
  document.getElementById('streak-longest').textContent = state.streak.longest;

  const allCards = getAllCards();
  const mastered = allCards.filter((c) => state.progress[progressKey(c)] && state.progress[progressKey(c)].lastAction === 'mastered').length;
  const total    = allCards.length;
  const pct      = total ? Math.round((mastered / total) * 100) : 0;

  document.getElementById('mastery-bar-fill').style.width = `${pct}%`;
  document.getElementById('mastery-text').textContent = `${mastered} / ${total} mots maîtrisés`;

  try {
    const { history } = await apiGet('/api/quiz-history');
    renderHistoryChart(history);
  } catch (e) {
    console.error("Échec du chargement de l'historique :", e.message);
  }
}

function renderHistoryChart(history) {
  const container = document.getElementById('history-container');

  if (!history || history.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-emoji">📊</div>
        <p>Aucun quiz pour l'instant.<br>Lancez-en un pour voir vos résultats ici !</p>
      </div>`;
    return;
  }

  const recent = [...history].reverse(); // du plus ancien au plus récent

  const chart = document.createElement('div');
  chart.className = 'history-chart';

  recent.forEach((entry) => {
    const pct = Math.round((entry.score / entry.total) * 100);
    const date = new Date(entry.playedAt);
    const dateLabel = `${date.getDate()}/${date.getMonth() + 1}`;

    const wrap = document.createElement('div');
    wrap.className = 'history-bar-wrap';
    wrap.innerHTML = `
      <div class="history-bar" style="height:${pct}%" title="${dateLabel} — ${entry.score}/${entry.total}"></div>
      <span class="history-bar-label">${dateLabel}</span>`;
    chart.appendChild(wrap);
  });

  container.innerHTML = '';
  container.appendChild(chart);
}

// ── Lancement ────────────────────────────────────────

init();
