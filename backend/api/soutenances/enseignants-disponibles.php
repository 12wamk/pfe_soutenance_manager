<?php
/**
 * v1.9 — Pour une soutenance et un rôle (rapporteur|president) donnés, renvoie
 * la liste des enseignants pouvant potentiellement être affectés, chacun avec
 * un indicateur "disponible" (et une raison si non disponible) tenant compte :
 *  - R1 (ne peut pas être déjà l'autre rôle) / R2 (ne peut pas être l'encadrant)
 *    -> ces deux-là sont exclus de la liste, ils ne sont jamais valides.
 *  - R5 : conflit de planning à la date/heure de la soutenance
 *  - R3 : quota journalier déjà atteint ce jour-là
 *  - Disponibilité déclarée (table disponibilites)
 *
 * Utilisé par le modal de réaffectation jury (SoutenancesPage.jsx) pour ne
 * proposer/valider que des enseignants réellement disponibles, plutôt que de
 * laisser l'utilisateur découvrir le conflit après coup.
 */
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$pdo = getDB();

$soutenanceId = $_GET['soutenance_id'] ?? null;
$role = $_GET['role'] ?? null;
if (!$soutenanceId || !in_array($role, ['rapporteur', 'president'])) fail('Paramètres invalides');

$stmt = $pdo->prepare("SELECT * FROM soutenances WHERE id = ?");
$stmt->execute([$soutenanceId]);
$soutenance = $stmt->fetch();
if (!$soutenance) fail('Soutenance introuvable', 404);

$autreRoleId = $role === 'rapporteur' ? $soutenance['president_id'] : $soutenance['rapporteur_id'];
$encadrantId = $soutenance['encadrant_id'];

// v1.10 : date/heure peuvent être surchargées par la requête (formulaire unifié
// replanification + jury : on veut vérifier la dispo par rapport à la date
// tentée dans le formulaire, pas seulement celle déjà enregistrée en base).
$date = $_GET['date'] ?? $soutenance['date'];
$heure = $_GET['heure'] ?? $soutenance['heure'];

// Enseignants potentiellement affectables : tous les encadrants/chefs de département actifs,
// hors R1 (déjà l'autre rôle) et R2 (déjà encadrant de cette soutenance).
$sql = "SELECT id, nom, prenom, departement_id FROM users WHERE role IN ('encadrant','chef_dept') AND is_active = 1";
$params = [];
if ($autreRoleId) { $sql .= " AND id != ?"; $params[] = $autreRoleId; }
if ($encadrantId) { $sql .= " AND id != ?"; $params[] = $encadrantId; }
$sql .= " ORDER BY nom, prenom";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$enseignants = $stmt->fetchAll();

$jourMax = null;
if ($date) {
    $jour = $pdo->prepare("SELECT max_soutenances FROM jours_calendrier WHERE date = ?");
    $jour->execute([$date]);
    $jour = $jour->fetch();
    $jourMax = $jour ? (int) $jour['max_soutenances'] : null;
}

foreach ($enseignants as &$e) {
    $e['disponible'] = true;
    $e['raison'] = null;

    if (!$date) continue; // pas de date fixée -> pas de conflit possible à vérifier

    if ($heure) {
        $stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE date = ? AND heure = ? AND statut != 'refusee' AND id != ?
            AND (encadrant_id = ? OR rapporteur_id = ? OR president_id = ?)");
        $stmt->execute([$date, $heure, $soutenanceId, $e['id'], $e['id'], $e['id']]);
        if ($stmt->fetch()['c'] > 0) {
            $e['disponible'] = false;
            $e['raison'] = 'Déjà occupé à ce créneau';
        }
    }

    if ($e['disponible'] && $jourMax !== null) {
        $stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE date = ? AND statut != 'refusee' AND id != ?
            AND (encadrant_id = ? OR rapporteur_id = ? OR president_id = ?)");
        $stmt->execute([$date, $soutenanceId, $e['id'], $e['id'], $e['id']]);
        if ($stmt->fetch()['c'] >= $jourMax) {
            $e['disponible'] = false;
            $e['raison'] = "Quota du jour atteint ($jourMax)";
        }
    }

    if ($e['disponible']) {
        $stmt = $pdo->prepare("SELECT statut FROM disponibilites WHERE enseignant_id = ? AND date = ?");
        $stmt->execute([$e['id'], $date]);
        $dispo = $stmt->fetch();
        if ($dispo && $dispo['statut'] === 'absent') {
            $e['disponible'] = false;
            $e['raison'] = 'Indisponible à cette date';
        }
    }
}
unset($e);

// Disponibles d'abord, puis indisponibles (l'UI peut les griser sans les cacher)
usort($enseignants, fn($a, $b) => $b['disponible'] <=> $a['disponible']);

ok($enseignants);