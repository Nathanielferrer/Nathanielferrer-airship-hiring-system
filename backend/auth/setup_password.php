<?php
// Secure endpoint for forced admin password setup (one-time token based)
require_once '../db.php';
require_once 'jwt_helper.php';
header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$token       = trim($data['token'] ?? '');
$newPassword = $data['new_password'] ?? '';

if (empty($token) || empty($newPassword)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Token and new password are required."]);
    exit();
}

// Validate password strength server-side
$strongPassword = (
    strlen($newPassword) >= 8 &&
    strlen($newPassword) <= 64 &&
    preg_match('/[A-Z]/', $newPassword) &&
    preg_match('/[a-z]/', $newPassword) &&
    preg_match('/[0-9]/', $newPassword) &&
    preg_match('/[^A-Za-z0-9]/', $newPassword)
);

if (!$strongPassword) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "Password must be between 8 and 64 characters and include uppercase, lowercase, a number, and a special character."
    ]);
    exit();
}

try {
    // Fetch admin by setup token
    $stmt = $pdo->prepare("
        SELECT user_id, User_Fname, User_Lname, User_Email, User_Pass, is_admin
        FROM users_tbl
        WHERE setup_token = ?
          AND setup_token_expires > NOW()
          AND requires_password_reset = 1
          AND is_admin >= 1
        LIMIT 1
    ");
    $stmt->execute([$token]);
    $admin = $stmt->fetch();

    if (!$admin) {
        http_response_code(401);
        echo json_encode([
            "status"  => "error",
            "message" => "Invalid or expired setup link. Please log in again to receive a new link."
        ]);
        exit();
    }

    // Disallow reusing temporary password
    if (!empty($admin['User_Pass']) && password_verify($newPassword, $admin['User_Pass'])) {
        http_response_code(400);
        echo json_encode([
            "status"  => "error",
            "message" => "Your new password cannot be the same as your temporary password. Please choose a different password."
        ]);
        exit();
    }

    // Hash new password and clear setup token
    $hash = password_hash($newPassword, PASSWORD_BCRYPT);
    $updateStmt = $pdo->prepare("
        UPDATE users_tbl
        SET User_Pass = ?,
            requires_password_reset = 0,
            setup_token = NULL,
            setup_token_expires = NULL
        WHERE user_id = ?
    ");
    $updateStmt->execute([$hash, $admin['user_id']]);

    // Write audit log
    require_once '../audit_helper.php';
    $adminName = trim("{$admin['User_Fname']} {$admin['User_Lname']}");
    $auditDetails = "HR Admin (ID:{$admin['user_id']}) {$adminName} successfully completed forced password setup.";
    log_system_audit($pdo, $admin['user_id'], $adminName, 'Password Setup Completed', 'Authentication', $auditDetails);

    // Generate signed JWT
    $jwtToken = generateJWT([
        'sub'        => $admin['user_id'],
        'email'      => $admin['User_Email'],
        'first_name' => $admin['User_Fname'],
        'last_name'  => $admin['User_Lname'],
        'is_admin'   => (int)$admin['is_admin'],
    ]);

    echo json_encode([
        "status"  => "success",
        "message" => "Password updated successfully. Welcome!",
        "token"   => $jwtToken,
        "user"    => [
            "id"         => $admin['user_id'],
            "user_id"    => $admin['user_id'],
            "first_name" => $admin['User_Fname'],
            "last_name"  => $admin['User_Lname'],
            "email"      => $admin['User_Email'],
            "is_admin"   => (int)$admin['is_admin'],
        ]
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}
?>
