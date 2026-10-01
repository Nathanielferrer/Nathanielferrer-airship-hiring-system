<?php
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../auth/auth_guard.php';
header('Content-Type: application/json');

// ── AUTHENTICATION: Admin / Super Admin required ─────────────────────────────
require_admin();

try {
    $stmt = $pdo->query("
        SELECT 
            s.slot_id, 
            s.slot_date AS date, 
            DAYNAME(s.slot_date) AS day_name,
            s.start_time, 
            s.end_time, 
            s.status,
            s.application_id,
            s.application_id AS applicant_id,
            CASE 
                WHEN s.status = 'Open' OR s.application_id IS NULL THEN NULL
                WHEN UPPER(a.status) NOT IN ('CONFIRMED', 'INTERVIEW_SCHEDULED', 'PENDING SCHEDULED', 'PENDING_SCHEDULED', 'RESCHEDULE REQUESTED', 'RESCHEDULE_REQUESTED') THEN NULL
                ELSE COALESCE(NULLIF(TRIM(a.candidate_name), ''), TRIM(CONCAT(COALESCE(u.User_Fname, ''), ' ', COALESCE(u.User_Lname, ''))))
            END AS applicant_name,
            CASE 
                WHEN s.status = 'Open' OR s.application_id IS NULL THEN NULL
                WHEN UPPER(a.status) NOT IN ('CONFIRMED', 'INTERVIEW_SCHEDULED', 'PENDING SCHEDULED', 'PENDING_SCHEDULED', 'RESCHEDULE REQUESTED', 'RESCHEDULE_REQUESTED') THEN NULL
                ELSE j.title
            END AS job_title,
            a.status AS application_status
        FROM interview_slots_tbl s
        LEFT JOIN applications_tbl a ON a.application_id = s.application_id
        LEFT JOIN users_tbl u ON u.user_id = a.user_id
        LEFT JOIN jobs_tbl j ON j.job_id = a.job_id
        ORDER BY s.slot_date ASC, s.start_time ASC
    ");
    $slots = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "status" => "success",
        "slots" => $slots
    ]);
} catch (PDOException $e) {
    error_log("[Get Slots Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal system error occurred while retrieving interview schedule slots."]);
}
?>
