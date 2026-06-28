const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { hashText, fetchTtsBuffer, MAX_TEXT_LENGTH } = require('./lib/tts');

const app  = express();

// Hostinger (et la plupart des hébergeurs Node.js) fournissent le port
// via la variable d'environnement PORT — ne jamais le fixer en dur.
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// L'app tourne derrière un proxy inverse chez Hostinger
app.set('trust proxy', 1);

// Dossier où les fichiers audio générés sont mémorisés (gratuit, généré une fois)
const AUDIO_CACHE_DIR = path.join(__dirname, 'public', 'audio', 'cache');
fs.mkdirSync(AUDIO_CACHE_DIR, { recursive: true });

// Sert tous les fichiers statiques depuis public/ (HTML, CSS, JS, audio en cache)
app.use(express.static(path.join(__dirname, 'public')));

/**
 * GET /api/tts?text=안녕하세요
 *
 * Renvoie un MP3 de prononciation coréenne. Le premier appel pour un
 * texte donné le génère via le moteur TTS (lib/tts.js) et le sauvegarde
 * sur disque ; tous les appels suivants pour le même texte servent
 * directement le fichier en cache (instantané, gratuit).
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

  // 1. Le fichier existe déjà en cache → on le sert directement
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  // 2. Sinon, on génère l'audio, on le sauvegarde, puis on le renvoie
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

app.listen(PORT, HOST, () => {
  console.log(`한국어 Flash (OppaLingo) lancé sur le port ${PORT}`);
});
