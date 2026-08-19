<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/soutenance_etudiants.php';

$auth = requireRole(['admin', 'chef_dept']);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);

$d = body();
$soutenanceId = (int) ($d['soutenance_id'] ?? 0);
$etudiant2Id = $d['etudiant2_id'] !== null && $d['etudiant2_id'] !== '' ? (int) $d['etudiant2_id'] : null;
if (!$soutenanceId) fail('ID soutenance manquant');

$pdo = getDB();

$stmt = $pdo->prepare("SELECT * FROM soutenances WHERE id = ?");
$stmt->execute([$soutenanceId]);
$soutenance = $stmt->fetch();
if (!$soutenance) fail('Soutenance introuvable', 404);

$principalId = (int) $soutenance['etudiant_id'];

if ($etudiant2Id) {
    if ($etudiant2Id === $principalId) {
        fail("Le 2e étudiant doit être différent de l'étudiant principal", 400);
    }

    // Même option (spécialité) que l'étudiant principal
    $stmtOpt = $pdo->prepare("SELECT e1.option_id FROM etudiants e1 WHERE e1.id = ?");
    $stmtOpt->execute([$principalId]);
    $optionPrincipal = $stmtOpt->fetchColumn();

    $stmtOpt2 = $pdo->prepare("SELECT id, option_id FROM etudiants WHERE id = ?");
    $stmtOpt2->execute([$etudiant2Id]);
    $etudiant2 = $stmtOpt2->fetch();
    if (!$etudiant2) fail('Étudiant introuvable', 404);

    if ($optionPrincipal && (int) $etudiant2['option_id'] !== (int) $optionPrincipal) {
        fail("Les étudiants d'un binôme doivent appartenir à la même spécialité", 400);
    }

    // Pas de soutenance existante pour ce 2e étudiant (planifiée/validée/refusée)
    $idsExistant = soutenancesPourEtudiants($pdo, [$etudiant2Id]);
    if ($idsExistant) {
        $ph = implode(',', array_fill(0, count($idsExistant), '?'));
        $stmtChk = $pdo->prepare("SELECT id FROM soutenances WHERE id IN ($ph) AND id != ? AND statut != 'sans_date'");
        $stmtChk->execute(array_merge($idsExistant, [$soutenanceId]));
        if ($stmtChk->fetch()) {
            fail("Cet étudiant a déjà une soutenance planifiée, validée ou refusée", 409);
        }
    }

    // Un chef de département ne peut associer qu'un étudiant de son propre département
    if ($auth['role'] === 'chef_dept') {
        $stmtDept = $pdo->prepare("SELECT o.departement_id FROM etudiants e LEFT JOIN options o ON e.option_id = o.id WHERE e.id = ?");
        $stmtDept->execute([$etudiant2Id]);
        if ((int) $stmtDept->fetchColumn() !== (int) $auth['departement_id']) {
            fail("Cet étudiant n'appartient pas à votre département", 403);
        }
    }
}

$pdo->prepare("UPDATE soutenances SET etudiant2_id = ? WHERE id = ?")->execute([$etudiant2Id, $soutenanceId]);

$membres = $etudiant2Id ? [$principalId, $etudiant2Id] : [$principalId];
remplacerMembresSoutenance($pdo, $soutenanceId, $membres);

ok(['soutenance_id' => $soutenanceId, 'etudiant2_id' => $etudiant2Id],
    $etudiant2Id ? 'Binôme mis à jour' : 'Binôme retiré');