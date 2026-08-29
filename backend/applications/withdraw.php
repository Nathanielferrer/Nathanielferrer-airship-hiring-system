<?php
require_once '../db.php';
require_once '../config.php';
require_once '../audit_helper.php';

header('Content-Type: application/json');
ini_set('display_errors', 0);

$json = file_get_contents('php://input');
$data = json_decode($json, true) ?: [];

$userId = isset($data['user_id']) ? intval($data['user_id']) : 0;
$appId = isset($data['application_id']) ? intval($data['application_id']) : (isset($data['id']) ? intval($data['id']) : 0);
$jobId = isset($data['job_id']) ? intval($data['job_id']) : 0;
$reason = isset($data['reason']) ? trim($data['reason']) : 'Candidate requested application withdrawal';

if ($userId <= 0 && $appId <= 0) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid user or application ID."]);
    exit();
}

try {
    $pdo->beginTransaction();

    // Look up application record
    if ($appId > 0) {
        $stmt = $pdo->prepare("
            SELECT a.application_id, a.user_id, a.job_id, a.status, a.candidate_name, j.title as job_title, j.availability, j.status as job_status
            FROM applications_tbl a
            LEFT JOIN jobs_tbl j ON a.job_id = j.job_id
            WHERE a.application_id = :app_id " . ($userId > 0 ? "AND a.user_id = :user_id" : "") . "
            LIMIT 1
        ");
        $params = ['app_id' => $appId];
        if ($userId > 0) $params['user_id'] = $userId;
        $stmt->execute($params);
    } else {
        $stmt = $pdo->prepare("
            SELECT a.application_id, a.user_id, a.job_id, a.status, a.candidate_name, j.title as job_title, j.availability, j.status as job_status
            FROM applications_tbl a
            LEFT JOIN jobs_tbl j ON a.job_id = j.job_id
            WHERE a.user_id = :user_id AND a.job_id = :job_id
            ORDER BY a.application_id DESC LIMIT 1
        ");
        $stmt->execute(['user_id' => $userId, 'job_id' => $jobId]);
    }

    $app = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$app) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Application record not found."]);
        exit();
    }

    $realAppId = intval($app['application_id']);
    $realJobId = intval($app['job_id']);
    $prevStatus = strtoupper($app['status'] ?? '');
    $candName = $app['candidate_name'] ?: "Applicant #{$userId}";
    $jobTitle = $app['job_title'] ?: "Position";

    // 1. Update application status to 'Candidate Withdrew'
    $upd = $pdo->prepare("UPDATE applications_tbl SET status = 'Candidate Withdrew', updated_at = NOW() WHERE application_id = :id");
    $upd->execute(['id' => $realAppId]);

    // 2. If previously hired / passed final approval, restore 1 opening slot for the job
    if (in_array($prevStatus, ['HIRED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'PASSED', 'REQUIREMENTS VERIFIED', 'CONTRACT SIGNING SCHEDULED'])) {
        if ($realJobId > 0) {
            $incStmt = $pdo->prepare("UPDATE jobs_tbl SET availability = availability + 1 WHERE job_id = :jid");
            $incStmt->execute(['jid' => $realJobId]);

            $checkJob = $pdo->prepare("SELECT availability, status FROM jobs_tbl WHERE job_id = :jid");
            $checkJob->execute(['jid' => $realJobId]);
            $jobData = $checkJob->fetch(PDO::FETCH_ASSOC);

            if ($jobData && intval($jobData['availability']) > 0 && $jobData['status'] === 'Closed') {
                $reopenStmt = $pdo->prepare("UPDATE jobs_tbl SET status = 'Active' WHERE job_id = :jid");
                $reopenStmt->execute(['jid' => $realJobId]);
            }
        }
    }

    // 3. Clear any booked interview slots for this candidate
    $freeSlot = $pdo->prepare("UPDATE interview_slots_tbl SET status = 'Open', application_id = NULL WHERE application_id = :aid");
    $freeSlot->execute(['aid' => $realAppId]);

    $pdo->commit();

    // 4. Audit trail logging
    $auditMsg = "Candidate \"{$candName}\" voluntarily withdrew application for position \"{$jobTitle}\" (App ID: #{$realAppId}). Reason: {$reason}";
    log_system_audit($pdo, $userId, $candName, 'Candidate Withdrawal', 'Applicant Portal', $auditMsg, 'Warning');

    echo json_encode([
        "status" => "success",
        "message" => "Your application for {$jobTitle} has been cancelled/withdrawn.",
        "application_id" => $realAppId,
        "id" => $realAppId
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to withdraw application: " . $e->getMessage()]);
}
?>
