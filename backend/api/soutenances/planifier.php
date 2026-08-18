<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/mailer.php';

$auth = requireRole(['encadrant', 'admin', 'chef_dept']);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);

$d = body();
if (!$d['etudiant_id']) fail('Étudiant requis');
if (!$d['rapporteur_id'] || !$d['president_id']) fail('Rapporteur et président requis');

// NOUVEAU : etudiant2_id optionnel -> planification en binôme (2 étudiants, une seule soutenance)
$etudiant2Id = !empty($d['etudiant2_id']) ? (int) $d['etudiant2_id'] : null;
if ($etudiant2Id && $etudiant2Id === (int) $d['etudiant_id']) {
    fail('Les deux étudiants du binôme doivent être différents');
}

$pdo = getDB();
$encadrantId = $auth['role'] === 'encadrant' ? $auth['id'] : ($d['encadrant_id'] ?? null);

// Un encadrant ne peut planifier une soutenance que pour l'un de ses propres étudiants
// (vérifié via etudiants.encadrant_id, jamais déductible depuis le seul rôle connecté).
if ($auth['role'] === 'encadrant') {
    $stmtProprio = $pdo->prepare("SELECT encadrant_id FROM etudiants WHERE id = ?");
    $stmtProprio->execute([$d['etudiant_id']]);
    $proprio = $stmtProprio->fetch();
    if (!$proprio || (int) $proprio['encadrant_id'] !== (int) $auth['id']) {
        fail("Vous ne pouvez planifier une soutenance que pour l'un de vos propres étudiants", 403);
    }
    // Même vérification pour le 2e étudiant du binôme, le cas échéant
    if ($etudiant2Id) {
        $stmtProprio2 = $pdo->prepare("SELECT encadrant_id FROM etudiants WHERE id = ?");
        $stmtProprio2->execute([$etudiant2Id]);
        $proprio2 = $stmtProprio2->fetch();
        if (!$proprio2 || (int) $proprio2['encadrant_id'] !== (int) $auth['id']) {
            fail("Le 2e étudiant du binôme doit aussi être l'un de vos propres étudiants", 403);
        }
    }
}

// NOUVEAU : si aucun encadrant n'est fourni (cas admin/chef_dept planifiant sans
// champ encadrant_id dans le formulaire), on reprend automatiquement l'encadrant
// déjà assigné à l'étudiant (etudiants.encadrant_id), pour que la soutenance
// garde toujours une trace de son encadrant.
if (!$encadrantId) {
    $stmtEnc = $pdo->prepare("SELECT encadrant_id FROM etudiants WHERE id = ?");
    $stmtEnc->execute([$d['etudiant_id']]);
    $encadrantId = $stmtEnc->fetchColumn() ?: null;
}

// Si binôme : les deux étudiants doivent partager le même encadrant (hypothèse du
// modèle actuel — une soutenance n'a qu'un seul encadrant_id). On le vérifie ici
// plutôt que de silencieusement ignorer l'encadrant du 2e étudiant.
if ($etudiant2Id) {
    $stmtEnc2 = $pdo->prepare("SELECT encadrant_id FROM etudiants WHERE id = ?");
    $stmtEnc2->execute([$etudiant2Id]);
    $encadrant2 = $stmtEnc2->fetchColumn();
    if ($encadrant2 && $encadrantId && (int) $encadrant2 !== (int) $encadrantId) {
        fail("Les deux étudiants du binôme n'ont pas le même encadrant — vérifiez leurs fiches avant de planifier ensemble");
    }
}

// Le département de la soutenance est celui de la spécialité de l'étudiant (et non de l'utilisateur qui planifie,
// important pour les cas où un encadrant planifie pour un étudiant d'un autre département).
$stmtDept = $pdo->prepare("SELECT o.departement_id FROM etudiants e LEFT JOIN options o ON e.option_id = o.id WHERE e.id = ?");
$stmtDept->execute([$d['etudiant_id']]);
$departementSoutenanceId = $stmtDept->fetch()['departement_id'] ?? ($auth['departement_id'] ?? null);

// Un chef de département ne peut planifier que pour un étudiant de son propre département
if ($auth['role'] === 'chef_dept' && (int) $departementSoutenanceId !== (int) $auth['departement_id']) {
    fail("Vous ne pouvez planifier une soutenance que pour un étudiant de votre département", 403);
}

// ---- R1 : Président ≠ Rapporteur ----
if ((int) $d['rapporteur_id'] === (int) $d['president_id']) {
    fail('Le rapporteur et le président doivent être deux personnes différentes (R1)');
}
// ---- R2 : Encadrant ≠ Président et ≠ Rapporteur ----
if ($encadrantId && ((int) $encadrantId === (int) $d['rapporteur_id'] || (int) $encadrantId === (int) $d['president_id'])) {
    fail("L'encadrant ne peut pas être lui-même désigné président ou rapporteur de sa propre soutenance (R2)");
}

$date = $d['date'] ?? null;
$heure = $d['heure'] ?? null;
$salle = $d['salle'] ?? null;

if ($date) {
    // ---- R6 : la date doit être dans la période autorisée (jour actif du calendrier) ----
    $stmt = $pdo->prepare("SELECT * FROM jours_calendrier WHERE date = ? AND actif = 1");
    $stmt->execute([$date]);
    $jour = $stmt->fetch();
    if (!$jour) fail("La date choisie n'est pas ouverte aux soutenances (jour férié, weekend ou non retenu — R6)");

    // ---- R10 : heure optionnelle -> auto-assignation du prochain créneau libre ----
    if (!$heure) {
        $params = $pdo->query("SELECT * FROM parametres_creneaux ORDER BY id DESC LIMIT 1")->fetch();
        $heureDepart = $params['heure_depart'] ?? '08:30:00';
        $dureeSoutenance = (int) ($params['duree_soutenance'] ?? 30);
        $dureePause = (int) ($params['duree_pause'] ?? 10);

        $stmtOcc = $pdo->prepare("SELECT heure FROM soutenances WHERE date = ? AND heure IS NOT NULL");
        $stmtOcc->execute([$date]);
        $occupees = array_map(fn($r) => substr($r['heure'], 0, 5), $stmtOcc->fetchAll());

        $current = strtotime($date . ' ' . $heureDepart);
        for ($i = 0; $i < (int) $jour['max_soutenances']; $i++) {
            $candidat = date('H:i', $current);
            if (!in_array($candidat, $occupees)) { $heure = $candidat; break; }
            $current = strtotime("+{$dureeSoutenance} minutes +{$dureePause} minutes", $current);
        }
        if (!$heure) fail('Aucun créneau libre ce jour-là, le quota est atteint (R3/R10)');
    } else {
        $params = $pdo->query("SELECT * FROM parametres_creneaux ORDER BY id DESC LIMIT 1")->fetch();
        $heureDepart = $params['heure_depart'] ?? '08:30:00';
        $dureeSoutenance = (int) ($params['duree_soutenance'] ?? 30);
        $dureePause = (int) ($params['duree_pause'] ?? 10);
        $current = strtotime($date . ' ' . $heureDepart);
        $valide = false;
        for ($i = 0; $i < (int) $jour['max_soutenances']; $i++) {
            if (date('H:i', $current) === substr($heure, 0, 5)) { $valide = true; break; }
            $current = strtotime("+{$dureeSoutenance} minutes +{$dureePause} minutes", $current);
        }
        if (!$valide) fail("L'heure saisie ne correspond à aucun créneau valide pour cette journée");
    }

    // ---- R4 : pas de conflit de salle ----
    // (on exclut la ligne existante de CE binôme, identifiée par l'un ou l'autre étudiant)
    if ($salle) {
        $stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE date = ? AND heure = ? AND salle = ? AND statut != 'refusee'
            AND etudiant_id != ? AND (etudiant2_id IS NULL OR etudiant2_id != ?)");
        $stmt->execute([$date, $heure, $salle, $d['etudiant_id'], $d['etudiant_id']]);
        if ($stmt->fetch()['c'] > 0) fail("Conflit de salle : la salle « $salle » est déjà occupée à ce créneau (R4)");
    }

    // ---- R5 : pas de conflit de planning enseignant ----
    $tousLesRoles = array_filter([$encadrantId, $d['rapporteur_id'], $d['president_id']]);
    foreach ($tousLesRoles as $ensId) {
        $stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE date = ? AND heure = ? AND statut != 'refusee' AND etudiant_id != ?
            AND (encadrant_id = ? OR rapporteur_id = ? OR president_id = ?)");
        $stmt->execute([$date, $heure, $d['etudiant_id'], $ensId, $ensId, $ensId]);
        if ($stmt->fetch()['c'] > 0) fail("Conflit de planning : un des enseignants sélectionnés est déjà occupé à ce créneau (R5)");
    }

    // ---- R3 : quota max_soutenances = charge MAX PAR ENSEIGNANT ce jour-là
    // (encadrant, rapporteur et président), PAS un plafond global sur le nombre
    // total de soutenances du jour (plusieurs salles peuvent tourner en parallèle
    // sur les mêmes créneaux, donc pas de check global ici). ----
    $tousLesRolesQuota = array_filter([$encadrantId, $d['rapporteur_id'], $d['president_id']]);
    foreach ($tousLesRolesQuota as $ensId) {
        $stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE date = ? AND statut != 'refusee' AND etudiant_id != ?
            AND (encadrant_id = ? OR rapporteur_id = ? OR president_id = ?)");
        $stmt->execute([$date, $d['etudiant_id'], $ensId, $ensId, $ensId]);
        if ($stmt->fetch()['c'] >= $jour['max_soutenances']) {
            fail("Un des enseignants sélectionnés a déjà atteint son quota de {$jour['max_soutenances']} soutenances pour cette date (R3)");
        }
    }
}

// ---- Réutilise la soutenance existante (sans_date ou refusée) plutôt que d'en créer une seconde ----
// On recherche par etudiant_id OU etudiant2_id, pour couvrir le cas où l'étudiant
// principal du binôme n'est pas celui qui possède déjà la ligne "sans_date".
$stmt = $pdo->prepare("SELECT id, statut FROM soutenances WHERE etudiant_id = ? OR etudiant2_id = ? ORDER BY id DESC LIMIT 1");
$stmt->execute([$d['etudiant_id'], $d['etudiant_id']]);
$existante = $stmt->fetch();

// Si un 2e étudiant est fourni, s'assurer qu'il n'a pas lui-même déjà une soutenance active ailleurs
if ($etudiant2Id) {
    $stmt2 = $pdo->prepare("SELECT id, statut FROM soutenances WHERE (etudiant_id = ? OR etudiant2_id = ?) AND id != ?");
    $stmt2->execute([$etudiant2Id, $etudiant2Id, $existante['id'] ?? 0]);
    $existante2 = $stmt2->fetch();
    if ($existante2 && in_array($existante2['statut'], ['planifiee', 'validee'])) {
        fail("Le 2e étudiant du binôme a déjà une soutenance planifiée ou validée ailleurs — impossible de le rattacher à ce binôme");
    }
}

if ($existante && in_array($existante['statut'], ['planifiee', 'validee'])) {
    fail('Cet étudiant a déjà une soutenance planifiée ou validée. Modifiez-la plutôt que d\'en créer une nouvelle.');
}

if ($existante) {
    $stmt = $pdo->prepare("UPDATE soutenances SET etudiant_id=?, etudiant2_id=?, encadrant_id=?, rapporteur_id=?, president_id=?, date=?, heure=?, salle=?, departement_id=?, statut='planifiee', motif_refus=NULL, explication_ia=? WHERE id=?");
    $stmt->execute([$d['etudiant_id'], $etudiant2Id, $encadrantId, $d['rapporteur_id'], $d['president_id'], $date, $heure, $salle, $departementSoutenanceId, $d['explication_ia'] ?? null, $existante['id']]);
    $soutenanceId = $existante['id'];

    // Si le binôme fusionne avec une 2e ligne "sans_date" propre à l'étudiant 2, on la supprime pour éviter un doublon
    if ($etudiant2Id) {
        $pdo->prepare("DELETE FROM soutenances WHERE (etudiant_id = ? OR etudiant2_id = ?) AND id != ? AND statut = 'sans_date'")
            ->execute([$etudiant2Id, $etudiant2Id, $soutenanceId]);
    }
} else {
    $stmt = $pdo->prepare("INSERT INTO soutenances (etudiant_id, etudiant2_id, encadrant_id, rapporteur_id, president_id, date, heure, salle, statut, departement_id, explication_ia) VALUES (?,?,?,?,?,?,?,?, 'planifiee', ?, ?)");
    $stmt->execute([$d['etudiant_id'], $etudiant2Id, $encadrantId, $d['rapporteur_id'], $d['president_id'], $date, $heure, $salle, $departementSoutenanceId, $d['explication_ia'] ?? null]);
    $soutenanceId = $pdo->lastInsertId();

    if ($etudiant2Id) {
        $pdo->prepare("DELETE FROM soutenances WHERE (etudiant_id = ? OR etudiant2_id = ?) AND id != ? AND statut = 'sans_date'")
            ->execute([$etudiant2Id, $etudiant2Id, $soutenanceId]);
    }
}

// Invitations jury (on nettoie d'éventuelles anciennes invitations en_attente liées si replanification)
$pdo->prepare("DELETE FROM invitations_jury WHERE soutenance_id = ? AND statut = 'en_attente'")->execute([$soutenanceId]);

$paramNotif = $pdo->query("SELECT delai_expiration_jours FROM parametres_notifications ORDER BY id DESC LIMIT 1")->fetch();
$delaiJours = $paramNotif ? (int) $paramNotif['delai_expiration_jours'] : 3;
$dateLimite = date('Y-m-d H:i:s', strtotime("+$delaiJours days"));

$stmtInv = $pdo->prepare("INSERT INTO invitations_jury (soutenance_id, enseignant_id, role, statut, date_envoi, date_limite) VALUES (?,?,?, 'en_attente', NOW(), ?)");
$stmtInv->execute([$soutenanceId, $d['rapporteur_id'], 'rapporteur', $dateLimite]);
$stmtInv->execute([$soutenanceId, $d['president_id'], 'president', $dateLimite]);

$stmtNotif = $pdo->prepare("INSERT INTO notifications (user_id, type, titre, message, lien) VALUES (?,?,?,?,?)");
$stmtNotif->execute([$d['rapporteur_id'], 'info', 'Invitation jury', 'Vous avez été désigné rapporteur pour une soutenance', '/invitations']);
$stmtNotif->execute([$d['president_id'], 'info', 'Invitation jury', 'Vous avez été désigné président pour une soutenance', '/invitations']);

// Email d'invitation (en plus de la notification in-app), pour rapporteur puis président
// Le nom affiché inclut les 2 étudiants si binôme.
$stmtInfoEtudiant = $pdo->prepare("SELECT CONCAT(prenom,' ',nom) as etudiant, titre_sujet FROM etudiants WHERE id = ?");
$stmtInfoEtudiant->execute([$d['etudiant_id']]);
$infoEtudiant = $stmtInfoEtudiant->fetch();
$nomEtudiants = $infoEtudiant['etudiant'];
if ($etudiant2Id) {
    $stmtInfoEtudiant2 = $pdo->prepare("SELECT CONCAT(prenom,' ',nom) as etudiant FROM etudiants WHERE id = ?");
    $stmtInfoEtudiant2->execute([$etudiant2Id]);
    $etudiant2Nom = $stmtInfoEtudiant2->fetchColumn();
    if ($etudiant2Nom) $nomEtudiants .= " & $etudiant2Nom";
}

// ---- Préparation de l'invitation calendrier (.ics), si la soutenance a une date ET une heure ----
// L'UID est basé sur l'ID de la soutenance : stable à travers les replanifications,
// pour que les clients mail mettent à jour l'événement existant plutôt que d'en créer un doublon.
$icsInfo = null;
if ($date && $heure) {
    $paramsDuree = $pdo->query("SELECT duree_soutenance FROM parametres_creneaux ORDER BY id DESC LIMIT 1")->fetch();
    $dureeMinutes = $paramsDuree ? (int) $paramsDuree['duree_soutenance'] : 30;

    $dtStart = new DateTime("$date $heure", new DateTimeZone('Africa/Tunis'));
    $dtEnd = clone $dtStart;
    $dtEnd->modify("+{$dureeMinutes} minutes");

    $descriptionIcs = "Soutenance de $nomEtudiants" . ($infoEtudiant['titre_sujet'] ? " — {$infoEtudiant['titre_sujet']}" : '');

    $icsInfo = [
        'uid' => 'soutenance-' . $soutenanceId,
        'dtstart' => $dtStart,
        'dtend' => $dtEnd,
        'summary' => "Soutenance PFE — $nomEtudiants",
        'description' => $descriptionIcs,
        'location' => $salle ?: '',
    ];
}

$stmtEns = $pdo->prepare("SELECT email, prenom, nom FROM users WHERE id = ?");
foreach ([['id' => $d['rapporteur_id'], 'role' => 'rapporteur'], ['id' => $d['president_id'], 'role' => 'président']] as $membre) {
    $stmtEns->execute([$membre['id']]);
    $ens = $stmtEns->fetch();
    if (!$ens) continue;
    $contenu = "<p>Bonjour {$ens['prenom']},</p>
        <p>Vous avez été désigné <strong>{$membre['role']}</strong> pour la soutenance de <strong>{$nomEtudiants}</strong>"
        . ($infoEtudiant['titre_sujet'] ? " (\"{$infoEtudiant['titre_sujet']}\")" : '') . ".</p>"
        . ($date ? "<p><strong>Date :</strong> " . date('d/m/Y', strtotime($date)) . ($heure ? " à " . substr($heure, 0, 5) : '') . "</p>" : '')
        . ($icsInfo ? "<p>📅 Un événement a été joint à cet email pour l'ajouter directement à votre agenda.</p>" : '')
        . "<p>Merci de vous connecter à la plateforme pour <strong>accepter ou refuser</strong> cette invitation (délai de réponse : $delaiJours jour(s)).</p>";
    envoyerEmail($ens['email'], "{$ens['prenom']} {$ens['nom']}", 'Invitation au jury de soutenance',
        gabaritEmail('Invitation au jury', $contenu), $icsInfo);
}

if ($departementSoutenanceId) {
    $chefs = $pdo->prepare("SELECT id FROM users WHERE role = 'chef_dept' AND departement_id = ? AND is_active = 1");
    $chefs->execute([$departementSoutenanceId]);
    foreach ($chefs->fetchAll() as $chef) {
        $stmtNotif->execute([$chef['id'], 'info', 'Nouvelle soutenance planifiée', 'Une soutenance a été planifiée et attend votre validation', '/soutenances']);
    }
}

ok(['id' => $soutenanceId, 'heure' => $heure], 'Soutenance planifiée, invitations envoyées au jury', 201);