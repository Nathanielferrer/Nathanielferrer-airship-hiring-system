<?php
require_once '../db.php';
header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);
$id = isset($data['id']) ? intval($data['id']) : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid application ID."]);
    exit();
}

try {
    $stmt = $pdo->prepare("UPDATE applications SET viewed = 1 WHERE id = :id");
    $stmt->execute(['id' => $id]);
    echo json_encode(["status" => "success", "message" => "Marked as viewed."]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to update viewed status."]);
}
