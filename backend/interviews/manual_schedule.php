<?php
require_once __DIR__ . '/../db.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../libs/PHPMailer/src/Exception.php';
require_once __DIR__ . '/../libs/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/../libs/PHPMailer/src/SMTP.php';

header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$applicationId = isset($data['application_id']) ? intval($data['application_id']) : (isset($data['id']) ? intval($data['id']) : 0);
$userId        = isset($data['user_id'])        ? intval($data['user_id'])        : 0;
$date          = isset($data['date'])           ? trim($data['date'])             : '';
$startTime     = isset($data['start_time'])     ? trim($data['start_time'])       : '';
$endTime       = isset($data['end_time'])       ? trim($data['end_time'])         : '';
$location      = isset($data['location'])       ? trim($data['location'])         : '352 T. Pinpin Escolta st. Binondo Manila, 1006';
$slotId        = isset($data['slot_id'])        ? intval($data['slot_id'])        : 0;

// Auto-resolve userId from application_id if not passed
if ($applicationId > 0 && $userId <= 0) {
    try {
        $uStmt = $pdo->prepare("SELECT user_id FROM applications_tbl WHERE application_id = :app_id");
        $uStmt->execute(['app_id' => $applicationId]);
        $userId = intval($uStmt->fetchColumn());
    } catch (PDOException $e) {
        // Handled below
    }
}

// Auto-resolve date & startTime from interview_slots_tbl if slot_id is provided
if ($slotId > 0 && (empty($date) || empty($startTime))) {
    try {
        $sStmt = $pdo->prepare("SELECT slot_date as date, start_time, end_time FROM interview_slots_tbl WHERE slot_id = :slot_id");
        $sStmt->execute(['slot_id' => $slotId]);
        $slotRow = $sStmt->fetch(PDO::FETCH_ASSOC);
        if ($slotRow) {
            $date      = $slotRow['date'];
            $startTime = $slotRow['start_time'];
            $endTime   = $slotRow['end_time'];
        }
    } catch (PDOException $e) {
        // Handled below
    }
}

if ($applicationId <= 0 || $userId <= 0 || empty($date) || empty($startTime)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid scheduling parameters. Application ID and a valid Date/Slot are required.']);
    exit();
}

function insertNotification($pdo, $userId, $appId, $title, $message) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read)
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

function sendManualScheduledEmail($toEmail, $toName, $date, $startTime, $endTime, $location) {
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
        $mail->Subject = 'Interview Scheduled - Airship Express';
        $mail->Body    = "
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;'>
                <h2 style='color: #e6007e; margin-top: 0;'>Airship Express Hiring Platform</h2>
                <p style='font-size: 15px; color: #1e293b;'>Dear <strong>" . htmlspecialchars($toName) . "</strong>,</p>
                <p style='font-size: 14px; color: #475569; line-height: 1.6;'>Your face-to-face interview has been scheduled. Please review the appointment details below and log in to confirm your attendance.</p>
                <div style='background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;'>
                    <p style='margin: 5px 0;'><strong>Date:</strong> {$friendlyDate}</p>
                    <p style='margin: 5px 0;'><strong>Time:</strong> {$timeRange}</p>
                    <p style='margin: 5px 0;'><strong>Location:</strong> " . htmlspecialchars($location) . "</p>
                </div>
                <div style='margin: 24px 0;'>
                    <a href='http://localhost:5173/application-status' style='background-color: #e6007e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;'>Log In to Portal</a>
                </div>
                <p style='font-size: 13px; color: #94a3b8; margin-top: 30px;'>Regards,<br>Airship Express Recruitment Team</p>
            </div>
        ";

        $mail->send();
    } catch (Exception $e) {
        error_log("PHPMailer sending error in manual_schedule.php: " . $mail->ErrorInfo);
    }
}

try {
    $pdo->beginTransaction();

    // 1. Fetch application + candidate info
    $appStmt = $pdo->prepare("
        SELECT a.application_id, a.user_id, a.candidate_name, a.candidate_email, a.status,
               u.User_Fname, u.User_Lname, u.User_Email
        FROM applications_tbl a
        INNER JOIN users_tbl u ON a.user_id = u.user_id
        WHERE a.application_id = :app_id
    ");
    $appStmt->execute(['app_id' => $applicationId]);
    $app = $appStmt->fetch(PDO::FETCH_ASSOC);

    if (!$app) {
        throw new Exception("Application not found.");
    }

    // 1.5. Book slot in interview_slots_tbl
    if ($slotId > 0) {
        $bookSlotStmt = $pdo->prepare("UPDATE interview_slots_tbl SET status = 'Booked', application_id = :app_id WHERE slot_id = :slot_id");
        $bookSlotStmt->execute(['app_id' => $applicationId, 'slot_id' => $slotId]);
    }

    // 2. Update application status to PENDING SCHEDULED
    $updateStatus = $pdo->prepare("UPDATE applications_tbl SET status = 'PENDING SCHEDULED' WHERE application_id = :id");
    $updateStatus->execute(['id' => $applicationId]);

    // 3. Insert or update interviews_tbl
    $checkInt = $pdo->prepare("SELECT COUNT(*) FROM interviews_tbl WHERE application_id = :app_id");
    $checkInt->execute(['app_id' => $applicationId]);

    if ($checkInt->fetchColumn() == 0) {
        $insertInt = $pdo->prepare("
            INSERT INTO interviews_tbl (application_id, scheduled_date, scheduled_time, location, requirements)
            VALUES (:app_id, :date, :time, :location, :req)
        ");
        $insertInt->execute([
            'app_id'   => $applicationId,
            'date'     => $date,
            'time'     => $startTime,
            'location' => $location,
            'req'      => json_encode(["Resume"])
        ]);
    } else {
        $updateInt = $pdo->prepare("
            UPDATE interviews_tbl SET scheduled_date = :date, scheduled_time = :time, location = :location
            WHERE application_id = :app_id
        ");
        $updateInt->execute([
            'app_id'   => $applicationId,
            'date'     => $date,
            'time'     => $startTime,
            'location' => $location
        ]);
    }

    // 4. Send in-app notification
    $friendlyDate  = date('D, M j, Y', strtotime($date));
    $friendlyStart = date('g:i A', strtotime($startTime));
    $friendlyEnd   = !empty($endTime) ? date('g:i A', strtotime($endTime)) : '';
    $friendlyTime  = $friendlyEnd ? "{$friendlyStart} - {$friendlyEnd}" : $friendlyStart;

    insertNotification(
        $pdo,
        $userId,
        $applicationId,
        'Interview Scheduled – Action Required',
        "Your face-to-face interview has been scheduled for {$friendlyDate} at {$friendlyTime}. Please log in to confirm your attendance."
    );

    // 5. Send email notification
    $toEmail = $app['candidate_email'] ?: $app['User_Email'];
    $toName  = $app['candidate_name'] ?: ($app['User_Fname'] . ' ' . $app['User_Lname']);
    sendManualScheduledEmail($toEmail, $toName, $date, $startTime, $endTime, $location);

    $pdo->commit();

    // 6. Audit log
    require_once __DIR__ . '/../audit_helper.php';
    $actorId   = intval($data['actor_id']   ?? 0);
    $actorName = trim($data['actor_name']   ?? 'Admin');
    log_system_audit(
        $pdo,
        $actorId,
        $actorName,
        'Interview Scheduling',
        'Screening Module',
        "Manually scheduled interview for candidate \"{$toName}\" (App ID #{$applicationId}) on {$friendlyDate} at {$friendlyTime}.",
        'Info'
    );

    echo json_encode([
        'status'  => 'success',
        'message' => "Interview scheduled for {$friendlyDate} at {$friendlyTime}. Candidate notified."
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
