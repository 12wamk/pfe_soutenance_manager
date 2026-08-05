<?php
/**
 * Réaffecte un nouveau président ou rapporteur sur une soutenance existante.
 *
 * v1.9 : vérifications de disponibilité complétées avant l'affectation
 * (auparavant seul R5 — conflit de planning — était vérifié) :
 *  - R3 : quota journalier de soutenances (encadrant/rapporteur/président)
 *  - Disponibilité déclarée (table disponibilites : absent/disponible)
 *
 * v1.14 : le nouvel enseignant reçoit désormais une invitation calendrier (.ics)
 * en plus de l'email, comme lors de la planification initiale (planifier.php).
 * L'uid réutilise 'soutenance-{id}' — pour ce nouvel enseignant c'est un nouvel
 * événement dans son agenda (il n'en avait pas avant), donc method=REQUEST.
 */
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/mailer.php';

$auth = requireRole(['chef_dept', 'admin', 'encadrant']);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);

$d = body();
$soutenanceId = $d['soutenance_id'] ?? null;
$role = $d['role'] ?? null;
$enseignantId = $d['enseignant_id'] ?? null;

if (!$soutenanceId || !in_array($role, ['rapporteur', 'president']) || !$enseignantId) fail('Paramètres invalides');

$pdo = getDB();
$stmt = $pdo->prepare("SELECT s.*, CONCAT(e.prenom,' ',e.nom) as etudiant, e.titre_sujet FROM soutenances s JOIN etudiants e ON s.etudiant_id = e.id WHERE s.id = ?");
$stmt->execute([$soutenanceId]);
$soutenance = $stmt->fetch();
if (!$soutenance) fail('Soutenance introuvable', 404);

$champ = $role === 'rapporteur' ? 'rapporteur_id' : 'president_id';
$autreChamp = $role === 'rapporteur' ? 'president_id' : 'rapporteur_id';

// ---- R1 : Président ≠ Rapporteur ----
if ((int) $enseignantId === (int) $soutenance[$autreChamp]) fail('Le président et le rapporteur doivent être deux personnes différentes (R1)');
// ---- R2 : Encadrant ≠ Président/Rapporteur ----
if ((int) $enseignantId === (int) $soutenance['encadrant_id']) fail("L'encadrant ne peut pas être membre du jury de sa propre soutenance (R2)");

if ($soutenance['date'] && $soutenance['heure']) {
    // ---- R5 : pas de conflit de planning ----
    $stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE date = ? AND heure = ? AND statut != 'refusee' AND id != ?
        AND (encadrant_id = ? OR rapporteur_id = ? OR president_id = ?)");
    $stmt->execute([$soutenance['date'], $soutenance['heure'], $soutenanceId, $enseignantId, $enseignantId, $enseignantId]);
    if ($stmt->fetch()['c'] > 0) fail('Cet enseignant est déjà occupé à ce créneau (R5)');

    // ---- R3 : quota journalier (encadrant/rapporteur/président ce jour-là) ----
    $jour = $pdo->prepare("SELECT max_soutenances FROM jours_calendrier WHERE date = ?");
    $jour->execute([$soutenance['date']]);
    $jour = $jour->fetch();
    if ($jour) {
        $stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE date = ? AND statut != 'refusee' AND id != ?
            AND (encadrant_id = ? OR rapporteur_id = ? OR president_id = ?)");
        $stmt->execute([$soutenance['date'], $soutenanceId, $enseignantId, $enseignantId, $enseignantId]);
        if ($stmt->fetch()['c'] >= (int) $jour['max_soutenances']) {
            fail("Cet enseignant a déjà atteint son quota de {$jour['max_soutenances']} soutenances pour cette date (R3)");
        }
    }

    // ---- Disponibilité déclarée (table disponibilites) ----
    $stmt = $pdo->prepare("SELECT statut FROM disponibilites WHERE enseignant_id = ? AND date = ?");
    $stmt->execute([$enseignantId, $soutenance['date']]);
    $dispo = $stmt->fetch();
    if ($dispo && $dispo['statut'] === 'absent') {
        fail("Cet enseignant s'est déclaré indisponible à cette date");
    }
}

$pdo->prepare("UPDATE soutenances SET $champ = ? WHERE id = ?")->execute([$enseignantId, $soutenanceId]);

// Nouvelle invitation pour le nouvel enseignant
$paramNotif = $pdo->query("SELECT delai_expiration_jours FROM parametres_notifications ORDER BY id DESC LIMIT 1")->fetch();
$delaiJours = $paramNotif ? (int) $paramNotif['delai_expiration_jours'] : 3;
$dateLimite = date('Y-m-d H:i:s', strtotime("+$delaiJours days"));
$pdo->prepare("INSERT INTO invitations_jury (soutenance_id, enseignant_id, role, statut, date_envoi, date_limite) VALUES (?,?,?, 'en_attente', NOW(), ?)")
    ->execute([$soutenanceId, $enseignantId, $role, $dateLimite]);

$pdo->prepare("INSERT INTO notifications (user_id, type, titre, message, lien) VALUES (?,?,?,?,?)")
    ->execute([$enseignantId, 'info', 'Invitation jury', "Vous avez été désigné $role pour la soutenance de {$soutenance['etudiant']}", '/invitations']);

// ---- Invitation calendrier (.ics) pour le nouvel enseignant, si la soutenance a une date+heure ----
$icsInfo = null;
if ($soutenance['date'] && $soutenance['heure']) {
    $paramsDuree = $pdo->query("SELECT duree_soutenance FROM parametres_creneaux ORDER BY id DESC LIMIT 1")->fetch();
    $dureeMinutes = $paramsDuree ? (int) $paramsDuree['duree_soutenance'] : 30;

    $dtStart = new DateTime($soutenance['date'] . ' ' . $soutenance['heure'], new DateTimeZone('Africa/Tunis'));
    $dtEnd = clone $dtStart;
    $dtEnd->modify("+{$dureeMinutes} minutes");

    $icsInfo = [
        'uid' => 'soutenance-' . $soutenanceId,
        'method' => 'REQUEST',
        'dtstart' => $dtStart,
        'dtend' => $dtEnd,
        'summary' => "Soutenance PFE — {$soutenance['etudiant']}",
        'description' => "Soutenance de {$soutenance['etudiant']}" . (!empty($soutenance['titre_sujet']) ? " — {$soutenance['titre_sujet']}" : ''),
        'location' => $soutenance['salle'] ?? '',
    ];
}

$stmtEns = $pdo->prepare("SELECT email, prenom, nom FROM users WHERE id = ?");
$stmtEns->execute([$enseignantId]);
$nouvelEnseignant = $stmtEns->fetch();
if ($nouvelEnseignant) {
    $contenu = "<p>Bonjour {$nouvelEnseignant['prenom']},</p>
        <p>Vous avez été désigné <strong>$role</strong> pour la soutenance de <strong>{$soutenance['etudiant']}</strong>.</p>"
        . ($soutenance['date'] ? "<p><strong>Date :</strong> " . date('d/m/Y', strtotime($soutenance['date'])) . ($soutenance['heure'] ? " à " . substr($soutenance['heure'], 0, 5) : '') . "</p>" : '')
        . ($icsInfo ? "<p>📅 Un événement a été joint à cet email pour l'ajouter directement à votre agenda.</p>" : '')
        . "<p>Merci de vous connecter à la plateforme pour accepter ou refuser cette invitation (délai : $delaiJours jour(s)).</p>";
    envoyerEmail($nouvelEnseignant['email'], "{$nouvelEnseignant['prenom']} {$nouvelEnseignant['nom']}",
        'Invitation au jury de soutenance', gabaritEmail('Invitation au jury', $contenu), $icsInfo);
}

ok(null, "Nouveau $role affecté, invitation envoyée");