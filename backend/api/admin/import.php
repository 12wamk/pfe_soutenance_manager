<?php
require_once __DIR__ . '/../../config/cors.php';

$auth = requireRole(['admin', 'chef_dept']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée', 405);
if (empty($_FILES['file'])) fail('Aucun fichier envoyé');

$file = $_FILES['file'];
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (!in_array($ext, ['csv', 'txt'])) fail('Format non supporté (CSV attendu)');

$pdo = getDB();
$handle = fopen($file['tmp_name'], 'r');
if (!$handle) fail('Impossible de lire le fichier');

/** Convertit une date JJ/MM/AAAA ou AAAA-MM-JJ vers le format MySQL AAAA-MM-JJ. */
function parseDate($valeur) {
    $valeur = trim($valeur ?? '');
    if (!$valeur) return null;
    if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $valeur, $m)) return "{$m[3]}-{$m[2]}-{$m[1]}";
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $valeur)) return $valeur;
    return null;
}

/**
 * Déduit le département et la spécialité depuis la colonne "niveau", au format
 * "<année> <CODE_DEPT>-<CODE_SPECIALITE>" (ex: "3 GII-SII", "2 EEA-II").
 * Retourne [option_id, departement_id] ou [null, null] si non reconnu.
 */
function deduireSpecialite($pdo, $niveau) {
    if (!preg_match('/([A-Za-z]+)-([A-Za-z0-9]+)\s*$/', trim($niveau ?? ''), $m)) return [null, null];
    $codeDept = strtoupper($m[1]);
    $codeSpec = strtoupper($m[2]);

    $stmt = $pdo->prepare("SELECT id FROM departements WHERE UPPER(code) = ?");
    $stmt->execute([$codeDept]);
    $dept = $stmt->fetch();
    if (!$dept) return [null, null];

    $stmt = $pdo->prepare("SELECT id FROM options WHERE UPPER(code) = ? AND departement_id = ?");
    $stmt->execute([$codeSpec, $dept['id']]);
    $option = $stmt->fetch();

    return [$option ? $option['id'] : null, $dept['id']];
}

/** Garantit qu'une soutenance existe pour cet étudiant seul ; en crée une "sans_date" sinon. */
function assurerSoutenanceSolo($pdo, $etudiantId, $encadrantId, $departementId) {
    $stmt = $pdo->prepare("SELECT id FROM soutenances WHERE etudiant_id = ? OR etudiant2_id = ? LIMIT 1");
    $stmt->execute([$etudiantId, $etudiantId]);
    if ($stmt->fetch()) return;
    $pdo->prepare("INSERT INTO soutenances (etudiant_id, encadrant_id, departement_id, statut) VALUES (?, ?, ?, 'sans_date')")
        ->execute([$etudiantId, $encadrantId, $departementId]);
}

/**
 * Fusionne 2 étudiants en une seule soutenance binôme. Réutilise une soutenance
 * "sans_date" existante pour l'un des deux si elle existe, sinon en crée une
 * nouvelle. Ne fusionne jamais une soutenance déjà planifiee/validee/refusee
 * (signalé en erreur pour traitement manuel). Retourne un message d'erreur ou null.
 */
function fusionnerBinome($pdo, $etudiant1Id, $etudiant2Id, $encadrantId, $departementId) {
    $stmt = $pdo->prepare("SELECT id, statut, etudiant_id, etudiant2_id FROM soutenances WHERE etudiant_id IN (?, ?) OR etudiant2_id IN (?, ?)");
    $stmt->execute([$etudiant1Id, $etudiant2Id, $etudiant1Id, $etudiant2Id]);
    $existantes = $stmt->fetchAll();

    if (count($existantes) === 0) {
        $pdo->prepare("INSERT INTO soutenances (etudiant_id, etudiant2_id, encadrant_id, departement_id, statut) VALUES (?, ?, ?, ?, 'sans_date')")
            ->execute([$etudiant1Id, $etudiant2Id, $encadrantId, $departementId]);
        return null;
    }

    foreach ($existantes as $ex) {
        if ($ex['statut'] !== 'sans_date') {
            return "une soutenance au statut '{$ex['statut']}' existe déjà pour l'un des deux étudiants (id {$ex['id']}) — fusion automatique abandonnée, à traiter manuellement";
        }
    }

    $garder = $existantes[0];
    $pdo->prepare("UPDATE soutenances SET etudiant_id = ?, etudiant2_id = ?, encadrant_id = ?, departement_id = ? WHERE id = ?")
        ->execute([$etudiant1Id, $etudiant2Id, $encadrantId, $departementId, $garder['id']]);

    for ($i = 1; $i < count($existantes); $i++) {
        $pdo->prepare("DELETE FROM soutenances WHERE id = ?")->execute([$existantes[$i]['id']]);
    }
    return null;
}

$header = fgetcsv($handle);
$success = 0; $updated = 0; $errors = []; $sansEncadrant = 0; $sansSpecialite = 0; $horsDepartement = 0;
$line = 1;

// Phase 1 : upsert de chaque étudiant. Aucune soutenance n'est créée ici — on
// garde en mémoire une "signature" (niveau + sujet + dates + encadrant) pour
// détecter les binômes en phase 2, à l'image du fichier source réel où un
// binôme se traduit par 2 lignes consécutives partageant EXACTEMENT ces
// valeurs (pas de colonne dédiée dans le fichier).
$etudiantsImportes = [];

while (($row = fgetcsv($handle)) !== false) {
    $line++;
    if (count($row) < 7) { $errors[] = "Ligne $line : nombre de colonnes insuffisant (9 attendues)"; continue; }

    [$code, $nom, $prenom, $niveau, $encNom, $encPrenom, $titre] = array_pad($row, 7, null);
    $dateDebut = parseDate($row[7] ?? null);
    $dateFin = parseDate($row[8] ?? null);

    $code = trim($code); $nom = trim($nom); $prenom = trim($prenom); $niveau = trim($niveau ?? '');
    $titre = trim($titre ?? ''); $encNomT = trim($encNom ?? ''); $encPrenomT = trim($encPrenom ?? '');
    if (!$code || !$nom || !$prenom) { $errors[] = "Ligne $line : champs obligatoires manquants (code/nom/prénom)"; continue; }

    [$optionId, $departementId] = deduireSpecialite($pdo, $niveau);
    if (!$optionId) {
        $errors[] = "Ligne $line : spécialité non reconnue pour le niveau '$niveau' (vérifiez les codes dans Départements & Options)";
        $sansSpecialite++;
        continue;
    }

    if ($auth['role'] === 'chef_dept' && (int) $departementId !== (int) $auth['departement_id']) {
        $errors[] = "Ligne $line : étudiant '$prenom $nom' appartient à un autre département — ligne ignorée";
        $horsDepartement++;
        continue;
    }

    $encadrantId = null;
    if ($encNomT && $encPrenomT) {
        $stmt = $pdo->prepare("SELECT id FROM users WHERE LOWER(nom) = LOWER(?) AND LOWER(prenom) = LOWER(?) AND role IN ('encadrant','chef_dept','admin')");
        $stmt->execute([$encNomT, $encPrenomT]);
        $enc = $stmt->fetch();
        if ($enc) { $encadrantId = $enc['id']; }
        else { $errors[] = "Ligne $line : encadrant '$encPrenomT $encNomT' introuvable — étudiant importé sans encadrant"; $sansEncadrant++; }
    }

    $stmt = $pdo->prepare("SELECT id FROM etudiants WHERE code_etudiant = ?");
    $stmt->execute([$code]);
    $existing = $stmt->fetch();

    if ($existing) {
        if ($auth['role'] === 'chef_dept') {
            $stmtVerif = $pdo->prepare("SELECT o.departement_id FROM etudiants e LEFT JOIN options o ON e.option_id = o.id WHERE e.id = ?");
            $stmtVerif->execute([$existing['id']]);
            $deptExistant = $stmtVerif->fetch()['departement_id'] ?? null;
            if ((int) $deptExistant !== (int) $auth['departement_id']) {
                $errors[] = "Ligne $line : l'étudiant '$code' existe déjà dans un autre département — ligne ignorée";
                $horsDepartement++;
                continue;
            }
        }
        $stmt = $pdo->prepare("UPDATE etudiants SET nom=?, prenom=?, niveau=?, option_id=?, encadrant_id=?, titre_sujet=?, date_debut=?, date_fin=? WHERE code_etudiant=?");
        $stmt->execute([$nom, $prenom, $niveau, $optionId, $encadrantId, $titre, $dateDebut, $dateFin, $code]);
        $etudiantId = $existing['id'];
        $updated++;
    } else {
        $stmt = $pdo->prepare("INSERT INTO etudiants (code_etudiant, nom, prenom, niveau, option_id, encadrant_id, titre_sujet, date_debut, date_fin) VALUES (?,?,?,?,?,?,?,?,?)");
        $stmt->execute([$code, $nom, $prenom, $niveau, $optionId, $encadrantId, $titre, $dateDebut, $dateFin]);
        $etudiantId = $pdo->lastInsertId();
        $success++;
        if ($encadrantId) {
            $pdo->prepare("INSERT INTO notifications (user_id, type, titre, message, lien) VALUES (?,?,?,?,?)")
                ->execute([$encadrantId, 'info', 'Nouvel étudiant affecté', "$prenom $nom vous a été affecté ($titre). Pensez à planifier sa soutenance.", '/mes-etudiants']);
        }
    }

    // Signature de correspondance pour la détection de binôme (phase 2) : normalisée
    // en minuscules pour tolérer les variations de casse entre les 2 lignes.
    $signature = mb_strtolower($niveau . '|' . $titre . '|' . $dateDebut . '|' . $dateFin . '|' . $encNomT . '|' . $encPrenomT);

    $etudiantsImportes[] = [
        'etudiantId' => $etudiantId, 'encadrantId' => $encadrantId, 'departementId' => $departementId,
        'signature' => $signature, 'nom' => $nom, 'prenom' => $prenom, 'line' => $line,
    ];
}
fclose($handle);

// Phase 2 : regroupement par signature. Un groupe de 2 lignes partageant EXACTEMENT
// le même niveau + sujet + dates + encadrant = un binôme (comme le fichier source
// réel, où 2 lignes consécutives partagent ces valeurs). Un groupe de 1 = individuel.
// Un groupe de 3+ est ambigu (coïncidence possible) : jamais fusionné automatiquement,
// signalé pour vérification manuelle.
$groupes = [];
foreach ($etudiantsImportes as $e) {
    $groupes[$e['signature']][] = $e;
}

$nbBinomes = 0;
foreach ($groupes as $signature => $membres) {
    if (count($membres) === 1) {
        assurerSoutenanceSolo($pdo, $membres[0]['etudiantId'], $membres[0]['encadrantId'], $membres[0]['departementId']);
        continue;
    }
    if (count($membres) > 2) {
        $lignes = implode(', ', array_column($membres, 'line'));
        $errors[] = "Lignes $lignes : " . count($membres) . " étudiants partagent exactement le même sujet/dates/encadrant — binôme ambigu (plus de 2), traités individuellement, à vérifier manuellement";
        foreach ($membres as $m) { assurerSoutenanceSolo($pdo, $m['etudiantId'], $m['encadrantId'], $m['departementId']); }
        continue;
    }

    // Exactement 2 -> binôme
    [$m1, $m2] = $membres;
    $erreurFusion = fusionnerBinome($pdo, $m1['etudiantId'], $m2['etudiantId'], $m1['encadrantId'], $m1['departementId']);
    if ($erreurFusion) {
        $errors[] = "Lignes {$m1['line']}, {$m2['line']} (binôme détecté '{$m1['prenom']} {$m1['nom']}' / '{$m2['prenom']} {$m2['nom']}') : $erreurFusion";
    } else {
        $nbBinomes++;
    }
}

ok([
    'success' => $success, 'skipped' => $updated, 'errors' => $errors,
    'sans_encadrant' => $sansEncadrant, 'sans_specialite' => $sansSpecialite, 'hors_departement' => $horsDepartement,
    'nb_binomes' => $nbBinomes,
], "Import terminé : $success nouveau(x), $updated mis à jour, $nbBinomes binôme(s) détecté(s), " . count($errors) . " erreur(s)");