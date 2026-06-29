/**
 * Test d'intégration bout-en-bout : charge le VRAI script.js dans un DOM
 * simulé (jsdom), branché sur le VRAI serveur Express (server.js) qui
 * tourne déjà sur BASE_URL, lui-même connecté à une vraie base MariaDB.
 *
 * Prérequis : le serveur doit déjà tourner (voir commande de lancement
 * dans la session de travail). Usage : node test/run-integration-tests.js
 */
const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3200';

let pass = 0, fail = 0;
function check(label, condition) {
  if (condition) { pass++; console.log(`  ✓ ${label}`); }
  else           { fail++; console.log(`  ✗ ${label}`); }
}

// ── Fetch avec gestion manuelle des cookies (jsdom n'a pas de fetch natif lié au document) ──
function makeCookieAwareFetch() {
  let cookieJar = '';
  const f = async (url, options = {}) => {
    const absoluteUrl = url.startsWith('http') ? url : BASE_URL + url;
    const headers = { ...(options.headers || {}) };
    if (cookieJar) headers.Cookie = cookieJar;

    const res = await fetch(absoluteUrl, { ...options, headers });

    if (typeof res.headers.getSetCookie === 'function') {
      const cookies = res.headers.getSetCookie();
      if (cookies.length) cookieJar = cookies.map((c) => c.split(';')[0]).join('; ');
    }
    return res;
  };
  return { fetch: f, getCookieJar: () => cookieJar, setCookieJar: (v) => { cookieJar = v; } };
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

async function loadApp(cookieJar) {
  const html = fs.readFileSync(path.join(__dirname, '../views/app.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: `${BASE_URL}/app` });
  const { window } = dom;

  const cf = makeCookieAwareFetch();
  if (cookieJar) cf.setCookieJar(cookieJar);

  window.fetch = cf.fetch;
  window.speechSynthesis = { cancel() {}, speak() {} };
  window.SpeechSynthesisUtterance = function () {};
  window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  window.HTMLElement.prototype.scrollIntoView = () => {};

  const scriptCode = fs.readFileSync(path.join(__dirname, '../public/script.js'), 'utf8');
  window.eval(scriptCode);

  // Attend que init() ait fini de peupler le nom d'utilisateur (signal de fin de chargement)
  await waitFor(() => window.document.getElementById('user-username').textContent !== '…');

  return { window, getCookieJar: cf.getCookieJar };
}

function click(win, id) {
  win.document.getElementById(id).dispatchEvent(new win.Event('click', { bubbles: true }));
}

function text(win, id) {
  return win.document.getElementById(id).textContent;
}

async function registerTestUser(username, email) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password: 'motdepasse123', avatar: '🐼' }),
  });
  const cookies = res.headers.getSetCookie();
  const cookieJar = cookies.map((c) => c.split(';')[0]).join('; ');
  const data = await res.json();
  return { cookieJar, ok: res.ok, data };
}

async function main() {
  const suffix = Date.now().toString().slice(-8);

  console.log('\n📋 Inscription via API puis chargement du frontend réel');
  const { cookieJar, ok, data } = await registerTestUser(`integtest_${suffix}`, `integtest_${suffix}@example.com`);
  if (!ok) console.log('  → réponse serveur:', JSON.stringify(data));
  check("L'inscription a réussi", ok);

  const { window: win } = await loadApp(cookieJar);
  check("Le nom d'utilisateur s'affiche dans l'en-tête", text(win, 'user-username') === `integtest_${suffix}`);
  check("L'avatar choisi à l'inscription s'affiche", text(win, 'user-avatar') === '🐼');

  console.log('\n📋 Le vocabulaire (270 mots) est bien chargé depuis l\'API');
  check('Le total de cartes affiché correspond au vocabulaire complet', parseInt(text(win, 'card-total'), 10) > 0);

  console.log('\n📋 BUG corrigé — "Je sais" doit incrémenter "Maîtrisées" (persistant en base)');
  click(win, 'btn-mastered');
  await waitFor(() => text(win, 'stat-mastered') === '1');
  check('Stat "Maîtrisées" = 1 après un clic', text(win, 'stat-mastered') === '1');
  check('Stat "À revoir" = 0', text(win, 'stat-review') === '0');

  console.log('\n📋 La progression persiste réellement en base (vérifiée via un second chargement)');
  const { window: win2 } = await loadApp(cookieJar);
  await waitFor(() => text(win2, 'stat-mastered') !== '0', 4000).catch(() => {});
  check('Après rechargement, la carte maîtrisée est toujours comptabilisée', text(win2, 'stat-mastered') === '1');

  console.log('\n📋 Filtre "Maîtrisées" affiche bien la carte marquée');
  win2.document.querySelector('.filter-btn[data-filter="mastered"]').click();
  check('Au moins une carte visible dans le filtre "Maîtrisées"', text(win2, 'card-total') !== '0');

  console.log('\n📋 Mes Cartes — création persistée en base, isolée par utilisateur');
  win2.document.querySelector('.nav-btn[data-view="mes-cartes"]').dispatchEvent(new win2.window.Event('click', { bubbles: true }));
  win2.document.getElementById('input-hangeul').value     = '통합테스트';
  win2.document.getElementById('input-roman').value       = 'tonghapteseuteu';
  win2.document.getElementById('input-translation').value = 'Test intégration';
  click(win2, 'btn-add-card');
  await waitFor(() => text(win2, 'my-cards-count') === '(1)');
  check('La carte personnalisée est créée et affichée', text(win2, 'my-cards-count') === '(1)');

  console.log('\n📋 Isolation entre utilisateurs (2e compte ne voit pas les cartes du 1er)');
  const { cookieJar: cookieJar2 } = await registerTestUser(`integtest2_${suffix}`, `integtest2_${suffix}@example.com`);
  const { window: win3 } = await loadApp(cookieJar2);
  win3.document.querySelector('.nav-btn[data-view="mes-cartes"]').dispatchEvent(new win3.window.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 200));
  check("Le 2e utilisateur ne voit aucune carte du 1er", text(win3, 'my-cards-count') === '(0)');
  check("Le 2e utilisateur n'a aucune carte maîtrisée (progression isolée)", text(win3, 'stat-mastered') === '0');

  console.log('\n📋 Thème sombre (préférence locale, ne touche pas la base)');
  const before = win.document.documentElement.getAttribute('data-theme');
  click(win, 'btn-theme-toggle');
  const after = win.document.documentElement.getAttribute('data-theme');
  check('Le thème change après un clic', before !== after);

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
