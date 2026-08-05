<?php
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$pdo = getDB();
$stmt = $pdo->prepare("SELECT id, nom, prenom, email, role, departement_id, photo_url, is_active FROM users WHERE id = ?");
$stmt->execute([$auth['id']]);
$user = $stmt->fetch();
if (!$user) fail('Utilisateur introuvable', 404);

ok($user);
