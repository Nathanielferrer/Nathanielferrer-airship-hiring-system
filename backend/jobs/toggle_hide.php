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
    // Fetch job details
    $jobStmt = $pdo->prepare("SELECT title, availability, status, is_hidden FROM jobs_tbl WHERE job_id = ?");
    $jobStmt->execute([$id]);
    $job = $jobStmt->fetch(PDO::FETCH_ASSOC);

    if (!$job) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Job vacancy record not found."]);
        exit();
    }

    $currentHidden = intval($job['is_hidden'] ?? 0);
    $newHidden = isset($data['is_hidden']) ? (intval($data['is_hidden']) ? 1 : 0) : ($currentHidden === 1 ? 0 : 1);

    $stmt = $pdo->prepare("UPDATE jobs_tbl SET is_hidden = ? WHERE job_id = ?");
    $stmt->execute([$newHidden, $id]);

    require_once '../audit_helper.php';
    // Identity strictly extracted from verified JWT token
    $actorId   = (int)$admin['sub'];
    $actorName = trim(($admin['first_name'] ?? '') . ' ' . ($admin['last_name'] ?? '')) ?: 'Admin';

    $auditMsg = $newHidden === 1
        ? "Paused public intake and hid job vacancy \"{$job['title']}\". New applicants cannot view or apply to this role; existing applicants retain visibility."
        : "Resumed public intake and unhid job vacancy \"{$job['title']}\". Job vacancy is now publicly visible to all candidates.";

    log_system_audit(
        $pdo,
        $actorId,
        $actorName,
        'Job Visibility',
        'Jobs Module',
        $auditMsg,
        'Info'
    );

    echo json_encode([
        "status" => "success",
        "is_hidden" => $newHidden,
        "message" => $newHidden === 1 
            ? "Job hidden successfully. Public intake is paused." 
            : "Job unhidden successfully. Public intake is resumed."
    ]);
} catch (PDOException $e) {
    error_log("[Toggle Hide Job Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal system error occurred while updating job visibility."]);
}
?>
