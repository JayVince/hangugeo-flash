const express = require('express');
const router  = express.Router();
const asyncHandler = require('../lib/asyncHandler');

const users          = require('../models/users');
const passwordResets = require('../models/passwordResets');
const { hashPassword, verifyPassword, signSession, verifySession, cookieOptions, COOKIE_NAME } = require('../lib/auth');
const { sendPasswordResetEmail } = require('../lib/email');

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AVATARS     = ['🌸', '🐯', '🦊', '🐰', '🐼', '🐱', '🐶', '🦉', '🐸', '🦋'];

// ── Inscription ───────────────────────────────────────
router.post('/register', asyncHandler(async (req, res) => {
  const { username, email, password, avatar } = req.body || {};

  if (!username || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: "Le nom d'utilisateur doit contenir 3 à 20 caractères (lettres, chiffres, _)." });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Adresse e-mail invalide.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }
  const chosenAvatar = AVATARS.includes(avatar) ? avatar : AVATARS[0];

  if (await users.findByEmail(email)) {
    return res.status(409).json({ error: 'Cet e-mail est déjà utilisé.' });
  }
  if (await users.findByUsername(username)) {
    return res.status(409).json({ error: "Ce nom d'utilisateur est déjà pris." });
  }

  const passwordHash = await hashPassword(password);
  const userId = await users.createUser({ username, email, passwordHash, avatar: chosenAvatar });

  const token = signSession({ userId });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json({ user: { id: userId, username, email, avatar: chosenAvatar } });
}));

// ── Connexion ──────────────────────────────────────────
router.post('/login', asyncHandler(async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ error: "Identifiant et mot de passe requis." });
  }

  const user = EMAIL_RE.test(identifier)
    ? await users.findByEmail(identifier)
    : await users.findByUsername(identifier);

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
  }

  const token = signSession({ userId: user.id });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json({ user: users.toPublicUser(user) });
}));

// ── Déconnexion ────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

// ── Profil courant ─────────────────────────────────────
router.get('/me', asyncHandler(async (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  const session = token && verifySession(token);
  if (!session) return res.status(401).json({ error: 'Non authentifié.' });

  const user = await users.findById(session.userId);
  if (!user) return res.status(401).json({ error: 'Utilisateur introuvable.' });

  res.json({ user: users.toPublicUser(user) });
}));

// ── Mot de passe oublié : étape 1 (demande du lien) ─────
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'E-mail requis.' });

  const user = await users.findByEmail(email);

  // Réponse identique que l'utilisateur existe ou non, pour ne pas
  // révéler quels e-mails sont enregistrés (bonne pratique de sécurité).
  if (user) {
    const rawToken = await passwordResets.createResetToken(user.id);
    const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(user.email, resetUrl);
  }

  res.json({ ok: true, message: 'Si cet e-mail existe, un lien de réinitialisation vient de lui être envoyé.' });
}));

// ── Mot de passe oublié : étape 2 (définir le nouveau mot de passe) ─
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Jeton et nouveau mot de passe requis.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }

  const resetEntry = await passwordResets.findValidToken(token);
  if (!resetEntry) {
    return res.status(400).json({ error: 'Lien invalide ou expiré. Refaites une demande.' });
  }

  const passwordHash = await hashPassword(newPassword);
  await users.updatePassword(resetEntry.user_id, passwordHash);
  await passwordResets.markTokenUsed(resetEntry.id);

  res.json({ ok: true, message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' });
}));

module.exports = router;
