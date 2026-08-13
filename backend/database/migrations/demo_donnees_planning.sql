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
