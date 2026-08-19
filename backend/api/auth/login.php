<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/ratelimit.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);

$data = body();
$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';

ratelimitCheck('login_ip:' . ratelimitIp(), 10, 900, 'Trop de tentatives de connexion depuis cette adresse IP, réessayez dans 15 minutes');
if ($email) ratelimitCheck('login_email:' . mb_strtolower($email), 5, 900, 'Trop de tentatives pour cet email, réessayez dans 15 minutes');

if (!$email || !$password) fail('Email et mot de passe requis');

$pdo = getDB();
$stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? AND is_active = 1");
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password'])) {
    fail('Email ou mot de passe incorrect', 401);
}

$token = jwtCreate([
    'id' => $user['id'],
    'email' => $user['email'],
    'role' => $user['role'],
    'nom' => $user['nom'],
    'prenom' => $user['prenom'],
    'departement_id' => $user['departement_id'],
    'jwt_version' => $user['jwt_version'] ?? 1,
]);

ok([
    'token' => $token,
    'user' => [
        'id' => $user['id'], 'nom' => $user['nom'], 'prenom' => $user['prenom'],
        'email' => $user['email'], 'role' => $user['role'], 'departement_id' => $user['departement_id'],
        'photo_url' => $user['photo_url'] ?? null,
    ],
], 'Connexion réussie');
