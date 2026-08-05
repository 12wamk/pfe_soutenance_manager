<?php
/**
 * backend/config/gemini.php
 *
 * Configuration + appel de l'API Gemini (Google AI Studio) en secours
 * pour le chatbot, quand le mode local (règles + SQL) ne couvre pas
 * la question de l'utilisateur.
 *
 * Compatible avec l'architecture "PHP natif + cURL" du cahier des charges
 * (pas de Composer, pas de librairie tierce).
 */

// ── 1. Configuration ────────────────────────────────────────────────
// La clé est lue depuis une variable d'environnement système, jamais
// codée en dur. Sous XAMPP/Windows, définis-la dans les variables
// d'environnement, ou charge-la depuis un fichier .env "maison"
// (voir load_env() plus bas) si tu préfères un fichier local ignoré par git.

define('GEMINI_API_KEY', getenv('GEMINI_API_KEY') ?: '');
define('GEMINI_MODEL', 'gemini-2.5-flash'); // modèle gratuit recommandé (voir note ci-dessous)
define('GEMINI_ENDPOINT', 'https://generativelanguage.googleapis.com/v1beta/models/' . GEMINI_MODEL . ':generateContent');
define('GEMINI_TIMEOUT_SECONDS', 15);

/**
 * Charge un fichier .env simple (KEY=VALUE par ligne) s'il existe.
 * À appeler une fois au démarrage (ex. dans config/database.php ou un bootstrap.php).
 * Évite d'exposer la clé API dans le code versionné.
 */
function loadEnvFile(string $path): void
{
    if (!file_exists($path)) {
        return;
    }
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        putenv(trim($key) . '=' . trim($value));
    }
}

// ── 2. Appel de l'API Gemini ────────────────────────────────────────

/**
 * Interroge Gemini pour une question ouverte non couverte par le mode local.
 *
 * @param string $userMessage   Message de l'utilisateur.
 * @param string $systemContext Contexte système décrivant l'application et les règles métier
 *                              (le même contexte que celui prévu pour Claude/GPT dans le CDC).
 * @return array{ok: bool, text: ?string, error: ?string, fallback_reason: ?string}
 */
function callGeminiFallback(string $userMessage, string $systemContext): array
{
    if (empty(GEMINI_API_KEY)) {
        return [
            'ok' => false,
            'text' => null,
            'error' => 'GEMINI_API_KEY non configurée',
            'fallback_reason' => 'not_configured',
        ];
    }

    $payload = [
        'system_instruction' => [
            'parts' => [['text' => $systemContext]],
        ],
        'contents' => [
            [
                'role' => 'user',
                'parts' => [['text' => $userMessage]],
            ],
        ],
        'generationConfig' => [
            'temperature' => 0.4,
            'maxOutputTokens' => 512,
        ],
    ];

    $ch = curl_init(GEMINI_ENDPOINT . '?key=' . GEMINI_API_KEY);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT => GEMINI_TIMEOUT_SECONDS,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return [
            'ok' => false,
            'text' => null,
            'error' => "Erreur réseau: $curlError",
            'fallback_reason' => 'network_error',
        ];
    }

    // Quota gratuit dépassé (429) → on retombe proprement sur le mode local,
    // sans faire planter le chatbot.
    if ($httpCode === 429) {
        return [
            'ok' => false,
            'text' => null,
            'error' => 'Quota Gemini dépassé (429)',
            'fallback_reason' => 'rate_limited',
        ];
    }

    if ($httpCode !== 200) {
        return [
            'ok' => false,
            'text' => null,
            'error' => "Réponse HTTP $httpCode: $response",
            'fallback_reason' => 'api_error',
        ];
    }

    $data = json_decode($response, true);
    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;

    if ($text === null) {
        return [
            'ok' => false,
            'text' => null,
            'error' => 'Réponse Gemini vide ou format inattendu',
            'fallback_reason' => 'empty_response',
        ];
    }

    return [
        'ok' => true,
        'text' => trim($text),
        'error' => null,
        'fallback_reason' => null,
    ];
}
