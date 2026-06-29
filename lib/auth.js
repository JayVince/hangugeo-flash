/**
 * Utilitaires d'authentification : hachage des mots de passe (bcrypt)
 * et signature/vérification des jetons de session (JWT).
 */
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY     = '30d';
const COOKIE_NAME    = 'hgflash_session';

function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

function verifyPassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

function signSession(payload) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET manquant — définissez-le dans les variables d\'environnement.');
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function verifySession(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours, doit correspondre à JWT_EXPIRY
    path: '/',
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  cookieOptions,
  COOKIE_NAME,
};
