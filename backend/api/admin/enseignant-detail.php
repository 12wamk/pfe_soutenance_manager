<?php
/**
 * Détail complet d'un enseignant précis : ses statistiques de réciprocité,
 * sa répartition dans/hors département, sa charge, ET la liste de ses
 * soutenances (tous rôles confondus). Affiché au clic sur une ligne de la
 * page Enseignants.
 *
 * v1.7 : nb_rapporteur / nb_president = compteur automatique (table
 * soutenances) + ajustement manuel admin (colonnes ajustement_rapporteur /
 * ajustement_president sur users). Voir /api/jury/ajustement-reciprocite.php
 * et /api/jury/charge.php (même principe, appliqué ici aussi).
 */
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$pdo = getDB();

$id = $_GET['id'] ?? null;
if (!$id) fail('ID enseignant manquant');

// Sécurité : un chef_dept ne doit voir le détail que d'un enseignant de son propre département
if ($auth['role'] === 'chef_dept') {
    $stmt = $pdo->prepare("SELECT departement_id FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $cible = $stmt->fetch();
    if (!$cible || (int) $cible['departement_id'] !== (int) $auth['departement_id']) {
        fail('Accès non autorisé à cet enseignant', 403);
    }
}

// Sécurité : un encadrant ne peut voir le détail que de ses propres données
if ($auth['role'] === 'encadrant') {
    if ((int) $id !== (int) $auth['id']) {
        fail('Accès non autorisé à cet enseignant', 403);
    }
}

$stmtInfo = $pdo->prepare("SELECT id, nom, prenom, email, role, departement_id, max_soutenances_jour, ajustement_rapporteur, ajustement_president FROM users WHERE id = ?");
$stmtInfo->execute([$id]);
$info = $stmtInfo->fetch();
if (!$info) fail('Enseignant introuvable', 404);

$ajustementRapporteur = (int) $info['ajustement_rapporteur'];
$ajustementPresident  = (int) $info['ajustement_president'];

// ---- Statistiques : compte des rôles (auto, avant ajustement) ----
$stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE encadrant_id = ? AND statut != 'refusee'");
$stmt->execute([$id]);
$nb_encadrant = (int) $stmt->fetch()['c'];

$stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE president_id = ? AND statut != 'refusee'");
$stmt->execute([$id]);
$nb_president_auto = (int) $stmt->fetch()['c'];

$stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE rapporteur_id = ? AND statut != 'refusee'");
$stmt->execute([$id]);
$nb_rapporteur_auto = (int) $stmt->fetch()['c'];

// Totaux finaux = auto + ajustement manuel
$nb_rapporteur = $nb_rapporteur_auto + $ajustementRapporteur;
$nb_president  = $nb_president_auto  + $ajustementPresident;

// ---- Réciprocité : objectif = nombre d'étudiants encadrés ----
$stmt = $pdo->prepare("SELECT COUNT(*) c FROM etudiants WHERE encadrant_id = ?");
$stmt->execute([$id]);
$objectif = (int) $stmt->fetch()['c'];

$reciprocite = [
    'objectif' => $objectif,
    'nb_rapporteur' => $nb_rapporteur,
    'nb_president' => $nb_president,
    'ajustement_rapporteur' => $ajustementRapporteur,
    'ajustement_president' => $ajustementPresident,
    'ecart_rapporteur' => $objectif - $nb_rapporteur,
    'ecart_president' => $objectif - $nb_president,
];

// ---- Dans / hors département ----
if ($info['departement_id']) {
    $stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE statut != 'refusee' AND departement_id = ? AND (encadrant_id=? OR rapporteur_id=? OR president_id=?)");
    $stmt->execute([$info['departement_id'], $id, $id, $id]);
    $nb_dans_departement = (int) $stmt->fetch()['c'];

    $stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE statut != 'refusee' AND (departement_id != ? OR departement_id IS NULL) AND (encadrant_id=? OR rapporteur_id=? OR president_id=?)");
    $stmt->execute([$info['departement_id'], $id, $id, $id]);
    $nb_hors_departement = (int) $stmt->fetch()['c'];
} else {
    $nb_dans_departement = 0;
    $stmt = $pdo->prepare("SELECT COUNT(*) c FROM soutenances WHERE statut != 'refusee' AND (encadrant_id=? OR rapporteur_id=? OR president_id=?)");
    $stmt->execute([$id, $id, $id]);
    $nb_hors_departement = (int) $stmt->fetch()['c'];
}

// ---- Charge / capacité ----
// Note : la charge/capacité journalière (basée sur nb_encadrant/nb_president/nb_rapporteur
// "auto") reste volontairement non affectée par l'ajustement manuel de réciprocité,
// qui ne corrige que le compteur affiché sur les statuts rapporteur/président, pas
// le nombre réel de soutenances physiquement assignées à l'enseignant.
if ($info['max_soutenances_jour'] !== null) {
    $max_effectif = (int) $info['max_soutenances_jour'];
} else {
    $periode = $pdo->query("SELECT max_par_jour FROM periode ORDER BY id DESC LIMIT 1")->fetch();
    $max_effectif = $periode ? (int) $periode['max_par_jour'] : 5;
}
$charge_totale = $nb_encadrant + $nb_president_auto + $nb_rapporteur_auto;

$charge = [
    'nb_encadrant' => $nb_encadrant,
    'nb_president' => $nb_president_auto,
    'nb_rapporteur' => $nb_rapporteur_auto,
    'total' => $charge_totale,
    'total_x3' => $charge_totale * 3,
    'nb_dans_departement' => $nb_dans_departement,
    'nb_hors_departement' => $nb_hors_departement,
    'max_effectif' => $max_effectif,
    'capacite_restante' => max(0, $max_effectif - $charge_totale),
];

// ---- Liste détaillée des soutenances (tous rôles) ----
$stmt = $pdo->prepare("
    SELECT s.id, s.date, s.heure, s.salle, s.statut,
           CONCAT(e.prenom,' ',e.nom) as etudiant, e.titre_sujet,
           CASE
               WHEN s.encadrant_id = ? THEN 'encadrant'
               WHEN s.rapporteur_id = ? THEN 'rapporteur'
               WHEN s.president_id = ? THEN 'president'
           END as role_joue
    FROM soutenances s
    JOIN etudiants e ON s.etudiant_id = e.id
    WHERE (s.encadrant_id = ? OR s.rapporteur_id = ? OR s.president_id = ?)
    AND s.statut != 'refusee'
    ORDER BY s.date IS NULL, s.date DESC, s.heure DESC
");
$stmt->execute([$id, $id, $id, $id, $id, $id]);
$soutenances = $stmt->fetchAll();

ok([
    'enseignant' => $info,
    'reciprocite' => $reciprocite,
    'charge' => $charge,
    'soutenances' => $soutenances,
    'total' => count($soutenances),
]);