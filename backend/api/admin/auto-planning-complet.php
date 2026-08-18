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

$ch = curl_init(FLASK_API_URL . "/auto-planning-complet");
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

// Si sauvegarder=true et planning produit, notifier les enseignants (invitations jury + emails)
if ($sauvegarder && $http_code === 200 && !empty($resultat['planning'])) {
    $nbNotifies = notifier_planning_applique($resultat['planning']);
    $resultat['notifications_envoyees'] = $nbNotifies;
    $response = json_encode($resultat);
}

http_response_code($http_code);
echo $response;

/**
 * Notifie les enseignants des changements de planning : crée les invitations jury
 * (invitations_jury), les notifications in-app et envoie les emails d'invitation
 * — le tout identique au flux de planification manuelle (planifier.php).
 */
function notifier_planning_applique(array $planning): int {
    $pdo = getDB();
    $nb = 0;

    $paramNotif = $pdo->query("SELECT delai_expiration_jours FROM parametres_notifications ORDER BY id DESC LIMIT 1")->fetch();
    $delaiJours = $paramNotif ? (int) $paramNotif['delai_expiration_jours'] : 3;
    $dateLimite = date('Y-m-d H:i:s', strtotime("+$delaiJours days"));

    $stmtInv = $pdo->prepare("INSERT INTO invitations_jury (soutenance_id, enseignant_id, role, statut, date_envoi, date_limite) VALUES (?,?,?, 'en_attente', NOW(), ?)");
    $stmtNotif = $pdo->prepare("INSERT INTO notifications (user_id, type, titre, message, lien) VALUES (?,?,?,?,?)");
    $stmtEns = $pdo->prepare("SELECT email, prenom, nom FROM users WHERE id = ?");

    foreach ($planning as $p) {
        if (empty($p['id']) || empty($p['president_id']) || empty($p['rapporteur_id'])) continue;

        // On nettoie d'éventuelles anciennes invitations en_attente liées (replanification)
        $pdo->prepare("DELETE FROM invitations_jury WHERE soutenance_id = ? AND statut = 'en_attente'")->execute([$p['id']]);

        $date = $p['date'] ?? '';
        $heure = $p['heure_debut'] ?? '';
        $salle = $p['salle'] ?? '';
        $nomEtudiants = $p['etudiant'] ?? '';

        // Invitation calendrier (.ics) si la soutenance a une date ET une heure
        $icsInfo = null;
        if ($date && $heure) {
            $paramsDuree = $pdo->query("SELECT duree_soutenance FROM parametres_creneaux ORDER BY id DESC LIMIT 1")->fetch();
            $dureeMinutes = $paramsDuree ? (int) $paramsDuree['duree_soutenance'] : 30;
            $dtStart = new DateTime("$date $heure", new DateTimeZone('Africa/Tunis'));
            $dtEnd = clone $dtStart;
            $dtEnd->modify("+{$dureeMinutes} minutes");
            $icsInfo = [
                'uid' => 'soutenance-' . $p['id'],
                'dtstart' => $dtStart,
                'dtend' => $dtEnd,
                'summary' => "Soutenance PFE — $nomEtudiants",
                'description' => "Soutenance de $nomEtudiants",
                'location' => $salle,
            ];
        }

        $membres = [
            ['id' => $p['rapporteur_id'], 'role' => 'rapporteur'],
            ['id' => $p['president_id'], 'role' => 'président'],
        ];
        foreach ($membres as $m) {
            $roleDb = $m['role'] === 'président' ? 'president' : 'rapporteur';

            $stmtInv->execute([$p['id'], $m['id'], $roleDb, $dateLimite]);
            $stmtNotif->execute([$m['id'], 'info', 'Invitation jury',
                "Vous avez été désigné {$m['role']} pour la soutenance de $nomEtudiants"
                . ($date ? " le " . date('d/m/Y', strtotime($date)) . ($heure ? " à " . substr($heure, 0, 5) : '') : '')
                . ($salle ? " (salle $salle)" : '') . ".", '/invitations']);
            $nb++;

            $stmtEns->execute([$m['id']]);
            $ens = $stmtEns->fetch();
            if (!$ens) continue;

            $contenu = "<p>Bonjour {$ens['prenom']},</p>
                <p>Vous avez été désigné <strong>{$m['role']}</strong> pour la soutenance de <strong>$nomEtudiants</strong>.</p>"
                . ($date ? "<p><strong>Date :</strong> " . date('d/m/Y', strtotime($date)) . ($heure ? " à " . substr($heure, 0, 5) : '') . "</p>" : '')
                . ($salle ? "<p><strong>Salle :</strong> $salle</p>" : '')
                . ($icsInfo ? "<p>📅 Un événement a été joint à cet email pour l'ajouter directement à votre agenda.</p>" : '')
                . "<p>Merci de vous connecter à la plateforme pour <strong>accepter ou refuser</strong> cette invitation (délai de réponse : $delaiJours jour(s)).</p>";
            envoyerEmail($ens['email'], "{$ens['prenom']} {$ens['nom']}", 'Invitation au jury de soutenance',
                gabaritEmail('Invitation au jury', $contenu), $icsInfo);
        }
    }
    return $nb;
}
