/**
 * Middlewares admin — à chaîner APRÈS requireAuthApi / requireAuthPage,
 * qui posent déjà req.user (chargé fraîchement depuis la base, avec son
 * rôle à jour). Une rétrogradation de rôle prend donc effet immédiatement,
 * sans attendre l'expiration du jeton de session.
 */

function requireAdminApi(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
  }
  next();
}

function requireAdminPage(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.redirect('/app'); // connecté mais pas admin → renvoyé vers l'app normale
  }
  next();
}

module.exports = { requireAdminApi, requireAdminPage };
