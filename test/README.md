# Tests

Ce projet contient deux suites de tests, conçues pour être exécutées
contre une vraie base MySQL/MariaDB de test (jamais contre la base de
production).

## Préparer une base de test

```bash
mysql -u root -e "
  CREATE DATABASE hangugeo_flash_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'hgflash'@'localhost' IDENTIFIED BY 'test_password_local';
  GRANT ALL PRIVILEGES ON hangugeo_flash_test.* TO 'hgflash'@'localhost';
"

DB_HOST=localhost DB_USER=hgflash DB_PASSWORD=test_password_local DB_NAME=hangugeo_flash_test \
  npm run migrate

DB_HOST=localhost DB_USER=hgflash DB_PASSWORD=test_password_local DB_NAME=hangugeo_flash_test \
  npm run seed-vocab
```

## Lancer le serveur de test

```bash
npm install --no-save jsdom   # nécessaire uniquement pour les tests

DB_HOST=localhost DB_USER=hgflash DB_PASSWORD=test_password_local DB_NAME=hangugeo_flash_test \
JWT_SECRET=test_secret_for_local_testing_only \
PORT=3200 NODE_ENV=development \
node server.js &
```

## Lancer les tests

```bash
# Tests backend purs : auth, sécurité, isolation des données (23 tests)
node test/run-backend-tests.js

# Tests d'intégration frontend ↔ backend ↔ base de données réelle (12 tests)
node test/run-integration-tests.js
```

Les deux suites créent leurs propres comptes de test (noms uniques générés
à chaque exécution) et n'interfèrent pas avec des données existantes.
