<?php
/**
 * Configuration du chatbot.
 *
 * MODE LOCAL (par défaut, sans clé) : le chatbot répond via des règles + des
 * requêtes en base sur les données réelles de l'utilisateur connecté. Gratuit,
 * fonctionne hors-ligne, mais ne couvre que les questions prévues dans le code.
 *
 * MODE IA (recommandé pour les questions ouvertes) : dès qu'une clé API est
 * renseignée ci-dessous, toute question non reconnue par les règles est envoyée
 * à un modèle de langage (Claude ou GPT, au choix) qui répond intelligemment,
 * avec une connaissance complète du fonctionnement de la plateforme.
 *
 * ---- Comment obtenir une clé ----
 * • Anthropic (Claude) : https://console.anthropic.com/  → Settings → API Keys
 * • OpenAI (GPT)       : https://platform.openai.com/api-keys
 * Les deux sont payantes à l'usage (quelques centimes par conversation), mais
 * proposent en général un petit crédit gratuit à la création du compte.
 *
 * Ne renseignez qu'UNE SEULE des deux clés ci-dessous (Anthropic est utilisée
 * en priorité si les deux sont renseignées).
 */
// ── Chargement du fichier .env (backend/.env) ───────────────────────
function loadEnvFile(string $path): void {
    if (!file_exists($path)) return;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
        [$key, $value] = explode('=', $line, 2);
        putenv(trim($key) . '=' . trim($value));
    }
}
loadEnvFile(__DIR__ . '/../.env');
define('ANTHROPIC_API_KEY', ''); // ex: 'sk-ant-api03-...'
define('ANTHROPIC_MODEL', 'claude-sonnet-4-5-20250929');

define('OPENAI_API_KEY', ''); // ex: 'sk-proj-...'
define('OPENAI_MODEL', 'gpt-4o-mini');
define('GEMINI_API_KEY', getenv('GEMINI_API_KEY') ?: '');
define('GEMINI_MODEL', 'gemini-3.5-flash');
/**
 * Connaissance complète de l'application, transmise au modèle de langage en
 * secours pour qu'il réponde correctement même aux questions ouvertes sur le
 * fonctionnement, les règles métier, ou la navigation — sans halluciner.
 */
define('CHATBOT_CONTEXTE_APPLICATION', <<<TEXTE
Tu es l'assistant intégré à "PFE Manager ENET'COM", une plateforme de gestion des
soutenances de Projets de Fin d'Études.

RÔLES DU SYSTÈME :
- Administrateur : configure la période/calendrier, importe étudiants et enseignants,
  gère les départements et options, paramètre les notifications.
- Chef de département : valide/refuse les soutenances planifiées, traite les demandes
  de participation inter-département, peut répondre à une invitation jury au nom d'un
  enseignant.
- Encadrant : gère ses étudiants, planifie leurs soutenances, répond aux invitations
  jury, gère ses disponibilités.

PAGES PRINCIPALES : Tableau de bord, Enseignants, Étudiants, Soutenances, Import CSV
(étudiants et enseignants), Période & Calendrier, Départements & Options, Participation
inter-département, Charge Jury, Invitations Jury, Disponibilités, Profil, Paramètres.

RÈGLES MÉTIER (R1 à R10) :
R1 - Le président et le rapporteur d'une soutenance doivent être deux personnes différentes.
R2 - L'encadrant ne peut pas être lui-même président ou rapporteur de sa propre soutenance.
R3 - La charge totale d'un enseignant par jour (département + hors département, tous
     rôles confondus) ne doit pas dépasser le quota maximum défini pour ce jour.
R4 - Deux soutenances ne peuvent pas avoir lieu dans la même salle au même créneau.
R5 - Un enseignant ne peut pas être assigné à deux soutenances au même créneau horaire.
R6 - Une soutenance ne peut être planifiée que sur un jour actif du calendrier (les
     jours fériés tunisiens et les weekends sont exclus par défaut).
R7 - Une soutenance validée par le chef de département n'est plus modifiable par l'encadrant.
R8 - Une invitation jury sans réponse au-delà du délai paramétré devient automatiquement
     un refus (expiration).
R9 - Règle de réciprocité (non bloquante) : un encadrant de N étudiants devrait être
     désigné N fois rapporteur et N fois président sur l'ensemble de la session. Le
     système alerte en cas de sur-sollicitation ou sous-sollicitation, sans bloquer.
R10 - L'heure d'une soutenance est facultative ; si elle n'est pas précisée, le système
      assigne automatiquement le prochain créneau libre (calculé à partir de l'heure de
      départ, de la durée d'une soutenance et de la durée de pause, tous paramétrables
      par l'administrateur).

CONSIGNES DE RÉPONSE :
- Réponds toujours en français, de façon brève, claire et concrète.
- Si la question porte sur des données précises et personnelles de l'utilisateur
  (nombre exact de ses soutenances, dates précises...) que tu n'as pas reçues dans ce
  message, ne les invente jamais : oriente-le vers la page correspondante de
  l'application plutôt que de deviner un chiffre.
- Pour les questions générales sur le fonctionnement, les règles, ou la navigation,
  réponds directement et complètement à partir des informations ci-dessus.
TEXTE);
