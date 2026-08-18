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
        CONCAT(u3.prenom,' ',u3.nom) as president,
        (SELECT ij.statut FROM invitations_jury ij
         WHERE ij.soutenance_id = s.id AND ij.enseignant_id = ? AND ij.statut != 'en_attente'
         ORDER BY ij.id DESC LIMIT 1) as mon_invitation_statut
        FROM soutenances s
        JOIN etudiants e ON s.etudiant_id = e.id
        LEFT JOIN etudiants e2 ON s.etudiant2_id = e2.id
        LEFT JOIN options o ON e.option_id = o.id
        LEFT JOIN users u1 ON s.encadrant_id = u1.id
        LEFT JOIN users u2 ON s.rapporteur_id = u2.id
        LEFT JOIN users u3 ON s.president_id = u3.id
        WHERE 1=1";
$params = [$auth['id']];

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

// Récupère les N membres de chaque soutenance via la table de liaison
// (solo, binôme, trinôme, ...) en un seul aller-retour, puis construit
// `etudiants` (liste ordonnée), `etudiant_affiche` ("N1 & N2 & N3") et les
// champs legacy `etudiant2` / `code_etudiant2` (2e membre) pour compat.
$soutenanceIds = array_map(fn($r) => $r['id'], $rows);
$membresParSoutenance = [];
if ($soutenanceIds) {
    $ph = implode(',', array_fill(0, count($soutenanceIds), '?'));
    $stmtM = $pdo->prepare("SELECT se.soutenance_id, se.etudiant_id, se.ordre, e.code_etudiant, CONCAT(e.prenom,' ',e.nom) as nom
        FROM soutenance_etudiants se JOIN etudiants e ON e.id = se.etudiant_id
        WHERE se.soutenance_id IN ($ph) ORDER BY se.ordre");
    $stmtM->execute($soutenanceIds);
    foreach ($stmtM->fetchAll() as $m) {
        $membresParSoutenance[(int) $m['soutenance_id']][] = $m;
    }
}

foreach ($rows as &$r) {
    $membres = $membresParSoutenance[(int) $r['id']] ?? [];
    if (!$membres) {
        // Repli : données héritées du schéma sans table de liaison
        $membres = [['etudiant_id' => $r['etudiant_id'], 'code_etudiant' => $r['code_etudiant'], 'nom' => $r['etudiant']]];
        if (!empty($r['etudiant2'])) {
            $membres[] = ['etudiant_id' => $r['etudiant2_id_verif'], 'code_etudiant' => $r['code_etudiant2'], 'nom' => $r['etudiant2']];
        }
    }
    $r['etudiants'] = array_map(fn($m) => [
        'id' => (int) $m['etudiant_id'],
        'code_etudiant' => $m['code_etudiant'],
        'nom' => $m['nom'],
    ], $membres);
    $r['etudiant_affiche'] = implode(' & ', array_column($r['etudiants'], 'nom'));
    // Champs legacy : etudiant = 1er membre, etudiant2 = 2e membre (ou null)
    $r['etudiant'] = $r['etudiants'][0]['nom'] ?? '';
    $r['code_etudiant'] = $r['etudiants'][0]['code_etudiant'] ?? '';
    $r['etudiant2'] = $r['etudiants'][1]['nom'] ?? null;
    $r['code_etudiant2'] = $r['etudiants'][1]['code_etudiant'] ?? null;
    $r['etudiant2_id'] = $r['etudiants'][1]['id'] ?? null;
    unset($r['etudiant2_id_verif']);
    // L'explication IA est stockée en JSON : on la renvoie décodée au frontend.
    if (!empty($r['explication_ia'])) {
        $r['explication_ia'] = json_decode($r['explication_ia'], true);
    }
}
unset($r);

ok($rows);