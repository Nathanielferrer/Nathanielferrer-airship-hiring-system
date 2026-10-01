<?php
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../audit_helper.php';
require_once __DIR__ . '/../../auth/auth_guard.php';

header('Content-Type: application/json');

// ── AUTHENTICATION: Admin / Super Admin required ─────────────────────────────
$admin = require_admin();

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$application_id = intval($data['application_id'] ?? ($data['id'] ?? 0));
$checklist = $data['checklist'] ?? null;
// Identity strictly extracted from verified JWT token
$actor_id = (int)$admin['sub'];
$actor_name = trim(($admin['first_name'] ?? '') . ' ' . ($admin['last_name'] ?? '')) ?: 'Super Admin';

if (!$application_id || !is_array($checklist)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Application ID and checklist array are required."]);
    exit();
}

try {
    // Verify application exists
    $candStmt = $pdo->prepare("
        SELECT a.application_id, a.candidate_name, u.User_Fname, u.User_Lname, j.title AS job_title
        FROM applications_tbl a
        LEFT JOIN users_tbl u ON u.user_id = a.user_id
        LEFT JOIN jobs_tbl j ON j.job_id = a.job_id
        WHERE a.application_id = ?
    ");
    $candStmt->execute([$application_id]);
    $candData = $candStmt->fetch(PDO::FETCH_ASSOC);

    if (!$candData) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Application record not found."]);
        exit();
    }

    $candName = trim($candData['candidate_name'] ?? '') ?: trim(($candData['User_Fname'] ?? '') . ' ' . ($candData['User_Lname'] ?? '')) ?: "Application #{$application_id}";
    $jobTitle = $candData['job_title'] ?? 'Position';

    // Encode checklist to JSON string
    $checklistJson = json_encode($checklist);

    $updStmt = $pdo->prepare("UPDATE applications_tbl SET pre_employment_checklist = ?, updated_at = NOW() WHERE application_id = ?");
    $updStmt->execute([$checklistJson, $application_id]);

    // Construct human-readable checklist summary for audit logging
    $verifiedDocs = [];
    $waivedDocs = [];
    foreach ($checklist as $doc => $status) {
        if ($status === 'verified' || $status === true) {
            $verifiedDocs[] = $doc;
        } else if ($status === 'waived') {
            $waivedDocs[] = $doc;
        }
    }
    $verifiedSummary = empty($verifiedDocs) ? "none" : implode(", ", $verifiedDocs);
    $waivedSummary = empty($waivedDocs) ? "none" : implode(", ", $waivedDocs);

    // Audit Log
    $details = "Updated pre-employment document checklist for candidate \"{$candName}\" (applying for \"{$jobTitle}\"). Verified: {$verifiedSummary}. Waived: {$waivedSummary}.";
    log_system_audit($pdo, $actor_id, $actor_name, 'Status Change', 'Evaluation Module', $details, 'Info');

    echo json_encode([
        "status" => "success",
        "message" => "Checklist updated successfully.",
        "checklist" => $checklist
    ]);

} catch (PDOException $e) {
    error_log("[Update Checklist Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal system error occurred while updating the checklist."]);
}
?>
