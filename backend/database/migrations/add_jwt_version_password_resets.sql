-- ============================================================
-- Sécurité — Révocation JWT + Mot de passe oublié
-- ============================================================

-- Version JWT : incrémentée à chaque révocation (changement de mot de passe,
-- désactivation de compte, ...) pour invalider les sessions existantes.
ALTER TABLE users ADD COLUMN jwt_version INT NOT NULL DEFAULT 1 AFTER is_active;

-- Tokens de réinitialisation de mot de passe
CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;