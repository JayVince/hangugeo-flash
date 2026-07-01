# Déploiement de 한국어 Flash (OppaLingo) sur Hostinger

Ce guide explique comment publier l'application sur **oppalingo.com** via
l'hébergement Node.js de Hostinger (hPanel), avec base de données MySQL et
comptes utilisateurs.

## Prérequis

- Un plan d'hébergement Hostinger qui inclut **Node.js** et **MySQL**
  (Business / Cloud, ou VPS). Le nom de domaine `oppalingo.com` doit déjà
  être ajouté ou pointé vers ce compte d'hébergement.
- Le code source de ce projet, prêt à être envoyé sur GitHub ou via
  gestionnaire de fichiers / SFTP.

## Étape 1 — Créer la base de données MySQL

1. Dans **hPanel** → **Bases de données** → **Bases de données MySQL**.
2. Cliquez sur **Créer une nouvelle base de données**. Notez :
   - le **nom de la base** (ex. `u123456789_hangugeo`)
   - le **nom d'utilisateur** et le **mot de passe** associés
   - l'**hôte** (généralement `localhost` chez Hostinger)
3. Ces informations serviront à remplir les variables `DB_*` à l'étape 4.

## Étape 2 — Créer une boîte mail pour l'envoi des e-mails

Nécessaire pour la fonctionnalité « mot de passe oublié ».

1. Dans **hPanel** → **E-mails** → **Comptes e-mail**.
2. Créez une adresse, par exemple `noreply@oppalingo.com`, avec un mot de
   passe.
3. Notez les paramètres SMTP sortants (visibles dans hPanel → E-mails →
   Configurer le client de messagerie) : généralement
   `smtp.hostinger.com`, port `465` (SSL).

## Étape 3 — Créer l'application Node.js dans hPanel

1. **hPanel** → **Avancé** → **Node.js** → **Créer une application**.
2. Renseignez :
   - **Version de Node.js** : 18.x ou plus récente
   - **Racine de l'application** : dossier où le code sera déployé
   - **Domaine** : `oppalingo.com`
   - **Fichier de démarrage** : `server.js`

## Étape 4 — Configurer les variables d'environnement

Toujours dans hPanel → Node.js → votre application → **Variables
d'environnement**, ajoutez (voir aussi `.env.example`) :

| Variable | Valeur |
|---|---|
| `DB_HOST` | `127.0.0.1` |
| `DB_PORT` | `3306` |
| `DB_USER` | l'utilisateur MySQL créé à l'étape 1 |
| `DB_PASSWORD` | le mot de passe MySQL créé à l'étape 1 (évitez les caractères spéciaux ambigus type `@ # & $`) |
| `DB_NAME` | le nom de la base créée à l'étape 1 |
| `JWT_SECRET` | une valeur aléatoire longue (voir commande ci-dessous) |
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `noreply@oppalingo.com` |
| `SMTP_PASSWORD` | le mot de passe de cette boîte mail |
| `SMTP_FROM` | `한국어 Flash <noreply@oppalingo.com>` |
| `APP_URL` | `https://oppalingo.com` |
| `NODE_ENV` | `production` |

**Ne définissez pas `DB_SOCKET`** sauf si vous savez que votre utilisateur
MySQL a explicitement un grant pour `localhost` (socket Unix) — sur la
plupart des comptes Hostinger testés, le grant par défaut couvre
`127.0.0.1` (connexion TCP) mais pas `localhost`, ce qui ferait échouer la
connexion avec `Access denied` si `DB_SOCKET` est utilisé.

> ⚠️ **Si vous obtenez `Access denied for user '...'@'...'` malgré un mot
> de passe correct**, le problème vient presque toujours de l'hôte
> d'origine que MySQL voit pour la connexion :
> - `@'::1'` → `localhost` a été résolu en IPv6 côté Node → utilisez `127.0.0.1`
> - `@'localhost'` malgré `DB_HOST=127.0.0.1` → `DB_SOCKET` est défini et
>   force une connexion via socket Unix → retirez `DB_SOCKET`
> - `@'127.0.0.1'` avec `DB_HOST=127.0.0.1` → c'est probablement le mot de
>   passe qui est incorrect (régénérez-le dans hPanel → Bases de données →
>   Utilisateurs MySQL, et mettez à jour `DB_PASSWORD` à l'identique)
>
> Pour confirmer pour quel(s) hôte(s) votre utilisateur a un grant, dans
> phpMyAdmin (connecté en tant qu'administrateur principal, pas avec
> l'utilisateur applicatif) → onglet **SQL** :
> ```sql
> SELECT user, host FROM mysql.user WHERE user = 'VOTRE_UTILISATEUR_MYSQL';
> ```

Pour générer une valeur sûre pour `JWT_SECRET`, en local ou en SSH :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Ne committez jamais de vraies valeurs dans `.env` sur GitHub** —
`.env.example` est un modèle vide à titre indicatif ; `.env` est exclu via
`.gitignore`.

## Étape 5 — Envoyer les fichiers

- **Git** : dans hPanel, utilisez « Déployer depuis Git » si disponible.
- **SFTP / gestionnaire de fichiers** : uploadez tout le contenu de ce
  dossier (sauf `node_modules/`) dans la racine de l'application.

## Étape 6 — Installer les dépendances et préparer la base

Via le terminal SSH fourni par hPanel, à la racine du projet :

```bash
npm install              # installe toutes les dépendances
npm run migrate           # crée les tables (users, vocab, progress, etc.)
npm run seed-vocab        # insère les 270 mots du programme
```

Ces deux scripts sont **sûrs à relancer** à tout moment (aucune donnée
existante n'est dupliquée ou perdue).

## Étape 7 — Démarrer l'application

Cliquez sur **Restart App** dans hPanel. `server.js` lit automatiquement
le port fourni par Hostinger (`process.env.PORT`).

## Étape 8 — Vérifier le domaine

Rendez-vous sur **https://oppalingo.com** :
- vous devez arriver sur la page de **connexion/inscription** ;
- créez un compte de test, vérifiez l'accès à l'application ;
- vérifiez que les **DNS** et le **SSL** (Let's Encrypt, gratuit) sont bien
  actifs dans hPanel → SSL si le domaine ne répond pas immédiatement.

## Étape 9 (recommandée) — Pré-générer l'audio des 270 mots

```bash
npm run warm-audio
```

Génère et met en cache la prononciation des mots du programme, pour un son
instantané dès les premières visites (voir la section *Prononciation
audio* ci-dessous).

## Mises à jour futures

1. Poussez vos modifications (`git push`) ou réenvoyez les fichiers modifiés.
2. `npm install` si `package.json` a changé.
3. `npm run migrate` si le schéma de base a évolué (sans risque, idempotent).
4. **Restart App**.

## Notes techniques

- **Architecture** : Express + MySQL (via `mysql2`), authentification par
  cookie de session signé (JWT), mots de passe hachés avec `bcrypt`.
- **Toutes les données utilisateur** (compte, progression, cartes
  personnalisées, séries, historique de quiz) sont désormais stockées en
  base de données MySQL et **synchronisées entre tous les appareils** d'un
  même utilisateur connecté.
- Seule la préférence de **thème clair/sombre** reste locale à chaque
  appareil/navigateur (choix volontaire, non synchronisé).
- La route `/api/tts` nécessite un accès internet sortant depuis le
  serveur (déjà disponible par défaut chez Hostinger).

## Panneau administrateur

L'application inclut un panneau d'administration (`/admin`) permettant de
gérer les utilisateurs, le vocabulaire, et de consulter un tableau de bord
et un journal d'audit.

### Créer le tout premier administrateur

1. Inscrivez-vous normalement sur le site avec le compte qui doit devenir
   administrateur.
2. Dans hPanel → **Node.js** → votre application → **Variables
   d'environnement**, ajoutez :
   ```
   ADMIN_BOOTSTRAP_EMAIL=votre-email@exemple.com
   ```
   (l'e-mail exact utilisé à l'inscription)
3. **Restart App**. Au démarrage, les logs afficheront :
   ```
   ✓ Compte promu administrateur : votre-email@exemple.com
   ```
4. Connectez-vous : un lien **🛠️ Panneau admin** apparaît désormais dans
   le menu du compte (sous l'avatar).

**Important** : une fois le premier administrateur créé, il est recommandé
de **retirer la variable `ADMIN_BOOTSTRAP_EMAIL`** des variables
d'environnement (puis de redémarrer). Elle n'est plus nécessaire ensuite —
toute gestion des rôles se fait depuis le panneau lui-même — et la laisser
indéfiniment permettrait de re-promouvoir ce compte automatiquement même
après une rétrogradation volontaire décidée depuis l'interface.

### Fonctionnalités du panneau

- **Tableau de bord** — utilisateurs totaux/actifs, mots du programme,
  cartes personnalisées, sessions de quiz, graphique des inscriptions
- **Utilisateurs** — recherche, fiche détaillée avec statistiques
  d'apprentissage, modification du profil, suspension/réactivation,
  changement de rôle, suppression, réinitialisation forcée du mot de passe
- **Vocabulaire** — ajout/modification/suppression des mots du programme
  (protection automatique contre les doublons via la base de données)
- **Journal d'audit** — historique de toutes les actions administrateur

### Garde-fous de sécurité intégrés

- Un administrateur ne peut ni suspendre, ni supprimer, ni modifier son
  propre rôle depuis le panneau (évite le blocage accidentel de son propre
  accès)
- Impossible de rétrograder ou supprimer le **dernier administrateur
  restant**
- Une suspension prend effet **immédiatement**, y compris pour une session
  déjà ouverte (pas besoin d'attendre l'expiration du jeton)
- Le rôle est revérifié en base à chaque requête admin — une
  rétrogradation est donc, elle aussi, immédiate

## Prononciation audio

L'application utilise un moteur de synthèse vocale neuronal (Google
Translate TTS) avec mise en cache automatique sur disque
(`public/audio/cache/`) : le premier visiteur à écouter un mot déclenche sa
génération, tous les suivants l'entendent instantanément. En cas
d'indisponibilité du service, repli automatique et invisible sur la voix du
navigateur.

## Sécurité — résumé

- Mots de passe **jamais stockés en clair** (hachage bcrypt, 12 tours).
- Jetons de réinitialisation de mot de passe à **usage unique**, valables
  1 heure, stockés sous forme de hachage (jamais en clair en base).
- Les réponses à « mot de passe oublié » sont **identiques** que l'e-mail
  existe ou non (pas de fuite d'information sur les comptes existants).
- Cookie de session `httpOnly` (inaccessible en JavaScript côté client) et
  `secure` en production (transmis uniquement en HTTPS).
- Toutes les routes de données vérifient que la ressource demandée
  appartient bien à l'utilisateur connecté (isolation stricte testée).
