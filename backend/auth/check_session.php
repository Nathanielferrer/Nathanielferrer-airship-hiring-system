<?php
// ── Session Heartbeat Endpoint ─────────────────────────────────────────────────
// Output buffering prevents any PHP notices/warnings from corrupting the JSON response.
ob_start();

require_once '../db.php';

// Discard any accidental output from db.php (errors/notices) so JSON stays clean
ob_clean();

header('Content-Type: application/json');

// Read POST JSON body
$json = file_get_contents('php://input');
$data = json_decode($json, true);

$userId = isset($data['user_id']) ? (int)$data['user_id'] : 0;

// Validate user_id
if ($userId <= 0) {
    echo json_encode(['status' => 'invalid_token', 'message' => 'No valid user ID provided.']);
    exit();
}

// Check real-time account status in database
try {
    $stmt = $pdo->prepare("SELECT User_ID, requires_password_reset, COALESCE(status, 'Active') as status FROM user WHERE User_ID = :id LIMIT 1");
    $stmt->execute(['id' => $userId]);
    $user = $stmt->fetch();

    // Account deleted by Super Admin
    if (!$user) {
        echo json_encode(['status' => 'account_deleted']);
        exit();
    }

    // Account deactivated (Soft deleted)
    if (strtolower($user['status'] ?? 'active') === 'inactive') {
        echo json_encode(['status' => 'account_deactivated']);
        exit();
    }

    // Super Admin triggered forced password reset
    if ((int)$user['requires_password_reset'] === 1) {
        echo json_encode(['status' => 'password_reset_required']);
        exit();
    }

    // Session is healthy
    echo json_encode(['status' => 'valid']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error.']);
}
