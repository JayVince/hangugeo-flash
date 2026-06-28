const express = require('express');
const path    = require('path');

const app  = express();

// Hostinger (et la plupart des hébergeurs Node.js) fournissent le port
// via la variable d'environnement PORT — ne jamais le fixer en dur.
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// L'app tourne derrière un proxy inverse chez Hostinger
app.set('trust proxy', 1);

// Sert tous les fichiers statiques depuis public/ (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, HOST, () => {
  console.log(`한국어 Flash (OppaLingo) lancé sur le port ${PORT}`);
});
