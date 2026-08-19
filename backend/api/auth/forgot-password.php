<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/mailer.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);

$data = body();
$email = trim($data['email'] ?? '');
if (!$email) fail('Email requis');

$pdo = getDB();
$stmt = $pdo->prepare("SELECT id, prenom, nom, email FROM users WHERE email = ? AND is_active = 1");
$stmt->execute([$email]);
$user = $stmt->fetch();

if ($user) {
    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', time() + 3600);
    $pdo->prepare("INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)")
        ->execute([$user['id'], $token, $expires]);

    $lien = "http://localhost:3000/reset-password?token=$token";
    $contenu = "<p>Bonjour {$user['prenom']},</p>
        <p>Une demande de réinitialisation de votre mot de passe a été effectuée sur la plateforme ENET'COM - Gestion des Soutenances.</p>
        <p><a href=\"$lien\" style=\"display:inline-block;background:#1a5276;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;\">Réinitialiser mon mot de passe</a></p>
        <p>Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>";
    envoyerEmail($user['email'], "{$user['prenom']} {$user['nom']}", 'Réinitialisation de votre mot de passe',
        gabaritEmail('Réinitialisation de mot de passe', $contenu));
}

ok(null, "Si un compte existe pour cet email, un lien de réinitialisation a été envoyé");