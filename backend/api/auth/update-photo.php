<?php
/**
 * Upload et enregistrement de la photo de profil.
 * Le fichier est stocké dans backend/uploads/photos/, et l'URL relative
 * est enregistrée dans users.photo_url. L'ancienne photo est supprimée
 * du disque si elle existe, pour éviter d'accumuler des fichiers orphelins.
 */
require_once __DIR__ . '/../../config/cors.php';

$auth = jwtRequireAuth();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);
if (empty($_FILES['photo'])) fail('Aucune image envoyée');

$fichier = $_FILES['photo'];
if ($fichier['error'] !== UPLOAD_ERR_OK) fail("Erreur lors de l'envoi du fichier");

$tailleMax = 3 * 1024 * 1024; // 3 Mo
if ($fichier['size'] > $tailleMax) fail('Image trop volumineuse (max 3 Mo)');

$infosImage = @getimagesize($fichier['tmp_name']);
if (!$infosImage) fail("Le fichier envoyé n'est pas une image valide");

$typesAutorises = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
$mime = $infosImage['mime'];
if (!isset($typesAutorises[$mime])) fail('Format non supporté (JPEG, PNG ou WebP uniquement)');

$pdo = getDB();

// Supprime l'ancienne photo du disque si elle existe
$stmt = $pdo->prepare("SELECT photo_url FROM users WHERE id = ?");
$stmt->execute([$auth['id']]);
$ancienUser = $stmt->fetch();
if ($ancienUser && $ancienUser['photo_url']) {
    $ancienChemin = __DIR__ . '/../../' . $ancienUser['photo_url'];
    if (file_exists($ancienChemin)) @unlink($ancienChemin);
}

$dossierUploads = __DIR__ . '/../../uploads/photos';
if (!is_dir($dossierUploads)) mkdir($dossierUploads, 0755, true);

$extension = $typesAutorises[$mime];
$nomFichier = 'user_' . $auth['id'] . '_' . time() . '.' . $extension;
$cheminDestination = $dossierUploads . '/' . $nomFichier;

if (!move_uploaded_file($fichier['tmp_name'], $cheminDestination)) {
    fail("Impossible d'enregistrer l'image sur le serveur");
}

// Redimensionnement carré (200x200) si l'extension GD est disponible, sinon on garde l'original tel quel
if (extension_loaded('gd')) {
    redimensionnerImage($cheminDestination, $mime, 200, 200);
}

$urlRelative = 'uploads/photos/' . $nomFichier;
$pdo->prepare("UPDATE users SET photo_url = ? WHERE id = ?")->execute([$urlRelative, $auth['id']]);

ok(['photo_url' => $urlRelative], 'Photo de profil mise à jour');

/** Redimensionne et recadre une image en carré, écrase le fichier d'origine. */
function redimensionnerImage($chemin, $mime, $largeur, $hauteur) {
    switch ($mime) {
        case 'image/jpeg': $source = @imagecreatefromjpeg($chemin); break;
        case 'image/png': $source = @imagecreatefrompng($chemin); break;
        case 'image/webp': $source = @imagecreatefromwebp($chemin); break;
        default: return;
    }
    if (!$source) return;

    $largeurSource = imagesx($source);
    $hauteurSource = imagesy($source);
    $cote = min($largeurSource, $hauteurSource);
    $x = (int) (($largeurSource - $cote) / 2);
    $y = (int) (($hauteurSource - $cote) / 2);

    $destination = imagecreatetruecolor($largeur, $hauteur);
    if ($mime === 'image/png') {
        imagealphablending($destination, false);
        imagesavealpha($destination, true);
    }
    imagecopyresampled($destination, $source, 0, 0, $x, $y, $largeur, $hauteur, $cote, $cote);

    switch ($mime) {
        case 'image/jpeg': imagejpeg($destination, $chemin, 85); break;
        case 'image/png': imagepng($destination, $chemin); break;
        case 'image/webp': imagewebp($destination, $chemin, 85); break;
    }
    imagedestroy($source);
    imagedestroy($destination);
}
