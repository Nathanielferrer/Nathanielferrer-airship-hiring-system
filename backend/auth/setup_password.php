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
    preg_match('/[A-Z]/', $newPassword) &&
    preg_match('/[a-z]/', $newPassword) &&
    preg_match('/[0-9]/', $newPassword) &&
    preg_match('/[^A-Za-z0-9]/', $newPassword)
);

if (!$strongPassword) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character."
    ]);
    exit();
}

try {
    // Fetch admin by setup token — must be valid and not expired
    $stmt = $pdo->prepare("
        SELECT User_ID, User_Fname, User_Lname, User_Email, User_Pass, is_admin
        FROM user
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

    // Security Check: Disallow reusing the temporary password assigned by Super Admin
    if (!empty($admin['User_Pass']) && password_verify($newPassword, $admin['User_Pass'])) {
        http_response_code(400);
        echo json_encode([
            "status"  => "error",
            "message" => "Your new password cannot be the same as your temporary password. Please choose a different password."
        ]);
        exit();
    }

    // Hash new password and clear the reset flag + setup token
    $hash = password_hash($newPassword, PASSWORD_BCRYPT);
    $updateStmt = $pdo->prepare("
        UPDATE user
        SET User_Pass = ?,
            requires_password_reset = 0,
            setup_token = NULL,
            setup_token_expires = NULL
        WHERE User_ID = ?
    ");
    $updateStmt->execute([$hash, $admin['User_ID']]);

    // Write audit log: password setup completed
    $logStmt = $pdo->prepare("INSERT INTO admin_audit_log (actor_id, target_id, action, details) VALUES (?, ?, 'password_setup_completed', ?)");
    $logStmt->execute([
        $admin['User_ID'],
        $admin['User_ID'],
        "HR Admin (ID:{$admin['User_ID']}) {$admin['User_Fname']} {$admin['User_Lname']} successfully completed forced password setup."
    ]);

    // Generate a signed JWT token so the admin can access their dashboard immediately
    $jwtToken = generateJWT([
        'sub'        => $admin['User_ID'],
        'email'      => $admin['User_Email'],
        'first_name' => $admin['User_Fname'],
        'last_name'  => $admin['User_Lname'],
        'is_admin'   => (int)$admin['is_admin'],
    ]);

    // Return full user payload + JWT so frontend can redirect to dashboard
    echo json_encode([
        "status"  => "success",
        "message" => "Password updated successfully. Welcome!",
        "token"   => $jwtToken,
        "user"    => [
            "id"         => $admin['User_ID'],
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
