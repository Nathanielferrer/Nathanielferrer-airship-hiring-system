<?php
require_once '../../db.php';
header('Content-Type: application/json');

try {
    $stmt = $pdo->query("SELECT slot_id, slot_date as date, start_time, end_time, status FROM interview_slots ORDER BY slot_date ASC, start_time ASC");
    $slots = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "status" => "success",
        "slots" => $slots
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
