<?php
/**
 * R4 — Réciprocité jury.
 * Pour chaque enseignant : nombre d'étudiants encadrés (= objectif de participations
 * au jury), comparé au nombre de fois où il a réellement été désigné rapporteur et
 * président. Permet à l'encadrant de voir sa propre charge, et à l'admin/chef de
 * département de superviser l'équilibre global.
 *
 * Règle : un encadrant de N étudiants doit être désigné N fois rapporteur ET N fois
 * président sur l'ensemble de la session (comptage toutes soutenances confondues,
 * département + hors département, invitations acceptées uniquement).
 *
 * v1.7 : le total affiché = compteur automatique (invitations acceptées)
 * + ajustement manuel effectué par l'admin (colonnes ajustement_rapporteur /
 * ajustement_president sur users). Voir /api/jury/ajustement-reciprocite.php.
 *
 * v1.10 : compteur scindé en intra/hors département + jours disponibles déclarés.
 *
 * v1.11 : ajoute un mini-calendrier de disponibilités par enseignant (inspiré du
 * suivi Excel historique : une cellule par jour de la période, Disponible / Absent /
 * Non renseigné). La réponse change de forme : {dates, enseignants} au lieu d'un
 * simple tableau, pour transporter la liste des dates une seule fois.
 */
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$pdo = getDB();

$sql = "
    SELECT
        u.id, u.nom, u.prenom, u.departement_id,
        u.ajustement_rapporteur, u.ajustement_president,
        (SELECT COUNT(*) FROM etudiants e WHERE e.encadrant_id = u.id) AS nb_etudiants_encadres,

        (SELECT COUNT(*) FROM invitations_jury i
            JOIN soutenances s ON i.soutenance_id = s.id
            WHERE i.enseignant_id = u.id AND i.role = 'rapporteur' AND i.statut = 'acceptee'
              AND s.departement_id = u.departement_id
        ) AS nb_rapporteur_intra,

        (SELECT COUNT(*) FROM invitations_jury i
            JOIN soutenances s ON i.soutenance_id = s.id
            WHERE i.enseignant_id = u.id AND i.role = 'rapporteur' AND i.statut = 'acceptee'
              AND (s.departement_id != u.departement_id OR s.departement_id IS NULL)
        ) AS nb_rapporteur_hors,

        (SELECT COUNT(*) FROM invitations_jury i
            JOIN soutenances s ON i.soutenance_id = s.id
            WHERE i.enseignant_id = u.id AND i.role = 'president' AND i.statut = 'acceptee'
              AND s.departement_id = u.departement_id
        ) AS nb_president_intra,

        (SELECT COUNT(*) FROM invitations_jury i
            JOIN soutenances s ON i.soutenance_id = s.id
            WHERE i.enseignant_id = u.id AND i.role = 'president' AND i.statut = 'acceptee'
              AND (s.departement_id != u.departement_id OR s.departement_id IS NULL)
        ) AS nb_president_hors

    FROM users u
    WHERE u.role IN ('encadrant','chef_dept','admin') AND u.is_active = 1
";

// Un simple encadrant ne voit que sa propre ligne ; admin/chef_dept voient tout le monde.
if ($auth['role'] === 'encadrant') {
    $sql .= " AND u.id = " . (int) $auth['id'];
}
$sql .= " ORDER BY u.nom, u.prenom";

$rows = $pdo->query($sql)->fetchAll();

// ---- Période active : on prend une seule fois la période la plus récente,
// et on scope TOUT dessus (jours_calendrier ET disponibilités) pour éviter
// les doublons de jours (plusieurs périodes créées successivement) et
// l'incohérence entre le compteur et le mini-calendrier affiché.
$periode = $pdo->query("SELECT id, date_debut, date_fin FROM periode ORDER BY id DESC LIMIT 1")->fetch();

$joursCalendrier = [];
if ($periode) {
    $stmtJours = $pdo->prepare("SELECT date, actif, est_ferie FROM jours_calendrier WHERE periode_id = ? ORDER BY date");
    $stmtJours->execute([$periode['id']]);
    $joursCalendrier = $stmtJours->fetchAll();
}
$dates = array_column($joursCalendrier, 'date');

// ---- Matrice enseignant × jour -> statut ('disponible' | 'absent'), limitée à la période active ----
$dispoMatrix = [];
if ($periode) {
    $stmtDispoMatrix = $pdo->prepare("SELECT enseignant_id, date, statut FROM disponibilites WHERE date BETWEEN ? AND ?");
    $stmtDispoMatrix->execute([$periode['date_debut'], $periode['date_fin']]);
    foreach ($stmtDispoMatrix->fetchAll() as $d) {
        $dispoMatrix[$d['enseignant_id']][$d['date']] = $d['statut'];
    }
}

// ---- Total de jours "disponible" déclarés sur la période active (pour le compteur simple) ----
$dispoTotalParEnseignant = [];
if ($periode) {
    $stmtDispo = $pdo->prepare("
        SELECT enseignant_id, COUNT(*) AS nb
        FROM disponibilites
        WHERE statut = 'disponible' AND date BETWEEN ? AND ?
        GROUP BY enseignant_id
    ");
    $stmtDispo->execute([$periode['date_debut'], $periode['date_fin']]);
    foreach ($stmtDispo->fetchAll() as $d) {
        $dispoTotalParEnseignant[$d['enseignant_id']] = (int) $d['nb'];
    }
}

foreach ($rows as &$r) {
    $objectif = (int) $r['nb_etudiants_encadres'];
    $r['objectif'] = $objectif;

    $r['nb_rapporteur_intra'] = (int) $r['nb_rapporteur_intra'];
    $r['nb_rapporteur_hors']  = (int) $r['nb_rapporteur_hors'];
    $r['nb_president_intra']  = (int) $r['nb_president_intra'];
    $r['nb_president_hors']   = (int) $r['nb_president_hors'];

    // Total (identique à l'ancien nb_rapporteur / nb_president, sert au calcul d'écart)
    $r['nb_rapporteur'] = $r['nb_rapporteur_intra'] + $r['nb_rapporteur_hors'] + (int) $r['ajustement_rapporteur'];
    $r['nb_president']  = $r['nb_president_intra']  + $r['nb_president_hors']  + (int) $r['ajustement_president'];

    $r['ecart_rapporteur'] = $objectif - $r['nb_rapporteur'];
    $r['ecart_president']  = $objectif - $r['nb_president'];
    // > 0  => il lui manque des participations pour respecter la réciprocité
    // <= 0 => objectif atteint ou dépassé

    $r['jours_disponibles'] = $dispoTotalParEnseignant[$r['id']] ?? 0;

    // Mini-calendrier : une entrée par jour de la période, statut null si non renseigné
    $r['dispo_jours'] = [];
    foreach ($joursCalendrier as $jc) {
        $r['dispo_jours'][] = [
            'date'   => $jc['date'],
            'statut' => $dispoMatrix[$r['id']][$jc['date']] ?? null,
            'ferie'  => (bool) $jc['est_ferie'],
            'actif'  => (bool) $jc['actif'],
        ];
    }
}

ok(['dates' => $dates, 'enseignants' => $rows]);