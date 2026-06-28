/**
 * Module TTS partagé — utilisé par server.js (proxy à la volée)
 * et par scripts/warm-audio-cache.js (pré-génération hors-ligne).
 *
 * Moteur utilisé : Google Translate TTS (point d'accès non officiel,
 * gratuit, sans clé API). C'est le même moteur que celui utilisé par
 * l'option "Google Translate" d'AwesomeTTS dans Anki.
 *
 * Limite connue : ce point d'accès n'est pas garanti par Google et peut
 * être modifié ou bloqué sans préavis. S'il cesse de fonctionner,
 * remplacez fetchTtsBuffer() par un appel à Google Cloud TTS / Azure /
 * Amazon Polly — le reste de l'architecture (cache, route, frontend)
 * n'a pas besoin de changer.
 */

const crypto = require('crypto');
const https  = require('https');

const MAX_TEXT_LENGTH = 200; // limite raisonnable pour un mot ou une courte phrase

// Calcule un nom de fichier stable et sûr à partir du texte à prononcer
function hashText(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

// Récupère l'audio MP3 (Buffer) pour un texte coréen donné
function fetchTtsBuffer(text) {
  return new Promise((resolve, reject) => {
    const clean = (text || '').toString().trim().slice(0, MAX_TEXT_LENGTH);
    if (!clean) return reject(new Error('Texte vide'));

    const url =
      'https://translate.google.com/translate_tts' +
      `?ie=UTF-8&q=${encodeURIComponent(clean)}&tl=ko&client=tw-ob`;

    https.get(url, {
      headers: {
        // Un User-Agent de navigateur classique est nécessaire,
        // ce point d'accès refuse les requêtes sans en-tête réaliste.
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://translate.google.com/',
      },
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume(); // libère la connexion
        return reject(new Error(`Service TTS indisponible (code ${res.statusCode})`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

module.exports = { hashText, fetchTtsBuffer, MAX_TEXT_LENGTH };
