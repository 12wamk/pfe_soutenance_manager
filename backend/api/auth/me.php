<?php
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->prepare("SELECT id, nom, prenom, email, role, grade, departement_id, photo_url, is_active, max_soutenances_jour, expertises, enseignements, domaines_recherche, bio_courte FROM users WHERE id = ?");
    $stmt->execute([$auth['id']]);
    $user = $stmt->fetch();
    if (!$user) fail('Utilisateur introuvable', 404);

    $user['expertises'] = json_decode($user['expertises'] ?? '[]', true) ?: [];
    $user['enseignements'] = json_decode($user['enseignements'] ?? '[]', true) ?: [];
    $user['domaines_recherche'] = json_decode($user['domaines_recherche'] ?? '[]', true) ?: [];

    ok($user);
}

if ($method === 'PUT') {
    // L'utilisateur met à jour SA PROPRE description (expertises, enseignements,
    // domaines de recherche, bio textuelle) — utilisée par l'IA de suggestion de planning.
    $d = body();
    $set = [];
    $params = [];
    foreach (['expertises', 'enseignements', 'domaines_recherche'] as $champ) {
        if (isset($d[$champ])) {
            $set[] = "$champ = ?";
            $params[] = is_array($d[$champ]) ? json_encode(array_values($d[$champ])) : $d[$champ];
        }
    }
    if (isset($d['bio_courte'])) {
        $set[] = 'bio_courte = ?';
        $bio = trim((string) $d['bio_courte']);
        $params[] = $bio !== '' ? $bio : null;
    }
    if (!$set) fail('Aucun champ à mettre à jour', 400);
    $params[] = $auth['id'];

    $pdo->prepare("UPDATE users SET " . implode(', ', $set) . " WHERE id = ?")->execute($params);
    ok(null, 'Profil enseignant mis à jour');
}
