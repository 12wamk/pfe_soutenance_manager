-- ============================================================
-- FICHIER GÉNÉRÉ — ne pas éditer à la main.
-- Source : docker/db/generate_init.py
-- Regroupe : schema.sql + migrations + données de démonstration
-- pour l'initialisation automatique du conteneur MySQL (initdb).
-- ============================================================

SET NAMES utf8mb4;
SET character_set_server = utf8mb4;
CREATE DATABASE IF NOT EXISTS pfe_soutenance_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pfe_soutenance_manager;

-- ---------------- Début : schema.sql ----------------

-- ============================================================
-- Base de données : Plateforme de Gestion des Soutenances PFE
-- ENET'COM — Script de création + jeu de données de démonstration
-- ============================================================

CREATE DATABASE IF NOT EXISTS pfe_soutenance_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pfe_soutenance_manager;

-- ---------------- Départements & Options ----------------
CREATE TABLE departements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(150) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(150) NOT NULL,
    departement_id INT,
    FOREIGN KEY (departement_id) REFERENCES departements(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------- Utilisateurs ----------------
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','chef_dept','encadrant') NOT NULL DEFAULT 'encadrant',
    departement_id INT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (departement_id) REFERENCES departements(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------- Étudiants ----------------
CREATE TABLE etudiants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code_etudiant VARCHAR(50) NOT NULL UNIQUE,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    niveau VARCHAR(100),
    option_id INT NULL,
    encadrant_id INT NULL,
    titre_sujet VARCHAR(255),
    date_debut DATE NULL,
    date_fin DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (option_id) REFERENCES options(id) ON DELETE SET NULL,
    FOREIGN KEY (encadrant_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------- Période & calendrier ----------------
CREATE TABLE periode (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    max_par_jour INT NOT NULL DEFAULT 5,
    annee_universitaire VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE jours_calendrier (
    id INT AUTO_INCREMENT PRIMARY KEY,
    periode_id INT NOT NULL,
    date DATE NOT NULL,
    actif TINYINT(1) NOT NULL DEFAULT 1,
    max_soutenances INT NOT NULL DEFAULT 5,
    est_ferie TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (periode_id) REFERENCES periode(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_date (periode_id, date)
) ENGINE=InnoDB;

CREATE TABLE parametres_creneaux (
    id INT AUTO_INCREMENT PRIMARY KEY,
    heure_depart TIME NOT NULL DEFAULT '08:30:00',
    duree_soutenance INT NOT NULL DEFAULT 30 COMMENT 'en minutes',
    duree_pause INT NOT NULL DEFAULT 10 COMMENT 'en minutes'
) ENGINE=InnoDB;

CREATE TABLE parametres_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    delai_expiration_jours INT NOT NULL DEFAULT 3
) ENGINE=InnoDB;

-- ---------------- Soutenances ----------------
CREATE TABLE soutenances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    etudiant_id INT NOT NULL,
    encadrant_id INT NULL,
    rapporteur_id INT NULL,
    president_id INT NULL,
    date DATE NULL,
    heure TIME NULL,
    salle VARCHAR(50) NULL,
    statut ENUM('planifiee','validee','refusee') NOT NULL DEFAULT 'planifiee',
    motif_refus VARCHAR(255) NULL,
    departement_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (etudiant_id) REFERENCES etudiants(id) ON DELETE CASCADE,
    FOREIGN KEY (encadrant_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (rapporteur_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (president_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------- Invitations jury ----------------
CREATE TABLE invitations_jury (
    id INT AUTO_INCREMENT PRIMARY KEY,
    soutenance_id INT NOT NULL,
    enseignant_id INT NOT NULL,
    role ENUM('rapporteur','president') NOT NULL,
    statut ENUM('en_attente','acceptee','refusee','expiree') NOT NULL DEFAULT 'en_attente',
    date_envoi DATETIME NOT NULL,
    date_limite DATETIME NOT NULL,
    date_reponse DATETIME NULL,
    validee_par INT NULL COMMENT 'utilisateur ayant levé manuellement une expiration',
    FOREIGN KEY (soutenance_id) REFERENCES soutenances(id) ON DELETE CASCADE,
    FOREIGN KEY (enseignant_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (validee_par) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------- Participation inter-département ----------------
CREATE TABLE demandes_participation (
    id INT AUTO_INCREMENT PRIMARY KEY,
    enseignant_id INT NOT NULL,
    departement_cible_id INT NOT NULL,
    role_souhaite ENUM('rapporteur','president','les_deux') NOT NULL,
    nombre_souhaite INT NOT NULL DEFAULT 1,
    statut ENUM('en_attente','acceptee','refusee') NOT NULL DEFAULT 'en_attente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (enseignant_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (departement_cible_id) REFERENCES departements(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------- Disponibilités ----------------
CREATE TABLE disponibilites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    enseignant_id INT NOT NULL,
    date DATE NOT NULL,
    statut ENUM('disponible','absent') NOT NULL DEFAULT 'disponible',
    FOREIGN KEY (enseignant_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_ens_date (enseignant_id, date)
) ENGINE=InnoDB;

-- ---------------- Notifications in-app ----------------
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('info','success','warning','error') NOT NULL DEFAULT 'info',
    titre VARCHAR(150) NOT NULL,
    message VARCHAR(500) NOT NULL,
    lien VARCHAR(255) NULL,
    lu TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- DONNÉES DE DÉMONSTRATION
-- ============================================================

INSERT INTO departements (nom) VALUES ('Génie Informatique'), ('Télécommunications'), ('Électronique');

INSERT INTO options (nom, departement_id) VALUES
('Master 2 GII', 1), ('Licence TIC', 2), ('Master Électronique', 3);

-- Mot de passe pour tous les comptes de démo : password123
-- Hash généré avec password_hash('password123', PASSWORD_DEFAULT)
INSERT INTO users (nom, prenom, email, password, role, departement_id, is_active) VALUES
('Admin', 'Système', 'admin@enetcom.tn', '$2y$10$CZ3oyh2J4LJUculIkZyKiOgNKYYTY9kfzbyluBnKOAEhHyc4KodgC', 'admin', NULL, 1),
('Trabelsi', 'Sami', 'chef@enetcom.tn', '$2y$10$CZ3oyh2J4LJUculIkZyKiOgNKYYTY9kfzbyluBnKOAEhHyc4KodgC', 'chef_dept', 1, 1),
('Ben Nasr', 'Mounir', 'mounir.bennacer@enetcom.usf.tn', '$2y$10$CZ3oyh2J4LJUculIkZyKiOgNKYYTY9kfzbyluBnKOAEhHyc4KodgC', 'encadrant', 1, 1),
('Abdelmoula', 'Chokri', 'chokri.abdelmoula@enetcom.usf.tn', '$2y$10$CZ3oyh2J4LJUculIkZyKiOgNKYYTY9kfzbyluBnKOAEhHyc4KodgC', 'encadrant', 1, 1),
('Ellouze', 'Nebrasse', 'nebrasse.ellouze@enetcom.usf.tn', '$2y$10$CZ3oyh2J4LJUculIkZyKiOgNKYYTY9kfzbyluBnKOAEhHyc4KodgC', 'encadrant', 2, 1),
('Ghorbel', 'Mohamed', 'mohamed.ghorbel@enetcom.usf.tn', '$2y$10$CZ3oyh2J4LJUculIkZyKiOgNKYYTY9kfzbyluBnKOAEhHyc4KodgC', 'encadrant', 1, 1),
('Hajji', 'Sofiene', 'soufien.hajji@enetcom.usf.tn', '$2y$10$CZ3oyh2J4LJUculIkZyKiOgNKYYTY9kfzbyluBnKOAEhHyc4KodgC', 'encadrant', 3, 1);

INSERT INTO etudiants (code_etudiant, nom, prenom, niveau, option_id, encadrant_id, titre_sujet, date_debut, date_fin) VALUES
('ET2024010', 'Saidi', 'Leila', 'Master 2 GII', 1, 3, "Développement d'une application IoT industrielle", '2024-01-15', '2024-06-30'),
('ET2024011', 'Masmoudi', 'Rami', 'Licence TIC', 2, 5, 'Analyse de vulnérabilités réseau avec Python', '2024-02-01', '2024-07-15'),
('ET2024012', 'Ben Salah', 'Karim', 'Master 2 GII', 1, 4, "Plateforme de gestion des soutenances PFE", '2024-01-20', '2024-06-25');

INSERT INTO parametres_creneaux (heure_depart, duree_soutenance, duree_pause) VALUES ('08:30:00', 30, 10);
INSERT INTO parametres_notifications (delai_expiration_jours) VALUES (3);

-- ============================================================
-- ÉVOLUTIONS SCHÉMA — règles métier étendues (v1.1)
-- ============================================================

-- Grade des enseignants (utile à l'import CSV)
ALTER TABLE users ADD COLUMN grade VARCHAR(100) NULL AFTER role;

-- Paramétrage fin des notifications : message d'expiration + délai de rappel
ALTER TABLE parametres_notifications ADD COLUMN message_expiration VARCHAR(255) NOT NULL DEFAULT 'Votre invitation au jury a expiré faute de réponse dans le délai imparti.';
ALTER TABLE parametres_notifications ADD COLUMN delai_rappel_heures INT NOT NULL DEFAULT 24;

-- Suivi du rappel envoyé avant expiration (pour éviter les doublons de rappel)
ALTER TABLE invitations_jury ADD COLUMN rappel_envoye TINYINT(1) NOT NULL DEFAULT 0;

-- Disponibilités préférées jointes à une demande de participation
ALTER TABLE demandes_participation ADD COLUMN disponibilites_preferees VARCHAR(500) NULL;

-- ============================================================
-- CHATBOT — historique des conversations
-- ============================================================
CREATE TABLE chatbot_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    role ENUM('user','bot') NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- ÉVOLUTION v1.2 — statut "sans_date" pour les soutenances
-- créées automatiquement à l'import, en attente de planification
-- ============================================================
ALTER TABLE soutenances MODIFY statut ENUM('sans_date','planifiee','validee','refusee') NOT NULL DEFAULT 'sans_date';

-- ============================================================
-- ÉVOLUTION v1.3 — multi-départements avancé, jury nominatif
-- ============================================================

-- Départements : code court + chef de département désigné
ALTER TABLE departements ADD COLUMN code VARCHAR(20) NULL AFTER nom;
ALTER TABLE departements ADD COLUMN chef_dept_id INT NULL AFTER code;
ALTER TABLE departements ADD CONSTRAINT fk_dept_chef FOREIGN KEY (chef_dept_id) REFERENCES users(id) ON DELETE SET NULL;

-- Options = "spécialités" (même table, on ajoute juste un code court pour la déduction auto à l'import)
ALTER TABLE options ADD COLUMN code VARCHAR(20) NULL AFTER nom;

-- Maximum de soutenances par jour personnalisable par enseignant (NULL = utilise le max du jour)
ALTER TABLE users ADD COLUMN max_soutenances_jour INT NULL AFTER grade;

-- Données de démo : codes des départements et spécialités déjà créés
UPDATE departements SET code = 'GII' WHERE nom = 'Génie Informatique';
UPDATE departements SET code = 'TIC' WHERE nom = 'Télécommunications';
UPDATE departements SET code = 'ELEC' WHERE nom = 'Électronique';
UPDATE options SET code = 'SII' WHERE nom = 'Master 2 GII';
UPDATE options SET code = 'TIC' WHERE nom = 'Licence TIC';
UPDATE options SET code = 'ELEC' WHERE nom = 'Master Électronique';

-- ============================================================
-- ÉVOLUTION v1.4 — invitation proactive inter-département
-- ============================================================
-- Distingue : demande initiée par l'enseignant lui-même ('enseignant', flux existant,
-- validée par le chef du département cible) vs invitation initiée par le département
-- ('departement', nouveau flux, validée par l'enseignant invité lui-même).
ALTER TABLE demandes_participation ADD COLUMN initiateur ENUM('enseignant','departement') NOT NULL DEFAULT 'enseignant' AFTER enseignant_id;

-- ============================================================
-- ÉVOLUTION v1.5 — photo de profil
-- ============================================================
ALTER TABLE users ADD COLUMN photo_url VARCHAR(255) NULL AFTER grade;

-- ============================================================
-- ÉVOLUTION v1.6 — binômes (2 étudiants pour une même soutenance)
-- ============================================================
-- Une soutenance garde une seule date/heure/salle/jury/statut,
-- qu'elle concerne 1 ou 2 étudiants. etudiant2_id est nullable :
-- NULL = soutenance individuelle (comportement inchangé), rempli
-- = binôme. Hypothèse : maximum 2 étudiants par soutenance (pas
-- de trinôme géré par ce schéma).

ALTER TABLE soutenances ADD COLUMN etudiant2_id INT NULL AFTER etudiant_id;
ALTER TABLE soutenances ADD CONSTRAINT fk_soutenance_etudiant2
    FOREIGN KEY (etudiant2_id) REFERENCES etudiants(id) ON DELETE SET NULL;

-- Empêche qu'un même étudiant soit etudiant_id ET etudiant2_id de la même ligne
ALTER TABLE soutenances ADD CONSTRAINT chk_binome_distinct
    CHECK (etudiant2_id IS NULL OR etudiant2_id != etudiant_id);

-- ============================================================
-- ÉVOLUTION v1.16 — table de liaison soutenance_etudiants (N étudiants)
-- ============================================================
-- Une soutenance peut concerner N étudiants (solo, binôme, trinôme, ...).
-- La colonne soutenances.etudiant_id reste le membre principal (compat), mais le
-- groupe complet se lit/écrit via cette table.

CREATE TABLE IF NOT EXISTS soutenance_etudiants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    soutenance_id INT NOT NULL,
    etudiant_id INT NOT NULL,
    ordre INT NOT NULL DEFAULT 1,
    UNIQUE KEY uq_soutenance_etudiant (soutenance_id, etudiant_id),
    KEY idx_etudiant (etudiant_id),
    CONSTRAINT fk_se_soutenance FOREIGN KEY (soutenance_id)
        REFERENCES soutenances(id) ON DELETE CASCADE,
    CONSTRAINT fk_se_etudiant FOREIGN KEY (etudiant_id)
        REFERENCES etudiants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    -- ============================================================
-- ÉVOLUTION v1.7 — ajustement manuel de la réciprocité (admin)
-- ============================================================
ALTER TABLE users ADD COLUMN ajustement_rapporteur INT NOT NULL DEFAULT 0 AFTER max_soutenances_jour;
ALTER TABLE users ADD COLUMN ajustement_president INT NOT NULL DEFAULT 0 AFTER ajustement_rapporteur;

CREATE TABLE ajustements_reciprocite_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    enseignant_id INT NOT NULL,
    role ENUM('rapporteur','president') NOT NULL,
    valeur_avant INT NOT NULL,
    valeur_apres INT NOT NULL,
    delta INT NOT NULL,
    motif VARCHAR(255) NULL,
    modifie_par INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (enseignant_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (modifie_par) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ---------------- Début : migrations/add_auto_planning_fields.sql ----------------

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


-- ---------------- Début : migrations/add_explication_ia.sql ----------------

-- ============================================================
-- EXPLICATION IA PERSISTÉE — colonne JSON sur soutenances
-- Stocke le détail du choix IA (score par membre du jury, matching,
-- contraintes vérifiées) pour l'afficher côté enseignant et admin.
-- ============================================================

ALTER TABLE soutenances ADD COLUMN explication_ia JSON NULL COMMENT 'Détail du choix IA (score par membre du jury, contraintes vérifiées)';


-- ---------------- Début : migrations/demo_donnees_planning.sql ----------------

-- ============================================================
-- AUTO-PLANNING AI — Données de démo pour tester le planning
-- Crée : période de soutenances, jours actifs, soutenances sans date.
-- À exécuter après add_auto_planning_fields.sql.
-- ============================================================

-- Colonne durée réelle (utilisée par predire-duree / retrain-duree / impact-stats)
ALTER TABLE soutenances ADD COLUMN duree_reelle_min INT NULL COMMENT 'Durée réelle en minutes';

-- Période de soutenances (2 semaines à partir du lundi 17/08/2026)
INSERT INTO periode (date_debut, date_fin, max_par_jour, annee_universitaire)
VALUES ('2026-08-17', '2026-08-28', 6, '2025-2026');

-- Jours actifs (lundi à vendredi, 6 soutenances max/jour)
INSERT INTO jours_calendrier (periode_id, date, actif, max_soutenances, est_ferie) VALUES
(1, '2026-08-17', 1, 6, 0),
(1, '2026-08-18', 1, 6, 0),
(1, '2026-08-19', 1, 6, 0),
(1, '2026-08-20', 1, 6, 0),
(1, '2026-08-21', 1, 6, 0),
(1, '2026-08-24', 1, 6, 0),
(1, '2026-08-25', 1, 6, 0),
(1, '2026-08-26', 1, 6, 0),
(1, '2026-08-27', 1, 6, 0),
(1, '2026-08-28', 1, 6, 0);

-- Soutenances sans date pour les 3 étudiants de démo
-- (encadrants : 3 = Ben Nasr, 4 = Abdelmoula, 5 = Ellouze)
INSERT INTO soutenances (etudiant_id, encadrant_id, date, heure, salle, statut) VALUES
(1, 3, NULL, NULL, NULL, 'sans_date'),
(2, 5, NULL, NULL, NULL, 'sans_date'),
(3, 4, NULL, NULL, NULL, 'sans_date');

-- Rappel : pour exécuter un seul ALTER en cas de re-exécution :
-- ALTER TABLE soutenances ADD COLUMN duree_reelle_min INT NULL;


-- ---------------- Début : migrations/demo_donnees_elaborees.sql ----------------

-- ============================================================
-- DONNÉES DE DÉMO ENRICHIES — pour faciliter les tests
-- À exécuter APRÈS demo_donnees_planning.sql.
-- Ajoute :
--   • 4 étudiants supplémentaires (ids 4 à 7) avec mots-clés projets
--   • 4 soutenances : 2 déjà planifiées (avec jury + invitations) et
--     2 "sans_date" (à traiter par l'auto-planning IA)
--   • quelques disponibilités enseignants (absences)
-- ============================================================

-- ---------------- Nouveaux étudiants (ids 4 à 7) ----------------
INSERT INTO etudiants (code_etudiant, nom, prenom, niveau, option_id, encadrant_id, titre_sujet, date_debut, date_fin) VALUES
('ET2024013', 'Bouazizi', 'Yassine', 'Licence TIC', 2, 4, 'Application mobile de gestion des stocks pour PME', '2024-03-01', '2024-07-20'),
('ET2024014', 'Trabelsi', 'Aya', 'Master 2 GII', 1, 6, 'Prédiction de la consommation énergétique par machine learning', '2024-02-10', '2024-06-28'),
('ET2024015', 'Jelassi', 'Omar', 'Master 2 GII', 1, 7, 'Système de supervision IoT pour serres agricoles', '2024-03-15', '2024-07-25'),
('ET2024016', 'Hammami', 'Nour', 'Licence TIC', 2, 3, 'Framework web modulaire pour API REST', '2024-02-20', '2024-07-05');

-- Résumés + mots-clés (utilisés par le matching IA)
UPDATE etudiants SET resume_projet = 'Application mobile Android et iOS de gestion des stocks avec synchronisation cloud', mots_cles_projet = '["mobile","android","ios","stocks","gestion","cloud"]' WHERE id = 4;
UPDATE etudiants SET resume_projet = 'Prédiction de la consommation électrique d un bâtiment avec des modèles de machine learning', mots_cles_projet = '["machine-learning","python","consommation","prediction","energie"]' WHERE id = 5;
UPDATE etudiants SET resume_projet = 'Système de supervision de serres avec capteurs IoT, Node.js et dashboard temps réel', mots_cles_projet = '["iot","capteurs","nodejs","serres","dashboard"]' WHERE id = 6;
UPDATE etudiants SET resume_projet = 'Framework web modulaire en Node.js pour construire des API REST rapidement', mots_cles_projet = '["web","nodejs","rest","framework","api"]' WHERE id = 7;

-- ---------------- Nouvelles soutenances (ids 4 à 7) ----------------
-- 2 déjà planifiées (jurys conformes : président ≠ rapporteur, encadrant exclu)
INSERT INTO soutenances (etudiant_id, encadrant_id, rapporteur_id, president_id, date, heure, salle, statut) VALUES
(4, 4, 6, 2, '2026-08-17', '10:30:00', 'Salle 2', 'planifiee'),
(5, 6, 7, 2, '2026-08-18', '09:10:00', 'Salle 1', 'planifiee');

-- 2 en attente de planification (à traiter par l'auto-planning IA)
INSERT INTO soutenances (etudiant_id, encadrant_id, date, heure, salle, statut) VALUES
(6, 7, NULL, NULL, NULL, 'sans_date'),
(7, 3, NULL, NULL, NULL, 'sans_date');

-- ---------------- Invitations jury pour les soutenances planifiées ----------------
INSERT INTO invitations_jury (soutenance_id, enseignant_id, role, statut, date_envoi, date_limite) VALUES
(4, 6, 'rapporteur', 'en_attente', '2026-08-15 09:00:00', '2026-08-16 23:59:59'),
(4, 2, 'president', 'en_attente', '2026-08-15 09:00:00', '2026-08-16 23:59:59'),
(5, 7, 'rapporteur', 'en_attente', '2026-08-15 09:00:00', '2026-08-17 23:59:59'),
(5, 2, 'president', 'en_attente', '2026-08-15 09:00:00', '2026-08-17 23:59:59');

-- ---------------- Quelques disponibilités enseignants ----------------
INSERT INTO disponibilites (enseignant_id, date, statut) VALUES
(3, '2026-08-19', 'absent'),
(7, '2026-08-17', 'absent'),
(6, '2026-08-20', 'absent');


-- ---------------- Début : migrations/add_soutenance_etudiants.sql ----------------

-- ============================================================
-- v1.16 — Table de liaison soutenance_etudiants
-- Permet à une soutenance de concerner N étudiants (solo, binôme, trinôme, ...).
-- La colonne soutenances.etudiant_id reste le membre principal (compat), mais le
-- groupe complet se lit/écrit via cette table.
-- ============================================================

CREATE TABLE IF NOT EXISTS soutenance_etudiants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    soutenance_id INT NOT NULL,
    etudiant_id INT NOT NULL,
    ordre INT NOT NULL DEFAULT 1,
    UNIQUE KEY uq_soutenance_etudiant (soutenance_id, etudiant_id),
    KEY idx_etudiant (etudiant_id),
    CONSTRAINT fk_se_soutenance FOREIGN KEY (soutenance_id)
        REFERENCES soutenances(id) ON DELETE CASCADE,
    CONSTRAINT fk_se_etudiant FOREIGN KEY (etudiant_id)
        REFERENCES etudiants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill depuis l'ancien schéma (etudiant_id / etudiant2_id)
INSERT IGNORE INTO soutenance_etudiants (soutenance_id, etudiant_id, ordre)
SELECT s.id, s.etudiant_id, 1 FROM soutenances s WHERE s.etudiant_id IS NOT NULL;

INSERT IGNORE INTO soutenance_etudiants (soutenance_id, etudiant_id, ordre)
SELECT s.id, s.etudiant2_id, 2 FROM soutenances s WHERE s.etudiant2_id IS NOT NULL;


-- ---------------- Début : migrations/demo_donnees_grandes.sql ----------------

-- ============================================================
-- JEU DE TEST ÉTOFFÉ — pour tester l'application avec davantage de données
-- À exécuter APRÈS demo_donnees_elaborees.sql et add_soutenance_etudiants.sql.
-- Ajoute :
--   • 10 enseignants (ids 8 à 17) avec expertises IA (matching jury)
--   • 33 étudiants (ids 8 à 40) avec mots-clés projets
--   • 18 soutenances (ids 8 à 25) : solos, 2 binômes, 2 trinômes ;
--     certaines planifiées avec jury + invitations, d'autres "sans_date"
--   • disponibilités (absences) et publications (conflits d'intérêts)
-- ============================================================

-- ---------------- Nouveaux enseignants (ids 8 à 17) ----------------
INSERT INTO users (id, nom, prenom, email, password, role, departement_id, is_active, grade, expertises, enseignements, domaines_recherche, bio_courte) VALUES
(8,  'Ben Salem', 'Ines',    'ines.bensalem@enetcom.usf.tn',    '$2y$10$CZ3oyh2J4LJUculIkZyKiOgNKYYTY9kfzbyluBnKOAEhHyc4KodgC', 'encadrant', 1, 1, 'MC',      '["web","react","typescript","frontend"]',       '["Développement Web","React"]',                  '["Front-end","Accessibilité"]',        'Experte front-end React et TypeScript'),
(9,  'Mejri', 'Anis',        'anis.mejri@enetcom.usf.tn',       '$2y$10$CZ3oyh2J4LJUculIkZyKiOgNKYYTY9kfzbyluBnKOAEhHyc4KodgC', 'encadrant', 1, 1, 'MA',      '["mobile","flutter","dart","android"]',         '["Développement Mobile","Flutter"]',             '["Mobile","Cross-platform"]',          'Spécialiste du mobile natif et Flutter'),
(10, 'Zouari', 'Salma',      'salma.zouari@enetcom.usf.tn',     '$2y$10$CZ3oyh2J4LJUculIkZyKiOgNKYYTY9kfzbyluBnKOAEhHyc4KodgC', 'encadrant', 2, 1, 'MC',      '["reseau","telecom","5g","wifi"]',             '["Réseaux","Télécoms"]',                         '["Réseaux 5G","WiFi"]',                 'Experte en réseaux et télécommunications'),
(11, 'Khelifi', 'Wajdi',     'wajdi.khelifi@enetcom.usf.tn',    '$2y$10$CZ3oyh2J4LJUculIkZyKiOgNKYYTY9kfzbyluBnKOAEhHyc4KodgC', 'encadrant', 2, 1, 'MA',      '["cybersecurite","pentest","firewall","ids"]',  '["Sécurité","Pentest"]',                         '["Sécurité offensive","IDS/IPS"]',      'Spécialiste cybersécurité et tests d intrusion'),
(12, 'Jebali', 'Hana',       'hana.jebali@enetcom.usf.tn',      '$2y$10$CZ3oyh2J4LJUculIkZyKiOgNKYYTY9kfzbyluBnKOAEhHyc4KodgC', 'encadrant', 3, 1, 'MC',      '["electronique","fpga","vhdl","embarque"]',     '["Électronique Numérique","FPGA"]',              '["FPGA","VHDL"]',                       'Experte en conception FPGA et VHDL'),
(13, 'Rekik', 'Firas',       'firas.rekik@enetcom.usf.tn',      '$2y$10$CZ3oyh2J4LJUculIkZyKiOgNKYYTY9kfzbyluBnKOAEhHyc4KodgC', 'encadrant', 3, 1, 'MA',      '["iot","capteurs","embarque","nodejs"]',        '["IoT","Systèmes Embarqués"]',                   '["IoT","Capteurs"]',                    'Expert IoT et systèmes embarqués'),
(14, 'Nasri', 'Dali',        'dali.nasri@enetcom.usf.tn',       '$2y$10$CZ3oyh2J4LJUculIkZyKiOgNKYYTY9kfzbyluBnKOAEhHyc4KodgC', 'encadrant', 1, 1, 'PES',     '["ai","machine-learning","python","nlp"]',      '["Intelligence Artificielle","NLP"]',            '["Deep Learning","NLP","LLM"]',         'Chercheur en IA, NLP et grands modèles de langage'),
(15, 'Oueslati', 'Rim',      'rim.oueslati@enetcom.usf.tn',     '$2y$10$CZ3oyh2J4LJUculIkZyKiOgNKYYTY9kfzbyluBnKOAEhHyc4KodgC', 'encadrant', 1, 1, 'MC',      '["data-science","bigdata","python","analytics"]','["Data Science","Big Data"]',                   '["Analytics","Big Data"]',              'Experte data science et analyse de données'),
(16, 'Chaabane', 'Imed',     'imed.chaabane@enetcom.usf.tn',    '$2y$10$CZ3oyh2J4LJUculIkZyKiOgNKYYTY9kfzbyluBnKOAEhHyc4KodgC', 'encadrant', 2, 1, 'MA',      '["reseau","cloud","devops","infrastructure"]',  '["Cloud","DevOps"]',                             '["Cloud","Infrastructure"]',            'Expert cloud et infrastructure DevOps'),
(17, 'Mansouri', 'Sirine',   'sirine.mansouri@enetcom.usf.tn',  '$2y$10$CZ3oyh2J4LJUculIkZyKiOgNKYYTY9kfzbyluBnKOAEhHyc4KodgC', 'encadrant', 3, 1, 'MA',      '["automatique","robotique","controle","python"]','["Automatique","Robotique"]',                   '["Robotique","Contrôle"]',              'Experte en robotique et systèmes de contrôle');

-- ---------------- Nouveaux étudiants (ids 8 à 40) avec mots-clés projet ----------------
-- Option 1 = Master 2 GII, 2 = Licence TIC, 3 = Master Électronique
INSERT INTO etudiants (id, code_etudiant, nom, prenom, niveau, option_id, encadrant_id, titre_sujet, date_debut, date_fin, resume_projet, mots_cles_projet) VALUES
-- ---- GII (option 1) ----
(8,  'ET2025001', 'Abidi',   'Farah',   'Master 2 GII', 1, 8,  'Dashboard temps réel de supervision industrielle', '2024-03-01', '2024-07-10', 'Dashboard web temps réel avec websockets pour la supervision de lignes de production', '["web","react","dashboard","temps-reel","websocket"]'),
(9,  'ET2025002', 'Belhaj',  'Youssef', 'Master 2 GII', 1, 9,  'Application mobile de livraison de repas', '2024-03-05', '2024-07-12', 'Application Flutter de livraison de repas avec suivi GPS des coursiers', '["mobile","flutter","dart","livraison","gps"]'),
(10, 'ET2025003', 'Chaari',  'Rim',     'Master 2 GII', 1, 14, 'Classification automatique d avis clients', '2024-02-20', '2024-07-08', 'Modèle de classification d avis clients par apprentissage supervisé', '["ai","machine-learning","python","classification","nlp"]'),
(11, 'ET2025004', 'Dridi',   'Fares',   'Master 2 GII', 1, 15, 'Pipeline Big Data pour l analyse des logs', '2024-03-10', '2024-07-15', 'Pipeline Spark et Kafka pour l analyse temps réel de logs applicatifs', '["bigdata","spark","kafka","python","logs"]'),
(12, 'ET2025005', 'Gharbi',  'Meriem',  'Master 2 GII', 1, 8,  'Plateforme e-commerce avec recommandations', '2024-02-25', '2024-07-05', 'Plateforme e-commerce React/Node.js avec moteur de recommandations', '["web","react","nodejs","ecommerce","recommandation"]'),
(13, 'ET2025006', 'Hamdi',   'Skander', 'Master 2 GII', 1, 9,  'Application de suivi des coursiers', '2024-03-05', '2024-07-12', 'Application Android Kotlin de suivi temps réel des coursiers', '["mobile","android","kotlin","suivi","gps"]'),
(14, 'ET2025007', 'Karray',  'Salma',   'Master 2 GII', 1, 6,  'Chatbot de service client basé sur un LLM', '2024-02-15', '2024-07-01', 'Chatbot de service client basé sur un grand modèle de langage avec RAG', '["ai","llm","nlp","chatbot","python"]'),
(15, 'ET2025008', 'Laabidi', 'Amine',   'Master 2 GII', 1, 14, 'Détection d objets en vision par ordinateur', '2024-03-12', '2024-07-18', 'Détection d objets en temps réel avec réseaux de neurones convolutifs', '["ai","computer-vision","deep-learning","python"]'),
(16, 'ET2025009', 'Mabrouk', 'Sinda',   'Master 2 GII', 1, 15, 'Analyse de sentiments sur les réseaux sociaux', '2024-02-28', '2024-07-06', 'Analyse de sentiments Twitter avec traitement automatique du langage', '["data-science","nlp","python","sentiment"]'),
(17, 'ET2025010', 'Nefzi',   'Hedi',    'Master 2 GII', 1, 8,  'Application web progressive hors-ligne', '2024-03-03', '2024-07-09', 'PWA de gestion de projets fonctionnant hors-ligne avec synchronisation', '["web","pwa","javascript","hors-ligne","sync"]'),
(18, 'ET2025011', 'Riahi',   'Chaima',  'Master 2 GII', 1, 9,  'Application iOS de suivi sportif', '2024-03-08', '2024-07-14', 'Application iOS Swift de suivi des activités sportives avec capteurs', '["mobile","ios","swift","sport","capteurs"]'),
(19, 'ET2025012', 'Saidi',   'Aymen',   'Master 2 GII', 1, 6,  'API de recommandation par machine learning', '2024-02-22', '2024-07-04', 'API REST de recommandation de contenus basée sur des modèles ML', '["ai","machine-learning","api","python"]'),
(20, 'ET2025013', 'Tlili',   'Boutheina','Master 2 GII',1, 6,  'Génération de rapports par LLM', '2024-03-14', '2024-07-20', 'Génération automatique de rapports financiers par grands modèles de langage', '["ai","llm","nlp","rapports","python"]'),
-- ---- TIC (option 2) ----
(21, 'ET2025014', 'Ben Amor','Oussama', 'Licence TIC',  2, 10, 'Optimisation de couverture réseau 5G', '2024-03-02', '2024-07-11', 'Étude et optimisation de la couverture d un réseau 5G avec simulation', '["reseau","5g","telecom","simulation"]'),
(22, 'ET2025015', 'Chaouch', 'Sana',    'Licence TIC',  2, 11, 'Audit de sécurité d un système d information', '2024-02-27', '2024-07-07', 'Audit complet de sécurité avec tests d intrusion et recommandations', '["cybersecurite","pentest","audit","securite"]'),
(23, 'ET2025016', 'Dhouib',  'Montassar','Licence TIC', 2, 16, 'Mise en place d une infrastructure Cloud', '2024-03-06', '2024-07-13', 'Infrastructure cloud conteneurisée avec CI/CD et monitoring', '["cloud","devops","kubernetes","cicd"]'),
(24, 'ET2025017', 'Fekih',   'Jihen',   'Licence TIC',  2, 10, 'Analyse des interférences WiFi', '2024-03-09', '2024-07-16', 'Mesure et analyse des interférences WiFi dans les bâtiments universitaires', '["reseau","wifi","analyse","telecom"]'),
(25, 'ET2025018', 'Guedira', 'Khalil',  'Licence TIC',  2, 11, 'Système de détection d intrusion (IDS)', '2024-02-18', '2024-07-03', 'Système IDS basé sur l analyse de flux réseau et l apprentissage', '["cybersecurite","ids","reseau","detection"]'),
(26, 'ET2025019', 'Hamrouni','Asma',    'Licence TIC',  2, 5,  'Passerelle IoT pour objets connectés', '2024-03-04', '2024-07-10', 'Passerelle de communication pour objets connectés LoRa', '["iot","telecom","lora","passerelle"]'),
(27, 'ET2025020', 'Jlassi',  'Walid',   'Licence TIC',  2, 16, 'Orchestration de conteneurs Kubernetes', '2024-03-11', '2024-07-17', 'Déploiement et orchestration de microservices avec Kubernetes', '["cloud","kubernetes","docker","devops"]'),
(28, 'ET2025021', 'Ktari',   'Nizar',   'Licence TIC',  2, 11, 'Tests de pénétration d applications web', '2024-02-24', '2024-07-05', 'Tests de pénétration d applications web avec OWASP Top 10', '["cybersecurite","pentest","web","owasp"]'),
-- ---- Électronique (option 3) ----
(29, 'ET2025022', 'Baccouche','Yasmine','Master Électronique', 3, 12, 'Implémentation d un processeur sur FPGA', '2024-03-07', '2024-07-14', 'Conception VHDL d un processeur RISC et implémentation sur FPGA', '["fpga","vhdl","electronique","processeur"]'),
(30, 'ET2025023', 'Chihi',   'Elyes',   'Master Électronique', 3, 13, 'Station météo IoT autonome', '2024-03-13', '2024-07-19', 'Station météo à énergie solaire avec capteurs et transmission LoRa', '["iot","capteurs","solaire","lora"]'),
(31, 'ET2025024', 'Dammak',  'Sarra',   'Master Électronique', 3, 17, 'Bras robotique à apprentissage', '2024-02-23', '2024-07-08', 'Bras robotique piloté par apprentissage par renforcement', '["robotique","automatique","python","ia"]'),
(32, 'ET2025025', 'El Fekih','Nadia',   'Master Électronique', 3, 12, 'Carte de traitement de signal sur FPGA', '2024-03-15', '2024-07-21', 'Carte de filtrage numérique du signal implémentée en VHDL', '["fpga","vhdl","traitement-signal","electronique"]'),
(33, 'ET2025026', 'Fendri',  'Aziz',    'Master Électronique', 3, 13, 'Réseau de capteurs pour bâtiment intelligent', '2024-03-01', '2024-07-09', 'Réseau de capteurs sans fil pour le monitoring d un bâtiment intelligent', '["iot","capteurs","batiment","reseau"]'),
(34, 'ET2025027', 'Ghzel',   'Habib',   'Master Électronique', 3, 17, 'Commande PID d un système de température', '2024-02-26', '2024-07-06', 'Asservissement de température par contrôleur PID avec simulation', '["automatique","controle","pid","simulation"]'),
(35, 'ET2025028', 'Hamza',   'Intissar','Master Électronique', 3, 7,  'Module embarqué de surveillance cardiaque', '2024-03-10', '2024-07-16', 'Module embarqué de mesure du rythme cardiaque avec alarme', '["embarque","capteurs","sante","iot"]'),
(36, 'ET2025029', 'Jendoubi','Mounir',  'Master Électronique', 3, 12, 'Conception de circuit de gestion d alimentation', '2024-02-21', '2024-07-04', 'Conception d un circuit DC-DC de gestion d alimentation embarquée', '["electronique","alimentation","circuit","embarque"]'),
(37, 'ET2025030', 'Labidi',  'Rania',   'Master Électronique', 3, 13, 'Maison intelligente à commande vocale', '2024-03-12', '2024-07-18', 'Contrôle domotique par commande vocale et reconnaissance de la parole', '["iot","domotique","voix","intelligente"]'),
(38, 'ET2025031', 'Omri',    'Khaled',  'Master Électronique', 3, 17, 'Drone autonome de surveillance', '2024-03-04', '2024-07-11', 'Drone quadrirotor autonome avec évitement d obstacles', '["robotique","drone","automatique","capteurs"]'),
(39, 'ET2025032', 'Riahi',   'Amin',    'Master Électronique', 3, 7,  'Amplificateur audio faible consommation', '2024-02-19', '2024-07-02', 'Amplificateur audio classe D à faible consommation pour appareils portables', '["electronique","audio","amplificateur"]'),
(40, 'ET2025033', 'Zidani',  'Meryem',  'Master Électronique', 3, 13, 'Capteur connecté de qualité de l air', '2024-03-08', '2024-07-15', 'Capteur connecté de mesure de la qualité de l air avec alertes', '["iot","capteurs","qualite-air","connecte"]');

-- ---------------- Nouvelles soutenances (ids 8 à 25) ----------------
-- Règles respectées : président ≠ rapporteur, encadrant exclu du jury.
-- Binôme / trinôme : membres partageant le même encadrant (R3) ; le 1er id de
-- chaque groupe est soutenances.etudiant_id (membre principal).

-- --- Groupe : 2 binômes planifiés ---
-- Binôme A (ids 9 & 13, encadrant 9) — "Application mobile de livraison de repas"
INSERT INTO soutenances (id, etudiant_id, encadrant_id, rapporteur_id, president_id, date, heure, salle, statut) VALUES
(8, 9, 9, 4, 2, '2026-08-17', '08:30:00', 'Salle 1', 'planifiee');
-- Binôme B (ids 21 & 24, encadrant 10) — "Optimisation de couverture réseau 5G"
INSERT INTO soutenances (id, etudiant_id, encadrant_id, rapporteur_id, president_id, date, heure, salle, statut) VALUES
(9, 21, 10, 16, 2, '2026-08-18', '08:30:00', 'Salle 2', 'planifiee');

-- --- Groupe : 2 trinômes (1 planifié, 1 sans date) ---
-- Trinôme C (ids 29, 32 & 36, encadrant 12) — "Conception FPGA/VHDL"
INSERT INTO soutenances (id, etudiant_id, encadrant_id, rapporteur_id, president_id, date, heure, salle, statut) VALUES
(10, 29, 12, 17, 2, '2026-08-19', '09:10:00', 'Salle 3', 'planifiee');
-- Trinôme D (ids 14, 19 & 20, encadrant 6) — "IA générative / LLM" — à planifier par l IA
INSERT INTO soutenances (id, etudiant_id, encadrant_id, date, heure, salle, statut) VALUES
(11, 14, 6, NULL, NULL, NULL, 'sans_date');

-- --- Solos planifiés (avec jury + invitations) ---
INSERT INTO soutenances (id, etudiant_id, encadrant_id, rapporteur_id, president_id, date, heure, salle, statut) VALUES
(12, 8,  8, 9,  2, '2026-08-17', '09:10:00', 'Salle 2', 'planifiee'),
(13, 10, 14, 15, 2, '2026-08-17', '09:50:00', 'Salle 3', 'planifiee'),
(14, 12, 8,  9,  2, '2026-08-18', '09:10:00', 'Salle 1', 'planifiee'),
(15, 15, 14, 6,  2, '2026-08-18', '09:50:00', 'Salle 3', 'planifiee'),
(16, 22, 11, 16, 2, '2026-08-19', '08:30:00', 'Salle 1', 'planifiee'),
(17, 25, 11, 10, 2, '2026-08-19', '09:50:00', 'Salle 2', 'planifiee'),
(18, 30, 13, 12, 2, '2026-08-20', '08:30:00', 'Salle 3', 'planifiee'),
(19, 33, 13, 12, 2, '2026-08-20', '09:10:00', 'Salle 2', 'planifiee');

-- --- Solos "sans_date" (à traiter par l auto-planning IA) ---
INSERT INTO soutenances (id, etudiant_id, encadrant_id, date, heure, salle, statut) VALUES
(20, 11, 15, NULL, NULL, NULL, 'sans_date'),
(21, 16, 15, NULL, NULL, NULL, 'sans_date'),
(22, 23, 16, NULL, NULL, NULL, 'sans_date'),
(23, 27, 16, NULL, NULL, NULL, 'sans_date'),
(24, 34, 17, NULL, NULL, NULL, 'sans_date'),
(25, 38, 17, NULL, NULL, NULL, 'sans_date');

-- ---------------- Table de liaison soutenance_etudiants ----------------
-- Ordre 1 = membre principal (soutenances.etudiant_id), puis co-membres.
INSERT INTO soutenance_etudiants (soutenance_id, etudiant_id, ordre) VALUES
-- Binôme A
(8, 9, 1), (8, 13, 2),
-- Binôme B
(9, 21, 1), (9, 24, 2),
-- Trinôme C
(10, 29, 1), (10, 32, 2), (10, 36, 3),
-- Trinôme D
(11, 14, 1), (11, 19, 2), (11, 20, 3),
-- Solos
(12, 8, 1), (13, 10, 1), (14, 12, 1), (15, 15, 1),
(16, 22, 1), (17, 25, 1), (18, 30, 1), (19, 33, 1),
(20, 11, 1), (21, 16, 1), (22, 23, 1), (23, 27, 1), (24, 34, 1), (25, 38, 1);

-- ---------------- Invitations jury (soutenances planifiées) ----------------
INSERT INTO invitations_jury (soutenance_id, enseignant_id, role, statut, date_envoi, date_limite) VALUES
-- Binôme A (8)
(8, 4, 'rapporteur', 'en_attente', '2026-08-15 09:00:00', '2026-08-16 23:59:59'),
(8, 2, 'president',  'en_attente', '2026-08-15 09:00:00', '2026-08-16 23:59:59'),
-- Binôme B (9)
(9, 16, 'rapporteur', 'en_attente', '2026-08-15 09:00:00', '2026-08-16 23:59:59'),
(9, 2, 'president',  'en_attente', '2026-08-15 09:00:00', '2026-08-16 23:59:59'),
-- Trinôme C (10)
(10, 17, 'rapporteur', 'en_attente', '2026-08-15 09:00:00', '2026-08-16 23:59:59'),
(10, 2, 'president',  'en_attente', '2026-08-15 09:00:00', '2026-08-16 23:59:59'),
-- Solos
(12, 9, 'rapporteur', 'en_attente', '2026-08-15 09:00:00', '2026-08-16 23:59:59'),
(12, 2, 'president',  'en_attente', '2026-08-15 09:00:00', '2026-08-16 23:59:59'),
(13, 15, 'rapporteur', 'en_attente', '2026-08-15 09:00:00', '2026-08-16 23:59:59'),
(13, 2, 'president',  'en_attente', '2026-08-15 09:00:00', '2026-08-16 23:59:59'),
(14, 9, 'rapporteur', 'en_attente', '2026-08-15 09:00:00', '2026-08-17 23:59:59'),
(14, 2, 'president',  'en_attente', '2026-08-15 09:00:00', '2026-08-17 23:59:59'),
(15, 6, 'rapporteur', 'en_attente', '2026-08-15 09:00:00', '2026-08-17 23:59:59'),
(15, 2, 'president',  'en_attente', '2026-08-15 09:00:00', '2026-08-17 23:59:59'),
(16, 16, 'rapporteur', 'en_attente', '2026-08-15 09:00:00', '2026-08-18 23:59:59'),
(16, 2, 'president',  'en_attente', '2026-08-15 09:00:00', '2026-08-18 23:59:59'),
(17, 10, 'rapporteur', 'en_attente', '2026-08-15 09:00:00', '2026-08-18 23:59:59'),
(17, 2, 'president',  'en_attente', '2026-08-15 09:00:00', '2026-08-18 23:59:59'),
(18, 12, 'rapporteur', 'en_attente', '2026-08-15 09:00:00', '2026-08-19 23:59:59'),
(18, 2, 'president',  'en_attente', '2026-08-15 09:00:00', '2026-08-19 23:59:59'),
(19, 12, 'rapporteur', 'en_attente', '2026-08-15 09:00:00', '2026-08-19 23:59:59'),
(19, 2, 'president',  'en_attente', '2026-08-15 09:00:00', '2026-08-19 23:59:59');

-- ---------------- Disponibilités (absences) des enseignants ----------------
-- INSERT IGNORE : certaines dates sont déjà posées par demo_donnees_elaborees.sql.
INSERT IGNORE INTO disponibilites (enseignant_id, date, statut) VALUES
(3,  '2026-08-19', 'absent'),
(4,  '2026-08-20', 'absent'),
(5,  '2026-08-24', 'absent'),
(6,  '2026-08-20', 'absent'),
(7,  '2026-08-17', 'absent'),
(8,  '2026-08-18', 'absent'),
(9,  '2026-08-19', 'absent'),
(10, '2026-08-25', 'absent'),
(11, '2026-08-21', 'absent'),
(12, '2026-08-26', 'absent'),
(13, '2026-08-18', 'absent'),
(14, '2026-08-20', 'absent'),
(15, '2026-08-21', 'absent'),
(16, '2026-08-24', 'absent'),
(17, '2026-08-25', 'absent');

-- ---------------- Publications (détection de conflits d intérêts) ----------------
INSERT INTO publications (id, titre, mots_cles, annee) VALUES
(1, 'Apprentissage profond pour l analyse de sentiments multilingues', '["ai","nlp","deep-learning"]', 2025),
(2, 'Conception de processeurs RISC-V sur FPGA', '["fpga","vhdl","electronique"]', 2024),
(3, 'Sécurité des réseaux 5G : défis et solutions', '["reseau","5g","securite"]', 2025),
(4, 'Architectures microservices et orchestration Kubernetes', '["cloud","kubernetes","devops"]', 2024),
(5, 'Systèmes IoT à énergie solaire pour l agriculture', '["iot","capteurs","solaire"]', 2025),
(6, 'Contrôle de robots mobiles par apprentissage par renforcement', '["robotique","automatique","ia"]', 2024);

INSERT INTO publication_auteurs (publication_id, user_id) VALUES
(1, 14), (1, 6),
(2, 12), (2, 7),
(3, 10), (3, 11),
(4, 16), (4, 5),
(5, 13), (5, 12),
(6, 17), (6, 14);

