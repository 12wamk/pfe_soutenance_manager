<?php
/**
 * Replanification d'une soutenance déjà planifiée : modification de la date,
 * de l'heure et/ou de la salle, avec les mêmes vérifications de disponibilité
 * que planifier.php (R4 conflit de salle, R5 conflit de planning enseignant,
 * R3 quota, R6 jour ouvert), mais SANS toucher au jury déjà en place
 * (rapporteur_id / president_id / encadrant_id inchangés, aucune nouvelle
 * invitation envoyée).
 *
 * Réservé à l'admin (l'action existe pour corriger un planning, pas pour la
 * planification initiale qui reste dans planifier.php).
 */
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/mailer.php';

$auth = requireRole(['admin']);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);

$d = body();
$soutenanceId = $d['soutenance_id'] ?? null;
if (!$soutenanceId) fail('Soutenance requise');

$pdo = getDB();

$stmt = $pdo->prepare("SELECT * FROM soutenances WHERE id = ?");
$stmt->execute([$soutenanceId]);
$soutenance = $stmt->fetch();
if (!$soutenance) fail('Soutenance introuvable', 404);
if (!in_array($soutenance['statut'], ['planifiee', 'validee'])) {
    fail('Seule une soutenance planifiée ou validée peut être replanifiée');
}

$date = $d['date'] ?? null;
$heure = $d['heure'] ?? null;
$salle = $d['salle'] ?? null;

if (!$date) fail('Date requise pour la replanification');

// ---- R6 : la date doit être dans la période autorisée (jour actif du calendrier) ----
$stmt = $pdo->prepare("SELECT * FROM jours_calendrier WHERE date = ? AND actif = 1");
$stmt->execute([$date]);
$jour = $stmt->fetch();
if (!$jour) fail("La date choisie n'est pas ouverte aux soutenances (jour férié, weekend ou non retenu — R6)");

$params = $pdo->query("SELECT * FROM parametres_creneaux ORDER BY id DESC LIMIT 1")->fetch();
$heureDepart = $params['heure_depart'] ?? '08:30:00';
$dureeSoutenance = (int) ($params['duree_soutenance'] ?? 30);
$dureePause = (int) ($params['duree_pause'] ?? 10);

if (!$heure) {
    // Auto-assignation du prochain créneau libre, en excluant cette soutenance elle-même
    $stmtOcc = $pdo->prepare("SELECT heure FROM soutenances WHERE date = ? AND heure IS NOT NULL AND id != ?");
    $stmtOcc->execute([$date, $soutenanceId]);
    $occupees = array_map(fn($r) => substr($r['heure'], 0, 5), $stmtOcc->fetchAll());

    $current = strtotime($date . ' ' . $heureDepart);
    for ($i = 0; $i < (int) $jour['max_soutenances']; $i++) {
        $candidat = date('H:i', $current);
        if (!in_array($candidat, $occupees)) { $heure = $candidat; break; }
        $current = strtotime("+{$dureeSoutenance} minutes +{$dureePause} minutes", $current);
    }
    if (!$heure) fail('Aucun créneau libre ce jour-là, le quota est atteint (R3/R10)');
} else {
    $current = strtotime($date . ' ' . $heureDepart);
    $valide = false;
    for ($i = 0; $i < (int) $jour['max_soutenances']; $i++) {
        if (date('H:i', $current) === substr($heure, 0, 5)) { $valide = true; break; }
        $current = strtotime("+{$dureeSoutenance} minutes +{$dureePause} minutes", $current);
    }
    if (!$valide) fail("L'heure saisie ne correspond à aucun créneau valide pour cette journée");
}

// ---- R4 : pas de conflit de salle (on exclut cette soutenance elle-même) ----
if ($salle) {
    $stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE date = ? AND heure = ? AND salle = ? AND statut != 'refusee' AND id != ?");
    $stmt->execute([$date, $heure, $salle, $soutenanceId]);
    if ($stmt->fetch()['c'] > 0) fail("Conflit de salle : la salle « $salle » est déjà occupée à ce créneau (R4)");
}

// ---- R5 : pas de conflit de planning enseignant (on exclut cette soutenance elle-même) ----
$tousLesRoles = array_filter([$soutenance['encadrant_id'], $soutenance['rapporteur_id'], $soutenance['president_id']]);
foreach ($tousLesRoles as $ensId) {
    $stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE date = ? AND heure = ? AND statut != 'refusee' AND id != ?
        AND (encadrant_id = ? OR rapporteur_id = ? OR president_id = ?)");
    $stmt->execute([$date, $heure, $soutenanceId, $ensId, $ensId, $ensId]);
    if ($stmt->fetch()['c'] > 0) fail("Conflit de planning : un des membres du jury est déjà occupé à ce créneau (R5)");
}

// ---- R3 : quota max_soutenances par enseignant ce jour-là (on exclut cette soutenance elle-même) ----
foreach ($tousLesRoles as $ensId) {
    $stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE date = ? AND statut != 'refusee' AND id != ?
        AND (encadrant_id = ? OR rapporteur_id = ? OR president_id = ?)");
    $stmt->execute([$date, $soutenanceId, $ensId, $ensId, $ensId]);
    if ($stmt->fetch()['c'] >= $jour['max_soutenances']) {
        fail("Un des membres du jury a déjà atteint son quota de {$jour['max_soutenances']} soutenances pour cette date (R3)");
    }
}

$ancienneDate = $soutenance['date'];
$ancienneHeure = $soutenance['heure'];
$ancienneSalle = $soutenance['salle'];

$pdo->prepare("UPDATE soutenances SET date = ?, heure = ?, salle = ? WHERE id = ?")
    ->execute([$date, $heure, $salle, $soutenanceId]);

// Notifie le jury (et l'encadrant) du changement, sans renvoyer d'invitation à accepter/refuser
$changement = ($ancienneDate !== $date || substr((string) $ancienneHeure, 0, 5) !== substr((string) $heure, 0, 5) || $ancienneSalle !== $salle);
if ($changement) {
    $stmtNotif = $pdo->prepare("INSERT INTO notifications (user_id, type, titre, message, lien) VALUES (?,?,?,?,?)");
    $message = "Nouvelle date/heure/salle : " . date('d/m/Y', strtotime($date)) . " à " . substr($heure, 0, 5) . ($salle ? " en salle $salle" : '');
    foreach ($tousLesRoles as $ensId) {
        $stmtNotif->execute([$ensId, 'warning', 'Soutenance replanifiée', $message, '/soutenances']);
    }
}

ok(['id' => $soutenanceId, 'date' => $date, 'heure' => $heure, 'salle' => $salle], 'Soutenance replanifiée');
