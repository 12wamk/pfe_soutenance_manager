<?php
/** Indique si Ollama est disponible pour le chatbot. */
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/chatbot.php';

jwtRequireAuth();

$status = ollamaStatus();
$modelConfigured = in_array(OLLAMA_MODEL, $status['models']) || in_array(OLLAMA_MODEL . ':latest', $status['models']);

ok([
    'mode' => $status['available'] && $modelConfigured ? 'ia' : 'local',
    'provider' => $status['available'] && $modelConfigured ? 'Ollama' : null,
    'model' => OLLAMA_MODEL,
    'ollama_url' => OLLAMA_URL,
    'models_disponibles' => $status['models'],
]);
