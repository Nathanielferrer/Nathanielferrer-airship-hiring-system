<?php
require_once '../../db.php';
require_once '../../auth/auth_guard.php';
header('Content-Type: application/json');

// ── AUTHENTICATION: Admin / Super Admin required ─────────────────────────────
require_admin();

$json = file_get_contents('php://input');
$data = json_decode($json, true);
$slot_id = intval($data['slot_id'] ?? 0);

if (!$slot_id) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid ID."]);
    exit();
}

try {
    $slotStmt = $pdo->prepare("SELECT slot_date, start_time, end_time FROM interview_slots_tbl WHERE slot_id = ?");
    $slotStmt->execute([$slot_id]);
    $slotData = $slotStmt->fetch(PDO::FETCH_ASSOC);

    $stmt = $pdo->prepare("DELETE FROM interview_slots_tbl WHERE slot_id = ? AND status = 'Open'");
    $stmt->execute([$slot_id]);

    echo json_encode(["status" => "success", "message" => "Slot deleted successfully."]);
} catch (PDOException $e) {
    error_log("[Delete Slot Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal system error occurred while deleting the interview schedule slot."]);
}
?>
