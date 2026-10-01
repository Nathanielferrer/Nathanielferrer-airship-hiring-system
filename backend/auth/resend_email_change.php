<?php
require_once '../db.php';
require_once '../rate_limit.php';
require_once '../email_helper.php';

header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$userId = intval($data['user_id'] ?? ($data['id'] ?? 0));

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "Valid user ID is required."
    ]);
    exit();
}

// ── Rate Limiting: Max 3 resend attempts per 15 minutes per user ──────────
check_rate_limit($pdo, 'resend_email_change', 3, 15, 'user_id', $userId, true);

try {
    // 1. Fetch user data with pending email
    $stmt = $pdo->prepare("SELECT user_id, User_Fname, User_Lname, User_Email, pending_email, pending_email_token, status FROM users_tbl WHERE user_id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode([
            "status"  => "error",
            "message" => "User account not found."
        ]);
        exit();
    }

    if (strtolower($user['status'] ?? 'active') === 'inactive') {
        http_response_code(403);
        echo json_encode([
            "status"  => "error",
            "message" => "This account is inactive. Please contact support."
        ]);
        exit();
    }

    $pendingEmail = strtolower(trim($user['pending_email'] ?? ''));

    if (empty($pendingEmail) || !filter_var($pendingEmail, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode([
            "status"  => "error",
            "message" => "No active pending email change request found to resend."
        ]);
        exit();
    }

    // 2. Generate a fresh token and refresh the 24-hour expiration window
    $verificationToken = bin2hex(random_bytes(32));

    $upd = $pdo->prepare("
        UPDATE users_tbl
        SET pending_email_token = :token,
            pending_email_expires = DATE_ADD(NOW(), INTERVAL 24 HOUR)
        WHERE user_id = :uid
    ");
    $upd->execute([
        'token' => $verificationToken,
        'uid'   => $userId
    ]);

    $candidateName = trim("{$user['User_Fname']} {$user['User_Lname']}");

    // 3. Dispatch new verification link email to pending_email
    sendEmailChangeVerificationLink($pendingEmail, $candidateName, $verificationToken, 24);

    echo json_encode([
        "status"        => "success",
        "message"       => "A fresh verification link has been sent to {$pendingEmail}.",
        "pending_email" => $pendingEmail
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status"  => "error",
        "message" => "Database error: " . $e->getMessage()
    ]);
}
?>
