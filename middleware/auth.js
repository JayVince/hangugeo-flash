const { verifySession, COOKIE_NAME } = require('../lib/auth');

// Pour les routes API : renvoie 401 JSON si la session est absente/invalide
function requireAuthApi(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  const session = token && verifySession(token);

  if (!session) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }
  req.userId = session.userId;
  next();
}

// Pour les pages HTML : redirige vers /login si la session est absente/invalide
function requireAuthPage(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  const session = token && verifySession(token);

  if (!session) {
    return res.redirect('/login');
  }
  req.userId = session.userId;
  next();
}

module.exports = { requireAuthApi, requireAuthPage };
