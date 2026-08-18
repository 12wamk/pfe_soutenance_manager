<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/mailer.php';
require_once __DIR__ . '/../../config/soutenance_etudiants.php';

$auth = requireRole(['encadrant', 'admin', 'chef_dept']);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);

$d = body();
if (!$d['etudiant_id']) fail('Étudiant requis');
if (!$d['rapporteur_id'] || !$d['president_id']) fail('Rapporteur et président requis');

// Groupe d'étudiants de la soutenance (solo, binôme, trinôme, ...).
// Le frontend envoie `etudiants` (liste ordonnée, 1er = principal) ; on garde
// `etudiant_id` + `etudiant2_id` comme repli pour compat.
$etudiants = $d['etudiants'] ?? [];
if (!is_array($etudiants) || !$etudiants) {
    $etudiants = [$d['etudiant_id'], $d['etudiant2_id'] ?? null];
}
$etudiants = array_values(array_unique(array_filter(array_map('intval', $etudiants))));
$etudiantPrincipal = (int) $etudiants[0];
$etudiant2Id = $etudiants[1] ?? null;
if (count($etudiants) > 1 && in_array($etudiantPrincipal, array_slice($etudiants, 1))) {
    fail('Les étudiants du groupe doivent être différents');
}

$pdo = getDB();
$encadrantId = $auth['role'] === 'encadrant' ? $auth['id'] : ($d['encadrant_id'] ?? null);

// Un encadrant ne peut planifier une soutenance que pour l'un de ses propres étudiants
// (vérifié via etudiants.encadrant_id, jamais déductible depuis le seul rôle connecté).
if ($auth['role'] === 'encadrant') {
    $stmtProprio = $pdo->prepare("SELECT encadrant_id FROM etudiants WHERE id = ?");
    foreach ($etudiants as $eid) {
        $stmtProprio->execute([$eid]);
        $proprio = $stmtProprio->fetch();
        if (!$proprio || (int) $proprio['encadrant_id'] !== (int) $auth['id']) {
            fail("Vous ne pouvez planifier une soutenance que pour l'un de vos propres étudiants", 403);
        }
    }
}

// NOUVEAU : si aucun encadrant n'est fourni (cas admin/chef_dept planifiant sans
// champ encadrant_id dans le formulaire), on reprend automatiquement l'encadrant
// déjà assigné à l'étudiant (etudiants.encadrant_id), pour que la soutenance
// garde toujours une trace de son encadrant.
if (!$encadrantId) {
    $stmtEnc = $pdo->prepare("SELECT encadrant_id FROM etudiants WHERE id = ?");
    $stmtEnc->execute([$etudiantPrincipal]);
    $encadrantId = $stmtEnc->fetchColumn() ?: null;
}

// Groupe : tous les étudiants doivent partager le même encadrant (hypothèse du
// modèle actuel — une soutenance n'a qu'un seul encadrant_id). On le vérifie ici
// plutôt que de silencieusement ignorer l'encadrant des autres étudiants.
if (count($etudiants) > 1 && $encadrantId) {
    $stmtEnc2 = $pdo->prepare("SELECT encadrant_id FROM etudiants WHERE id = ?");
    foreach (array_slice($etudiants, 1) as $eid) {
        $stmtEnc2->execute([$eid]);
        $encadrantAutre = $stmtEnc2->fetchColumn();
        if ($encadrantAutre && (int) $encadrantAutre !== (int) $encadrantId) {
            fail("Les étudiants du groupe n'ont pas tous le même encadrant — vérifiez leurs fiches avant de planifier ensemble");
        }
    }
}

// Le département de la soutenance est celui de la spécialité de l'étudiant (et non de l'utilisateur qui planifie,
// important pour les cas où un encadrant planifie pour un étudiant d'un autre département).
$stmtDept = $pdo->prepare("SELECT o.departement_id FROM etudiants e LEFT JOIN options o ON e.option_id = o.id WHERE e.id = ?");
$stmtDept->execute([$etudiantPrincipal]);
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

// Lignes de soutenance appartenant déjà à un membre du groupe : exclues des
// vérifications de conflit (R4/R5/R3) pour ne pas « se confliter » avec soi-même.
$idsGroupes = soutenancesPourEtudiants($pdo, $etudiants);
$sqlExcl = $idsGroupes ? ' AND id NOT IN (' . implode(',', $idsGroupes) . ')' : '';

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
    // (on exclut les lignes existantes du groupe)
    if ($salle) {
        $stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE date = ? AND heure = ? AND salle = ? AND statut != 'refusee'$sqlExcl");
        $stmt->execute([$date, $heure, $salle]);
        if ($stmt->fetch()['c'] > 0) fail("Conflit de salle : la salle « $salle » est déjà occupée à ce créneau (R4)");
    }

    // ---- R5 : pas de conflit de planning enseignant ----
    $tousLesRoles = array_filter([$encadrantId, $d['rapporteur_id'], $d['president_id']]);
    foreach ($tousLesRoles as $ensId) {
        $stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE date = ? AND heure = ? AND statut != 'refusee'$sqlExcl
            AND (encadrant_id = ? OR rapporteur_id = ? OR president_id = ?)");
        $stmt->execute([$date, $heure, $ensId, $ensId, $ensId]);
        if ($stmt->fetch()['c'] > 0) fail("Conflit de planning : un des enseignants sélectionnés est déjà occupé à ce créneau (R5)");
    }

    // ---- R3 : quota max_soutenances = charge MAX PAR ENSEIGNANT ce jour-là
    // (encadrant, rapporteur et président), PAS un plafond global sur le nombre
    // total de soutenances du jour (plusieurs salles peuvent tourner en parallèle
    // sur les mêmes créneaux, donc pas de check global ici). ----
    $tousLesRolesQuota = array_filter([$encadrantId, $d['rapporteur_id'], $d['president_id']]);
    foreach ($tousLesRolesQuota as $ensId) {
        $stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE date = ? AND statut != 'refusee'$sqlExcl
            AND (encadrant_id = ? OR rapporteur_id = ? OR president_id = ?)");
        $stmt->execute([$date, $ensId, $ensId, $ensId]);
        if ($stmt->fetch()['c'] >= $jour['max_soutenances']) {
            fail("Un des enseignants sélectionnés a déjà atteint son quota de {$jour['max_soutenances']} soutenances pour cette date (R3)");
        }
    }
}

// ---- Réutilise la soutenance existante (sans_date ou refusée) plutôt que d'en créer une seconde ----
// On recherche par TOUS les membres du groupe (principal + liaison), pour couvrir
// le cas où l'étudiant principal n'est pas celui qui possède déjà la ligne.
$idsExistantes = soutenancesPourEtudiants($pdo, $etudiants);
$existantes = [];
if ($idsExistantes) {
    $stmt = $pdo->prepare("SELECT id, statut FROM soutenances WHERE id IN (" . implode(',', $idsExistantes) . ") ORDER BY id DESC");
    $stmt->execute();
    $existantes = $stmt->fetchAll();
}

foreach ($existantes as $ex) {
    if (in_array($ex['statut'], ['planifiee', 'validee'])) {
        fail('Un des étudiants du groupe a déjà une soutenance planifiée ou validée. Modifiez-la plutôt que d\'en créer une nouvelle.');
    }
}

$existante = $existantes[0] ?? null;

if ($existante) {
    $stmt = $pdo->prepare("UPDATE soutenances SET etudiant_id=?, etudiant2_id=NULL, encadrant_id=?, rapporteur_id=?, president_id=?, date=?, heure=?, salle=?, departement_id=?, statut='planifiee', motif_refus=NULL, explication_ia=? WHERE id=?");
    $stmt->execute([$etudiantPrincipal, $encadrantId, $d['rapporteur_id'], $d['president_id'], $date, $heure, $salle, $departementSoutenanceId, $d['explication_ia'] ?? null, $existante['id']]);
    $soutenanceId = $existante['id'];

    // Supprime les lignes "sans_date" résiduelles des autres membres du groupe pour éviter un doublon
    $autresIds = array_slice(array_column($existantes, 'id'), 1);
    if ($autresIds) {
        $pdo->prepare("DELETE FROM soutenances WHERE id IN (" . implode(',', $autresIds) . ") AND statut = 'sans_date'")->execute();
    }
} else {
    $stmt = $pdo->prepare("INSERT INTO soutenances (etudiant_id, etudiant2_id, encadrant_id, rapporteur_id, president_id, date, heure, salle, statut, departement_id, explication_ia) VALUES (?,NULL,?,?,?,?,?,?, 'planifiee', ?, ?)");
    $stmt->execute([$etudiantPrincipal, $encadrantId, $d['rapporteur_id'], $d['president_id'], $date, $heure, $salle, $departementSoutenanceId, $d['explication_ia'] ?? null]);
    $soutenanceId = $pdo->lastInsertId();

    // Supprime d'éventuelles lignes "sans_date" propres aux autres membres du groupe
    $autresIds = array_slice($idsExistantes, 0);
    if ($autresIds) {
        $pdo->prepare("DELETE FROM soutenances WHERE id IN (" . implode(',', $autresIds) . ") AND statut = 'sans_date'")->execute();
    }
}

// Écrit le groupe complet (1, 2, 3, ... étudiants) dans la table de liaison
remplacerMembresSoutenance($pdo, $soutenanceId, $etudiants);

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
// Le nom affiché inclut tous les étudiants du groupe (solo, binôme, trinôme, ...).
$stmtInfoEtudiant = $pdo->prepare("SELECT CONCAT(prenom,' ',nom) as etudiant, titre_sujet FROM etudiants WHERE id = ?");
$stmtInfoEtudiant->execute([$etudiantPrincipal]);
$infoEtudiant = $stmtInfoEtudiant->fetch();
$stmtNoms = $pdo->prepare("SELECT CONCAT(e.prenom,' ',e.nom) as nom FROM soutenance_etudiants se JOIN etudiants e ON e.id = se.etudiant_id WHERE se.soutenance_id = ? ORDER BY se.ordre");
$stmtNoms->execute([$soutenanceId]);
$nomEtudiants = implode(' & ', $stmtNoms->fetchAll(PDO::FETCH_COLUMN));

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