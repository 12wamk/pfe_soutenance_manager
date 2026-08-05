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

    // ---- Secours : Gemini (gratuit) en premier, puis Anthropic/OpenAI si configurés ----
    if (defined('GEMINI_API_KEY') && GEMINI_API_KEY) {
        $reponseIA = appellerGemini($message, $auth);
        if ($reponseIA) return $reponseIA;
    }
    if (ANTHROPIC_API_KEY) {
        $reponseIA = appellerAnthropic($message, $auth);
        if ($reponseIA) return $reponseIA;
    } elseif (OPENAI_API_KEY) {
        $reponseIA = appellerOpenAI($message, $auth);
        if ($reponseIA) return $reponseIA;
    }

    return "Je n'ai pas encore de réponse précise pour cette question 🤔. Essayez de reformuler, ou tapez « aide » pour voir ce que je sais faire. Pour toute question spécifique, contactez l'administrateur.\n\n💡 Astuce admin : connectez une clé API (Gemini, Anthropic ou OpenAI) dans `backend/config/chatbot.php` pour que je puisse répondre à des questions plus ouvertes.";
}

/** Appel à l'API Gemini (Google AI Studio) — gratuit, essayé en priorité. */
function appellerGemini($message, $auth) {
    $contexte = CHATBOT_CONTEXTE_APPLICATION . "\n\nUtilisateur actuel : {$auth['prenom']} {$auth['nom']}, rôle : {$auth['role']}.";

    $payload = json_encode([
        'system_instruction' => ['parts' => [['text' => $contexte]]],
        'contents' => [['role' => 'user', 'parts' => [['text' => $message]]]],
        'generationConfig' => [
    'temperature' => 0.4,
    'maxOutputTokens' => 1024,
    'thinkingConfig' => ['thinkingBudget' => 0],
],
    ]);

    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . GEMINI_MODEL . ':generateContent?key=' . GEMINI_API_KEY;

    for ($tentative = 1; $tentative <= 2; $tentative++) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 15,
        ]);
        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200) {
            $data = json_decode($result, true);
            return $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
        }

        // 503 (surcharge) ou timeout : on retente une fois après une courte pause
        if ($tentative === 1 && ($httpCode === 503 || $httpCode === 0)) {
            error_log("Chatbot Gemini : tentative $tentative échouée (HTTP $httpCode), nouvel essai...");
            usleep(500000); // pause de 0.5 seconde
            continue;
        }

        error_log("Chatbot Gemini erreur définitive (HTTP $httpCode): $result");
        return null;
    }

    return null;
}
/** Appel optionnel à l'API Anthropic (Claude) via cURL natif — aucune librairie externe requise. */
function appellerAnthropic($message, $auth) {
    $contexte = CHATBOT_CONTEXTE_APPLICATION . "\n\nUtilisateur actuel : {$auth['prenom']} {$auth['nom']}, rôle : {$auth['role']}.";

    $payload = json_encode([
        'model' => ANTHROPIC_MODEL,
        'max_tokens' => 500,
        'system' => $contexte,
        'messages' => [['role' => 'user', 'content' => $message]],
    ]);

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-api-key: ' . ANTHROPIC_API_KEY,
            'anthropic-version: 2023-06-01',
        ],
        CURLOPT_TIMEOUT => 20,
    ]);
    $result = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($httpCode !== 200 || !$result) {
        error_log("Chatbot Anthropic erreur (HTTP $httpCode): " . ($curlErr ?: $result));
        return null;
    }
    $data = json_decode($result, true);
    return $data['content'][0]['text'] ?? null;
}

/** Alternative OpenAI (GPT), utilisée si ANTHROPIC_API_KEY est vide et OPENAI_API_KEY renseignée. */
function appellerOpenAI($message, $auth) {
    $contexte = CHATBOT_CONTEXTE_APPLICATION . "\n\nUtilisateur actuel : {$auth['prenom']} {$auth['nom']}, rôle : {$auth['role']}.";

    $payload = json_encode([
        'model' => OPENAI_MODEL,
        'max_tokens' => 500,
        'messages' => [
            ['role' => 'system', 'content' => $contexte],
            ['role' => 'user', 'content' => $message],
        ],
    ]);

    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Connection: close'],
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FRESH_CONNECT => true,
        CURLOPT_FORBID_REUSE => true,
    ]);
    $result = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($httpCode !== 200 || !$result) {
        error_log("Chatbot OpenAI erreur (HTTP $httpCode): " . ($curlErr ?: $result));
        return null;
    }
    $data = json_decode($result, true);
    return $data['choices'][0]['message']['content'] ?? null;
}