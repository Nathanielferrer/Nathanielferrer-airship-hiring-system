<?php
require_once '../../db.php';
header('Content-Type: application/json');

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once '../../libs/PHPMailer/src/Exception.php';
require_once '../../libs/PHPMailer/src/PHPMailer.php';
require_once '../../libs/PHPMailer/src/SMTP.php';

ini_set('display_errors', 0);

$json    = file_get_contents('php://input');
$data    = json_decode($json, true);

$fname   = trim($data['first_name'] ?? '');
$lname   = trim($data['last_name']  ?? '');
$email   = trim($data['email']      ?? '');
$actorId = intval($data['actor_id'] ?? 0); // Super Admin's User_ID

if (!$fname || !$lname || !$email) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "First name, last name, and email are required."]);
    exit();
}

if ($actorId <= 0) {
    http_response_code(403);
    echo json_encode(["status" => "error", "message" => "Unauthorized: actor ID is missing."]);
    exit();
}

// ── Email Validation & Domain DNS Check ───────────────────────────────────────
function validate_admin_email_address($email) {
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return "Invalid email format. Please enter a valid email address (e.g., name@gmail.com).";
    }

    $parts = explode('@', $email);
    $domain = strtolower(trim(end($parts)));

    $blacklisted = ['example.com', 'test.com', 'fakemail.com', 'nonexistent.com', 'fake.com', 'tempmail.com', 'invalid.com'];
    if (in_array($domain, $blacklisted)) {
        return "The email domain '@{$domain}' is not allowed. Please enter an active, real email address.";
    }

    if (function_exists('checkdnsrr')) {
        $hasMx = @checkdnsrr($domain, 'MX');
        $hasA  = @checkdnsrr($domain, 'A');
        if (!$hasMx && !$hasA) {
            return "The email domain '@{$domain}' does not exist or has no active mail servers. Please enter a valid, active email address.";
        }
    }

    return null;
}

$emailValidationError = validate_admin_email_address($email);
if ($emailValidationError !== null) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => $emailValidationError]);
    exit();
}

// ── Auto-generate a cryptographically secure temporary password ───────────────
$tempPassword = substr(base64_encode(random_bytes(16)), 0, 12) . '!Ax' . rand(10, 99);

try {
    // Check email uniqueness and guard applicant accounts
    $check = $pdo->prepare("SELECT User_ID, is_admin FROM user WHERE User_Email = ?");
    $check->execute([$email]);
    $existingUser = $check->fetch(PDO::FETCH_ASSOC);
    if ($existingUser) {
        http_response_code(400);
        if (intval($existingUser['is_admin']) === 0) {
            echo json_encode(["status" => "error", "message" => "Cannot assign or convert an applicant account to an admin account."]);
        } else {
            echo json_encode(["status" => "error", "message" => "This email is already in use by another admin account."]);
        }
        exit();
    }

    // Create admin with hashed auto-generated temp password; requires_password_reset = 1
    $hash = password_hash($tempPassword, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("INSERT INTO user (User_Fname, User_Lname, User_Email, User_Pass, is_admin, verified, is_verified, requires_password_reset) VALUES (?, ?, ?, ?, 1, 1, 1, 1)");
    $stmt->execute([$fname, $lname, $email, $hash]);
    $newAdminId = (int)$pdo->lastInsertId();

    // ── Send temp password via email ──────────────────────────────────────────
    $emailSent = false;
    $emailError = '';
    try {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = 'nathanielferrer691@gmail.com';
        $mail->Password   = 'enzc ppph jran heso';
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

        $mail->CharSet    = 'UTF-8';
        $mail->Encoding   = 'base64';

        $mail->setFrom('nathanielferrer691@gmail.com', 'Airship Express Hiring Portal');
        $mail->addAddress($email, "{$fname} {$lname}");

        $mail->isHTML(true);
        $mail->Subject = 'Your Admin Account Has Been Created - Airship Express';
        $mail->Body = "
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e4e7; border-radius: 8px; background-color: #ffffff;'>
            <div style='text-align: center; border-bottom: 1px solid #e5e4e7; padding-bottom: 20px;'>
                <h2 style='color: #e6007e; margin: 0; font-family: Montserrat, Arial, sans-serif;'>AIRSHIP EXPRESS</h2>
                <p style='color: #64748b; margin: 5px 0 0 0;'>Hiring Management Portal</p>
            </div>
            <div style='padding: 24px 0;'>
                <p style='font-size: 16px; color: #1e293b;'>Hello <strong>{$fname}</strong>,</p>
                <p style='font-size: 15px; color: #475569; line-height: 1.6;'>
                    A new admin account has been created for you on the <strong>Airship Express Hiring Portal</strong>. 
                    Use the temporary credentials below to log in. You will be required to set a new password on your first login.
                </p>
                <div style='background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center;'>
                    <p style='margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;'>YOUR TEMPORARY PASSWORD</p>
                    <code style='font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: 2px; font-family: Consolas, Monaco, monospace; background: #ffffff; padding: 10px 20px; border-radius: 8px; border: 1px solid #cbd5e1; display: inline-block;'>{$tempPassword}</code>
                </div>
                <p style='font-size: 13px; color: #64748b; margin-top: 10px;'>
                    <strong>Login Email:</strong> {$email}
                </p>
                <div style='text-align: center; margin: 28px 0;'>
                    <a href='http://localhost:5173/login' style='background-color: #e6007e; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 15px; display: inline-block;'>
                        Log In to Admin Portal
                    </a>
                </div>
                <p style='font-size: 12px; color: #94a3b8; border-top: 1px solid #e5e4e7; padding-top: 14px; margin-top: 10px;'>
                    For security, please change your password immediately after logging in. This temporary password should not be shared with anyone.
                </p>
            </div>
            <div style='border-top: 1px solid #e5e4e7; padding-top: 16px; text-align: center; font-size: 12px; color: #9ca3af;'>
                <p style='margin: 0;'>This is an automated notification from Airship Express Hiring Portal. Do not reply to this email.</p>
            </div>
        </div>
        ";
        $mail->AltBody = "Hello {$fname},\n\nYour admin account has been created.\n\nEmail: {$email}\nTemporary Password: {$tempPassword}\n\nPlease log in and change your password immediately.\n\nLogin: http://localhost:5173/login";

        $mail->send();
        $emailSent = true;
    } catch (Exception $mailEx) {
        $emailError = $mailEx->getMessage();
        $logFile = __DIR__ . '/admin_provisioning_log.txt';
        file_put_contents($logFile,
            "=== NEW ADMIN PROVISIONING (EMAIL FALLBACK) ===\n" .
            "Date: " . date('Y-m-d H:i:s') . "\n" .
            "Admin: {$fname} {$lname} <{$email}>\n" .
            "Temp Password: {$tempPassword}\n" .
            "Mail Error: {$emailError}\n" .
            "==============================================\n\n",
            FILE_APPEND
        );
    }

    // ── Write detailed audit log ──────────────────────────────────────────────
    require_once '../../audit_helper.php';
    $saStmt = $pdo->prepare("SELECT CONCAT(User_Fname, ' ', User_Lname) as name FROM user WHERE User_ID = ?");
    $saStmt->execute([$actorId]);
    $saName = $saStmt->fetchColumn() ?: 'Super Admin';

    $emailStatus = $emailSent ? "Temp password emailed to {$email}." : "Email delivery failed — saved to server backup.";
    $auditDetails = "Created Admin user \"{$fname} {$lname}\" (Email: {$email}, ID:{$newAdminId}). {$emailStatus}";

    // Internal admin_audit_log
    $logStmt = $pdo->prepare("INSERT INTO admin_audit_log (actor_id, target_id, action, details) VALUES (?, ?, 'admin_created', ?)");
    $logStmt->execute([$actorId, $newAdminId, $auditDetails]);

    $responseMsg = $emailSent
        ? "Admin account created successfully. Temporary credentials have been emailed to {$email}."
        : "Admin account created in database. Email delivery could not be completed, but the temporary password has been generated.";

    echo json_encode([
        "status"        => "success",
        "message"       => $responseMsg,
        "admin_id"      => $newAdminId,
        "email_sent"    => $emailSent
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
