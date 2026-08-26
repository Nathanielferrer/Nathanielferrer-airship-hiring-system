<?php
require_once '../db.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require '../libs/PHPMailer/src/Exception.php';
require '../libs/PHPMailer/src/PHPMailer.php';
require '../libs/PHPMailer/src/SMTP.php';

header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$applicationId = isset($data['application_id']) ? intval($data['application_id']) : 0;
$actorId       = intval($data['actor_id']  ?? 0);
$actorName     = trim($data['actor_name']  ?? 'Admin');
$fixedLocation = '352 T. Pinpin Escolta st. Binondo Manila, 1006';

if ($applicationId <= 0) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid application ID.']);
    exit();
}

// ─── Helper: in-app notification ─────────────────────────────────────────────
function insertNotification($pdo, $userId, $appId, $title, $message) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO notifications (user_id, application_id, title, message, type, link, is_read)
            VALUES (:user_id, :app_id, :title, :message, 'interview_scheduled', '/applicant-dashboard', 0)
        ");
        $stmt->execute([
            'user_id' => $userId,
            'app_id'  => $appId,
            'title'   => $title,
            'message' => $message
        ]);
    } catch (PDOException $e) {
        error_log("Notification insert failed: " . $e->getMessage());
    }
}

// ─── Helper: send email ───────────────────────────────────────────────────────
function sendConfirmRescheduleEmail($toEmail, $toName, $date, $startTime, $endTime, $location) {
    if (empty($toEmail)) return;
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

        $mail->setFrom('nathanielferrer691@gmail.com', 'Airship Express Recruitment');
        $mail->addAddress($toEmail, $toName);

        $friendlyDate  = date('D, F j, Y', strtotime($date));
        $friendlyStart = date('g:i A', strtotime($startTime));
        $friendlyEnd   = !empty($endTime) ? date('g:i A', strtotime($endTime)) : '';
        $timeRange     = $friendlyEnd ? "$friendlyStart - $friendlyEnd" : $friendlyStart;

        $mail->isHTML(true);
        $mail->Subject = 'Interview Reschedule Confirmed - Airship Express';
        $mail->Body    = "
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;'>
                <h2 style='color: #e6007e; margin-top: 0;'>Airship Express Hiring Platform</h2>
                <p style='font-size: 15px; color: #1e293b;'>Dear <strong>" . htmlspecialchars($toName) . "</strong>,</p>
                <p style='font-size: 14px; color: #475569; line-height: 1.6;'>Your reschedule request has been reviewed and confirmed by our HR team. Your new interview slot is below. Please log in to confirm your attendance.</p>
                <div style='background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;'>
                    <p style='margin: 5px 0;'><strong>Date:</strong> $friendlyDate</p>
                    <p style='margin: 5px 0;'><strong>Time:</strong> $timeRange</p>
                    <p style='margin: 5px 0;'><strong>Location:</strong> " . htmlspecialchars($location) . "</p>
                </div>
                <div style='margin: 24px 0;'>
                    <a href='http://localhost:5173/application-status' style='background-color: #e6007e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;'>View &amp; Confirm Interview</a>
                </div>
                <p style='font-size: 13px; color: #94a3b8; margin-top: 30px;'>Regards,<br>Airship Express Recruitment Team</p>
            </div>
        ";

        $mail->send();
    } catch (Exception $e) {
        error_log("PHPMailer sending error in confirm_reschedule.php: " . $mail->ErrorInfo);
    }
}

// ─── Main transaction ─────────────────────────────────────────────────────────
try {
    $pdo->beginTransaction();

    // 1. Fetch application + candidate info + requested slot
    $appStmt = $pdo->prepare("
        SELECT a.id, a.user_id, a.candidate_name, a.candidate_email,
               a.status, a.reschedule_requested_slot_id,
               u.User_Fname, u.User_Lname, u.User_Email
        FROM applications a
        INNER JOIN user u ON a.user_id = u.User_ID
        WHERE a.id = :app_id
    ");
    $appStmt->execute(['app_id' => $applicationId]);
    $app = $appStmt->fetch(PDO::FETCH_ASSOC);

    if (!$app) {
        throw new Exception("Application not found.");
    }

    if ($app['status'] !== 'RESCHEDULING') {
        echo json_encode(['status' => 'error', 'message' => 'Application is not in RESCHEDULING status.']);
        $pdo->rollBack();
        exit();
    }

    $slotId = intval($app['reschedule_requested_slot_id'] ?? 0);
    if ($slotId <= 0) {
        echo json_encode(['status' => 'error', 'message' => 'No requested slot found for this application.']);
        $pdo->rollBack();
        exit();
    }

    // 2. Fetch slot details
    $slotStmt = $pdo->prepare("SELECT slot_date, start_time, end_time, status FROM interview_slots WHERE slot_id = :slot_id");
    $slotStmt->execute(['slot_id' => $slotId]);
    $slot = $slotStmt->fetch(PDO::FETCH_ASSOC);

    if (!$slot) {
        throw new Exception("Requested slot not found.");
    }

    if ($slot['status'] !== 'Open') {
        echo json_encode(['status' => 'error', 'message' => 'The requested slot is no longer available.']);
        $pdo->rollBack();
        exit();
    }

    $date      = $slot['slot_date'];
    $startTime = $slot['start_time'];
    $endTime   = $slot['end_time'] ?? '';

    // 3. Book the slot
    $bookStmt = $pdo->prepare("UPDATE interview_slots SET status = 'Booked', applicant_id = :app_id WHERE slot_id = :slot_id");
    $bookStmt->execute(['app_id' => $applicationId, 'slot_id' => $slotId]);

    // 4. Update application: PENDING SCHEDULED, clear reschedule fields
    $updateApp = $pdo->prepare("
        UPDATE applications
        SET status = 'PENDING SCHEDULED',
            reschedule_reason = NULL,
            reschedule_requested_slot_id = NULL
        WHERE id = :id
    ");
    $updateApp->execute(['id' => $applicationId]);

    // 5. Insert or update interviews table
    $checkInt = $pdo->prepare("SELECT COUNT(*) FROM interviews WHERE application_id = :app_id");
    $checkInt->execute(['app_id' => $applicationId]);

    if ($checkInt->fetchColumn() == 0) {
        $insertInt = $pdo->prepare("
            INSERT INTO interviews (application_id, scheduled_date, scheduled_time, location, meeting_link, requirements)
            VALUES (:app_id, :date, :time, :location, '', :req)
        ");
        $insertInt->execute([
            'app_id'   => $applicationId,
            'date'     => $date,
            'time'     => $startTime,
            'location' => $fixedLocation,
            'req'      => json_encode(["Resume"])
        ]);
    } else {
        $updateInt = $pdo->prepare("
            UPDATE interviews
            SET scheduled_date = :date, scheduled_time = :time, location = :location, meeting_link = ''
            WHERE application_id = :app_id
        ");
        $updateInt->execute([
            'app_id'   => $applicationId,
            'date'     => $date,
            'time'     => $startTime,
            'location' => $fixedLocation
        ]);
    }

    // 6. Build friendly strings
    $friendlyDate  = date('D, M j, Y', strtotime($date));
    $friendlyStart = date('g:i A', strtotime($startTime));
    $friendlyEnd   = !empty($endTime) ? date('g:i A', strtotime($endTime)) : '';
    $friendlyTime  = $friendlyEnd ? "$friendlyStart - $friendlyEnd" : $friendlyStart;
    $candidateName = $app['candidate_name'] ?: ($app['User_Fname'] . ' ' . $app['User_Lname']);
    $userId        = intval($app['user_id']);

    // 7. In-app notification
    insertNotification(
        $pdo,
        $userId,
        $applicationId,
        'Reschedule Confirmed – Action Required',
        "Your reschedule request has been approved. New interview: {$friendlyDate} ({$friendlyTime}) at {$fixedLocation}. Please log in to confirm your attendance."
    );

    $pdo->commit();

    // 8. Audit log
    require_once '../audit_helper.php';
    log_system_audit(
        $pdo,
        $actorId,
        $actorName,
        'Interview Scheduling',
        'Interview Module',
        "Confirmed reschedule request for candidate '{$candidateName}' (App ID #{$applicationId}) on {$friendlyDate} ({$friendlyTime}) at {$fixedLocation}.",
        'Info'
    );

    // 9. Email notification (after commit, non-blocking)
    $toEmail = $app['candidate_email'] ?: $app['User_Email'];
    sendConfirmRescheduleEmail($toEmail, $candidateName, $date, $startTime, $endTime, $fixedLocation);

    echo json_encode([
        'status'  => 'success',
        'message' => "Reschedule confirmed for {$candidateName}. Candidate moved to PENDING SCHEDULED."
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Confirm reschedule failed: ' . $e->getMessage()
    ]);
}
?>
