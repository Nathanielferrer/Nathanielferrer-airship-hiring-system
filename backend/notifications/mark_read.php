<?php
require_once '../db.php';
header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$id = isset($data['id']) ? intval($data['id']) : (isset($data['notification_id']) ? intval($data['notification_id']) : 0);

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid notification ID."]);
    exit();
}

try {
    $stmt = $pdo->prepare("UPDATE notifications_tbl SET is_read = 1 WHERE notification_id = :id");
    $stmt->execute(['id' => $id]);
    
    echo json_encode(["status" => "success", "message" => "Notification marked as read."]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to update notification."]);
}
?>
