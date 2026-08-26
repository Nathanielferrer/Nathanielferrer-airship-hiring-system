<?php
require_once '../db.php';
header('Content-Type: application/json');

try {
    $sql = "SELECT 
                a.id as application_id, 
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
            FROM applications a
            INNER JOIN user u ON a.user_id = u.User_ID
            INNER JOIN jobs j ON a.job_id = j.id
            LEFT JOIN (
                SELECT application_id, scheduled_date, scheduled_time, location 
                FROM interviews 
                WHERE id IN (SELECT MAX(id) FROM interviews GROUP BY application_id)
            ) inv ON inv.application_id = a.id
            LEFT JOIN (
                SELECT applicant_id, slot_date, start_time, end_time 
                FROM interview_slots 
                WHERE status = 'Booked' AND slot_id IN (SELECT MAX(slot_id) FROM interview_slots WHERE status = 'Booked' GROUP BY applicant_id)
            ) slot ON slot.applicant_id = a.id
            LEFT JOIN interview_slots req_slot ON a.reschedule_requested_slot_id = req_slot.slot_id
            WHERE a.status IN ('INTERVIEW_SCHEDULED', 'PENDING SCHEDULED', 'CONFIRMED', 'RESCHEDULING', 'PASSED INITIAL')
            GROUP BY a.id
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
