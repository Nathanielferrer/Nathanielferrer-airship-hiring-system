<?php
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../auth/auth_guard.php';
require_once __DIR__ . '/../../email_helper.php';

header('Content-Type: application/json');

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once '../../libs/PHPMailer/src/Exception.php';
require_once '../../libs/PHPMailer/src/PHPMailer.php';
require_once '../../libs/PHPMailer/src/SMTP.php';

ini_set('display_errors', 0);

// ── AUTHENTICATION: Super Admin required ─────────────────────────────────────
$superAdmin = require_super_admin();

$json        = file_get_contents('php://input');
$data        = json_decode($json, true);

$id          = intval($data['id'] ?? ($data['user_id'] ?? 0));
$fname       = trim($data['first_name']     ?? '');
$lname       = trim($data['last_name']      ?? '');
$email       = trim($data['email']          ?? '');
// Identity strictly extracted from verified JWT token
$actorId     = (int)$superAdmin['sub'];
$resetPw     = !empty($data['reset_password']) && $data['reset_password'] === true;

if (!$id || !$fname || !$lname || !$email) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "ID, first name, last name, and email are required."]);
    exit();
}

// First name validation: 2 - 50 characters, letters, spaces, hyphen, apostrophe, period
if (mb_strlen($fname) < 2 || mb_strlen($fname) > 50 || !preg_match("/^[a-zA-Z\s\-'\.]+$/", $fname)) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "First name must be between 2 and 50 characters and can only contain letters, spaces, hyphens, apostrophes, and periods."
    ]);
    exit();
}

// Last name validation: 2 - 50 characters, same rules as first name
if (mb_strlen($lname) < 2 || mb_strlen($lname) > 50 || !preg_match("/^[a-zA-Z\s\-'\.]+$/", $lname)) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "Last name must be between 2 and 50 characters and can only contain letters, spaces, hyphens, apostrophes, and periods."
    ]);
    exit();
}

if (strlen($email) > 254) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Email address must not exceed 254 characters."]);
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

try {
    $targetCheck = $pdo->prepare("SELECT user_id, User_Fname, User_Lname, User_Email, is_admin, COALESCE(status, 'Active') as status FROM users_tbl WHERE user_id = ?");
    $targetCheck->execute([$id]);
    $targetUser = $targetCheck->fetch(PDO::FETCH_ASSOC);
    if (!$targetUser || intval($targetUser['is_admin']) === 0) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Target user is an applicant account and cannot be modified via Admin Management."]);
        exit();
    }

    if (strtolower($targetUser['status'] ?? 'active') === 'inactive') {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "This admin account is inactive/deactivated. Profile updates and password resets are locked to preserve historical records."]);
        exit();
    }

    // Check email uniqueness
    $check = $pdo->prepare("SELECT user_id, is_admin FROM users_tbl WHERE User_Email = ? AND user_id != ?");
    $check->execute([$email, $id]);
    $existingEmailUser = $check->fetch(PDO::FETCH_ASSOC);
    if ($existingEmailUser) {
        http_response_code(400);
        if (intval($existingEmailUser['is_admin']) === 0) {
            echo json_encode(["status" => "error", "message" => "Cannot assign an applicant email address to an admin account."]);
        } else {
            echo json_encode(["status" => "error", "message" => "That email is already used by another admin account."]);
        }
        exit();
    }

    $oldFname = $targetUser['User_Fname'];
    $oldLname = $targetUser['User_Lname'];
    $oldEmail = $targetUser['User_Email'];

    $tempPassword = null;
    $pwResetSent  = false;

    if ($resetPw) {
        $tempPassword = substr(base64_encode(random_bytes(16)), 0, 12) . '!Ax' . rand(10, 99);
        $hash = password_hash($tempPassword, PASSWORD_BCRYPT);

        $stmt = $pdo->prepare("
            UPDATE users_tbl
            SET User_Fname = ?,
                User_Lname = ?,
                User_Email = ?,
                User_Pass = ?,
                requires_password_reset = 1,
                setup_token = NULL,
                setup_token_expires = NULL
            WHERE user_id = ? AND is_admin = 1
        ");
        $stmt->execute([$fname, $lname, $email, $hash, $id]);

        try {
            $adminLoginUrl = get_frontend_url() . '/login';
            $subject = 'Your Admin Password Has Been Reset - Airship Express';
            $htmlBody = "
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e4e7; border-radius: 8px; background-color: #ffffff;'>
                <div style='text-align: center; border-bottom: 1px solid #e5e4e7; padding-bottom: 20px;'>
                    <h2 style='color: #e6007e; margin: 0; font-family: Montserrat, Arial, sans-serif;'>AIRSHIP EXPRESS</h2>
                    <p style='color: #64748b; margin: 5px 0 0 0;'>Hiring Management Portal</p>
                </div>
                <div style='padding: 24px 0;'>
                    <p style='font-size: 16px; color: #1e293b;'>Hello <strong>{$fname}</strong>,</p>
                    <p style='font-size: 15px; color: #475569; line-height: 1.6;'>
                        Your admin password for the <strong>Airship Express Hiring Portal</strong> has been reset by the Super Administrator. 
                        Please log in with the new temporary credentials below:
                    </p>
                    <div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;'>
                        <p style='margin: 0 0 8px; font-size: 14px; color: #334155;'><strong>Login Email:</strong> {$email}</p>
                        <p style='margin: 0; font-size: 14px; color: #334155;'><strong>New Temporary Password:</strong> <code style='background:#f1f5f9; padding: 2px 6px; border-radius: 4px; color: #e6007e; font-size: 15px; font-weight: bold;'>{$tempPassword}</code></p>
                    </div>
                    <p style='font-size: 14px; color: #dc2626;'>
                        <strong>Security Notice:</strong> You will be required to set a new permanent password immediately upon logging in.
                    </p>
                    <div style='text-align: center; margin: 28px 0;'>
                        <a href='{$adminLoginUrl}' style='background-color: #e6007e; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 15px; display: inline-block;'>Access Admin Portal</a>
                    </div>
                    <p style='font-size: 12.5px; color: #64748b; line-height: 1.5; margin-top: 14px; text-align: center;'>If the button above does not work, visit directly:<br><span style='color: #e6007e; word-break: break-all; font-family: monospace; font-size: 12px;'>{$adminLoginUrl}</span></p>
                </div>
                <div style='border-top: 1px solid #e5e4e7; padding-top: 16px; text-align: center; font-size: 12px; color: #9ca3af;'>
                    <p style='margin: 0;'>This is an automated administrative notification from Airship Express. Do not reply to this email.</p>
                </div>
            </div>
            ";
            $altBody = "Hello {$fname},\n\nYour admin password has been reset.\nEmail: {$email}\nNew Temporary Password: {$tempPassword}\n\nLog in at: {$adminLoginUrl}";

            $pwResetSent = send_email($email, "{$fname} {$lname}", $subject, $htmlBody, $altBody, 'Airship Express Hiring Portal');
        } catch (\Throwable $mailEx) {
            error_log("[update_admin.php] Failed to email admin password reset: " . $mailEx->getMessage());
            $logContent = "=== ADMIN PASSWORD RESET EMAIL FALLBACK ===\n" .
                          "Date: " . date('Y-m-d H:i:s') . "\n" .
                          "To: {$email} ({$fname} {$lname})\n" .
                          "New Temp Password: {$tempPassword}\n" .
                          "Error: " . $mailEx->getMessage() . "\n" .
                          "===========================================\n\n";
            @file_put_contents(__DIR__ . '/email_log.txt', $logContent, FILE_APPEND);
        }
    } else {
        $stmt = $pdo->prepare("
            UPDATE users_tbl
            SET User_Fname = ?,
                User_Lname = ?,
                User_Email = ?
            WHERE user_id = ? AND is_admin = 1
        ");
        $stmt->execute([$fname, $lname, $email, $id]);
    }

    require_once '../../audit_helper.php';
    $actorStmt = $pdo->prepare("SELECT User_Fname, User_Lname FROM users_tbl WHERE user_id = ?");
    $actorStmt->execute([$actorId]);
    $actorRow = $actorStmt->fetch(PDO::FETCH_ASSOC);
    $actorName = $actorRow ? trim("{$actorRow['User_Fname']} {$actorRow['User_Lname']}") : 'Super Admin';

    $changes = [];
    if ($oldFname !== $fname) $changes[] = "First Name: '{$oldFname}' → '{$fname}'";
    if ($oldLname !== $lname) $changes[] = "Last Name: '{$oldLname}' → '{$lname}'";
    if ($oldEmail !== $email) $changes[] = "Email: '{$oldEmail}' → '{$email}'";
    if ($resetPw)            $changes[] = "Password reset issued (temp password generated & emailed)";

    $changeSummary = !empty($changes) ? implode(', ', $changes) : 'No field values changed';
    $auditDetails  = "Updated HR Admin profile for \"{$fname} {$lname}\" (ID:{$id}). Changes: [{$changeSummary}].";
    log_system_audit($pdo, $actorId, $actorName, 'Admin Updated', 'Admin Management', $auditDetails);

    $msg = "Admin account updated successfully.";
    if ($resetPw) {
        $msg .= $pwResetSent ? " New temporary password sent via email." : " Password reset (email delivery failed, see server log).";
    }

    echo json_encode([
        "status"              => "success",
        "message"             => $msg,
        "password_reset_sent" => $pwResetSent,
        "admin"               => [
            "id"         => $id,
            "user_id"    => $id,
            "User_ID"    => $id,
            "first_name" => $fname,
            "last_name"  => $lname,
            "email"      => $email,
            "is_admin"   => 1
        ]
    ]);

} catch (PDOException $e) {
    error_log("[Update Admin Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal system error occurred while updating the admin account."]);
}
?>
