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