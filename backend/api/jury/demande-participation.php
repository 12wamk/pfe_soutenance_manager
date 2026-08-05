<?php
/**
 * Gestion des participations inter-département, dans les DEUX sens :
 * - initiateur='enseignant' : l'enseignant sollicite un département (flux original)
 * - initiateur='departement' : le département invite un enseignant (flux inverse)
 *
 * v1.8 : le nombre de fois envisagé est désormais scindé par rôle
 * (nombre_rapporteur / nombre_president) au lieu d'un seul champ
 * nombre_souhaite générique.
 */
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/mailer.php';

$auth = jwtRequireAuth();
$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// Calcule la date limite de réponse à partir du délai configurable par l'admin
// (parametres_notifications.delai_expiration_participation_jours)
function calculerDateLimiteParticipation($pdo) {
    $params = $pdo->query("SELECT delai_expiration_participation_jours FROM parametres_notifications ORDER BY id DESC LIMIT 1")->fetch();
    $delaiJours = $params ? (int) $params['delai_expiration_participation_jours'] : 5;
    return date('Y-m-d H:i:s', strtotime("+$delaiJours days"));
}

if ($method === 'POST') {
    // Un enseignant sollicite un département (flux original, initiateur='enseignant')
    $d = body();
    $nombreRapporteur = (int) ($d['nombre_rapporteur'] ?? 0);
    $nombrePresident  = (int) ($d['nombre_president'] ?? 0);

    if (!$d['departement_cible_id'] || !$d['role_souhaite'] || ($nombreRapporteur < 1 && $nombrePresident < 1)) {
        fail('Champs requis manquants');
    }

    $dateLimite = calculerDateLimiteParticipation($pdo);

    $stmt = $pdo->prepare("INSERT INTO demandes_participation (enseignant_id, initiateur, departement_cible_id, role_souhaite, nombre_rapporteur, nombre_president, disponibilites_preferees, date_limite, statut) VALUES (?, 'enseignant', ?,?,?,?,?,?,'en_attente')");
    $stmt->execute([$auth['id'], $d['departement_cible_id'], $d['role_souhaite'], $nombreRapporteur, $nombrePresident, $d['disponibilites_preferees'] ?? null, $dateLimite]);
    $demandeId = $pdo->lastInsertId();

    $chefs = $pdo->prepare("SELECT id, email, prenom, nom FROM users WHERE role = 'chef_dept' AND departement_id = ? AND is_active = 1");
    $chefs->execute([$d['departement_cible_id']]);
    foreach ($chefs->fetchAll() as $chef) {
        $pdo->prepare("INSERT INTO notifications (user_id, type, titre, message, lien) VALUES (?,?,?,?,?)")
            ->execute([$chef['id'], 'info', 'Demande de participation jury', "{$auth['prenom']} {$auth['nom']} souhaite participer aux soutenances de votre département", '/participation']);
        $contenu = "<p>Bonjour {$chef['prenom']},</p><p><strong>{$auth['prenom']} {$auth['nom']}</strong> souhaite participer aux soutenances de votre département.</p><p>Merci de vous connecter à la plateforme pour accepter ou refuser cette demande avant le " . date('d/m/Y', strtotime($dateLimite)) . ".</p>";
        envoyerEmail($chef['email'], "{$chef['prenom']} {$chef['nom']}", 'Demande de participation jury', gabaritEmail('Nouvelle demande', $contenu));
    }

    ok(['id' => $demandeId], 'Demande de participation envoyée', 201);
}

if ($method === 'GET') {
    $vue = $_GET['vue'] ?? 'auto';

    if ($vue === 'auto') {
        $vue = in_array($auth['role'], ['chef_dept', 'admin']) ? 'recues' : 'invitations';
    }

    if ($vue === 'recues') {
        // Demandes envoyées PAR des enseignants VERS mon département (à valider par moi)
        requireRole(['chef_dept', 'admin']);
        $stmt = $pdo->prepare("
            SELECT dp.*, CONCAT(u.prenom,' ',u.nom) as enseignant, d.nom as departement_cible
            FROM demandes_participation dp
            JOIN users u ON dp.enseignant_id = u.id
            JOIN departements d ON dp.departement_cible_id = d.id
            WHERE dp.departement_cible_id = ? AND dp.initiateur = 'enseignant'
            ORDER BY dp.id DESC
        ");
        $stmt->execute([$auth['departement_id']]);
        ok($stmt->fetchAll());
    }

    if ($vue === 'envoyees') {
        // NOUVEAU : invitations proactives ENVOYÉES par le chef/admin pour son département
        // (initiateur='departement'). Distinct de 'invitations' qui, lui, désigne les
        // invitations REÇUES par l'utilisateur connecté en tant qu'enseignant invité.
        requireRole(['chef_dept', 'admin']);
        $sql = "
            SELECT dp.*, CONCAT(u.prenom,' ',u.nom) as enseignant, d.nom as departement_cible
            FROM demandes_participation dp
            JOIN users u ON dp.enseignant_id = u.id
            JOIN departements d ON dp.departement_cible_id = d.id
            WHERE dp.initiateur = 'departement'
        ";
        if ($auth['role'] === 'admin') {
            // L'admin voit toutes les invitations envoyées, tous départements confondus
            $stmt = $pdo->query($sql . " ORDER BY dp.id DESC");
        } else {
            // Le chef ne voit que celles envoyées pour SON département
            $stmt = $pdo->prepare($sql . " AND dp.departement_cible_id = ? ORDER BY dp.id DESC");
            $stmt->execute([$auth['departement_id']]);
        }
        ok($stmt->fetchAll());
    }

    if ($vue === 'invitations') {
        // Invitations que J'AI reçues d'un département (à accepter/refuser moi-même,
        // en tant qu'enseignant invité — même si je suis par ailleurs chef_dept ailleurs)
        $stmt = $pdo->prepare("
            SELECT dp.*, d.nom as departement_cible
            FROM demandes_participation dp
            JOIN departements d ON dp.departement_cible_id = d.id
            WHERE dp.enseignant_id = ? AND dp.initiateur = 'departement'
            ORDER BY dp.id DESC
        ");
        $stmt->execute([$auth['id']]);
        ok($stmt->fetchAll());
    }

    if ($vue === 'mes_demandes') {
        // Mes propres demandes envoyées vers d'autres départements
        $stmt = $pdo->prepare("
            SELECT dp.*, d.nom as departement_cible
            FROM demandes_participation dp
            JOIN departements d ON dp.departement_cible_id = d.id
            WHERE dp.enseignant_id = ? AND dp.initiateur = 'enseignant'
            ORDER BY dp.id DESC
        ");
        $stmt->execute([$auth['id']]);
        ok($stmt->fetchAll());
    }

    fail('Vue inconnue');
}

if ($method === 'PUT') {
    $d = body();
    $id = $_GET['id'] ?? null;
    if (!$id || !in_array($d['statut'], ['acceptee', 'refusee'])) fail('Paramètres invalides');

    $stmt = $pdo->prepare("SELECT * FROM demandes_participation WHERE id = ?");
    $stmt->execute([$id]);
    $demande = $stmt->fetch();
    if (!$demande) fail('Demande introuvable', 404);

    // Sécurité : selon qui est à l'initiative, seule la bonne partie peut décider
    if ($demande['initiateur'] === 'enseignant') {
        requireRole(['chef_dept', 'admin']);
        if ($auth['role'] === 'chef_dept' && (int) $demande['departement_cible_id'] !== (int) $auth['departement_id']) {
            fail('Cette demande concerne un autre département', 403);
        }
    } else { // initiateur === 'departement'
        if ((int) $auth['id'] !== (int) $demande['enseignant_id'] && !in_array($auth['role'], ['admin'])) {
            fail('Seul l\'enseignant invité peut répondre à cette invitation', 403);
        }
    }

    $pdo->prepare("UPDATE demandes_participation SET statut = ? WHERE id = ?")->execute([$d['statut'], $id]);

    // Notification à l'autre partie
    if ($demande['initiateur'] === 'enseignant') {
        $msg = $d['statut'] === 'acceptee' ? 'Votre demande de participation au jury a été acceptée.' : 'Votre demande de participation au jury a été refusée.';
        $pdo->prepare("INSERT INTO notifications (user_id, type, titre, message, lien) VALUES (?,?,?,?,?)")
            ->execute([$demande['enseignant_id'], $d['statut'] === 'acceptee' ? 'success' : 'error', 'Demande de participation', $msg, '/participation']);
    } else {
        $chefs = $pdo->prepare("SELECT id FROM users WHERE role = 'chef_dept' AND departement_id = ? AND is_active = 1");
        $chefs->execute([$demande['departement_cible_id']]);
        $msgChef = $d['statut'] === 'acceptee' ? 'a accepté' : 'a refusé';
        foreach ($chefs->fetchAll() as $chef) {
            $pdo->prepare("INSERT INTO notifications (user_id, type, titre, message, lien) VALUES (?,?,?,?,?)")
                ->execute([$chef['id'], $d['statut'] === 'acceptee' ? 'success' : 'error', 'Réponse à votre invitation', "L'enseignant invité $msgChef de participer aux soutenances de votre département.", '/participation']);
        }
    }

    ok(null, 'Demande mise à jour');
}