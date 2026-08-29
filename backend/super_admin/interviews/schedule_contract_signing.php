<?php
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../audit_helper.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../../libs/PHPMailer/src/Exception.php';
require_once __DIR__ . '/../../libs/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/../../libs/PHPMailer/src/SMTP.php';

header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$application_id = intval($data['application_id'] ?? ($data['id'] ?? 0));
$scheduled_date = trim($data['scheduled_date'] ?? '');
$scheduled_time = trim($data['scheduled_time'] ?? '');
$location = trim($data['location'] ?? 'Airship Express Main Office - HR Department');
$notes = trim($data['notes'] ?? '');
$actor_id = intval($data['actor_id'] ?? 0);
$actor_name = trim($data['actor_name'] ?? 'Super Admin');

if (!$application_id || empty($scheduled_date) || empty($scheduled_time)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Application ID, date, and time are required."]);
    exit();
}

try {
    $pdo->beginTransaction();

    // Fetch candidate info and job details
    $candStmt = $pdo->prepare("
        SELECT 
            a.application_id, 
            a.user_id, 
            a.job_id, 
            a.candidate_name, 
            a.candidate_email, 
            a.status, 
            j.title AS job_title,
            u.User_Fname,
            u.User_Lname,
            u.User_Email
        FROM applications_tbl a
        LEFT JOIN jobs_tbl j ON j.job_id = a.job_id
        LEFT JOIN users_tbl u ON u.user_id = a.user_id
        WHERE a.application_id = ?
    ");
    $candStmt->execute([$application_id]);
    $candData = $candStmt->fetch(PDO::FETCH_ASSOC);

    if (!$candData) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Application record not found."]);
        exit();
    }

    $candName = trim($candData['candidate_name'] ?? '') ?: trim(($candData['User_Fname'] ?? '') . ' ' . ($candData['User_Lname'] ?? '')) ?: "Application #{$application_id}";
    $candEmail = trim($candData['candidate_email'] ?? '') ?: trim($candData['User_Email'] ?? '');
    $userId = intval($candData['user_id'] ?? 0);
    $jobTitle = $candData['job_title'] ?? 'Position';

    $formattedDate = date('l, F j, Y', strtotime($scheduled_date));

    // Update application record
    $updStmt = $pdo->prepare("
        UPDATE applications_tbl 
        SET 
            status = 'Contract Signing Scheduled',
            contract_signing_date = ?,
            contract_signing_time = ?,
            contract_signing_location = ?,
            contract_signing_notes = ?,
            updated_at = NOW()
        WHERE application_id = ?
    ");
    $updStmt->execute([$scheduled_date, $scheduled_time, $location, $notes, $application_id]);

    // Insert or update in interviews_tbl for calendar tracking
    $chkInv = $pdo->prepare("SELECT interview_id FROM interviews_tbl WHERE application_id = ? ORDER BY interview_id DESC LIMIT 1");
    $chkInv->execute([$application_id]);
    $existingInvId = $chkInv->fetchColumn();

    $invReqs = $notes ?: "Contract signing and formal onboarding orientation.";

    $timeForDb = date('H:i:s', strtotime($scheduled_time) ?: time());
    if ($existingInvId) {
        $invStmt = $pdo->prepare("
            UPDATE interviews_tbl 
            SET scheduled_date = ?, scheduled_time = ?, location = ?, requirements = ?, event_type = 'contract_signing'
            WHERE interview_id = ?
        ");
        $invStmt->execute([$scheduled_date, $timeForDb, $location, $invReqs, $existingInvId]);
    } else {
        $invStmt = $pdo->prepare("
            INSERT INTO interviews_tbl (application_id, scheduled_date, scheduled_time, location, requirements, event_type, created_at)
            VALUES (?, ?, ?, ?, ?, 'contract_signing', NOW())
        ");
        $invStmt->execute([$application_id, $scheduled_date, $timeForDb, $location, $invReqs]);
    }

    // In-App Notification
    if ($userId > 0) {
        $notifTitle = "Contract Signing Scheduled";
        $notifMsg = "Your pre-employment requirements have been verified. Your official contract signing is scheduled for {$formattedDate} at {$scheduled_time}.";
        $notifStmt = $pdo->prepare("
            INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
            VALUES (?, ?, ?, ?, 'contract_signing', '/application-status', 0, NOW())
        ");
        $notifStmt->execute([$userId, $application_id, $notifTitle, $notifMsg]);
    }

    // System Audit Trail
    $details = "Scheduled contract signing for candidate \"{$candName}\" (applying for \"{$jobTitle}\") on {$formattedDate} at {$scheduled_time}. Status set to \"Contract Signing Scheduled\".";
    log_system_audit($pdo, $actor_id, $actor_name, 'Status Change', 'Evaluation Module', $details, 'Info');

    $pdo->commit();

    // Send Email Notification
    if (!empty($candEmail)) {
        try {
            $mail = new PHPMailer(true);
            $mail->isSMTP();
            $mail->Host       = 'smtp.gmail.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = 'airshipexpress2026@gmail.com';
            $mail->Password   = 'vyqf gsmv vryc ftic';
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = 587;
            $mail->CharSet    = 'UTF-8';
            $mail->Encoding   = 'base64';

            $mail->setFrom('airshipexpress2026@gmail.com', 'Airship Express HR');
            $mail->addAddress($candEmail, $candName);

            $mail->isHTML(true);
            $mail->Subject = "Contract Signing & Onboarding Schedule - {$jobTitle} - Airship Express";

            $notesSection = '';
            if (!empty($notes)) {
                $notesSection = "
                    <div style='margin-top: 15px; padding: 12px 16px; background-color: #fdf2f8; border-left: 4px solid #e6007e; border-radius: 4px;'>
                        <p style='margin: 0 0 4px 0; font-size: 13px; font-weight: bold; color: #9d174d;'>Special Instructions & What to Bring:</p>
                        <p style='margin: 0; font-size: 13px; color: #374151; line-height: 1.5;'>" . nl2br(htmlspecialchars($notes)) . "</p>
                    </div>
                ";
            }

            $mail->Body = "
            <!DOCTYPE html>
            <html>
            <head><meta charset='UTF-8'></head>
            <body style='font-family: Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px;'>
                <div style='max-width: 600px; margin: auto; background: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 2px 10px rgba(0,0,0,0.05);'>
                    <div style='border-bottom: 2px solid #e6007e; padding-bottom: 12px; margin-bottom: 20px;'>
                        <h2 style='color: #0f172a; margin: 0; font-size: 20px;'>Airship Express - Contract Signing & Onboarding</h2>
                    </div>
                    <p style='font-size: 15px; color: #334155; margin-bottom: 14px;'>Dear <strong>" . htmlspecialchars($candName) . "</strong>,</p>
                    <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                        We are pleased to inform you that your pre-employment documents have been verified and approved. 
                        You are officially scheduled for your <strong>Employment Contract Signing &amp; Onboarding Orientation</strong> for the <strong>" . htmlspecialchars($jobTitle) . "</strong> position.
                    </p>
                    <div style='background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; margin: 20px 0;'>
                        <h3 style='margin: 0 0 12px 0; font-size: 15px; color: #166534;'>Appointment Details</h3>
                        <table style='width: 100%; border-collapse: collapse; font-size: 13.5px;'>
                            <tr>
                                <td style='padding: 6px 0; color: #64748b; width: 140px; font-weight: bold;'>Date:</td>
                                <td style='padding: 6px 0; color: #0f172a; font-weight: bold;'>{$formattedDate}</td>
                            </tr>
                            <tr>
                                <td style='padding: 6px 0; color: #64748b; font-weight: bold;'>Time:</td>
                                <td style='padding: 6px 0; color: #0f172a; font-weight: bold;'>" . htmlspecialchars($scheduled_time) . "</td>
                            </tr>
                        </table>
                        {$notesSection}
                    </div>
                    <div style='border-top: 1px solid #e2e8f0; margin-top: 25px; padding-top: 15px;'>
                        <p style='font-size: 13px; color: #64748b; margin: 0;'>Sincerely,</p>
                        <p style='font-size: 14px; font-weight: bold; color: #0f172a; margin: 2px 0 0 0;'>Human Resources Department</p>
                        <p style='font-size: 12px; color: #94a3b8; margin: 2px 0 0 0;'>Airship Express Logistics</p>
                    </div>
                </div>
            </body>
            </html>";

            $mail->send();
        } catch (\Exception $e) {
            error_log("Failed to send contract signing email to {$candEmail}: " . $e->getMessage());
        }
    }

    echo json_encode([
        "status" => "success",
        "message" => "Contract signing scheduled successfully for {$candName}.",
        "scheduled_date" => $scheduled_date,
        "scheduled_time" => $scheduled_time,
        "formatted_date" => $formattedDate,
        "location" => $location
    ]);

} catch (\Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}
?>
