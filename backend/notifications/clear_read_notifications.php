<?php
require_once '../db.php';
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
$userId = isset($input['user_id']) ? intval($input['user_id']) : (isset($_GET['user_id']) ? intval($_GET['user_id']) : 0);

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid user ID."]);
    exit();
}

try {
    $stmt = $pdo->prepare("DELETE FROM notifications WHERE user_id = :user_id AND is_read = 1");
    $stmt->execute(['user_id' => $userId]);
    $deletedCount = $stmt->rowCount();

    echo json_encode([
        "status" => "success",
        "message" => "Cleared read notifications.",
        "cleared_count" => $deletedCount
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to clear notifications."]);
}
?>
