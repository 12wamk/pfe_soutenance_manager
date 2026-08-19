<?php
/**
 * MODE DÉVELOPPEUR — Réinitialise entièrement la base de données de démonstration.
 * Réservé aux administrateurs.
 *
 * DANGER : supprime TOUTES les données courantes puis réimporte le jeu de démo
 * (schema.sql + migrations). À n'utiliser qu'en développement / démonstration.
 */

require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
if ($auth['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(["error" => "Reserve aux administrateurs"]);
    exit;
}

$dossier = __DIR__ . '/../../database/';
$fichiers = [
    'schema.sql',
    'migrations/add_auto_planning_fields.sql',
    'migrations/add_explication_ia.sql',
    'migrations/demo_donnees_planning.sql',
    'migrations/demo_donnees_elaborees.sql',
    'migrations/add_soutenance_etudiants.sql',
    'migrations/demo_donnees_grandes.sql',
];

function executerSql(PDO $pdo, string $sql): void {
    // Retire les commentaires pleine ligne (-- ...)
    $sql = preg_replace('/^--.*$/m', '', $sql);
    // Découpe sur les points-virgules en fin de ligne (multi-requêtes)
    $requetes = preg_split('/;\s*(?:\r?\n|$)/', $sql);
    foreach ($requetes as $req) {
        $req = trim($req);
        if ($req === '') continue;
        $pdo->exec($req);
    }
}

try {
    $pdo = getDB();

    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    $pdo->exec('DROP DATABASE IF EXISTS `' . DB_NAME . '`');
    $pdo->exec('CREATE DATABASE `' . DB_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $pdo->exec('USE `' . DB_NAME . '`');

    foreach ($fichiers as $rel) {
        $chemin = $dossier . $rel;
        if (!is_file($chemin)) {
            throw new Exception("Fichier introuvable : $rel");
        }
        executerSql($pdo, file_get_contents($chemin));
    }

    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

    ok(null, 'Base de données de démonstration réinitialisée avec succès');
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erreur pendant la réinitialisation : ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
}
