<?php
require_once '../../db.php';
header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$date       = trim($data['date']       ?? '');
$start_time = trim($data['start_time'] ?? '');
$end_time   = trim($data['end_time']   ?? '');

if (!$date || !$start_time || !$end_time) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "All fields are required."]);
    exit();
}

$start = strtotime($date . ' ' . $start_time);
$end   = strtotime($date . ' ' . $end_time);

if ($end <= $start) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "End time must be after start time."]);
    exit();
}

// Enforce minimum 30 minutes duration (1800 seconds)
if (($end - $start) < 1800) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Minimum interview slot duration is 30 minutes. Please select a time window of at least 30 minutes."]);
    exit();
}

// ── Duplicate slot prevention ─────────────────────────────────────────────────
try {
    // Calculate how many new 30-min slots this window would create
    $interval     = 30 * 60;
    $newSlotCount = 0;
    for ($curr = $start; $curr + $interval <= $end; $curr += $interval) {
        $slotStart = date('H:i:s', $curr);
        $dupCheck  = $pdo->prepare("SELECT COUNT(*) FROM interview_slots WHERE slot_date = ? AND start_time = ?");
        $dupCheck->execute([$date, $slotStart]);
        if ($dupCheck->fetchColumn() == 0) {
            $newSlotCount++;
        }
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to check slot count: " . $e->getMessage()]);
    exit();
}

// ── Insert slots ──────────────────────────────────────────────────────────────
try {
    $interval    = 30 * 60;
    $createdCount = 0;

    $stmt      = $pdo->prepare("INSERT INTO interview_slots (slot_date, start_time, end_time, status) VALUES (?, ?, ?, 'Open')");
    $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM interview_slots WHERE slot_date = ? AND start_time = ?");

    for ($curr = $start; $curr + $interval <= $end; $curr += $interval) {
        $slotStart = date('H:i:s', $curr);
        $slotEnd   = date('H:i:s', $curr + $interval);

        $checkStmt->execute([$date, $slotStart]);
        if ($checkStmt->fetchColumn() == 0) {
            $stmt->execute([$date, $slotStart, $slotEnd]);
            $createdCount++;
        }
    }

    if ($createdCount === 0) {
        echo json_encode(["status" => "info", "message" => "Slots for this time window already exist or overlap with existing slots."]);
    } else {
        echo json_encode([
            "status"  => "success",
            "message" => "Successfully created {$createdCount} interview slot(s) (30-min duration each).",
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
