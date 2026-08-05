<?php
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();

// Réservé aux admins et chefs de département
if (!in_array($auth['role'], ['admin', 'chef_dept'])) {
    http_response_code(403);
    echo json_encode(["error" => "Reserve aux administrateurs et chefs de departement"]);
    exit;
}

$ch = curl_init("http://127.0.0.1:5001/impact-stats");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30); // le calcul recalcule le solveur sur toutes les dates, peut prendre du temps
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$erreur = curl_error($ch);
curl_close($ch);

if ($erreur) {
    http_response_code(503);
    echo json_encode(["error" => "API IA injoignable. Verifiez qu'elle est bien lancee (python app.py)."]);
    exit;
}

http_response_code($http_code);
echo $response;
