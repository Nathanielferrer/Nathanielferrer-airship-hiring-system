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
    // Fetch full job details before archiving for detailed audit log
    $jobStmt = $pdo->prepare("SELECT title, availability, status, category, location FROM jobs_tbl WHERE job_id = ?");
    $jobStmt->execute([$id]);
    $prevJob  = $jobStmt->fetch(PDO::FETCH_ASSOC);
    $jobTitle = $prevJob['title']        ?? "Job #{$id}";
    $jobAvail = $prevJob['availability'] ?? 0;
    $jobStatus= $prevJob['status']       ?? 'Unknown';
    $jobCategory = $prevJob['category']  ?? 'Unknown';
    $jobLocation = $prevJob['location']  ?? 'Unknown';

    $stmt = $pdo->prepare("UPDATE jobs_tbl SET is_archived = 1 WHERE job_id = ?");
    $stmt->execute([$id]);

    require_once '../audit_helper.php';
    // Identity strictly extracted from verified JWT token
    $actorId   = (int)$admin['sub'];
    $actorName = trim(($admin['first_name'] ?? '') . ' ' . ($admin['last_name'] ?? '')) ?: 'Admin';
    log_system_audit(
        $pdo,
        $actorId,
        $actorName,
        'Job Archiving',
        'Jobs Module',
        "Archived job vacancy: Title=\"{$jobTitle}\".",
        'Warning'
    );

    echo json_encode(["status" => "success", "message" => "Job archived successfully."]);
} catch (PDOException $e) {
    error_log("[Archive Job Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal system error occurred while archiving the job vacancy."]);
}
?>
