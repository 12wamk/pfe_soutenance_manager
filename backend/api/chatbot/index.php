<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/chatbot.php';

$auth = jwtRequireAuth();
$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->prepare("SELECT role, message, created_at FROM chatbot_messages WHERE user_id = ? ORDER BY id ASC LIMIT 100");
    $stmt->execute([$auth['id']]);
    ok($stmt->fetchAll());
}

if ($method !== 'POST') fail('Méthode non autorisée', 405);

$d = body();
$message = trim($d['message'] ?? '');
if (!$message) fail('Message vide');

$pdo->prepare("INSERT INTO chatbot_messages (user_id, role, message) VALUES (?, 'user', ?)")->execute([$auth['id'], $message]);

$reponse = repondre($message, $auth, $pdo);

$pdo->prepare("INSERT INTO chatbot_messages (user_id, role, message) VALUES (?, 'bot', ?)")->execute([$auth['id'], $reponse]);

ok(['reponse' => $reponse]);

// ============================================================
// MOTEUR DE RÉPONSES
// ============================================================

function normaliser($texte) {
    $texte = mb_strtolower($texte, 'UTF-8');
    $remplacements = ['à'=>'a','â'=>'a','ä'=>'a','é'=>'e','è'=>'e','ê'=>'e','ë'=>'e','î'=>'i','ï'=>'i','ô'=>'o','ö'=>'o','ù'=>'u','û'=>'u','ü'=>'u','ç'=>'c'];
    return strtr($texte, $remplacements);
}

function contient($texte, array $motsClefs) {
    foreach ($motsClefs as $mot) {
        if (str_contains($texte, $mot)) return true;
    }
    return false;
}

function repondre($message, $auth, $pdo) {
    $m = normaliser($message);
    $prenom = $auth['prenom'] ?? '';

    // ---- Salutations ----
    if (contient($m, ['bonjour', 'salut', 'bonsoir', 'hello', 'coucou'])) {
        return "Bonjour $prenom 👋 Je suis l'assistant de la plateforme. Je peux vous renseigner sur vos soutenances, vos invitations jury, vos disponibilités, ou expliquer le fonctionnement de l'application. Que puis-je faire pour vous ?";
    }

    if (contient($m, ['merci', 'super', 'top', 'parfait'])) {
        return "Avec plaisir 😊 Autre chose ?";
    }

    // ---- Mes étudiants (encadrant) ----
    if (contient($m, ['mes etudiants', 'combien d etudiant', "j'encadre", 'jencadre'])) {
        $stmt = $pdo->prepare("SELECT COUNT(*) c FROM etudiants WHERE encadrant_id = ?");
        $stmt->execute([$auth['id']]);
        $n = $stmt->fetch()['c'];
        return $n > 0
            ? "Vous encadrez actuellement **$n étudiant(s)**. Vous pouvez consulter la liste dans « Mes Étudiants »."
            : "Vous n'encadrez actuellement aucun étudiant.";
    }

    // ---- Prochaine soutenance ----
    if (contient($m, ['prochaine soutenance', 'quand est ma soutenance', 'ma prochaine', 'planning'])) {
        $stmt = $pdo->prepare("
            SELECT s.date, s.heure, s.salle, CONCAT(e.prenom,' ',e.nom) as etudiant
            FROM soutenances s JOIN etudiants e ON s.etudiant_id = e.id
            WHERE (s.encadrant_id = ? OR s.rapporteur_id = ? OR s.president_id = ?) AND s.date >= CURDATE()
            ORDER BY s.date ASC, s.heure ASC LIMIT 1
        ");
        $stmt->execute([$auth['id'], $auth['id'], $auth['id']]);
        $s = $stmt->fetch();
        if (!$s) return "Vous n'avez aucune soutenance à venir pour le moment.";
        $heure = $s['heure'] ? substr($s['heure'], 0, 5) : 'heure non fixée';
        return "Votre prochaine soutenance concerne **{$s['etudiant']}**, le " . date('d/m/Y', strtotime($s['date'])) . " à $heure" . ($s['salle'] ? ", salle {$s['salle']}" : '') . ".";
    }

    // ---- Invitations jury en attente ----
    if (contient($m, ['invitation', 'jury en attente', 'rapporteur', 'president de jury'])) {
        $stmt = $pdo->prepare("SELECT COUNT(*) c FROM invitations_jury WHERE enseignant_id = ? AND statut = 'en_attente'");
        $stmt->execute([$auth['id']]);
        $n = $stmt->fetch()['c'];
        return $n > 0
            ? "Vous avez **$n invitation(s) jury en attente** de réponse. Rendez-vous dans « Invitations Jury » pour accepter ou refuser."
            : "Vous n'avez aucune invitation jury en attente actuellement.";
    }

    // ---- Charge jury / réciprocité ----
    if (contient($m, ['charge jury', 'reciprocite', 'combien de fois rapporteur', 'combien de fois president', 'sur-sollicite', 'sous-sollicite'])) {
        $stmt = $pdo->prepare("
            SELECT
                (SELECT COUNT(*) FROM etudiants WHERE encadrant_id = ?) AS objectif,
                (SELECT COUNT(*) FROM invitations_jury WHERE enseignant_id = ? AND role='rapporteur' AND statut='acceptee') AS nb_rap,
                (SELECT COUNT(*) FROM invitations_jury WHERE enseignant_id = ? AND role='president' AND statut='acceptee') AS nb_pres
        ");
        $stmt->execute([$auth['id'], $auth['id'], $auth['id']]);
        $c = $stmt->fetch();
        return "Règle de réciprocité : vous encadrez **{$c['objectif']} étudiant(s)**, donc l'objectif est d'être désigné {$c['objectif']} fois rapporteur et {$c['objectif']} fois président. "
            . "Actuellement : **{$c['nb_rap']} fois rapporteur** et **{$c['nb_pres']} fois président**. "
            . "Consultez la page « Charge Jury » pour le détail.";
    }

    // ---- Disponibilités ----
    if (contient($m, ['disponibilite', 'je suis absent', 'marquer absent'])) {
        return "Pour gérer vos disponibilités, allez dans « Disponibilités » : cliquez sur un jour ouvert du calendrier pour basculer entre Disponible et Absent. Les jours fériés et weekends ne sont pas modifiables.";
    }

    // ---- Comment planifier une soutenance ----
    if (contient($m, ['comment planifier', 'creer une soutenance', 'nouvelle soutenance', 'ajouter une soutenance'])) {
        return "Pour planifier une soutenance : allez dans « Soutenances » → « Planifier une soutenance ». Choisissez l'étudiant, un rapporteur et un président (différents de vous et l'un de l'autre), une date parmi les jours ouverts, et éventuellement un créneau horaire — sinon le système en choisit un automatiquement.";
    }

    // ---- Règles de quota / max par jour ----
    if (contient($m, ['quota', 'max par jour', 'maximum de soutenance', 'combien de soutenances par jour'])) {
        $stmt = $pdo->query("SELECT * FROM periode ORDER BY id DESC LIMIT 1");
        $p = $stmt->fetch();
        $texte = "Le nombre maximum de soutenances par jour est défini par l'administrateur, jour par jour (les jours n'ont pas tous le même quota). ";
        if ($p) $texte .= "Le quota par défaut de la période active est de **{$p['max_par_jour']}** soutenances/jour, mais certains jours peuvent différer.";
        return $texte;
    }

    // ---- Période / jours fériés ----
    if (contient($m, ['periode', 'jour ferie', 'jours feries', 'calendrier'])) {
        $stmt = $pdo->query("SELECT * FROM periode ORDER BY id DESC LIMIT 1");
        $p = $stmt->fetch();
        if (!$p) return "Aucune période de soutenances n'a encore été configurée par l'administrateur.";
        return "La période active va du " . date('d/m/Y', strtotime($p['date_debut'])) . " au " . date('d/m/Y', strtotime($p['date_fin'])) . ". Les jours fériés tunisiens et les weekends sont automatiquement exclus du calendrier.";
    }

    // ---- Mot de passe / profil ----
    if (contient($m, ['mot de passe', 'changer mon mot', 'profil', 'photo de profil'])) {
        return "Vous pouvez modifier votre mot de passe et vos informations depuis la page « Mon Profil » (menu utilisateur en haut à droite).";
    }

    // ---- Participation inter-département ----
    if (contient($m, ['participation', 'autre departement', "hors departement", 'inter-departement'])) {
        return "Pour participer aux soutenances d'un autre département, utilisez « Participation inter-département » : indiquez le département cible, le rôle souhaité et le nombre de fois. Le chef de département concerné validera votre demande.";
    }

    // ---- Aide générale ----
    if (contient($m, ['aide', 'help', 'que peux-tu faire', 'que sais-tu faire', 'commandes'])) {
        return "Je peux vous renseigner sur :\n• vos étudiants encadrés\n• votre prochaine soutenance\n• vos invitations jury en attente\n• votre charge jury (réciprocité)\n• comment planifier une soutenance\n• vos disponibilités\n• la période et le calendrier\n• la participation inter-département\n\nPosez-moi votre question directement !";
    }

    // ---- Secours : Ollama avec RAG (IA locale + données réelles) ----
    $donnees = recupererDonneesRAG($auth, $pdo);
    $contexteRAG = construirePromptRAG($donnees, $auth);
    $resultat = callOllamaFallback($message, $contexteRAG);
    if ($resultat['ok'] && $resultat['text']) {
        return $resultat['text'];
    }

    // Ollama indisponible ou erreur → réponse locale par défaut
    return "Je n'ai pas encore de réponse précise pour cette question 🤔. Essayez de reformuler, ou tapez « aide » pour voir ce que je sais faire. Pour toute question spécifique, contactez l'administrateur.\n\n💡 Astuce admin : installez Ollama (https://ollama.com) et lancez `ollama pull " . OLLAMA_MODEL . "` pour activer les réponses IA locales.";
}

// ============================================================
// RAG — Récupération et injection des données utilisateur
// ============================================================

/**
 * Récupère toutes les données pertinentes de l'utilisateur depuis la base.
 * Ces données seront injectées dans le prompt Ollama pour que le modèle
 * réponde UNIQUEMENT à partir de ces informations.
 */
function recupererDonneesRAG(array $auth, PDO $pdo): array {
    $userId = $auth['id'];
    $donnees = [];

    // --- Profil utilisateur ---
    $stmt = $pdo->prepare("SELECT u.*, d.nom as departement_nom FROM users u LEFT JOIN departements d ON u.departement_id = d.id WHERE u.id = ?");
    $stmt->execute([$userId]);
    $donnees['profil'] = $stmt->fetch() ?: null;

    // --- Étudiants encadrés ---
    $stmt = $pdo->prepare("SELECT id, code_etudiant, nom, prenom, niveau, option_id, titre_sujet, date_debut, date_fin FROM etudiants WHERE encadrant_id = ? ORDER BY nom");
    $stmt->execute([$userId]);
    $donnees['etudiants'] = $stmt->fetchAll();

    // --- Soutenances (à venir et passées) ---
    $stmt = $pdo->prepare("
        SELECT s.*, 
            CONCAT(e.prenom, ' ', e.nom) as etudiant_nom,
            (SELECT GROUP_CONCAT(CONCAT(eo.prenom, ' ', eo.nom) SEPARATOR ' & ')
             FROM soutenance_etudiants se JOIN etudiants eo ON eo.id = se.etudiant_id
             WHERE se.soutenance_id = s.id AND se.etudiant_id != s.etudiant_id) as autres_membres,
            enc.prenom as encadrant_prenom, enc.nom as encadrant_nom,
            rap.prenom as rapporteur_prenom, rap.nom as rapporteur_nom,
            pres.prenom as president_prenom, pres.nom as president_nom
        FROM soutenances s 
        JOIN etudiants e ON s.etudiant_id = e.id
        LEFT JOIN users enc ON s.encadrant_id = enc.id
        LEFT JOIN users rap ON s.rapporteur_id = rap.id
        LEFT JOIN users pres ON s.president_id = pres.id
        WHERE (s.encadrant_id = ? OR s.rapporteur_id = ? OR s.president_id = ?)
        ORDER BY s.date DESC, s.heure DESC
        LIMIT 10
    ");
    $stmt->execute([$userId, $userId, $userId]);
    $donnees['soutenances'] = $stmt->fetchAll();

    // --- Invitations jury ---
    $stmt = $pdo->prepare("
        SELECT ij.*, s.date as soutenance_date, s.heure as soutenance_heure,
            CONCAT(e.prenom, ' ', e.nom) as etudiant_nom
        FROM invitations_jury ij
        JOIN soutenances s ON ij.soutenance_id = s.id
        JOIN etudiants e ON s.etudiant_id = e.id
        WHERE ij.enseignant_id = ?
        ORDER BY s.date DESC
        LIMIT 10
    ");
    $stmt->execute([$userId]);
    $donnees['invitations'] = $stmt->fetchAll();

    // --- Charge jury (réciprocité) ---
    $stmt = $pdo->prepare("
        SELECT
            (SELECT COUNT(*) FROM etudiants WHERE encadrant_id = ?) AS objectif,
            (SELECT COUNT(*) FROM invitations_jury WHERE enseignant_id = ? AND role='rapporteur' AND statut='acceptee') AS nb_rapporteur,
            (SELECT COUNT(*) FROM invitations_jury WHERE enseignant_id = ? AND role='president' AND statut='acceptee') AS nb_president,
            (SELECT COUNT(*) FROM invitations_jury WHERE enseignant_id = ? AND statut='en_attente') AS nb_en_attente,
            (SELECT COUNT(*) FROM invitations_jury WHERE enseignant_id = ? AND statut='refusee') AS nb_refusees
    ");
    $stmt->execute([$userId, $userId, $userId, $userId, $userId]);
    $donnees['charge_jury'] = $stmt->fetch();

    // --- Disponibilités (30 prochains jours) ---
    $stmt = $pdo->prepare("SELECT date, statut FROM disponibilites WHERE enseignant_id = ? AND date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) ORDER BY date");
    $stmt->execute([$userId]);
    $donnees['disponibilites'] = $stmt->fetchAll();

    // --- Période active ---
    $stmt = $pdo->query("SELECT * FROM periode ORDER BY id DESC LIMIT 1");
    $donnees['periode'] = $stmt->fetch() ?: null;

    // --- Jours du calendrier (à venir) ---
    $stmt = $pdo->prepare("SELECT jc.* FROM jours_calendrier jc JOIN periode p ON jc.periode_id = p.id WHERE p.id = (SELECT id FROM periode ORDER BY id DESC LIMIT 1) AND jc.date >= CURDATE() AND jc.actif = 1 ORDER BY jc.date LIMIT 15");
    $stmt->execute();
    $donnees['jours_a_venir'] = $stmt->fetchAll();

    // --- Demandes de participation inter-département ---
    $stmt = $pdo->prepare("
        SELECT dp.*, d.nom as departement_cible_nom 
        FROM demandes_participation dp 
        LEFT JOIN departements d ON dp.departement_cible_id = d.id
        WHERE dp.enseignant_id = ?
        ORDER BY dp.id DESC
        LIMIT 5
    ");
    $stmt->execute([$userId]);
    $donnees['participations'] = $stmt->fetchAll();

    // --- Statistiques globales (si admin) ---
    if (in_array($auth['role'], ['admin', 'chef_dept'])) {
        $donnees['stats'] = [
            'total_etudiants' => $pdo->query("SELECT COUNT(*) FROM etudiants")->fetchColumn(),
            'total_soutenances' => $pdo->query("SELECT COUNT(*) FROM soutenances")->fetchColumn(),
            'soutenances_planifiees' => $pdo->query("SELECT COUNT(*) FROM soutenances WHERE statut = 'planifiee'")->fetchColumn(),
            'soutenances_validees' => $pdo->query("SELECT COUNT(*) FROM soutenances WHERE statut = 'validee'")->fetchColumn(),
            'soutenances_sans_date' => $pdo->query("SELECT COUNT(*) FROM soutenances WHERE statut = 'sans_date'")->fetchColumn(),
            'total_enseignants' => $pdo->query("SELECT COUNT(*) FROM users WHERE role != 'admin'")->fetchColumn(),
        ];
    }

    // --- Notifications non lues ---
    $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? AND lu = 0 ORDER BY created_at DESC LIMIT 5");
    $stmt->execute([$userId]);
    $donnees['notifications'] = $stmt->fetchAll();

    return $donnees;
}

/**
 * Construit le prompt RAG structuré à partir des données récupérées.
 * Le système instruction demande explicitement de répondre UNIQUEMENT
 * à partir des données fournies — jamais d'inventer.
 */
function construirePromptRAG(array $donnees, array $auth): string {
    $profil = $donnees['profil'];

    // Instruction système stricte
    $prompt = CHATBOT_CONTEXTE_APPLICATION . "\n\n";
    $prompt .= "═══════════════════════════════════════════════\n";
    $prompt .= "DONNÉES RÉELLES DE L'UTILISATEUR CONNECTÉ\n";
    $prompt .= "═══════════════════════════════════════════════\n\n";

    $prompt .= "PROFIL :\n";
    $prompt .= "- Nom : {$profil['prenom']} {$profil['nom']}\n";
    $prompt .= "- Rôle : {$profil['role']}\n";
    $prompt .= "- Département : " . ($profil['departement_nom'] ?? 'Non assigné') . "\n";
    $prompt .= "- Email : {$profil['email']}\n";
    $prompt .= "- Grade : " . ($profil['grade'] ?? 'Non spécifié') . "\n";
    $prompt .= "- Max soutenances/jour : {$profil['max_soutenances_jour']}\n\n";

    // Étudiants
    $prompt .= "ÉTUDIENTS ENCADRÉS (" . count($donnees['etudiants']) . ") :\n";
    if (empty($donnees['etudiants'])) {
        $prompt .= "- Aucun étudiant encadré actuellement.\n";
    } else {
        foreach ($donnees['etudiants'] as $e) {
            $prompt .= "- [{$e['code_etudiant']}] {$e['prenom']} {$e['nom']} | Niveau: {$e['niveau']} | Sujet: " . ($e['titre_sujet'] ?? 'Non défini') . "\n";
        }
    }
    $prompt .= "\n";

    // Soutenances
    $prompt .= "SOUTENANCES (" . count($donnees['soutenances']) . " dernières) :\n";
    if (empty($donnees['soutenances'])) {
        $prompt .= "- Aucune soutenance trouvée.\n";
    } else {
        foreach ($donnees['soutenances'] as $s) {
            $date = date('d/m/Y', strtotime($s['date']));
            $heure = $s['heure'] ? substr($s['heure'], 0, 5) : 'heure non fixée';
            $groupe = $s['autres_membres'] ? " (en groupe avec {$s['autres_membres']})" : '';
            $prompt .= "- Le $date à $heure | Étudiant: {$s['etudiant_nom']}$groupe | Statut: {$s['statut']} | Salle: " . ($s['salle'] ?? 'non assignée') . "\n";
            $prompt .= "  Encadrant: {$s['encadrant_prenom']} {$s['encadrant_nom']} | Rapporteur: " . ($s['rapporteur_nom'] ? "{$s['rapporteur_prenom']} {$s['rapporteur_nom']}" : 'non assigné') . " | Président: " . ($s['president_nom'] ? "{$s['president_prenom']} {$s['president_nom']}" : 'non assigné') . "\n";
        }
    }
    $prompt .= "\n";

    // Invitations jury
    $prompt .= "INVITATIONS JURY (" . count($donnees['invitations']) . ") :\n";
    if (empty($donnees['invitations'])) {
        $prompt .= "- Aucune invitation jury.\n";
    } else {
        foreach ($donnees['invitations'] as $inv) {
            $date = date('d/m/Y', strtotime($inv['soutenance_date']));
            $prompt .= "- Rôle: {$inv['role']} | Soutenance de {$inv['etudiant_nom']} le $date | Statut: {$inv['statut']} | Reçue le: " . date('d/m/Y', strtotime($inv['date_envoi'])) . "\n";
        }
    }
    $prompt .= "\n";

    // Charge jury
    $cj = $donnees['charge_jury'];
    $prompt .= "CHARGE JURY (réciprocité) :\n";
    $prompt .= "- Objectif (basé sur étudiants encadrés) : {$cj['objectif']} fois rapporteur + {$cj['objectif']} fois président\n";
    $prompt .= "- Actuellement : {$cj['nb_rapporteur']} fois rapporteur, {$cj['nb_president']} fois président\n";
    $prompt .= "- Invitations en attente : {$cj['nb_en_attente']} | Refusées : {$cj['nb_refusees']}\n\n";

    // Disponibilités
    $prompt .= "DISPONIBILITÉS (30 prochains jours) :\n";
    if (empty($donnees['disponibilites'])) {
        $prompt .= "- Aucune disponibilité enregistrée (par défaut disponible sur les jours ouverts).\n";
    } else {
        $absences = array_filter($donnees['disponibilites'], fn($d) => $d['statut'] === 'absent');
        $prompt .= "- Jours marqués absents : " . count($absences) . "\n";
        if (count($absences) > 0) {
            foreach ($absences as $abs) {
                $prompt .= "  • " . date('d/m/Y', strtotime($abs['date'])) . "\n";
            }
        }
    }
    $prompt .= "\n";

    // Période
    $p = $donnees['periode'];
    $prompt .= "PÉRIODE ACTIVE :\n";
    if ($p) {
        $prompt .= "- Du " . date('d/m/Y', strtotime($p['date_debut'])) . " au " . date('d/m/Y', strtotime($p['date_fin'])) . "\n";
        $prompt .= "- Max soutenances/jour par défaut : {$p['max_par_jour']}\n";
        $prompt .= "- Année universitaire : {$p['annee_universitaire']}\n";
    } else {
        $prompt .= "- Aucune période configurée.\n";
    }
    $prompt .= "\n";

    // Jours à venir
    $prompt .= "PROCHAINS JOURS OUVERTS (" . count($donnees['jours_a_venir']) . ") :\n";
    foreach ($donnees['jours_a_venir'] as $j) {
        $prompt .= "- " . date('d/m/Y', strtotime($j['date'])) . " (max {$j['max_soutenances']} soutenances)\n";
    }
    $prompt .= "\n";

    // Participations inter-département
    if (!empty($donnees['participations'])) {
        $prompt .= "PARTICIPATIONS INTER-DÉPARTEMENT :\n";
        foreach ($donnees['participations'] as $part) {
            $prompt .= "- Département cible: {$part['departement_cible_nom']} | Rôle: {$part['role_souhaite']} | Nombre: {$part['nombre_souhaite']} | Statut: {$part['statut']}\n";
        }
        $prompt .= "\n";
    }

    // Notifications
    if (!empty($donnees['notifications'])) {
        $prompt .= "NOTIFICATIONS NON LUES (" . count($donnees['notifications']) . ") :\n";
        foreach ($donnees['notifications'] as $notif) {
            $prompt .= "- [{$notif['type']}] {$notif['titre']}\n";
        }
        $prompt .= "\n";
    }

    // Stats admin
    if (isset($donnees['stats'])) {
        $prompt .= "STATISTIQUES GLOBALES :\n";
        $prompt .= "- Total étudiants : {$donnees['stats']['total_etudiants']}\n";
        $prompt .= "- Total soutenances : {$donnees['stats']['total_soutenances']}\n";
        $prompt .= "- Planifiées : {$donnees['stats']['soutenances_planifiees']} | Validées : {$donnees['stats']['soutenances_validees']} | Sans date : {$donnees['stats']['soutenances_sans_date']}\n";
        $prompt .= "- Total enseignants : {$donnees['stats']['total_enseignants']}\n\n";
    }

    // Instruction critique anti-hallucination
    $prompt .= "═══════════════════════════════════════════════\n";
    $prompt .= "RÈGLES ABSOLUES DE RÉPONSE :\n";
    $prompt .= "═══════════════════════════════════════════════\n";
    $prompt .= "1. Réponds UNIQUEMENT à partir des données ci-dessus.\n";
    $prompt .= "2. Si une information n'est PAS dans ces données, dis clairement qu'elle n'est pas disponible — ne JAMAIS inventer.\n";
    $prompt .= "3. Utilise les noms, dates et chiffres EXACTEMENT comme ils apparaissent.\n";
    $prompt .= "4. Si la question ne concerne pas les données fournies, oriente l'utilisateur vers la page correspondante.\n";
    $prompt .= "5. Réponds en français, de façon brève et factuelle.\n";

    return $prompt;
}
