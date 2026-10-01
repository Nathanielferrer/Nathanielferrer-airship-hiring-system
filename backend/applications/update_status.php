<?php
// Include database connection (sets CORS headers)
require_once '../db.php';
require_once __DIR__ . '/../auth/auth_guard.php';

header('Content-Type: application/json');

// ── AUTHENTICATION: Admin required ──────────────────────────────────────────
$admin = require_admin();

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$id     = isset($data['id']) ? intval($data['id']) : (isset($data['application_id']) ? intval($data['application_id']) : 0);
$status = isset($data['status']) ? strtoupper(trim($data['status'])) : '';
$remarks = isset($data['remarks']) ? trim($data['remarks']) : '';

$allowedStatuses = [
    'PENDING', 'REVIEW_REQUIRED', 'REJECTED', 'SCREENING_REJECTED', 'PASSED INITIAL',
    'SCHEDULING EXPIRED', 'SCHEDULING_EXPIRED', 'Scheduling Expired',
    'DECLINED - UNRESPONSIVE', 'PENDING SCHEDULED', 'CONFIRMED',
    'RESCHEDULING', 'HIRED', 'PASSED', 'HIRED / PASSED',
    'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'PASSED INTERVIEW', 'FAILED', 'ARCHIVED',
    'PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW',
    'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW',
    'Candidate No Show', 'CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW',
    'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL',
    'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL',
    'Candidate Withdrew', 'CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW',
    'Incomplete Requirements', 'INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS',
    'Failed Pre-Employment', 'FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT',
    'Requirements Verified', 'REQUIREMENTS_VERIFIED', 'REQUIREMENTS VERIFIED',
    'Contract Signing Scheduled', 'CONTRACT_SIGNING_SCHEDULED', 'CONTRACT SIGNING SCHEDULED',
    'Officially Hired', 'OFFICIALLY HIRED', 'OFFICIALLY_HIRED',
    'Contract Signed & Onboarded', 'CONTRACT_SIGNED_AND_ONBOARDED', 'CONTRACT SIGNED & ONBOARDED',
    'Completed Requirements', 'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS',
    'Partially Compliant', 'PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT'
];

if ($id <= 0 || !in_array($status, $allowedStatuses)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid application ID or status parameter."
    ]);
    exit();
}

try {
    $pdo->beginTransaction();

    // Fetch previous application info + job title for audit details and user ID for notifications
    $candStmt = $pdo->prepare("
        SELECT a.candidate_name, a.candidate_email, a.job_id, a.status, a.user_id, j.title AS job_title
        FROM applications_tbl a
        LEFT JOIN jobs_tbl j ON j.job_id = a.job_id
        WHERE a.application_id = :id
    ");
    $candStmt->execute(['id' => $id]);
    $candInfo = $candStmt->fetch(PDO::FETCH_ASSOC);

    // Identity strictly extracted from verified JWT token
    $actor_name = trim(($admin['first_name'] ?? '') . ' ' . ($admin['last_name'] ?? '')) ?: 'HR Admin';
    $evalDate = date('M j, Y');
    $signature = "|||SIG|||" . $actor_name . "|||" . $evalDate;

    $isTerminalStatus = in_array(strtoupper(trim($status)), [
        'CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'WITHDRAWN',
        'CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW', 'NO SHOW', 'NO_SHOW',
        'OFFER DECLINED', 'OFFER_DECLINED', 'JOB OFFER DECLINED',
        'REJECTED', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED',
        'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'FAILED FINAL APPROVAL'
    ]);
    $withdrawnSql = $isTerminalStatus ? ", withdrawn_at = COALESCE(withdrawn_at, NOW())" : "";

    // Perform the application status update
    if (strtoupper($status) === 'ARCHIVED') {
        $stmt = $pdo->prepare("UPDATE applications_tbl SET is_archived = 1 WHERE application_id = :id");
    } else if (!empty($remarks)) {
        $formattedRemarks = $remarks . $signature;
        $stmt = $pdo->prepare("UPDATE applications_tbl SET status = :status, remarks = :remarks {$withdrawnSql} WHERE application_id = :id");
    } else {
        $stmt = $pdo->prepare("UPDATE applications_tbl SET status = :status {$withdrawnSql} WHERE application_id = :id");
    }
    $params = ['id' => $id];
    if (strtoupper($status) !== 'ARCHIVED') {
        $params['status'] = $status;
    }
    if (!empty($remarks) && strtoupper($status) !== 'ARCHIVED') {
        $params['remarks'] = $formattedRemarks;
    }
    $stmt->execute($params);

    if ($stmt->rowCount() === 0 && !$candInfo) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "Application file not found."
        ]);
        exit();
    }

    $upperStatus = strtoupper($status);
    $prevUpper = strtoupper($candInfo['status'] ?? '');
    $jobId = intval($candInfo['job_id'] ?? 0);

    if ($upperStatus === 'HIRED' || $upperStatus === 'HIRED / PASSED' || $upperStatus === 'PASSED' || $upperStatus === 'PASSED FINAL APPROVAL' || $upperStatus === 'PASSED_FINAL_APPROVAL') {
        if ($jobId > 0) {
            $decStmt = $pdo->prepare("UPDATE jobs_tbl SET availability = availability - 1 WHERE job_id = :jid AND availability > 0");
            $decStmt->execute(['jid' => $jobId]);

            $checkJobStmt = $pdo->prepare("SELECT availability FROM jobs_tbl WHERE job_id = :jid");
            $checkJobStmt->execute(['jid' => $jobId]);
            $jobData = $checkJobStmt->fetch(PDO::FETCH_ASSOC);

            if ($jobData && intval($jobData['availability']) <= 0) {
                $closeStmt = $pdo->prepare("UPDATE jobs_tbl SET status = 'Closed', availability = 0 WHERE job_id = :jid");
                $closeStmt->execute(['jid' => $jobId]);

                $autoArchStmt = $pdo->prepare("
                    UPDATE applications_tbl 
                    SET is_archived = 1 
                    WHERE job_id = :jid 
                    AND UPPER(status) IN ('HIRED', 'PASSED FINAL APPROVAL', 'FAILED FINAL APPROVAL', 'FAILED FINAL INTERVIEW', 'REJECTED', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'DECLINED - UNRESPONSIVE', 'SCHEDULING EXPIRED', 'SCHEDULING_EXPIRED', 'CANDIDATE WITHDREW')
                ");
                $autoArchStmt->execute(['jid' => $jobId]);
            }
        }
    } elseif (in_array($upperStatus, ['CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'OFFER DECLINED', 'OFFER_DECLINED', 'JOB OFFER DECLINED', 'JOB_OFFER_DECLINED', 'INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS', 'FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT']) && in_array($prevUpper, ['HIRED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'PASSED', 'APPROVED FOR JOB OFFER', 'PRESIDENT APPROVED', 'READY FOR OFFER', 'JOB OFFER PENDING', 'OFFER EXTENDED'])) {
        if ($jobId > 0) {
            require_once __DIR__ . '/slot_release_helper.php';
            handle_released_slot($pdo, $jobId, strtolower($status), $candName, $jobTitle);
        }
    }

    // Trigger Notification for Candidate Scheduling Expired / Unresponsive / No-Show & free interview slots
    if (in_array($upperStatus, ['SCHEDULING EXPIRED', 'SCHEDULING_EXPIRED', 'DECLINED - UNRESPONSIVE', 'UNRESPONSIVE', 'DECLINED_UNRESPONSIVE', 'CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW', 'NO SHOW', 'NO_SHOW'])) {
        // Free up any booked interview slots for this candidate by deleting them from live whiteboard
        $delSlot = $pdo->prepare("DELETE FROM interview_slots_tbl WHERE application_id = :aid");
        $delSlot->execute(['aid' => $id]);

        if (!empty($candInfo['user_id'])) {
            $isExpiredOrUnresponsive = in_array($upperStatus, ['SCHEDULING EXPIRED', 'SCHEDULING_EXPIRED', 'DECLINED - UNRESPONSIVE', 'UNRESPONSIVE', 'DECLINED_UNRESPONSIVE']);
            $notifTitle = $isExpiredOrUnresponsive ? 'Application Closed - Scheduling Expired' : 'Final Interview: Marked as No Show';
            $notifMsg = $isExpiredOrUnresponsive
                ? "Your application for " . ($candInfo['job_title'] ?? 'the position') . " was closed because the interview scheduling period expired without a confirmed response."
                : "Our records indicate that you were unable to attend your scheduled Final Interview, and your active application for the " . ($candInfo['job_title'] ?? 'designated') . " role has been closed. Thank you for your interest in Airship Express, and we welcome you to re-apply for future openings.";

            $notifStmt = $pdo->prepare("
                INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read)
                VALUES (:uid, :app_id, :title, :msg, 'status_update', '/application-status', 0)
            ");
            $notifStmt->execute([
                'uid'    => $candInfo['user_id'],
                'app_id' => $id,
                'title'  => $notifTitle,
                'msg'    => $notifMsg
            ]);
        }
    }

    $pdo->commit();
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("[Update Status Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An internal system error occurred while updating the candidate application status."
    ]);
    exit();
}

require_once '../audit_helper.php';
    $actorId   = intval($data['actor_id']   ?? 0);
    $actorName = trim($data['actor_name']   ?? 'Admin');
    $candName  = $candInfo['candidate_name'] ?? "Application #{$id}";
    $oldStatus = $candInfo['status']         ?? 'unknown';
    $jobTitle  = $candInfo['job_title']      ?? 'Unknown Position';

    $category = ($upperStatus === 'ARCHIVED') ? 'Candidate Archiving' : 'Status Change';
    $severity  = ($upperStatus === 'ARCHIVED') ? 'Warning' : 'Info';
    $details   = "Status changed for candidate \"{$candName}\" (applying for \"{$jobTitle}\"): \"{$oldStatus}\" → \"{$status}\".";
    if (!empty($remarks)) {
        $details .= " Remarks: \"{$remarks}\"";
    }

    log_system_audit($pdo, $actorId, $actorName, $category, 'Screening Module', $details, $severity);

    $statusFormatted = ucfirst(str_replace('_', ' ', $status));
    $dynamicMsg = "{$statusFormatted}. {$candName}.";
    if ($upperStatus === 'PASSED INITIAL') {
        $dynamicMsg = "Screening Passed. {$candName} moved to Interview Scheduling.";
    } elseif ($upperStatus === 'SCREENING_REJECTED') {
        $dynamicMsg = "Screening Rejected. {$candName}.";
    } elseif ($upperStatus === 'ARCHIVED') {
        $dynamicMsg = "Candidate Archived. {$candName}.";
    } elseif ($upperStatus === 'PASSED FINAL INTERVIEW' || $upperStatus === 'PASSED_FINAL_INTERVIEW') {
        $dynamicMsg = "Final Interview Passed. {$candName} moved to President Review.";
    } elseif (in_array($upperStatus, ['PRESIDENT APPROVED', 'APPROVED FOR JOB OFFER', 'APPROVED_FOR_JOB_OFFER', 'PASS_FINAL_APPROVAL', 'PASSED FINAL APPROVAL'])) {
        $dynamicMsg = "President Approved. {$candName} moved to Job Offer.";
    } elseif (in_array($upperStatus, ['CONTRACT SIGNED', 'CONTRACT_SIGNED', 'REQUIREMENT PENDING', 'REQUIREMENTS PENDING'])) {
        $dynamicMsg = "Contract Signed. {$candName} moved to Pre-Employment Requirements.";
    } elseif (in_array($upperStatus, ['OFFICIALLY HIRED', 'OFFICIALLY_HIRED'])) {
        $dynamicMsg = "Officially Hired. {$candName} moved to Officially Hired.";
    }

    echo json_encode([
        "status" => "success",
        "message" => $dynamicMsg,
        "candidate_name" => $candName
    ]);

    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }

    // ── Email Notifications for Initial Screening Results ─────────────────────
    try {
        if (!empty($candInfo['user_id'])) {
            $candEmail = $candInfo['candidate_email'] ?? '';
            $candName  = $candInfo['candidate_name'] ?? "Applicant";
            $jobTitle  = $candInfo['job_title'] ?? 'the position';

            require_once __DIR__ . '/../email_helper.php';

            if ($upperStatus === 'PASSED INITIAL') {
                sendApplicationStatusEmail($candEmail, $candName, $jobTitle, 'INITIAL_PASSED', '');

                // In-app notification
                $notifStmt = $pdo->prepare("
                    INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'status_update', '/application-status', 0, NOW())
                ");
                $notifStmt->execute([
                    $candInfo['user_id'], $id,
                    'Initial Screening Passed 🎉',
                    "Congratulations, {$candName}! You have successfully passed the initial screening for {$jobTitle}. Our recruitment team is currently assigning schedules for your final interview, and you will be notified here shortly with your designated date and time."
                ]);
            } elseif ($upperStatus === 'PASSED FINAL INTERVIEW' || $upperStatus === 'PASSED_FINAL_INTERVIEW') {
                sendApplicationStatusEmail($candEmail, $candName, $jobTitle, 'FINAL_PASSED', '');

                // In-app notification
                $notifStmt = $pdo->prepare("
                    INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'interview_passed', '/application-status', 0, NOW())
                ");
                $notifStmt->execute([
                    $candInfo['user_id'], $id,
                    'Final Interview Passed 🎉',
                    "Congratulations, {$candName}! You have successfully passed your final interview for {$jobTitle}. Your application has been forwarded to the President for final approval, and you will receive an official update as soon as a decision is reached."
                ]);
            } elseif (in_array($upperStatus, ['HIRED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL'])) {
                sendApplicationStatusEmail($candEmail, $candName, $jobTitle, 'PRESIDENT_APPROVED', '');

                // In-app notification
                $notifStmt = $pdo->prepare("
                    INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'hired', '/application-status', 0, NOW())
                ");
                $notifStmt->execute([
                    $candInfo['user_id'], $id,
                    "Job Offer Confirmed — Next Step: Contract Signing",
                    "Thank you for accepting the official job offer for the {$jobTitle} position, {$candName}! We are incredibly excited to welcome you to the Airship Express team! Our HR department is currently preparing your official employment contract. You will be notified here as soon as your contract signing schedule is ready."
                ]);
            } elseif (in_array($upperStatus, ['OFFICIALLY HIRED', 'OFFICIALLY_HIRED', 'CONTRACT SIGNED', 'CONTRACT_SIGNED'])) {
                sendApplicationStatusEmail($candEmail, $candName, $jobTitle, 'CONTRACT_SIGNED', '');

                // In-app notification
                $notifStmt = $pdo->prepare("
                    INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'contract_signed', '/application-status', 0, NOW())
                ");
                $notifStmt->execute([
                    $candInfo['user_id'], $id,
                    'Officially Hired 🎉',
                    "Welcome to the team, {$candName}! Your official employment contract for {$jobTitle} has been executed. You are now officially hired at Airship Express."
                ]);
            } elseif (in_array($upperStatus, ['FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'INTERVIEW_FAILED'])) {
                sendApplicationStatusEmail($candEmail, $candName, $jobTitle, 'FINAL_FAILED', '');

                // In-app notification
                $notifStmt = $pdo->prepare("
                    INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'status_update', '/application-status', 0, NOW())
                ");
                $notifStmt->execute([
                    $candInfo['user_id'], $id,
                    'Final Interview Update',
                    "Dear {$candName}, your final interview result for {$jobTitle} has been posted. Please check your Application Status."
                ]);
            } elseif (in_array($upperStatus, ['SCREENING_REJECTED', 'REJECTED'])) {
                sendApplicationStatusEmail($candEmail, $candName, $jobTitle, 'INITIAL_REJECTED', '');

                // In-app notification
                $notifStmt = $pdo->prepare("
                    INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'status_update', '/application-status', 0, NOW())
                ");
                $notifStmt->execute([
                    $candInfo['user_id'], $id,
                    'Application Update',
                    "Dear {$candName}, thank you for your application for the {$jobTitle} position. We have decided not to advance your application at this time."
                ]);
            }
        }
    } catch (\Throwable $notifErr) {
        error_log("[Update Status Post-Commit Notification Error] " . $notifErr->getMessage());
    }
?>
