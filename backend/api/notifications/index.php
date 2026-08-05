<?php
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30");
    $stmt->execute([$auth['id']]);
    $all = $stmt->fetchAll();
    $unread = count(array_filter($all, fn($n) => !$n['lu']));
    ok(['notifications' => $all, 'unread_count' => $unread]);
}

if ($method === 'POST') {
    // Marquer une ou toutes les notifications comme lues
    $d = body();
    if (!empty($d['id'])) {
        $pdo->prepare("UPDATE notifications SET lu = 1 WHERE id = ? AND user_id = ?")->execute([$d['id'], $auth['id']]);
    } else {
        $pdo->prepare("UPDATE notifications SET lu = 1 WHERE user_id = ?")->execute([$auth['id']]);
    }
    ok(null, 'Notifications marquées comme lues');
}
