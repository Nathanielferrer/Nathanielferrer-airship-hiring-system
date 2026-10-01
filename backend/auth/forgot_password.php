<?php
// Include database connection (which handles CORS headers)
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../rate_limit.php';
require_once __DIR__ . '/../email_helper.php';

// Disable HTML error output to prevent JSON corruption
ini_set('display_errors', 0);
header('Content-Type: application/json');

// Read JSON input from Axios/Fetch
$json = file_get_contents('php://input');
$data = json_decode($json, true);

$email = isset($data['email']) ? trim($data['email']) : '';

if (empty($email)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Email address is required."
    ]);
    exit();
}

try {
    // ── Rate Limiting: 5 password reset requests per 15 minutes per IP ───────
    check_rate_limit($pdo, 'forgot_password', 5, 15, 'ip');

    // 1. Check if user exists (Applicants: is_admin = 0, Admin: is_admin = 1, Super Admin: is_admin = 3)
    $stmt = $pdo->prepare("SELECT user_id, User_Fname, User_Lname, is_admin, totp_enabled FROM users_tbl WHERE User_Email = :email");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {
        $isAdmin = intval($user['is_admin'] ?? 0);
        $fullName = trim(($user['User_Fname'] ?? '') . ' ' . ($user['User_Lname'] ?? '')) ?: 'User';

        // 2. Generate a cryptographically secure token and a 15-minute expiration time
        $token = bin2hex(random_bytes(32));
        
        // 3. Save the token and expiration to the database
        $updateStmt = $pdo->prepare("UPDATE users_tbl SET reset_token = :token, reset_expires = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE user_id = :id");
        $updateStmt->execute([
            'token' => $token,
            'id'    => $user['user_id']
        ]);

        // 4. Send the recovery email using centralized email helper
        sendPasswordResetEmail($email, $fullName, $token, $isAdmin);
    }

    echo json_encode([
        "status" => "success",
        "message" => "If an account exists for this email, password recovery instructions have been sent."
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database error: " . $e->getMessage()
    ]);
}
?>
