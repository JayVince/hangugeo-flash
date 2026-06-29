/**
 * Pré-génère l'audio des mots prédéfinis pour que les premiers
 * visiteurs aient un son instantané dès le lancement, sans attendre
 * la génération à la volée.
 *
 * À exécuter UNE FOIS, sur une machine avec accès internet (ex. en SSH
 * sur Hostinger après déploiement, ou en local avant d'uploader le
 * dossier public/audio/cache).
 *
 * Usage : node scripts/warm-audio-cache.js
 */

const fs   = require('fs');
const path = require('path');
const { hashText, fetchTtsBuffer } = require('../lib/tts');

// Source unique du vocabulaire — voir data/vocab.json (généré par data/build-vocab.js)
const vocab = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'vocab.json'), 'utf8')
);
const VOCAB_HANGEUL = vocab.map(v => v.hangeul);

const CACHE_DIR = path.join(__dirname, '..', 'public', 'audio', 'cache');

async function warmCache() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  let generated = 0;
  let skipped   = 0;
  let failed    = 0;

  for (const word of VOCAB_HANGEUL) {
    const filePath = path.join(CACHE_DIR, `${hashText(word)}.mp3`);

    if (fs.existsSync(filePath)) {
      skipped++;
      continue;
    }

    try {
      const buffer = await fetchTtsBuffer(word);
      fs.writeFileSync(filePath, buffer);
      generated++;
      console.log(`✓ ${word}`);
      // Petite pause pour ne pas bombarder le service TTS
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      failed++;
      console.error(`✗ ${word} — ${err.message}`);
    }
  }

  console.log('\n── Résumé ──');
  console.log(`Générés : ${generated} | Déjà en cache : ${skipped} | Échecs : ${failed}`);
}

warmCache();
