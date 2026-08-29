<?php
require_once '../../db.php';
header('Content-Type: application/json');

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
            COALESCE(NULLIF(TRIM(a.candidate_name), ''), TRIM(CONCAT(COALESCE(u.User_Fname, ''), ' ', COALESCE(u.User_Lname, ''))), NULLIF(TRIM(a2.candidate_name), ''), TRIM(CONCAT(COALESCE(u2.User_Fname, ''), ' ', COALESCE(u2.User_Lname, '')))) AS applicant_name,
            COALESCE(j.title, j2.title) AS job_title
        FROM interview_slots_tbl s
        LEFT JOIN applications_tbl a ON a.application_id = s.application_id
        LEFT JOIN users_tbl u ON u.user_id = a.user_id
        LEFT JOIN jobs_tbl j ON j.job_id = a.job_id
        LEFT JOIN interviews_tbl inv ON (inv.scheduled_date = s.slot_date AND inv.scheduled_time = s.start_time AND s.status = 'Booked' AND s.application_id IS NULL)
        LEFT JOIN applications_tbl a2 ON a2.application_id = inv.application_id
        LEFT JOIN users_tbl u2 ON u2.user_id = a2.user_id
        LEFT JOIN jobs_tbl j2 ON j2.job_id = a2.job_id
        ORDER BY s.slot_date ASC, s.start_time ASC
    ");
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
