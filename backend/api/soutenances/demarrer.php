<?php
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$pdo = getDB();

$data = json_decode(file_get_contents('php://input'), true);
$soutenance_id = $data['soutenance_id'] ?? null;

if (!$soutenance_id) {
    http_response_code(400);
    echo json_encode(["error" => "soutenance_id manquant"]);
    exit;
}

// Sécurité : on ne modifie que si l'utilisateur connecté est bien
// l'encadrant de CETTE soutenance précise
$stmt = $pdo->prepare("
    UPDATE soutenances
    SET heure_debut_reelle = NOW()
    WHERE id = ? AND encadrant_id = ?
");
$stmt->execute([$soutenance_id, $auth['id']]);

if ($stmt->rowCount() === 0) {
    http_response_code(403);
    echo json_encode(["error" => "Soutenance introuvable ou vous n'en etes pas l'encadrant"]);
    exit;
}

ok(["message" => "Soutenance demarree", "soutenance_id" => $soutenance_id]);
