<?php
require_once __DIR__ . '/../db.php';
header('Content-Type: application/json');

try {
    $stmt = $pdo->query("SELECT slot_id, slot_date as date, start_time, end_time FROM interview_slots_tbl WHERE status = 'Open' ORDER BY slot_date ASC, start_time ASC");
    $slots = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "status" => "success",
        "slots" => $slots
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Failed to fetch slots: " . $e->getMessage()
    ]);
}
?>
