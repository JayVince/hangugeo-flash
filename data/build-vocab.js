/**
 * Génère le vocabulaire complet (270 mots) et vérifie l'absence de
 * doublons avant de produire le fichier final.
 * Usage : node data/build-vocab.js
 */
const fs = require('fs');
const path = require('path');

// Les 60 mots déjà existants dans l'application
const EXISTING = [
  ['안녕하세요', 'annyeonghaseyo', 'Bonjour', 'Salutations'],
  ['감사합니다', 'gamsahamnida', 'Merci', 'Salutations'],
  ['죄송합니다', 'joesonghamnida', 'Pardon / Désolé', 'Salutations'],
  ['네', 'ne', 'Oui', 'Salutations'],
  ['아니요', 'aniyo', 'Non', 'Salutations'],
  ['안녕히 가세요', 'annyeonghi gaseyo', 'Au revoir', 'Salutations'],
  ['어서 오세요', 'eoseo oseyo', 'Bienvenue', 'Salutations'],
  ['반갑습니다', 'bangapseumnida', 'Enchanté(e)', 'Salutations'],
  ['잘 지내요', 'jal jinaeyo', 'Je vais bien', 'Salutations'],
  ['이름이 뭐예요?', 'ireumi mwoyeyo?', 'Comment vous appelez-vous ?', 'Salutations'],
  ['일', 'il', 'Un', 'Chiffres'],
  ['이', 'i', 'Deux', 'Chiffres'],
  ['삼', 'sam', 'Trois', 'Chiffres'],
  ['사', 'sa', 'Quatre', 'Chiffres'],
  ['오', 'o', 'Cinq', 'Chiffres'],
  ['육', 'yuk', 'Six', 'Chiffres'],
  ['칠', 'chil', 'Sept', 'Chiffres'],
  ['팔', 'pal', 'Huit', 'Chiffres'],
  ['구', 'gu', 'Neuf', 'Chiffres'],
  ['십', 'sip', 'Dix', 'Chiffres'],
  ['빨간색', 'ppalgansaek', 'Rouge', 'Couleurs'],
  ['파란색', 'paransaek', 'Bleu', 'Couleurs'],
  ['노란색', 'noransaek', 'Jaune', 'Couleurs'],
  ['초록색', 'choroksaek', 'Vert', 'Couleurs'],
  ['흰색', 'huinsaek', 'Blanc', 'Couleurs'],
  ['검은색', 'geomeunsaek', 'Noir', 'Couleurs'],
  ['분홍색', 'bunhongsaek', 'Rose', 'Couleurs'],
  ['보라색', 'borasaek', 'Violet', 'Couleurs'],
  ['어머니', 'eomeoni', 'Mère', 'Famille'],
  ['아버지', 'abeoji', 'Père', 'Famille'],
  ['형', 'hyeong', 'Grand frère (pour un homme)', 'Famille'],
  ['언니', 'eonni', 'Grande sœur (pour une femme)', 'Famille'],
  ['동생', 'dongsaeng', 'Petit(e) frère / sœur', 'Famille'],
  ['할머니', 'halmeoni', 'Grand-mère', 'Famille'],
  ['할아버지', 'harabeoji', 'Grand-père', 'Famille'],
  ['친구', 'chingu', 'Ami(e)', 'Famille'],
  ['밥', 'bap', 'Riz (cuit)', 'Nourriture'],
  ['물', 'mul', 'Eau', 'Nourriture'],
  ['커피', 'keopi', 'Café', 'Nourriture'],
  ['김치', 'gimchi', 'Kimchi', 'Nourriture'],
  ['빵', 'ppang', 'Pain', 'Nourriture'],
  ['고기', 'gogi', 'Viande', 'Nourriture'],
  ['채소', 'chaeso', 'Légumes', 'Nourriture'],
  ['과일', 'gwail', 'Fruits', 'Nourriture'],
  ['라면', 'ramyeon', 'Ramen', 'Nourriture'],
  ['된장찌개', 'doenjang jjigae', 'Soupe miso coréenne', 'Nourriture'],
  ['가다', 'gada', 'Aller', 'Verbes'],
  ['오다', 'oda', 'Venir', 'Verbes'],
  ['먹다', 'meokda', 'Manger', 'Verbes'],
  ['마시다', 'masida', 'Boire', 'Verbes'],
  ['자다', 'jada', 'Dormir', 'Verbes'],
  ['일하다', 'ilhada', 'Travailler', 'Verbes'],
  ['공부하다', 'gongbuhada', 'Étudier', 'Verbes'],
  ['사랑하다', 'saranghada', 'Aimer', 'Verbes'],
  ['오늘', 'oneul', "Aujourd'hui", 'Temps'],
  ['내일', 'naeil', 'Demain', 'Temps'],
  ['어제', 'eoje', 'Hier', 'Temps'],
  ['월요일', 'woryoil', 'Lundi', 'Temps'],
  ['토요일', 'toyoil', 'Samedi', 'Temps'],
  ['일요일', 'iryoil', 'Dimanche', 'Temps'],
];

// Les 210 nouveaux mots
const NEW = [
  // Animaux (20)
  ['개', 'gae', 'Chien', 'Animaux'],
  ['고양이', 'goyangi', 'Chat', 'Animaux'],
  ['새', 'sae', 'Oiseau', 'Animaux'],
  ['물고기', 'mulgogi', 'Poisson', 'Animaux'],
  ['말', 'mal', 'Cheval', 'Animaux'],
  ['소', 'so', 'Vache / Bœuf', 'Animaux'],
  ['돼지', 'dwaeji', 'Cochon', 'Animaux'],
  ['닭', 'dak', 'Poulet', 'Animaux'],
  ['호랑이', 'horangi', 'Tigre', 'Animaux'],
  ['사자', 'saja', 'Lion', 'Animaux'],
  ['곰', 'gom', 'Ours', 'Animaux'],
  ['토끼', 'tokki', 'Lapin', 'Animaux'],
  ['쥐', 'jwi', 'Souris', 'Animaux'],
  ['원숭이', 'wonsungi', 'Singe', 'Animaux'],
  ['코끼리', 'kokkiri', 'Éléphant', 'Animaux'],
  ['여우', 'yeou', 'Renard', 'Animaux'],
  ['늑대', 'neukdae', 'Loup', 'Animaux'],
  ['사슴', 'saseum', 'Cerf', 'Animaux'],
  ['양', 'yang', 'Mouton', 'Animaux'],
  ['거북이', 'geobugi', 'Tortue', 'Animaux'],

  // Corps humain (15)
  ['머리', 'meori', 'Tête', 'Corps humain'],
  ['얼굴', 'eolgul', 'Visage', 'Corps humain'],
  ['눈', 'nun', 'Œil', 'Corps humain'],
  ['코', 'ko', 'Nez', 'Corps humain'],
  ['입', 'ip', 'Bouche', 'Corps humain'],
  ['귀', 'gwi', 'Oreille', 'Corps humain'],
  ['손', 'son', 'Main', 'Corps humain'],
  ['발', 'bal', 'Pied', 'Corps humain'],
  ['다리', 'dari', 'Jambe', 'Corps humain'],
  ['어깨', 'eokkae', 'Épaule', 'Corps humain'],
  ['배', 'bae', 'Ventre', 'Corps humain'],
  ['등', 'deung', 'Dos', 'Corps humain'],
  ['목', 'mok', 'Cou', 'Corps humain'],
  ['머리카락', 'meorikarak', 'Cheveux', 'Corps humain'],
  ['손가락', 'sonkkarak', 'Doigt', 'Corps humain'],

  // Vêtements (15)
  ['옷', 'ot', 'Vêtement', 'Vêtements'],
  ['바지', 'baji', 'Pantalon', 'Vêtements'],
  ['치마', 'chima', 'Jupe', 'Vêtements'],
  ['셔츠', 'syeocheu', 'Chemise', 'Vêtements'],
  ['신발', 'sinbal', 'Chaussures', 'Vêtements'],
  ['모자', 'moja', 'Chapeau', 'Vêtements'],
  ['양말', 'yangmal', 'Chaussettes', 'Vêtements'],
  ['장갑', 'janggap', 'Gants', 'Vêtements'],
  ['목도리', 'mokdori', 'Écharpe', 'Vêtements'],
  ['코트', 'koteu', 'Manteau', 'Vêtements'],
  ['가방', 'gabang', 'Sac', 'Vêtements'],
  ['안경', 'angyeong', 'Lunettes', 'Vêtements'],
  ['시계', 'sigye', 'Montre', 'Vêtements'],
  ['반지', 'banji', 'Bague', 'Vêtements'],
  ['티셔츠', 'tisyeocheu', 'T-shirt', 'Vêtements'],

  // Maison (15)
  ['집', 'jip', 'Maison', 'Maison'],
  ['방', 'bang', 'Chambre / Pièce', 'Maison'],
  ['거실', 'geosil', 'Salon', 'Maison'],
  ['주방', 'jubang', 'Cuisine', 'Maison'],
  ['화장실', 'hwajangsil', 'Toilettes / Salle de bain', 'Maison'],
  ['침대', 'chimdae', 'Lit', 'Maison'],
  ['의자', 'uija', 'Chaise', 'Maison'],
  ['책상', 'chaeksang', 'Bureau (meuble)', 'Maison'],
  ['창문', 'changmun', 'Fenêtre', 'Maison'],
  ['문', 'mun', 'Porte', 'Maison'],
  ['거울', 'geoul', 'Miroir', 'Maison'],
  ['소파', 'sopa', 'Canapé', 'Maison'],
  ['냉장고', 'naengjanggo', 'Réfrigérateur', 'Maison'],
  ['세탁기', 'setakgi', 'Machine à laver', 'Maison'],
  ['열쇠', 'yeolsoe', 'Clé', 'Maison'],

  // Ville & Lieux (15)
  ['학교', 'hakgyo', 'École', 'Ville'],
  ['병원', 'byeongwon', 'Hôpital', 'Ville'],
  ['은행', 'eunhaeng', 'Banque', 'Ville'],
  ['시장', 'sijang', 'Marché', 'Ville'],
  ['공원', 'gongwon', 'Parc', 'Ville'],
  ['역', 'yeok', 'Gare / Station', 'Ville'],
  ['공항', 'gonghang', 'Aéroport', 'Ville'],
  ['호텔', 'hotel', 'Hôtel', 'Ville'],
  ['식당', 'sikdang', 'Restaurant', 'Ville'],
  ['도서관', 'doseogwan', 'Bibliothèque', 'Ville'],
  ['교회', 'gyohoe', 'Église', 'Ville'],
  ['영화관', 'yeonghwagwan', 'Cinéma', 'Ville'],
  ['약국', 'yakguk', 'Pharmacie', 'Ville'],
  ['경찰서', 'gyeongchalseo', 'Commissariat', 'Ville'],
  ['서울', 'seoul', 'Séoul', 'Ville'],

  // Transports (10)
  ['버스', 'beoseu', 'Bus', 'Transports'],
  ['지하철', 'jihacheol', 'Métro', 'Transports'],
  ['기차', 'gicha', 'Train', 'Transports'],
  ['자동차', 'jadongcha', 'Voiture', 'Transports'],
  ['자전거', 'jajeongeo', 'Vélo', 'Transports'],
  ['택시', 'taeksi', 'Taxi', 'Transports'],
  ['비행기', 'bihaenggi', 'Avion', 'Transports'],
  ['오토바이', 'otobai', 'Moto', 'Transports'],
  ['길', 'gil', 'Route / Chemin', 'Transports'],
  ['정류장', 'jeongnyujang', 'Arrêt de bus', 'Transports'],

  // Météo & Saisons (10)
  ['날씨', 'nalssi', 'Météo', 'Météo'],
  ['비', 'bi', 'Pluie', 'Météo'],
  ['바람', 'baram', 'Vent', 'Météo'],
  ['더위', 'deowi', 'Chaleur', 'Météo'],
  ['추위', 'chuwi', 'Froid', 'Météo'],
  ['봄', 'bom', 'Printemps', 'Météo'],
  ['여름', 'yeoreum', 'Été', 'Météo'],
  ['가을', 'gaeul', 'Automne', 'Météo'],
  ['겨울', 'gyeoul', 'Hiver', 'Météo'],
  ['구름', 'gureum', 'Nuage', 'Météo'],

  // École & Travail (15)
  ['선생님', 'seonsaengnim', 'Professeur', 'École'],
  ['학생', 'haksaeng', 'Étudiant(e)', 'École'],
  ['회사', 'hoesa', 'Entreprise', 'École'],
  ['회사원', 'hoesawon', 'Employé de bureau', 'École'],
  ['사장', 'sajang', 'Patron / PDG', 'École'],
  ['의사', 'uisa', 'Médecin', 'École'],
  ['간호사', 'ganhosa', 'Infirmier/ère', 'École'],
  ['경찰', 'gyeongchal', 'Policier', 'École'],
  ['요리사', 'yorisa', 'Cuisinier', 'École'],
  ['변호사', 'byeonhosa', 'Avocat', 'École'],
  ['교실', 'gyosil', 'Salle de classe', 'École'],
  ['시험', 'siheom', 'Examen', 'École'],
  ['숙제', 'sukje', 'Devoirs', 'École'],
  ['연필', 'yeonpil', 'Crayon', 'École'],
  ['책', 'chaek', 'Livre', 'École'],

  // Émotions & Caractère (15)
  ['기쁘다', 'gippeuda', 'Être content(e) / joyeux', 'Émotions'],
  ['슬프다', 'seulpeuda', 'Être triste', 'Émotions'],
  ['화나다', 'hwanada', 'Être en colère', 'Émotions'],
  ['무섭다', 'museopda', 'Avoir peur / Être effrayant', 'Émotions'],
  ['행복하다', 'haengbokhada', 'Être heureux(se)', 'Émotions'],
  ['피곤하다', 'pigonhada', 'Être fatigué(e)', 'Émotions'],
  ['배고프다', 'baegopeuda', 'Avoir faim', 'Émotions'],
  ['배부르다', 'baebureuda', 'Être rassasié(e)', 'Émotions'],
  ['재미있다', 'jaemiitda', 'Être amusant(e) / intéressant', 'Émotions'],
  ['지루하다', 'jiruhada', 'Être ennuyeux(se)', 'Émotions'],
  ['부끄럽다', 'bukkeureopda', 'Être timide / avoir honte', 'Émotions'],
  ['걱정되다', 'geokjeongdoeda', 'Être inquiet(ète)', 'Émotions'],
  ['놀라다', 'nollada', 'Être surpris(e)', 'Émotions'],
  ['긴장되다', 'ginjangdoeda', 'Être nerveux(se)', 'Émotions'],
  ['편안하다', 'pyeonanhada', 'Être confortable / à l\u2019aise', 'Émotions'],

  // Loisirs & Sport (15)
  ['영화', 'yeonghwa', 'Film', 'Loisirs'],
  ['음악', 'eumak', 'Musique', 'Loisirs'],
  ['노래', 'norae', 'Chanson', 'Loisirs'],
  ['춤', 'chum', 'Danse', 'Loisirs'],
  ['그림', 'geurim', 'Dessin / Peinture', 'Loisirs'],
  ['사진', 'sajin', 'Photo', 'Loisirs'],
  ['여행', 'yeohaeng', 'Voyage', 'Loisirs'],
  ['운동', 'undong', 'Sport / Exercice', 'Loisirs'],
  ['축구', 'chukgu', 'Football', 'Loisirs'],
  ['야구', 'yagu', 'Baseball', 'Loisirs'],
  ['농구', 'nonggu', 'Basketball', 'Loisirs'],
  ['수영', 'suyeong', 'Natation', 'Loisirs'],
  ['등산', 'deungsan', 'Randonnée (montagne)', 'Loisirs'],
  ['게임', 'geim', 'Jeu vidéo', 'Loisirs'],
  ['독서', 'dokseo', 'Lecture', 'Loisirs'],

  // Technologie (10)
  ['컴퓨터', 'keompyuteo', 'Ordinateur', 'Technologie'],
  ['휴대폰', 'hyudaepon', 'Téléphone portable', 'Technologie'],
  ['인터넷', 'inteonet', 'Internet', 'Technologie'],
  ['이메일', 'imeil', 'E-mail', 'Technologie'],
  ['사진기', 'sajingi', 'Appareil photo', 'Technologie'],
  ['텔레비전', 'tellebijeon', 'Télévision', 'Technologie'],
  ['충전기', 'chungjeongi', 'Chargeur', 'Technologie'],
  ['비밀번호', 'bimilbeonho', 'Mot de passe', 'Technologie'],
  ['와이파이', 'waipai', 'Wifi', 'Technologie'],
  ['앱', 'aep', 'Application', 'Technologie'],

  // Achats & Argent (10)
  ['돈', 'don', 'Argent', 'Achats'],
  ['가격', 'gagyeok', 'Prix', 'Achats'],
  ['싸다', 'ssada', 'Être bon marché', 'Achats'],
  ['비싸다', 'bissada', 'Être cher(e)', 'Achats'],
  ['사다', 'sada', 'Acheter', 'Achats'],
  ['팔다', 'palda', 'Vendre', 'Achats'],
  ['계산하다', 'gyesanhada', 'Payer / Calculer', 'Achats'],
  ['영수증', 'yeongsujeung', 'Reçu / Ticket de caisse', 'Achats'],
  ['할인', 'harin', 'Réduction / Promotion', 'Achats'],
  ['신용카드', 'sinyongkadeu', 'Carte de crédit', 'Achats'],

  // Adjectifs courants (20)
  ['크다', 'keuda', 'Être grand(e)', 'Adjectifs'],
  ['작다', 'jakda', 'Être petit(e)', 'Adjectifs'],
  ['길다', 'gilda', 'Être long(ue)', 'Adjectifs'],
  ['짧다', 'jjalda', 'Être court(e)', 'Adjectifs'],
  ['높다', 'nopda', 'Être haut(e)', 'Adjectifs'],
  ['낮다', 'natda', 'Être bas(se)', 'Adjectifs'],
  ['빠르다', 'ppareuda', 'Être rapide', 'Adjectifs'],
  ['느리다', 'neurida', 'Être lent(e)', 'Adjectifs'],
  ['쉽다', 'swipda', 'Être facile', 'Adjectifs'],
  ['어렵다', 'eoryeopda', 'Être difficile', 'Adjectifs'],
  ['좋다', 'jota', 'Être bon / bien', 'Adjectifs'],
  ['나쁘다', 'nappeuda', 'Être mauvais(e)', 'Adjectifs'],
  ['새롭다', 'saeropda', 'Être nouveau / nouvelle', 'Adjectifs'],
  ['오래되다', 'oraedoeda', 'Être vieux / ancien', 'Adjectifs'],
  ['깨끗하다', 'kkaekkeutada', 'Être propre', 'Adjectifs'],
  ['더럽다', 'deoreopda', 'Être sale', 'Adjectifs'],
  ['조용하다', 'joyonghada', 'Être calme / silencieux', 'Adjectifs'],
  ['시끄럽다', 'sikkeureopda', 'Être bruyant(e)', 'Adjectifs'],
  ['똑똑하다', 'ttokttokhada', 'Être intelligent(e)', 'Adjectifs'],
  ['친절하다', 'chinjeolhada', 'Être gentil(le) / aimable', 'Adjectifs'],

  // Verbes (complément, 20) — rejoint la catégorie "Verbes" déjà existante
  ['보다', 'boda', 'Voir / Regarder', 'Verbes'],
  ['듣다', 'deutda', 'Écouter / Entendre', 'Verbes'],
  ['말하다', 'malhada', 'Parler', 'Verbes'],
  ['읽다', 'ikda', 'Lire', 'Verbes'],
  ['쓰다', 'sseuda', 'Écrire', 'Verbes'],
  ['주다', 'juda', 'Donner', 'Verbes'],
  ['받다', 'batda', 'Recevoir', 'Verbes'],
  ['만들다', 'mandeulda', 'Faire / Fabriquer', 'Verbes'],
  ['알다', 'alda', 'Savoir / Connaître', 'Verbes'],
  ['모르다', 'moreuda', 'Ne pas savoir', 'Verbes'],
  ['시작하다', 'sijakhada', 'Commencer', 'Verbes'],
  ['끝나다', 'kkeutnada', 'Finir / Se terminer', 'Verbes'],
  ['도와주다', 'dowajuda', 'Aider', 'Verbes'],
  ['기다리다', 'gidarida', 'Attendre', 'Verbes'],
  ['타다', 'tada', 'Monter (dans un véhicule)', 'Verbes'],
  ['걷다', 'geotda', 'Marcher', 'Verbes'],
  ['뛰다', 'ttwida', 'Courir', 'Verbes'],
  ['웃다', 'utda', 'Rire', 'Verbes'],
  ['울다', 'ulda', 'Pleurer', 'Verbes'],
  ['쉬다', 'swida', 'Se reposer', 'Verbes'],

  // Expressions du quotidien (5)
  ['괜찮아요', 'gwaenchanayo', 'Ça va / Pas de problème', 'Expressions'],
  ['모르겠어요', 'moreugesseoyo', 'Je ne sais pas', 'Expressions'],
  ['알겠어요', 'algesseoyo', "J'ai compris / D'accord", 'Expressions'],
  ['화이팅', 'hwaiting', 'Bon courage / Allez !', 'Expressions'],
  ['조심하세요', 'josimhaseyo', 'Faites attention', 'Expressions'],
];

// ── Vérifications ────────────────────────────────────

const all = [...EXISTING, ...NEW];

console.log(`Total de mots : ${all.length} (attendu : 270)`);

const seen = new Map();
let duplicateFound = false;
all.forEach(([hangeul], idx) => {
  if (seen.has(hangeul)) {
    console.error(`✗ DOUBLON détecté : "${hangeul}" (position ${seen.get(hangeul)} et ${idx})`);
    duplicateFound = true;
  }
  seen.set(hangeul, idx);
});

if (!duplicateFound) console.log('✓ Aucun doublon détecté parmi les 270 mots.');
if (all.length !== 270) console.error(`✗ Le total ne correspond pas à 270 (trouvé : ${all.length})`);

// ── Génération du JSON final (avec id séquentiel) ────

const vocab = all.map(([hangeul, romanisation, translation, category], i) => ({
  id: i + 1,
  hangeul,
  romanisation,
  translation,
  category,
}));

// Répartition par catégorie (pour vérification visuelle)
const counts = {};
vocab.forEach(v => { counts[v.category] = (counts[v.category] || 0) + 1; });
console.log('\nRépartition par catégorie :');
Object.entries(counts).forEach(([cat, n]) => console.log(`  ${cat.padEnd(14)} ${n}`));

fs.writeFileSync(path.join(__dirname, 'vocab.json'), JSON.stringify(vocab, null, 2));
console.log(`\n✓ Fichier généré : data/vocab.json (${vocab.length} mots)`);
