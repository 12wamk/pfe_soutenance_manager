<?php
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$pdo = getDB();

$sql = "SELECT s.*, e.code_etudiant, e.niveau, e.date_debut as etudiant_date_debut, e.date_fin as etudiant_date_fin, e.option_id,
        o.nom as specialite_nom, o.departement_id as specialite_departement_id,
        CONCAT(e.prenom,' ',e.nom) as etudiant, e.titre_sujet,
        e2.id as etudiant2_id_verif, e2.code_etudiant as code_etudiant2,
        CONCAT(e2.prenom,' ',e2.nom) as etudiant2,
        CONCAT(u1.prenom,' ',u1.nom) as encadrant, CONCAT(u2.prenom,' ',u2.nom) as rapporteur,
        CONCAT(u3.prenom,' ',u3.nom) as president
        FROM soutenances s
        JOIN etudiants e ON s.etudiant_id = e.id
        LEFT JOIN etudiants e2 ON s.etudiant2_id = e2.id
        LEFT JOIN options o ON e.option_id = o.id
        LEFT JOIN users u1 ON s.encadrant_id = u1.id
        LEFT JOIN users u2 ON s.rapporteur_id = u2.id
        LEFT JOIN users u3 ON s.president_id = u3.id
        WHERE 1=1";
$params = [];

if ($auth['role'] === 'encadrant') {
    $sql .= " AND (s.encadrant_id = ? OR s.rapporteur_id = ? OR s.president_id = ?)";
    array_push($params, $auth['id'], $auth['id'], $auth['id']);
}

// R — le chef de département ne voit QUE les soutenances de son propre département (règle stricte, non contournable par paramètre)
if ($auth['role'] === 'chef_dept') {
    $sql .= " AND s.departement_id = ?";
    $params[] = $auth['departement_id'];
}

// L'admin peut filtrer/switcher par département via un sélecteur (paramètre optionnel)
if ($auth['role'] === 'admin' && !empty($_GET['departement_id'])) {
    $sql .= " AND s.departement_id = ?";
    $params[] = $_GET['departement_id'];
}

$sql .= " ORDER BY s.date IS NULL, s.date DESC, s.heure DESC";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);

// Fusionne l'affichage "etudiant" en "Étudiant1 & Étudiant2" côté backend pour que
// TOUT consommateur de cette API (frontend, export PDF/Excel) affiche la même chose
// sans avoir à réimplémenter la logique de concaténation partout.
$rows = $stmt->fetchAll();
foreach ($rows as &$r) {
    if (!empty($r['etudiant2'])) {
        $r['etudiant_affiche'] = $r['etudiant'] . ' & ' . $r['etudiant2'];
    } else {
        $r['etudiant_affiche'] = $r['etudiant'];
    }
    unset($r['etudiant2_id_verif']);
}
unset($r);

ok($rows);