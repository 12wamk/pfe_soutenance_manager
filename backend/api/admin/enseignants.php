<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/mailer.php';

$auth = jwtRequireAuth(); // lecture ouverte à tout utilisateur connecté (nécessaire pour les listes déroulantes jury)
$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $search = $_GET['search'] ?? '';
    $filtre = $_GET['filtre'] ?? 'tous'; // 'mes_encadrants' | 'tous'
    $detaille = in_array($auth['role'], ['admin', 'chef_dept']); // stats de charge calculées seulement pour les vues admin/chef (évite le calcul inutile pour le simple dropdown jury)

    // Le rôle 'admin' n'a pas de quota jury / d'objectif de réciprocité : on l'exclut
    // du tableau de charge dès la requête principale quand on affiche les stats.
    // (Pour le simple dropdown jury, on continue de l'inclure au cas où il faille
    // pouvoir le désigner manuellement — comportement inchangé quand $detaille=false.)
    $rolesAutorises = $detaille ? ['chef_dept', 'encadrant'] : ['admin', 'chef_dept', 'encadrant'];
    $placeholders = implode(',', array_fill(0, count($rolesAutorises), '?'));

    // v1.7 : ajustement_rapporteur / ajustement_president ajoutés à la sélection
    // pour permettre l'ajustement manuel admin de la réciprocité (voir plus bas).
    $sql = "SELECT id, nom, prenom, email, role, grade, departement_id, max_soutenances_jour, is_active, ajustement_rapporteur, ajustement_president, expertises, enseignements, domaines_recherche, bio_courte FROM users WHERE role IN ($placeholders) AND is_active = 1";
    $params = $rolesAutorises;
    // Un chef de département ne voit JAMAIS les enseignants hors de son département,
    // quel que soit le filtre demandé (règle stricte, cohérente avec soutenances/étudiants).
    if ($auth['role'] === 'chef_dept') {
        $sql .= " AND departement_id = ?";
        $params[] = $auth['departement_id'];
    } elseif ($filtre === 'mes_encadrants' && $auth['departement_id']) {
        $sql .= " AND departement_id = ?";
        $params[] = $auth['departement_id'];
    } elseif ($auth['role'] === 'admin' && !empty($_GET['departement_id'])) {
        $sql .= " AND departement_id = ?";
        $params[] = $_GET['departement_id'];
    }
    if ($search) {
        $sql .= " AND (nom LIKE ? OR prenom LIKE ? OR email LIKE ?)";
        $like = "%$search%";
        array_push($params, $like, $like, $like);
    }
    $sql .= " ORDER BY nom, prenom";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $enseignants = $stmt->fetchAll();

    if ($detaille && $enseignants) {
        $ids = array_column($enseignants, 'id');
        $inIds = implode(',', array_fill(0, count($ids), '?'));

        // ---- Une seule requête agrégée pour toute la charge (encadrant/rapporteur/président,
        // dans/hors département), au lieu de 5 requêtes par enseignant (N+1). ----
        $sqlCharge = "
            SELECT
                u.id,
                SUM(CASE WHEN s.encadrant_id = u.id THEN 1 ELSE 0 END) AS nb_encadrant,
                SUM(CASE WHEN s.rapporteur_id = u.id THEN 1 ELSE 0 END) AS nb_rapporteur,
                SUM(CASE WHEN s.president_id = u.id THEN 1 ELSE 0 END) AS nb_president,
                SUM(CASE WHEN u.departement_id IS NOT NULL AND s.departement_id = u.departement_id THEN 1 ELSE 0 END) AS nb_dans_departement,
                SUM(CASE WHEN u.departement_id IS NULL OR s.departement_id != u.departement_id OR s.departement_id IS NULL THEN 1 ELSE 0 END) AS nb_hors_departement
            FROM users u
            LEFT JOIN soutenances s
                ON (s.encadrant_id = u.id OR s.rapporteur_id = u.id OR s.president_id = u.id)
                AND s.statut != 'refusee'
            WHERE u.id IN ($inIds)
            GROUP BY u.id
        ";
        $stmtCharge = $pdo->prepare($sqlCharge);
        $stmtCharge->execute($ids);
        $chargeParId = [];
        foreach ($stmtCharge->fetchAll() as $row) {
            $chargeParId[$row['id']] = $row;
        }

        // Nombre d'étudiants encadrés par enseignant, pour l'objectif de réciprocité (règle X3)
        $sqlEtud = "SELECT encadrant_id, COUNT(*) c FROM etudiants WHERE encadrant_id IN ($inIds) GROUP BY encadrant_id";
        $stmtEtud = $pdo->prepare($sqlEtud);
        $stmtEtud->execute($ids);
        $etudiantsParId = [];
        foreach ($stmtEtud->fetchAll() as $row) {
            $etudiantsParId[$row['encadrant_id']] = (int) $row['c'];
        }

        $periode = $pdo->query("SELECT max_par_jour FROM periode ORDER BY id DESC LIMIT 1")->fetch();
        $maxParDefaut = $periode ? (int) $periode['max_par_jour'] : 5;

        foreach ($enseignants as &$e) {
            $c = $chargeParId[$e['id']] ?? ['nb_encadrant' => 0, 'nb_rapporteur' => 0, 'nb_president' => 0, 'nb_dans_departement' => 0, 'nb_hors_departement' => 0];
            $e['nb_encadrant'] = (int) $c['nb_encadrant'];

            // Compteurs "auto" (issus des soutenances réelles), avant ajustement manuel.
            $nbRapporteurAuto = (int) $c['nb_rapporteur'];
            $nbPresidentAuto = (int) $c['nb_president'];

            $e['nb_dans_departement'] = (int) $c['nb_dans_departement'];
            $e['nb_hors_departement'] = (int) $c['nb_hors_departement'];
            $e['total_soutenances'] = $e['nb_dans_departement'] + $e['nb_hors_departement'];

            // Objectif règle X3 : un encadrant de N étudiants devrait être désigné
            // N fois rapporteur ET N fois président (donc N x 3 participations totales).
            // Calculé sur les compteurs auto (le total_x3 mesure la charge réelle de
            // soutenances, pas le compteur de réciprocité affiché/ajusté).
            $e['nb_etudiants_encadres'] = $etudiantsParId[$e['id']] ?? 0;
            $e['objectif_x3'] = $e['nb_etudiants_encadres'] * 3;
            $e['total_x3'] = ($e['nb_encadrant'] + $nbPresidentAuto + $nbRapporteurAuto) * 3;

            // v1.7 — total affiché = compteur automatique + ajustement manuel admin.
            $e['ajustement_rapporteur'] = (int) $e['ajustement_rapporteur'];
            $e['ajustement_president'] = (int) $e['ajustement_president'];
            $e['nb_rapporteur'] = $nbRapporteurAuto + $e['ajustement_rapporteur'];
            $e['nb_president'] = $nbPresidentAuto + $e['ajustement_president'];

            $e['max_effectif'] = $e['max_soutenances_jour'] !== null
                ? (int) $e['max_soutenances_jour']
                : $maxParDefaut;

            // NOTE (correction) : l'ancien "capacite_restante" comparait à tort le
            // total_soutenances CUMULÉ sur toute la période au max_effectif, qui est
            // un plafond JOURNALIER — un "restant" n'a de sens que pour un jour précis
            // et ne peut pas être résumé en un chiffre unique sur cette vue globale.
            // Le vrai restant par jour est calculé côté "Vue par jour"
            // (voir jury/charge-jour.php et CelluleJour dans EnseignantsPage.jsx).
        }
        unset($e);
    }

    ok($enseignants);
}

if ($method === 'POST') {
    requireRole(['admin']);
    $d = body();
    if (!$d['nom'] || !$d['prenom'] || !$d['email']) fail('Champs requis manquants');
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$d['email']]);
    if ($stmt->fetch()) fail('Cet email est déjà utilisé', 409);

    // Vérification AVANT toute insertion : pas 2 chefs actifs sur le même département
    if (($d['role'] ?? '') === 'chef_dept' && !empty($d['departement_id'])) {
        $stmt = $pdo->prepare("SELECT id FROM users WHERE role = 'chef_dept' AND departement_id = ? AND is_active = 1");
        $stmt->execute([$d['departement_id']]);
        if ($stmt->fetch()) {
            fail('Ce département a déjà un chef de département actif', 409);
        }
    }

    // Si un mot de passe est fourni manuellement par l'admin, on l'utilise ;
    // sinon on en génère un. Dans les deux cas, un email de bienvenue est
    // désormais envoyé systématiquement avec ce mot de passe.
    $motDePasseFourni = !empty($d['password']);
    $password = $motDePasseFourni ? $d['password'] : bin2hex(random_bytes(4));
    $hash = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare("INSERT INTO users (nom, prenom, email, password, role, departement_id, is_active, expertises, enseignements, domaines_recherche, bio_courte) VALUES (?,?,?,?,?,?,1,?,?,?,?)");
    $stmt->execute([
        $d['nom'], $d['prenom'], $d['email'], $hash, $d['role'] ?? 'encadrant', $d['departement_id'] ?? null,
        isset($d['expertises']) ? json_encode($d['expertises']) : null,
        isset($d['enseignements']) ? json_encode($d['enseignements']) : null,
        isset($d['domaines_recherche']) ? json_encode($d['domaines_recherche']) : null,
        $d['bio_courte'] ?? null,
    ]);
    $newId = $pdo->lastInsertId();

    $contenu = "<p>Bonjour {$d['prenom']},</p>
        <p>Un compte vous a été créé sur la plateforme de gestion des soutenances de PFE.</p>
        <p><strong>Email :</strong> {$d['email']}<br><strong>Mot de passe :</strong> <code style='background:#f1f5f9;padding:2px 8px;border-radius:4px;'>$password</code></p>
        <p>Nous vous recommandons de le modifier dès votre première connexion, depuis la page « Mon Profil ».</p>";
    $emailEnvoye = envoyerEmail($d['email'], "{$d['prenom']} {$d['nom']}", "Votre compte ENET'COM - Gestion des Soutenances",
        gabaritEmail('Bienvenue', $contenu));

    ok([
        'id' => $newId,
        'email_envoye' => $emailEnvoye,
        'mot_de_passe_genere' => $motDePasseFourni ? null : $password, // affiché dans l'interface au cas où l'email échoue
    ], 'Enseignant créé', 201);
}

if ($method === 'PUT') {
    $d = body();
    $id = $_GET['id'] ?? null;
    if (!$id) fail('ID manquant');

    // Mise à jour du maximum personnalisé uniquement (utilisée par la page Enseignants)
    if (isset($d['max_soutenances_jour']) && count($d) === 1) {
        requireRole(['admin', 'chef_dept']);
        $pdo->prepare("UPDATE users SET max_soutenances_jour = ? WHERE id = ?")
            ->execute([$d['max_soutenances_jour'] === '' || $d['max_soutenances_jour'] === null ? null : (int) $d['max_soutenances_jour'], $id]);
        ok(null, 'Maximum personnalisé mis à jour');
    }

    requireRole(['admin']);

    // Vérification AVANT la mise à jour : pas 2 chefs actifs sur le même département
    // (on exclut l'enseignant courant, sinon il se bloquerait lui-même)
    if (($d['role'] ?? '') === 'chef_dept' && !empty($d['departement_id'])) {
        $stmt = $pdo->prepare("SELECT id FROM users WHERE role = 'chef_dept' AND departement_id = ? AND is_active = 1 AND id != ?");
        $stmt->execute([$d['departement_id'], $id]);
        if ($stmt->fetch()) {
            fail('Ce département a déjà un chef de département actif', 409);
        }
    }

    $fields = ['nom' => $d['nom'], 'prenom' => $d['prenom'], 'email' => $d['email'], 'role' => $d['role'], 'departement_id' => $d['departement_id'] ?? null, 'is_active' => $d['is_active'] ?? 1];
    $set = []; $params = [];
    foreach ($fields as $k => $v) { if ($v !== null) { $set[] = "$k = ?"; $params[] = $v; } }
    if (!empty($d['password'])) { $set[] = "password = ?"; $params[] = password_hash($d['password'], PASSWORD_DEFAULT); }
    if (array_key_exists('max_soutenances_jour', $d)) { $set[] = "max_soutenances_jour = ?"; $params[] = $d['max_soutenances_jour'] === '' ? null : (int) $d['max_soutenances_jour']; }
    if (isset($d['expertises'])) { $set[] = "expertises = ?"; $params[] = is_array($d['expertises']) ? json_encode($d['expertises']) : $d['expertises']; }
    if (isset($d['enseignements'])) { $set[] = "enseignements = ?"; $params[] = is_array($d['enseignements']) ? json_encode($d['enseignements']) : $d['enseignements']; }
    if (isset($d['domaines_recherche'])) { $set[] = "domaines_recherche = ?"; $params[] = is_array($d['domaines_recherche']) ? json_encode($d['domaines_recherche']) : $d['domaines_recherche']; }
    if (isset($d['bio_courte'])) { $set[] = "bio_courte = ?"; $params[] = $d['bio_courte']; }
    $params[] = $id;

    $stmt = $pdo->prepare("UPDATE users SET " . implode(', ', $set) . " WHERE id = ?");
    $stmt->execute($params);
    ok(null, 'Enseignant mis à jour');
}

if ($method === 'DELETE') {
    requireRole(['admin']);
    $id = $_GET['id'] ?? null;
    if (!$id) fail('ID manquant');
    $stmt = $pdo->prepare("SELECT COUNT(*) as c FROM soutenances WHERE encadrant_id = ? OR rapporteur_id = ? OR president_id = ?");
    $stmt->execute([$id, $id, $id]);
    if ($stmt->fetch()['c'] > 0) {
        $pdo->prepare("UPDATE users SET is_active = 0 WHERE id = ?")->execute([$id]);
        ok(null, 'Enseignant désactivé (des soutenances y sont liées)');
    } else {
        $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$id]);
        ok(null, 'Enseignant supprimé');
    }
}