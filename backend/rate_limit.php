<?php
/**
 * rate_limit.php - Centralized Hybrid Rate Limiting Helper (Two-Phase)
 *
 * How it works:
 *  - For LOGGED-IN users: tracks by user_id (immune to VPN/proxy/shared Wi-Fi).
 *  - For GUESTS: tracks by IP address (with generous limits).
 *
 * Two-Phase Mode:
 *  - check_rate_limit(..., logNow: false) → validates quota only, does NOT insert.
 *  - log_rate_limit(...) → explicitly records the request AFTER successful processing.
 *  This ensures that failed operations (API errors, parse failures) do not consume user quota.
 *
 * @param PDO    $pdo         The active database connection.
 * @param string $endpoint    A short name for the endpoint (e.g., 'chatbot', 'register').
 * @param int    $maxRequests Maximum number of requests allowed within the time window.
 * @param int    $windowMins  The time window in minutes to count requests within.
 * @param string $trackBy     'user_id' to track by user, 'ip' to track by IP address.
 * @param mixed  $userId      The logged-in user ID (only used when $trackBy = 'user_id').
 * @param bool   $logNow      If true (default), immediately logs the request after check.
 *                             Set to false for two-phase mode (call log_rate_limit() separately on success).
 */
function check_rate_limit(PDO $pdo, string $endpoint, int $maxRequests, int $windowMins, string $trackBy = 'ip', $userId = null, bool $logNow = true): void {

    $identifier = _resolve_rate_limit_identifier($trackBy, $userId);

    try {
        // Count requests in the time window
        $countStmt = $pdo->prepare(
            "SELECT COUNT(*) FROM rate_limits_tbl
             WHERE identifier = :id
               AND endpoint   = :ep
               AND created_at > DATE_SUB(NOW(), INTERVAL :win MINUTE)"
        );
        $countStmt->execute([':id' => $identifier, ':ep' => $endpoint, ':win' => $windowMins]);
        $count = (int) $countStmt->fetchColumn();

        // If threshold exceeded, block with 429
        if ($count >= $maxRequests) {
            http_response_code(429);
            echo json_encode([
                'status'               => 'error',
                'message'              => "Too many requests. You have reached the limit of {$maxRequests} requests per {$windowMins} minute(s) for this action. Please wait before trying again.",
                'retry_after_minutes'  => $windowMins,
            ]);
            exit();
        }

        // Log this new request immediately (legacy single-phase behavior)
        if ($logNow) {
            $logStmt = $pdo->prepare("INSERT INTO rate_limits_tbl (identifier, endpoint) VALUES (:id, :ep)");
            $logStmt->execute([':id' => $identifier, ':ep' => $endpoint]);
        }

    } catch (PDOException $e) {
        // Fail open on DB error — do not block legitimate users
        error_log('[RateLimit] DB error on endpoint "' . $endpoint . '": ' . $e->getMessage());
    }
}

/**
 * Log a successful request into rate_limits_tbl (Two-Phase: called AFTER processing succeeds).
 *
 * @param PDO    $pdo      The active database connection.
 * @param string $endpoint The endpoint name (must match the one used in check_rate_limit).
 * @param string $trackBy  'user_id' or 'ip'.
 * @param mixed  $userId   The logged-in user ID (only used when $trackBy = 'user_id').
 */
function log_rate_limit(PDO $pdo, string $endpoint, string $trackBy = 'ip', $userId = null): void {
    $identifier = _resolve_rate_limit_identifier($trackBy, $userId);
    try {
        $logStmt = $pdo->prepare("INSERT INTO rate_limits_tbl (identifier, endpoint) VALUES (:id, :ep)");
        $logStmt->execute([':id' => $identifier, ':ep' => $endpoint]);
    } catch (PDOException $e) {
        error_log('[RateLimit] Log error on endpoint "' . $endpoint . '": ' . $e->getMessage());
    }
}

/**
 * Internal helper to resolve the rate-limit identifier string.
 */
function _resolve_rate_limit_identifier(string $trackBy, $userId): string {
    if ($trackBy === 'user_id' && !empty($userId)) {
        return 'uid_' . (int)$userId;
    }
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ip = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
    }
    return 'ip_' . $ip;
}
