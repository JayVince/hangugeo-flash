/**
 * Pool de connexions MySQL — partagé par toute l'application.
 * Configuration via variables d'environnement (voir .env.example).
 *
 * Deux modes de connexion :
 * - DB_SOCKET défini → connexion via socket Unix (recommandé sur les
 *   hébergements mutualisés comme Hostinger, où l'utilisateur MySQL n'a
 *   parfois l'autorisation que pour ce mode, pas pour une connexion
 *   réseau classique à 127.0.0.1 — voir DEPLOIEMENT-HOSTINGER.md).
 * - Sinon → connexion réseau classique via DB_HOST/DB_PORT.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const baseConfig = {
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4_unicode_ci',
};

const connectionConfig = process.env.DB_SOCKET
  ? { ...baseConfig, socketPath: process.env.DB_SOCKET }
  : { ...baseConfig, host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT) || 3306 };

const pool = mysql.createPool(connectionConfig);

module.exports = pool;
