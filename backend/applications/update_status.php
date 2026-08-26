<?php
// Include database connection (sets CORS headers)
require_once '../db.php';

header('Content-Type: application/json');

// Read JSON input
$json = file_get_contents('php://input');
$data = json_decode($json, true);

$id     = isset($data['id']) ? intval($data['id']) : 0;
$status = isset($data['status']) ? strtoupper(trim($data['status'])) : '';

// 1. Validate inputs
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
    'Failed Pre-Employment', 'FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT'
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
        FROM applications a
        LEFT JOIN jobs j ON j.id = a.job_id
        WHERE a.id = :id
    ");
    $candStmt->execute(['id' => $id]);
    $candInfo = $candStmt->fetch(PDO::FETCH_ASSOC);

    // 2. Perform the application status update
    if (strtoupper($status) === 'ARCHIVED') {
        $stmt = $pdo->prepare("UPDATE applications SET is_archived = 1 WHERE id = :id");
    } else {
        $stmt = $pdo->prepare("UPDATE applications SET status = :status WHERE id = :id");
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

    // 3. If hired/passed, deduct 1 available slot from the associated job
    $upperStatus = strtoupper($status);
    $prevUpper = strtoupper($candInfo['status'] ?? '');
    $jobId = intval($candInfo['job_id'] ?? 0);

    if ($upperStatus === 'HIRED' || $upperStatus === 'HIRED / PASSED' || $upperStatus === 'PASSED' || $upperStatus === 'PASSED FINAL APPROVAL' || $upperStatus === 'PASSED_FINAL_APPROVAL') {
        if ($jobId > 0) {
            // Decrement open slot count by 1
            $decStmt = $pdo->prepare("UPDATE jobs SET availability = availability - 1 WHERE id = :jid AND availability > 0");
            $decStmt->execute(['jid' => $jobId]);

            // Check remaining availability
            $checkJobStmt = $pdo->prepare("SELECT availability FROM jobs WHERE id = :jid");
            $checkJobStmt->execute(['jid' => $jobId]);
            $jobData = $checkJobStmt->fetch(PDO::FETCH_ASSOC);

            if ($jobData && intval($jobData['availability']) <= 0) {
                // Out of slots -> Auto-close job
                $closeStmt = $pdo->prepare("UPDATE jobs SET status = 'Closed', availability = 0 WHERE id = :jid");
                $closeStmt->execute(['jid' => $jobId]);

                // Auto-archive rejected and terminal applicants for this closed job
                $autoArchStmt = $pdo->prepare("
                    UPDATE applications 
                    SET is_archived = 1 
                    WHERE job_id = :jid 
                    AND UPPER(status) IN ('HIRED', 'PASSED FINAL APPROVAL', 'FAILED FINAL APPROVAL', 'FAILED FINAL INTERVIEW', 'REJECTED', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'DECLINED - UNRESPONSIVE', 'CANDIDATE WITHDREW')
                ");
                $autoArchStmt->execute(['jid' => $jobId]);
            }
        }
    } elseif (in_array($upperStatus, ['CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS', 'FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT']) && in_array($prevUpper, ['HIRED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'PASSED'])) {
        // Candidate failed/withdrew after being hired -> restore position availability slot
        if ($jobId > 0) {
            $incStmt = $pdo->prepare("UPDATE jobs SET availability = availability + 1 WHERE id = :jid");
            $incStmt->execute(['jid' => $jobId]);

            // Re-activate job if it was closed
            $checkJobStmt = $pdo->prepare("SELECT availability, status FROM jobs WHERE id = :jid");
            $checkJobStmt->execute(['jid' => $jobId]);
            $jobData = $checkJobStmt->fetch(PDO::FETCH_ASSOC);

            if ($jobData && (int)$jobData['availability'] > 0 && $jobData['status'] === 'Closed') {
                $reactivateStmt = $pdo->prepare("UPDATE jobs SET status = 'Active' WHERE id = :jid");
                $reactivateStmt->execute(['jid' => $jobId]);
            }
        }
    }

    $pdo->commit();

    // System audit log
    require_once '../audit_helper.php';
    $actorId   = intval($data['actor_id']   ?? 0); // Default to 0 to prevent Super Admin filtering collision
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
