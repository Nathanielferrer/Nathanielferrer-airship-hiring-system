<?php
require_once '../../db.php';
header('Content-Type: application/json');

$date = trim($_GET['date'] ?? '');

if (!$date) {
    echo json_encode(["status" => "error", "message" => "Date is required."]);
    exit();
}

try {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM interview_slots_tbl WHERE slot_date = ?");
    $stmt->execute([$date]);
    $count = (int)$stmt->fetchColumn();
    echo json_encode(["status" => "success", "count" => $count, "remaining" => 99]);
} catch (PDOException $e) {
    error_log("[Get Slot Count Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal system error occurred while retrieving slot counts."]);
}
?>
