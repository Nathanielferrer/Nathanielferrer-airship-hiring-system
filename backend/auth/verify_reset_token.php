<?php
// Include database connection (sets CORS headers)
require_once __DIR__ . '/../db.php';

header('Content-Type: application/json');

$token = trim($_GET['token'] ?? '');

if (empty($token)) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'valid'  => false,
        'message' => 'Missing password reset token.'
    ]);
    exit();
}

try {
    $stmt = $pdo->prepare("
        SELECT user_id, User_Fname, User_Lname, User_Email, is_admin, totp_enabled, reset_expires 
        FROM users_tbl 
        WHERE reset_token = :token AND reset_expires > NOW()
        LIMIT 1
    ");
    $stmt->execute(['token' => $token]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        echo json_encode([
            'status'  => 'error',
            'valid'   => false,
            'message' => 'This password reset link is invalid or has expired. Please request a new one.'
        ]);
        exit();
    }

    $isAdmin = intval($user['is_admin'] ?? 0);
    $isSuperAdmin = ($isAdmin === 3);

    // Mask email for display (e.g. air***07@gmail.com)
    $emailParts = explode('@', $user['User_Email']);
    $namePart = $emailParts[0];
    $domainPart = $emailParts[1] ?? '';
    if (strlen($namePart) > 4) {
        $maskedName = substr($namePart, 0, 3) . '***' . substr($namePart, -2);
    } else {
        $maskedName = substr($namePart, 0, 1) . '***';
    }
    $maskedEmail = $maskedName . '@' . $domainPart;

    echo json_encode([
        'status'         => 'success',
        'valid'          => true,
        'is_super_admin' => $isSuperAdmin,
        'totp_enabled'   => (int)($user['totp_enabled'] ?? 0) === 1,
        'masked_email'   => $maskedEmail,
        'name'           => trim("{$user['User_Fname']} {$user['User_Lname']}")
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'valid'   => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>
