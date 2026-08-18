<?php
/**
 * Réponse à une invitation jury. L'enseignant concerné répond lui-même,
 * OU le chef de département peut répondre à sa place à tout moment
 * (cas où l'enseignant l'a contacté en dehors du système).
 *
 * v1.9 : on ne peut plus accepter une invitation si le poste (rapporteur ou
 * président) de la soutenance concernée est déjà occupé par un autre
 * enseignant — protège contre une double acceptation en cas de concurrence.
 */
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);

$d = body();
$id = $d['id'] ?? null;
$reponse = $d['reponse'] ?? null; // 'acceptee' | 'refusee'

if (!$id || !in_array($reponse, ['acceptee', 'refusee'])) fail('Paramètres invalides');

$pdo = getDB();
$stmt = $pdo->prepare("SELECT * FROM invitations_jury WHERE id = ?");
$stmt->execute([$id]);
$invitation = $stmt->fetch();
if (!$invitation) fail('Invitation introuvable', 404);

$estConcerne = (int) $auth['id'] === (int) $invitation['enseignant_id'];
$estChef = in_array($auth['role'], ['chef_dept', 'admin']);
if (!$estConcerne && !$estChef) fail('Action non autorisée', 403);

if ($invitation['statut'] !== 'en_attente') fail('Cette invitation a déjà été traitée ou a expiré');

// Vérifie que le poste n'a pas déjà été pourvu par quelqu'un d'autre entre-temps
if ($reponse === 'acceptee') {
    $colonneRole = $invitation['role'] === 'rapporteur' ? 'rapporteur_id' : 'president_id';
    $stmtSout = $pdo->prepare("SELECT $colonneRole as titulaire_id FROM soutenances WHERE id = ?");
    $stmtSout->execute([$invitation['soutenance_id']]);
    $sout = $stmtSout->fetch();

    if ($sout && $sout['titulaire_id'] && (int) $sout['titulaire_id'] !== (int) $invitation['enseignant_id']) {
        fail('Ce poste a déjà été pourvu par un autre enseignant entre-temps.', 409);
    }
}

$validePar = $estChef && !$estConcerne ? $auth['id'] : null;
$pdo->prepare("UPDATE invitations_jury SET statut = ?, date_reponse = NOW(), validee_par = ? WHERE id = ?")
    ->execute([$reponse, $validePar, $id]);

// v1.15 : à l'acceptation, on envoie automatiquement l'invitation calendrier
// (.ics) à l'enseignant pour que la soutenance apparaisse directement dans son
// agenda (Outlook / Google Calendar), sans attendre un envoi manuel.
if ($reponse === 'acceptee') {
    require_once __DIR__ . '/../../config/mailer.php';
    $roleLabel = $invitation['role'] === 'rapporteur' ? 'rapporteur' : 'président';
    envoyerAgendaSoutenance($pdo, (int) $invitation['soutenance_id'], (int) $invitation['enseignant_id'], $roleLabel);
}

$msg = $reponse === 'acceptee' ? 'Invitation acceptée' : 'Invitation refusée';
if ($validePar) $msg .= ' (au nom de l\'enseignant, par le chef de département)';

ok(null, $msg);