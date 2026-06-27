/* =====================================================
   한국어 Flash — Script principal
   Modules : Flashcards · Quiz · Mes Cartes
===================================================== */

// ── Données ─────────────────────────────────────────

// 60 mots pré-définis chargés depuis le JSON de la page
const VOCAB = JSON.parse(document.getElementById('vocab-data').textContent);

// Clés de sauvegarde localStorage
const LS_PROGRESS = 'hgflash_progress'; // { cardId: 'mastered'|'review' }
const LS_CUSTOM   = 'hgflash_custom';   // tableau de cartes perso

// État global de l'application
const state = {
  progress:     {},   // statut de chaque carte
  custom:       [],   // cartes personnalisées
  filter:       'all',
  currentIndex: 0,
};

// ── Initialisation ───────────────────────────────────

function init() {
  const savedProgress = localStorage.getItem(LS_PROGRESS);
  const savedCustom   = localStorage.getItem(LS_CUSTOM);
  if (savedProgress) state.progress = JSON.parse(savedProgress);
  if (savedCustom)   state.custom   = JSON.parse(savedCustom);

  setupNavigation();
  setupFlashcards();
  setupQuiz();
  setupMesCartes();
}

// ── Persistance ──────────────────────────────────────

function saveProgress() {
  localStorage.setItem(LS_PROGRESS, JSON.stringify(state.progress));
}

function saveCustom() {
  localStorage.setItem(LS_CUSTOM, JSON.stringify(state.custom));
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
    });
  });
}

// ══════════════════════════════════════════════════════
//  FLASHCARDS
// ══════════════════════════════════════════════════════

// Renvoie les cartes à afficher selon le filtre actif
function getFilteredCards() {
  // On combine les cartes pré-définies et les cartes perso
  const all = [...VOCAB, ...state.custom.map(c => ({ ...c, category: 'Mes Cartes' }))];

  if (state.filter === 'mastered') return all.filter(c => state.progress[c.id] === 'mastered');
  if (state.filter === 'review')   return all.filter(c => state.progress[c.id] === 'review');
  return all;
}

function renderFlashcard() {
  const cards = getFilteredCards();
  const card  = cards[state.currentIndex];

  // Réinitialiser le flip à chaque changement de carte
  document.getElementById('card-flip').classList.remove('flipped');

  if (!card) {
    document.getElementById('card-hangeul-front').textContent = '🌸';
    document.getElementById('card-category').textContent      = '';
    document.getElementById('card-hangeul-back').textContent  = '';
    document.getElementById('card-romanisation').textContent  = '';
    document.getElementById('card-translation').textContent   = 'Aucune carte ici';
    document.getElementById('card-current').textContent = '0';
    document.getElementById('card-total').textContent   = '0';
    return;
  }

  document.getElementById('card-hangeul-front').textContent = card.hangeul;
  document.getElementById('card-category').textContent      = card.category || '';
  document.getElementById('card-hangeul-back').textContent  = card.hangeul;
  document.getElementById('card-romanisation').textContent  = card.romanisation;
  document.getElementById('card-translation').textContent   = card.translation;
  document.getElementById('card-current').textContent = state.currentIndex + 1;
  document.getElementById('card-total').textContent   = cards.length;

  updateStats();
}

function updateStats() {
  const allCards = [...VOCAB, ...state.custom];
  const mastered = allCards.filter(c => state.progress[c.id] === 'mastered').length;
  const review   = allCards.filter(c => state.progress[c.id] === 'review').length;
  const unseen   = Math.max(0, allCards.length - mastered - review);

  document.getElementById('stat-mastered').textContent = mastered;
  document.getElementById('stat-review').textContent   = review;
  document.getElementById('stat-unseen').textContent   = unseen;
}

function markCard(status) {
  const cards = getFilteredCards();
  const card  = cards[state.currentIndex];
  if (!card) return;

  state.progress[card.id] = status;
  saveProgress();

  // Garder l'index dans les bornes après filtrage
  const updated = getFilteredCards();
  if (state.currentIndex >= updated.length) {
    state.currentIndex = Math.max(0, updated.length - 1);
  }
  renderFlashcard();
}

function setupFlashcards() {
  // Clic sur la carte → flip
  document.getElementById('card-scene').addEventListener('click', () => {
    document.getElementById('card-flip').classList.toggle('flipped');
  });

  // Navigation
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

  // Progression
  document.getElementById('btn-mastered').addEventListener('click', () => markCard('mastered'));
  document.getElementById('btn-review').addEventListener('click',   () => markCard('review'));

  // Filtres
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filter       = btn.dataset.filter;
      state.currentIndex = 0;
      renderFlashcard();
    });
  });

  // Raccourcis clavier (actifs uniquement sur la vue flashcards)
  document.addEventListener('keydown', e => {
    if (!document.getElementById('view-flashcards').classList.contains('active')) return;
    const cards = getFilteredCards();

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

const quiz = { questions: [], current: 0, score: 0, answered: false };

function setupQuiz() {
  document.getElementById('btn-start-quiz').addEventListener('click', startQuiz);
  document.getElementById('btn-retry').addEventListener('click', () => {
    document.getElementById('quiz-result').classList.add('hidden');
    document.getElementById('quiz-start').classList.remove('hidden');
  });
}

function startQuiz() {
  const allCards = [...VOCAB, ...state.custom.map(c => ({ ...c }))];
  quiz.questions = shuffle(allCards).slice(0, Math.min(10, allCards.length));
  quiz.current   = 0;
  quiz.score     = 0;

  document.getElementById('quiz-start').classList.add('hidden');
  document.getElementById('quiz-result').classList.add('hidden');
  document.getElementById('quiz-question').classList.remove('hidden');

  renderQuizQuestion();
}

function renderQuizQuestion() {
  const q = quiz.questions[quiz.current];
  quiz.answered = false;

  // Barre de progression
  const pct = (quiz.current / quiz.questions.length) * 100;
  document.getElementById('quiz-progress-fill').style.width = `${pct}%`;
  document.getElementById('quiz-q-num').textContent       = quiz.current + 1;
  document.getElementById('quiz-score-live').textContent  = quiz.score;

  // Mot à deviner
  document.getElementById('quiz-hangeul').textContent      = q.hangeul;
  document.getElementById('quiz-romanisation').textContent = q.romanisation;

  // 4 choix : 1 correct + 3 leurres parmi toutes les cartes
  const allCards    = [...VOCAB, ...state.custom];
  const distractors = shuffle(allCards.filter(c => String(c.id) !== String(q.id))).slice(0, 3);
  const choices     = shuffle([q, ...distractors]);

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
        // Montrer la bonne réponse
        container.querySelectorAll('.choice-btn').forEach(b => {
          if (b.dataset.id === String(q.id)) b.classList.add('correct');
        });
      }

      // Désactiver tous les boutons pendant le délai
      container.querySelectorAll('.choice-btn').forEach(b => (b.disabled = true));

      // Passer à la question suivante après 1,2 s
      setTimeout(() => {
        quiz.current++;
        if (quiz.current < quiz.questions.length) {
          renderQuizQuestion();
        } else {
          showQuizResult();
        }
      }, 1200);
    });

    container.appendChild(btn);
  });
}

function showQuizResult() {
  document.getElementById('quiz-question').classList.add('hidden');
  document.getElementById('quiz-result').classList.remove('hidden');
  document.getElementById('quiz-progress-fill').style.width = '100%';

  const score = quiz.score;
  const total = quiz.questions.length;
  const ratio = score / total;

  document.getElementById('result-score-num').textContent = score;

  let emoji, title, message;

  if (ratio === 1) {
    emoji   = '🏆';
    title   = 'Parfait !';
    message = '잘했어요 ! (Jal haesseoyo !) — Vous n\'avez fait aucune erreur !';
  } else if (ratio >= 0.8) {
    emoji   = '🎉';
    title   = 'Excellent !';
    message = '아주 잘했어요 ! (Aju jal haesseoyo !) — Encore un petit effort !';
  } else if (ratio >= 0.6) {
    emoji   = '😊';
    title   = 'Bien joué !';
    message = '계속 공부하세요 ! (Gyesok gongbuhaseyo !) — Continuez à pratiquer !';
  } else if (ratio >= 0.4) {
    emoji   = '💪';
    title   = 'Courage !';
    message = '더 연습해요 ! (Deo yeonseupaeyo !) — Il faut s\'entraîner davantage.';
  } else {
    emoji   = '📚';
    title   = 'À revoir !';
    message = '처음부터 시작해요 ! — Recommencez depuis le début, vous allez y arriver !';
  }

  document.getElementById('result-emoji').textContent   = emoji;
  document.getElementById('result-title').textContent   = title;
  document.getElementById('result-message').textContent = message;
}

// ══════════════════════════════════════════════════════
//  MES CARTES
// ══════════════════════════════════════════════════════

function setupMesCartes() {
  document.getElementById('btn-add-card').addEventListener('click', addCard);

  // Ajouter une carte en appuyant sur Entrée depuis n'importe quel champ
  ['input-hangeul', 'input-roman', 'input-translation'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') addCard();
    });
  });

  renderMyCards();
}

function addCard() {
  const hangeul      = document.getElementById('input-hangeul').value.trim();
  const romanisation = document.getElementById('input-roman').value.trim();
  const translation  = document.getElementById('input-translation').value.trim();
  const errorEl      = document.getElementById('form-error');

  if (!hangeul || !romanisation || !translation) {
    errorEl.classList.remove('hidden');
    return;
  }

  errorEl.classList.add('hidden');

  state.custom.push({
    id:            `custom_${Date.now()}`,
    hangeul,
    romanisation,
    translation,
    category:      'Mes Cartes',
  });

  saveCustom();

  document.getElementById('input-hangeul').value     = '';
  document.getElementById('input-roman').value       = '';
  document.getElementById('input-translation').value = '';

  renderMyCards();
}

function deleteCard(id) {
  state.custom = state.custom.filter(c => c.id !== id);
  delete state.progress[id];
  saveCustom();
  saveProgress();
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
    item.className = 'my-card-item';
    item.innerHTML = `
      <button class="btn-delete" title="Supprimer cette carte">✕</button>
      <div class="my-card-kr">${card.hangeul}</div>
      <div class="my-card-roman">${card.romanisation}</div>
      <div class="my-card-translation">${card.translation}</div>`;
    item.querySelector('.btn-delete').addEventListener('click', () => deleteCard(card.id));
    grid.appendChild(item);
  });

  container.innerHTML = '';
  container.appendChild(grid);
}

// ── Utilitaires ──────────────────────────────────────

// Mélange un tableau (algorithme Fisher-Yates)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Lancement ────────────────────────────────────────

init();
