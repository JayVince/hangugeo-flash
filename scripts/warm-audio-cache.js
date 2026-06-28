/**
 * Pré-génère l'audio des 60 mots prédéfinis pour que les premiers
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

// Liste des 60 mots — garder synchronisée avec public/index.html
const VOCAB_HANGEUL = [
  '안녕하세요', '감사합니다', '죄송합니다', '네', '아니요',
  '안녕히 가세요', '어서 오세요', '반갑습니다', '잘 지내요', '이름이 뭐예요?',
  '일', '이', '삼', '사', '오', '육', '칠', '팔', '구', '십',
  '빨간색', '파란색', '노란색', '초록색', '흰색', '검은색', '분홍색', '보라색',
  '어머니', '아버지', '형', '언니', '동생', '할머니', '할아버지', '친구',
  '밥', '물', '커피', '김치', '빵', '고기', '채소', '과일', '라면', '된장찌개',
  '가다', '오다', '먹다', '마시다', '자다', '일하다', '공부하다', '사랑하다',
  '오늘', '내일', '어제', '월요일', '토요일', '일요일',
];

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
