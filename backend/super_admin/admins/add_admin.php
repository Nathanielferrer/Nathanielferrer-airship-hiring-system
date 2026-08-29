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
$actorId = intval($data['actor_id'] ?? 0);

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

$tempPassword = substr(base64_encode(random_bytes(16)), 0, 12) . '!Ax' . rand(10, 99);

try {
    // Check email uniqueness
    $check = $pdo->prepare("SELECT user_id, is_admin FROM users_tbl WHERE User_Email = ?");
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

    $hash = password_hash($tempPassword, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("INSERT INTO users_tbl (User_Fname, User_Lname, User_Email, User_Pass, is_admin, is_verified, requires_password_reset) VALUES (?, ?, ?, ?, 1, 1, 1)");
    $stmt->execute([$fname, $lname, $email, $hash]);
    $newAdminId = (int)$pdo->lastInsertId();

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
                    Please use the temporary credentials below to complete your initial login:
                </p>
                <div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;'>
                    <p style='margin: 0 0 8px; font-size: 14px; color: #334155;'><strong>Login Email:</strong> {$email}</p>
                    <p style='margin: 0; font-size: 14px; color: #334155;'><strong>Temporary Password:</strong> <code style='background:#f1f5f9; padding: 2px 6px; border-radius: 4px; color: #e6007e; font-size: 15px; font-weight: bold;'>{$tempPassword}</code></p>
                </div>
                <p style='font-size: 14px; color: #dc2626;'>
                    <strong>Security Notice:</strong> Upon your first login, you will be required to choose a new permanent password.
                </p>
                <div style='text-align: center; margin: 28px 0;'>
                    <a href='http://localhost:5173/admin/login' style='background-color: #e6007e; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 15px; display: inline-block;'>Access Admin Portal</a>
                </div>
            </div>
            <div style='border-top: 1px solid #e5e4e7; padding-top: 16px; text-align: center; font-size: 12px; color: #9ca3af;'>
                <p style='margin: 0;'>This is an automated administrative notification from Airship Express. Do not reply to this email.</p>
            </div>
        </div>
        ";
        $mail->AltBody = "Hello {$fname},\n\nYour admin account has been created.\nEmail: {$email}\nTemporary Password: {$tempPassword}\n\nLog in at: http://localhost:5173/admin/login\nYou will be required to change your password on first login.";

        $mail->send();
        $emailSent = true;
    } catch (Exception $mailEx) {
        $emailError = $mailEx->getMessage();
        $logContent = "=== ADMIN ACCOUNT CREATION EMAIL FALLBACK ===\n" .
                      "Date: " . date('Y-m-d H:i:s') . "\n" .
                      "To: {$email} ({$fname} {$lname})\n" .
                      "Temp Password: {$tempPassword}\n" .
                      "Error: {$emailError}\n" .
                      "============================================\n\n";
        @file_put_contents(__DIR__ . '/email_log.txt', $logContent, FILE_APPEND);
    }

    require_once '../../audit_helper.php';
    $actorStmt = $pdo->prepare("SELECT User_Fname, User_Lname FROM users_tbl WHERE user_id = ?");
    $actorStmt->execute([$actorId]);
    $actorRow = $actorStmt->fetch(PDO::FETCH_ASSOC);
    $actorName = $actorRow ? trim("{$actorRow['User_Fname']} {$actorRow['User_Lname']}") : 'Super Admin';

    $adminFullName = "{$fname} {$lname}";
    $auditDetails = "Created new HR Admin account for \"{$adminFullName}\" (Email: {$email}, ID:{$newAdminId}). Temporary password generated and sent via email.";
    log_system_audit($pdo, $actorId, $actorName, 'Admin Created', 'Admin Management', $auditDetails);

    echo json_encode([
        "status"      => "success",
        "message"     => "Admin account created successfully for {$adminFullName}." . ($emailSent ? " Credentials emailed." : " (Email delivery failed, check server log)."),
        "email_sent"  => $emailSent,
        "admin"       => [
            "id"         => $newAdminId,
            "user_id"    => $newAdminId,
            "User_ID"    => $newAdminId,
            "first_name" => $fname,
            "last_name"  => $lname,
            "email"      => $email,
            "is_admin"   => 1
        ]
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
