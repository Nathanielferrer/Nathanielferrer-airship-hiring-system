<?php
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../audit_helper.php';
require_once __DIR__ . '/../../email_helper.php';
require_once __DIR__ . '/../../auth/auth_guard.php';

header('Content-Type: application/json');

// ── AUTHENTICATION: Admin / Super Admin required ─────────────────────────────
$admin = require_admin();

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$application_id = intval($data['application_id'] ?? 0);
$work_start_date = trim($data['work_start_date'] ?? '');
$work_start_time = trim($data['work_start_time'] ?? '');
$work_start_location = trim($data['work_start_location'] ?? '352 T. Pinpin Escolta St., Binondo, Manila, 1006');
$work_start_reporting_to = trim($data['work_start_reporting_to'] ?? 'HR Department / Branch Head');
$work_start_notes = trim($data['work_start_notes'] ?? '');
// Identity strictly extracted from verified JWT token
$actor_id = (int)$admin['sub'];
$actor_name = trim(($admin['first_name'] ?? '') . ' ' . ($admin['last_name'] ?? '')) ?: 'Super Admin';

if (!$application_id || empty($work_start_date)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Application ID and Work Start Date are required."]);
    exit();
}

$startDayOfWeek = (int)date('N', strtotime($work_start_date)); // 1 (Mon) to 7 (Sun)
if ($startDayOfWeek >= 6) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Weekends are disabled. Work start date can only be scheduled on weekdays (Monday to Friday)."]);
    exit();
}

try {
    $candStmt = $pdo->prepare("
        SELECT 
            a.application_id, 
            a.user_id, 
            a.job_id,
            a.status AS current_status,
            a.candidate_name, 
            a.candidate_email, 
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
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Candidate application record not found."]);
        exit();
    }

    $candName = trim($candData['candidate_name'] ?? '') ?: trim(($candData['User_Fname'] ?? '') . ' ' . ($candData['User_Lname'] ?? '')) ?: "Candidate";
    $candEmail = trim($candData['candidate_email'] ?? '') ?: trim($candData['User_Email'] ?? '');
    $jobTitle = $candData['job_title'] ?? 'Position';
    $userId = intval($candData['user_id'] ?? 0);
    $jobId = intval($candData['job_id'] ?? 0);

    $updStmt = $pdo->prepare("
        UPDATE applications_tbl 
        SET status = 'Officially Hired', work_start_date = ?, work_start_time = ?, work_start_location = ?, work_start_reporting_to = ?, work_start_notes = ?, is_archived = 1, updated_at = NOW()
        WHERE application_id = ?
    ");
    $updStmt->execute([
        $work_start_date,
        $work_start_time,
        $work_start_location,
        $work_start_reporting_to,
        $work_start_notes,
        $application_id
    ]);

    // Slot deduction for the job opening upon official hire (only deduct if transitioning to Officially Hired for the first time)
    $alreadyHired = in_array(strtoupper(trim($candData['current_status'] ?? '')), ['OFFICIALLY HIRED', 'COMPLETED REQUIREMENTS']);
    if ($jobId > 0 && !$alreadyHired) {
        $decStmt = $pdo->prepare("UPDATE jobs_tbl SET availability = availability - 1 WHERE job_id = ? AND availability > 0");
        $decStmt->execute([$jobId]);

        $checkStmt = $pdo->prepare("SELECT availability FROM jobs_tbl WHERE job_id = ?");
        $checkStmt->execute([$jobId]);
        $jobData = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if ($jobData && (int)$jobData['availability'] <= 0) {
            $closeStmt = $pdo->prepare("UPDATE jobs_tbl SET status = 'Closed', availability = 0 WHERE job_id = ?");
            $closeStmt->execute([$jobId]);

            // Auto-archive terminal applications for this filled job so they are moved to Audit Records
            $autoArchStmt = $pdo->prepare("
                UPDATE applications_tbl 
                SET is_archived = 1 
                WHERE job_id = ? 
                AND UPPER(status) IN (
                    'REJECTED', 'SCREENING_REJECTED', 'INITIAL_INTERVIEW_REJECTED', 'INITIAL INTERVIEW REJECTED',
                    'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'FAILED INTERVIEW', 'INTERVIEW_FAILED',
                    'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL', 'CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW',
                    'DECLINED - UNRESPONSIVE', 'UNRESPONSIVE', 'SCHEDULING EXPIRED', 'SCHEDULING_EXPIRED',
                    'CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'OFFER DECLINED', 'OFFER_DECLINED',
                    'OFFER EXPIRED', 'OFFER_EXPIRED', 'FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT'
                )
            ");
            $autoArchStmt->execute([$jobId]);
        }
    }

    $formattedDate = date('M j, Y', strtotime($work_start_date));
    $formattedTime = $work_start_time ? (date('g:i A', strtotime($work_start_time)) ?: $work_start_time) : '08:00 AM';

    // In-App Notification
    if ($userId > 0) {
        $notifTitle = "🎉 Cleared for Day 1: Welcome to Airship Express!";
        $notifMsg = "Your pre-employment requirements are verified. Start Date: {$formattedDate} at {$formattedTime} ({$work_start_location}), Reporting to: {$work_start_reporting_to}. Welcome to the Airship Express team!";
        $notifStmt = $pdo->prepare("
            INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
            VALUES (?, ?, ?, ?, 'requirements_completed', '/application-status', 0, NOW())
        ");
        $notifStmt->execute([$userId, $application_id, $notifTitle, $notifMsg]);
    }

    // Email Delivery
    sendApplicationStatusEmail($candEmail, $candName, $jobTitle, 'COMPLETED_REQUIREMENTS', '', [
        'work_start_date' => $work_start_date,
        'work_start_time' => $work_start_time,
        'work_start_location' => $work_start_location,
        'work_start_reporting_to' => $work_start_reporting_to,
        'work_start_notes' => $work_start_notes
    ]);

    log_system_audit($pdo, $actor_id, $actor_name, 'Schedule Change', 'Evaluation Module', "Updated work start schedule for {$candName} ({$jobTitle}): Date={$work_start_date}, Time={$work_start_time}, Location={$work_start_location}, Reporting To={$work_start_reporting_to}.", 'Info');

    echo json_encode([
        "status" => "success",
        "message" => "Work start schedule updated and notification sent successfully."
    ]);
} catch (Exception $e) {
    error_log("[Update Start Schedule Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal system error occurred while updating the work start schedule."]);
}
