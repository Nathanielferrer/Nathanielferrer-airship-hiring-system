<?php
require_once '../db.php';
header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);
$id = intval($data['id'] ?? 0);

if (!$id) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid job ID."]);
    exit();
}

try {
    // Fetch full job details before deletion for detailed audit log
    $jobStmt = $pdo->prepare("SELECT title, availability, status FROM jobs WHERE id = ?");
    $jobStmt->execute([$id]);
    $prevJob  = $jobStmt->fetch(PDO::FETCH_ASSOC);
    $jobTitle = $prevJob['title']        ?? "Job #{$id}";
    $jobAvail = $prevJob['availability'] ?? 0;
    $jobStatus= $prevJob['status']       ?? 'Unknown';

    $stmt = $pdo->prepare("DELETE FROM jobs WHERE id = ?");
    $stmt->execute([$id]);

    require_once '../audit_helper.php';
    $actorId   = intval($data['actor_id']   ?? 0);
    $actorName = trim($data['actor_name']   ?? 'Admin');
    log_system_audit(
        $pdo,
        $actorId,
        $actorName,
        'Job Deletion',
        'Jobs Module',
        "Deleted job vacancy: Title=\"{$jobTitle}\", Openings={$jobAvail}, Status={$jobStatus}.",
        'Critical'
    );

    echo json_encode(["status" => "success", "message" => "Job deleted successfully."]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
