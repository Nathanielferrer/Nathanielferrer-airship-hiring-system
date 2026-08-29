<?php
// Include database connection (sets CORS headers)
require_once '../db.php';

header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$id     = isset($data['id']) ? intval($data['id']) : (isset($data['application_id']) ? intval($data['application_id']) : 0);
$status = isset($data['status']) ? strtoupper(trim($data['status'])) : '';

$allowedStatuses = [
    'PENDING', 'REVIEW_REQUIRED', 'REJECTED', 'SCREENING_REJECTED', 'PASSED INITIAL',
    'DECLINED - UNRESPONSIVE', 'PENDING SCHEDULED', 'CONFIRMED',
    'RESCHEDULING', 'HIRED', 'PASSED', 'HIRED / PASSED',
    'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'PASSED INTERVIEW', 'FAILED', 'ARCHIVED',
    'PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW',
    'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW',
    'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL',
    'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL',
    'Candidate Withdrew', 'CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW',
    'Incomplete Requirements', 'INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS',
    'Failed Pre-Employment', 'FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT',
    'Requirements Verified', 'REQUIREMENTS_VERIFIED', 'REQUIREMENTS VERIFIED',
    'Contract Signing Scheduled', 'CONTRACT_SIGNING_SCHEDULED', 'CONTRACT SIGNING SCHEDULED',
    'Contract Signed & Onboarded', 'CONTRACT_SIGNED_AND_ONBOARDED', 'CONTRACT SIGNED & ONBOARDED'
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

    // Fetch previous application info + job title for audit details
    $candStmt = $pdo->prepare("
        SELECT a.candidate_name, a.candidate_email, a.job_id, a.status, j.title AS job_title
        FROM applications_tbl a
        LEFT JOIN jobs_tbl j ON j.job_id = a.job_id
        WHERE a.application_id = :id
    ");
    $candStmt->execute(['id' => $id]);
    $candInfo = $candStmt->fetch(PDO::FETCH_ASSOC);

    // Perform the application status update
    if (strtoupper($status) === 'ARCHIVED') {
        $stmt = $pdo->prepare("UPDATE applications_tbl SET is_archived = 1 WHERE application_id = :id");
    } else {
        $stmt = $pdo->prepare("UPDATE applications_tbl SET status = :status WHERE application_id = :id");
    }
    $stmt->execute([
        'status' => $status,
        'id'     => $id
    ]);

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
                    AND UPPER(status) IN ('HIRED', 'PASSED FINAL APPROVAL', 'FAILED FINAL APPROVAL', 'FAILED FINAL INTERVIEW', 'REJECTED', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'DECLINED - UNRESPONSIVE', 'CANDIDATE WITHDREW')
                ");
                $autoArchStmt->execute(['jid' => $jobId]);
            }
        }
    } elseif (in_array($upperStatus, ['CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS', 'FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT']) && in_array($prevUpper, ['HIRED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'PASSED'])) {
        if ($jobId > 0) {
            $incStmt = $pdo->prepare("UPDATE jobs_tbl SET availability = availability + 1 WHERE job_id = :jid");
            $incStmt->execute(['jid' => $jobId]);

            $checkJobStmt = $pdo->prepare("SELECT availability, status FROM jobs_tbl WHERE job_id = :jid");
            $checkJobStmt->execute(['jid' => $jobId]);
            $jobData = $checkJobStmt->fetch(PDO::FETCH_ASSOC);

            if ($jobData && (int)$jobData['availability'] > 0 && $jobData['status'] === 'Closed') {
                $reactivateStmt = $pdo->prepare("UPDATE jobs_tbl SET status = 'Active' WHERE job_id = :jid");
                $reactivateStmt->execute(['jid' => $jobId]);
            }
        }
    }

    $pdo->commit();

    require_once '../audit_helper.php';
    $actorId   = intval($data['actor_id']   ?? 0);
    $actorName = trim($data['actor_name']   ?? 'Admin');
    $candName  = $candInfo['candidate_name'] ?? "Application #{$id}";
    $oldStatus = $candInfo['status']         ?? 'unknown';
    $jobTitle  = $candInfo['job_title']      ?? 'Unknown Position';

    $category = ($upperStatus === 'ARCHIVED') ? 'Candidate Archiving' : 'Status Change';
    $severity  = ($upperStatus === 'ARCHIVED') ? 'Warning' : 'Info';
    $details   = "Status changed for candidate \"{$candName}\" (applying for \"{$jobTitle}\"): \"{$oldStatus}\" → \"{$status}\".";

    log_system_audit($pdo, $actorId, $actorName, $category, 'Screening Module', $details, $severity);

    echo json_encode([
        "status" => "success",
        "message" => "Candidate status successfully updated to " . ucfirst(str_replace('_', ' ', $status)) . "."
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Failed to update status: " . $e->getMessage()
    ]);
}
?>
