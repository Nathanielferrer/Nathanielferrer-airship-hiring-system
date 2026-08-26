<?php
require_once '../../db.php';
header('Content-Type: application/json');

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once '../../libs/PHPMailer/src/Exception.php';
require_once '../../libs/PHPMailer/src/PHPMailer.php';
require_once '../../libs/PHPMailer/src/SMTP.php';

ini_set('display_errors', 0);

$json        = file_get_contents('php://input');
$data        = json_decode($json, true);

$id          = intval($data['id']           ?? 0);
$fname       = trim($data['first_name']     ?? '');
$lname       = trim($data['last_name']      ?? '');
$email       = trim($data['email']          ?? '');
$actorId     = intval($data['actor_id']     ?? 0);  // Super Admin's User_ID
$resetPw     = !empty($data['reset_password']) && $data['reset_password'] === true; // explicit flag

if (!$id || !$fname || !$lname || !$email) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "ID, first name, last name, and email are required."]);
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

try {
    // Verify target account is an admin (not applicant, not super admin) and is Active
    $targetCheck = $pdo->prepare("SELECT User_ID, User_Fname, User_Lname, User_Email, is_admin, COALESCE(status, 'Active') as status FROM user WHERE User_ID = ?");
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

    // Check email uniqueness (ignore same user)
    $check = $pdo->prepare("SELECT User_ID, is_admin FROM user WHERE User_Email = ? AND User_ID != ?");
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

    // Snapshot previous data for audit diff
    $oldFname = $targetUser['User_Fname'];
    $oldLname = $targetUser['User_Lname'];
    $oldEmail = $targetUser['User_Email'];

    require_once '../../audit_helper.php';
    $saStmt = $pdo->prepare("SELECT CONCAT(User_Fname, ' ', User_Lname) as name FROM user WHERE User_ID = ?");
    $saStmt->execute([$actorId]);
    $saName = $saStmt->fetchColumn() ?: 'Super Admin';

    // ── MODE A: Password Reset (triggered by Reset Password button) ────────────
    if ($resetPw) {
        // Auto-generate a cryptographically secure temporary password
        $tempPassword = substr(base64_encode(random_bytes(16)), 0, 12) . '!Ax' . rand(10, 99);
        $hash         = password_hash($tempPassword, PASSWORD_BCRYPT);

        // Update profile + hash + set requires_password_reset = 1
        $stmt = $pdo->prepare("UPDATE user SET User_Fname = ?, User_Lname = ?, User_Email = ?, User_Pass = ?, requires_password_reset = 1 WHERE User_ID = ? AND is_admin >= 1");
        $stmt->execute([$fname, $lname, $email, $hash, $id]);

        // ── Send email with new temp password ─────────────────────────────────
        $emailSent  = false;
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
            $mail->Subject = 'Your Admin Password Has Been Reset - Airship Express';
            $mail->Body = "
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e4e7; border-radius: 8px; background-color: #ffffff;'>
                <div style='text-align: center; border-bottom: 1px solid #e5e4e7; padding-bottom: 20px;'>
                    <h2 style='color: #e6007e; margin: 0; font-family: Montserrat, Arial, sans-serif;'>AIRSHIP EXPRESS</h2>
                    <p style='color: #64748b; margin: 5px 0 0 0;'>Hiring Management Portal</p>
                </div>
                <div style='padding: 24px 0;'>
                    <p style='font-size: 16px; color: #1e293b;'>Hello <strong>{$fname}</strong>,</p>
                    <p style='font-size: 15px; color: #475569; line-height: 1.6;'>
                        Your admin account password has been <strong>reset by the Super Administrator</strong>. 
                        Use the temporary password below to log in. You will be required to set a new password immediately.
                    </p>
                    <div style='background: #fef3c7; border: 1.5px solid #fde68a; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center;'>
                        <p style='margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 0.05em;'>YOUR NEW TEMPORARY PASSWORD</p>
                        <code style='font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: 2px; font-family: Consolas, Monaco, monospace; background: #ffffff; padding: 10px 20px; border-radius: 8px; border: 1px solid #fde68a; display: inline-block;'>{$tempPassword}</code>
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
                        If you did not request this reset, please contact your Super Administrator immediately. Do not share this password with anyone.
                    </p>
                </div>
                <div style='border-top: 1px solid #e5e4e7; padding-top: 16px; text-align: center; font-size: 12px; color: #9ca3af;'>
                    <p style='margin: 0;'>Automated notification - Airship Express Hiring Portal. Do not reply.</p>
                </div>
            </div>
            ";
            $mail->AltBody = "Hello {$fname},\n\nYour admin password has been reset.\n\nEmail: {$email}\nNew Temporary Password: {$tempPassword}\n\nPlease log in and change your password immediately.\n\nLogin: http://localhost:5173/login";

            $mail->send();
            $emailSent = true;
        } catch (Exception $mailEx) {
            $emailError = $mailEx->getMessage();
            $logFile = __DIR__ . '/admin_provisioning_log.txt';
            file_put_contents($logFile,
                "=== PASSWORD RESET (EMAIL FALLBACK) ===\n" .
                "Date: " . date('Y-m-d H:i:s') . "\n" .
                "Admin: {$fname} {$lname} <{$email}>\n" .
                "New Temp Password: {$tempPassword}\n" .
                "Mail Error: {$emailError}\n" .
                "=======================================\n\n",
                FILE_APPEND
            );
        }

        // ── Audit log (admin_audit_log only — Super Admin action) ─────────────
        $emailStatus  = $emailSent ? "New temp password emailed to {$email}." : "Email delivery failed — password logged to file.";
        $auditDetails = "Password reset for Admin \"{$fname} {$lname}\" (ID:{$id}). {$emailStatus}";
        $logStmt      = $pdo->prepare("INSERT INTO admin_audit_log (actor_id, target_id, action, details) VALUES (?, ?, 'password_reset_by_super_admin', ?)");
        $logStmt->execute([$actorId, $id, $auditDetails]);

        $msg = $emailSent
            ? "Password reset successfully. A new temporary password has been emailed to {$email}."
            : "Password updated in database. Automated email delivery could not be completed, but the temporary password has been generated.";

        echo json_encode([
            "status"     => "success",
            "message"    => $msg,
            "email_sent" => $emailSent
        ]);
        exit();
    }

    // ── MODE B: Profile Update Only (name / email — no password change) ────────
    $stmt = $pdo->prepare("UPDATE user SET User_Fname = ?, User_Lname = ?, User_Email = ? WHERE User_ID = ? AND is_admin >= 1");
    $stmt->execute([$fname, $lname, $email, $id]);

    // Synchronize historical system_audit_logs to reflect updated admin name
    $syncLogs = $pdo->prepare("UPDATE system_audit_logs SET admin_name = ? WHERE admin_id = ?");
    $syncLogs->execute(["{$fname} {$lname}", $id]);

    // Build diff string for audit
    $changes = [];
    if ("{$oldFname} {$oldLname}" !== "{$fname} {$lname}") {
        $changes[] = "Name: \"{$oldFname} {$oldLname}\" → \"{$fname} {$lname}\"";
    }
    if ($oldEmail !== $email) {
        $changes[] = "Email: \"{$oldEmail}\" → \"{$email}\"";
    }
    $diffStr = !empty($changes) ? implode(' | ', $changes) : 'No field changes detected.';
    $auditDetails = "Updated Admin account for \"{$oldFname} {$oldLname}\" (ID:{$id}): {$diffStr}";

    // Internal admin_audit_log
    $logStmt = $pdo->prepare("INSERT INTO admin_audit_log (actor_id, target_id, action, details) VALUES (?, ?, 'admin_profile_updated', ?)");
    $logStmt->execute([$actorId, $id, $auditDetails]);

    echo json_encode([
        "status"  => "success",
        "message" => "Admin profile updated successfully."
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
