<?php
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $search = $_GET['search'] ?? '';
    $sql = "SELECT e.*, CONCAT(u.prenom,' ',u.nom) as encadrant_nom, o.nom as option_nom,
            s.id as soutenance_id, s.date as soutenance_date, s.heure as soutenance_heure, s.statut as soutenance_statut, s.salle,
            CONCAT(up.prenom,' ',up.nom) as president, CONCAT(ur.prenom,' ',ur.nom) as rapporteur,
            (SELECT GROUP_CONCAT(CONCAT(eo.prenom,' ',eo.nom) SEPARATOR ' & ')
             FROM soutenance_etudiants seo JOIN etudiants eo ON eo.id = seo.etudiant_id
             WHERE seo.soutenance_id = s.id AND seo.etudiant_id != e.id) as binome_nom
            FROM etudiants e
            LEFT JOIN users u ON e.encadrant_id = u.id
            LEFT JOIN options o ON e.option_id = o.id
            LEFT JOIN soutenances s ON (s.etudiant_id = e.id OR s.id IN (SELECT se.soutenance_id FROM soutenance_etudiants se WHERE se.etudiant_id = e.id))
            LEFT JOIN users up ON s.president_id = up.id
            LEFT JOIN users ur ON s.rapporteur_id = ur.id
            WHERE 1=1";
    $params = [];
    // Un encadrant ne voit que ses étudiants
    if ($auth['role'] === 'encadrant') {
        $sql .= " AND e.encadrant_id = ?";
        $params[] = $auth['id'];
    }
    // Un chef de département ne voit QUE les étudiants de son propre département
    if ($auth['role'] === 'chef_dept') {
        $sql .= " AND o.departement_id = ?";
        $params[] = $auth['departement_id'];
    }
    // L'admin peut filtrer/switcher par département via un sélecteur (paramètre optionnel)
    if ($auth['role'] === 'admin' && !empty($_GET['departement_id'])) {
        $sql .= " AND o.departement_id = ?";
        $params[] = $_GET['departement_id'];
    }
    if ($search) {
        $sql .= " AND (e.nom LIKE ? OR e.prenom LIKE ? OR e.code_etudiant LIKE ?)";
        $like = "%$search%";
        array_push($params, $like, $like, $like);
    }
    $sql .= " ORDER BY e.nom, e.prenom";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    ok($stmt->fetchAll());
}

if ($method === 'POST') {
    requireRole(['admin', 'chef_dept']);
    $d = body();
    if (!$d['code_etudiant'] || !$d['nom'] || !$d['prenom']) fail('Champs requis manquants');

    // Un chef de département ne peut créer un étudiant que dans une option de son propre département
    if ($auth['role'] === 'chef_dept') {
        if (empty($d['option_id'])) fail('Option (spécialité) requise', 400);
        $stmt = $pdo->prepare("SELECT departement_id FROM options WHERE id = ?");
        $stmt->execute([$d['option_id']]);
        $opt = $stmt->fetch();
        if (!$opt || (int) $opt['departement_id'] !== (int) $auth['departement_id']) {
            fail("Vous ne pouvez créer un étudiant que dans une option de votre département", 403);
        }
    }

    $stmt = $pdo->prepare("INSERT INTO etudiants (code_etudiant, nom, prenom, niveau, encadrant_id, option_id, titre_sujet, date_debut, date_fin, resume_projet, mots_cles_projet)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)");
    $stmt->execute([
        $d['code_etudiant'], $d['nom'], $d['prenom'], $d['niveau'] ?? null, $d['encadrant_id'] ?? null,
        $d['option_id'] ?? null, $d['titre_sujet'] ?? null, $d['date_debut'] ?? null, $d['date_fin'] ?? null,
        $d['resume_projet'] ?? null,
        isset($d['mots_cles_projet']) ? json_encode($d['mots_cles_projet']) : null,
    ]);
    ok(['id' => $pdo->lastInsertId()], 'Étudiant créé', 201);
}

if ($method === 'PUT') {
    requireRole(['admin', 'chef_dept']);
    $d = body();
    $id = $_GET['id'] ?? null;
    if (!$id) fail('ID manquant');

    // Un chef de département ne peut modifier qu'un étudiant de son propre département
    if ($auth['role'] === 'chef_dept') {
        $stmt = $pdo->prepare("SELECT o.departement_id FROM etudiants e LEFT JOIN options o ON e.option_id = o.id WHERE e.id = ?");
        $stmt->execute([$id]);
        $cible = $stmt->fetch();
        if (!$cible || (int) $cible['departement_id'] !== (int) $auth['departement_id']) {
            fail("Vous ne pouvez modifier qu'un étudiant de votre département", 403);
        }
    }

    $stmt = $pdo->prepare("UPDATE etudiants SET nom=?, prenom=?, niveau=?, encadrant_id=?, titre_sujet=?, date_debut=?, date_fin=?, resume_projet=?, mots_cles_projet=? WHERE id=?");
    $stmt->execute([
        $d['nom'], $d['prenom'], $d['niveau'], $d['encadrant_id'], $d['titre_sujet'],
        $d['date_debut'], $d['date_fin'],
        $d['resume_projet'] ?? null,
        isset($d['mots_cles_projet']) ? json_encode($d['mots_cles_projet']) : null,
        $id,
    ]);
    ok(null, 'Étudiant mis à jour');
}

if ($method === 'DELETE') {
    requireRole(['admin', 'chef_dept']);
    $id = $_GET['id'] ?? null;
    if (!$id) fail('ID manquant');

    // Un chef de département ne peut supprimer qu'un étudiant de son propre département
    if ($auth['role'] === 'chef_dept') {
        $stmt = $pdo->prepare("SELECT o.departement_id FROM etudiants e LEFT JOIN options o ON e.option_id = o.id WHERE e.id = ?");
        $stmt->execute([$id]);
        $cible = $stmt->fetch();
        if (!$cible || (int) $cible['departement_id'] !== (int) $auth['departement_id']) {
            fail("Vous ne pouvez supprimer qu'un étudiant de votre département", 403);
        }
    }

    $pdo->prepare("DELETE FROM etudiants WHERE id = ?")->execute([$id]);
    ok(null, 'Étudiant supprimé');
}