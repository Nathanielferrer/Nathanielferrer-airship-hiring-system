<?php
// Include database connection (which sets CORS headers)
require_once '../db.php';
require_once 'jwt_helper.php';

header('Content-Type: application/json');

// Handle JSON input from React frontend (Axios/Fetch)
$json = file_get_contents('php://input');
$data = json_decode($json, true);
if ($data) {
    $_POST = array_merge($_POST, $data);
}

// Extract inputs
$email = isset($_POST['Email']) ? trim($_POST['Email']) : '';
$pass  = isset($_POST['Password']) ? $_POST['Password'] : '';

if (empty($email) || empty($pass)) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "Email and password are required."
    ]);
    exit();
}

try {
    // ── PROGRESSIVE BRUTE-FORCE PROTECTION ───────────────────────────────────
    $ip_address = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    if (isset($_SERVER['HTTP_X_FORWARDED_FOR']) && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ip_address = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
    }

    $tiers = [
        ['window' => 15, 'threshold' => 11, 'lockout' => 15, 'level' => 3],
        ['window' =>  5, 'threshold' =>  8, 'lockout' =>  5, 'level' => 2],
        ['window' =>  1, 'threshold' =>  5, 'lockout' =>  1, 'level' => 1],
    ];

    $activeTier = null;

    foreach ($tiers as $tier) {
        $countStmt = $pdo->prepare(
            "SELECT COUNT(*) FROM login_attempts_tbl
             WHERE (ip_address = :ip OR email = :email)
               AND success = 0
               AND attempted_at > DATE_SUB(NOW(), INTERVAL :window MINUTE)"
        );
        $countStmt->execute([
            'ip'     => $ip_address,
            'email'  => $email,
            'window' => $tier['window'],
        ]);
        $failCount = (int) $countStmt->fetchColumn();

        if ($failCount >= $tier['threshold']) {
            $activeTier = $tier;
            break;
        }
    }

    if ($activeTier !== null) {
        $oldestStmt = $pdo->prepare(
            "SELECT attempted_at FROM login_attempts_tbl
             WHERE (ip_address = :ip OR email = :email)
               AND success = 0
               AND attempted_at > DATE_SUB(NOW(), INTERVAL :window MINUTE)
             ORDER BY attempted_at ASC LIMIT 1"
        );
        $oldestStmt->execute([
            'ip'     => $ip_address,
            'email'  => $email,
            'window' => $activeTier['window'],
        ]);
        $oldest = $oldestStmt->fetchColumn();

        $lockoutEndsAt    = strtotime($oldest) + ($activeTier['lockout'] * 60);
        $remainingSeconds = max(0, $lockoutEndsAt - time());

        $tierMessages = [
            1 => 'Too many failed attempts. Please wait before trying again.',
            2 => 'Repeated failures detected. Please wait before trying again.',
            3 => 'Security lockout triggered due to multiple failed attempts. Please wait before trying again.',
        ];

        http_response_code(429);
        echo json_encode([
            'status'            => 'error',
            'message'           => $tierMessages[$activeTier['level']],
            'lockout_remaining' => $remainingSeconds,
            'lockout_tier'      => $activeTier['level'],
        ]);
        exit();
    }

    // Server-side validation via users_tbl
    $stmt = $pdo->prepare("SELECT user_id, User_Pass, is_verified, is_admin, User_Fname, User_Lname, requires_password_reset, COALESCE(status, 'Active') as status FROM users_tbl WHERE User_Email = :email");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    // If user not found — log failed attempt
    if (!$user) {
        $logStmt = $pdo->prepare("INSERT INTO login_attempts_tbl (ip_address, email, success) VALUES (:ip, :email, 0)");
        $logStmt->execute(['ip' => $ip_address, 'email' => $email]);

        http_response_code(401);
        echo json_encode([
            "status"  => "error",
            "message" => "Incorrect email or password."
        ]);
        exit();
    }

    // Account Deactivation Check
    if (strtolower($user['status'] ?? 'active') === 'inactive') {
        http_response_code(403);
        echo json_encode([
            "status"  => "error",
            "message" => "This account has been deactivated. Please contact your Super Administrator."
        ]);
        exit();
    }

    // Email Verification Check
    if ((int)$user['is_verified'] === 0) {
        http_response_code(403);
        echo json_encode([
            "status"  => "error",
            "message" => "Please verify your email before logging in."
        ]);
        exit();
    }

    // Password verification
    if (!password_verify($pass, $user['User_Pass'])) {
        $logStmt = $pdo->prepare("INSERT INTO login_attempts_tbl (ip_address, email, success) VALUES (:ip, :email, 0)");
        $logStmt->execute(['ip' => $ip_address, 'email' => $email]);

        http_response_code(401);
        echo json_encode([
            "status"  => "error",
            "message" => "Incorrect email or password."
        ]);
        exit();
    }

    // Forced Password Reset Intercept
    if ((int)$user['requires_password_reset'] === 1 && (int)$user['is_admin'] >= 1) {
        $setupToken = bin2hex(random_bytes(32));

        $tokenStmt = $pdo->prepare("UPDATE users_tbl SET setup_token = ?, setup_token_expires = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE user_id = ?");
        $tokenStmt->execute([$setupToken, $user['user_id']]);

        $logStmt = $pdo->prepare("INSERT INTO login_attempts_tbl (ip_address, email, success) VALUES (:ip, :email, 1)");
        $logStmt->execute(['ip' => $ip_address, 'email' => $email]);

        echo json_encode([
            "status"      => "password_reset_required",
            "message"     => "You must set a new password before continuing.",
            "setup_token" => $setupToken,
            "user"        => [
                "id"         => $user['user_id'],
                "user_id"    => $user['user_id'],
                "first_name" => $user['User_Fname'],
                "last_name"  => $user['User_Lname'],
                "email"      => $email,
                "is_admin"   => (int)$user['is_admin'],
            ]
        ]);
        exit();
    }

    // Success
    $logStmt = $pdo->prepare("INSERT INTO login_attempts_tbl (ip_address, email, success) VALUES (:ip, :email, 1)");
    $logStmt->execute(['ip' => $ip_address, 'email' => $email]);

    $jwtToken = generateJWT([
        'sub'        => $user['user_id'],
        'email'      => $email,
        'first_name' => $user['User_Fname'],
        'last_name'  => $user['User_Lname'],
        'is_admin'   => (int)$user['is_admin'],
    ]);

    // System audit log for Admin (Super Admin is skipped by helper)
    if ((int)$user['is_admin'] === 1) {
        require_once '../audit_helper.php';
        log_system_audit(
            $pdo,
            $user['user_id'],
            "{$user['User_Fname']} {$user['User_Lname']}",
            'Authentication',
            'Auth Portal',
            "Admin '{$user['User_Fname']} {$user['User_Lname']}' ({$email}) successfully logged in from IP {$ip_address}.",
            'Info'
        );
    }

    echo json_encode([
        "status"  => "success",
        "message" => "Login successful.",
        "token"   => $jwtToken,
        "user"    => [
            "id"         => $user['user_id'],
            "user_id"    => $user['user_id'],
            "User_ID"    => $user['user_id'],
            "first_name" => $user['User_Fname'],
            "last_name"  => $user['User_Lname'],
            "email"      => $email,
            "is_admin"   => (int)$user['is_admin']
        ]
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database error: " . $e->getMessage()
    ]);
}
?>
