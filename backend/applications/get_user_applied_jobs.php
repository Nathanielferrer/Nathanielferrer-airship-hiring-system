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
    $stmt = $pdo->prepare("SELECT job_id, status FROM applications WHERE user_id = :user_id");
    $stmt->execute(['user_id' => $userId]);
    $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $jobIds = [];
    $appliedJobsMap = [];
    $hasActiveApplication = false;
    $activeStatuses = ['pending', 'review_required', 'shortlisted', 'INTERVIEW_SCHEDULED', 'PASSED INITIAL', 'PENDING SCHEDULED', 'CONFIRMED', 'RESCHEDULING'];

    foreach ($applications as $app) {
        $jid = intval($app['job_id']);
        $st = $app['status'];
        $appliedJobsMap[$jid] = $st;

        if (!in_array($st, ['rejected', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED', 'DECLINED - UNRESPONSIVE'])) {
            $jobIds[] = $jid;
        }
        if (in_array($st, $activeStatuses)) {
            $hasActiveApplication = true;
        }
    }

    echo json_encode([
        "status" => "success",
        "job_ids" => $jobIds,
        "applied_jobs_map" => $appliedJobsMap,
        "has_active_application" => $hasActiveApplication
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database query failed: " . $e->getMessage()
    ]);
}
