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

// 1. Enregistre l'heure de fin réelle et calcule la durée en une seule requête,
//    uniquement si l'utilisateur connecté est bien l'encadrant de CETTE soutenance
//    et que la soutenance a bien été démarrée avant.
$stmt = $pdo->prepare("
    UPDATE soutenances
    SET heure_fin_reelle = NOW(),
        duree_reelle_min = TIMESTAMPDIFF(MINUTE, heure_debut_reelle, NOW())
    WHERE id = ? AND encadrant_id = ? AND heure_debut_reelle IS NOT NULL
");
$stmt->execute([$soutenance_id, $auth['id']]);

if ($stmt->rowCount() === 0) {
    http_response_code(403);
    echo json_encode(["error" => "Soutenance introuvable, non demarree, ou vous n'en etes pas l'encadrant"]);
    exit;
}

// 2. Récupère la durée calculée pour l'afficher
$stmt2 = $pdo->prepare("SELECT duree_reelle_min FROM soutenances WHERE id = ?");
$stmt2->execute([$soutenance_id]);
$duree = $stmt2->fetchColumn();

// 3. Déclenche le réentraînement du modèle IA (ne bloque pas si l'API Flask est éteinte)
declencherReentrainementIA();

ok([
    "message" => "Soutenance terminee",
    "soutenance_id" => $soutenance_id,
    "duree_reelle_min" => (int) $duree
]);

/**
 * Appelle l'API Flask locale pour réentraîner le modèle de prédiction de durée.
 * Timeout court : si Flask n'est pas lancé, ça n'empêche pas le reste de fonctionner.
 */
function declencherReentrainementIA() {
    $ch = curl_init(FLASK_API_URL . "/retrain-duree");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, "{}");
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);

    $response = curl_exec($ch);
    $erreur = curl_error($ch);
    curl_close($ch);

    if ($erreur) {
        error_log("Reentrainement IA echoue : " . $erreur);
    }
}
