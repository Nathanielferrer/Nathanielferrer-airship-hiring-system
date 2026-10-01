<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../rate_limit.php';
require_once __DIR__ . '/../email_helper.php';

header('Content-Type: application/json');

// Handle JSON input
$json = file_get_contents('php://input');
$data = json_decode($json, true);

$userId          = intval($data['user_id'] ?? ($data['id'] ?? 0));
$currentPassword = trim($data['current_password'] ?? '');
$newEmail        = strtolower(trim($data['new_email'] ?? ''));

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "Valid user ID is required."
    ]);
    exit();
}

if (empty($currentPassword)) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "Please enter your current password to authorize this email change."
    ]);
    exit();
}

if (empty($newEmail) || !filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "Please provide a valid new email address."
    ]);
    exit();
}

// ── Rate Limiting: Max 3 change attempts per 15 minutes per user ──────────
check_rate_limit($pdo, 'change_email_request', 3, 15, 'user_id', $userId, true);

try {
    // 1. Fetch current user data
    $stmt = $pdo->prepare("SELECT user_id, User_Fname, User_Lname, User_Email, User_Pass, status FROM users_tbl WHERE user_id = ? LIMIT 1");
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

    // 2. Validate current password
    if (!password_verify($currentPassword, $user['User_Pass'])) {
        http_response_code(401);
        echo json_encode([
            "status"  => "error",
            "message" => "Incorrect current password. Please re-enter your password."
        ]);
        exit();
    }

    $currentEmail = strtolower(trim($user['User_Email']));

    // 3. Ensure new email is distinct from current email
    if ($newEmail === $currentEmail) {
        http_response_code(400);
        echo json_encode([
            "status"  => "error",
            "message" => "The new email address cannot be the same as your current email address."
        ]);
        exit();
    }

    // 4. Ensure new email is not already taken by another account
    $chkStmt = $pdo->prepare("SELECT user_id FROM users_tbl WHERE LOWER(User_Email) = ? AND user_id != ? LIMIT 1");
    $chkStmt->execute([$newEmail, $userId]);
    if ($chkStmt->fetch()) {
        http_response_code(409);
        echo json_encode([
            "status"  => "error",
            "message" => "This email address is already registered to another account. Please use a different email."
        ]);
        exit();
    }

    // 5. Generate secure random verification token (64 hex characters)
    $verificationToken = bin2hex(random_bytes(32));

    // 6. Save pending state to users_tbl with 24-hour expiration
    $updStmt = $pdo->prepare("
        UPDATE users_tbl 
        SET pending_email = :pending_email,
            pending_email_token = :token,
            pending_email_expires = DATE_ADD(NOW(), INTERVAL 24 HOUR)
        WHERE user_id = :uid
    ");
    $updStmt->execute([
        'pending_email' => $newEmail,
        'token'         => $verificationToken,
        'uid'           => $userId
    ]);

    $candidateName = trim("{$user['User_Fname']} {$user['User_Lname']}");

    // 7. Dispatch both emails
    // A. Security alert to OLD email (includes direct cancellation token)
    sendEmailChangeSecurityAlert($currentEmail, $candidateName, $newEmail, $verificationToken);

    // B. Verification link to NEW email
    sendEmailChangeVerificationLink($newEmail, $candidateName, $verificationToken, 24);

    echo json_encode([
        "status"        => "success",
        "message"       => "A verification link has been sent to {$newEmail}. Please check your inbox within 24 hours to confirm.",
        "pending_email" => $newEmail
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status"  => "error",
        "message" => "Database error: " . $e->getMessage()
    ]);
}
?>
