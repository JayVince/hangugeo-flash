# Déploiement de 한국어 Flash (OppaLingo) sur Hostinger

Ce guide explique comment publier l'application sur **oppalingo.com** via
l'hébergement Node.js de Hostinger (hPanel).

## Prérequis

- Un plan d'hébergement Hostinger qui inclut **Node.js** (Business / Cloud,
  ou VPS). Le nom de domaine `oppalingo.com` doit déjà être ajouté ou pointé
  vers ce compte d'hébergement.
- Le code source de ce projet (ce dossier complet) prêt à être envoyé sur
  GitHub ou via gestionnaire de fichiers / SFTP.

## Étape 1 — Mettre le code sur GitHub (recommandé)

```bash
git init
git add .
git commit -m "Initial commit — 한국어 Flash by OppaLingo"
git branch -M main
git remote add origin https://github.com/VOTRE_PSEUDO/hangugeo-flash.git
git push -u origin main
```

## Étape 2 — Créer l'application Node.js dans hPanel

1. Connectez-vous à **hPanel** → menu **Avancé** → **Node.js**.
2. Cliquez sur **Créer une application**.
3. Renseignez :
   - **Version de Node.js** : 18.x ou plus récente (voir `engines` dans `package.json`)
   - **Racine de l'application** : le dossier où le code sera déployé (ex. `oppalingo.com`)
   - **Domaine** : sélectionnez `oppalingo.com`
   - **Fichier de démarrage de l'application** : `server.js`
4. Validez la création.

## Étape 3 — Envoyer les fichiers

- **Option A — Git** : dans hPanel, utilisez l'option « Déployer depuis Git »
  si disponible, en pointant vers votre dépôt GitHub.
- **Option B — Gestionnaire de fichiers / SFTP** : uploadez tout le contenu
  de ce dossier (sauf `node_modules/`, qui sera généré) dans la racine de
  l'application configurée à l'étape 2.

## Étape 4 — Installer les dépendances

Dans l'interface Node.js de hPanel, cliquez sur **NPM Install** (ou ouvrez le
terminal SSH fourni et lancez `npm install` à la racine du projet). Cela
installe Express à partir de `package.json`.

## Étape 5 — Démarrer / redémarrer l'application

Cliquez sur **Restart App** (ou **Démarrer**) dans hPanel. Hostinger attribue
automatiquement un port à l'application via la variable d'environnement
`PORT` — `server.js` la lit déjà correctement (`process.env.PORT`), aucune
configuration supplémentaire n'est nécessaire.

## Étape 6 — Vérifier le domaine

Rendez-vous sur **https://oppalingo.com** — l'application doit s'afficher.
Si le domaine ne répond pas immédiatement, vérifiez :
- que les **DNS** d'`oppalingo.com` pointent bien vers Hostinger ;
- que le **SSL** (Let's Encrypt, gratuit chez Hostinger) est activé pour le
  domaine, dans hPanel → **SSL**.

## Mises à jour futures

Pour publier une nouvelle version :
1. Poussez vos modifications sur GitHub (`git push`).
2. Dans hPanel → Node.js, cliquez sur **Pull** (si déploiement Git) ou
   réenvoyez les fichiers modifiés via SFTP.
3. Relancez **NPM Install** si `package.json` a changé.
4. Cliquez sur **Restart App**.

## Notes techniques

- L'application est 100 % statique côté contenu (HTML/CSS/JS) servie par un
  petit serveur Express — aucune base de données n'est nécessaire.
- Toutes les données utilisateur (cartes personnalisées, progression, série
  de jours, historique des quiz) sont stockées dans le **localStorage du
  navigateur** : elles restent sur l'appareil de chaque visiteur, rien n'est
  envoyé ni stocké côté serveur Hostinger.
