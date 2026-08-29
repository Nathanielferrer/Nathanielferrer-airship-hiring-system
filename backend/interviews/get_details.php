<?php
require_once __DIR__ . '/../db.php';
header('Content-Type: application/json');

$applicationId = isset($_GET['application_id']) ? intval($_GET['application_id']) : (isset($_GET['id']) ? intval($_GET['id']) : 0);
$userId        = isset($_GET['user_id'])        ? intval($_GET['user_id'])        : 0;

if ($applicationId <= 0 || $userId <= 0) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid parameters."]);
    exit();
}

try {
    // Security check: verify this application belongs to the requesting user
    $appStmt = $pdo->prepare("SELECT application_id, status FROM applications_tbl WHERE application_id = :app_id AND user_id = :user_id");
    $appStmt->execute(['app_id' => $applicationId, 'user_id' => $userId]);
    $app = $appStmt->fetch();

    if (!$app) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "Unauthorized access."]);
        exit();
    }

    $stmt = $pdo->prepare("
        SELECT i.*, COALESCE(slot.end_time, '') as end_time 
        FROM interviews_tbl i
        LEFT JOIN interview_slots_tbl slot ON (slot.application_id = i.application_id AND slot.status = 'Booked')
        WHERE i.application_id = :app_id 
        ORDER BY i.interview_id DESC LIMIT 1
    ");
    $stmt->execute(['app_id' => $applicationId]);
    $interview = $stmt->fetch();

    if ($interview) {
        $interview['requirements'] = json_decode($interview['requirements'], true) ?: [];
        echo json_encode([
            "status"             => "success",
            "interview"          => $interview,
            "application_status" => $app['status']
        ]);
    } else {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Interview details not found."]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Database query failed: " . $e->getMessage()]);
}
?>
