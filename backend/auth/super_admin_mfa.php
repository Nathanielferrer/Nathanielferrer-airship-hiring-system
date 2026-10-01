<?php
// Include database connection (which sets CORS headers)
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../libs/TOTP.php';

header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true) ?: [];

$action = $data['action'] ?? ($_GET['action'] ?? '');
$userId = intval($data['user_id'] ?? ($_GET['user_id'] ?? 0));

if ($userId <= 0) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized: Invalid user identifier.']);
    exit();
}

try {
    // Verify user is Super Admin (is_admin = 3)
    $stmt = $pdo->prepare("SELECT user_id, User_Fname, User_Lname, User_Email, is_admin, totp_secret, totp_enabled, backup_codes FROM users_tbl WHERE user_id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || intval($user['is_admin']) !== 3) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Forbidden: This action is restricted to the Super Administrator.']);
        exit();
    }

    if ($action === 'get_status') {
        $hasBackupCodes = !empty($user['backup_codes']) && is_array(json_decode($user['backup_codes'], true));
        $backupCount = $hasBackupCodes ? count(json_decode($user['backup_codes'], true)) : 0;

        echo json_encode([
            'status' => 'success',
            'totp_enabled' => (int)($user['totp_enabled'] ?? 0) === 1,
            'backup_codes_remaining' => $backupCount
        ]);
        exit();
    }

    if ($action === 'generate_secret') {
        // Generate a new 16-character Base32 secret
        $secret = TOTP::generateSecret(16);
        $otpauthUri = TOTP::getOtpAuthUri($secret, $user['User_Email'], 'Airship Express Hiring Portal');

        // Generate 8 emergency backup codes
        $backup = TOTP::generateBackupCodes(8);

        // Store secret and hashed backup codes as pending (totp_enabled remains 0 until confirmed)
        $upStmt = $pdo->prepare("UPDATE users_tbl SET totp_secret = ?, backup_codes = ? WHERE user_id = ?");
        $upStmt->execute([
            $secret,
            json_encode($backup['hashed']),
            $userId
        ]);

        echo json_encode([
            'status' => 'success',
            'secret' => $secret,
            'otpauth_uri' => $otpauthUri,
            'backup_codes' => $backup['plain'],
            'email' => $user['User_Email']
        ]);
        exit();
    }

    if ($action === 'confirm_setup') {
        $code = trim($data['code'] ?? '');
        if (empty($code)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Please enter the 6-digit code shown in your Google Authenticator app.']);
            exit();
        }

        $secret = $user['totp_secret'];
        if (empty($secret)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'No pending 2FA secret found. Please start setup again.']);
            exit();
        }

        // Verify with 30s drift discrepancy
        if (!TOTP::verifyCode($secret, $code, 1)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Invalid verification code. Please make sure the code matches Google Authenticator and try again.']);
            exit();
        }

        // Activate 2FA
        $upStmt = $pdo->prepare("UPDATE users_tbl SET totp_enabled = 1 WHERE user_id = ?");
        $upStmt->execute([$userId]);

        echo json_encode([
            'status' => 'success',
            'message' => 'Two-Factor Authentication is now active! Your Super Admin account is protected.'
        ]);
        exit();
    }

    if ($action === 'disable') {
        $password = $data['password'] ?? '';
        $code = trim($data['code'] ?? '');

        // Verify password
        $passStmt = $pdo->prepare("SELECT User_Pass FROM users_tbl WHERE user_id = ?");
        $passStmt->execute([$userId]);
        $hash = $passStmt->fetchColumn();

        if (!password_verify($password, $hash)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Current password is incorrect.']);
            exit();
        }

        // Verify current TOTP code or backup code
        $backupJson = $user['backup_codes'];
        $totpValid = TOTP::verifyCode($user['totp_secret'] ?: '', $code, 1);
        $backupValid = !$totpValid && TOTP::verifyAndConsumeBackupCode($code, $backupJson);

        if (!$totpValid && !$backupValid) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Invalid 6-digit Authenticator or backup code.']);
            exit();
        }

        $disableStmt = $pdo->prepare("UPDATE users_tbl SET totp_enabled = 0, totp_secret = NULL, backup_codes = NULL WHERE user_id = ?");
        $disableStmt->execute([$userId]);

        echo json_encode([
            'status' => 'success',
            'message' => 'Two-Factor Authentication has been disabled.'
        ]);
        exit();
    }

    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Unknown action requested.']);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Server error: ' . $e->getMessage()]);
}
?>
