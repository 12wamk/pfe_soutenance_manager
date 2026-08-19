<?php
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$data = body();
$current = $data['current_password'] ?? '';
$new = $data['new_password'] ?? '';

if (!$current || !$new) fail('Champs requis manquants');
if (strlen($new) < 6) fail('Nouveau mot de passe trop court (min. 6 caractères)');

$pdo = getDB();
$stmt = $pdo->prepare("SELECT password FROM users WHERE id = ?");
$stmt->execute([$auth['id']]);
$user = $stmt->fetch();

if (!$user || !password_verify($current, $user['password'])) {
    fail('Mot de passe actuel incorrect', 401);
}

$hash = password_hash($new, PASSWORD_DEFAULT);
$stmt = $pdo->prepare("UPDATE users SET password = ? WHERE id = ?");
$stmt->execute([$hash, $auth['id']]);

jwtRevoke($pdo, $auth['id']);

ok(null, 'Mot de passe mis à jour avec succès, veuillez vous reconnecter');
