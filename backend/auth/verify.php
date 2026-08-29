<?php
// Include database connection (which sets CORS headers)
require_once '../db.php';

header('Content-Type: application/json');

// Get verification token from GET parameter
$token = isset($_GET['token']) ? trim($_GET['token']) : '';

if (empty($token)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Verification token is missing."
    ]);
    exit();
}

try {
    // Look up the user by verification_code or verification_token
    $stmt = $pdo->prepare("SELECT user_id, is_verified FROM users_tbl WHERE verification_code = :code OR verification_token = :token");
    $stmt->execute([
        'code' => $token,
        'token' => $token
    ]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "Invalid or expired verification token."
        ]);
        exit();
    }

    // Update user to verified status and clear the token columns
    $updateStmt = $pdo->prepare("UPDATE users_tbl SET 
                                    is_verified = 1, 
                                    verification_code = NULL, 
                                    verification_token = NULL 
                                 WHERE user_id = :id");
    $updateStmt->execute(['id' => $user['user_id']]);

    echo json_encode([
        "status" => "success",
        "message" => "Email verification successful! You can now log in."
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database error: " . $e->getMessage()
    ]);
}
