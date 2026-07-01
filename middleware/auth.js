const { verifySession, COOKIE_NAME } = require('../lib/auth');
const users = require('../models/users');

// Vérifie le jeton, puis re-vérifie en base que le compte existe toujours
// et n'est pas suspendu — nécessaire pour qu'une suspension décidée par
// un administrateur prenne effet immédiatement, sans attendre l'expiration
// du jeton de session.
async function loadActiveUser(req) {
  const token = req.cookies[COOKIE_NAME];
  const session = token && verifySession(token);
  if (!session) return null;

  const user = await users.findById(session.userId);
  if (!user || !user.is_active) return null;

  return user;
}

// Pour les routes API : renvoie 401 JSON si la session est absente/invalide/suspendue
async function requireAuthApi(req, res, next) {
  try {
    const user = await loadActiveUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié.' });
    req.userId = user.id;
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Pour les pages HTML : redirige vers /login si la session est absente/invalide/suspendue
async function requireAuthPage(req, res, next) {
  try {
    const user = await loadActiveUser(req);
    if (!user) return res.redirect('/login');
    req.userId = user.id;
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuthApi, requireAuthPage };
