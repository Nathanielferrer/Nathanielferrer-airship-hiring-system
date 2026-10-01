<?php
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../audit_helper.php';
require_once __DIR__ . '/../../auth/auth_guard.php';
header('Content-Type: application/json');

// ── AUTHENTICATION: Admin / Super Admin required ─────────────────────────────
$admin = require_admin();

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$date       = trim($data['date']       ?? '');
$start_time = trim($data['start_time'] ?? '');
$end_time   = trim($data['end_time']   ?? '');
// Identity strictly extracted from verified JWT token
$actorId    = (int)$admin['sub'];
$actorName  = trim(($admin['first_name'] ?? '') . ' ' . ($admin['last_name'] ?? '')) ?: 'Super Admin';

if (!$date || !$start_time || !$end_time) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "All fields are required."]);
    exit();
}

// Enforce weekdays only (Monday = 1, Sunday = 7; 6 = Saturday, 7 = Sunday)
$dayOfWeek = (int)date('N', strtotime($date));
if ($dayOfWeek >= 6) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Interview slots can only be scheduled on weekdays (Monday to Friday). Weekends are disabled."]);
    exit();
}

$start = strtotime($date . ' ' . $start_time);
$end   = strtotime($date . ' ' . $end_time);

if ($end <= $start) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "End time must be after start time."]);
    exit();
}

$startH = (int)date('H', $start);
$startM = (int)date('i', $start);
$endH   = (int)date('H', $end);
$endM   = (int)date('i', $end);

$startMinutes = $startH * 60 + $startM;
$endMinutes   = $endH * 60 + $endM;

// Must be between 08:00 (480 mins) and 17:00 (1020 mins)
if ($startMinutes < 480 || $endMinutes > 1020) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Interview slots must be scheduled between 8:00 AM and 5:00 PM only."]);
    exit();
}

if (($end - $start) < 1800) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Minimum interview slot duration is 30 minutes. Please select a time window of at least 30 minutes."]);
    exit();
}

try {
    $interval     = 30 * 60;
    $newSlotCount = 0;
    for ($curr = $start; $curr + $interval <= $end; $curr += $interval) {
        $slotStart = date('H:i:s', $curr);
        $dupCheck  = $pdo->prepare("SELECT COUNT(*) FROM interview_slots_tbl WHERE slot_date = ? AND start_time = ?");
        $dupCheck->execute([$date, $slotStart]);
        if ($dupCheck->fetchColumn() == 0) {
            $newSlotCount++;
        }
    }
} catch (PDOException $e) {
    error_log("[Check Slot Count Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal system error occurred while verifying interview slots."]);
    exit();
}

try {
    $interval    = 30 * 60;
    $createdCount = 0;

    $stmt      = $pdo->prepare("INSERT INTO interview_slots_tbl (slot_date, start_time, end_time, status) VALUES (?, ?, ?, 'Open')");
    $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM interview_slots_tbl WHERE slot_date = ? AND start_time = ?");

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
        http_response_code(400);
        echo json_encode([
            "status"  => "error",
            "message" => "Duplicate Schedule Error: Interview slots for this date and time range already exist or overlap."
        ]);
    } else {
        $friendlyDate = date('D, M j, Y', strtotime($date));
        $friendlyStart = date('g:i A', $start);
        $friendlyEnd = date('g:i A', $end);

        log_system_audit(
            $pdo,
            $actorId,
            $actorName,
            'Slot Creation',
            'Interview Schedule',
            "Created {$createdCount} interview slot(s) for {$friendlyDate} ({$friendlyStart} - {$friendlyEnd}).",
            'Info'
        );

        echo json_encode([
            "status"  => "success",
            "message" => "Successfully created {$createdCount} interview slot(s) (30-min duration each).",
        ]);
    }
} catch (PDOException $e) {
    error_log("[Add Slot Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal system error occurred while creating interview schedule slots."]);
}
?>
