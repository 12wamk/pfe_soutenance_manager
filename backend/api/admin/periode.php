<?php
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM periode ORDER BY id DESC LIMIT 1");
    $periode = $stmt->fetch();
    if ($periode) {
        $stmt2 = $pdo->prepare("SELECT * FROM jours_calendrier WHERE periode_id = ? ORDER BY date");
        $stmt2->execute([$periode['id']]);
        $periode['jours'] = $stmt2->fetchAll();
        $stmt3 = $pdo->query("SELECT * FROM parametres_creneaux ORDER BY id DESC LIMIT 1");
        $periode['creneaux'] = $stmt3->fetch();
    }
    ok($periode);
}

if ($method === 'POST') {
    requireRole(['admin']);
    $d = body();
    if (!$d['date_debut'] || !$d['date_fin']) fail('Dates de période requises');

    $stmt = $pdo->prepare("INSERT INTO periode (date_debut, date_fin, max_par_jour, annee_universitaire) VALUES (?,?,?,?)");
    $stmt->execute([$d['date_debut'], $d['date_fin'], $d['max_par_jour'] ?? 5, $d['annee_universitaire'] ?? '']);
    $periodeId = $pdo->lastInsertId();

    // Paramètres de créneaux : toujours enregistrés (règle R8 — heure de départ, durée, pause)
    $pdo->prepare("INSERT INTO parametres_creneaux (heure_depart, duree_soutenance, duree_pause) VALUES (?,?,?)")
        ->execute([
            !empty($d['heure_depart']) ? $d['heure_depart'] . ':00' : '08:30:00',
            $d['duree_soutenance'] ?? 30,
            $d['duree_pause'] ?? 10,
        ]);

    // Génération automatique du calendrier jour par jour, jours fériés + weekends exclus par défaut
    $feries = jours_feries_tunisie(date('Y', strtotime($d['date_debut'])));
    $feriesFin = jours_feries_tunisie(date('Y', strtotime($d['date_fin'])));
    $feries = array_unique(array_merge($feries, $feriesFin));

    $current = strtotime($d['date_debut']);
    $end = strtotime($d['date_fin']);
    $stmtDay = $pdo->prepare("INSERT INTO jours_calendrier (periode_id, date, actif, max_soutenances, est_ferie) VALUES (?,?,?,?,?)");
    while ($current <= $end) {
        $dateStr = date('Y-m-d', $current);
        $dow = (int) date('N', $current); // 6=samedi, 7=dimanche
        $estFerie = in_array($dateStr, $feries);
        $actif = !$estFerie && $dow < 6; // jours ouvrés actifs par défaut ; l'admin peut ensuite affiner
        $stmtDay->execute([$periodeId, $dateStr, $actif ? 1 : 0, $d['max_par_jour'] ?? 5, $estFerie ? 1 : 0]);
        $current = strtotime('+1 day', $current);
    }

    ok(['id' => $periodeId], 'Période créée et calendrier généré', 201);
}

if ($method === 'PUT' && isset($_GET['jour'])) {
    // Mise à jour d'un jour précis du calendrier (actif + max_soutenances)
    requireRole(['admin']);
    $d = body();
    $stmt = $pdo->prepare("UPDATE jours_calendrier SET actif = ?, max_soutenances = ? WHERE id = ?");
    $stmt->execute([$d['actif'] ?? 1, $d['max_soutenances'] ?? 5, $_GET['jour']]);
    ok(null, 'Jour mis à jour');
}

/** Liste simplifiée des jours fériés officiels tunisiens (à ajuster/compléter chaque année). */
function jours_feries_tunisie($annee) {
    return [
        "$annee-01-01", // Nouvel an
        "$annee-01-14", // Fête de la Révolution
        "$annee-03-20", // Fête de l'Indépendance
        "$annee-04-09", // Jour des Martyrs
        "$annee-05-01", // Fête du Travail
        "$annee-07-25", // Fête de la République
        "$annee-08-13", // Fête de la Femme
        "$annee-10-15", // Fête de l'Évacuation
    ];
}
