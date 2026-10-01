<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../email_helper.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../libs/PHPMailer/src/Exception.php';
require_once __DIR__ . '/../libs/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/../libs/PHPMailer/src/SMTP.php';

header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$rawAppIds = $data['application_ids'] ?? null;
if (is_array($rawAppIds)) {
    $applicationIds = array_values(array_filter(array_map('intval', $rawAppIds)));
} elseif (isset($data['application_id']) || isset($data['id'])) {
    $singleId = intval($data['application_id'] ?? ($data['id'] ?? 0));
    $applicationIds = $singleId > 0 ? [$singleId] : [];
} else {
    $applicationIds = [];
}
$actorId       = intval($data['actor_id']  ?? 0);
$actorName     = trim($data['actor_name']  ?? 'Admin');
$fixedLocation = '352 T. Pinpin Escolta st. Binondo Manila, 1006';

if (empty($applicationIds)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid application ID.']);
    exit();
}

function insertNotification($pdo, $userId, $appId, $title, $message) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read)
            VALUES (:user_id, :app_id, :title, :message, 'interview_scheduled', '/application-status', 0)
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

function sendConfirmRescheduleEmail($toEmail, $toName, $date, $startTime, $endTime, $location) {
    if (empty($toEmail)) return;
    try {
        $mail = new PHPMailer(true);

        $mail->isSMTP();
        $mail->Host       = getenv('SMTP_HOST') ?: 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = getenv('SMTP_USER') ?: 'airship.express07@gmail.com';
        $mail->Password   = getenv('SMTP_PASS') ?: 'wqpb nije pcqz qwlc';
        $port             = (int)(getenv('SMTP_PORT') ?: 587);
        $mail->Port       = $port;
        if ($port === 465) {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        } else {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        }
        $mail->Timeout    = 10;
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ];

        $mail->CharSet    = 'UTF-8';
        $mail->Encoding   = 'base64';

        $mail->setFrom($mail->Username, 'Airship Express Recruitment');
        $mail->addAddress($toEmail, $toName);

        $friendlyDate  = date('D, F j, Y', strtotime($date));
        $friendlyStart = date('g:i A', strtotime($startTime));
        $friendlyEnd   = !empty($endTime) ? date('g:i A', strtotime($endTime)) : '';
        $timeRange     = $friendlyEnd ? "$friendlyStart - $friendlyEnd" : $friendlyStart;

        $mail->isHTML(true);
        $mail->Subject = 'Rescheduled Interview Confirmed - Airship Express';
        $mail->Body    = "
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;'>
                <h2 style='color: #e6007e; margin-top: 0;'>Airship Express Hiring Platform</h2>
                <p style='font-size: 15px; color: #1e293b;'>Dear <strong>" . htmlspecialchars($toName) . "</strong>,</p>
                <p style='font-size: 14px; color: #475569; line-height: 1.6;'>Your requested reschedule appointment has been approved and confirmed. Please review the details below:</p>
                <div style='background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;'>
                    <p style='margin: 5px 0;'><strong>New Date:</strong> {$friendlyDate}</p>
                    <p style='margin: 5px 0;'><strong>Time:</strong> {$timeRange}</p>
                    <p style='margin: 5px 0;'><strong>Location:</strong> " . htmlspecialchars($location) . "</p>
                </div>
                <div style='margin: 24px 0;'>
                    <a href='" . get_frontend_url() . "/application-status' style='background-color: #e6007e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;'>Log In to Portal</a>
                </div>
                <p style='font-size: 13px; color: #94a3b8; margin-top: 30px;'>Regards,<br>Airship Express Recruitment Team</p>
            </div>
        ";

        $mail->send();
    } catch (Exception $e) {
        error_log("PHPMailer sending error in confirm_reschedule.php: " . $mail->ErrorInfo);
    }
}

try {
    $pdo->beginTransaction();

    $appStmt = $pdo->prepare("
        SELECT a.application_id, a.user_id, a.candidate_name, a.candidate_email,
               a.status, j.title AS job_title, a.reschedule_requested_slot_id,
               u.User_Fname, u.User_Lname, u.User_Email
        FROM applications_tbl a
        INNER JOIN users_tbl u ON a.user_id = u.user_id
        INNER JOIN jobs_tbl j ON a.job_id = j.job_id
        WHERE a.application_id = :app_id
    ");

    $slotStmt = $pdo->prepare("SELECT slot_date, start_time, end_time, status FROM interview_slots_tbl WHERE slot_id = :slot_id");
    $bookStmt = $pdo->prepare("UPDATE interview_slots_tbl SET status = 'Booked', application_id = :app_id WHERE slot_id = :slot_id");
    $updateApp = $pdo->prepare("
        UPDATE applications_tbl
        SET status = 'CONFIRMED',
            reschedule_reason = NULL,
            reschedule_requested_slot_id = NULL
        WHERE application_id = :id
    ");
    $checkInt = $pdo->prepare("SELECT COUNT(*) FROM interviews_tbl WHERE application_id = :app_id");
    $insertInt = $pdo->prepare("
        INSERT INTO interviews_tbl (application_id, scheduled_date, scheduled_time, location, requirements)
        VALUES (:app_id, :date, :time, :location, :req)
    ");
    $updateInt = $pdo->prepare("
        UPDATE interviews_tbl SET scheduled_date = :date, scheduled_time = :time, location = :location
        WHERE application_id = :app_id
    ");

    require_once __DIR__ . '/../audit_helper.php';

    $confirmedCount = 0;
    $lastFriendlyDate = '';
    $lastFriendlyTime = '';

    foreach ($applicationIds as $applicationId) {
        $appStmt->execute(['app_id' => $applicationId]);
        $app = $appStmt->fetch(PDO::FETCH_ASSOC);

        if (!$app) {
            if (count($applicationIds) === 1) {
                throw new Exception("Application not found.");
            }
            continue;
        }

        if ($app['status'] !== 'RESCHEDULING') {
            if (count($applicationIds) === 1) {
                echo json_encode(['status' => 'error', 'message' => 'Application is not in RESCHEDULING status.']);
                $pdo->rollBack();
                exit();
            }
            continue;
        }

        $slotId = intval($app['reschedule_requested_slot_id'] ?? 0);
        if ($slotId <= 0) {
            if (count($applicationIds) === 1) {
                echo json_encode(['status' => 'error', 'message' => 'No requested slot found for this application.']);
                $pdo->rollBack();
                exit();
            }
            continue;
        }

        $slotStmt->execute(['slot_id' => $slotId]);
        $slot = $slotStmt->fetch(PDO::FETCH_ASSOC);

        if (!$slot) {
            if (count($applicationIds) === 1) {
                throw new Exception("Requested slot not found.");
            }
            continue;
        }

        if ($slot['status'] !== 'Open') {
            if (count($applicationIds) === 1) {
                echo json_encode(['status' => 'error', 'message' => 'The requested slot is no longer available.']);
                $pdo->rollBack();
                exit();
            }
            continue;
        }

        $date      = $slot['slot_date'];
        $startTime = $slot['start_time'];
        $endTime   = $slot['end_time'] ?? '';

        // Book slot
        $bookStmt->execute(['app_id' => $applicationId, 'slot_id' => $slotId]);

        // Update application
        $updateApp->execute(['id' => $applicationId]);

        // Insert or update interview
        $checkInt->execute(['app_id' => $applicationId]);
        if ($checkInt->fetchColumn() == 0) {
            $insertInt->execute([
                'app_id'   => $applicationId,
                'date'     => $date,
                'time'     => $startTime,
                'location' => $fixedLocation,
                'req'      => json_encode(["Printed Resume"])
            ]);
        } else {
            $updateInt->execute([
                'app_id'   => $applicationId,
                'date'     => $date,
                'time'     => $startTime,
                'location' => $fixedLocation
            ]);
        }

        // Notification & email
        $friendlyDate  = date('D, M j, Y', strtotime($date));
        $friendlyStart = date('g:i A', strtotime($startTime));
        $friendlyEnd   = !empty($endTime) ? date('g:i A', strtotime($endTime)) : '';
        $friendlyTime  = $friendlyEnd ? "{$friendlyStart} - {$friendlyEnd}" : $friendlyStart;

        insertNotification(
            $pdo,
            $app['user_id'],
            $applicationId,
            'Reschedule Request Approved',
            "Approved for {$friendlyDate} at {$friendlyTime}. Your interview schedule is confirmed. We look forward to meeting you."
        );

        $toEmail = $app['candidate_email'] ?: $app['User_Email'];
        $toName  = $app['candidate_name'] ?: ($app['User_Fname'] . ' ' . $app['User_Lname']);
        sendConfirmRescheduleEmail($toEmail, $toName, $date, $startTime, $endTime, $fixedLocation);

        log_system_audit(
            $pdo,
            $actorId,
            $actorName,
            'Interview Reschedule',
            'Screening Module',
            "Confirmed reschedule request for candidate \"{$toName}\" (App ID #{$applicationId}) to {$friendlyDate} at {$friendlyTime}.",
            'Info'
        );

        $confirmedCount++;
        $lastFriendlyDate = $friendlyDate;
        $lastFriendlyTime = $friendlyTime;
    } // end foreach

    if ($confirmedCount === 0) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'No eligible reschedule requests could be confirmed.']);
        exit();
    }

    $pdo->commit();

    echo json_encode([
        'status'  => 'success',
        'message' => count($applicationIds) > 1
            ? "Reschedule confirmed for {$confirmedCount} candidates."
            : "Reschedule Confirmed. {$toName}.",
        'candidate_name' => $toName,
        'count'   => $confirmedCount
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
