require('dotenv').config();

const express      = require('express');
const path         = require('path');
const fs           = require('fs');
const cookieParser = require('cookie-parser');

const { hashText, fetchTtsBuffer, MAX_TEXT_LENGTH } = require('./lib/tts');
const { verifySession, COOKIE_NAME } = require('./lib/auth');
const { requireAuthApi, requireAuthPage } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const apiRoutes  = require('./routes/api');

const app  = express();

// Hostinger (et la plupart des hébergeurs Node.js) fournissent le port
// via la variable d'environnement PORT — ne jamais le fixer en dur.
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// L'app tourne derrière un proxy inverse chez Hostinger
app.set('trust proxy', 1);

app.use(express.json());
app.use(cookieParser());

// Sert les fichiers statiques (CSS, JS, audio) — mais PAS les pages HTML
// protégées, qui sont servies explicitement ci-dessous avec vérification
// de session. `index: false` empêche express.static de servir un éventuel
// index.html automatiquement.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Dossier où les fichiers audio générés sont mémorisés (gratuit, généré une fois)
const AUDIO_CACHE_DIR = path.join(__dirname, 'public', 'audio', 'cache');
fs.mkdirSync(AUDIO_CACHE_DIR, { recursive: true });

// ── Pages HTML ──────────────────────────────────────────

app.get('/', (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  const session = token && verifySession(token);
  res.redirect(session ? '/app' : '/login');
});

app.get('/login', (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  const session = token && verifySession(token);
  if (session) return res.redirect('/app'); // déjà connecté
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'reset-password.html'));
});

app.get('/app', requireAuthPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'app.html'));
});

// ── Routes API ──────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api', requireAuthApi, apiRoutes);

/**
 * GET /api/tts?text=안녕하세요
 *
 * Renvoie un MP3 de prononciation coréenne. Le premier appel pour un
 * texte donné le génère via le moteur TTS (lib/tts.js) et le sauvegarde
 * sur disque ; tous les appels suivants pour le même texte servent
 * directement le fichier en cache (instantané, gratuit).
 * (Cette route correspond au préfixe /api intercepté plus haut par
 * requireAuthApi : elle est donc protégée comme le reste de l'API,
 * ce qui est cohérent puisque toute l'app est derrière l'authentification.)
 */
app.get('/api/tts', async (req, res) => {
  const text = (req.query.text || '').toString().trim();

  if (!text) {
    return res.status(400).send('Paramètre "text" manquant.');
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).send('Texte trop long.');
  }

  const fileName = `${hashText(text)}.mp3`;
  const filePath = path.join(AUDIO_CACHE_DIR, fileName);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  try {
    const buffer = await fetchTtsBuffer(text);
    fs.writeFile(filePath, buffer, (err) => {
      if (err) console.error('Échec de la sauvegarde du cache audio :', err.message);
    });
    res.set('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (err) {
    console.error('Erreur TTS :', err.message);
    res.status(502).send('Service de prononciation temporairement indisponible.');
  }
});

// Filet de sécurité pour les erreurs non gérées dans les routes async
app.use((err, req, res, next) => {
  console.error('Erreur serveur :', err);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

app.listen(PORT, HOST, () => {
  console.log(`한국어 Flash (OppaLingo) lancé sur le port ${PORT}`);
});
