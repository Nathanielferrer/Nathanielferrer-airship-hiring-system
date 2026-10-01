<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../email_helper.php';

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

try {
    $pdo->beginTransaction();

    // 1. Fetch applicants in 'PASSED INITIAL' status ordered strictly by applied_at (First-Come, First-Served)
    $appStmt = $pdo->query("
        SELECT a.application_id, a.user_id, a.candidate_name, a.candidate_email, a.status, a.applied_at, j.title AS job_title,
               u.User_Fname, u.User_Lname, u.User_Email
        FROM applications_tbl a
        INNER JOIN users_tbl u ON a.user_id = u.user_id
        INNER JOIN jobs_tbl j ON a.job_id = j.job_id
        WHERE a.status IN ('PASSED INITIAL', 'PASSED INITIAL SCREENING')
        ORDER BY a.applied_at ASC, a.application_id ASC
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

    // 2. Fetch available open slots in strict chronological sequence (earliest date and time first).
    // FIFO Queue: Candidates who applied earliest are assigned the earliest available slots.
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
    $assignedNames     = [];
    $usedSlotIds       = [];
    $fixedLocation     = "352 T. Pinpin Escolta st. Binondo Manila, 1006";
    $fixedRequirements = json_encode(["Printed Resume"]);

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

        // Update application status to PENDING SCHEDULED and record invitation timestamp
        $statusStmt = $pdo->prepare("UPDATE applications_tbl SET status = 'PENDING SCHEDULED', invitation_sent_at = NOW() WHERE application_id = :id");
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
            'Interview Scheduled',
            "Set for {$friendlyDate} at {$friendlyTime}. Please review and confirm your attendance."
        );

        // Collect candidate email notification for post-commit dispatch
        $toEmail = $app['candidate_email'] ?: $app['User_Email'];
        if (!empty($toEmail)) {
            $jobTitle = $app['job_title'] ?? 'Office Staff';
            $emailsToDispatch[] = [
                'email'    => $toEmail,
                'name'     => $candidateName,
                'job'      => $jobTitle,
                'date'     => $date,
                'time'     => $time,
                'end_time' => $endTime,
                'location' => $fixedLocation
            ];
        }

        $assignedCount++;
        $assignedNames[] = $candidateName;
    }

    $pdo->commit();

    // Send emails post-commit so long SMTP connections never block DB transactions
    if (!empty($emailsToDispatch)) {
        foreach ($emailsToDispatch as $dispatch) {
            try {
                sendInterviewScheduleEmail(
                    $dispatch['email'],
                    $dispatch['name'],
                    $dispatch['job'],
                    $dispatch['date'],
                    $dispatch['time'],
                    $dispatch['end_time'],
                    $dispatch['location']
                );
            } catch (\Throwable $e) {
                error_log("[AutoSchedule] Failed to send email to {$dispatch['email']}: " . $e->getMessage());
            }
        }
    }

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

    $msg = "Interview slots assigned successfully ({$assignedCount} candidate" . ($assignedCount === 1 ? '' : 's') . ").";
    if ($assignedCount === 1 && !empty($assignedNames[0])) {
        $msg = "Interview Scheduled. {$assignedNames[0]} moved to Final Interview.";
    } elseif ($assignedCount > 1 && $assignedCount <= 3) {
        $msg = "Interview Scheduled. " . implode(', ', $assignedNames) . " moved to Final Interview.";
    } elseif ($assignedCount > 0) {
        $msg = "Interview Scheduled for {$assignedCount} candidates moved to Final Interview.";
    }

    echo json_encode([
        "status"         => "success",
        "message"        => $msg,
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
