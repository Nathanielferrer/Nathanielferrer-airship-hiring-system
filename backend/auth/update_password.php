<?php
// Include database connection (sets CORS headers)
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../rate_limit.php';
require_once __DIR__ . '/../libs/TOTP.php';
require_once __DIR__ . '/../email_helper.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json');

// Rate limiting: Max 5 password reset attempts per 15 minutes per IP
check_rate_limit($pdo, 'update_password', 5, 15, 'ip', null, true);

// Read JSON input from Axios/Fetch
$json = file_get_contents('php://input');
$data = json_decode($json, true);

$token        = isset($data['token']) ? trim($data['token']) : '';
$password     = isset($data['password']) ? $data['password'] : '';
$totpCode     = isset($data['totp_code']) ? trim($data['totp_code']) : '';
$isBackupCode = !empty($data['is_backup_code']);

// 1. Validate inputs
if (empty($token) || empty($password)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Token and new password are required."
    ]);
    exit();
}

// Enforce server-side password strength validation
$pwLen       = strlen($password);
$hasLength   = $pwLen >= 8 && $pwLen <= 64;
$hasUpper    = preg_match('/[A-Z]/', $password);
$hasLower    = preg_match('/[a-z]/', $password);
$hasNumber   = preg_match('/[0-9]/', $password);
$hasSpecial  = preg_match('/[^A-Za-z0-9]/', $password);

if (!$hasLength || !$hasUpper || !$hasLower || !$hasNumber || !$hasSpecial) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "New password does not meet complexity requirements. It must be between 8 and 64 characters, and contain an uppercase letter, a lowercase letter, a number, and a special character."
    ]);
    exit();
}

try {
    // 2. Fetch user matching the reset token
    $stmt = $pdo->prepare("SELECT user_id, User_Fname, User_Lname, User_Email, User_Pass, is_admin, totp_secret, totp_enabled, backup_codes FROM users_tbl WHERE reset_token = :token AND reset_expires > NOW()");
    $stmt->execute(['token' => $token]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(400);
        echo json_encode([
            "status"  => "error",
            "message" => "The reset link is invalid or has expired. Please request a new one."
        ]);
        exit();
    }

    $isAdmin = intval($user['is_admin'] ?? 0);

    // 2b. If Super Admin (is_admin = 3) and TOTP is enabled, require second factor verification
    if ($isAdmin === 3 && (int)($user['totp_enabled'] ?? 0) === 1) {
        if (empty($totpCode)) {
            http_response_code(400);
            echo json_encode([
                "status"  => "error",
                "message" => "Two-Factor Authentication is required for Super Admin. Please enter your 6-digit Authenticator code or an emergency backup code."
            ]);
            exit();
        }

        if ($isBackupCode) {
            $backupCodesJson = $user['backup_codes'];
            if (!TOTP::verifyAndConsumeBackupCode($totpCode, $backupCodesJson)) {
                http_response_code(400);
                echo json_encode([
                    "status"  => "error",
                    "message" => "Invalid or already used emergency backup recovery code. Please check and try again."
                ]);
                exit();
            }

            // Update remaining backup codes in database
            $upCodes = $pdo->prepare("UPDATE users_tbl SET backup_codes = ? WHERE user_id = ?");
            $upCodes->execute([$backupCodesJson, $user['user_id']]);
        } else {
            // Verify 6-digit TOTP code
            $secret = $user['totp_secret'] ?? '';
            if (empty($secret) || !TOTP::verifyCode($secret, $totpCode, 1)) {
                http_response_code(400);
                echo json_encode([
                    "status"  => "error",
                    "message" => "Invalid 6-digit Authenticator code. Please ensure your device clock is accurate and try again."
                ]);
                exit();
            }
        }
    }

    // 2c. Prevent reuse of the current password
    if (password_verify($password, $user['User_Pass'])) {
        http_response_code(400);
        echo json_encode([
            "status"  => "error",
            "message" => "Your new password cannot be the same as your current password. Please choose a different one."
        ]);
        exit();
    }

    // 3. Hash the new password securely using BCRYPT
    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);

    // 4. Update the user password, clear reset token details
    $updateStmt = $pdo->prepare("UPDATE users_tbl SET User_Pass = :pass, reset_token = NULL, reset_expires = NULL, requires_password_reset = 0 WHERE user_id = :id");
    $updateStmt->execute([
        'pass' => $hashedPassword,
        'id'   => $user['user_id']
    ]);

    // 5. If Super Admin, send an immediate security notification email
    if ($isAdmin === 3) {
        try {
            $mail = new PHPMailer(true);
            configure_smtp($mail, 'Airship Express Security Portal');
            $mail->addAddress($user['User_Email'], "{$user['User_Fname']} {$user['User_Lname']}");

            $clientIp = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
            if (isset($_SERVER['HTTP_X_FORWARDED_FOR']) && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
                $clientIp = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
            }
            if ($clientIp === '::1' || $clientIp === '::ffff:127.0.0.1') {
                $clientIp = '127.0.0.1 (Localhost)';
            }

            date_default_timezone_set('Asia/Manila');
            $resetTime = date('F j, Y, h:i A') . ' (Philippine Time)';

            $mail->isHTML(true);
            $mail->Subject = '🛡️ Security Notice: Super Admin Password Changed - Airship Express';
            $mail->Body = "
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e4e7; border-radius: 8px; background-color: #ffffff;'>
                <div style='text-align: center; border-bottom: 1px solid #e5e4e7; padding-bottom: 20px;'>
                    <h2 style='color: #e6007e; margin: 0; font-family: Montserrat, Arial, sans-serif; letter-spacing: 0.5px;'>AIRSHIP EXPRESS</h2>
                    <p style='color: #64748b; margin: 5px 0 0 0; font-size: 13px;'>Hiring Management Portal • Security Notification</p>
                </div>
                <div style='padding: 24px 0;'>
                    <div style='background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;'>
                        <strong style='color: #166534; font-size: 14px;'>Super Admin Password Successfully Updated</strong>
                        <p style='color: #475569; margin: 4px 0 0 0; font-size: 13px;'>The password for your Super Administrator account (<strong>" . htmlspecialchars($user['User_Email']) . "</strong>) was successfully reset.</p>
                    </div>

                    <div style='background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #334155; line-height: 1.6;'>
                        <p style='margin: 0 0 6px 0; font-weight: bold; color: #0f172a;'>Event Details:</p>
                        <p style='margin: 0 0 4px 0;'>• Time: <strong>{$resetTime}</strong></p>
                        <p style='margin: 0 0 4px 0;'>• Requesting IP: <strong>{$clientIp}</strong></p>
                        <p style='margin: 0;'>• Authorization: <strong>Two-Factor Authenticator Verified</strong></p>
                    </div>

                    <p style='font-size: 12.5px; color: #dc2626; line-height: 1.5; margin: 0;'>
                        <strong>Important:</strong> If you did NOT perform this password reset, your credentials may have been breached. Access phpMyAdmin immediately to lock the root account.
                    </p>
                </div>
                <div style='border-top: 1px solid #e5e4e7; padding-top: 18px; text-align: center; font-size: 12px; color: #9ca3af;'>
                    <p style='margin: 0;'>This is an automated high-priority security dispatch. Do not reply.</p>
                </div>
            </div>
            ";
            $mail->send();
        } catch (Throwable $mailErr) {
            error_log("Failed to send Super Admin reset confirmation: " . $mailErr->getMessage());
        }
    }

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
?>
