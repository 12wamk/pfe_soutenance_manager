<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/ratelimit.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);

ratelimitCheck('register_ip:' . ratelimitIp(), 10, 3600, 'Trop de comptes créés depuis cette adresse IP, réessayez dans une heure');

$auth = jwtRequireAuth();
if (!in_array($auth['role'], ['admin', 'chef_dept'])) {
    fail('Inscription réservée aux administrateurs et chefs de département', 403);
}

$data = body();
$nom = trim($data['nom'] ?? '');
$prenom = trim($data['prenom'] ?? '');
$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';
$departement_id = $data['departement_id'] ?? null;
$role = $data['role'] ?? 'encadrant';

if (!in_array($role, ['encadrant'])) {
    fail("Un chef de département ne peut créer que des comptes encadrant", 403);
}

if ($auth['role'] === 'chef_dept' && $departement_id && (int) $departement_id !== (int) $auth['departement_id']) {
    fail("Vous ne pouvez créer un compte que dans votre propre département", 403);
}

if (!$nom || !$prenom || !$email || !$password) fail('Champs requis manquants');
if (strlen($password) < 6) fail('Mot de passe trop court (min. 6 caractères)');

$pdo = getDB();
$stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
$stmt->execute([$email]);
if ($stmt->fetch()) fail('Cet email est déjà utilisé', 409);

$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $pdo->prepare("INSERT INTO users (nom, prenom, email, password, role, departement_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)");
$stmt->execute([$nom, $prenom, $email, $hash, $role, $departement_id]);

ok(['id' => $pdo->lastInsertId()], 'Compte créé avec succès', 201);
