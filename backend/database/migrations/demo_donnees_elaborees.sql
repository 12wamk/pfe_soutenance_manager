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
