<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/mailer.php';

$auth = requireRole(['chef_dept', 'admin']);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);

$d = body();
$id = $d['id'] ?? null;
$decision = $d['decision'] ?? null; // 'validee' | 'refusee'
$motif = $d['motif'] ?? null;

if (!$id || !in_array($decision, ['validee', 'refusee'])) fail('Paramètres invalides');

$pdo = getDB();

$check = $pdo->prepare("SELECT statut, departement_id FROM soutenances WHERE id = ?");
$check->execute([$id]);
$current = $check->fetch();
if (!$current) fail('Soutenance introuvable', 404);
if ($current['statut'] !== 'planifiee') fail("Cette soutenance n'est pas en attente de validation (statut actuel : {$current['statut']})");
if ($auth['role'] === 'chef_dept' && (int) $current['departement_id'] !== (int) $auth['departement_id']) {
    fail("Cette soutenance appartient à un autre département", 403);
}

$stmt = $pdo->prepare("UPDATE soutenances SET statut = ?, motif_refus = ? WHERE id = ?");
$stmt->execute([$decision, $decision === 'refusee' ? $motif : null, $id]);

// Récupération infos pour notification à l'encadrant
$stmt = $pdo->prepare("SELECT s.*, CONCAT(e.prenom,' ',e.nom) as etudiant, CONCAT(e2.prenom,' ',e2.nom) as etudiant2, u.id as encadrant_id, u.email as encadrant_email, u.prenom as encadrant_prenom, u.nom as encadrant_nom
    FROM soutenances s
    JOIN etudiants e ON s.etudiant_id = e.id
    LEFT JOIN etudiants e2 ON s.etudiant2_id = e2.id
    JOIN users u ON s.encadrant_id = u.id WHERE s.id = ?");
$stmt->execute([$id]);
$sout = $stmt->fetch();

if ($sout) {
    $etudiantNom = $sout['etudiant2'] ? "{$sout['etudiant']} & {$sout['etudiant2']}" : $sout['etudiant'];
    $msg = $decision === 'validee'
        ? "La soutenance de $etudiantNom a été validée."
        : "La soutenance de $etudiantNom a été refusée." . ($motif ? " Motif : $motif" : '');
    $pdo->prepare("INSERT INTO notifications (user_id, type, titre, message, lien) VALUES (?,?,?,?,?)")
        ->execute([$sout['encadrant_id'], $decision === 'validee' ? 'success' : 'error', 'Soutenance ' . $decision, $msg, '/soutenances']);

    $contenu = $decision === 'validee'
        ? "<p>Bonjour {$sout['encadrant_prenom']},</p><p>La soutenance de <strong>$etudiantNom</strong> a été <strong style='color:#166534;'>validée</strong> par le chef de département.</p>"
        : "<p>Bonjour {$sout['encadrant_prenom']},</p><p>La soutenance de <strong>$etudiantNom</strong> a été <strong style='color:#991b1b;'>refusée</strong> par le chef de département." . ($motif ? " <br><strong>Motif :</strong> " . htmlspecialchars($motif) : '') . "</p><p>Merci de vous connecter à la plateforme pour ajuster la planification si nécessaire.</p>";

    envoyerEmail($sout['encadrant_email'], "{$sout['encadrant_prenom']} {$sout['encadrant_nom']}",
        $decision === 'validee' ? 'Soutenance validée' : 'Soutenance refusée',
        gabaritEmail('Soutenance ' . ($decision === 'validee' ? 'validée' : 'refusée'), $contenu));
}

ok(null, 'Décision enregistrée');
