const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// Sert tous les fichiers depuis le dossier public/
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`한국어 Flash lancé → http://localhost:${PORT}`);
});
