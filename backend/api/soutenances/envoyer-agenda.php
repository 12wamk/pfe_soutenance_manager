<?php
/**
 * Envoi manuel d'une invitation calendrier (.ics) à UN SEUL membre du jury
 * (rapporteur ou président) d'une soutenance déjà planifiée — sans rien modifier
 * en base. Utile quand l'enseignant n'a pas reçu ou a perdu l'email d'origine,
 * ou simplement pour renvoyer l'événement à l'agenda à la demande.
 *
 * Ne s'applique qu'aux soutenances avec une date ET une heure définies
 * (impossible de générer un événement calendrier sans horaire).
 */
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/mailer.php';

$auth = requireRole(['encadrant', 'admin', 'chef_dept']);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);

$d = body();
$soutenanceId = $d['soutenance_id'] ?? null;
$role = $d['role'] ?? null; // 'rapporteur' | 'president'

if (!$soutenanceId || !in_array($role, ['rapporteur', 'president'])) fail('Paramètres invalides');

$pdo = getDB();
$stmt = $pdo->prepare("
    SELECT s.*, CONCAT(e.prenom,' ',e.nom) as etudiant, e.titre_sujet
    FROM soutenances s
    JOIN etudiants e ON s.etudiant_id = e.id
    WHERE s.id = ?
");
$stmt->execute([$soutenanceId]);
$soutenance = $stmt->fetch();
if (!$soutenance) fail('Soutenance introuvable', 404);

// Un encadrant ne peut envoyer l'agenda que pour ses propres soutenances
if ($auth['role'] === 'encadrant' && (int) $soutenance['encadrant_id'] !== (int) $auth['id']) {
    fail("Vous ne pouvez envoyer l'agenda que pour vos propres soutenances", 403);
}
// Un chef de département reste limité à son propre département
if ($auth['role'] === 'chef_dept' && (int) $soutenance['departement_id'] !== (int) $auth['departement_id']) {
    fail("Cette soutenance ne relève pas de votre département", 403);
}

if (!$soutenance['date'] || !$soutenance['heure']) {
    fail("Cette soutenance n'a pas encore de date/heure — impossible de générer un événement calendrier");
}

$champ = $role === 'rapporteur' ? 'rapporteur_id' : 'president_id';
$enseignantId = $soutenance[$champ];
if (!$enseignantId) fail("Aucun " . ($role === 'rapporteur' ? 'rapporteur' : 'président') . " n'est affecté à cette soutenance");

$stmtEns = $pdo->prepare("SELECT email, prenom, nom FROM users WHERE id = ?");
$stmtEns->execute([$enseignantId]);
$enseignant = $stmtEns->fetch();
if (!$enseignant) fail('Enseignant introuvable', 404);

$paramsDuree = $pdo->query("SELECT duree_soutenance FROM parametres_creneaux ORDER BY id DESC LIMIT 1")->fetch();
$dureeMinutes = $paramsDuree ? (int) $paramsDuree['duree_soutenance'] : 30;

$dtStart = new DateTime($soutenance['date'] . ' ' . $soutenance['heure'], new DateTimeZone('Africa/Tunis'));
$dtEnd = clone $dtStart;
$dtEnd->modify("+{$dureeMinutes} minutes");

// Même uid que l'invitation d'origine ('soutenance-{id}') : le client mail de
// l'enseignant met à jour son événement existant plutôt que d'en créer un doublon.
$icsInfo = [
    'uid' => 'soutenance-' . $soutenanceId,
    'method' => 'REQUEST',
    'dtstart' => $dtStart,
    'dtend' => $dtEnd,
    'summary' => "Soutenance PFE — {$soutenance['etudiant']}",
    'description' => "Soutenance de {$soutenance['etudiant']}" . (!empty($soutenance['titre_sujet']) ? " — {$soutenance['titre_sujet']}" : ''),
    'location' => $soutenance['salle'] ?? '',
];

$roleLabel = $role === 'rapporteur' ? 'rapporteur' : 'président';
$contenu = "<p>Bonjour {$enseignant['prenom']},</p>
    <p>Rappel : vous êtes désigné <strong>$roleLabel</strong> pour la soutenance de <strong>{$soutenance['etudiant']}</strong>"
    . (!empty($soutenance['titre_sujet']) ? " (\"{$soutenance['titre_sujet']}\")" : '') . ".</p>"
    . "<p><strong>Date :</strong> " . date('d/m/Y', strtotime($soutenance['date'])) . " à " . substr($soutenance['heure'], 0, 5) . "</p>"
    . "<p>📅 Un événement a été joint à cet email pour l'ajouter directement à votre agenda.</p>";

$ok = envoyerEmail($enseignant['email'], "{$enseignant['prenom']} {$enseignant['nom']}",
    'Rappel — Invitation au jury de soutenance', gabaritEmail('Rappel de soutenance', $contenu), $icsInfo);

if (!$ok) fail("Échec de l'envoi de l'email", 500);

ok(null, "Invitation calendrier envoyée à {$enseignant['prenom']} {$enseignant['nom']}");
