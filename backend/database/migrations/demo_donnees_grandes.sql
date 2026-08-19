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