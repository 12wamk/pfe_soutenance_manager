<?php
/**
 * Import CSV des enseignants : Nom, Prénom, Email, Département, Grade.
 * Les enseignants déjà existants (par email) sont mis à jour, jamais dupliqués.
 * Un mot de passe par défaut est généré pour les nouveaux comptes et envoyé par email
 * (si MAIL_ENABLED est activé dans config/mailer.php ; sinon il reste affiché dans
 * le rapport d'import pour transmission manuelle).
 */
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/mailer.php';

requireRole(['admin']);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);
if (empty($_FILES['file'])) fail('Aucun fichier envoyé');

$file = $_FILES['file'];
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (!in_array($ext, ['csv', 'txt'])) fail('Format non supporté (CSV attendu)');

$pdo = getDB();
$handle = fopen($file['tmp_name'], 'r');
if (!$handle) fail('Impossible de lire le fichier');

fgetcsv($handle); // en-tête ignoré : nom,prenom,email,departement,grade
$created = 0; $updated = 0; $errors = []; $comptesGeneres = [];
$line = 1;

while (($row = fgetcsv($handle)) !== false) {
    $line++;
    if (count($row) < 3) { $errors[] = "Ligne $line : colonnes insuffisantes"; continue; }
    [$nom, $prenom, $email] = array_pad($row, 3, null);
    $departementNom = trim($row[3] ?? '');
    $grade = sanitizeFormula(trim($row[4] ?? ''));

    $nom = sanitizeFormula(trim($nom)); $prenom = sanitizeFormula(trim($prenom)); $email = sanitizeFormula(trim($email));
    if (!$nom || !$prenom || !$email) { $errors[] = "Ligne $line : champs obligatoires manquants"; continue; }

    $departementId = null;
    if ($departementNom) {
        $stmt = $pdo->prepare("SELECT id FROM departements WHERE nom = ?");
        $stmt->execute([$departementNom]);
        $dept = $stmt->fetch();
        if ($dept) $departementId = $dept['id'];
        else $errors[] = "Ligne $line : département '$departementNom' introuvable (enseignant importé sans département)";
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $existing = $stmt->fetch();

    if ($existing) {
        $stmt = $pdo->prepare("UPDATE users SET nom=?, prenom=?, departement_id=?, grade=? WHERE id=?");
        $stmt->execute([$nom, $prenom, $departementId, $grade, $existing['id']]);
        $updated++;
    } else {
        $motDePasse = bin2hex(random_bytes(4)); // mot de passe par défaut généré
        $hash = password_hash($motDePasse, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (nom, prenom, email, password, role, departement_id, grade, is_active) VALUES (?,?,?,?, 'encadrant', ?, ?, 1)");
        $stmt->execute([$nom, $prenom, $email, $hash, $departementId, $grade]);
        $created++;
        $comptesGeneres[] = ['email' => $email, 'password' => $motDePasse];

        $contenu = "<p>Bonjour $prenom,</p>
            <p>Un compte vous a été créé sur la plateforme de gestion des soutenances de PFE.</p>
            <p><strong>Email :</strong> $email<br><strong>Mot de passe temporaire :</strong> <code style='background:#f1f5f9;padding:2px 8px;border-radius:4px;'>$motDePasse</code></p>
            <p>Nous vous recommandons de le modifier dès votre première connexion, depuis la page « Mon Profil ».</p>";
        $emailEnvoye = envoyerEmail($email, "$prenom $nom", 'Votre compte ENET\'COM - Gestion des Soutenances',
            gabaritEmail('Bienvenue', $contenu));
        if (!$emailEnvoye) $errors[] = "Ligne $line : compte créé mais l'email n'a pas pu être envoyé (voir mail_log.txt)";
    }
}
fclose($handle);

ok([
    'success' => $created, 'skipped' => $updated, 'errors' => $errors,
    'comptes_generes' => $comptesGeneres,
], "Import terminé : $created créé(s), $updated mis à jour, " . count($errors) . " erreur(s)");
