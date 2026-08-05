<?php
/**
 * Vue "mini-calendrier" de la charge jury par jour.
 * Pour chaque enseignant et chaque date de soutenance, calcule combien de fois
 * il est impliqué (encadrant + rapporteur + président confondus) ce jour-là,
 * comparé à son maximum journalier (personnalisé si défini, sinon celui du jour).
 *
 * Reproduit le principe du fichier Excel de suivi manuel utilisé auparavant.
 *
 * v1.12 : chaque jour est désormais scindé en "dans le département" / "hors
 * département" (participation inter-département), en comparant le département
 * de la soutenance à celui de l'enseignant. Le total par jour reste inchangé
 * (intra + hors), utilisé pour la comparaison au maximum journalier.
 */
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$pdo = getDB();

// ---- Liste des dates ayant des soutenances (planifiées ou validées) ----
$dates = array_column(
    $pdo->query("
        SELECT DISTINCT date FROM soutenances
        WHERE date IS NOT NULL AND statut IN ('planifiee', 'validee')
        ORDER BY date
    ")->fetchAll(),
    'date'
);

// ---- Liste des enseignants concernés ----
$filtre = $_GET['filtre'] ?? 'tous'; // 'mes_encadrants' | 'tous'

$sqlEns = "SELECT id, nom, prenom, departement_id, max_soutenances_jour FROM users WHERE role IN ('encadrant','chef_dept','admin') AND is_active = 1";
$paramsEns = [];
if ($auth['role'] === 'encadrant') {
    $sqlEns .= " AND id = ?";
    $paramsEns[] = $auth['id'];
} elseif ($filtre === 'mes_encadrants' && $auth['departement_id']) {
    $sqlEns .= " AND departement_id = ?";
    $paramsEns[] = $auth['departement_id'];
}
$sqlEns .= " ORDER BY nom, prenom";
$stmtEns = $pdo->prepare($sqlEns);
$stmtEns->execute($paramsEns);
$enseignants = $stmtEns->fetchAll();

// Département de chaque enseignant, pour déterminer intra/hors ensuite
$deptParEnseignant = [];
foreach ($enseignants as $e) {
    $deptParEnseignant[$e['id']] = $e['departement_id'];
}

// ---- Comptage : une ligne par (date, enseignant_id, departement_id de la soutenance) ----
// pour chacun des 3 rôles (encadrant, rapporteur, président)
$compteursIntra = []; // compteursIntra[enseignant_id][date] = nb
$compteursHors  = []; // compteursHors[enseignant_id][date] = nb
$sqlCompte = "
    SELECT date, encadrant_id AS ens_id, departement_id FROM soutenances WHERE statut IN ('planifiee','validee') AND date IS NOT NULL AND encadrant_id IS NOT NULL
    UNION ALL
    SELECT date, rapporteur_id AS ens_id, departement_id FROM soutenances WHERE statut IN ('planifiee','validee') AND date IS NOT NULL AND rapporteur_id IS NOT NULL
    UNION ALL
    SELECT date, president_id AS ens_id, departement_id FROM soutenances WHERE statut IN ('planifiee','validee') AND date IS NOT NULL AND president_id IS NOT NULL
";
foreach ($pdo->query($sqlCompte) as $row) {
    $ensId = $row['ens_id'];
    $date = $row['date'];
    $deptSoutenance = $row['departement_id'];
    $deptEns = $deptParEnseignant[$ensId] ?? null;

    if ($deptEns !== null && $deptSoutenance !== null && (int) $deptSoutenance === (int) $deptEns) {
        $compteursIntra[$ensId][$date] = ($compteursIntra[$ensId][$date] ?? 0) + 1;
    } else {
        $compteursHors[$ensId][$date] = ($compteursHors[$ensId][$date] ?? 0) + 1;
    }
}

// ---- Maximum par jour configuré au niveau du calendrier (jours_calendrier) ----
$maxParDate = [];
foreach ($pdo->query("SELECT date, max_soutenances FROM jours_calendrier") as $row) {
    $maxParDate[$row['date']] = (int) $row['max_soutenances'];
}

// ---- Construction de la matrice finale ----
$resultat = [];
foreach ($enseignants as $ens) {
    $maxPersonnalise = $ens['max_soutenances_jour'] !== null ? (int) $ens['max_soutenances_jour'] : null;

    $jours = [];
    $totalIntraGeneral = 0;
    $totalHorsGeneral = 0;
    foreach ($dates as $d) {
        $intra = $compteursIntra[$ens['id']][$d] ?? 0;
        $hors  = $compteursHors[$ens['id']][$d] ?? 0;
        $nb = $intra + $hors;
        $max = $maxPersonnalise ?? ($maxParDate[$d] ?? 5);
        $statut = 'normal';
        if ($nb > $max) $statut = 'depassement';
        elseif ($nb === $max && $max > 0) $statut = 'max_atteint';

        $jours[] = ['date' => $d, 'nb' => $nb, 'intra' => $intra, 'hors' => $hors, 'max' => $max, 'statut' => $statut];
        $totalIntraGeneral += $intra;
        $totalHorsGeneral += $hors;
    }

    $resultat[] = [
        'id' => $ens['id'],
        'nom' => $ens['nom'],
        'prenom' => $ens['prenom'],
        'max_personnalise' => $maxPersonnalise,
        'total' => $totalIntraGeneral + $totalHorsGeneral,
        'total_intra' => $totalIntraGeneral,
        'total_hors' => $totalHorsGeneral,
        'jours' => $jours,
    ];
}

ok(['dates' => $dates, 'enseignants' => $resultat]);