<?php
require_once '../db.php';
header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$user_id = isset($data['user_id']) ? intval($data['user_id']) : 0;

if ($user_id <= 0) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid user ID."]);
    exit();
}

try {
    $stmt = $pdo->prepare("UPDATE notifications_tbl SET is_read = 1 WHERE user_id = :user_id");
    $stmt->execute(['user_id' => $user_id]);
    
    echo json_encode(["status" => "success", "message" => "All notifications marked as read."]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to update notifications: " . $e->getMessage()]);
}
?>
