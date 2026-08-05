<?php
/**
 * Invitation PROACTIVE : l'admin ou le chef de département invite un enseignant
 * (de son propre département ou d'un AUTRE département) à participer aux
 * soutenances en tant que rapporteur/président. C'est le flux inverse de
 * demande-participation.php (où c'est l'enseignant qui sollicite un département).
 * L'invitation doit être acceptée par l'enseignant invité lui-même.
 *
 * v1.8 : le nombre de fois envisagé est désormais scindé par rôle
 * (nombre_rapporteur / nombre_president) au lieu d'un seul champ
 * nombre_souhaite générique.
 */
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/mailer.php';

$auth = requireRole(['chef_dept', 'admin']);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);

$d = body();
$enseignantId = $d['enseignant_id'] ?? null;
$roleSouhaite = $d['role_souhaite'] ?? null;
$nombreRapporteur = (int) ($d['nombre_rapporteur'] ?? 0);
$nombrePresident  = (int) ($d['nombre_president'] ?? 0);
// Le chef de département invite toujours pour SON PROPRE département ;
// l'admin peut choisir n'importe quel département cible.
$departementCibleId = $auth['role'] === 'admin' ? ($d['departement_id'] ?? $auth['departement_id']) : $auth['departement_id'];

if (!$enseignantId || !$roleSouhaite || !$departementCibleId || ($nombreRapporteur < 1 && $nombrePresident < 1)) {
    fail('Paramètres invalides');
}

$pdo = getDB();

$stmtEns = $pdo->prepare("SELECT email, prenom, nom, departement_id FROM users WHERE id = ? AND role IN ('encadrant','chef_dept','admin') AND is_active = 1");
$stmtEns->execute([$enseignantId]);
$enseignant = $stmtEns->fetch();
if (!$enseignant) fail('Enseignant introuvable', 404);

$stmtDept = $pdo->prepare("SELECT nom FROM departements WHERE id = ?");
$stmtDept->execute([$departementCibleId]);
$departement = $stmtDept->fetch();
if (!$departement) fail('Département introuvable', 404);

// Délai d'expiration configurable par l'admin (parametres_notifications.delai_expiration_participation_jours)
$params = $pdo->query("SELECT delai_expiration_participation_jours FROM parametres_notifications ORDER BY id DESC LIMIT 1")->fetch();
$delaiJours = $params ? (int) $params['delai_expiration_participation_jours'] : 5;
$dateLimite = date('Y-m-d H:i:s', strtotime("+$delaiJours days"));

$stmt = $pdo->prepare("INSERT INTO demandes_participation (enseignant_id, initiateur, departement_cible_id, role_souhaite, nombre_rapporteur, nombre_president, date_limite, statut) VALUES (?, 'departement', ?, ?, ?, ?, ?, 'en_attente')");
$stmt->execute([$enseignantId, $departementCibleId, $roleSouhaite, $nombreRapporteur, $nombrePresident, $dateLimite]);
$invitationId = $pdo->lastInsertId();

$roleLabel = ['rapporteur' => 'rapporteur', 'president' => 'président', 'les_deux' => 'rapporteur et président'][$roleSouhaite] ?? $roleSouhaite;

$detailFois = [];
if ($nombreRapporteur > 0) $detailFois[] = "$nombreRapporteur fois comme rapporteur";
if ($nombrePresident > 0) $detailFois[] = "$nombrePresident fois comme président";
$detailFoisTxt = implode(' et ', $detailFois);

$pdo->prepare("INSERT INTO notifications (user_id, type, titre, message, lien) VALUES (?,?,?,?,?)")
    ->execute([$enseignantId, 'info', 'Invitation à participer', "Le département « {$departement['nom']} » vous invite à participer comme $roleLabel", '/participation']);

$contenu = "<p>Bonjour {$enseignant['prenom']},</p>
    <p>Le département <strong>{$departement['nom']}</strong> vous invite à participer à ses soutenances
    en tant que <strong>$roleLabel</strong> (environ $detailFoisTxt).</p>
    <p>Merci de vous connecter à la plateforme, rubrique « Participation inter-département »,
    pour accepter ou refuser cette invitation avant le " . date('d/m/Y', strtotime($dateLimite)) . ".</p>";
envoyerEmail($enseignant['email'], "{$enseignant['prenom']} {$enseignant['nom']}",
    "Invitation à participer — {$departement['nom']}", gabaritEmail('Invitation à participer', $contenu));

ok(['id' => $invitationId], 'Invitation envoyée à l\'enseignant', 201);