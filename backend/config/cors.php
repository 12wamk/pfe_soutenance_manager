<?php
/**
 * En-têtes CORS + bootstrap commun à tous les endpoints.
 * IMPORTANT : ce fichier ne doit être inclus qu'une seule fois par requête,
 * et aucun autre fichier ne doit redéfinir ces mêmes en-têtes (voir notes
 * de déploiement dans le README — un doublon d'en-tête CORS casse le
 * préflight OPTIONS du navigateur).
 */

$allowedOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: http://localhost:3000");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/jwt.php';

function body() {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function ok($data = null, $msg = 'Succès', $code = 200) {
    http_response_code($code);
    $r = ['success' => true, 'message' => $msg];
    if ($data !== null) $r['data'] = $data;
    echo json_encode($r, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail($msg = 'Erreur', $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}
