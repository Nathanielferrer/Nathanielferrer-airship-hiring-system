<?php
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../audit_helper.php';
require_once __DIR__ . '/../../auth/auth_guard.php';
require_once __DIR__ . '/../../email_helper.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../../libs/PHPMailer/src/Exception.php';
require_once __DIR__ . '/../../libs/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/../../libs/PHPMailer/src/SMTP.php';

header('Content-Type: application/json');

// ── AUTHENTICATION: Admin required ──────────────────────────────────────────
$admin = require_admin();

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$rawAppIds = $data['application_ids'] ?? null;
if (is_array($rawAppIds)) {
    $application_ids = array_values(array_filter(array_map('intval', $rawAppIds)));
} elseif (isset($data['application_id']) || isset($data['id'])) {
    $singleId = intval($data['application_id'] ?? ($data['id'] ?? 0));
    $application_ids = $singleId > 0 ? [$singleId] : [];
} else {
    $application_ids = [];
}

$result = trim($data['result'] ?? '');
// Actor identity is extracted from verified JWT token — not client-supplied JSON
$actor_id = (int)$admin['sub'];
$actor_name = trim(($admin['first_name'] ?? '') . ' ' . ($admin['last_name'] ?? '')) ?: 'Admin';
$remarks = trim($data['remarks'] ?? '');
$increase_slot = !empty($data['increase_slot']);

$validResults = [
    'PASS_FINAL_INTERVIEW', 'Passed Final Interview',
    'FAIL_FINAL_INTERVIEW', 'Failed Final Interview',
    'Approved for Job Offer', 'APPROVED FOR JOB OFFER', 'APPROVED_FOR_JOB_OFFER', 'President Approved', 'PRESIDENT APPROVED', 'Approved',
    'PLACE_ON_STANDBY', 'Passed Final — Waiting for Slot', 'PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT', 'WAITLIST',
    'PASS_FINAL_APPROVAL', 'Passed Final Approval', 'HIRED',
    'FAIL_FINAL_APPROVAL', 'Failed Final Approval',
    'Candidate Withdrew', 'CANDIDATE_WITHDREW', 'CANDIDATE WITHDREW',
    'Candidate No Show', 'CANDIDATE_NO_SHOW', 'CANDIDATE NO SHOW', 'NO_SHOW', 'NO SHOW',
    'Contract Signing No Show', 'CONTRACT_SIGNING_NO_SHOW', 'CONTRACT SIGNING NO SHOW', 'CONTRACT_NO_SHOW', 'CONTRACT NO SHOW',
    'Incomplete Requirements', 'INCOMPLETE_REQUIREMENTS', 'INCOMPLETE REQUIREMENTS',
    'Failed Pre-Employment', 'FAILED_PRE_EMPLOYMENT', 'FAILED PRE-EMPLOYMENT',
    'VERIFY_REQUIREMENTS', 'Requirements Verified', 'REQUIREMENTS_VERIFIED', 'VERIFY_ALL_REQUIREMENTS',
    'Requirement Pending', 'REQUIREMENT PENDING', 'REQUIREMENT_PENDING', 'Requirements Pending', 'REQUIREMENTS PENDING', 'REQUIREMENTS_PENDING',
    'CONTRACT_SIGNED', 'Contract Signed & Onboarded', 'CONTRACT_SIGNED_AND_ONBOARDED', 'Officially Hired & Signed',
    'Officially Hired', 'OFFICIALLY HIRED', 'OFFICIALLY_HIRED',
    'Completed Requirements', 'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS',
    'Partially Compliant', 'PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT',
    'Hired - Pre-Employment', 'HIRED - PRE-EMPLOYMENT', 'HIRED_PRE_EMPLOYMENT',
    'INTERVIEW_FAILED', 'rejected', 'UNDO', 'REVERT',
    'Offer Rejected', 'OFFER_REJECTED', 'OFFER REJECTED'
];

if (empty($application_ids) || !in_array($result, $validResults)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid parameters or evaluation action."]);
    exit();
}

// Pre-flight batch capacity check for President Approved / Job Offer
$isBatchApprovalAction = in_array($result, [
    'Approved for Job Offer', 'APPROVED FOR JOB OFFER', 'APPROVED_FOR_JOB_OFFER',
    'President Approved', 'PRESIDENT APPROVED', 'Approved'
]);

if ($isBatchApprovalAction && count($application_ids) > 1 && !$increase_slot) {
    $placeholders = implode(',', array_fill(0, count($application_ids), '?'));
    $preStmt = $pdo->prepare("
        SELECT 
            a.application_id, 
            a.job_id, 
            COALESCE(NULLIF(TRIM(a.candidate_name), ''), CONCAT(u.User_Fname, ' ', u.User_Lname), 'Candidate') AS candidate_name, 
            j.title AS job_title, 
            COALESCE(j.availability, 0) AS total_slots
        FROM applications_tbl a
        LEFT JOIN jobs_tbl j ON j.job_id = a.job_id
        LEFT JOIN users_tbl u ON u.user_id = a.user_id
        WHERE a.application_id IN ($placeholders)
    ");
    $preStmt->execute($application_ids);
    $batchCandidates = $preStmt->fetchAll(PDO::FETCH_ASSOC);

    // Group by job_id
    $jobGroups = [];
    foreach ($batchCandidates as $bc) {
        $jId = intval($bc['job_id'] ?? 0);
        if ($jId <= 0) continue;
        if (!isset($jobGroups[$jId])) {
            $jobGroups[$jId] = [
                'job_id' => $jId,
                'job_title' => $bc['job_title'] ?: 'Position',
                'total_slots' => intval($bc['total_slots'] ?? 0),
                'candidates' => []
            ];
        }
        $jobGroups[$jId]['candidates'][] = $bc;
    }

    $conflicts = [];
    foreach ($jobGroups as $jId => $grp) {
        // Count currently occupied / reserved slots for this job excluding applications in current batch
        $occStmt = $pdo->prepare("
            SELECT COUNT(*) FROM applications_tbl 
            WHERE job_id = ? 
            AND application_id NOT IN ($placeholders)
            AND UPPER(status) IN (
                'PRESIDENT APPROVED', 'APPROVED FOR JOB OFFER', 'JOB OFFER CREATED',
                'JOB OFFER SENT', 'OFFER_EXTENDED', 'OFFER EXTENDED',
                'JOB_OFFER_ACCEPTED', 'OFFER_ACCEPTED', 'REQUIREMENT PENDING',
                'REQUIREMENTS PENDING', 'CONTRACT SIGNED & ONBOARDED',
                'OFFICIALLY HIRED', 'HIRED', 'PASSED FINAL APPROVAL'
            )
            AND is_archived = 0
        ");
        $occStmt->execute(array_merge([$jId], $application_ids));
        $occupied = (int)$occStmt->fetchColumn();
        $availableSlots = max(0, $grp['total_slots'] - $occupied);

        // Count waitlisted candidates for this job who are NOT part of this batch action
        $waitlistOccStmt = $pdo->prepare("
            SELECT COUNT(*) FROM applications_tbl 
            WHERE job_id = ? 
            AND application_id NOT IN ($placeholders)
            AND UPPER(status) IN (
                'PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT',
                'WAITING_FOR_SLOT', 'WAITLIST', 'WAITLISTED'
            )
            AND is_archived = 0
        ");
        $waitlistOccStmt->execute(array_merge([$jId], $application_ids));
        $waitlistCount = (int)$waitlistOccStmt->fetchColumn();

        $unreservedSlots = max(0, $availableSlots - $waitlistCount);
        $selectedCount = count($grp['candidates']);

        if ($selectedCount > $unreservedSlots) {
            $conflicts[] = [
                'job_id' => $jId,
                'job_title' => $grp['job_title'],
                'available_slots' => $unreservedSlots,
                'total_slots' => $grp['total_slots'],
                'selected_count' => $selectedCount,
                'candidates' => array_column($grp['candidates'], 'candidate_name')
            ];
        }
    }

    if (!empty($conflicts)) {
        http_response_code(409);
        echo json_encode([
            "status" => "BATCH_SLOT_EXCEEDED",
            "message" => "Cannot batch approve candidates because the number of selected candidates exceeds available job openings for one or more positions.",
            "conflicts" => $conflicts
        ]);
        exit();
    }
}

try {
    $pdo->beginTransaction();

    $candStmt = $pdo->prepare("
        SELECT 
            a.application_id, 
            a.user_id, 
            a.job_id, 
            a.candidate_name, 
            a.candidate_email, 
            a.status, 
            a.remarks AS previous_remarks,
            j.title AS job_title,
            u.User_Fname,
            u.User_Lname,
            u.User_Email
        FROM applications_tbl a
        LEFT JOIN jobs_tbl j ON j.job_id = a.job_id
        LEFT JOIN users_tbl u ON u.user_id = a.user_id
        WHERE a.application_id = ?
    ");

    $processedCount = 0;
    $lastRespMsg = '';
    $emailsToDispatch = [];

    foreach ($application_ids as $application_id) {
        $candStmt->execute([$application_id]);
        $candData = $candStmt->fetch(PDO::FETCH_ASSOC);

        if (!$candData) {
            if (count($application_ids) === 1) {
                $pdo->rollBack();
                http_response_code(404);
                echo json_encode(["status" => "error", "message" => "Application record not found."]);
                exit();
            }
            continue;
        }

    $candName = trim($candData['candidate_name'] ?? '') ?: trim(($candData['User_Fname'] ?? '') . ' ' . ($candData['User_Lname'] ?? '')) ?: "Application #{$application_id}";
    $candEmail = trim($candData['candidate_email'] ?? '') ?: trim($candData['User_Email'] ?? '');
    $userId = intval($candData['user_id'] ?? 0);
    $prevStatus = $candData['status'] ?? '';
    $jobId = intval($candData['job_id'] ?? 0);
    $jobTitle = $candData['job_title'] ?? 'Position';

    // Compute deadline (+7 days from current date)
    $todayDay = date('l, F j, Y');
    $deadlineDate = date('l, F j, Y', strtotime('+7 days'));

    if ($result === 'UNDO' || $result === 'REVERT') {
        // Determine appropriate rollback status
        if (in_array(strtoupper($prevStatus), ['PASSED FINAL APPROVAL', 'FAILED FINAL APPROVAL', 'HIRED'])) {
            $newStatus = 'Passed Final Interview';
        } else {
            $newStatus = 'CONFIRMED';
        }

        $stmt = $pdo->prepare("UPDATE applications_tbl SET status = ?, updated_at = NOW() WHERE application_id = ?");
        $stmt->execute([$newStatus, $application_id]);

        // If previous decision was Officially Hired, reverse job slot decrement
        if (in_array(strtoupper($prevStatus), ['OFFICIALLY HIRED', 'OFFICIALLY_HIRED', 'OFFICIALLY HIRED & SIGNED', 'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED']) && $jobId > 0) {
            $incStmt = $pdo->prepare("UPDATE jobs_tbl SET availability = availability + 1, status = 'Active' WHERE job_id = ?");
            $incStmt->execute([$jobId]);
        }

        $details = "Reverted candidate \"{$candName}\" (applying for \"{$jobTitle}\") evaluation decision: \"{$prevStatus}\" → \"{$newStatus}\".";
        log_system_audit($pdo, $actor_id, $actor_name, 'Status Change', 'Evaluation Module', $details, 'Info');

        $respMsg = "Decision reverted successfully. Candidate moved back to {$newStatus}.";
    } elseif (in_array($result, ['Candidate Withdrew', 'CANDIDATE_WITHDREW', 'CANDIDATE WITHDREW', 'Candidate No Show', 'CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW', 'NO SHOW', 'NO_SHOW', 'Incomplete Requirements', 'INCOMPLETE_REQUIREMENTS', 'INCOMPLETE REQUIREMENTS', 'Failed Pre-Employment', 'FAILED_PRE_EMPLOYMENT', 'FAILED PRE-EMPLOYMENT'])) {
        if (in_array($result, ['Candidate Withdrew', 'CANDIDATE_WITHDREW', 'CANDIDATE WITHDREW'])) {
            $newStatus = 'Candidate Withdrew';
            $actionPhrase = 'withdrew from consideration';
        } elseif (in_array($result, ['Contract Signing No Show', 'CONTRACT SIGNING NO SHOW', 'CONTRACT_SIGNING_NO_SHOW', 'CONTRACT NO SHOW', 'CONTRACT_NO_SHOW'])) {
            $newStatus = 'Contract Signing No Show';
            $actionPhrase = 'did not show up for scheduled contract signing appointment';
        } elseif (in_array($result, ['Candidate No Show', 'CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW', 'NO SHOW', 'NO_SHOW'])) {
            $newStatus = 'Candidate No Show';
            $actionPhrase = 'did not show up for scheduled final interview';
        } elseif (in_array($result, ['Incomplete Requirements', 'INCOMPLETE_REQUIREMENTS', 'INCOMPLETE REQUIREMENTS'])) {
            $newStatus = 'Incomplete Requirements';
            $actionPhrase = 'missed the 1-week pre-employment submission deadline';
        } else {
            $newStatus = 'Failed Pre-Employment';
            $actionPhrase = 'did not pass pre-employment clearance (medical/drug screening)';
        }

        $stmt = $pdo->prepare("UPDATE applications_tbl SET status = ?, withdrawn_at = COALESCE(withdrawn_at, NOW()), updated_at = NOW() WHERE application_id = ?");
        $stmt->execute([$newStatus, $application_id]);

        // Auto-cleanup: remove candidate's booking from interview schedule calendar
        // (Historical interview record is safely preserved in interviews_tbl and audit logs)
        $delSlotStmt = $pdo->prepare("DELETE FROM interview_slots_tbl WHERE application_id = ?");
        $delSlotStmt->execute([$application_id]);

        // If previous decision was Officially Hired, restore job slot and reactivate vacancy
        if (in_array(strtoupper($prevStatus), ['OFFICIALLY HIRED', 'OFFICIALLY_HIRED', 'OFFICIALLY HIRED & SIGNED', 'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED']) && $jobId > 0) {
            $incStmt = $pdo->prepare("UPDATE jobs_tbl SET availability = availability + 1, status = 'Active' WHERE job_id = ?");
            $incStmt->execute([$jobId]);
        }

        if ($newStatus === 'Candidate No Show') {
            // Fetch scheduled interview details if present
            $intvQ = $pdo->prepare("SELECT scheduled_date, scheduled_time FROM interviews_tbl WHERE application_id = ? ORDER BY interview_id DESC LIMIT 1");
            $intvQ->execute([$application_id]);
            $iRow = $intvQ->fetch(PDO::FETCH_ASSOC);

            $dateStr = !empty($iRow['scheduled_date']) ? date('F j, Y', strtotime($iRow['scheduled_date'])) : '';
            $timeStr = !empty($iRow['scheduled_time']) ? date('g:i A', strtotime($iRow['scheduled_time'])) : '';
            $timeContext = ($dateStr && $timeStr) ? " on {$dateStr} at {$timeStr}" : ($dateStr ? " on {$dateStr}" : "");

            if ($userId > 0) {
                $notifTitle = "Final Interview: Marked as No Show";
                $notifMsg = "Our records indicate that you were unable to attend your scheduled Final Interview{$timeContext}, and your active application for the {$jobTitle} role has been closed. Thank you for your interest in Airship Express, and we welcome you to re-apply for future openings.";
                $notifStmt = $pdo->prepare("
                    INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'no_show', '/application-status', 0, NOW())
                ");
                $notifStmt->execute([$userId, $application_id, $notifTitle, $notifMsg]);
            }

            // Queue email notification for post-commit dispatch
            if (!empty($candEmail)) {
                $emailsToDispatch[] = [
                    'email'   => $candEmail,
                    'name'    => $candName,
                    'job'     => $jobTitle,
                    'type'    => 'FINAL_NO_SHOW',
                    'remarks' => $remarks,
                    'details' => [
                        'interview_date' => $dateStr,
                        'interview_time' => $timeStr
                    ]
                ];
            }
        }

        if ($newStatus === 'Contract Signing No Show') {
            if ($userId > 0) {
                $notifTitle = "Contract Signing: Marked as No Show";
                $notifMsg = "Our records indicate that you were unable to attend your scheduled Contract Signing appointment for the {$jobTitle} role. As a result, your application has been closed. Thank you for your interest in Airship Express, and we welcome you to re-apply for future openings.";
                $notifStmt = $pdo->prepare("
                    INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'no_show', '/application-status', 0, NOW())
                ");
                $notifStmt->execute([$userId, $application_id, $notifTitle, $notifMsg]);
            }
        }

        $details = "Candidate \"{$candName}\" (applying for \"{$jobTitle}\") {$actionPhrase}: Status set to \"{$newStatus}\" (Previous: \"{$prevStatus}\"). Position slot updated.";
        log_system_audit($pdo, $actor_id, $actor_name, 'Status Change', 'Evaluation Module', $details, 'Warning');

        $respMsg = "Candidate status updated to {$newStatus}. Position opening restored.";
    } else {
        // Map action to standard application status
        $statusToSave = '';
        $auditCategory = 'Status Change';
        $severity = 'Info';
        $respMsg = '';
        $sendHireNotifications = false;

        switch ($result) {
            case 'PASS_FINAL_INTERVIEW':
            case 'Passed Final Interview':
                $statusToSave = 'Passed Final Interview';
                $respMsg = "Final Interview Passed. {$candName} moved to President Review.";
                $details = "Candidate \"{$candName}\" (applying for \"{$jobTitle}\") passed final interview: \"{$prevStatus}\" → \"Passed Final Interview\". Forwarded to President for final decision.";
                
                // In-App Notification for candidate
                if ($userId > 0) {
                    $notifTitle = "Final Interview Passed 🎉";
                    $notifMsg = "Congratulations, {$candName}! You have successfully passed your final interview for {$jobTitle}. Your application has been forwarded to the President for final approval, and you will receive an official update as soon as a decision is reached.";
                    $notifStmt = $pdo->prepare("
                        INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                        VALUES (?, ?, ?, ?, 'interview_passed', '/application-status', 0, NOW())
                    ");
                    $notifStmt->execute([$userId, $application_id, $notifTitle, $notifMsg]);
                }
                break;

            case 'FAIL_FINAL_INTERVIEW':
            case 'Failed Final Interview':
            case 'INTERVIEW_FAILED':
            case 'rejected':
                $statusToSave = 'Failed Final Interview';
                $severity = 'Warning';
                $respMsg = "Final Interview Failed. {$candName}.";
                $details = "Candidate \"{$candName}\" (applying for \"{$jobTitle}\") failed final interview: \"{$prevStatus}\" → \"Failed Final Interview\".";
                break;

            case 'Candidate No Show':
            case 'CANDIDATE_NO_SHOW':
            case 'CANDIDATE NO SHOW':
            case 'NO_SHOW':
            case 'NO SHOW':
                $statusToSave = 'Candidate No Show';
                $severity = 'Warning';
                $respMsg = "Candidate No Show. {$candName}.";
                $details = "Candidate \"{$candName}\" (applying for \"{$jobTitle}\") was marked as no show for final interview: \"{$prevStatus}\" → \"Candidate No Show\".";
                break;

            case 'President Approved':
            case 'PRESIDENT APPROVED':
            case 'Approved for Job Offer':
            case 'APPROVED FOR JOB OFFER':
            case 'APPROVED_FOR_JOB_OFFER':
            case 'Approved':
                // Real-time slot capacity check before approving
                if ($jobId > 0) {
                    if ($increase_slot) {
                        // Internal slot reservation: approves candidate directly without reopening public vacancy
                        log_system_audit(
                            $pdo, 
                            $actor_id, 
                            $actor_name, 
                            'Internal Slot Authorized', 
                            'Job Vacancy', 
                            "Authorized internal slot reservation for candidate \"{$candName}\" (applying for \"{$jobTitle}\"). Candidate approved for Job Offer without reopening public vacancy.", 
                            'Success'
                        );
                    } else {
                        // Enforce capacity restriction
                        $chkCapStmt = $pdo->prepare("SELECT availability FROM jobs_tbl WHERE job_id = ?");
                        $chkCapStmt->execute([$jobId]);
                        $totalAvail = (int)$chkCapStmt->fetchColumn();

                        // Count currently occupied / reserved slots for this job
                        $chkOccStmt = $pdo->prepare("
                            SELECT COUNT(*) FROM applications_tbl 
                            WHERE job_id = ? 
                            AND application_id != ?
                            AND UPPER(status) IN (
                                'PRESIDENT APPROVED', 'APPROVED FOR JOB OFFER', 'APPROVED_FOR_JOB_OFFER', 'APPROVED',
                                'JOB OFFER PENDING', 'JOB_OFFER_PENDING', 'JOB OFFER CREATED', 'JOB_OFFER_CREATED', 'JOB OFFER SENT', 'JOB_OFFER_SENT',
                                'OFFER EXTENDED', 'OFFER_EXTENDED', 'JOB_OFFER_ACCEPTED', 'OFFER_ACCEPTED', 'CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED',
                                'CONTRACT SIGNED', 'CONTRACT_SIGNED', 'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED',
                                'REQUIREMENT PENDING', 'REQUIREMENTS PENDING', 'REQUIREMENT_PENDING', 'REQUIREMENTS_PENDING',
                                'REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED', 'PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT',
                                'HIRED - PRE-EMPLOYMENT', 'HIRED_PRE_EMPLOYMENT', 'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS',
                                'OFFICIALLY HIRED', 'HIRED', 'PASSED FINAL APPROVAL'
                            )
                            AND is_archived = 0
                        ");
                        $chkOccStmt->execute([$jobId, $application_id]);
                        $currOccupied = (int)$chkOccStmt->fetchColumn();
                        $rawAvailable = max(0, $totalAvail - $currOccupied);

                        // Check waitlisted candidates for this job
                        $chkWaitlistStmt = $pdo->prepare("
                            SELECT application_id, candidate_name, status, updated_at, applied_at 
                            FROM applications_tbl 
                            WHERE job_id = ? 
                            AND application_id != ?
                            AND UPPER(status) IN (
                                'PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT',
                                'WAITING_FOR_SLOT', 'WAITLIST', 'WAITLISTED'
                            )
                            AND is_archived = 0
                            ORDER BY COALESCE(updated_at, applied_at) ASC, application_id ASC
                        ");
                        $chkWaitlistStmt->execute([$jobId, $application_id]);
                        $waitlistedList = $chkWaitlistStmt->fetchAll(PDO::FETCH_ASSOC);
                        $waitlistCount = count($waitlistedList);

                        $isCurrentStandby = in_array(strtoupper($prevStatus), [
                            'PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT',
                            'WAITING_FOR_SLOT', 'WAITLIST', 'WAITLISTED'
                        ]);

                        $unreservedSlots = max(0, $rawAvailable - $waitlistCount);

                        // If capacity is full, OR if this candidate is not on standby and all open slots are reserved for waitlisted candidates
                        if ($totalAvail > 0 && ($currOccupied >= $totalAvail || (!$isCurrentStandby && $unreservedSlots <= 0))) {
                            if (!$isCurrentStandby && $unreservedSlots <= 0 && $rawAvailable > 0 && !empty($waitlistedList)) {
                                $topWaitlist = $waitlistedList[0];
                                $holderName = $topWaitlist['candidate_name'] ?: 'Priority Waitlisted Candidate';
                                $holderStatus = 'Priority Waitlist (#1)';
                                $msg = "The open slot for \"{$jobTitle}\" is currently reserved for a priority waitlisted candidate ({$holderName}). Please place this candidate on Priority Standby or authorize an additional slot.";
                            } else {
                                $holderStmt = $pdo->prepare("
                                    SELECT candidate_name, status FROM applications_tbl 
                                    WHERE job_id = ? 
                                    AND application_id != ?
                                    AND UPPER(status) IN (
                                        'PRESIDENT APPROVED', 'APPROVED FOR JOB OFFER', 'APPROVED_FOR_JOB_OFFER', 'APPROVED',
                                        'JOB OFFER PENDING', 'JOB_OFFER_PENDING', 'JOB OFFER CREATED', 'JOB_OFFER_CREATED', 'JOB OFFER SENT', 'JOB_OFFER_SENT',
                                        'OFFER EXTENDED', 'OFFER_EXTENDED', 'JOB_OFFER_ACCEPTED', 'OFFER_ACCEPTED', 'CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED',
                                        'CONTRACT SIGNED', 'CONTRACT_SIGNED', 'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED',
                                        'REQUIREMENT PENDING', 'REQUIREMENTS PENDING', 'REQUIREMENT_PENDING', 'REQUIREMENTS_PENDING',
                                        'REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED', 'PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT',
                                        'HIRED - PRE-EMPLOYMENT', 'HIRED_PRE_EMPLOYMENT', 'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS',
                                        'OFFICIALLY HIRED', 'HIRED', 'PASSED FINAL APPROVAL'
                                    )
                                    AND is_archived = 0
                                    ORDER BY updated_at DESC LIMIT 1
                                ");
                                $holderStmt->execute([$jobId, $application_id]);
                                $holder = $holderStmt->fetch(PDO::FETCH_ASSOC);
                                $holderName = $holder ? ($holder['candidate_name'] ?: 'another finalist') : 'another finalist';
                                $holderStatus = $holder ? $holder['status'] : 'Job Offer';
                                $msg = "All {$totalAvail} slot(s) for \"{$jobTitle}\" are currently reserved (held by {$holderName}). Please place this candidate on Priority Standby or authorize an additional slot.";
                            }

                            $pdo->rollBack();
                            http_response_code(409);
                            echo json_encode([
                                "status" => "capacity_reached",
                                "message" => $msg,
                                "total_slots" => $totalAvail,
                                "occupied_slots" => $currOccupied,
                                "active_holder_name" => $holderName,
                                "active_holder_status" => $holderStatus
                            ]);
                            exit();
                        }
                    }
                }

                $statusToSave = 'President Approved';
                $respMsg = "President Approved. {$candName} is now Ready for Offer.";
                $details = "Candidate \"{$candName}\" (applying for \"{$jobTitle}\") approved by President: \"{$prevStatus}\" → \"President Approved\" (Ready for Offer). Forwarded to Job Offer queue.";
                
                if ($userId > 0) {
                    $notifTitle = "Application Approved by President 🎉";
                    $notifMsg = "Great news, {$candName}! Your application for {$jobTitle} has been approved by the President. Our recruitment team is preparing your official Job Offer Letter.";
                    $notifStmt = $pdo->prepare("
                        INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                        VALUES (?, ?, ?, ?, 'president_approved', '/application-status', 0, NOW())
                    ");
                    $notifStmt->execute([$userId, $application_id, $notifTitle, $notifMsg]);
                }
                break;

            case 'PLACE_ON_STANDBY':
            case 'Passed Final — Waiting for Slot':
            case 'PASSED FINAL — WAITING FOR SLOT':
            case 'PASSED FINAL - WAITING FOR SLOT':
            case 'WAITING_FOR_SLOT':
            case 'WAITLIST':
                $statusToSave = 'Passed Final — Waiting for Slot';
                $respMsg = "Placed on Priority Standby. {$candName} is queued for next available opening.";
                $details = "Candidate \"{$candName}\" (applying for \"{$jobTitle}\") passed all interview stages and was placed on Priority Standby / Waitlist: \"{$prevStatus}\" → \"Passed Final — Waiting for Slot\".";
                
                // In-App Notification
                if ($userId > 0) {
                    $notifTitle = "Priority Standby Status 🌟";
                    $notifMsg = "Congratulations on successfully passing both your Initial and Final Interviews for {$jobTitle}! All current openings for this batch are currently reserved. You have been placed on our Priority Standby list. If an opening becomes available, you will immediately be prioritized for an official job offer.";
                    $notifStmt = $pdo->prepare("
                        INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                        VALUES (?, ?, ?, ?, 'waitlist_standby', '/application-status', 0, NOW())
                    ");
                    $notifStmt->execute([$userId, $application_id, $notifTitle, $notifMsg]);
                }

                // Queue Email Delivery for post-commit dispatch
                if (!empty($candEmail)) {
                    $emailsToDispatch[] = [
                        'email'   => $candEmail,
                        'name'    => $candName,
                        'job'     => $jobTitle,
                        'type'    => 'WAITLIST_STANDBY',
                        'remarks' => $remarks,
                        'details' => []
                    ];
                }
                break;

            case 'PASS_FINAL_APPROVAL':
            case 'Passed Final Approval':
            case 'HIRED':
                $statusToSave = 'Passed Final Approval';
                $respMsg = "Passed Final Approval. {$candName} moved to Job Offer.";
                $details = "Candidate \"{$candName}\" (applying for \"{$jobTitle}\") received President's Approval: \"{$prevStatus}\" → \"Passed Final Approval\". Pre-employment requirements issued.";
                $sendHireNotifications = true;
                // Note: Slot availability is deducted only when candidate is Officially Hired (Day 1 confirmed).
                break;

            case 'FAIL_FINAL_APPROVAL':
            case 'Failed Final Approval':
                $statusToSave = 'Failed Final Approval';
                $severity = 'Warning';
                $respMsg = "Failed Final Approval. {$candName}.";
                $details = "Candidate \"{$candName}\" (applying for \"{$jobTitle}\") was not approved at President's Final Approval: \"{$prevStatus}\" → \"Failed Final Approval\".";
                break;

            case 'VERIFY_REQUIREMENTS':
            case 'Requirements Verified':
            case 'REQUIREMENTS_VERIFIED':
            case 'VERIFY_ALL_REQUIREMENTS':
                $statusToSave = 'Requirements Verified';
                $respMsg = "Requirements Verified. {$candName} moved to Contract Signing.";
                $details = "Verified all 7 pre-employment physical documents for candidate \"{$candName}\" (applying for \"{$jobTitle}\"): Status set to \"Requirements Verified\".";
                
                if ($userId > 0) {
                    $notifTitle = "Requirements Verified";
                    $notifMsg = "Hi {$candName}, all documents verified! HR will schedule your contract signing next.";
                    $notifStmt = $pdo->prepare("
                        INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                        VALUES (?, ?, ?, ?, 'requirements_verified', '/application-status', 0, NOW())
                    ");
                    $notifStmt->execute([$userId, $application_id, $notifTitle, $notifMsg]);
                }
                break;

            case 'Requirement Pending':
            case 'REQUIREMENT PENDING':
            case 'REQUIREMENT_PENDING':
            case 'Requirements Pending':
            case 'REQUIREMENTS PENDING':
            case 'REQUIREMENTS_PENDING':
            case 'CONTRACT_SIGNED':
            case 'Contract Signed & Onboarded':
            case 'CONTRACT_SIGNED_AND_ONBOARDED':
            case 'Officially Hired & Signed':
            case 'Hired - Pre-Employment':
            case 'HIRED - PRE-EMPLOYMENT':
            case 'HIRED_PRE_EMPLOYMENT':
                $statusToSave = 'Requirement Pending';
                $respMsg = "Contract Signed. {$candName} moved to Pre-Employment Requirements.";
                $details = "Candidate \"{$candName}\" (applying for \"{$jobTitle}\") completed contract signing: Status set to \"Requirement Pending\". Forwarded to Pre-Employment Requirements.";
                
                // 1. In-App Notification
                if ($userId > 0) {
                    $notifTitle = "Employment Contract Signed 📝";
                    $notifMsg = "Congratulations, {$candName}! Your employment contract for {$jobTitle} has been executed. Next step: Please submit your 6 mandatory pre-employment requirements for verification.";
                    $notifStmt = $pdo->prepare("
                        INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                        VALUES (?, ?, ?, ?, 'contract_signed', '/application-status', 0, NOW())
                    ");
                    $notifStmt->execute([$userId, $application_id, $notifTitle, $notifMsg]);
                }

                // 2. Queue Email Delivery for post-commit dispatch
                if (!empty($candEmail)) {
                    $emailsToDispatch[] = [
                        'email'   => $candEmail,
                        'name'    => $candName,
                        'job'     => $jobTitle,
                        'type'    => 'CONTRACT_SIGNED',
                        'remarks' => '',
                        'details' => []
                    ];
                }
                break;

            case 'Officially Hired':
            case 'OFFICIALLY HIRED':
            case 'OFFICIALLY_HIRED':
            case 'Completed Requirements':
            case 'COMPLETED REQUIREMENTS':
            case 'COMPLETED_REQUIREMENTS':
                $statusToSave = 'Officially Hired';
                $respMsg = "Officially Hired. {$candName} moved to Officially Hired.";
                $details = "Verified all 6 pre-employment physical documents for candidate \"{$candName}\" (applying for \"{$jobTitle}\") and scheduled Day 1 start: Status set to \"Officially Hired\".";
                
                // Extract work start schedule fields
                $work_start_date = !empty($data['work_start_date']) ? trim($data['work_start_date']) : (!empty($data['start_date']) ? trim($data['start_date']) : null);
                $work_start_time = !empty($data['work_start_time']) ? trim($data['work_start_time']) : (!empty($data['start_time']) ? trim($data['start_time']) : null);
                $work_start_location = !empty($data['work_start_location']) ? trim($data['work_start_location']) : (!empty($data['location']) ? trim($data['location']) : '352 T. Pinpin Escolta St., Binondo, Manila, 1006');
                $work_start_reporting_to = !empty($data['work_start_reporting_to']) ? trim($data['work_start_reporting_to']) : (!empty($data['reporting_to']) ? trim($data['reporting_to']) : 'HR Department / Branch Head');
                $work_start_notes = !empty($data['work_start_notes']) ? trim($data['work_start_notes']) : (!empty($data['notes']) ? trim($data['notes']) : '');

                if ($work_start_date) {
                    $updStartStmt = $pdo->prepare("
                        UPDATE applications_tbl 
                        SET work_start_date = ?, work_start_time = ?, work_start_location = ?, work_start_reporting_to = ?, work_start_notes = ?, is_archived = 1
                        WHERE application_id = ?
                    ");
                    $updStartStmt->execute([$work_start_date, $work_start_time, $work_start_location, $work_start_reporting_to, $work_start_notes, $application_id]);
                } else {
                    $updArchStmt = $pdo->prepare("UPDATE applications_tbl SET is_archived = 1 WHERE application_id = ?");
                    $updArchStmt->execute([$application_id]);
                }

                // Slot deduction for the job opening upon official hire
                if ($jobId > 0) {
                    $decStmt = $pdo->prepare("UPDATE jobs_tbl SET availability = availability - 1 WHERE job_id = ? AND availability > 0");
                    $decStmt->execute([$jobId]);

                    $checkStmt = $pdo->prepare("SELECT availability FROM jobs_tbl WHERE job_id = ?");
                    $checkStmt->execute([$jobId]);
                    $jobData = $checkStmt->fetch(PDO::FETCH_ASSOC);

                    if ($jobData && (int)$jobData['availability'] <= 0) {
                        $closeStmt = $pdo->prepare("UPDATE jobs_tbl SET status = 'Closed', availability = 0 WHERE job_id = ?");
                        $closeStmt->execute([$jobId]);
                    }
                }

                $formattedDate = $work_start_date ? date('M j, Y', strtotime($work_start_date)) : 'To be confirmed';
                $formattedTime = $work_start_time ? (date('g:i A', strtotime($work_start_time)) ?: $work_start_time) : '08:00 AM';

                // In-App Notification
                if ($userId > 0) {
                    $notifTitle = "🎉 Cleared for Day 1: Welcome to Airship Express!";
                    $notifMsg = "Congratulations, {$candName}! Your pre-employment requirements are verified and your Day 1 start is scheduled for {$formattedDate} at {$formattedTime} ({$work_start_location}), Reporting to: {$work_start_reporting_to}. You are officially hired!";
                    $notifStmt = $pdo->prepare("
                        INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                        VALUES (?, ?, ?, ?, 'requirements_completed', '/application-status', 0, NOW())
                    ");
                    $notifStmt->execute([$userId, $application_id, $notifTitle, $notifMsg]);
                }

                // Queue Email Delivery for post-commit dispatch
                if (!empty($candEmail)) {
                    $emailsToDispatch[] = [
                        'email'   => $candEmail,
                        'name'    => $candName,
                        'job'     => $jobTitle,
                        'type'    => 'COMPLETED_REQUIREMENTS',
                        'remarks' => $remarks,
                        'details' => [
                            'work_start_date'        => $work_start_date,
                            'work_start_time'        => $work_start_time,
                            'work_start_location'    => $work_start_location,
                            'work_start_reporting_to' => $work_start_reporting_to,
                            'work_start_notes'       => $work_start_notes
                        ]
                    ];
                }
                break;

            case 'Partially Compliant':
            case 'PARTIALLY COMPLIANT':
            case 'PARTIALLY_COMPLIANT':
                $statusToSave = 'Partially Compliant';
                $respMsg = "Partially Compliant. {$candName}.";
                $details = "Accepted candidate \"{$candName}\" (applying for \"{$jobTitle}\") with partial pre-employment requirements: Status set to \"Partially Compliant\".";
                
                // In-App Notification
                if ($userId > 0) {
                    $notifTitle = "Onboarding Finalized 🎉";
                    $notifMsg = "Hi {$candName}, your onboarding requirements have been reviewed and accepted by HR.";
                    $notifStmt = $pdo->prepare("
                        INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                        VALUES (?, ?, ?, ?, 'partially_compliant', '/application-status', 0, NOW())
                    ");
                    $notifStmt->execute([$userId, $application_id, $notifTitle, $notifMsg]);
                }
                break;

            case 'Offer Rejected':
            case 'OFFER_REJECTED':
            case 'OFFER REJECTED':
                $statusToSave = 'Offer Declined';
                $isArchiveRecord = true;
                $respMsg = "Offer rejection confirmed. {$candName} moved to Application Audit Record.";
                $details = "SuperAdmin acknowledged and finalized declined offer for candidate \"{$candName}\" (applying for \"{$jobTitle}\"): Record archived to Application Audit Record.";
                break;

            default:
                $statusToSave = $result;
                $details = "Updated candidate \"{$candName}\" status: \"{$prevStatus}\" → \"{$statusToSave}\".";
                $respMsg = "{$statusToSave}. {$candName}.";
                break;
        }

        // Append structured signature for President's review
        $evalDate = date('M j, Y');
        $signature = "|||SIG|||" . $actor_name . "|||" . $evalDate;
        
        $formattedRemarks = "";
        if (!empty($remarks)) {
            $formattedRemarks = $remarks . $signature;
        } else {
            $formattedRemarks = $candData['previous_remarks'] ?? '';
        }

        if (!empty($isArchiveRecord)) {
            $stmt = $pdo->prepare("UPDATE applications_tbl SET status = ?, remarks = ?, is_archived = 1, updated_at = NOW() WHERE application_id = ?");
        } else {
            $stmt = $pdo->prepare("UPDATE applications_tbl SET status = ?, remarks = ?, updated_at = NOW() WHERE application_id = ?");
        }
        $stmt->execute([$statusToSave, $formattedRemarks, $application_id]);

        // Auto-cleanup: remove candidate's booking from interview schedule calendar once evaluated
        // (Historical interview record is safely preserved in interviews_tbl and audit logs)
        if (!in_array($statusToSave, ['CONFIRMED', 'INTERVIEW_SCHEDULED', 'PENDING SCHEDULED', 'RESCHEDULE REQUESTED'])) {
            $delSlotStmt = $pdo->prepare("DELETE FROM interview_slots_tbl WHERE application_id = ?");
            $delSlotStmt->execute([$application_id]);
        }

        if (!empty($remarks)) {
            $details .= " Remarks: \"{$remarks}\"";
        }
        log_system_audit($pdo, $actor_id, $actor_name, $auditCategory, 'Evaluation Module', $details, $severity);

        // ── In-App Notification & Email Delivery on Passing Final Approval (Hired) ──
        if ($sendHireNotifications) {
            // 1. In-App Notification
            if ($userId > 0) {
                $hireNotifTitle = "Job Offer Confirmed — Next Step: Contract Signing";
                $hireNotifMsg   = "Thank you for accepting the official job offer for the {$jobTitle} position! We are incredibly excited to welcome you to the Airship Express team! Our HR department is currently preparing your official employment contract. You will be notified here as soon as your contract signing schedule is ready.";
                $notifStmt = $pdo->prepare("
                    INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'hired', '/application-status', 0, NOW())
                ");
                $notifStmt->execute([$userId, $application_id, $hireNotifTitle, $hireNotifMsg]);
            }

            // 2. Queue Email Delivery for post-commit dispatch
            if (!empty($candEmail)) {
                $emailsToDispatch[] = [
                    'email'   => $candEmail,
                    'name'    => $candName,
                    'job'     => $jobTitle,
                    'type'    => 'PRESIDENT_APPROVED',
                    'remarks' => '',
                    'details' => []
                ];
            }
        }

        // ── Email for Final Interview Pass / Fail / President Rejected ────────
        $normStatusToSave = strtoupper(trim($statusToSave));
        if (in_array($normStatusToSave, ['PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW'])) {
            if (!empty($candEmail)) {
                $emailsToDispatch[] = [
                    'email'   => $candEmail,
                    'name'    => $candName,
                    'job'     => $jobTitle,
                    'type'    => 'FINAL_PASSED',
                    'remarks' => $remarks,
                    'details' => []
                ];
            }
        } elseif (in_array($normStatusToSave, ['FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW'])) {
            if (!empty($candEmail)) {
                $emailsToDispatch[] = [
                    'email'   => $candEmail,
                    'name'    => $candName,
                    'job'     => $jobTitle,
                    'type'    => 'FINAL_FAILED',
                    'remarks' => $remarks,
                    'details' => []
                ];
            }

            // In-app notification for failed interview
            if ($userId > 0) {
                $notifStmt = $pdo->prepare("
                    INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'status_update', '/application-status', 0, NOW())
                ");
                $notifStmt->execute([$userId, $application_id, 'Interview Result', "Your final interview result for {$jobTitle} has been posted. Please check your Application Status." ]);
            }
        } elseif (in_array($normStatusToSave, ['FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL'])) {
            if (!empty($candEmail)) {
                $emailsToDispatch[] = [
                    'email'   => $candEmail,
                    'name'    => $candName,
                    'job'     => $jobTitle,
                    'type'    => 'PRESIDENT_REJECTED',
                    'remarks' => $remarks,
                    'details' => []
                ];
            }

            if ($userId > 0) {
                $notifStmt = $pdo->prepare("
                    INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'status_update', '/application-status', 0, NOW())
                ");
                $notifStmt->execute([$userId, $application_id, 'Application Decision', "The final review result for your {$jobTitle} application has been posted." ]);
            }
        }
        }

        $processedCount++;
        $lastRespMsg = $respMsg;
    } // end foreach ($application_ids)

    if ($processedCount === 0) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "No eligible candidate records were updated."]);
        exit();
    }

    $pdo->commit();

    // ── Post-Commit Email Dispatch ──────────────────────────────────────────
    // Emails are sent AFTER the database transaction commits so that slow SMTP 
    // network calls never hold database row locks or cause transaction rollbacks.
    if (!empty($emailsToDispatch)) {
        foreach ($emailsToDispatch as $dispatch) {
            try {
                sendApplicationStatusEmail(
                    $dispatch['email'],
                    $dispatch['name'],
                    $dispatch['job'],
                    $dispatch['type'],
                    $dispatch['remarks'] ?? '',
                    $dispatch['details'] ?? []
                );
            } catch (\Throwable $mailErr) {
                error_log("[Update Result Email Error] To: {$dispatch['email']}, Type: {$dispatch['type']}: " . $mailErr->getMessage());
            }
        }
    }

    echo json_encode([
        "status" => "success",
        "message" => count($application_ids) > 1 
            ? "Successfully updated {$processedCount} candidate(s)." 
            : $lastRespMsg,
        "count" => $processedCount
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("[Update Result Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal system error occurred while updating the candidate result."]);
}
?>
