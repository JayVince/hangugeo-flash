const express = require('express');
const router  = express.Router();
const asyncHandler = require('../lib/asyncHandler');

const users          = require('../models/users');
const vocabModel     = require('../models/vocab');
const auditModel     = require('../models/adminAudit');
const passwordResets = require('../models/passwordResets');
const { sendPasswordResetEmail } = require('../lib/email');

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function logAudit(req, action, targetType, targetId, details) {
  // Ne bloque jamais la réponse : l'échec du journal ne doit pas
  // empêcher l'action elle-même.
  auditModel.logAction(req.userId, action, targetType, targetId, details).catch((err) => {
    console.error('Échec de journalisation admin :', err.message);
  });
}

// ── Tableau de bord ────────────────────────────────────

router.get('/dashboard', asyncHandler(async (req, res) => {
  const stats = await users.getDashboardStats();
  res.json({ stats });
}));

// ── Utilisateurs ────────────────────────────────────────

router.get('/users', asyncHandler(async (req, res) => {
  const search   = (req.query.search || '').toString();
  const page     = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));

  const result = await users.listUsers({ search, page, pageSize });
  res.json(result);
}));

router.get('/users/:id', asyncHandler(async (req, res) => {
  const details = await users.getUserDetails(req.params.id);
  if (!details) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  res.json(details);
}));

router.put('/users/:id', asyncHandler(async (req, res) => {
  const { username, email, avatar } = req.body || {};
  const targetId = Number(req.params.id);

  if (!username || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: "Nom d'utilisateur invalide (3-20 caractères, lettres/chiffres/_)." });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Adresse e-mail invalide.' });
  }

  const target = await users.findById(targetId);
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  // Empêche les conflits avec un autre compte existant
  const conflictByEmail = await users.findByEmail(email);
  if (conflictByEmail && conflictByEmail.id !== targetId) {
    return res.status(409).json({ error: 'Cet e-mail est déjà utilisé par un autre compte.' });
  }
  const conflictByUsername = await users.findByUsername(username);
  if (conflictByUsername && conflictByUsername.id !== targetId) {
    return res.status(409).json({ error: "Ce nom d'utilisateur est déjà pris." });
  }

  await users.adminUpdateProfile(targetId, { username, email, avatar: avatar || target.avatar });
  logAudit(req, 'update_profile', 'user', targetId, { username, email, avatar });

  res.json({ ok: true });
}));

router.post('/users/:id/active', asyncHandler(async (req, res) => {
  const targetId = Number(req.params.id);
  const { active } = req.body || {};

  if (typeof active !== 'boolean') {
    return res.status(400).json({ error: 'Paramètre "active" (booléen) requis.' });
  }
  if (targetId === req.userId && !active) {
    return res.status(400).json({ error: 'Vous ne pouvez pas suspendre votre propre compte.' });
  }

  const target = await users.findById(targetId);
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  await users.setActive(targetId, active);
  logAudit(req, active ? 'reactivate_user' : 'suspend_user', 'user', targetId);

  res.json({ ok: true });
}));

router.post('/users/:id/role', asyncHandler(async (req, res) => {
  const targetId = Number(req.params.id);
  const { role } = req.body || {};

  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide (attendu : "user" ou "admin").' });
  }
  if (targetId === req.userId) {
    return res.status(400).json({ error: 'Vous ne pouvez pas modifier votre propre rôle.' });
  }

  const target = await users.findById(targetId);
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  // Empêche de se retrouver sans aucun administrateur
  if (target.role === 'admin' && role === 'user') {
    const adminCount = await users.countAdmins();
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Impossible : ce serait le dernier administrateur restant.' });
    }
  }

  await users.setRole(targetId, role);
  logAudit(req, 'change_role', 'user', targetId, { newRole: role });

  res.json({ ok: true });
}));

router.delete('/users/:id', asyncHandler(async (req, res) => {
  const targetId = Number(req.params.id);

  if (targetId === req.userId) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte depuis le panneau admin.' });
  }

  const target = await users.findById(targetId);
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  if (target.role === 'admin') {
    const adminCount = await users.countAdmins();
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Impossible : ce serait le dernier administrateur restant.' });
    }
  }

  await users.deleteUser(targetId);
  logAudit(req, 'delete_user', 'user', targetId, { username: target.username, email: target.email });

  res.json({ ok: true });
}));

router.post('/users/:id/force-password-reset', asyncHandler(async (req, res) => {
  const targetId = Number(req.params.id);
  const target = await users.findById(targetId);
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  const rawToken = await passwordResets.createResetToken(target.id);
  const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(target.email, resetUrl);

  logAudit(req, 'force_password_reset', 'user', targetId, { email: target.email });

  res.json({ ok: true, message: `Lien de réinitialisation envoyé à ${target.email}.` });
}));

// ── Vocabulaire ─────────────────────────────────────────

router.get('/vocab', asyncHandler(async (req, res) => {
  const vocab = await vocabModel.getAllVocab();
  res.json({ vocab });
}));

router.post('/vocab', asyncHandler(async (req, res) => {
  const { hangeul, romanisation, translation, category } = req.body || {};
  if (!hangeul || !romanisation || !translation || !category) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }

  try {
    const id = await vocabModel.createWord({ hangeul, romanisation, translation, category });
    logAudit(req, 'create_vocab', 'vocab', id, { hangeul, translation });
    res.json({ id, hangeul, romanisation, translation, category });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: `Le mot "${hangeul}" existe déjà dans le vocabulaire.` });
    }
    throw err;
  }
}));

router.put('/vocab/:id', asyncHandler(async (req, res) => {
  const { hangeul, romanisation, translation, category } = req.body || {};
  if (!hangeul || !romanisation || !translation || !category) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }

  try {
    const ok = await vocabModel.updateWord(req.params.id, { hangeul, romanisation, translation, category });
    if (!ok) return res.status(404).json({ error: 'Mot introuvable.' });
    logAudit(req, 'update_vocab', 'vocab', req.params.id, { hangeul, translation });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: `Le mot "${hangeul}" existe déjà dans le vocabulaire.` });
    }
    throw err;
  }
}));

router.delete('/vocab/:id', asyncHandler(async (req, res) => {
  const word = await vocabModel.getById(req.params.id);
  const ok = await vocabModel.deleteWord(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Mot introuvable.' });
  logAudit(req, 'delete_vocab', 'vocab', req.params.id, word ? { hangeul: word.hangeul } : null);
  res.json({ ok: true });
}));

// ── Journal d'audit ─────────────────────────────────────

router.get('/audit-log', asyncHandler(async (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 30));

  const result = await auditModel.getLog({ page, pageSize });
  res.json(result);
}));

module.exports = router;
