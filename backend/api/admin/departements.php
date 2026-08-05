<?php
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $corbeille = !empty($_GET['corbeille']);
    $condition = $corbeille ? "d.supprime_le IS NOT NULL" : "d.supprime_le IS NULL";
    ok($pdo->query("
        SELECT d.*, CONCAT(u.prenom,' ',u.nom) as chef_dept_nom
        FROM departements d LEFT JOIN users u ON d.chef_dept_id = u.id
        WHERE $condition
        ORDER BY d.nom
    ")->fetchAll());
}

if ($method === 'POST') {
    requireRole(['admin']);
    $d = body();
    if (!$d['nom']) fail('Nom requis');
    $stmt = $pdo->prepare("INSERT INTO departements (nom, code, chef_dept_id) VALUES (?,?,?)");
    $stmt->execute([$d['nom'], $d['code'] ?? null, $d['chef_dept_id'] ?: null]);
    $deptId = $pdo->lastInsertId();

    // Si un chef est désigné, on synchronise son département et son rôle
    if (!empty($d['chef_dept_id'])) {
        $pdo->prepare("UPDATE users SET departement_id = ?, role = 'chef_dept' WHERE id = ?")->execute([$deptId, $d['chef_dept_id']]);
    }
    ok(['id' => $deptId], 'Département créé', 201);
}

if ($method === 'PUT') {
    requireRole(['admin']);
    $d = body();
    $id = $_GET['id'] ?? null;
    if (!$id) fail('ID manquant');

    // Restauration depuis la corbeille : { "restaurer": true }, aucun autre champ requis
    if (!empty($d['restaurer'])) {
        $pdo->prepare("UPDATE departements SET supprime_le = NULL WHERE id = ?")->execute([$id]);
        ok(null, 'Département restauré');
    }

    if (!$d['nom']) fail('Paramètres invalides');
    $pdo->prepare("UPDATE departements SET nom = ?, code = ?, chef_dept_id = ? WHERE id = ?")
        ->execute([$d['nom'], $d['code'] ?? null, $d['chef_dept_id'] ?: null, $id]);

    if (!empty($d['chef_dept_id'])) {
        $pdo->prepare("UPDATE users SET departement_id = ?, role = 'chef_dept' WHERE id = ?")->execute([$id, $d['chef_dept_id']]);
    }
    ok(null, 'Département mis à jour');
}

if ($method === 'DELETE') {
    requireRole(['admin']);
    $id = $_GET['id'] ?? null;
    if (!$id) fail('ID manquant');

    $d = body();
    $password = $d['password'] ?? '';
    if (!$password) fail('Mot de passe requis pour confirmer la suppression', 400);

    // Vérifie le mot de passe du compte admin actuellement connecté (pas celui d'un autre utilisateur)
    $stmt = $pdo->prepare("SELECT password FROM users WHERE id = ?");
    $stmt->execute([$auth['id']]);
    $moi = $stmt->fetch();
    if (!$moi || !password_verify($password, $moi['password'])) {
        fail('Mot de passe incorrect', 401);
    }

    // Suppression douce : la ligne reste en base, juste masquée, récupérable depuis la corbeille
    $pdo->prepare("UPDATE departements SET supprime_le = NOW() WHERE id = ?")->execute([$id]);
    ok(null, 'Département déplacé dans la corbeille');
}