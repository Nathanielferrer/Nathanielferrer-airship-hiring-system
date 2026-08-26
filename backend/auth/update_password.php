<?php
// Include database connection (sets CORS headers)
require_once '../db.php';

header('Content-Type: application/json');

// Read JSON input from Axios/Fetch
$json = file_get_contents('php://input');
$data = json_decode($json, true);

$token    = isset($data['token']) ? trim($data['token']) : '';
$password = isset($data['password']) ? $data['password'] : '';

// 1. Validate inputs
if (empty($token) || empty($password)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Token and new password are required."
    ]);
    exit();
}

// Enforce server-side password strength validation (matching client-side criteria)
$hasLength   = strlen($password) >= 8;
$hasUpper    = preg_match('/[A-Z]/', $password);
$hasLower    = preg_match('/[a-z]/', $password);
$hasNumber   = preg_match('/[0-9]/', $password);
$hasSpecial  = preg_match('/[^A-Za-z0-9]/', $password);

if (!$hasLength || !$hasUpper || !$hasLower || !$hasNumber || !$hasSpecial) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "New password does not meet complexity requirements. It must contain at least 8 characters, an uppercase letter, a lowercase letter, a number, and a special character."
    ]);
    exit();
}

try {
    // 2. Fetch candidate user matching the token where the token hasn't expired yet (is_admin = 0)
    // SECURITY: Self-service token reset applies ONLY to candidates.
    $stmt = $pdo->prepare("SELECT User_ID FROM user WHERE reset_token = :token AND reset_expires > NOW() AND (is_admin = 0 OR is_admin IS NULL)");
    $stmt->execute(['token' => $token]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "The reset link is invalid or has expired. Please request a new one."
        ]);
        exit();
    }

    // 3. Hash the new password securely using BCRYPT
    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);

    // 4. Update the user password, clear reset token details and reset flag so they cannot be reused
    $updateStmt = $pdo->prepare("UPDATE user SET User_Pass = :pass, reset_token = NULL, reset_expires = NULL, requires_password_reset = 0 WHERE User_ID = :id");
    $updateStmt->execute([
        'pass' => $hashedPassword,
        'id'   => $user['User_ID']
    ]);

    echo json_encode([
        "status" => "success",
        "message" => "Your password has been successfully reset! You can now log in."
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database error: " . $e->getMessage()
    ]);
}
