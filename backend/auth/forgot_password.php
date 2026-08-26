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
    // 1. Check if an applicant user exists (is_admin = 0)
    // SECURITY: Admins (is_admin >= 1) cannot reset passwords via self-service email; 
    // administrative accounts are governed strictly via Super Admin provisioning.
    $stmt = $pdo->prepare("SELECT User_ID, User_Fname, User_Lname FROM user WHERE User_Email = :email AND (is_admin = 0 OR is_admin IS NULL)");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    if ($user) {
        // 2. Generate a secure token and a 15-minute expiration time
        $token = bin2hex(random_bytes(32));
        
        // 3. Save the token and expiration to the database
        $updateStmt = $pdo->prepare("UPDATE user SET reset_token = :token, reset_expires = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE User_ID = :id");
        $updateStmt->execute([
            'token' => $token,
            'id' => $user['User_ID']
        ]);

        // 4. Send the verification/recovery email using PHPMailer
        $mail = new PHPMailer(true);

        // SMTP settings for Gmail
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = 'nathanielferrer691@gmail.com';
        $mail->Password   = 'enzc ppph jran heso'; // Google App Password
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

        $mail->CharSet    = 'UTF-8';
        $mail->Encoding   = 'base64';

        $mail->setFrom('nathanielferrer691@gmail.com', 'Airship Express Hiring Portal');
        $mail->addAddress($email, $user['User_Fname'] . ' ' . $user['User_Lname']);

        $resetLink = "http://localhost:5173/reset-password?token=" . $token;

        $mail->isHTML(true);
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

        // Logging fallback for local developer testing when SMTP fails or in sandbox mode
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
                // If mailer fails (e.g. network block), fallback to writing to log file
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

    // Generic success response to mitigate username enumeration attacks (OWASP A07)
    echo json_encode([
        "status" => "success",
        "message" => "If an applicant account exists for this email, password recovery instructions have been sent."
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database error: " . $e->getMessage()
    ]);
}
