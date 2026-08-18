-- ============================================================
-- EXPLICATION IA PERSISTÉE — colonne JSON sur soutenances
-- Stocke le détail du choix IA (score par membre du jury, matching,
-- contraintes vérifiées) pour l'afficher côté enseignant et admin.
-- ============================================================

ALTER TABLE soutenances ADD COLUMN explication_ia JSON NULL COMMENT 'Détail du choix IA (score par membre du jury, contraintes vérifiées)';
