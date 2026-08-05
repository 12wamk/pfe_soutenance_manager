<?php
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$pdo = getDB();

// Département effectif à filtrer : le chef est toujours scopé à son département ;
// l'admin peut choisir via le sélecteur (?departement_id=X), sinon vue globale.
$deptFiltre = null;
if ($auth['role'] === 'chef_dept') $deptFiltre = $auth['departement_id'];
elseif ($auth['role'] === 'admin' && !empty($_GET['departement_id'])) $deptFiltre = $_GET['departement_id'];

function condDept($colonne, $deptFiltre, &$params) {
    if (!$deptFiltre) return '';
    $params[] = $deptFiltre;
    return " AND $colonne = ?";
}

$stats = [];

$p = [];
$sqlEt = "SELECT COUNT(*) c FROM etudiants e LEFT JOIN options o ON e.option_id = o.id WHERE 1=1" . condDept('o.departement_id', $deptFiltre, $p);
$stmt = $pdo->prepare($sqlEt); $stmt->execute($p);
$stats['total_etudiants'] = (int) $stmt->fetch()['c'];

$p = [];
$sqlEns = "SELECT COUNT(*) c FROM users WHERE role IN ('admin','chef_dept','encadrant')" . condDept('departement_id', $deptFiltre, $p);
$stmt = $pdo->prepare($sqlEns); $stmt->execute($p);
$stats['total_enseignants'] = (int) $stmt->fetch()['c'];

$p = [];
$sqlSout = "SELECT COUNT(*) c FROM soutenances WHERE 1=1" . condDept('departement_id', $deptFiltre, $p);
$stmt = $pdo->prepare($sqlSout); $stmt->execute($p);
$stats['total_soutenances'] = (int) $stmt->fetch()['c'];

foreach (['validee' => 'soutenances_validees', 'planifiee' => 'soutenances_en_attente', 'refusee' => 'soutenances_refusees', 'sans_date' => 'sans_date'] as $statutDb => $cle) {
    $p = [$statutDb];
    $sql = "SELECT COUNT(*) c FROM soutenances WHERE statut = ?" . condDept('departement_id', $deptFiltre, $p);
    $stmt = $pdo->prepare($sql); $stmt->execute($p);
    $stats[$cle] = (int) $stmt->fetch()['c'];
}

$traitees = $stats['soutenances_validees'] + $stats['soutenances_refusees'];
$stats['taux_validation'] = $traitees > 0 ? round($stats['soutenances_validees'] / $traitees * 100) : null;

$p = ['en_attente'];
$sql = "SELECT COUNT(*) c FROM invitations_jury i JOIN soutenances s ON i.soutenance_id = s.id WHERE i.statut = ?" . condDept('s.departement_id', $deptFiltre, $p);
$stmt = $pdo->prepare($sql); $stmt->execute($p);
$stats['invitations_en_attente'] = (int) $stmt->fetch()['c'];

$p = ['expiree'];
$sql = "SELECT COUNT(*) c FROM invitations_jury i JOIN soutenances s ON i.soutenance_id = s.id WHERE i.statut = ?" . condDept('s.departement_id', $deptFiltre, $p);
$stmt = $pdo->prepare($sql); $stmt->execute($p);
$stats['invitations_expirees'] = (int) $stmt->fetch()['c'];

$stats['total_departements'] = (int) $pdo->query("SELECT COUNT(*) c FROM departements")->fetch()['c'];
$p = [];
$sqlOpt = "SELECT COUNT(*) c FROM options WHERE 1=1" . condDept('departement_id', $deptFiltre, $p);
$stmt = $pdo->prepare($sqlOpt); $stmt->execute($p);
$stats['total_options'] = (int) $stmt->fetch()['c'];

$p = ['en_attente'];
$sqlDem = "SELECT COUNT(*) c FROM demandes_participation WHERE statut = ?" . condDept('departement_cible_id', $deptFiltre, $p);
$stmt = $pdo->prepare($sqlDem); $stmt->execute($p);
$stats['demandes_participation_attente'] = (int) $stmt->fetch()['c'];

// Réciprocité jury (agrégat), scopée au département si applicable
$p = [];
$sqlUsers = "SELECT id FROM users WHERE role IN ('encadrant','chef_dept','admin') AND is_active = 1" . condDept('departement_id', $deptFiltre, $p);
$stmt = $pdo->prepare($sqlUsers); $stmt->execute($p);
$idsEnseignants = array_column($stmt->fetchAll(), 'id');

$equilibres = 0; $sousSollicites = 0; $surSollicites = 0;
foreach ($idsEnseignants as $uid) {
    $stmtObj = $pdo->prepare("SELECT COUNT(*) c FROM etudiants WHERE encadrant_id = ?"); $stmtObj->execute([$uid]); $objectif = (int) $stmtObj->fetch()['c'];
    $stmtRap = $pdo->prepare("SELECT COUNT(*) c FROM invitations_jury WHERE enseignant_id = ? AND role='rapporteur' AND statut='acceptee'"); $stmtRap->execute([$uid]); $nbRap = (int) $stmtRap->fetch()['c'];
    $stmtPres = $pdo->prepare("SELECT COUNT(*) c FROM invitations_jury WHERE enseignant_id = ? AND role='president' AND statut='acceptee'"); $stmtPres->execute([$uid]); $nbPres = (int) $stmtPres->fetch()['c'];
    $ecartRap = $objectif - $nbRap; $ecartPres = $objectif - $nbPres;
    if ($ecartRap < 0 || $ecartPres < 0) $surSollicites++;
    elseif ($ecartRap > 0 || $ecartPres > 0) $sousSollicites++;
    else $equilibres++;
}
$stats['jury_equilibres'] = $equilibres;
$stats['jury_sous_sollicites'] = $sousSollicites;
$stats['jury_sur_sollicites'] = $surSollicites;

// Répartition par département (uniquement pertinente en vue globale admin)
$stats['par_departement'] = $pdo->query("
    SELECT d.nom, COUNT(s.id) as total FROM departements d LEFT JOIN soutenances s ON s.departement_id = d.id
    GROUP BY d.id, d.nom ORDER BY d.nom
")->fetchAll();

// Répartition par spécialité (scopée au département si applicable)
$p = [];
$sqlSpec = "SELECT o.nom, COUNT(s.id) as total FROM options o LEFT JOIN soutenances s ON s.etudiant_id IN (SELECT id FROM etudiants WHERE option_id = o.id) WHERE 1=1" . condDept('o.departement_id', $deptFiltre, $p) . " GROUP BY o.id, o.nom ORDER BY o.nom";
$stmt = $pdo->prepare($sqlSpec); $stmt->execute($p);
$stats['par_specialite'] = $stmt->fetchAll();

$p = [];
$sqlDispo = "SELECT COUNT(DISTINCT enseignant_id) c FROM disponibilites d JOIN users u ON d.enseignant_id = u.id WHERE 1=1" . condDept('u.departement_id', $deptFiltre, $p);
$stmt = $pdo->prepare($sqlDispo); $stmt->execute($p);
$stats['enseignants_avec_dispo'] = (int) $stmt->fetch()['c'];

$p = [];
$sqlJour = "SELECT date as date_soutenance, COUNT(*) as total FROM soutenances WHERE date IS NOT NULL" . condDept('departement_id', $deptFiltre, $p) . " GROUP BY date ORDER BY date";
$stmt = $pdo->prepare($sqlJour); $stmt->execute($p);
$stats['par_jour'] = $stmt->fetchAll();

$p = [];
$sqlProch = "SELECT s.id, s.date as date_soutenance, s.heure, s.salle, CONCAT(e.prenom, ' ', e.nom) as etudiant, e.titre_sujet
    FROM soutenances s JOIN etudiants e ON s.etudiant_id = e.id WHERE s.date >= CURDATE()" . condDept('s.departement_id', $deptFiltre, $p) . " ORDER BY s.date ASC, s.heure ASC LIMIT 5";
$stmt = $pdo->prepare($sqlProch); $stmt->execute($p);
$stats['prochaines'] = $stmt->fetchAll();

ok($stats);
