<?php
/**
 * Suggère automatiquement un rapporteur et un président pour une soutenance,
 * en priorisant les enseignants les plus "sous-sollicités" au regard de la
 * règle de réciprocité (R9 : N étudiants encadrés = N fois rapporteur + N fois
 * président), et en excluant ceux qui sont déjà au maximum de leur capacité
 * ce jour-là (si une date est fournie).
 *
 * La suggestion reste indicative : l'utilisateur peut toujours la modifier
 * avant de valider la planification (aucune affectation n'est forcée ici).
 */
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$pdo = getDB();

$etudiantId = $_GET['etudiant_id'] ?? null;
$date = $_GET['date'] ?? null;
if (!$etudiantId) fail('Étudiant requis');

// Encadrant de cet étudiant (à exclure du jury — règle R2)
$stmt = $pdo->prepare("SELECT encadrant_id FROM etudiants WHERE id = ?");
$stmt->execute([$etudiantId]);
$etudiant = $stmt->fetch();
if (!$etudiant) fail('Étudiant introuvable', 404);
$encadrantId = $etudiant['encadrant_id'];

// Charge du jour, si une date est fournie (pour exclure les enseignants déjà au max)
$maxJour = null; $chargeParEnseignant = [];
if ($date) {
    $stmtJour = $pdo->prepare("SELECT max_soutenances FROM jours_calendrier WHERE date = ?");
    $stmtJour->execute([$date]);
    $jour = $stmtJour->fetch();
    $maxJour = $jour ? (int) $jour['max_soutenances'] : null;

    if ($maxJour) {
        $stmtCharge = $pdo->prepare("
            SELECT id, (
                (SELECT COUNT(*) FROM soutenances WHERE date = ? AND statut != 'refusee' AND encadrant_id = users.id)
                + (SELECT COUNT(*) FROM soutenances WHERE date = ? AND statut != 'refusee' AND rapporteur_id = users.id)
                + (SELECT COUNT(*) FROM soutenances WHERE date = ? AND statut != 'refusee' AND president_id = users.id)
            ) as charge_jour
            FROM users WHERE role IN ('encadrant','chef_dept','admin')
        ");
        $stmtCharge->execute([$date, $date, $date]);
        foreach ($stmtCharge->fetchAll() as $c) $chargeParEnseignant[$c['id']] = (int) $c['charge_jour'];
    }
}

// Tous les enseignants actifs avec leur objectif de réciprocité et leur charge réelle
$candidats = $pdo->query("
    SELECT u.id, u.nom, u.prenom, u.max_soutenances_jour,
        (SELECT COUNT(*) FROM etudiants WHERE encadrant_id = u.id) AS objectif,
        (SELECT COUNT(*) FROM invitations_jury WHERE enseignant_id = u.id AND role='rapporteur' AND statut='acceptee') AS nb_rap,
        (SELECT COUNT(*) FROM invitations_jury WHERE enseignant_id = u.id AND role='president' AND statut='acceptee') AS nb_pres
    FROM users u WHERE u.role IN ('encadrant','chef_dept','admin') AND u.is_active = 1
")->fetchAll();

$periodeMax = $pdo->query("SELECT max_par_jour FROM periode ORDER BY id DESC LIMIT 1")->fetch();
$maxParDefaut = $periodeMax ? (int) $periodeMax['max_par_jour'] : 5;

$eligibles = [];
foreach ($candidats as $c) {
    if ((int) $c['id'] === (int) $encadrantId) continue; // R2 : encadrant exclu

    if ($date && $maxJour) {
        $maxEffectif = $c['max_soutenances_jour'] !== null ? (int) $c['max_soutenances_jour'] : $maxParDefaut;
        $chargeActuelle = $chargeParEnseignant[$c['id']] ?? 0;
        if ($chargeActuelle >= $maxEffectif || $chargeActuelle >= $maxJour) continue; // capacité atteinte ce jour-là
    }

    $c['ecart_rap'] = (int) $c['objectif'] - (int) $c['nb_rap'];
    $c['ecart_pres'] = (int) $c['objectif'] - (int) $c['nb_pres'];
    $eligibles[] = $c;
}

// Classement : les plus sous-sollicités (écart le plus élevé) en tête
$parEcartRap = $eligibles;
usort($parEcartRap, fn($a, $b) => $b['ecart_rap'] <=> $a['ecart_rap']);
$parEcartPres = $eligibles;
usort($parEcartPres, fn($a, $b) => $b['ecart_pres'] <=> $a['ecart_pres']);

// Le rapporteur suggéré est le plus prioritaire pour ce rôle ; le président suggéré
// est le plus prioritaire pour l'autre rôle, en évitant de suggérer deux fois la même personne (R1).
$rapporteurSuggere = $parEcartRap[0] ?? null;
$presidentSuggere = null;
foreach ($parEcartPres as $c) {
    if (!$rapporteurSuggere || (int) $c['id'] !== (int) $rapporteurSuggere['id']) { $presidentSuggere = $c; break; }
}

$formatter = fn($c) => $c ? ['id' => $c['id'], 'nom' => $c['nom'], 'prenom' => $c['prenom'], 'ecart_rap' => $c['ecart_rap'], 'ecart_pres' => $c['ecart_pres']] : null;

ok([
    'rapporteur_suggere' => $formatter($rapporteurSuggere),
    'president_suggere' => $formatter($presidentSuggere),
    'candidats' => array_map($formatter, array_slice($eligibles, 0, 15)),
]);
