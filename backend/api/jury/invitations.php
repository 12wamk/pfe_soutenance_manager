<?php
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$pdo = getDB();

// Auto-expiration : toute invitation en_attente dont la date_limite est dépassée passe à "expiree"
$pdo->exec("UPDATE invitations_jury SET statut = 'expiree' WHERE statut = 'en_attente' AND date_limite < NOW()");

// 'mes_invitations' = uniquement les miennes (comportement historique)
// 'departement'      = toutes celles de mon département, pour que le chef puisse
//                       valider à la place d'un enseignant (repondre.php l'autorise déjà)
$vue = $_GET['vue'] ?? 'auto';
if ($vue === 'auto') {
    $vue = in_array($auth['role'], ['chef_dept', 'admin']) ? 'departement' : 'mes_invitations';
}

// NOUVEAU : on calcule, pour chaque invitation, si le poste (rapporteur/président)
// de la soutenance concernée est déjà occupé par un AUTRE enseignant que celui
// de l'invitation. Utile notamment pour les invitations "expiree" : si le poste a
// entre-temps été pourvu par quelqu'un d'autre, on ne doit plus permettre de
// "lever l'expiration" pour l'accepter.
$baseSql = "
    SELECT i.*, s.date as date_soutenance, s.heure, s.salle, s.departement_id,
           CONCAT(e.prenom,' ',e.nom) as etudiant, e.titre_sujet,
           CONCAT(u.prenom,' ',u.nom) as enseignant_nom,
           CASE WHEN i.role = 'rapporteur' THEN s.rapporteur_id ELSE s.president_id END as titulaire_actuel_id,
           (SELECT CONCAT(t.prenom,' ',t.nom) FROM users t
              WHERE t.id = CASE WHEN i.role = 'rapporteur' THEN s.rapporteur_id ELSE s.president_id END
           ) as titulaire_actuel_nom,
           (CASE WHEN (CASE WHEN i.role = 'rapporteur' THEN s.rapporteur_id ELSE s.president_id END) IS NOT NULL
                  AND (CASE WHEN i.role = 'rapporteur' THEN s.rapporteur_id ELSE s.president_id END) != i.enseignant_id
                 THEN 1 ELSE 0 END) as poste_deja_pourvu
    FROM invitations_jury i
    JOIN soutenances s ON i.soutenance_id = s.id
    JOIN etudiants e ON s.etudiant_id = e.id
    JOIN users u ON i.enseignant_id = u.id
";

if ($vue === 'mes_invitations' || $auth['role'] === 'encadrant') {
    // Un simple encadrant ne voit toujours que ses propres invitations
    $stmt = $pdo->prepare($baseSql . " WHERE i.enseignant_id = ? ORDER BY i.date_envoi DESC");
    $stmt->execute([$auth['id']]);
} elseif ($auth['role'] === 'admin') {
    // L'admin voit tout, tous départements confondus
    $stmt = $pdo->query($baseSql . " ORDER BY i.date_envoi DESC");
} else {
    // chef_dept : ses propres invitations + celles des enseignants de son département
    $stmt = $pdo->prepare($baseSql . " WHERE s.departement_id = ? OR i.enseignant_id = ? ORDER BY i.date_envoi DESC");
    $stmt->execute([$auth['departement_id'], $auth['id']]);
}

ok($stmt->fetchAll());