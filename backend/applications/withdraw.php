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
            SELECT a.application_id, a.user_id, a.job_id, a.status, a.candidate_name, a.remarks, j.title as job_title, j.availability, j.status as job_status
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
            SELECT a.application_id, a.user_id, a.job_id, a.status, a.candidate_name, a.remarks, j.title as job_title, j.availability, j.status as job_status
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

    // Disallow withdrawal once application has progressed to Job Offer, Contract Signing, Onboarding, or Hired
    $nonWithdrawableStatuses = [
        'APPROVED FOR JOB OFFER', 'APPROVED_FOR_JOB_OFFER', 'PRESIDENT APPROVED', 'PRESIDENT_APPROVED',
        'JOB OFFER PENDING', 'JOB_OFFER_PENDING', 'OFFER EXTENDED', 'JOB OFFER EXTENDED',
        'JOB OFFER ACCEPTED', 'JOB_OFFER_ACCEPTED', 'OFFER ACCEPTED', 'OFFER_ACCEPTED',
        'CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED',
        'CONTRACT SIGNED', 'CONTRACT_SIGNED', 'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED',
        'REQUIREMENT PENDING', 'REQUIREMENTS PENDING', 'REQUIREMENT_PENDING', 'REQUIREMENTS_PENDING',
        'REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED',
        'PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT',
        'OFFICIALLY HIRED', 'OFFICIALLY_HIRED', 'OFFICIALLY HIRED & SIGNED',
        'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED',
        'HIRED - PRE-EMPLOYMENT', 'HIRED_PRE_EMPLOYMENT', 'HIRED', 'PASSED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL'
    ];

    if (in_array($prevStatus, $nonWithdrawableStatuses)) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Application withdrawal is no longer available at this stage."]);
        exit();
    }

    // Determine which stage the candidate withdrew from
    $withdrawnStage = 2; // Default: 2. Screening
    if (in_array($prevStatus, ['PASSED INITIAL', 'PENDING SCHEDULED', 'CONFIRMED', 'INTERVIEW_SCHEDULED', 'RESCHEDULING'])) {
        $withdrawnStage = 3; // 3. Final Interview
    } elseif (in_array($prevStatus, ['PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW'])) {
        $withdrawnStage = 4; // 4. President Review
    } elseif (in_array($prevStatus, ['APPROVED FOR JOB OFFER', 'PRESIDENT APPROVED', 'JOB OFFER PENDING', 'OFFER EXTENDED', 'JOB_OFFER_PENDING'])) {
        $withdrawnStage = 5; // 5. Job Offer
    } elseif (in_array($prevStatus, ['JOB OFFER ACCEPTED', 'JOB_OFFER_ACCEPTED', 'OFFER ACCEPTED', 'CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED'])) {
        $withdrawnStage = 6; // 6. Contract Signed
    } elseif (in_array($prevStatus, ['CONTRACT SIGNED', 'CONTRACT_SIGNED', 'REQUIREMENT PENDING', 'REQUIREMENTS PENDING', 'HIRED', 'OFFICIALLY HIRED', 'OFFICIALLY_HIRED'])) {
        $withdrawnStage = 7; // 7. Officially Hired
    }

    $existingRemarks = trim($app['remarks'] ?? '');
    $stageTag = "[WITHDRAWN_STAGE:{$withdrawnStage}]";
    $updatedRemarks = strpos($existingRemarks, '[WITHDRAWN_STAGE:') !== false 
        ? preg_replace('/\[WITHDRAWN_STAGE:\d+\]/', $stageTag, $existingRemarks)
        : ($existingRemarks ? "{$existingRemarks} {$stageTag}" : $stageTag);

    // 1. Update application status to 'Candidate Withdrew' and record the stage
    $upd = $pdo->prepare("UPDATE applications_tbl SET status = 'Candidate Withdrew', remarks = :remarks, withdrawn_at = NOW(), updated_at = NOW() WHERE application_id = :id");
    $upd->execute(['remarks' => $updatedRemarks, 'id' => $realAppId]);

    // 2. If candidate held a reserved slot, release it according to waitlist rules
    $slotHoldingStatuses = [
        'APPROVED FOR JOB OFFER', 'APPROVED_FOR_JOB_OFFER', 'PRESIDENT APPROVED', 'PRESIDENT_APPROVED',
        'READY FOR OFFER', 'READY_FOR_OFFER', 'JOB OFFER PENDING', 'OFFER EXTENDED', 'JOB_OFFER_PENDING',
        'JOB OFFER ACCEPTED', 'OFFER ACCEPTED', 'CONTRACT SIGNING SCHEDULED', 'HIRED', 'PASSED FINAL APPROVAL',
        'PASSED_FINAL_APPROVAL', 'PASSED', 'REQUIREMENTS VERIFIED'
    ];
    if ($realJobId > 0 && in_array($prevStatus, $slotHoldingStatuses)) {
        require_once __DIR__ . '/slot_release_helper.php';
        handle_released_slot($pdo, $realJobId, 'withdrawn', $candName ?: 'Candidate', $jobTitle);
    }

    // 3. Clear any booked interview slots for this candidate
    $freeSlot = $pdo->prepare("UPDATE interview_slots_tbl SET status = 'Open', application_id = NULL WHERE application_id = :aid");
    $freeSlot->execute(['aid' => $realAppId]);

    $pdo->commit();

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
