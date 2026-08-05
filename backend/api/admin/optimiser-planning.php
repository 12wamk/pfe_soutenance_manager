<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/mailer.php';

$auth = jwtRequireAuth();

// Réservé aux admins et chefs de département
if (!in_array($auth['role'], ['admin', 'chef_dept'])) {
    http_response_code(403);
    echo json_encode(["error" => "Reserve aux administrateurs et chefs de departement"]);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$date = $data['date'] ?? null; // optionnel : si absent, l'API optimise TOUTES les dates planifiees
$sauvegarder = $data['sauvegarder'] ?? false;

// Construit le corps de la requête vers Flask (date incluse seulement si fournie)
$corpsRequete = ["sauvegarder" => $sauvegarder];
if ($date) {
    $corpsRequete["date"] = $date;
}

// Appel à l'API Flask locale (le vrai solveur OR-Tools tourne là-bas)
$ch = curl_init("http://127.0.0.1:5001/optimiser-planning");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($corpsRequete));
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30); // le solveur peut prendre plus de temps sur plusieurs dates
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

$resultatFlask = json_decode($response, true);

// ---- Si le planning a bien été appliqué (sauvegarder=true), on notifie les profs concernés ----
if ($sauvegarder && $http_code === 200 && !empty($resultatFlask['planning'])) {
    $pdo = getDB();
    $stmtNotif = $pdo->prepare("INSERT INTO notifications (user_id, type, titre, message, lien) VALUES (?,?,?,?,?)");
    $stmtEns = $pdo->prepare("SELECT email, prenom, nom FROM users WHERE id = ?");

    $nbProfsNotifies = 0;

    foreach ($resultatFlask['planning'] as $item) {
        $heureAvant = $item['heure_actuelle'] ?? null;
        $heureApres = substr($item['heure_debut'] ?? '', 0, 5);

        // On ne notifie que si l'heure a réellement changé (ou soutenance nouvellement placée)
        if ($heureAvant === $heureApres) {
            continue;
        }

        // La date vient de l'item lui-même en mode "toutes les dates", sinon on retombe sur $date
        $dateItem = $item['date'] ?? $date;
        $dateFormatee = $dateItem ? date('d/m/Y', strtotime($dateItem)) : '';

        $jury = array_unique(array_filter($item['jury'] ?? []));

        foreach ($jury as $ensId) {
            // Notification in-app
            $stmtNotif->execute([
                $ensId,
                'info',
                'Planning optimisé — nouvel horaire',
                "La soutenance de {$item['etudiant']} du $dateFormatee a été replanifiée à {$heureApres} (salle {$item['salle']}).",
                '/soutenances',
            ]);

            // Email
            $stmtEns->execute([$ensId]);
            $ens = $stmtEns->fetch();
            if (!$ens) continue;

            $contenu = "<p>Bonjour {$ens['prenom']},</p>
                <p>Suite à une optimisation du planning, l'horaire de la soutenance de
                <strong>{$item['etudiant']}</strong> a été mis à jour :</p>
                <p><strong>Date :</strong> $dateFormatee<br>
                <strong>Nouvelle heure :</strong> {$heureApres}"
                . ($heureAvant ? " (au lieu de {$heureAvant})" : " (nouvellement planifiée)")
                . "<br><strong>Salle :</strong> {$item['salle']}</p>
                <p>Merci de noter ce changement dans votre agenda.</p>";

            envoyerEmail($ens['email'], "{$ens['prenom']} {$ens['nom']}", 'Mise à jour de votre planning de soutenance',
                gabaritEmail('Planning optimisé', $contenu));

            $nbProfsNotifies++;
        }
    }

    $resultatFlask['notifications_envoyees'] = $nbProfsNotifies;
    $response = json_encode($resultatFlask);
}

// Retransmet la réponse (éventuellement enrichie) au frontend
http_response_code($http_code);
echo $response;