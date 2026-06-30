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
| `DB_SOCKET` | chemin du socket MySQL (voir encadré ci-dessous) — **méthode recommandée** |
| `DB_USER` | l'utilisateur MySQL créé à l'étape 1 |
| `DB_PASSWORD` | le mot de passe MySQL créé à l'étape 1 |
| `DB_NAME` | le nom de la base créée à l'étape 1 |
| `JWT_SECRET` | une valeur aléatoire longue (voir commande ci-dessous) |
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `noreply@oppalingo.com` |
| `SMTP_PASSWORD` | le mot de passe de cette boîte mail |
| `SMTP_FROM` | `한국어 Flash <noreply@oppalingo.com>` |
| `APP_URL` | `https://oppalingo.com` |
| `NODE_ENV` | `production` |

> ⚠️ **Piège fréquent sur les hébergements mutualisés** : sur Hostinger,
> l'utilisateur MySQL créé dans hPanel n'a souvent l'autorisation de
> connexion **que via le socket Unix** (le même mode que phpMyAdmin), pas
> via une connexion réseau classique. Résultat : que vous utilisiez
> `DB_HOST=localhost` (résolu en IPv6 `::1` côté Node) ou
> `DB_HOST=127.0.0.1` (connexion TCP), la connexion échoue avec
> `Access denied for user '...'@'...'` **même si le mot de passe est
> correct** — car aucune des deux ne correspond à une connexion via socket.
>
> **Solution** : définissez `DB_SOCKET` au lieu de `DB_HOST`/`DB_PORT`.
> Pour obtenir le chemin exact du socket, exécutez dans l'onglet **SQL**
> de phpMyAdmin :
> ```sql
> SHOW VARIABLES LIKE 'socket';
> ```
> Reportez la valeur obtenue (ex. `/var/lib/mysql/mysql.sock`) dans
> `DB_SOCKET`. Si `DB_SOCKET` est défini, `DB_HOST`/`DB_PORT` sont ignorés.
>
> Si vous préférez malgré tout une connexion réseau classique (ex. base
> hébergée ailleurs que sur le même serveur), laissez `DB_SOCKET` vide et
> utilisez `DB_HOST=127.0.0.1` + `DB_PORT=3306` — mais cela suppose que
> l'utilisateur MySQL a bien une autorisation pour `127.0.0.1` ou `%`,
> ce qui n'est pas le cas par défaut chez Hostinger.

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
