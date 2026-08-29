<?php
// Include database connection (sets CORS headers)
require_once '../db.php';

header('Content-Type: application/json');

// Read JSON input
$json = file_get_contents('php://input');
$data = json_decode($json, true);

$id = isset($data['id']) ? intval($data['id']) : (isset($data['application_id']) ? intval($data['application_id']) : 0);

if ($id <= 0) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid application ID parameter."
    ]);
    exit();
}

try {
    // 1. Retrieve resume file path before deleting
    $stmt = $pdo->prepare("SELECT resume_path FROM applications_tbl WHERE application_id = :id");
    $stmt->execute(['id' => $id]);
    $app = $stmt->fetch();

    if (!$app) {
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "Application record not found."
        ]);
        exit();
    }

    // 2. Safely delete the physical file from the server disk if it exists
    $filePath = '../' . $app['resume_path'];
    if (!empty($filePath) && file_exists($filePath)) {
        if (!unlink($filePath)) {
            error_log("Warning: Failed to delete resume file at: " . $filePath);
        }
    }

    // 3. Remove database row
    $deleteStmt = $pdo->prepare("DELETE FROM applications_tbl WHERE application_id = :id");
    $deleteStmt->execute(['id' => $id]);

    echo json_encode([
        "status" => "success",
        "message" => "Application record and physical resume file deleted successfully."
    ]);

    // System audit log
    require_once '../audit_helper.php';
    $actorId   = intval($data['actor_id'] ?? 0);
    $actorName = trim($data['actor_name'] ?? 'Admin');
    log_system_audit($pdo, $actorId, $actorName, 'Status Change', 'Screening Module',
        "Deleted application record (App ID #{$id}).", 'Warning');

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Failed to delete record: " . $e->getMessage()
    ]);
}
?>
