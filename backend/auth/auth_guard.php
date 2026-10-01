<?php
// ── Centralized Authentication Guard Middleware ──────────────────────────────
// Provides get_authenticated_user(), require_auth(), and require_admin()
// for all protected backend endpoints.
//
// Supports 3 token discovery channels:
//   1. HTTP Authorization: Bearer <token>   (standard API calls)
//   2. $_GET['token'] or $_POST['token']    (window.open new-tab downloads)
//   3. JSON body { "token": "..." }         (POST payloads)

require_once __DIR__ . '/jwt_helper.php';

/**
 * Attempt to extract and verify a JWT token from the current request.
 *
 * @return array|null  Decoded JWT payload on success, null if unauthenticated.
 */
function get_authenticated_user(): ?array {
    $token = null;

    // 1. Check HTTP Authorization header (standard for fetch() with headers)
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    // Normalize header keys for case-insensitive lookup (Apache vs nginx)
    $normalizedHeaders = [];
    foreach ($headers as $key => $value) {
        $normalizedHeaders[strtolower($key)] = $value;
    }
    $authHeader = $normalizedHeaders['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = trim($matches[1]);
    }

    // 2. Fallback to GET or POST parameter (critical for window.open tabs)
    if (!$token) {
        $token = $_GET['token'] ?? ($_POST['token'] ?? null);
    }

    // 3. Fallback to JSON body if payload was decoded
    if (!$token) {
        $json = file_get_contents('php://input');
        if ($json) {
            $body = json_decode($json, true);
            $token = $body['token'] ?? null;
        }
    }

    if (!$token || !is_string($token)) {
        return null;
    }

    $payload = verifyJWT($token);
    return is_array($payload) ? $payload : null;
}

/**
 * Require authentication. Returns the decoded JWT payload.
 * Terminates the request with HTTP 401 if no valid token is found.
 *
 * @return array Decoded JWT payload with sub, email, is_admin, first_name, last_name, etc.
 */
function require_auth(): array {
    $user = get_authenticated_user();
    if (!$user) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode([
            'status'  => 'error',
            'message' => 'Unauthorized: Valid authentication token required.'
        ]);
        exit();
    }
    return $user;
}

/**
 * Require administrative privileges (is_admin >= 1).
 * Terminates with HTTP 401 if unauthenticated, or HTTP 403 if not an admin.
 *
 * @return array Decoded JWT payload for the authenticated admin.
 */
function require_admin(): array {
    $user = require_auth();
    if (!isset($user['is_admin']) || (int)$user['is_admin'] < 1) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode([
            'status'  => 'error',
            'message' => 'Forbidden: Administrative privileges required.'
        ]);
        exit();
    }
    return $user;
}

/**
 * Require Super Admin privileges (is_admin === 3).
 * Terminates with HTTP 403 if the authenticated user is not a Super Admin.
 *
 * @return array Decoded JWT payload for the authenticated super admin.
 */
function require_super_admin(): array {
    $user = require_auth();
    if (!isset($user['is_admin']) || (int)$user['is_admin'] !== 3) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode([
            'status'  => 'error',
            'message' => 'Forbidden: Super Admin privileges required.'
        ]);
        exit();
    }
    return $user;
}
