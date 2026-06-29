const express = require('express');
const router  = express.Router();
const asyncHandler = require('../lib/asyncHandler');

const vocabModel  = require('../models/vocab');
const cardsModel  = require('../models/customCards');
const progressModel = require('../models/progress');
const streaksModel  = require('../models/streaks');
const historyModel  = require('../models/quizHistory');

// ── Vocabulaire (lecture seule pour l'instant) ──────────
router.get('/vocab', asyncHandler(async (req, res) => {
  const vocab = await vocabModel.getAllVocab();
  res.json({ vocab });
}));

// ── Cartes personnalisées ────────────────────────────────
router.get('/cards', asyncHandler(async (req, res) => {
  const cards = await cardsModel.getCardsByUser(req.userId);
  res.json({ cards });
}));

router.post('/cards', asyncHandler(async (req, res) => {
  const { hangeul, romanisation, translation } = req.body || {};
  if (!hangeul || !romanisation || !translation) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }
  const id = await cardsModel.createCard(req.userId, { hangeul, romanisation, translation });
  res.json({ id, hangeul, romanisation, translation });
}));

router.put('/cards/:id', asyncHandler(async (req, res) => {
  const { hangeul, romanisation, translation } = req.body || {};
  if (!hangeul || !romanisation || !translation) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }
  const ok = await cardsModel.updateCard(req.userId, req.params.id, { hangeul, romanisation, translation });
  if (!ok) return res.status(404).json({ error: 'Carte introuvable.' });
  res.json({ ok: true });
}));

router.delete('/cards/:id', asyncHandler(async (req, res) => {
  const ok = await cardsModel.deleteCard(req.userId, req.params.id);
  if (!ok) return res.status(404).json({ error: 'Carte introuvable.' });
  await progressModel.deleteProgressForCard(req.userId, 'custom', req.params.id);
  res.json({ ok: true });
}));

// ── Progression (système Leitner) ────────────────────────
router.get('/progress', asyncHandler(async (req, res) => {
  const progress = await progressModel.getProgressByUser(req.userId);
  res.json({ progress });
}));

router.post('/progress/mark', asyncHandler(async (req, res) => {
  const { cardType, cardId, action } = req.body || {};
  if (!['vocab', 'custom'].includes(cardType) || !cardId || !['mastered', 'review'].includes(action)) {
    return res.status(400).json({ error: 'Paramètres invalides.' });
  }
  const result = await progressModel.markCard(req.userId, cardType, cardId, action);
  const streak = await streaksModel.recordActivity(req.userId);
  res.json({ progress: result, streak });
}));

// ── Série de jours (streak) ───────────────────────────────
router.get('/streak', asyncHandler(async (req, res) => {
  const streak = await streaksModel.getStreak(req.userId);
  res.json({ streak });
}));

// ── Historique des quiz ────────────────────────────────────
router.get('/quiz-history', asyncHandler(async (req, res) => {
  const history = await historyModel.getHistory(req.userId);
  res.json({ history });
}));

router.post('/quiz-history', asyncHandler(async (req, res) => {
  const { score, total, mode, category } = req.body || {};
  if (typeof score !== 'number' || typeof total !== 'number' || !['qcm', 'typing'].includes(mode)) {
    return res.status(400).json({ error: 'Paramètres invalides.' });
  }
  await historyModel.addQuizResult(req.userId, { score, total, mode, category });
  const streak = await streaksModel.recordActivity(req.userId);
  res.json({ ok: true, streak });
}));

module.exports = router;
