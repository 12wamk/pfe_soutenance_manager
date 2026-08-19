<?php

$RATELIMIT_DIR = __DIR__ . '/../data/ratelimit/';

function ratelimitStoreDir() {
    global $RATELIMIT_DIR;
    if (!is_dir($RATELIMIT_DIR)) {
        @mkdir($RATELIMIT_DIR, 0775, true);
    }
    return $RATELIMIT_DIR;
}

function ratelimitCheck($cle, $max, $fenetreSecondes, $message = 'Trop de tentatives, réessayez plus tard') {
    $dir = ratelimitStoreDir();
    $fichier = $dir . md5($cle) . '.txt';
    $now = time();
    $tentatives = [];
    if (is_file($fichier)) {
        $contenu = @file_get_contents($fichier);
        if ($contenu !== false) {
            $tentatives = array_filter(array_map('intval', explode(',', $contenu)), fn($t) => $t > $now - $fenetreSecondes);
        }
    }
    $tentatives[] = $now;
    $tentatives = array_values(array_slice($tentatives, -$max));
    @file_put_contents($fichier, implode(',', $tentatives), LOCK_EX);
    if (count($tentatives) > $max) {
        fail($message, 429);
    }
}

function ratelimitIp() {
    return $_SERVER['REMOTE_ADDR'] ?? 'inconnu';
}