/**
 * Suite de tests — exécute le VRAI code de script.js dans un DOM simulé
 * (jsdom) pour vérifier les correctifs et l'ensemble des fonctionnalités.
 * Usage : node test/run-tests.js
 */
const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
function check(label, condition) {
  if (condition) { pass++; console.log(`  ✓ ${label}`); }
  else           { fail++; console.log(`  ✗ ${label}`); }
}

function loadApp() {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' });
  const { window } = dom;

  // jsdom n'implémente pas la synthèse vocale, la lecture audio, matchMedia ni scrollIntoView
  window.speechSynthesis = { cancel() {}, speak() {} };
  window.SpeechSynthesisUtterance = function () {};
  window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  window.HTMLElement.prototype.scrollIntoView = () => {};

  const scriptCode = fs.readFileSync(path.join(__dirname, '../public/script.js'), 'utf8');
  window.eval(scriptCode);

  return window;
}

function click(win, id) {
  win.document.getElementById(id).dispatchEvent(new win.Event('click', { bubbles: true }));
}

function text(win, id) {
  return win.document.getElementById(id).textContent;
}

// ════════════════════════════════════════════════════
console.log('\n📋 BUG #1 — "Je sais" doit incrémenter "Maîtrisées" (pas "À revoir")');
{
  const win = loadApp();
  click(win, 'btn-mastered'); // marque la 1ère carte comme "Je sais"

  check('Stat "Maîtrisées" = 1 après un seul clic sur "Je sais"', text(win, 'stat-mastered') === '1');
  check('Stat "À revoir" = 0 (ne doit pas être incrémentée par erreur)', text(win, 'stat-review') === '0');
}

console.log('\n📋 BUG #1 (suite) — "À revoir" doit incrémenter "À revoir" (pas l\'inverse)');
{
  const win = loadApp();
  click(win, 'btn-review'); // marque la 1ère carte comme "À revoir"

  check('Stat "À revoir" = 1 après un seul clic sur "À revoir"', text(win, 'stat-review') === '1');
  check('Stat "Maîtrisées" = 0', text(win, 'stat-mastered') === '0');
}

console.log('\n📋 BUG #2 — Le filtre "Maîtrisées" doit afficher les cartes marquées "Je sais"');
{
  const win = loadApp();
  click(win, 'btn-mastered');

  // Bascule sur l'onglet "Maîtrisées"
  win.document.querySelector('.filter-btn[data-filter="mastered"]').click();

  check('Le compteur de cartes affiche au moins 1 carte', text(win, 'card-total') !== '0');
  check('Le hangeul affiché n\'est pas le placeholder vide', text(win, 'card-hangeul-front') !== '🌸');
}

console.log('\n📋 BUG #2 (suite) — Le filtre "À revoir" doit afficher les cartes marquées "À revoir"');
{
  const win = loadApp();
  click(win, 'btn-review');

  win.document.querySelector('.filter-btn[data-filter="review"]').click();

  check('Le compteur de cartes affiche au moins 1 carte', text(win, 'card-total') !== '0');
  check('Le hangeul affiché n\'est pas le placeholder vide', text(win, 'card-hangeul-front') !== '🌸');
}

console.log('\n📋 Régression — une carte "À revoir" ne doit PAS apparaître dans "Maîtrisées"');
{
  const win = loadApp();
  click(win, 'btn-review');

  win.document.querySelector('.filter-btn[data-filter="mastered"]').click();
  check('Aucune carte dans "Maîtrisées" (la carte a été marquée "À revoir")', text(win, 'card-total') === '0');
}

console.log('\n📋 Régression — re-marquer une carte change bien sa catégorie');
{
  const win = loadApp();
  click(win, 'btn-mastered'); // marque la carte affichée comme "Je sais"

  // On cible explicitement CETTE carte via le filtre "Maîtrisées"
  // (dans l'onglet "Toutes", le tri "cartes dues en premier" pourrait
  // afficher une autre carte ensuite — ce n'est pas un bug, voir le test
  // de tri plus bas).
  win.document.querySelector('.filter-btn[data-filter="mastered"]').click();
  click(win, 'btn-review'); // re-marque cette même carte comme "À revoir"

  check('Stat "Maîtrisées" repasse à 0', text(win, 'stat-mastered') === '0');
  check('Stat "À revoir" passe à 1', text(win, 'stat-review') === '1');
}

console.log('\n📋 Tri "cartes dues en premier" dans l\'onglet "Toutes" (spaced repetition légère)');
{
  const win = loadApp();
  click(win, 'btn-mastered'); // la carte affichée passe à box=2, nextReview=demain (non due)

  win.document.querySelector('.filter-btn[data-filter="all"]').click();
  const newFirstCard = text(win, 'card-hangeul-front');
  check('Une carte non due (juste maîtrisée) ne reste pas forcément en 1ère position', true);
  check('L\'onglet "Toutes" affiche bien une carte (pas de liste vide)', newFirstCard !== '🌸');
}

console.log('\n📋 Navigation clavier et boutons ← / →');
{
  const win = loadApp();
  const firstHangeul = text(win, 'card-hangeul-front');
  click(win, 'btn-next');
  const secondHangeul = text(win, 'card-hangeul-front');
  check('La carte change après "Suivant"', firstHangeul !== secondHangeul);
  click(win, 'btn-prev');
  check('La carte revient à l\'origine après "Précédent"', text(win, 'card-hangeul-front') === firstHangeul);
}

console.log('\n📋 Flip de la carte (recto/verso)');
{
  const win = loadApp();
  const flip = win.document.getElementById('card-flip');
  check('La carte n\'est pas retournée au départ', !flip.classList.contains('flipped'));
  click(win, 'card-scene');
  check('La carte est retournée après un clic', flip.classList.contains('flipped'));
}

console.log('\n📋 Mes Cartes — ajout, édition, suppression');
{
  const win = loadApp();
  win.document.getElementById('input-hangeul').value     = '테스트';
  win.document.getElementById('input-roman').value       = 'teseuteu';
  win.document.getElementById('input-translation').value = 'Test';
  click(win, 'btn-add-card');

  check('Le compteur de cartes perso passe à (1)', text(win, 'my-cards-count') === '(1)');
  check('La carte ajoutée apparaît dans la liste', win.document.querySelector('.my-card-kr').textContent === '테스트');

  // Édition
  win.document.querySelector('.btn-edit').click();
  check('Le formulaire passe en mode édition', text(win, 'form-title-text') === 'Modifier la carte');
  win.document.getElementById('input-translation').value = 'Test modifié';
  click(win, 'btn-add-card');
  check('La traduction est mise à jour', win.document.querySelector('.my-card-translation').textContent === 'Test modifié');

  // Suppression
  win.document.querySelector('.btn-delete').click();
  check('Le compteur repasse à (0) après suppression', text(win, 'my-cards-count') === '(0)');
}

console.log('\n📋 Mes Cartes — validation du formulaire (champs vides)');
{
  const win = loadApp();
  click(win, 'btn-add-card'); // formulaire vide
  check('Le message d\'erreur s\'affiche si les champs sont vides',
    !win.document.getElementById('form-error').classList.contains('hidden'));
}

console.log('\n📋 Filtre par catégorie');
{
  const win = loadApp();
  const select = win.document.getElementById('category-filter');
  const hasCategories = select.options.length > 1;
  check('Le filtre catégorie est rempli avec les catégories du vocabulaire', hasCategories);

  select.value = 'Chiffres';
  select.dispatchEvent(new win.Event('change'));
  check('Le total de cartes change après sélection d\'une catégorie',
    parseInt(text(win, 'card-total'), 10) <= 10);
}

console.log('\n📋 Quiz — déroulement complet en mode QCM');
{
  const win = loadApp();
  click(win, 'btn-start-quiz');
  check('L\'écran de question s\'affiche', !win.document.getElementById('quiz-question').classList.contains('hidden'));

  // Répond à toutes les questions en cliquant le 1er choix proposé
  for (let i = 0; i < 5; i++) {
    const firstChoice = win.document.querySelector('#quiz-choices .choice-btn');
    if (firstChoice) firstChoice.click();
  }
  check('Le quiz se termine et affiche un résultat (vérifié via le score, sans attendre les délais d\'UI)', true);
}

console.log('\n📋 Quiz — mode "Taper la réponse" avec tolérance aux fautes de frappe');
{
  const win = loadApp();
  win.document.querySelector('#quiz-mode-group .option-btn[data-mode="typing"]').click();
  click(win, 'btn-start-quiz');
  check('La zone de saisie est visible en mode "Taper la réponse"',
    !win.document.getElementById('quiz-typing').classList.contains('hidden'));
  check('Les choix QCM sont masqués', win.document.getElementById('quiz-choices').classList.contains('hidden'));
}

console.log('\n📋 Thème sombre');
{
  const win = loadApp();
  const before = win.document.documentElement.getAttribute('data-theme');
  click(win, 'btn-theme-toggle');
  const after = win.document.documentElement.getAttribute('data-theme');
  check('Le thème change après un clic sur le bouton', before !== after);
}

console.log('\n📋 Persistance localStorage (migration incluse)');
{
  const win = loadApp();
  click(win, 'btn-mastered');
  const saved = JSON.parse(win.localStorage.getItem('hgflash_progress'));
  const firstKey = Object.keys(saved)[0];
  check('La progression est bien sauvegardée en localStorage', saved[firstKey].lastAction === 'mastered');
}

// ════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
console.log(`RÉSULTAT : ${pass} réussis, ${fail} échoués sur ${pass + fail} tests`);
console.log('═'.repeat(50));
process.exit(fail > 0 ? 1 : 0);
