<?php
/**
 * SCRIPT DESTINÉ À ÊTRE APPELÉ PAR UN CRON / PLANIFICATEUR DE TÂCHES WINDOWS,
 * PAS PAR LE FRONTEND — d'où l'absence volontaire d'authentification JWT ici.
 *
 * Missions, à exécuter par exemple toutes les heures :
 * 1. Envoyer un rappel (notification in-app) aux enseignants dont l'invitation
 *    jury expire dans moins de `delai_rappel_heures` heures et n'a pas encore été rappelée.
 * 2. Faire passer en "expiree" toute invitation jury en_attente dont la
 *    date_limite est dépassée, et notifier l'encadrant concerné (R8).
 * 3. Faire passer en "expiree" toute demande de participation en_attente dont
 *    la date_limite est dépassée, et notifier la partie qui devait répondre.
 * 4. Envoyer un rappel 24h avant une soutenance validée à l'encadrant, au
 *    rapporteur et au président (confirmation de présence).
 *
 * Exemple de tâche planifiée Windows :
 *   php.exe C:\xampp\htdocs\pfe-soutenance-manager\backend\api\jury\cron-rappels-expiration.php
 *
 * Sécurité : ce script n'expose aucune donnée sensible en sortie et ne doit
 * être accessible que localement (ou protégé par un jeton partagé si exposé
 * publiquement — voir la constante CRON_SECRET ci-dessous).
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/mailer.php';

// Protection minimale si ce fichier venait à être accessible via HTTP public.
define('CRON_SECRET', 'changez_moi_avant_prod');
if (php_sapi_name() !== 'cli' && ($_GET['secret'] ?? '') !== CRON_SECRET) {
    http_response_code(403);
    exit('Accès refusé.');
}

$pdo = getDB();
$params = $pdo->query("SELECT * FROM parametres_notifications ORDER BY id DESC LIMIT 1")->fetch();
$delaiRappelHeures = $params ? (int) $params['delai_rappel_heures'] : 24;
$messageExpiration = $params['message_expiration'] ?? 'Votre invitation au jury a expiré faute de réponse dans le délai imparti.';

$stmtNotif = $pdo->prepare("INSERT INTO notifications (user_id, type, titre, message, lien) VALUES (?,?,?,?,?)");

// ============================================================
// PARTIE 1 : INVITATIONS JURY (inchangé)
// ============================================================

// ---- 1a. Rappels avant expiration ----
$stmt = $pdo->prepare("
    SELECT i.*, u.email, u.prenom, u.nom, CONCAT(e.prenom,' ',e.nom) as etudiant
    FROM invitations_jury i
    JOIN users u ON i.enseignant_id = u.id
    JOIN soutenances s ON i.soutenance_id = s.id
    JOIN etudiants e ON s.etudiant_id = e.id
    WHERE i.statut = 'en_attente' AND i.rappel_envoye = 0
    AND i.date_limite <= DATE_ADD(NOW(), INTERVAL ? HOUR)
");
$stmt->execute([$delaiRappelHeures]);
$aRappeler = $stmt->fetchAll();

foreach ($aRappeler as $inv) {
    $stmtNotif->execute([$inv['enseignant_id'], 'warning', 'Rappel : invitation jury bientôt expirée',
        "Votre invitation au jury expire bientôt (le " . date('d/m/Y à H:i', strtotime($inv['date_limite'])) . "). Merci de répondre.", '/invitations']);
    $pdo->prepare("UPDATE invitations_jury SET rappel_envoye = 1 WHERE id = ?")->execute([$inv['id']]);

    $contenu = "<p>Bonjour {$inv['prenom']},</p>
        <p>Votre invitation à siéger comme <strong>{$inv['role']}</strong> pour la soutenance de <strong>{$inv['etudiant']}</strong>
        expire le <strong>" . date('d/m/Y à H:i', strtotime($inv['date_limite'])) . "</strong>.</p>
        <p>Merci de vous connecter à la plateforme pour accepter ou refuser avant cette échéance.</p>";
    envoyerEmail($inv['email'], "{$inv['prenom']} {$inv['nom']}", 'Rappel : invitation jury bientôt expirée',
        gabaritEmail('Rappel', $contenu));
}

// ---- 1b. Expiration effective + notification à l'encadrant ----
$stmt = $pdo->query("
    SELECT i.*, s.encadrant_id, u.email, u.prenom, u.nom, CONCAT(e.prenom,' ',e.nom) as etudiant
    FROM invitations_jury i
    JOIN soutenances s ON i.soutenance_id = s.id
    JOIN etudiants e ON s.etudiant_id = e.id
    LEFT JOIN users u ON s.encadrant_id = u.id
    WHERE i.statut = 'en_attente' AND i.date_limite < NOW()
");
$aExpirer = $stmt->fetchAll();

foreach ($aExpirer as $inv) {
    $pdo->prepare("UPDATE invitations_jury SET statut = 'expiree' WHERE id = ?")->execute([$inv['id']]);
    if ($inv['encadrant_id']) {
        $stmtNotif->execute([$inv['encadrant_id'], 'error', 'Invitation jury expirée',
            "$messageExpiration Veuillez choisir un autre enseignant pour le rôle « {$inv['role']} ».", '/soutenances']);

        if ($inv['email']) {
            $contenu = "<p>Bonjour {$inv['prenom']},</p>
                <p>L'invitation au jury ($inv[role]) pour la soutenance de <strong>{$inv['etudiant']}</strong> a expiré sans réponse.</p>
                <p>$messageExpiration</p>
                <p>Merci de choisir un autre enseignant depuis la plateforme.</p>";
            envoyerEmail($inv['email'], "{$inv['prenom']} {$inv['nom']}", 'Invitation jury expirée',
                gabaritEmail('Invitation expirée', $contenu));
        }
    }
}

// ============================================================
// PARTIE 2 : DEMANDES DE PARTICIPATION INTER-DÉPARTEMENT (inchangé)
// ============================================================

$stmt = $pdo->query("
    SELECT dp.*, CONCAT(u.prenom,' ',u.nom) as enseignant, u.prenom as ens_prenom, u.nom as ens_nom, u.email as ens_email,
           d.nom as departement_cible
    FROM demandes_participation dp
    JOIN users u ON dp.enseignant_id = u.id
    JOIN departements d ON dp.departement_cible_id = d.id
    WHERE dp.statut = 'en_attente' AND dp.date_limite IS NOT NULL AND dp.date_limite < NOW()
");
$aExpirerParticipation = $stmt->fetchAll();

foreach ($aExpirerParticipation as $demande) {
    $pdo->prepare("UPDATE demandes_participation SET statut = 'expiree' WHERE id = ?")->execute([$demande['id']]);

    if ($demande['initiateur'] === 'enseignant') {
        // C'était à un chef de département de répondre -> on notifie les chefs + l'enseignant demandeur
        $chefs = $pdo->prepare("SELECT id, email, prenom, nom FROM users WHERE role = 'chef_dept' AND departement_id = ? AND is_active = 1");
        $chefs->execute([$demande['departement_cible_id']]);
        foreach ($chefs->fetchAll() as $chef) {
            $stmtNotif->execute([$chef['id'], 'error', 'Demande de participation expirée',
                "La demande de participation de {$demande['enseignant']} a expiré sans réponse de votre part.", '/participation']);
        }
        $stmtNotif->execute([$demande['enseignant_id'], 'error', 'Votre demande de participation a expiré',
            "Votre demande de participation au département « {$demande['departement_cible']} » a expiré sans réponse.", '/participation']);

        if ($demande['ens_email']) {
            $contenu = "<p>Bonjour {$demande['ens_prenom']},</p>
                <p>Votre demande de participation aux soutenances du département <strong>{$demande['departement_cible']}</strong>
                a expiré sans réponse dans le délai imparti.</p>
                <p>N'hésitez pas à renvoyer une nouvelle demande si vous le souhaitez.</p>";
            envoyerEmail($demande['ens_email'], "{$demande['ens_prenom']} {$demande['ens_nom']}",
                'Votre demande de participation a expiré', gabaritEmail('Demande expirée', $contenu));
        }
    } else {
        // C'était à l'enseignant invité de répondre -> on notifie l'enseignant + les chefs du département
        $stmtNotif->execute([$demande['enseignant_id'], 'error', 'Invitation à participer expirée',
            "Votre invitation à participer aux soutenances du département « {$demande['departement_cible']} » a expiré faute de réponse.", '/participation']);

        if ($demande['ens_email']) {
            $contenu = "<p>Bonjour {$demande['ens_prenom']},</p>
                <p>Votre invitation à participer aux soutenances du département <strong>{$demande['departement_cible']}</strong>
                a expiré faute de réponse dans le délai imparti.</p>";
            envoyerEmail($demande['ens_email'], "{$demande['ens_prenom']} {$demande['ens_nom']}",
                'Invitation à participer expirée', gabaritEmail('Invitation expirée', $contenu));
        }

        $chefs = $pdo->prepare("SELECT id FROM users WHERE role = 'chef_dept' AND departement_id = ? AND is_active = 1");
        $chefs->execute([$demande['departement_cible_id']]);
        foreach ($chefs->fetchAll() as $chef) {
            $stmtNotif->execute([$chef['id'], 'error', 'Invitation expirée',
                "L'enseignant invité ({$demande['enseignant']}) n'a pas répondu à temps à votre invitation.", '/participation']);
        }
    }
}

// ============================================================
// PARTIE 3 : RAPPEL 24H AVANT SOUTENANCE (nouveau)
// ============================================================
// Concerne uniquement les soutenances validées, avec date ET heure fixées,
// dont l'échéance tombe dans moins de 24h — envoyé une seule fois grâce au
// flag rappel_24h_envoye (colonne à ajouter : voir ALTER TABLE fourni).
// Destinataires : encadrant, rapporteur, président (pas l'étudiant, qui n'a
// pas d'adresse email dans le système).

$stmt = $pdo->query("
    SELECT s.id, s.date, s.heure, s.salle,
           CONCAT(e.prenom,' ',e.nom) as etudiant, e.titre_sujet,
           s.encadrant_id, s.rapporteur_id, s.president_id
    FROM soutenances s
    JOIN etudiants e ON s.etudiant_id = e.id
    WHERE s.statut = 'validee'
      AND s.date IS NOT NULL AND s.heure IS NOT NULL
      AND (s.rappel_24h_envoye = 0 OR s.rappel_24h_envoye IS NULL)
      AND TIMESTAMP(s.date, s.heure) <= DATE_ADD(NOW(), INTERVAL 24 HOUR)
      AND TIMESTAMP(s.date, s.heure) > NOW()
");
$aRappelerSoutenance = $stmt->fetchAll();

$stmtMembre = $pdo->prepare("SELECT id, email, prenom, nom FROM users WHERE id = ?");

foreach ($aRappelerSoutenance as $sout) {
    $dateFormatee = date('d/m/Y', strtotime($sout['date']));
    $heureFormatee = substr($sout['heure'], 0, 5);

    $destinataires = [
        ['id' => $sout['encadrant_id'], 'role' => 'encadrant'],
        ['id' => $sout['rapporteur_id'], 'role' => 'rapporteur'],
        ['id' => $sout['president_id'], 'role' => 'président'],
    ];

    foreach ($destinataires as $membre) {
        if (!$membre['id']) continue;
        $stmtMembre->execute([$membre['id']]);
        $u = $stmtMembre->fetch();
        if (!$u) continue;

        $stmtNotif->execute([$u['id'], 'info', 'Rappel : soutenance demain',
            "Rappel : la soutenance de {$sout['etudiant']} a lieu demain le $dateFormatee à $heureFormatee"
            . ($sout['salle'] ? " (salle {$sout['salle']})" : '') . ". Merci de confirmer votre présence.",
            '/soutenances']);

        if ($u['email']) {
            $contenu = "<p>Bonjour {$u['prenom']},</p>
                <p>Ceci est un rappel : vous êtes désigné(e) <strong>{$membre['role']}</strong> pour la soutenance de
                <strong>{$sout['etudiant']}</strong>" . ($sout['titre_sujet'] ? " (\"{$sout['titre_sujet']}\")" : '') . ".</p>
                <p><strong>Date :</strong> $dateFormatee à $heureFormatee"
                . ($sout['salle'] ? " — <strong>Salle :</strong> {$sout['salle']}" : '') . "</p>
                <p>Merci de vous connecter à la plateforme pour confirmer votre présence si nécessaire.</p>";
            envoyerEmail($u['email'], "{$u['prenom']} {$u['nom']}", 'Rappel : soutenance demain',
                gabaritEmail('Rappel de soutenance', $contenu));
        }
    }

    $pdo->prepare("UPDATE soutenances SET rappel_24h_envoye = 1 WHERE id = ?")->execute([$sout['id']]);
}

echo "Rappels jury envoyés : " . count($aRappeler) . " | Invitations jury expirées : " . count($aExpirer)
    . " | Demandes de participation expirées : " . count($aExpirerParticipation)
    . " | Rappels de soutenance (24h) envoyés : " . count($aRappelerSoutenance) . "\n";