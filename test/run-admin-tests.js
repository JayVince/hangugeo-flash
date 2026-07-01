/**
 * Tests du panneau administrateur — permissions, CRUD utilisateurs et
 * vocabulaire, protections anti-auto-sabotage, journal d'audit.
 * Exécutés contre le VRAI serveur (déjà lancé) + la vraie base MariaDB.
 *
 * Usage : node test/run-admin-tests.js
 * Nécessite que le serveur ait démarré avec ADMIN_BOOTSTRAP_EMAIL défini
 * sur l'e-mail d'un compte existant (voir commande de lancement).
 */
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3200';
const ADMIN_IDENTIFIER = process.env.TEST_ADMIN_USERNAME;
const ADMIN_PASSWORD   = process.env.TEST_ADMIN_PASSWORD || 'motdepasse123';

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

async function put(url, body, cookie) {
  const res = await fetch(BASE_URL + url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function del(url, cookie) {
  const res = await fetch(BASE_URL + url, { method: 'DELETE', headers: { Cookie: cookie } });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function get(url, cookie) {
  const res = await fetch(BASE_URL + url, { headers: cookie ? { Cookie: cookie } : {} });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function main() {
  if (!ADMIN_IDENTIFIER) {
    console.error('✗ TEST_ADMIN_USERNAME manquant — indiquez le nom d\'utilisateur du compte bootstrappé admin.');
    process.exit(1);
  }

  const suffix = Date.now().toString().slice(-8);

  console.log('\n📋 Connexion admin et accès de base');
  const { cookie: adminCookie, res: loginRes } = await post('/api/auth/login', {
    identifier: ADMIN_IDENTIFIER, password: ADMIN_PASSWORD,
  });
  check('Connexion admin réussie', loginRes.status === 200);

  const { data: meData } = await get('/api/auth/me', adminCookie);
  check('Le rôle admin est bien renvoyé par /api/auth/me', meData.user.role === 'admin');
  const adminId = meData.user.id;

  const { res: pageRes } = await get('/admin', adminCookie).then(async ({ res }) => ({ res }));
  // Note: fetch suit les redirections par défaut ; on vérifie juste que ça n'échoue pas
  check('La page /admin est accessible', pageRes.status === 200 || pageRes.status === 304);

  console.log('\n📋 Un utilisateur normal est bloqué du panneau admin');
  const normalUsername = `admtest_${suffix}`;
  const normalEmail = `admtest_${suffix}@example.com`;
  await post('/api/auth/register', { username: normalUsername, email: normalEmail, password: 'motdepasse123' });
  const { cookie: normalCookie } = await post('/api/auth/login', { identifier: normalUsername, password: 'motdepasse123' });

  const { res: blockedApi } = await get('/api/admin/dashboard', normalCookie);
  check('Un utilisateur normal reçoit 403 sur /api/admin/*', blockedApi.status === 403);

  const { res: blockedPage } = await fetch(BASE_URL + '/admin', { headers: { Cookie: normalCookie }, redirect: 'manual' })
    .then((res) => ({ res }));
  check('La page /admin redirige un utilisateur normal (pas 200)', blockedPage.status === 302 || blockedPage.status === 303);

  console.log('\n📋 Tableau de bord');
  const { res: dashRes, data: dashData } = await get('/api/admin/dashboard', adminCookie);
  check('Tableau de bord accessible → 200', dashRes.status === 200);
  check('Contient le total d\'utilisateurs', typeof dashData.stats.totalUsers === 'number');
  check('Contient le total de mots du vocabulaire (≥270)', dashData.stats.totalVocabWords >= 270);

  console.log('\n📋 Liste et recherche des utilisateurs');
  const { data: listData } = await get(`/api/admin/users?search=${normalUsername}`, adminCookie);
  check('Recherche trouve bien le compte créé', listData.users.length === 1 && listData.users[0].username === normalUsername);
  const targetId = listData.users[0].id;

  console.log('\n📋 Fiche détaillée utilisateur');
  const { res: detailRes, data: detailData } = await get(`/api/admin/users/${targetId}`, adminCookie);
  check('Fiche détaillée accessible → 200', detailRes.status === 200);
  check('Contient les statistiques attendues', 'masteredCount' in detailData.stats && 'streak' in detailData.stats);

  console.log('\n📋 Modification du profil par l\'admin');
  const { res: editRes } = await put(`/api/admin/users/${targetId}`, {
    username: normalUsername, email: normalEmail, avatar: '🐼',
  }, adminCookie);
  check('Modification du profil → 200', editRes.status === 200);

  console.log('\n📋 Suspension / réactivation — effet immédiat sur la session active');
  const { res: suspendRes } = await post(`/api/admin/users/${targetId}/active`, { active: false }, adminCookie);
  check('Suspension → 200', suspendRes.status === 200);

  const { res: loginBlockedRes } = await post('/api/auth/login', { identifier: normalUsername, password: 'motdepasse123' });
  check('Connexion refusée pour un compte suspendu → 403', loginBlockedRes.status === 403);

  const { res: sessionBlockedRes } = await get('/api/vocab', normalCookie);
  check('La session déjà ouverte est immédiatement invalidée → 401', sessionBlockedRes.status === 401);

  const { res: reactivateRes } = await post(`/api/admin/users/${targetId}/active`, { active: true }, adminCookie);
  check('Réactivation → 200', reactivateRes.status === 200);

  const { res: loginAgainRes } = await post('/api/auth/login', { identifier: normalUsername, password: 'motdepasse123' });
  check('Connexion de nouveau possible après réactivation → 200', loginAgainRes.status === 200);

  console.log('\n📋 Un admin ne peut pas se suspendre lui-même');
  const { res: selfSuspendRes } = await post(`/api/admin/users/${adminId}/active`, { active: false }, adminCookie);
  check('Auto-suspension refusée → 400', selfSuspendRes.status === 400);

  console.log('\n📋 Gestion des rôles + protections anti-auto-sabotage');
  const { res: selfRoleRes } = await post(`/api/admin/users/${adminId}/role`, { role: 'user' }, adminCookie);
  check('Un admin ne peut pas changer son propre rôle → 400', selfRoleRes.status === 400);

  const { res: promoteRes } = await post(`/api/admin/users/${targetId}/role`, { role: 'admin' }, adminCookie);
  check('Promotion d\'un utilisateur → 200', promoteRes.status === 200);

  const { res: demoteRes } = await post(`/api/admin/users/${targetId}/role`, { role: 'user' }, adminCookie);
  check('Rétrogradation (il reste au moins 1 autre admin) → 200', demoteRes.status === 200);

  console.log('\n📋 Un admin ne peut pas se supprimer lui-même');
  const { res: selfDeleteRes } = await del(`/api/admin/users/${adminId}`, adminCookie);
  check('Auto-suppression refusée → 400', selfDeleteRes.status === 400);

  console.log('\n📋 Suppression réelle d\'un compte (avec cascade)');
  const { res: deleteRes } = await del(`/api/admin/users/${targetId}`, adminCookie);
  check('Suppression → 200', deleteRes.status === 200);
  const { data: afterDeleteList } = await get(`/api/admin/users?search=${normalUsername}`, adminCookie);
  check('Le compte a bien disparu de la liste', afterDeleteList.users.length === 0);

  console.log('\n📋 Réinitialisation forcée de mot de passe');
  const resetTargetUsername = `resettest_${suffix}`;
  await post('/api/auth/register', { username: resetTargetUsername, email: `${resetTargetUsername}@example.com`, password: 'motdepasse123' });
  const { data: resetTargetList } = await get(`/api/admin/users?search=${resetTargetUsername}`, adminCookie);
  const resetTargetId = resetTargetList.users[0].id;

  const { res: forceResetRes } = await post(`/api/admin/users/${resetTargetId}/force-password-reset`, {}, adminCookie);
  check('Réinitialisation forcée déclenchée → 200', forceResetRes.status === 200);

  console.log('\n📋 CRUD Vocabulaire + protection anti-doublon');
  const testWord = `테스트단어_${suffix}`;
  const { res: createVocabRes, data: createVocabData } = await post('/api/admin/vocab', {
    hangeul: testWord, romanisation: 'test', translation: 'Mot de test', category: 'Test',
  }, adminCookie);
  check('Création d\'un mot → 200', createVocabRes.status === 200);
  const vocabId = createVocabData.id;

  const { res: dupVocabRes } = await post('/api/admin/vocab', {
    hangeul: testWord, romanisation: 'x', translation: 'x', category: 'x',
  }, adminCookie);
  check('Doublon de hangeul refusé → 409', dupVocabRes.status === 409);

  const { res: updateVocabRes } = await put(`/api/admin/vocab/${vocabId}`, {
    hangeul: testWord, romanisation: 'test', translation: 'Mot de test modifié', category: 'Test',
  }, adminCookie);
  check('Modification d\'un mot → 200', updateVocabRes.status === 200);

  const { res: deleteVocabRes } = await del(`/api/admin/vocab/${vocabId}`, adminCookie);
  check('Suppression d\'un mot → 200', deleteVocabRes.status === 200);

  console.log('\n📋 Journal d\'audit — toutes les actions sont enregistrées');
  const { data: auditData } = await get('/api/admin/audit-log?page=1&pageSize=50', adminCookie);
  const actions = auditData.entries.map((e) => e.action);
  check('Contient "create_vocab"', actions.includes('create_vocab'));
  check('Contient "update_vocab"', actions.includes('update_vocab'));
  check('Contient "delete_vocab"', actions.includes('delete_vocab'));
  check('Contient "suspend_user"', actions.includes('suspend_user'));
  check('Contient "reactivate_user"', actions.includes('reactivate_user'));
  check('Contient "change_role"', actions.includes('change_role'));
  check('Contient "delete_user"', actions.includes('delete_user'));
  check('Contient "force_password_reset"', actions.includes('force_password_reset'));

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
