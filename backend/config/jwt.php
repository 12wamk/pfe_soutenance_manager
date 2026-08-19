<?php
/**
 * Implémentation JWT en PHP pur (sans dépendance Composer),
 * comme exigé par le cahier des charges.
 * Algorithme : HS256.
 */

define('JWT_SECRET', 'enetcom_soutenance_secret_key_2024_CHANGEZ_MOI_EN_PRODUCTION');
define('JWT_EXPIRY_SECONDS', 3600); // 1h

function base64UrlEncode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode($data) {
    $pad = strlen($data) % 4;
    if ($pad) $data .= str_repeat('=', 4 - $pad);
    return base64_decode(strtr($data, '-_', '+/'));
}

function jwtCreate(array $payload) {
    $header = base64UrlEncode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
    $payload['iat'] = time();
    $payload['exp'] = time() + JWT_EXPIRY_SECONDS;
    $payloadEncoded = base64UrlEncode(json_encode($payload));
    $signature = base64UrlEncode(hash_hmac('sha256', "$header.$payloadEncoded", JWT_SECRET, true));
    return "$header.$payloadEncoded.$signature";
}

/**
 * Vérifie et décode le token présent dans l'en-tête Authorization.
 * Termine la requête avec une erreur 401 si absent/invalide/expiré.
 */
function jwtRequireAuth() {
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (!$auth || !str_starts_with($auth, 'Bearer ')) {
        fail('Authentification requise', 401);
    }
    $token = substr($auth, 7);
    $parts = explode('.', $token);
    if (count($parts) !== 3) fail('Token invalide', 401);

    [$header, $payload, $signature] = $parts;
    $expectedSig = base64UrlEncode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expectedSig, $signature)) fail('Token invalide', 401);

    $data = json_decode(base64UrlDecode($payload), true);
    if (!$data || ($data['exp'] ?? 0) < time()) fail('Session expirée, veuillez vous reconnecter', 401);

    // Vérifie que la version JWT du token correspond à celle en base : si l'utilisateur
    // a été déconnecté (mot de passe changé, compte supprimé, ...), le token est invalide.
    if (isset($data['jwt_version'])) {
        try {
            $pdo = getDB();
            $stmt = $pdo->prepare("SELECT jwt_version FROM users WHERE id = ?");
            $stmt->execute([$data['id']]);
            $row = $stmt->fetch();
            if (!$row) fail('Compte introuvable', 401);
            if ((int) $row['jwt_version'] !== (int) $data['jwt_version']) {
                fail('Session révoquée, veuillez vous reconnecter', 401);
            }
        } catch (PDOException $e) {
            fail('Erreur de validation de session', 401);
        }
    }

    return $data;
}

/** Révoque toutes les sessions JWT d'un utilisateur en incrémentant sa version JWT. */
function jwtRevoke($pdo, $userId) {
    $pdo->prepare("UPDATE users SET jwt_version = jwt_version + 1 WHERE id = ?")->execute([$userId]);
}

/** Vérifie que l'utilisateur authentifié a l'un des rôles autorisés. */
function requireRole(array $allowedRoles) {
    $user = jwtRequireAuth();
    if (!in_array($user['role'], $allowedRoles)) {
        fail('Accès refusé : permissions insuffisantes', 403);
    }
    return $user;
}
