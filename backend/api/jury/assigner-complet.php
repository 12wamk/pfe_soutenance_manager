<?php
/**
 * v2.2 — Assignation IA complète : résout jury + horaire + salle en une seule
 * optimisation CP-SAT (proxy vers le microservice Flask /assigner-complet).
 */
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);

$d = body();
$etudiantId = $d['etudiant_id'] ?? null;
$date = $d['date'] ?? null;
$excludeSoutenanceId = $d['exclude_soutenance_id'] ?? null;
if (!$etudiantId) fail('etudiant_id requis');

$corpsRequete = ['etudiant_id' => (int) $etudiantId];
if ($date) $corpsRequete['date'] = $date;
if ($excludeSoutenanceId) $corpsRequete['exclude_soutenance_id'] = (int) $excludeSoutenanceId;

$ch = curl_init("http://127.0.0.1:5001/assigner-complet");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($corpsRequete));
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 60); // le solveur peut essayer plusieurs jours, laisse de la marge
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$erreur = curl_error($ch);
curl_close($ch);

if ($erreur) {
    fail("API IA injoignable. Vérifiez qu'elle est bien lancée (python app.py).", 503);
}

$resultat = json_decode($response, true);
if ($http_code !== 200) {
    fail($resultat['erreur'] ?? 'Erreur du service IA', $http_code);
}

ok($resultat);
