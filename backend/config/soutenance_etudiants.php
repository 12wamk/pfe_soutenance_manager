<?php
/**
 * Helpers autour de la table de liaison `soutenance_etudiants` qui relie une
 * soutenance à SES N étudiants (solo, binôme, trinôme, ...), source de vérité
 * de l'appartenance d'un étudiant à une soutenance.
 *
 * La colonne `soutenances.etudiant_id` reste le membre principal (compat
 * ascendante), mais le groupe complet se lit/écrit via la table de liaison.
 */

/**
 * Remplace les membres d'une soutenance : vide la table de liaison pour cette
 * soutenance puis insère les étudiants fournis dans l'ordre (1 = principal).
 */
function remplacerMembresSoutenance($pdo, $soutenanceId, array $etudiantIds) {
    $etudiantIds = array_values(array_unique(array_filter(array_map('intval', $etudiantIds))));
    $pdo->prepare("DELETE FROM soutenance_etudiants WHERE soutenance_id = ?")->execute([$soutenanceId]);
    $stmt = $pdo->prepare("INSERT INTO soutenance_etudiants (soutenance_id, etudiant_id, ordre) VALUES (?,?,?)");
    foreach ($etudiantIds as $i => $etudiantId) {
        $stmt->execute([$soutenanceId, $etudiantId, $i + 1]);
    }
    return $etudiantIds;
}

/**
 * Liste ordonnée des etudiant_id d'une soutenance. Source : table de liaison.
 * Repli sur [etudiant_id, etudiant2_id] si la liaison est vide (données héritées
 * de l'ancien schéma non encore backfillées).
 */
function membresSoutenance($pdo, $soutenanceId) {
    $stmt = $pdo->prepare("SELECT etudiant_id FROM soutenance_etudiants WHERE soutenance_id = ? ORDER BY ordre");
    $stmt->execute([$soutenanceId]);
    $ids = array_map(fn($r) => (int) $r['etudiant_id'], $stmt->fetchAll());
    if ($ids) return $ids;

    $stmt = $pdo->prepare("SELECT etudiant_id, etudiant2_id FROM soutenances WHERE id = ?");
    $stmt->execute([$soutenanceId]);
    $s = $stmt->fetch();
    if (!$s) return [];
    $repli = array_filter([(int) $s['etudiant_id'], (int) $s['etudiant2_id']]);
    return array_values($repli);
}

/**
 * IDs distincts des soutenances contenant AU MOINS UN des étudiants fournis
 * (via etudiant_id principal OU la table de liaison).
 */
function soutenancesPourEtudiants($pdo, array $etudiantIds) {
    $etudiantIds = array_values(array_unique(array_filter(array_map('intval', $etudiantIds))));
    if (!$etudiantIds) return [];
    $ph = implode(',', array_fill(0, count($etudiantIds), '?'));
    $stmt = $pdo->prepare("SELECT DISTINCT s.id FROM soutenances s
        LEFT JOIN soutenance_etudiants se ON se.soutenance_id = s.id
        WHERE s.etudiant_id IN ($ph) OR se.etudiant_id IN ($ph)");
    $stmt->execute(array_merge($etudiantIds, $etudiantIds));
    return array_map(fn($r) => (int) $r['id'], $stmt->fetchAll());
}