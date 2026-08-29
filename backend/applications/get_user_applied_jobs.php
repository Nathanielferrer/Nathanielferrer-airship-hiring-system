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
        SELECT a.application_id AS id, a.application_id, a.job_id, a.status, j.title AS job_title 
        FROM applications_tbl a
        INNER JOIN jobs_tbl j ON a.job_id = j.job_id
        WHERE a.user_id = :user_id
    ");
    $stmt->execute(['user_id' => $userId]);
    $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $jobIds = [];
    $appliedJobsMap = [];
    $appliedDetailsMap = [];
    $hasActiveApplication = false;
    $isHired = false;
    $hiredJobTitle = '';

    $hiredStatuses = [
        'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED', 
        'OFFICIALLY HIRED & SIGNED', 'OFFICIALLY HIRED', 'HIRED', 'PASSED',
        'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL',
        'REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED',
        'CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED'
    ];

    $activeStatuses = [
        'PENDING', 'REVIEW_REQUIRED', 'SHORTLISTED', 'PASSED INITIAL', 
        'PENDING SCHEDULED', 'CONFIRMED', 'INTERVIEW_SCHEDULED', 'RESCHEDULING',
        'PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW'
    ];

    foreach ($applications as $app) {
        $jid = intval($app['job_id']);
        $st = $app['status'];
        $upperSt = strtoupper($st);
        $appliedJobsMap[$jid] = $st;
        $appliedDetailsMap[$jid] = [
            'application_id' => intval($app['application_id']),
            'id' => intval($app['application_id']),
            'status' => $st,
            'job_title' => $app['job_title']
        ];

        if (!in_array($upperSt, ['REJECTED', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED', 'DECLINED - UNRESPONSIVE', 'CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS', 'FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT', 'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL', 'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW'])) {
            $jobIds[] = $jid;
        }

        if (in_array($upperSt, $hiredStatuses)) {
            $isHired = true;
            $hiredJobTitle = $app['job_title'];
            $hasActiveApplication = true;
        } elseif (in_array($upperSt, $activeStatuses)) {
            $hasActiveApplication = true;
        }
    }

    echo json_encode([
        "status" => "success",
        "job_ids" => $jobIds,
        "applied_jobs_map" => $appliedJobsMap,
        "applied_details_map" => $appliedDetailsMap,
        "has_active_application" => $hasActiveApplication,
        "is_hired" => $isHired,
        "hired_job_title" => $hiredJobTitle
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database query failed: " . $e->getMessage()
    ]);
}
?>
