<?php
/**
 * Annule complètement une soutenance planifiée : elle repasse "sans_date".
 *
 * v1.14 : envoie une annulation calendrier (.ics, METHOD:CANCEL) au rapporteur
 * et au président s'ils étaient affectés — même uid 'soutenance-{id}' que
 * l'invitation d'origine, pour retirer l'événement de leur agenda.
 */
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/mailer.php';

$auth = requireRole(['chef_dept', 'admin']);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);

$d = body();
$soutenanceId = $d['soutenance_id'] ?? null;
if (!$soutenanceId) fail('ID manquant');

$pdo = getDB();
$stmt = $pdo->prepare("SELECT s.*, CONCAT(e.prenom,' ',e.nom) as etudiant, CONCAT(e2.prenom,' ',e2.nom) as etudiant2, e.titre_sujet
    FROM soutenances s
    JOIN etudiants e ON s.etudiant_id = e.id
    LEFT JOIN etudiants e2 ON s.etudiant2_id = e2.id
    WHERE s.id = ?");
$stmt->execute([$soutenanceId]);
$soutenance = $stmt->fetch();
if (!$soutenance) fail('Soutenance introuvable', 404);

$etudiantNom = $soutenance['etudiant2'] ? "{$soutenance['etudiant']} & {$soutenance['etudiant2']}" : $soutenance['etudiant'];

// ---- Prépare l'annulation calendrier AVANT de vider les colonnes (on a encore besoin
// de date/heure/salle pour construire un .ics cohérent avec l'invitation d'origine) ----
$icsAnnulationBase = [
    'uid' => 'soutenance-' . $soutenanceId,
    'method' => 'CANCEL',
    'summary' => "Soutenance PFE — $etudiantNom",
    'description' => "Soutenance de $etudiantNom" . (!empty($soutenance['titre_sujet']) ? " — {$soutenance['titre_sujet']}" : ''),
    'location' => $soutenance['salle'] ?? '',
];
if ($soutenance['date'] && $soutenance['heure']) {
    $paramsDuree = $pdo->query("SELECT duree_soutenance FROM parametres_creneaux ORDER BY id DESC LIMIT 1")->fetch();
    $dureeMinutes = $paramsDuree ? (int) $paramsDuree['duree_soutenance'] : 30;
    $dtStart = new DateTime($soutenance['date'] . ' ' . $soutenance['heure'], new DateTimeZone('Africa/Tunis'));
    $dtEnd = clone $dtStart;
    $dtEnd->modify("+{$dureeMinutes} minutes");
    $icsAnnulationBase['dtstart'] = $dtStart;
    $icsAnnulationBase['dtend'] = $dtEnd;
}

$pdo->prepare("UPDATE soutenances SET date=NULL, heure=NULL, salle=NULL, rapporteur_id=NULL, president_id=NULL, statut='sans_date', motif_refus=NULL WHERE id = ?")
    ->execute([$soutenanceId]);
$pdo->prepare("DELETE FROM invitations_jury WHERE soutenance_id = ? AND statut = 'en_attente'")->execute([$soutenanceId]);

// Binôme : supprime l'éventuelle soutenance "sans_date" orpheline du partenaire
// (ligne distincte propre au 2e étudiant, pour éviter qu'il ait deux lignes)
if (!empty($soutenance['etudiant2_id'])) {
    $stmtOrphelin = $pdo->prepare("SELECT id FROM soutenances WHERE id != ? AND statut = 'sans_date'
        AND (etudiant_id = ? OR id IN (SELECT se.soutenance_id FROM soutenance_etudiants se WHERE se.etudiant_id = ?))");
    $stmtOrphelin->execute([$soutenanceId, $soutenance['etudiant2_id'], $soutenance['etudiant2_id']]);
    $orphelins = $stmtOrphelin->fetchAll();
    if ($orphelins) {
        $ids = array_column($orphelins, 'id');
        $pdo->prepare("DELETE FROM soutenances WHERE id IN (" . implode(',', $ids) . ") AND statut = 'sans_date'")->execute();
    }
}

if ($soutenance['encadrant_id']) {
    $pdo->prepare("INSERT INTO notifications (user_id, type, titre, message, lien) VALUES (?,?,?,?,?)")
        ->execute([$soutenance['encadrant_id'], 'error', 'Soutenance annulée',
            "La soutenance de $etudiantNom a été annulée par le chef de département. Merci de la replanifier.", '/soutenances']);
}

$stmtEns = $pdo->prepare("SELECT email, prenom, nom FROM users WHERE id = ?");
foreach ([['id' => $soutenance['rapporteur_id'], 'role' => 'rapporteur'], ['id' => $soutenance['president_id'], 'role' => 'président']] as $membre) {
    if (!$membre['id']) continue;

    $pdo->prepare("INSERT INTO notifications (user_id, type, titre, message, lien) VALUES (?,?,?,?,?)")
        ->execute([$membre['id'], 'error', 'Soutenance annulée', "La soutenance de $etudiantNom à laquelle vous étiez affecté a été annulée.", '/mon-planning']);

    $stmtEns->execute([$membre['id']]);
    $ens = $stmtEns->fetch();
    if (!$ens) continue;

    $contenu = "<p>Bonjour {$ens['prenom']},</p>
        <p>La soutenance de <strong>$etudiantNom</strong> à laquelle vous étiez affecté comme <strong>{$membre['role']}</strong> a été annulée par le chef de département.</p>
        <p>📅 L'événement correspondant a été retiré de votre agenda.</p>";
    envoyerEmail($ens['email'], "{$ens['prenom']} {$ens['nom']}", 'Soutenance annulée',
        gabaritEmail('Soutenance annulée', $contenu), $icsAnnulationBase);
}

ok(null, 'Soutenance annulée, elle repasse "sans date"');