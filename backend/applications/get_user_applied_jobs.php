<?php
require_once '../db.php';
require_once '../config.php';

header('Content-Type: application/json');

$userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid user ID."]);
    exit();
}

try {
    $stmt = $pdo->prepare("
        SELECT a.application_id AS id, a.application_id, a.job_id, a.status, 
               COALESCE(a.withdrawn_at, a.updated_at, a.applied_at) AS withdrawal_date,
               j.title AS job_title 
        FROM applications_tbl a
        INNER JOIN jobs_tbl j ON a.job_id = j.job_id
        WHERE a.user_id = :user_id
        ORDER BY a.application_id ASC
    ");
    $stmt->execute(['user_id' => $userId]);
    $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $jobIds = [];
    $appliedJobsMap = [];
    $appliedDetailsMap = [];
    $cooldownJobsMap = [];
    $hasActiveApplication = false;
    $isHired = false;
    $hiredJobTitle = '';

    $hiredStatuses = [
        'OFFICIALLY HIRED', 'OFFICIALLY_HIRED', 'OFFICIALLY HIRED & SIGNED',
        'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED',
        'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED'
    ];

    $activeStatuses = [
        'PENDING', 'REVIEW_REQUIRED', 'PASSED INITIAL', 
        'PENDING SCHEDULED', 'CONFIRMED', 'INTERVIEW_SCHEDULED', 'RESCHEDULING',
        'PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW',
        'APPROVED FOR JOB OFFER', 'APPROVED_FOR_JOB_OFFER', 'PRESIDENT APPROVED', 'PRESIDENT_APPROVED',
        'JOB OFFER PENDING', 'OFFER EXTENDED', 'JOB_OFFER_PENDING', 'OFFER_EXTENDED',
        'JOB OFFER ACCEPTED', 'JOB_OFFER_ACCEPTED', 'OFFER ACCEPTED', 'OFFER_ACCEPTED',
        'CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED',
        'REQUIREMENT PENDING', 'REQUIREMENTS PENDING', 'REQUIREMENT_PENDING', 'REQUIREMENTS_PENDING',
        'REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED',
        'PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT'
    ];

    $withdrawnStatuses = [
        'CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'APPLICATION WITHDRAWN', 'APPLICATION_WITHDRAWN', 'WITHDRAWN'
    ];

    foreach ($applications as $app) {
        $jid = intval($app['job_id']);
        $st = trim($app['status'] ?? '');
        $upperSt = strtoupper($st);
        $appliedJobsMap[$jid] = $st;
        $appliedDetailsMap[$jid] = [
            'application_id' => intval($app['application_id']),
            'id' => intval($app['application_id']),
            'status' => $st,
            'job_title' => $app['job_title']
        ];

        if (!in_array($upperSt, ['REJECTED', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED', 'DECLINED - UNRESPONSIVE', 'SCHEDULING EXPIRED', 'SCHEDULING_EXPIRED', 'CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'OFFER DECLINED', 'OFFER_DECLINED', 'JOB OFFER DECLINED', 'JOB_OFFER_DECLINED', 'OFFER EXPIRED', 'OFFER_EXPIRED', 'INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS', 'FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT', 'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL', 'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW', 'NO SHOW', 'NO_SHOW', 'CANDIDATE NO-SHOW'])) {
            $jobIds[] = $jid;
        }

        if (in_array($upperSt, $hiredStatuses)) {
            $isHired = true;
            $hiredJobTitle = $app['job_title'];
            $hasActiveApplication = true;
        } elseif (in_array($upperSt, $activeStatuses)) {
            $hasActiveApplication = true;
        }

        // Check if this position is currently under 6-month cooldown (withdrawn, evaluated/rejected, offer declined, or no-show)
        $failedStatuses = [
            'REJECTED', 'SCREENING_REJECTED', 
            'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'FAILED',
            'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL'
        ];

        $declinedStatuses = [
            'OFFER DECLINED', 'OFFER_DECLINED', 'JOB OFFER DECLINED', 'JOB_OFFER_DECLINED'
        ];

        $noShowStatuses = [
            'CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW', 'NO SHOW', 'NO_SHOW', 'CANDIDATE NO-SHOW'
        ];

        $isWithdrawn = in_array($upperSt, $withdrawnStatuses);
        $isFailed = in_array($upperSt, $failedStatuses);
        $isDeclined = in_array($upperSt, $declinedStatuses);
        $isNoShow = in_array($upperSt, $noShowStatuses);

        if (($isWithdrawn || $isFailed || $isDeclined || $isNoShow) && !empty($app['withdrawal_date'])) {
            $wTs = strtotime($app['withdrawal_date']);
            $eTs = strtotime('+6 months', $wTs);
            $now = time();
            if ($now < $eTs) {
                $cooldownType = 'withdrawn';
                if ($isFailed) $cooldownType = 'rejected';
                if ($isDeclined) $cooldownType = 'declined';
                if ($isNoShow) $cooldownType = 'no_show';

                $cooldownJobsMap[$jid] = [
                    'in_cooldown'    => true,
                    'type'           => $cooldownType,
                    'event_date'     => date('F d, Y', $wTs),
                    'withdrawn_date' => date('F d, Y', $wTs),
                    'eligible_date'  => date('F d, Y', $eTs),
                    'days_remaining' => max(1, ceil(($eTs - $now) / 86400))
                ];
            } else {
                unset($cooldownJobsMap[$jid]);
            }
        } else {
            // If the user has a newer active application for this job, clear cooldown map
            unset($cooldownJobsMap[$jid]);
        }
    }

    // Fetch fresh user profile from users_tbl to keep client state synced
    $uStmt = $pdo->prepare("SELECT user_id, User_Fname, User_MInitial, User_Lname, User_Email, User_Mobile, is_admin, status FROM users_tbl WHERE user_id = :uid");
    $uStmt->execute(['uid' => $userId]);
    $freshUser = $uStmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        "status" => "success",
        "job_ids" => $jobIds,
        "applied_jobs_map" => $appliedJobsMap,
        "applied_details_map" => $appliedDetailsMap,
        "cooldown_jobs_map" => $cooldownJobsMap,
        "has_active_application" => $hasActiveApplication,
        "is_hired" => $isHired,
        "hired_job_title" => $hiredJobTitle,
        "user" => $freshUser ?: null
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database query failed: " . $e->getMessage()
    ]);
}
?>
