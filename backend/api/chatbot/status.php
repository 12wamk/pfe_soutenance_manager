<?php
/** Indique si le chatbot dispose d'une clé IA configurée, sans jamais exposer la clé elle-même. */
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/chatbot.php';

jwtRequireAuth();

$provider = null;
if (ANTHROPIC_API_KEY) $provider = 'Claude';
elseif (OPENAI_API_KEY) $provider = 'GPT';

ok(['mode' => $provider ? 'ia' : 'local', 'provider' => $provider]);
