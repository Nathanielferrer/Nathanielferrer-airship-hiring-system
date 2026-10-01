<?php
// Include database connection (which handles CORS headers)
require_once '../db.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

// Autoload PHPMailer classes manually (Vanilla PHP setup)
require '../libs/PHPMailer/src/Exception.php';
require '../libs/PHPMailer/src/PHPMailer.php';
require '../libs/PHPMailer/src/SMTP.php';

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
    // ── Rate Limiting: 3 password reset requests per 15 minutes per IP ───────
    // Tracked by IP address since users are not logged in yet.
    // Prevents email bombing attacks that could get our Gmail account banned for spamming.
    require_once '../rate_limit.php';
    check_rate_limit($pdo, 'forgot_password', 3, 15, 'ip');

    // 1. Check if user exists (Applicants: is_admin = 0, Super Admin: is_admin = 3)
    $stmt = $pdo->prepare("SELECT user_id, User_Fname, User_Lname, is_admin, totp_enabled FROM users_tbl WHERE User_Email = :email");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    if ($user) {
        $isAdmin = intval($user['is_admin'] ?? 0);

        // Regular Admins (is_admin = 1) must be managed by the Super Admin
        if ($isAdmin === 1) {
            echo json_encode([
                "status" => "success",
                "message" => "If an account exists for this email, password recovery instructions have been sent."
            ]);
            exit();
        }

        // 2. Generate a cryptographically secure token and a 15-minute expiration time
        $token = bin2hex(random_bytes(32));
        
        // 3. Save the token and expiration to the database
        $updateStmt = $pdo->prepare("UPDATE users_tbl SET reset_token = :token, reset_expires = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE user_id = :id");
        $updateStmt->execute([
            'token' => $token,
            'id' => $user['user_id']
        ]);

        // 4. Send the recovery email using PHPMailer
        $mail = new PHPMailer(true);

        // SMTP settings — credentials loaded from .env via env_loader
        $mail->isSMTP();
        $mail->Host       = getenv('SMTP_HOST') ?: 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = getenv('SMTP_USER') ?: 'nathanielferrer691@gmail.com';
        $mail->Password   = getenv('SMTP_PASS') ?: 'enzc ppph jran heso';
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = (int)(getenv('SMTP_PORT') ?: 587);

        $mail->CharSet    = 'UTF-8';
        $mail->Encoding   = 'base64';

        $mail->setFrom($mail->Username, 'Airship Express Security Portal');
        $mail->addAddress($email, $user['User_Fname'] . ' ' . $user['User_Lname']);

        $resetLink = get_frontend_url() . "/reset-password?token=" . $token;

        $mail->isHTML(true);

        if ($isAdmin === 3) {
            // High-Security Email for Root Super Administrator (Clean Plain White Brand Style)
            $mail->Subject = '🔒 Super Admin Password Reset Authorization - Airship Express';

            // Clean client IP display (convert ::1 to 127.0.0.1 Localhost)
            $clientIp = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
            if (isset($_SERVER['HTTP_X_FORWARDED_FOR']) && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
                $clientIp = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
            }
            if ($clientIp === '::1' || $clientIp === '::ffff:127.0.0.1') {
                $clientIp = '127.0.0.1 (Localhost)';
            }

            // Accurate Philippine Standard Time
            date_default_timezone_set('Asia/Manila');
            $requestTime = date('F j, Y, h:i A') . ' (Philippine Time)';

            $mail->Body = "
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e4e7; border-radius: 8px; background-color: #ffffff;'>
                <div style='text-align: center; border-bottom: 1px solid #e5e4e7; padding-bottom: 20px;'>
                    <h2 style='color: #e6007e; margin: 0; font-family: Montserrat, Arial, sans-serif; letter-spacing: 0.5px;'>AIRSHIP EXPRESS</h2>
                    <p style='color: #64748b; margin: 5px 0 0 0; font-size: 13px;'>Hiring Management Portal • Root Security</p>
                </div>
                <div style='padding: 24px 0;'>
                    <div style='background-color: #fff1f2; border-left: 4px solid #e6007e; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;'>
                        <strong style='color: #9f1239; font-size: 14px;'>Privileged Access Recovery Request</strong>
                        <p style='color: #475569; margin: 4px 0 0 0; font-size: 13px;'>A password reset was requested for the Super Administrator account.</p>
                    </div>

                    <p style='font-size: 16px; color: #1e293b; margin: 0 0 12px 0;'>Hello <strong>" . htmlspecialchars($user['User_Fname']) . "</strong>,</p>
                    <p style='font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px 0;'>
                        To authorize and complete this password reset, click the button below. For security, you will be required to provide your <strong>6-digit Google Authenticator code</strong> or an <strong>Emergency Backup Code</strong> before a new password can be set.
                    </p>

                    <div style='background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #334155; line-height: 1.6;'>
                        <p style='margin: 0 0 6px 0; font-weight: bold; color: #0f172a;'>Request Details:</p>
                        <p style='margin: 0 0 4px 0;'>• Timestamp: <strong>{$requestTime}</strong></p>
                        <p style='margin: 0 0 4px 0;'>• Requesting IP: <strong>{$clientIp}</strong></p>
                        <p style='margin: 0;'>• Validity Window: <strong>15 minutes</strong></p>
                    </div>

                    <div style='text-align: center; margin: 28px 0;'>
                        <a href='" . $resetLink . "' style='background-color: #e6007e; color: #ffffff; padding: 13px 32px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 8px rgba(230, 0, 126, 0.25);'>Authorize & Reset Password</a>
                    </div>
                    <p style='font-size: 12.5px; color: #64748b; line-height: 1.5; margin: 0;'>If you did not initiate this request, someone may be attempting to access your account. Your account remains protected by your Two-Factor Authenticator.</p>
                </div>
                <div style='border-top: 1px solid #e5e4e7; padding-top: 18px; text-align: center; font-size: 12px; color: #9ca3af;'>
                    <p style='margin: 0;'>This is an automated high-priority security dispatch. Do not reply.</p>
                </div>
            </div>
            ";
            $mail->AltBody = "Super Admin Password Reset Request\n\nVisit this link within 15 minutes to reset your password:\n" . $resetLink . "\n\nYou will be required to provide your Google Authenticator 6-digit code or an Emergency Backup Code.";
        } else {
            // Standard Applicant Email
            $mail->Subject = 'Reset Your Password - Airship Express';
            $mail->Body = "
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e4e7; border-radius: 8px; background-color: #ffffff;'>
                <div style='text-align: center; border-bottom: 1px solid #e5e4e7; padding-bottom: 20px;'>
                    <h2 style='color: #e6007e; margin: 0; font-family: Montserrat, Arial, sans-serif;'>AIRSHIP EXPRESS</h2>
                    <p style='color: #64748b; margin: 5px 0 0 0;'>Hiring Management Portal</p>
                </div>
                <div style='padding: 20px 0;'>
                    <p style='font-size: 16px; color: #1e293b;'>Hello " . htmlspecialchars($user['User_Fname']) . ",</p>
                    <p style='font-size: 16px; color: #475569; line-height: 1.6;'>We received a request to reset your password. Click the button below to choose a new password. This link will expire in 15 minutes.</p>
                    <div style='text-align: center; margin: 30px 0;'>
                        <a href='" . $resetLink . "' style='background-color: #e6007e; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(230, 0, 126, 0.2);'>Reset Password</a>
                    </div>
                    <p style='font-size: 13px; color: #64748b;'>If you did not request this, you can safely ignore this email.</p>
                </div>
                <div style='border-top: 1px solid #e5e4e7; padding-top: 20px; text-align: center; font-size: 12px; color: #9ca3af;'>
                    <p style='margin: 0;'>This is an automated email, please do not reply.</p>
                </div>
            </div>
            ";
            $mail->AltBody = "Hello " . $user['User_Fname'] . ",\n\nTo reset your password, please visit this link (expires in 15 minutes):\n" . $resetLink;
        }

        $isPlaceholder = ($mail->Username === 'YOUR_GMAIL_ADDRESS@gmail.com' || $mail->Password === 'YOUR_GOOGLE_APP_PASSWORD');

        if ($isPlaceholder) {
            $logFile = __DIR__ . '/email_log.txt';
            $logContent = "=== PASSWORD RESET EMAIL (DEV MODE) ===\n" .
                          "Date: " . date('Y-m-d H:i:s') . "\n" .
                          "To: $email (" . $user['User_Fname'] . ")\n" .
                          "Reset Link: $resetLink\n" .
                          "=======================================\n\n";
            file_put_contents($logFile, $logContent, FILE_APPEND);
        } else {
            try {
                $mail->send();
            } catch (Exception $mailException) {
                $logFile = __DIR__ . '/email_log.txt';
                $logContent = "=== PASSWORD RESET EMAIL (FALLBACK LOG MODE) ===\n" .
                              "Date: " . date('Y-m-d H:i:s') . "\n" .
                              "To: $email (" . $user['User_Fname'] . ")\n" .
                              "Reset Link: $resetLink\n" .
                              "Mail Error: " . $mailException->getMessage() . "\n" .
                              "================================================\n\n";
                file_put_contents($logFile, $logContent, FILE_APPEND);
            }
        }
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
