<?php
/**
 * Paramétrage admin des notifications :
 * - délai d'expiration des invitations jury (delai_expiration_jours)
 * - délai d'expiration des demandes de participation inter-département (delai_expiration_participation_jours)
 * - message affiché en cas d'expiration
 * - délai de rappel avant expiration
 */
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM parametres_notifications ORDER BY id DESC LIMIT 1");
    ok($stmt->fetch());
}

if ($method === 'POST') {
    requireRole(['admin']);
    $d = body();
    $stmt = $pdo->prepare("INSERT INTO parametres_notifications
        (delai_expiration_jours, delai_expiration_participation_jours, message_expiration, delai_rappel_heures)
        VALUES (?,?,?,?)");
    $stmt->execute([
        $d['delai_expiration_jours'] ?? 3,
        $d['delai_expiration_participation_jours'] ?? 5,
        $d['message_expiration'] ?? 'Votre invitation au jury a expiré faute de réponse dans le délai imparti.',
        $d['delai_rappel_heures'] ?? 24,
    ]);
    ok(['id' => $pdo->lastInsertId()], 'Paramètres de notification enregistrés', 201);
}