/* =====================================================
   한국어 Flash — Script principal
   Modules : Flashcards · Quiz · Mes Cartes · Stats
===================================================== */

// ── Données ─────────────────────────────────────────

const VOCAB = JSON.parse(document.getElementById('vocab-data').textContent);

// Clés de sauvegarde localStorage
const LS_PROGRESS = 'hgflash_progress';
const LS_CUSTOM   = 'hgflash_custom';
const LS_THEME    = 'hgflash_theme';
const LS_HISTORY  = 'hgflash_history';
const LS_STREAK    = 'hgflash_streak';

// Intervalles (en jours) du système Leitner à 5 boîtes
const LEITNER_INTERVALS = [0, 1, 3, 7, 14];

// État global de l'application
const state = {
  progress:       {},                       // { cardId: {box, nextReview, lastAction} }
  custom:         [],                       // cartes personnalisées
  filter:         'all',                    // toutes / review / mastered
  categoryFilter: 'all',                    // filtre par catégorie (flashcards)
  currentIndex:   0,
  streak:         { current: 0, longest: 0, lastDate: null },
  history:        [],                       // historique des quiz
};

let currentCard   = null;  // carte flashcard affichée (pour le bouton son)
let editingId      = null; // id de la carte perso en cours d'édition

// ── Initialisation ───────────────────────────────────

function init() {
  loadFromStorage();
  applyInitialTheme();

  setupNavigation();
  setupTheme();
  setupFlashcards();
  setupQuiz();
  setupMesCartes();

  refreshCategorySelects();
}

function loadFromStorage() {
  const savedProgress = localStorage.getItem(LS_PROGRESS);
  const savedCustom   = localStorage.getItem(LS_CUSTOM);
  const savedStreak   = localStorage.getItem(LS_STREAK);
  const savedHistory  = localStorage.getItem(LS_HISTORY);

  if (savedProgress) state.progress = migrateProgress(JSON.parse(savedProgress));
  if (savedCustom)   state.custom   = JSON.parse(savedCustom);
  if (savedStreak)   state.streak   = JSON.parse(savedStreak);
  if (savedHistory)  state.history  = JSON.parse(savedHistory);
}

// Convertit l'ancien format ('mastered'/'review') vers le nouveau format Leitner
function migrateProgress(raw) {
  const migrated = {};
  Object.keys(raw).forEach(id => {
    const entry = raw[id];
    if (typeof entry === 'string') {
      migrated[id] = {
        box:        entry === 'mastered' ? 5 : 1,
        nextReview: todayStr(),
        lastAction: entry,
      };
    } else {
      migrated[id] = entry;
    }
  });
  return migrated;
}

// ── Persistance ──────────────────────────────────────

function saveProgress() { localStorage.setItem(LS_PROGRESS, JSON.stringify(state.progress)); }
function saveCustom()   { localStorage.setItem(LS_CUSTOM,   JSON.stringify(state.custom));   }
function saveStreak()   { localStorage.setItem(LS_STREAK,   JSON.stringify(state.streak));   }
function saveHistory()  { localStorage.setItem(LS_HISTORY,  JSON.stringify(state.history));  }

// ── Utilitaires date / texte ─────────────────────────

// Date du jour au format YYYY-MM-DD (fuseau local)
function todayStr() {
  const d      = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Mélange un tableau (Fisher-Yates)
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

// Distance de Levenshtein (tolérance aux fautes de frappe)
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

// Synthèse vocale du navigateur — gratuite, sans dépendance
function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch (e) { /* la synthèse vocale n'est pas disponible — on ignore */ }
}

// ── Série de jours (streak) ──────────────────────────

function recordActivity() {
  const today = todayStr();
  if (state.streak.lastDate === today) return; // déjà comptabilisé aujourd'hui

  const yesterday = addDays(today, -1);
  state.streak.current = (state.streak.lastDate === yesterday) ? state.streak.current + 1 : 1;
  state.streak.longest = Math.max(state.streak.longest, state.streak.current);
  state.streak.lastDate = today;
  saveStreak();
}

// ── Navigation entre vues ────────────────────────────

function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.view;

      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`view-${target}`).classList.add('active');

      if (target === 'mes-cartes') renderMyCards();
      if (target === 'flashcards') renderFlashcard();
      if (target === 'stats')      renderStats();
    });
  });
}

// ── Thème clair / sombre ──────────────────────────────

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
    const next     = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(LS_THEME, next);
  });
}

// ── Catégories ────────────────────────────────────────

function getAllCategories() {
  const cats = [...new Set(VOCAB.map(c => c.category))];
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

  getAllCategories().forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    selectEl.appendChild(opt);
  });

  // Restaure la sélection précédente si elle existe toujours
  if ([...selectEl.options].some(o => o.value === previousValue)) {
    selectEl.value = previousValue;
  }
}

// ══════════════════════════════════════════════════════
//  FLASHCARDS
// ══════════════════════════════════════════════════════

function getAllCards() {
  return [...VOCAB, ...state.custom.map(c => ({ ...c, category: 'Mes Cartes' }))];
}

function getFilteredCards() {
  let cards = getAllCards();

  if (state.categoryFilter !== 'all') {
    cards = cards.filter(c => c.category === state.categoryFilter);
  }

  if (state.filter === 'review') {
    cards = cards.filter(c => state.progress[c.id] && state.progress[c.id].lastAction === 'review');
  } else if (state.filter === 'mastered') {
    cards = cards.filter(c => state.progress[c.id] && state.progress[c.id].box === 5);
  } else {
    // "Toutes" : les cartes dues (à réviser) passent en premier — spaced repetition légère
    const today = todayStr();
    cards = [...cards].sort((a, b) => {
      const dueA = !state.progress[a.id] || state.progress[a.id].nextReview <= today ? 0 : 1;
      const dueB = !state.progress[b.id] || state.progress[b.id].nextReview <= today ? 0 : 1;
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

  allCards.forEach(c => {
    const entry = state.progress[c.id];
    if (entry) {
      if (entry.box === 5) mastered++;
      else review++;
    }
  });

  const unseen = Math.max(0, allCards.length - mastered - review);

  document.getElementById('stat-mastered').textContent = mastered;
  document.getElementById('stat-review').textContent   = review;
  document.getElementById('stat-unseen').textContent   = unseen;
}

function markCard(action) {
  if (!currentCard) return;

  const entry = state.progress[currentCard.id] || { box: 1, nextReview: todayStr(), lastAction: null };

  entry.box        = action === 'mastered' ? Math.min(5, entry.box + 1) : 1;
  entry.lastAction = action;
  entry.nextReview = addDays(todayStr(), LEITNER_INTERVALS[entry.box - 1]);

  state.progress[currentCard.id] = entry;
  saveProgress();
  recordActivity();

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

  // Boutons son (recto + verso)
  ['speak-front-btn', 'speak-back-btn'].forEach(id => {
    document.getElementById(id).addEventListener('click', e => {
      e.stopPropagation(); // ne pas déclencher le flip
      if (currentCard) speak(currentCard.hangeul);
    });
  });

  // Filtres de statut
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filter       = btn.dataset.filter;
      state.currentIndex = 0;
      renderFlashcard();
    });
  });

  // Filtre catégorie
  document.getElementById('category-filter').addEventListener('change', e => {
    state.categoryFilter = e.target.value;
    state.currentIndex   = 0;
    renderFlashcard();
  });

  // Raccourcis clavier
  document.addEventListener('keydown', e => {
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
  // Réglages : catégorie
  document.getElementById('quiz-category-select').addEventListener('change', e => {
    quiz.settings.category = e.target.value;
  });

  // Réglages : nombre de questions
  document.querySelectorAll('#quiz-count-group .option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#quiz-count-group .option-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      quiz.settings.count = parseInt(btn.dataset.count, 10);
    });
  });

  // Réglages : mode (QCM / saisie)
  document.querySelectorAll('#quiz-mode-group .option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#quiz-mode-group .option-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      quiz.settings.mode = btn.dataset.mode;
    });
  });

  document.getElementById('btn-start-quiz').addEventListener('click', startQuiz);
  document.getElementById('btn-retry').addEventListener('click', () => {
    document.getElementById('quiz-result').classList.add('hidden');
    document.getElementById('quiz-start').classList.remove('hidden');
  });

  // Bouton son sur le mot du quiz
  document.getElementById('quiz-speak-btn').addEventListener('click', () => {
    const q = quiz.questions[quiz.current];
    if (q) speak(q.hangeul);
  });

  // Mode saisie : validation
  document.getElementById('quiz-typing-submit').addEventListener('click', submitTypingAnswer);
  document.getElementById('quiz-typing-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitTypingAnswer();
  });
}

function startQuiz() {
  let pool = getAllCards();
  if (quiz.settings.category !== 'all') {
    pool = pool.filter(c => c.category === quiz.settings.category);
  }

  const count = Math.min(quiz.settings.count, pool.length);
  quiz.questions = shuffle(pool).slice(0, count);
  quiz.current   = 0;
  quiz.score     = 0;

  document.getElementById('quiz-start').classList.add('hidden');
  document.getElementById('quiz-result').classList.add('hidden');
  document.getElementById('quiz-question').classList.remove('hidden');

  // Afficher la bonne interface selon le mode
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
  document.getElementById('quiz-q-num').textContent       = quiz.current + 1;
  document.getElementById('quiz-score-live').textContent  = quiz.score;
  document.querySelector('.quiz-meta span').innerHTML =
    `Question <strong id="quiz-q-num">${quiz.current + 1}</strong>/${quiz.questions.length}`;

  document.getElementById('quiz-hangeul').textContent      = q.hangeul;
  document.getElementById('quiz-romanisation').textContent = q.romanisation;

  if (quiz.settings.mode === 'typing') {
    renderTypingQuestion(q);
  } else {
    renderQcmQuestion(q);
  }
}

function renderQcmQuestion(q) {
  const allCards    = getAllCards();
  const distractors = shuffle(allCards.filter(c => String(c.id) !== String(q.id))).slice(0, 3);
  const choices      = shuffle([q, ...distractors]);

  const container = document.getElementById('quiz-choices');
  container.innerHTML = '';

  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className   = 'choice-btn';
    btn.textContent = choice.translation;
    btn.dataset.id  = String(choice.id);

    btn.addEventListener('click', () => {
      if (quiz.answered) return;
      quiz.answered = true;

      const isCorrect = String(choice.id) === String(q.id);
      if (isCorrect) {
        btn.classList.add('correct');
        quiz.score++;
      } else {
        btn.classList.add('wrong');
        container.querySelectorAll('.choice-btn').forEach(b => {
          if (b.dataset.id === String(q.id)) b.classList.add('correct');
        });
      }

      container.querySelectorAll('.choice-btn').forEach(b => (b.disabled = true));
      setTimeout(goToNextQuestion, 1200);
    });

    container.appendChild(btn);
  });
}

function renderTypingQuestion(q) {
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

function showQuizResult() {
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

  // Enregistrement dans l'historique
  state.history.unshift({
    date:     new Date().toISOString(),
    score, total,
    mode:     quiz.settings.mode,
    category: quiz.settings.category,
  });
  state.history = state.history.slice(0, 20);
  saveHistory();
  recordActivity();
}

// ══════════════════════════════════════════════════════
//  MES CARTES
// ══════════════════════════════════════════════════════

function setupMesCartes() {
  document.getElementById('btn-add-card').addEventListener('click', saveCard);
  document.getElementById('btn-cancel-edit').addEventListener('click', cancelEdit);

  ['input-hangeul', 'input-roman', 'input-translation'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') saveCard();
    });
  });

  renderMyCards();
}

function saveCard() {
  const hangeul      = document.getElementById('input-hangeul').value.trim();
  const romanisation = document.getElementById('input-roman').value.trim();
  const translation  = document.getElementById('input-translation').value.trim();
  const errorEl      = document.getElementById('form-error');

  if (!hangeul || !romanisation || !translation) {
    errorEl.classList.remove('hidden');
    return;
  }
  errorEl.classList.add('hidden');

  if (editingId) {
    const card = state.custom.find(c => c.id === editingId);
    if (card) { card.hangeul = hangeul; card.romanisation = romanisation; card.translation = translation; }
    cancelEdit();
  } else {
    state.custom.push({ id: `custom_${Date.now()}`, hangeul, romanisation, translation });
    clearForm();
  }

  saveCustom();
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

function deleteCard(id) {
  state.custom = state.custom.filter(c => c.id !== id);
  delete state.progress[id];
  saveCustom();
  saveProgress();
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

  state.custom.forEach(card => {
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

function renderStats() {
  document.getElementById('streak-current').textContent = state.streak.current;
  document.getElementById('streak-longest').textContent = state.streak.longest;

  const allCards = getAllCards();
  const mastered = allCards.filter(c => state.progress[c.id] && state.progress[c.id].box === 5).length;
  const total    = allCards.length;
  const pct       = total ? Math.round((mastered / total) * 100) : 0;

  document.getElementById('mastery-bar-fill').style.width = `${pct}%`;
  document.getElementById('mastery-text').textContent = `${mastered} / ${total} mots maîtrisés`;

  renderHistoryChart();
}

function renderHistoryChart() {
  const container = document.getElementById('history-container');

  if (state.history.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-emoji">📊</div>
        <p>Aucun quiz pour l'instant.<br>Lancez-en un pour voir vos résultats ici !</p>
      </div>`;
    return;
  }

  // Les 8 derniers quiz, du plus ancien au plus récent
  const recent = state.history.slice(0, 8).reverse();

  const chart = document.createElement('div');
  chart.className = 'history-chart';

  recent.forEach(entry => {
    const pct = Math.round((entry.score / entry.total) * 100);
    const date = new Date(entry.date);
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
