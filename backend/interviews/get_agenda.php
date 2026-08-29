<?php
require_once __DIR__ . '/../db.php';
header('Content-Type: application/json');

try {
    $sql = "SELECT 
                a.application_id, 
                a.application_id as id,
                a.user_id,
                a.candidate_name, 
                a.status as application_status,
                a.reschedule_reason,
                a.reschedule_requested_slot_id,
                u.User_Fname, 
                u.User_Lname,
                u.User_Email,
                j.title as job_title,
                COALESCE(inv.scheduled_date, slot.slot_date) as interview_date,
                COALESCE(inv.scheduled_time, slot.start_time) as start_time,
                slot.end_time,
                inv.location,
                req_slot.slot_date as requested_date,
                req_slot.start_time as requested_start_time,
                req_slot.end_time as requested_end_time
            FROM applications_tbl a
            INNER JOIN users_tbl u ON a.user_id = u.user_id
            INNER JOIN jobs_tbl j ON a.job_id = j.job_id
            LEFT JOIN (
                SELECT application_id, scheduled_date, scheduled_time, location 
                FROM interviews_tbl 
                WHERE interview_id IN (SELECT MAX(interview_id) FROM interviews_tbl GROUP BY application_id)
            ) inv ON inv.application_id = a.application_id
            LEFT JOIN (
                SELECT application_id, slot_date, start_time, end_time 
                FROM interview_slots_tbl 
                WHERE status = 'Booked' AND slot_id IN (SELECT MAX(slot_id) FROM interview_slots_tbl WHERE status = 'Booked' GROUP BY application_id)
            ) slot ON slot.application_id = a.application_id
            LEFT JOIN interview_slots_tbl req_slot ON a.reschedule_requested_slot_id = req_slot.slot_id
            WHERE a.status IN ('INTERVIEW_SCHEDULED', 'PENDING SCHEDULED', 'CONFIRMED', 'RESCHEDULING', 'PASSED INITIAL')
            GROUP BY a.application_id
            ORDER BY interview_date ASC, start_time ASC";

    $stmt = $pdo->query($sql);
    $agenda = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "status" => "success",
        "agenda" => $agenda
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database fetch failed: " . $e->getMessage()
    ]);
}
?>
