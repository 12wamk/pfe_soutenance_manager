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

