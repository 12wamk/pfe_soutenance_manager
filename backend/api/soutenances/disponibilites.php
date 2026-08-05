<?php
require_once __DIR__ . '/../../config/cors.php';

$auth = requireRole(['encadrant', 'admin', 'chef_dept']);
$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->prepare("SELECT * FROM disponibilites WHERE enseignant_id = ? ORDER BY date");
    $stmt->execute([$auth['id']]);
    $dispos = $stmt->fetchAll();

    // Charge de soutenances par jour pour cet enseignant (encadrant + rapporteur + président),
    // utile pour l'indicateur visuel de charge dans le calendrier de disponibilités.
    $stmtCharge = $pdo->prepare("
        SELECT date, COUNT(*) as total FROM soutenances
        WHERE (encadrant_id = ? OR rapporteur_id = ? OR president_id = ?) AND statut != 'refusee' AND date IS NOT NULL
        GROUP BY date
    ");
    $stmtCharge->execute([$auth['id'], $auth['id'], $auth['id']]);
    $charge = $stmtCharge->fetchAll();

    ok(['disponibilites' => $dispos, 'charge' => $charge]);
}

if ($method === 'POST') {
    $d = body();
    if (!$d['date'] || !in_array($d['statut'], ['disponible', 'absent'])) fail('Paramètres invalides');
    $stmt = $pdo->prepare("SELECT id FROM disponibilites WHERE enseignant_id = ? AND date = ?");
    $stmt->execute([$auth['id'], $d['date']]);
    $existing = $stmt->fetch();
    if ($existing) {
        $pdo->prepare("UPDATE disponibilites SET statut = ? WHERE id = ?")->execute([$d['statut'], $existing['id']]);
    } else {
        $pdo->prepare("INSERT INTO disponibilites (enseignant_id, date, statut) VALUES (?,?,?)")->execute([$auth['id'], $d['date'], $d['statut']]);
    }
    ok(null, 'Disponibilité enregistrée');
}
