<?php
/**
 * Le chef de département (ou l'admin) annule l'affectation d'un enseignant
 * comme président ou rapporteur sur une soutenance donnée.
 * La soutenance repasse en "planifiee" (en attente de validation) si elle
 * était déjà validée, l'enseignant retiré et l'encadrant sont notifiés.
 *
 * v1.14 : si l'enseignant retiré avait reçu une invitation calendrier (.ics) au
 * moment de son affectation, on lui envoie désormais une annulation calendrier
 * (METHOD:CANCEL, même uid 'soutenance-{id}') pour que l'événement soit retiré
 * automatiquement de son agenda — pas seulement de la plateforme.
 */
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/mailer.php';

$auth = requireRole(['chef_dept', 'admin']);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);

$d = body();
$soutenanceId = $d['soutenance_id'] ?? null;
$role = $d['role'] ?? null; // 'rapporteur' | 'president'

if (!$soutenanceId || !in_array($role, ['rapporteur', 'president'])) fail('Paramètres invalides');

$pdo = getDB();
$champ = $role === 'rapporteur' ? 'rapporteur_id' : 'president_id';

$stmt = $pdo->prepare("SELECT s.*, CONCAT(e.prenom,' ',e.nom) as etudiant, e.titre_sujet FROM soutenances s JOIN etudiants e ON s.etudiant_id = e.id WHERE s.id = ?");
$stmt->execute([$soutenanceId]);
$soutenance = $stmt->fetch();
if (!$soutenance) fail('Soutenance introuvable', 404);

$ancienEnseignantId = $soutenance[$champ];
if (!$ancienEnseignantId) fail("Aucun $role affecté à cette soutenance");

$stmtEns = $pdo->prepare("SELECT email, prenom, nom FROM users WHERE id = ?");
$stmtEns->execute([$ancienEnseignantId]);
$ancienEnseignant = $stmtEns->fetch();

// Retire l'affectation, repasse la soutenance en attente de validation
$nouveauStatut = $soutenance['statut'] === 'validee' ? 'planifiee' : $soutenance['statut'];
$pdo->prepare("UPDATE soutenances SET $champ = NULL, statut = ? WHERE id = ?")->execute([$nouveauStatut, $soutenanceId]);

// Supprime l'invitation en attente correspondante, le cas échéant
$pdo->prepare("DELETE FROM invitations_jury WHERE soutenance_id = ? AND enseignant_id = ? AND role = ?")
    ->execute([$soutenanceId, $ancienEnseignantId, $role]);

// Notifications : l'enseignant retiré + l'encadrant (à choisir un nouveau membre)
$stmtNotif = $pdo->prepare("INSERT INTO notifications (user_id, type, titre, message, lien) VALUES (?,?,?,?,?)");
$stmtNotif->execute([$ancienEnseignantId, 'warning', 'Affectation jury annulée',
    "Votre affectation comme $role pour la soutenance de {$soutenance['etudiant']} a été annulée par le chef de département.", '/mon-planning']);

// ---- Annulation calendrier (.ics, METHOD:CANCEL) pour l'enseignant retiré ----
// Même uid que l'invitation d'origine ('soutenance-{id}') : le client mail
// reconnaît l'événement déjà présent dans son agenda et le retire.
$icsAnnulation = [
    'uid' => 'soutenance-' . $soutenanceId,
    'method' => 'CANCEL',
    'summary' => "Soutenance PFE — {$soutenance['etudiant']}",
    'description' => "Soutenance de {$soutenance['etudiant']}" . (!empty($soutenance['titre_sujet']) ? " — {$soutenance['titre_sujet']}" : ''),
    'location' => $soutenance['salle'] ?? '',
];
if ($soutenance['date'] && $soutenance['heure']) {
    $paramsDuree = $pdo->query("SELECT duree_soutenance FROM parametres_creneaux ORDER BY id DESC LIMIT 1")->fetch();
    $dureeMinutes = $paramsDuree ? (int) $paramsDuree['duree_soutenance'] : 30;
    $dtStart = new DateTime($soutenance['date'] . ' ' . $soutenance['heure'], new DateTimeZone('Africa/Tunis'));
    $dtEnd = clone $dtStart;
    $dtEnd->modify("+{$dureeMinutes} minutes");
    $icsAnnulation['dtstart'] = $dtStart;
    $icsAnnulation['dtend'] = $dtEnd;
}

if ($ancienEnseignant) {
    $contenu = "<p>Bonjour {$ancienEnseignant['prenom']},</p>
        <p>Votre affectation comme <strong>$role</strong> pour la soutenance de <strong>{$soutenance['etudiant']}</strong>
        a été annulée par le chef de département.</p>
        <p>📅 L'événement correspondant a été retiré de votre agenda.</p>
        <p>Aucune action n'est requise de votre part.</p>";
    envoyerEmail($ancienEnseignant['email'], "{$ancienEnseignant['prenom']} {$ancienEnseignant['nom']}",
        'Affectation jury annulée', gabaritEmail('Affectation jury annulée', $contenu), $icsAnnulation);
}

if ($soutenance['encadrant_id']) {
    $stmtNotif->execute([$soutenance['encadrant_id'], 'warning', 'Membre du jury à remplacer',
        "Le $role de la soutenance de {$soutenance['etudiant']} a été annulé. Merci de choisir un remplaçant.", '/soutenances']);
}

ok(null, "Affectation $role annulée, la soutenance repasse en attente de validation");