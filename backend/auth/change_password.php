<?php
require_once '../db.php';
require_once '../rate_limit.php';
header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$userId          = intval($data['user_id'] ?? ($data['id'] ?? 0));
$currentPassword = $data['current_password'] ?? '';
$newPassword     = $data['new_password'] ?? '';

if (!$userId || empty($currentPassword) || empty($newPassword)) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "Please provide your current password and a new password."
    ]);
    exit();
}

// ── Rate Limiting: Max 5 password change attempts per 15 minutes per user ──
check_rate_limit($pdo, 'change_password', 5, 15, 'user_id', $userId, true);

// Enforce password strength validation
$newPassLen  = strlen($newPassword);
$hasLength   = $newPassLen >= 8 && $newPassLen <= 64;
$hasUpper    = preg_match('/[A-Z]/', $newPassword);
$hasLower    = preg_match('/[a-z]/', $newPassword);
$hasNumSpec  = preg_match('/[0-9]/', $newPassword) && preg_match('/[^A-Za-z0-9]/', $newPassword);

if (!$hasLength || !$hasUpper || !$hasLower || !$hasNumSpec) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "New password does not meet requirements. It must be between 8 and 64 characters long and contain uppercase, lowercase, and a number with special character."
    ]);
    exit();
}

try {
    $stmt = $pdo->prepare("SELECT user_id, User_Pass, User_Email FROM users_tbl WHERE user_id = ?");
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

    // Verify current password
    if (!password_verify($currentPassword, $user['User_Pass'])) {
        http_response_code(400);
        echo json_encode([
            "status"  => "error",
            "message" => "Incorrect current password. Please re-enter your existing password."
        ]);
        exit();
    }

    // Prevent reusing current password
    if (password_verify($newPassword, $user['User_Pass'])) {
        http_response_code(400);
        echo json_encode([
            "status"  => "error",
            "message" => "New password cannot be the same as your current password. Please choose a different one."
        ]);
        exit();
    }

    // Hash and update new password
    $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $updateStmt = $pdo->prepare("UPDATE users_tbl SET User_Pass = ? WHERE user_id = ?");
    $updateStmt->execute([$newHash, $userId]);

    echo json_encode([
        "status"  => "success",
        "message" => "Password changed successfully."
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status"  => "error",
        "message" => "Database error: " . $e->getMessage()
    ]);
}
?>
