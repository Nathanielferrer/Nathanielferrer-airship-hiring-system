<?php
require_once __DIR__ . '/../../db.php';
header('Content-Type: application/json');

try {
    $sql = "SELECT 
                a.id as application_id, 
                a.user_id,
                a.job_id,
                a.candidate_name, 
                a.candidate_email,
                a.resume_path,
                a.ai_match_score,
                a.ai_summary,
                a.status,
                a.applied_at,
                u.User_Fname, 
                u.User_Lname,
                u.User_Email,
                u.User_Mobile,
                j.title as job_title,
                COALESCE(inv.scheduled_date, slot.slot_date) as interview_date,
                COALESCE(inv.scheduled_time, slot.start_time) as start_time,
                slot.end_time,
                COALESCE(inv.location, 'Headquarters / Main Office') as location,
                COALESCE(inv.requirements, '[\"Resume\"]') as requirements,
                COALESCE(inv.meeting_link, slot.meeting_link, '') as meeting_link
            FROM applications a
            INNER JOIN user u ON a.user_id = u.User_ID
            INNER JOIN jobs j ON a.job_id = j.id
            LEFT JOIN (
                SELECT application_id, scheduled_date, scheduled_time, location, meeting_link, requirements 
                FROM interviews 
                WHERE id IN (SELECT MAX(id) FROM interviews GROUP BY application_id)
            ) inv ON inv.application_id = a.id
            LEFT JOIN (
                SELECT applicant_id, slot_date, start_time, end_time, meeting_link 
                FROM interview_slots 
                WHERE status = 'Booked' AND slot_id IN (SELECT MAX(slot_id) FROM interview_slots WHERE status = 'Booked' GROUP BY applicant_id)
            ) slot ON slot.applicant_id = a.id
            WHERE 
                (a.status IN ('CONFIRMED', 'INTERVIEW_SCHEDULED', 'PENDING SCHEDULED', 'RESCHEDULING') AND a.is_archived = 0)
                OR 
                (UPPER(a.status) IN ('PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW') AND a.is_archived = 0)
                OR 
                (UPPER(a.status) IN ('PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'HIRED', 'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL', 'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'INTERVIEW_FAILED', 'REJECTED', 'CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS', 'FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT'))
            ORDER BY 
                CASE 
                    WHEN a.status IN ('CONFIRMED', 'INTERVIEW_SCHEDULED', 'PENDING SCHEDULED', 'RESCHEDULING') THEN 1
                    WHEN UPPER(a.status) IN ('PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW') THEN 2
                    ELSE 3
                END ASC,
                a.updated_at DESC,
                interview_date DESC, 
                start_time DESC,
                a.id DESC";

    $stmt = $pdo->query($sql);
    $scheduled = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "status" => "success",
        "scheduled" => $scheduled
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
