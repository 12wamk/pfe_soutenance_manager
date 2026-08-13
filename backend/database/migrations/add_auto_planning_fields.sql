-- ============================================================
-- AUTO-PLANNING AI — Migration des champs d'expertise et matching
-- ============================================================

-- ---------------- Utilisateurs (expertises) ----------------
ALTER TABLE users ADD COLUMN expertises JSON NULL COMMENT 'Liste des domaines d\'expertise (ex: ["mobile","ai","web"])';
ALTER TABLE users ADD COLUMN enseignements JSON NULL COMMENT 'Cours enseignés (ex: ["Dev Mobile","IA","BDD"])';
ALTER TABLE users ADD COLUMN domaines_recherche JSON NULL COMMENT 'Domaines de recherche';
ALTER TABLE users ADD COLUMN bio_courte TEXT NULL COMMENT 'Description courte pour matching sémantique';

-- ---------------- Étudiants (mots-clés projet) ----------------
ALTER TABLE etudiants ADD COLUMN resume_projet TEXT NULL COMMENT 'Résumé du projet pour extraction de mots-clés';
ALTER TABLE etudiants ADD COLUMN mots_cles_projet JSON NULL COMMENT 'Mots-clés du projet (ex: ["flutter","firebase","mobile"])';

-- ---------------- Publications (détection conflits d'intérêts) ----------------
CREATE TABLE publications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(255) NOT NULL,
    mots_cles JSON NULL,
    annee INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE publication_auteurs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    publication_id INT NOT NULL,
    user_id INT NOT NULL,
    FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_pub_user (publication_id, user_id)
) ENGINE=InnoDB;

-- ---------------- Données de démo ----------------
UPDATE users SET expertises = '["mobile","android","kotlin","flutter"]', enseignements = '["Développement Mobile","Programmation Android"]', domaines_recherche = '["Mobile Computing","UX/UI"]', bio_courte = 'Expert en développement mobile natif et cross-platform' WHERE id = 3;
UPDATE users SET expertises = '["cybersecurite","reseau","python","pentest"]', enseignements = '["Sécurité Réseau","Administration Système"]', domaines_recherche = '["Cybersécurité","IoT Security"]', bio_courte = 'Spécialiste en cybersécurité et analyse de vulnérabilités' WHERE id = 4;
UPDATE users SET expertises = '["web","react","angular","javascript","nodejs"]', enseignements = '["Développement Web","Frameworks JS"]', domaines_recherche = '["Web Full Stack","Cloud"]', bio_courte = 'Développeur full-stack, expert React et Node.js' WHERE id = 5;
UPDATE users SET expertises = '["ai","machine-learning","python","data-science"]', enseignements = '["Intelligence Artificielle","Data Mining"]', domaines_recherche = '["Deep Learning","NLP"]', bio_courte = 'Chercheur en IA et machine learning' WHERE id = 6;
UPDATE users SET expertises = '["electronique","iot","embarque","vhdl"]', enseignements = '["Électronique Embarqué","FPGA"]', domaines_recherche = '["IoT","Systèmes Embarqués"]', bio_courte = 'Expert en systèmes embarqués et IoT' WHERE id = 7;

UPDATE etudiants SET resume_projet = 'Développement d une application IoT industrielle avec capteurs et dashboard web', mots_cles_projet = '["iot","industriel","capteurs","dashboard","web"]' WHERE id = 1;
UPDATE etudiants SET resume_projet = 'Analyse de vulnerabilites reseau avec Python et outils de pentest', mots_cles_projet = '["cybersecurite","reseau","python","pentest","vulnerabilites"]' WHERE id = 2;
UPDATE etudiants SET resume_projet = 'Plateforme web de gestion des soutenances PFE avec React et Node.js', mots_cles_projet = '["web","react","nodejs","gestion","plateforme"]' WHERE id = 3;
