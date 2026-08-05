<?php
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $corbeille = !empty($_GET['corbeille']);
    $condition = $corbeille ? "o.supprime_le IS NOT NULL" : "o.supprime_le IS NULL";
    ok($pdo->query("
        SELECT o.*, d.nom as departement_nom FROM options o
        LEFT JOIN departements d ON o.departement_id = d.id
        WHERE $condition
        ORDER BY o.nom
    ")->fetchAll());
}

if ($method === 'POST') {
    requireRole(['admin']);
    $d = body();
    if (!$d['nom'] || !$d['departement_id']) fail("Nom et département requis (chaque option/spécialité doit être affectée à un département)");
    $stmt = $pdo->prepare("INSERT INTO options (nom, code, departement_id) VALUES (?, ?, ?)");
    $stmt->execute([$d['nom'], $d['code'] ?? null, $d['departement_id']]);
    ok(['id' => $pdo->lastInsertId()], 'Option/spécialité créée', 201);
}

if ($method === 'PUT') {
    requireRole(['admin']);
    $d = body();
    $id = $_GET['id'] ?? null;
    if (!$id) fail('ID manquant');

    // Restauration depuis la corbeille : { "restaurer": true }, aucun autre champ requis
    if (!empty($d['restaurer'])) {
        $pdo->prepare("UPDATE options SET supprime_le = NULL WHERE id = ?")->execute([$id]);
        ok(null, 'Spécialité restaurée');
    }

    if (!$d['nom'] || !$d['departement_id']) fail('Paramètres invalides');
    $pdo->prepare("UPDATE options SET nom = ?, code = ?, departement_id = ? WHERE id = ?")->execute([$d['nom'], $d['code'] ?? null, $d['departement_id'], $id]);
    ok(null, 'Option/spécialité mise à jour');
}

if ($method === 'DELETE') {
    requireRole(['admin']);
    $id = $_GET['id'] ?? null;
    if (!$id) fail('ID manquant');

    $d = body();
    $password = $d['password'] ?? '';
    if (!$password) fail('Mot de passe requis pour confirmer la suppression', 400);

    $stmt = $pdo->prepare("SELECT password FROM users WHERE id = ?");
    $stmt->execute([$auth['id']]);
    $moi = $stmt->fetch();
    if (!$moi || !password_verify($password, $moi['password'])) {
        fail('Mot de passe incorrect', 401);
    }

    $pdo->prepare("UPDATE options SET supprime_le = NOW() WHERE id = ?")->execute([$id]);
    ok(null, 'Spécialité déplacée dans la corbeille');
}