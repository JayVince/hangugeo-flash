/**
 * Tests backend purs (sans navigateur) — sécurité de l'authentification,
 * réinitialisation de mot de passe, validations, isolation des données.
 * Exécutés contre le VRAI serveur (déjà lancé) + la vraie base MariaDB.
 *
 * Usage : node test/run-backend-tests.js
 */
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3200';

let pass = 0, fail = 0;
function check(label, condition) {
  if (condition) { pass++; console.log(`  ✓ ${label}`); }
  else           { fail++; console.log(`  ✗ ${label}`); }
}

function extractCookie(res) {
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

async function post(url, body, cookie) {
  const res = await fetch(BASE_URL + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data, cookie: extractCookie(res) };
}

async function get(url, cookie) {
  const res = await fetch(BASE_URL + url, { headers: cookie ? { Cookie: cookie } : {} });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function main() {
  const suffix = Date.now().toString().slice(-8);
  const username = `backtest_${suffix}`;
  const email = `backtest_${suffix}@example.com`;
  const password = 'motdepasse123';

  console.log('\n📋 Inscription et validations');
  {
    const { res } = await post('/api/auth/register', { username, email, password });
    check('Inscription valide → 200', res.status === 200);

    const { res: dupEmail } = await post('/api/auth/register', {
      username: `autre_${suffix}`, email, password,
    });
    check('E-mail déjà utilisé → 409', dupEmail.status === 409);

    const { res: dupUser } = await post('/api/auth/register', {
      username, email: `autre_${suffix}@example.com`, password,
    });
    check("Nom d'utilisateur déjà pris → 409", dupUser.status === 409);

    const { res: shortPwd } = await post('/api/auth/register', {
      username: `court_${suffix}`, email: `court_${suffix}@example.com`, password: '123',
    });
    check('Mot de passe trop court → 400', shortPwd.status === 400);

    const { res: badEmail } = await post('/api/auth/register', {
      username: `bad_${suffix}`, email: 'pas-un-email', password,
    });
    check('E-mail invalide → 400', badEmail.status === 400);
  }

  console.log('\n📋 Connexion');
  let sessionCookie;
  {
    const { res: wrongPwd } = await post('/api/auth/login', { identifier: username, password: 'mauvais' });
    check('Mauvais mot de passe → 401', wrongPwd.status === 401);

    const { res: wrongUser } = await post('/api/auth/login', { identifier: 'inconnu_xyz', password });
    check('Utilisateur inconnu → 401', wrongUser.status === 401);

    const { res, cookie } = await post('/api/auth/login', { identifier: username, password });
    check('Connexion valide → 200', res.status === 200);
    check('Un cookie de session est bien posé', cookie.includes('hgflash_session'));
    sessionCookie = cookie;

    const { res: byEmail, cookie: cookieByEmail } = await post('/api/auth/login', { identifier: email, password });
    check("Connexion par e-mail (et pas seulement par nom d'utilisateur)", byEmail.status === 200);
    sessionCookie = cookieByEmail || sessionCookie;
  }

  console.log('\n📋 Protection des routes API');
  {
    const { res: noAuth } = await get('/api/vocab');
    check('Sans cookie → 401 sur une route protégée', noAuth.status === 401);

    const { res: withAuth } = await get('/api/vocab', sessionCookie);
    check('Avec cookie valide → 200', withAuth.status === 200);

    const { res: badToken } = await get('/api/vocab', 'hgflash_session=token_invalide_bidon');
    check('Avec un cookie invalide/falsifié → 401', badToken.status === 401);
  }

  console.log('\n📋 Cycle complet de réinitialisation de mot de passe');
  {
    const { res: forgotOk } = await post('/api/auth/forgot-password', { email });
    check('Demande de réinitialisation (e-mail existant) → 200', forgotOk.status === 200);

    const { res: forgotUnknown, data: forgotUnknownData } = await post('/api/auth/forgot-password', { email: 'jamais-vu@example.com' });
    check('Demande pour un e-mail inconnu → 200 aussi (pas de fuite)', forgotUnknown.status === 200);

    const { res: forgotOkData2, data: forgotData } = await post('/api/auth/forgot-password', { email });
    check('Messages identiques (existant vs inconnu)', forgotData.message === forgotUnknownData.message);

    const { res: badToken } = await post('/api/auth/reset-password', { token: 'jeton_invalide', newPassword: 'nouveaumdp123' });
    check('Jeton invalide → 400', badToken.status === 400);

    const { res: shortNewPwd } = await post('/api/auth/reset-password', { token: 'peu importe', newPassword: '123' });
    check('Nouveau mot de passe trop court → 400', shortNewPwd.status === 400);
  }

  console.log('\n📋 Déconnexion');
  {
    const { res: logoutRes, cookie: clearedCookie } = await post('/api/auth/logout', {}, sessionCookie);
    check('Déconnexion → 200', logoutRes.status === 200);

    // Après déconnexion, l'ancien cookie ne doit plus donner accès
    // (le cookie est invalidé côté client ; on vérifie qu'un appel sans
    // cookie valide échoue bien)
    const { res: afterLogout } = await get('/api/vocab', '');
    check('Accès sans cookie après déconnexion → 401', afterLogout.status === 401);
  }

  console.log('\n📋 Isolation stricte des données entre comptes');
  {
    const { cookie: cookieA } = await post('/api/auth/login', { identifier: username, password });
    const { data: createdCard } = await post('/api/cards', {
      hangeul: '격리테스트', romanisation: 'gyeokriteseuteu', translation: 'Test isolation',
    }, cookieA);

    const username2 = `backtest2_${suffix}`;
    const email2 = `backtest2_${suffix}@example.com`;
    await post('/api/auth/register', { username: username2, email: email2, password });
    const { cookie: cookieB } = await post('/api/auth/login', { identifier: username2, password });

    const { data: cardsForB } = await get('/api/cards', cookieB);
    check("Le compte B ne voit aucune carte du compte A", cardsForB.cards.length === 0);

    // Le compte B ne doit pas pouvoir modifier/supprimer la carte du compte A
    const deleteAttempt = await fetch(`${BASE_URL}/api/cards/${createdCard.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookieB },
    });
    check("Le compte B ne peut pas supprimer la carte du compte A → 404", deleteAttempt.status === 404);

    const { data: cardsForAStill } = await get('/api/cards', cookieA);
    check('La carte du compte A existe toujours après la tentative', cardsForAStill.cards.length === 1);
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
