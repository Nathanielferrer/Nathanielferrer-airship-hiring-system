<?php
require_once '../db.php';
require_once __DIR__ . '/../auth/auth_guard.php';
header('Content-Type: application/json');

// ── AUTHENTICATION: Admin required ──────────────────────────────────────────
$admin = require_admin();

$json = file_get_contents('php://input');
$data = json_decode($json, true);
$id = intval($data['id'] ?? ($data['job_id'] ?? 0));

if (!$id) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid job ID."]);
    exit();
}

try {
    // Fetch full job details before deletion for detailed audit log
    $jobStmt = $pdo->prepare("SELECT title, availability, status, category, location FROM jobs_tbl WHERE job_id = ?");
    $jobStmt->execute([$id]);
    $prevJob  = $jobStmt->fetch(PDO::FETCH_ASSOC);
    $jobTitle = $prevJob['title']        ?? "Job #{$id}";
    $jobAvail = $prevJob['availability'] ?? 0;
    $jobStatus= $prevJob['status']       ?? 'Unknown';
    $jobCategory = $prevJob['category']  ?? 'Unknown';
    $jobLocation = $prevJob['location']  ?? 'Unknown';

    $stmt = $pdo->prepare("DELETE FROM jobs_tbl WHERE job_id = ?");
    $stmt->execute([$id]);

    require_once '../audit_helper.php';
    // Actor identity is extracted from verified JWT token — not client-supplied JSON
    $actorId   = (int)$admin['sub'];
    $actorName = trim(($admin['first_name'] ?? '') . ' ' . ($admin['last_name'] ?? '')) ?: 'Admin';
    log_system_audit(
        $pdo,
        $actorId,
        $actorName,
        'Job Permanent Deletion',
        'Jobs Module',
        "Permanently deleted job vacancy: Title=\"{$jobTitle}\", Category=\"{$jobCategory}\", Location=\"{$jobLocation}\", Openings={$jobAvail}, Status={$jobStatus}.",
        'Critical'
    );

    echo json_encode(["status" => "success", "message" => "Job deleted successfully."]);
} catch (PDOException $e) {
    error_log('[Delete Job Error] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal server error occurred while deleting the job."]);
}
?>

