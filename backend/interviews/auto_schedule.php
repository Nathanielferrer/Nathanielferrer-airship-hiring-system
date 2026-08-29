<?php
require_once __DIR__ . '/../db.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../libs/PHPMailer/src/Exception.php';
require_once __DIR__ . '/../libs/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/../libs/PHPMailer/src/SMTP.php';

header('Content-Type: application/json');

// ─── Helper: send in-app notification ────────────────────────────────────────
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

// ─── Helper: send email via PHPMailer SMTP ───────────────────────────────────
function sendScheduledEmail($toEmail, $toName, $date = '', $startTime = '', $endTime = '') {
    if (empty($toEmail)) return;
    try {
        $mail = new PHPMailer(true);

        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = 'nathanielferrer691@gmail.com';
        $mail->Password   = 'enzc ppph jran heso'; // Google App Password
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

        $mail->CharSet    = 'UTF-8';
        $mail->Encoding   = 'base64';

        $mail->setFrom('nathanielferrer691@gmail.com', 'Airship Express Recruitment');
        $mail->addAddress($toEmail, $toName);

        $friendlyDate  = !empty($date) ? date('D, F j, Y', strtotime($date)) : 'Scheduled Date';
        $friendlyStart = !empty($startTime) ? date('g:i A', strtotime($startTime)) : '';
        $friendlyEnd   = !empty($endTime) ? date('g:i A', strtotime($endTime)) : '';
        $timeRange     = $friendlyEnd ? "$friendlyStart - $friendlyEnd" : $friendlyStart;

        $slotInfoBlock = '';
        if ($friendlyDate && $timeRange) {
            $slotInfoBlock = "
                <div style='background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;'>
                    <p style='margin: 5px 0;'><strong>Date:</strong> $friendlyDate</p>
                    <p style='margin: 5px 0;'><strong>Time:</strong> $timeRange</p>
                </div>
            ";
        }

        $mail->isHTML(true);
        $mail->Subject = 'Interview Scheduled - Airship Express';
        $mail->Body    = "
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;'>
                <h2 style='color: #e6007e; margin-top: 0;'>Airship Express Hiring Platform</h2>
                <p style='font-size: 15px; color: #1e293b;'>Dear <strong>" . htmlspecialchars($toName) . "</strong>,</p>
                <p style='font-size: 14px; color: #475569; line-height: 1.6;'>You have been scheduled for an interview. Please review the details below and log in to confirm your attendance.</p>
                $slotInfoBlock
                <div style='margin: 24px 0;'>
                    <a href='http://localhost:5173/application-status' style='background-color: #e6007e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;'>Log In to Portal</a>
                </div>
                <p style='font-size: 13px; color: #94a3b8; margin-top: 30px;'>Regards,<br>Airship Express Recruitment Team</p>
            </div>
        ";

        $mail->send();
    } catch (Exception $e) {
        error_log("PHPMailer sending error in auto_schedule.php: " . $mail->ErrorInfo);
    }
}

try {
    $pdo->beginTransaction();

    // 1. Fetch applicants in 'PASSED INITIAL' status
    $appStmt = $pdo->query("
        SELECT a.application_id, a.user_id, a.candidate_name, a.candidate_email, a.status,
               u.User_Fname, u.User_Lname, u.User_Email
        FROM applications_tbl a
        INNER JOIN users_tbl u ON a.user_id = u.user_id
        WHERE a.status = 'PASSED INITIAL'
        ORDER BY a.applied_at ASC
    ");
    $applicants = $appStmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($applicants)) {
        echo json_encode([
            "status"         => "info",
            "message"        => "No candidates currently pending scheduling.",
            "assigned_count" => 0
        ]);
        $pdo->commit();
        exit();
    }

    // 2. Fetch available open slots
    $slotStmt = $pdo->query("SELECT slot_id, slot_date, start_time, end_time FROM interview_slots_tbl WHERE status = 'Open' ORDER BY slot_date ASC, start_time ASC");
    $slots = $slotStmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($slots)) {
        http_response_code(400);
        echo json_encode([
            "status"  => "error",
            "message" => "No available open slots found. Please create interview slots first."
        ]);
        $pdo->rollBack();
        exit();
    }

    $assignedCount     = 0;
    $usedSlotIds       = [];
    $fixedLocation     = "352 T. Pinpin Escolta st. Binondo Manila, 1006";
    $fixedRequirements = json_encode(["Resume"]);

    foreach ($applicants as $app) {
        $appId  = $app['application_id'];
        $userId = $app['user_id'];

        // Get previous scheduled date/time if any
        $prevStmt = $pdo->prepare("SELECT scheduled_date, scheduled_time FROM interviews_tbl WHERE application_id = :app_id");
        $prevStmt->execute(['app_id' => $appId]);
        $prevInterview = $prevStmt->fetch(PDO::FETCH_ASSOC);

        $selectedSlot = null;
        foreach ($slots as $slot) {
            if (in_array($slot['slot_id'], $usedSlotIds)) {
                continue;
            }

            if ($prevInterview && !empty($prevInterview['scheduled_date'])) {
                $sameDate = ($slot['slot_date'] === $prevInterview['scheduled_date']);
                $sameTime = (date('H:i', strtotime($slot['start_time'])) === date('H:i', strtotime($prevInterview['scheduled_time'])));
                if ($sameDate && $sameTime) {
                    continue;
                }
            }

            $selectedSlot = $slot;
            break;
        }

        if (!$selectedSlot) {
            continue;
        }

        $usedSlotIds[] = $selectedSlot['slot_id'];
        $slotId  = $selectedSlot['slot_id'];
        $date    = $selectedSlot['slot_date'];
        $time    = $selectedSlot['start_time'];
        $endTime = $selectedSlot['end_time'] ?? '';

        $friendlyDate  = date('D, M j, Y', strtotime($date));
        $friendlyStart = date('g:i A', strtotime($time));
        $friendlyEnd   = !empty($endTime) ? date('g:i A', strtotime($endTime)) : '';
        $friendlyTime  = $friendlyEnd ? "{$friendlyStart} - {$friendlyEnd}" : $friendlyStart;

        // Book the slot
        $bookStmt = $pdo->prepare("UPDATE interview_slots_tbl SET status = 'Booked', application_id = :app_id WHERE slot_id = :slot_id");
        $bookStmt->execute(['app_id' => $appId, 'slot_id' => $slotId]);

        // Update application status to PENDING SCHEDULED
        $statusStmt = $pdo->prepare("UPDATE applications_tbl SET status = 'PENDING SCHEDULED' WHERE application_id = :id");
        $statusStmt->execute(['id' => $appId]);

        // Insert or update interviews_tbl
        $checkInt = $pdo->prepare("SELECT COUNT(*) FROM interviews_tbl WHERE application_id = :app_id");
        $checkInt->execute(['app_id' => $appId]);
        if ($checkInt->fetchColumn() == 0) {
            $insertInt = $pdo->prepare("
                INSERT INTO interviews_tbl (application_id, scheduled_date, scheduled_time, location, requirements)
                VALUES (:app_id, :date, :time, :location, :requirements)
            ");
            $insertInt->execute([
                'app_id'       => $appId,
                'date'         => $date,
                'time'         => $time,
                'location'     => $fixedLocation,
                'requirements' => $fixedRequirements
            ]);
        } else {
            $updateInt = $pdo->prepare("
                UPDATE interviews_tbl SET scheduled_date = :date, scheduled_time = :time, location = :location, requirements = :requirements
                WHERE application_id = :app_id
            ");
            $updateInt->execute([
                'app_id'       => $appId,
                'date'         => $date,
                'time'         => $time,
                'location'     => $fixedLocation,
                'requirements' => $fixedRequirements
            ]);
        }

        // Send in-app notification
        $candidateName = $app['candidate_name'] ?: ($app['User_Fname'] . ' ' . $app['User_Lname']);
        insertNotification(
            $pdo,
            $userId,
            $appId,
            'Interview Scheduled – Action Required',
            "Your interview schedule has been updated to {$friendlyDate} at {$friendlyTime}. Log in to view details and confirm your attendance."
        );

        // Send email notification
        $toEmail = $app['candidate_email'] ?: $app['User_Email'];
        if (!empty($toEmail)) {
            sendScheduledEmail($toEmail, $candidateName, $date, $time, $endTime);
        }

        $assignedCount++;
    }

    $pdo->commit();

    $json = file_get_contents('php://input');
    $data = json_decode($json, true) ?: [];
    $actorId = intval($data['actor_id'] ?? 0);
    $actorName = trim($data['actor_name'] ?? 'Admin');

    require_once __DIR__ . '/../audit_helper.php';
    log_system_audit(
        $pdo,
        $actorId,
        $actorName,
        'Interview Scheduling',
        'Interview Schedule',
        "Auto-scheduled {$assignedCount} candidate(s) for interview.",
        'Info'
    );

    echo json_encode([
        "status"         => "success",
        "message"        => "Interview slots assigned successfully ({$assignedCount} candidate" . ($assignedCount === 1 ? '' : 's') . ").",
        "assigned_count" => $assignedCount
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        "status"  => "error",
        "message" => "Auto-scheduling failed: " . $e->getMessage()
    ]);
}
?>
