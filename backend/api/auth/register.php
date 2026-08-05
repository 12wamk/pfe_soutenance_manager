<?php
require_once __DIR__ . '/../../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);

$data = body();
$nom = trim($data['nom'] ?? '');
$prenom = trim($data['prenom'] ?? '');
$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';
$departement_id = $data['departement_id'] ?? null;

if (!$nom || !$prenom || !$email || !$password) fail('Champs requis manquants');
if (strlen($password) < 6) fail('Mot de passe trop court (min. 6 caractères)');

$pdo = getDB();
$stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
$stmt->execute([$email]);
if ($stmt->fetch()) fail('Cet email est déjà utilisé', 409);

$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $pdo->prepare("INSERT INTO users (nom, prenom, email, password, role, departement_id, is_active) VALUES (?, ?, ?, ?, 'encadrant', ?, 1)");
$stmt->execute([$nom, $prenom, $email, $hash, $departement_id]);

ok(['id' => $pdo->lastInsertId()], 'Compte créé avec succès', 201);
