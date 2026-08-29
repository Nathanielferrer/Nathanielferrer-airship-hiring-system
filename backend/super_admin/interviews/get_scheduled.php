<?php
require_once __DIR__ . '/../../db.php';
header('Content-Type: application/json');

try {
    $sql = "SELECT 
                a.application_id,
                a.application_id as id, 
                a.user_id,
                a.job_id,
                a.candidate_name, 
                a.candidate_email,
                a.resume_path,
                a.ai_match_score,
                a.ai_summary,
                a.status,
                a.applied_at,
                a.updated_at,
                a.contract_signing_date,
                a.contract_signing_time,
                a.contract_signing_location,
                a.contract_signing_notes,
                u.User_Fname, 
                u.User_Lname,
                u.User_Email,
                u.User_Mobile,
                j.title as job_title,
                COALESCE(inv.scheduled_date, slot.slot_date) as interview_date,
                COALESCE(inv.scheduled_time, slot.start_time) as start_time,
                slot.end_time,
                COALESCE(inv.location, 'Headquarters / Main Office') as location,
                COALESCE(inv.requirements, '[\"Resume\"]') as requirements
            FROM applications_tbl a
            INNER JOIN users_tbl u ON a.user_id = u.user_id
            INNER JOIN jobs_tbl j ON a.job_id = j.job_id
            LEFT JOIN (
                SELECT application_id, scheduled_date, scheduled_time, location, requirements 
                FROM interviews_tbl 
                WHERE interview_id IN (SELECT MAX(interview_id) FROM interviews_tbl GROUP BY application_id)
            ) inv ON inv.application_id = a.application_id
            LEFT JOIN (
                SELECT application_id, slot_date, start_time, end_time 
                FROM interview_slots_tbl 
                WHERE status = 'Booked' AND slot_id IN (SELECT MAX(slot_id) FROM interview_slots_tbl WHERE status = 'Booked' GROUP BY application_id)
            ) slot ON slot.application_id = a.application_id
            WHERE 
                (a.status IN ('CONFIRMED', 'INTERVIEW_SCHEDULED', 'PENDING SCHEDULED', 'RESCHEDULING') AND a.is_archived = 0)
                OR 
                (UPPER(a.status) IN ('PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW') AND a.is_archived = 0)
                OR 
                (UPPER(a.status) IN ('PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'HIRED', 'REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED', 'CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED', 'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED', 'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL', 'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'INTERVIEW_FAILED', 'REJECTED', 'CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS', 'FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT'))
            ORDER BY 
                CASE 
                    WHEN a.status IN ('CONFIRMED', 'INTERVIEW_SCHEDULED', 'PENDING SCHEDULED', 'RESCHEDULING') THEN 1
                    WHEN UPPER(a.status) IN ('PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW') THEN 2
                    WHEN UPPER(a.status) IN ('PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'HIRED', 'REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED', 'CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED') THEN 3
                    ELSE 4
                END ASC,
                a.updated_at DESC,
                interview_date DESC, 
                start_time DESC,
                a.application_id DESC";

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
