/**
 * Tests frontend du panneau admin — pagination dynamique de la liste de
 * vocabulaire (calcul côté client, adaptée à la hauteur de fenêtre).
 * Charge le VRAI admin.js dans un DOM simulé (jsdom), branché sur le
 * VRAI serveur (déjà lancé) + la vraie base MariaDB.
 *
 * Usage : node test/run-admin-frontend-tests.js
 * Nécessite un compte admin déjà créé (voir TEST_ADMIN_USERNAME/PASSWORD).
 */
const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3200';
const ADMIN_IDENTIFIER = process.env.TEST_ADMIN_USERNAME;
const ADMIN_PASSWORD   = process.env.TEST_ADMIN_PASSWORD || 'motdepasse123';

let pass = 0, fail = 0;
function check(label, condition) {
  if (condition) { pass++; console.log(`  ✓ ${label}`); }
  else           { fail++; console.log(`  ✗ ${label}`); }
}

function waitFor(conditionFn, timeoutMs = 4000, intervalMs = 50) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (conditionFn()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('Timeout en attendant la condition'));
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

async function loadAdmin(cookieJar) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: `${BASE_URL}/admin` });
  const { window } = dom;

  let jar = cookieJar;
  window.fetch = async (url, options = {}) => {
    const absoluteUrl = url.startsWith('http') ? url : BASE_URL + url;
    const headers = { ...(options.headers || {}), Cookie: jar };
    const res = await fetch(absoluteUrl, { ...options, headers });
    if (typeof res.headers.getSetCookie === 'function') {
      const c = res.headers.getSetCookie();
      if (c.length) jar = c.map((x) => x.split(';')[0]).join('; ');
    }
    return res;
  };
  window.speechSynthesis = { cancel() {}, speak() {} };
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.confirm = () => true;
  window.alert = () => {};

  const scriptCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.js'), 'utf8');
  window.eval(scriptCode);

  await waitFor(() => window.document.getElementById('user-username').textContent !== '…');

  return window;
}

function click(win, id) {
  win.document.getElementById(id).dispatchEvent(new win.Event('click', { bubbles: true }));
}

async function main() {
  if (!ADMIN_IDENTIFIER) {
    console.error('✗ TEST_ADMIN_USERNAME manquant.');
    process.exit(1);
  }

  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: ADMIN_IDENTIFIER, password: ADMIN_PASSWORD }),
  });
  const cookies = res.headers.getSetCookie();
  const cookieJar = cookies.map((c) => c.split(';')[0]).join('; ');

  console.log('\n📋 Chargement de l\'onglet Vocabulaire (270+ mots)');
  const win = await loadAdmin(cookieJar);
  win.document.querySelector('.nav-btn[data-view="vocab"]').dispatchEvent(new win.Event('click', { bubbles: true }));
  await waitFor(() => win.document.querySelectorAll('#vocab-table-body tr').length > 0);

  console.log('\n📋 Pagination — taille de page dynamique');
  const rowCount = win.document.querySelectorAll('#vocab-table-body tr').length;
  check('Au moins 10 lignes affichées (minimum garanti)', rowCount >= 10);
  check('Au plus 50 lignes affichées (plafond raisonnable)', rowCount <= 50);

  const paginationLabel = win.document.querySelector('#vocab-pagination .admin-pagination-label').textContent;
  check('Le libellé de pagination indique bien 270+ mots au total', /\(\d{3,} mots?/.test(paginationLabel));
  check('Page 1 affichée au premier chargement', paginationLabel.includes('Page 1'));

  console.log('\n📋 Navigation entre les pages');
  const firstPageFirstWord = win.document.querySelector('#vocab-table-body tr td').textContent;
  click(win, 'vocab-next');
  await new Promise((r) => setTimeout(r, 50));
  const secondPageFirstWord = win.document.querySelector('#vocab-table-body tr td').textContent;
  check('Le contenu change après "Suivant"', firstPageFirstWord !== secondPageFirstWord);
  check('Le bouton "Précédent" est réactivé sur la page 2', !win.document.getElementById('vocab-prev').disabled);

  click(win, 'vocab-prev');
  await new Promise((r) => setTimeout(r, 50));
  const backToFirstWord = win.document.querySelector('#vocab-table-body tr td').textContent;
  check('Retour à la page 1 identique à l\'origine', backToFirstWord === firstPageFirstWord);
  check('Le bouton "Précédent" est désactivé sur la page 1', win.document.getElementById('vocab-prev').disabled);

  console.log('\n📋 Recherche — filtre et réinitialise la pagination');
  win.document.getElementById('vocab-search').value = 'bonjour';
  win.document.getElementById('vocab-search').dispatchEvent(new win.Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));

  const filteredRows = win.document.querySelectorAll('#vocab-table-body tr');
  check('La recherche réduit bien le nombre de résultats', filteredRows.length < rowCount);
  check('Le mot recherché apparaît dans les résultats',
    [...filteredRows].some((tr) => tr.textContent.toLowerCase().includes('bonjour')));

  win.document.getElementById('vocab-search').value = '';
  win.document.getElementById('vocab-search').dispatchEvent(new win.Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  check('La recherche vide restaure la liste complète paginée',
    win.document.querySelectorAll('#vocab-table-body tr').length === rowCount);

  console.log('\n📋 Édition/suppression toujours fonctionnelles avec la pagination');
  const editBtn = win.document.querySelector('#vocab-table-body .btn-edit');
  check('Un bouton "Modifier" est bien présent sur la page affichée', !!editBtn);
  if (editBtn) {
    editBtn.click();
    check('Le formulaire passe en mode édition', win.document.getElementById('vocab-form-title').textContent === 'Modifier le mot');
  }

  // ════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`RÉSULTAT : ${pass} réussis, ${fail} échoués sur ${pass + fail} tests`);
  console.log('═'.repeat(50));
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Erreur fatale dans la suite de tests :', err);
  process.exit(1);
});
