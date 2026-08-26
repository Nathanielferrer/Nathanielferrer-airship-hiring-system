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
    // 3-Tier Escalating Lockout System (OWASP Brute Force Prevention)
    //
    // Tier 1: 5 failures  in last  1 min  → lock  1 min
    // Tier 2: 8 failures  in last  5 mins → lock  5 mins
    // Tier 3: 11 failures in last 15 mins → lock 15 mins
    //
    // Each tier is checked from most severe to least so the longest applicable
    // lockout always wins. Only FAILED attempts (success = 0) are counted.
    // ─────────────────────────────────────────────────────────────────────────
    $ip_address = $_SERVER['REMOTE_ADDR'];

    $tiers = [
        ['window' => 15, 'threshold' => 11, 'lockout' => 15, 'level' => 3],
        ['window' =>  5, 'threshold' =>  8, 'lockout' =>  5, 'level' => 2],
        ['window' =>  1, 'threshold' =>  5, 'lockout' =>  1, 'level' => 1],
    ];

    $activeTier = null;

    foreach ($tiers as $tier) {
        $countStmt = $pdo->prepare(
            "SELECT COUNT(*) FROM login_attempts
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
            break; // Highest applicable tier found — stop checking lower ones
        }
    }

    if ($activeTier !== null) {
        // Find the oldest failure within the active tier's window to calculate remaining lock time
        $oldestStmt = $pdo->prepare(
            "SELECT attempted_at FROM login_attempts
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
    // ─────────────────────────────────────────────────────────────────────────


    // SECURITY: SERVER-SIDE VALIDATION & SQL INJECTION PREVENTION via PDO
    $stmt = $pdo->prepare("SELECT User_ID, User_Pass, is_verified, verified, is_admin, User_Fname, User_Lname, requires_password_reset, COALESCE(status, 'Active') as status FROM user WHERE User_Email = :email");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    // If user not found — log as failed attempt (success = 0)
    if (!$user) {
        $logStmt = $pdo->prepare("INSERT INTO login_attempts (ip_address, email, success) VALUES (:ip, :email, 0)");
        $logStmt->execute(['ip' => $ip_address, 'email' => $email]);

        http_response_code(401);
        echo json_encode([
            "status"  => "error",
            "message" => "Incorrect email or password."
        ]);
        exit();
    }

    // SECURITY: ACCOUNT DEACTIVATION CHECK (Soft Delete enforcement)
    if (strtolower($user['status'] ?? 'active') === 'inactive') {
        http_response_code(403);
        echo json_encode([
            "status"  => "error",
            "message" => "This account has been deactivated. Please contact your Super Administrator."
        ]);
        exit();
    }

    // SECURITY: EMAIL VERIFICATION CHECK
    if ($user['is_verified'] == 0 && $user['verified'] == 0) {
        http_response_code(403);
        echo json_encode([
            "status"  => "error",
            "message" => "Please verify your email before logging in."
        ]);
        exit();
    }

    // SECURITY: BCRYPT PASSWORD VERIFICATION (timing-attack safe)
    if (!password_verify($pass, $user['User_Pass'])) {
        // Log failed attempt (success = 0)
        $logStmt = $pdo->prepare("INSERT INTO login_attempts (ip_address, email, success) VALUES (:ip, :email, 0)");
        $logStmt->execute(['ip' => $ip_address, 'email' => $email]);

        http_response_code(401);
        echo json_encode([
            "status"  => "error",
            "message" => "Incorrect email or password."
        ]);
        exit();
    }

    // ── FORCED PASSWORD RESET INTERCEPT ───────────────────────────────────────
    // If the admin account has a temporary password set by Super Admin,
    // generate a short-lived one-time setup token and pause the login flow.
    if ((int)$user['requires_password_reset'] === 1 && (int)$user['is_admin'] >= 1) {
        // Generate cryptographically secure 64-char hex token (expires in 1 hour)
        $setupToken = bin2hex(random_bytes(32));

        // Use MySQL DATE_ADD(NOW(), INTERVAL 1 HOUR) so token expiry matches MySQL server clock perfectly
        $tokenStmt = $pdo->prepare("UPDATE user SET setup_token = ?, setup_token_expires = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE User_ID = ?");
        $tokenStmt->execute([$setupToken, $user['User_ID']]);

        // Log the intercept (not a full successful login)
        $logStmt = $pdo->prepare("INSERT INTO login_attempts (ip_address, email, success) VALUES (:ip, :email, 1)");
        $logStmt->execute(['ip' => $ip_address, 'email' => $email]);

        echo json_encode([
            "status"      => "password_reset_required",
            "message"     => "You must set a new password before continuing.",
            "setup_token" => $setupToken,
            "user"        => [
                "id"         => $user['User_ID'],
                "first_name" => $user['User_Fname'],
                "last_name"  => $user['User_Lname'],
                "email"      => $email,
                "is_admin"   => (int)$user['is_admin'],
            ]
        ]);
        exit();
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── SUCCESS ───────────────────────────────────────────────────────────────
    // Log successful login (success = 1) — does NOT clear other users' failed attempts
    $logStmt = $pdo->prepare("INSERT INTO login_attempts (ip_address, email, success) VALUES (:ip, :email, 1)");
    $logStmt->execute(['ip' => $ip_address, 'email' => $email]);

    // Generate a signed JWT token for the authenticated user
    $jwtToken = generateJWT([
        'sub'        => $user['User_ID'],
        'email'      => $email,
        'first_name' => $user['User_Fname'],
        'last_name'  => $user['User_Lname'],
        'is_admin'   => (int)$user['is_admin'],
    ]);

    // If the logging-in user is an Admin (is_admin = 1), record in system_audit_logs (Super Admin is NEVER logged)
    if ((int)$user['is_admin'] === 1) {
        require_once '../audit_helper.php';
        log_system_audit(
            $pdo,
            $user['User_ID'],
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
            "id"         => $user['User_ID'],
            "first_name" => $user['User_Fname'],
            "last_name"  => $user['User_Lname'],
            "email"      => $email,
            "is_admin"   => (int)$user['is_admin']
        ]
    ]);

} catch (PDOException $e) {
    http_response_code(500); // 500 Internal Server Error
    echo json_encode([
        "status" => "error",
        "message" => "Database error: " . $e->getMessage()
    ]);
}
