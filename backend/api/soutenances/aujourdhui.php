<?php
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
$pdo = getDB();

// Uniquement les soutenances d'AUJOURD'HUI où l'utilisateur connecté
// est l'encadrant, et qui ne sont pas encore terminées.
$sql = "SELECT s.*, e.code_etudiant,
        CONCAT(e.prenom,' ',e.nom) as etudiant, e.titre_sujet,
        o.nom as specialite_nom
        FROM soutenances s
        JOIN etudiants e ON s.etudiant_id = e.id
        LEFT JOIN options o ON e.option_id = o.id
        WHERE s.encadrant_id = ?
        AND s.date = CURDATE()
        AND s.statut = 'validee'
        ORDER BY s.heure ASC";

$stmt = $pdo->prepare($sql);
$stmt->execute([$auth['id']]);
ok($stmt->fetchAll());
