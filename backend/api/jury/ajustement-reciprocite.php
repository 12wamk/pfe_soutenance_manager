<?php
/**
 * Ajustement manuel de la réciprocité jury (admin uniquement).
 * Permet de corriger le nombre de "fois rapporteur" / "fois président"
 * en plus du comptage automatique, sans toucher aux invitations réelles.
 * On applique un delta (+1, -1, +2, ...) plutôt qu'une valeur absolue,
 * pour éviter d'écraser accidentellement un ajustement déjà en place.
 *
 * À placer dans : backend/api/jury/ajustement-reciprocite.php
 *
 * ⚠️ Vérifier le nom exact de la fonction d'erreur utilisée dans le
 * reste du projet (ok() existe dans charge.php — la fonction "erreur()"
 * ci-dessous est une supposition, à adapter si le projet utilise un
 * autre nom, ex: error() ou fail()).
 */
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
if ($auth['role'] !== 'admin') {
    erreur('Accès réservé à l\'administrateur.', 403);
}

$pdo = getDB();
$body = json_decode(file_get_contents('php://input'), true) ?: [];

$enseignantId = (int) ($body['enseignant_id'] ?? 0);
$role         = $body['role'] ?? '';
$delta        = (int) ($body['delta'] ?? 0);
$motif        = trim($body['motif'] ?? '');

if (!$enseignantId || !in_array($role, ['rapporteur', 'president'], true) || $delta === 0) {
    erreur('Paramètres invalides.', 400);
}

$colonne = $role === 'rapporteur' ? 'ajustement_rapporteur' : 'ajustement_president';

$stmt = $pdo->prepare("SELECT $colonne AS val FROM users WHERE id = ?");
$stmt->execute([$enseignantId]);
$row = $stmt->fetch();
if (!$row) {
    erreur('Enseignant introuvable.', 404);
}

$avant = (int) $row['val'];
$apres = $avant + $delta;

$pdo->beginTransaction();
$pdo->prepare("UPDATE users SET $colonne = ? WHERE id = ?")->execute([$apres, $enseignantId]);
$pdo->prepare("
    INSERT INTO ajustements_reciprocite_log (enseignant_id, role, valeur_avant, valeur_apres, delta, motif, modifie_par)
    VALUES (?, ?, ?, ?, ?, ?, ?)
")->execute([$enseignantId, $role, $avant, $apres, $delta, $motif ?: null, $auth['id']]);
$pdo->commit();

ok(['enseignant_id' => $enseignantId, 'role' => $role, 'ajustement' => $apres]);
