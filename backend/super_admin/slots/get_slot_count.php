<?php
require_once '../../db.php';
header('Content-Type: application/json');

$date = trim($_GET['date'] ?? '');

if (!$date) {
    echo json_encode(["status" => "error", "message" => "Date is required."]);
    exit();
}

try {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM interview_slots WHERE slot_date = ?");
    $stmt->execute([$date]);
    $count = (int)$stmt->fetchColumn();
    echo json_encode(["status" => "success", "count" => $count, "remaining" => 99]);
} catch (PDOException $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
