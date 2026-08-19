<?php
require_once __DIR__ . '/../../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);

$data = body();
$token = trim($data['token'] ?? '');
$password = $data['password'] ?? '';
if (!$token || !$password) fail('Token et nouveau mot de passe requis');
if (strlen($password) < 6) fail('Mot de passe trop court (min. 6 caractères)');

$pdo = getDB();
$stmt = $pdo->prepare("SELECT * FROM password_resets WHERE token = ?");
$stmt->execute([$token]);
$reset = $stmt->fetch();

if (!$reset || (int) $reset['used'] === 1) fail('Token invalide ou déjà utilisé', 400);
if (strtotime($reset['expires_at']) < time()) fail('Ce lien a expiré, veuillez refaire une demande', 400);

$hash = password_hash($password, PASSWORD_DEFAULT);
$pdo->prepare("UPDATE users SET password = ? WHERE id = ?")->execute([$hash, $reset['user_id']]);
$pdo->prepare("UPDATE password_resets SET used = 1 WHERE id = ?")->execute([$reset['id']]);

jwtRevoke($pdo, $reset['user_id']);

ok(null, 'Mot de passe réinitialisé avec succès, vous pouvez vous connecter');