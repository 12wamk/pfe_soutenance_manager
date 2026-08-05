<?php
/**
 * R6 — Validation manuelle d'une invitation expirée, par l'enseignant concerné
 * ou par le chef de département (cas où l'enseignant n'a pas eu accès à temps).
 *
 * v1.9 : on ne peut plus "lever l'expiration" vers une acceptation si le poste
 * (rapporteur ou président) de la soutenance concernée est déjà occupé par un
 * autre enseignant — ex. le chef a entre-temps réaffecté le jury pendant que
 * l'invitation était expirée.
 */
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);

$d = body();
$id = $d['id'] ?? null;
$nouvelleReponse = $d['reponse'] ?? 'acceptee'; // l'expiration peut être levée vers accepté ou refusé explicitement
if (!$id) fail('ID manquant');

$pdo = getDB();
$stmt = $pdo->prepare("SELECT * FROM invitations_jury WHERE id = ?");
$stmt->execute([$id]);
$invitation = $stmt->fetch();
if (!$invitation) fail('Invitation introuvable', 404);
if ($invitation['statut'] !== 'expiree') fail("Cette invitation n'est pas en état expiré");

// Seul l'enseignant concerné ou un chef_dept/admin peut valider manuellement
if ($auth['id'] != $invitation['enseignant_id'] && !in_array($auth['role'], ['chef_dept', 'admin'])) {
    fail('Action non autorisée', 403);
}

// Vérifie que le poste n'a pas déjà été pourvu par quelqu'un d'autre entre-temps
if ($nouvelleReponse === 'acceptee') {
    $colonneRole = $invitation['role'] === 'rapporteur' ? 'rapporteur_id' : 'president_id';
    $stmtSout = $pdo->prepare("SELECT $colonneRole as titulaire_id FROM soutenances WHERE id = ?");
    $stmtSout->execute([$invitation['soutenance_id']]);
    $sout = $stmtSout->fetch();

    if ($sout && $sout['titulaire_id'] && (int) $sout['titulaire_id'] !== (int) $invitation['enseignant_id']) {
        fail('Ce poste a déjà été pourvu par un autre enseignant entre-temps. Impossible de lever l\'expiration.', 409);
    }
}

$pdo->prepare("UPDATE invitations_jury SET statut = ?, date_reponse = NOW(), validee_par = ? WHERE id = ?")
    ->execute([$nouvelleReponse, $auth['id'], $id]);

ok(null, 'Expiration levée manuellement, invitation marquée comme ' . $nouvelleReponse);