-- ════════════════════════════════════════════════════════
-- 한국어 Flash by OppaLingo — Schéma de base de données
-- Compatible MySQL / MariaDB (hébergement Hostinger)
-- ════════════════════════════════════════════════════════

-- Comptes utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(30)  NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar        VARCHAR(10)  NOT NULL DEFAULT '🌸',
  role          ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_username (username),
  UNIQUE KEY uniq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Jetons de réinitialisation de mot de passe (envoyés par e-mail)
CREATE TABLE IF NOT EXISTS password_resets (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMP NOT NULL,
  used        TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_token_hash (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vocabulaire du programme (les 270 mots + futurs ajouts)
-- La contrainte UNIQUE sur "hangeul" empêche tout doublon au niveau base.
CREATE TABLE IF NOT EXISTS vocab (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  hangeul      VARCHAR(50)  NOT NULL,
  romanisation VARCHAR(100) NOT NULL,
  translation  VARCHAR(150) NOT NULL,
  category     VARCHAR(50)  NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_hangeul (hangeul)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cartes personnalisées créées par chaque utilisateur
CREATE TABLE IF NOT EXISTS custom_cards (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  hangeul      VARCHAR(50)  NOT NULL,
  romanisation VARCHAR(100) NOT NULL,
  translation  VARCHAR(150) NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Progression Leitner par utilisateur et par carte (vocab du programme OU carte perso)
CREATE TABLE IF NOT EXISTS user_progress (
  user_id      INT NOT NULL,
  card_type    ENUM('vocab', 'custom') NOT NULL,
  card_id      INT NOT NULL,
  box          TINYINT NOT NULL DEFAULT 1,
  last_action  ENUM('mastered', 'review') NULL,
  next_review  DATE NOT NULL,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, card_type, card_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historique des sessions de quiz
CREATE TABLE IF NOT EXISTS quiz_history (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  score      INT NOT NULL,
  total      INT NOT NULL,
  mode       ENUM('qcm', 'typing') NOT NULL,
  category   VARCHAR(50) NOT NULL DEFAULT 'all',
  played_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Série de jours consécutifs (streak) par utilisateur
CREATE TABLE IF NOT EXISTS user_streaks (
  user_id           INT PRIMARY KEY,
  current_streak    INT NOT NULL DEFAULT 0,
  longest_streak    INT NOT NULL DEFAULT 0,
  last_active_date  DATE NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Journal d'audit des actions administrateur
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  admin_id    INT NOT NULL,
  action      VARCHAR(50)  NOT NULL,
  target_type VARCHAR(30)  NOT NULL,
  target_id   VARCHAR(50)  NULL,
  details     TEXT         NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
