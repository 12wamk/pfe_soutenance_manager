<?php
/**
 * v3.0 — Auto-planning complet : assigne automatiquement jury + date + heure + salle
 * pour toutes les soutenances non planifiées.
 *
 * Proxy vers le microservice Flask CP-SAT (port 5001).
 */
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/mailer.php';

$auth = jwtRequireAuth();

if (!in_array($auth['role'], ['admin', 'chef_dept'])) {
    http_response_code(403);
    echo json_encode(["error" => "Réservé aux administrateurs et chefs de département"]);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$sauvegarder = $data['sauvegarder'] ?? false;
$etudiant_ids = $data['etudiant_ids'] ?? null;

$corpsRequete = [
    "sauvegarder" => $sauvegarder,
    "etudiant_ids" => $etudiant_ids,
];

$ch = curl_init("http://127.0.0.1:5001/auto-planning-complet");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($corpsRequete));
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 60);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$erreur = curl_error($ch);
curl_close($ch);

if ($erreur) {
    http_response_code(503);
    echo json_encode(["error" => "Service IA injoignable. Vérifiez qu'il est bien lancé (python app.py)."]);
    exit;
}

$resultat = json_decode($response, true);

// Si sauvegarder=true et planning produit, notifier les enseignants
if ($sauvegarder && $http_code === 200 && !empty($resultat['planning'])) {
    $nbNotifies = notifier_planning_applique($resultat['planning']);
    $resultat['notifications_envoyees'] = $nbNotifies;
    $response = json_encode($resultat);
}

http_response_code($http_code);
echo $response;

/**
 * Notifie les enseignants des changements de planning.
 */
function notifier_planning_applique(array $planning): int {
    $pdo = getDB();
    $stmtNotif = $pdo->prepare("INSERT INTO notifications (user_id, type, titre, message, lien) VALUES (?,?,?,?,?)");
    $nb = 0;

    foreach ($planning as $p) {
        $jury = array_unique(array_filter([$p['president_id'] ?? null, $p['rapporteur_id'] ?? null]));
        foreach ($jury as $ensId) {
            $stmtNotif->execute([
                $ensId,
                'info',
                'Planning assigné automatiquement',
                "Vous avez été désigné pour la soutenance de {$p['etudiant']} le {$p['date']} à {$p['heure_debut']} (salle {$p['salle']}).",
                '/soutenances',
            ]);
            $nb++;
        }
    }
    return $nb;
}
