<?php
/**
 * R8 — Génération des créneaux horaires disponibles pour une date donnée,
 * à partir des paramètres admin : heure de départ, durée d'une soutenance,
 * durée de la pause entre deux soutenances. S'arrête au quota max_soutenances
 * du jour (table jours_calendrier) et exclut les créneaux déjà occupés.
 *
 * v1.8 : paramètre optionnel exclude_id — quand on réédite une soutenance déjà
 * planifiée (replanification), son propre créneau ne doit pas apparaître comme
 * "déjà pris" alors qu'il ne sera libéré qu'au moment de l'enregistrement.
 */
require_once __DIR__ . '/../../config/cors.php';

jwtRequireAuth();
$pdo = getDB();

$date = $_GET['date'] ?? null;
if (!$date) fail('Date requise');
$excludeId = $_GET['exclude_id'] ?? null;

$jour = $pdo->prepare("SELECT * FROM jours_calendrier WHERE date = ?");
$jour->execute([$date]);
$jour = $jour->fetch();
if (!$jour || !$jour['actif']) {
    ok(['creneaux' => [], 'message' => "Ce jour n'est pas ouvert aux soutenances"]);
}

$params = $pdo->query("SELECT * FROM parametres_creneaux ORDER BY id DESC LIMIT 1")->fetch();
$heureDepart = $params['heure_depart'] ?? '08:30:00';
$dureeSoutenance = (int) ($params['duree_soutenance'] ?? 30);
$dureePause = (int) ($params['duree_pause'] ?? 10);
$maxSoutenances = (int) $jour['max_soutenances'];

// Heures déjà prises ce jour-là (hors la soutenance en cours d'édition, le cas échéant)
if ($excludeId) {
    $stmt = $pdo->prepare("SELECT heure FROM soutenances WHERE date = ? AND heure IS NOT NULL AND id != ?");
    $stmt->execute([$date, $excludeId]);
} else {
    $stmt = $pdo->prepare("SELECT heure FROM soutenances WHERE date = ? AND heure IS NOT NULL");
    $stmt->execute([$date]);
}
$occupees = array_map(fn($r) => substr($r['heure'], 0, 5), $stmt->fetchAll());

$creneaux = [];
$current = strtotime($date . ' ' . $heureDepart);
for ($i = 0; $i < $maxSoutenances; $i++) {
    $heure = date('H:i', $current);
    $creneaux[] = ['heure' => $heure, 'disponible' => !in_array($heure, $occupees)];
    $current = strtotime("+{$dureeSoutenance} minutes +{$dureePause} minutes", $current);
}

ok([
    'creneaux' => $creneaux,
    'max_soutenances' => $maxSoutenances,
    'places_prises' => count($occupees),
]);