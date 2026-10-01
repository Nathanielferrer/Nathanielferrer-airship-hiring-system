<?php
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../interviews/auto_expire_helper.php';
require_once __DIR__ . '/../../auth/auth_guard.php';
header('Content-Type: application/json');

// ── AUTHENTICATION: Admin required ──────────────────────────────────────────
require_admin();

// Real-time check and transition for expired schedules and job offers
check_and_expire_schedules($pdo);
check_and_expire_job_offers($pdo);

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
                a.is_archived,
                a.applied_at,
                a.updated_at,
                a.contract_signing_date,
                a.contract_signing_time,
                a.contract_signing_location,
                a.contract_signing_notes,
                a.pre_employment_checklist,
                a.work_start_date,
                a.work_start_time,
                a.work_start_location,
                a.work_start_reporting_to,
                a.work_start_notes,
                a.remarks,
                a.job_offer_details,
                u.User_Fname, 
                u.User_Lname, 
                u.User_Email,
                u.User_Mobile,
                j.title as job_title,
                COALESCE(j.availability, 1) as job_availability,
                COALESCE(inv.scheduled_date, slot.slot_date) as interview_date,
                COALESCE(inv.scheduled_time, slot.start_time) as start_time,
                slot.end_time,
                COALESCE(inv.location, 'Headquarters / Main Office') as location,
                COALESCE(inv.requirements, '[\"Printed Resume\"]') as requirements
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
                (a.status IN ('CONFIRMED', 'INTERVIEW_SCHEDULED') AND a.is_archived = 0)
                OR 
                (UPPER(a.status) IN ('PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW', 'PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT', 'WAITING FOR SLOT') AND a.is_archived = 0)
                OR 
                (UPPER(a.status) IN ('JOB OFFER PENDING', 'OFFER EXTENDED', 'JOB_OFFER_PENDING', 'OFFER_EXTENDED', 'APPROVED FOR JOB OFFER', 'APPROVED_FOR_JOB_OFFER', 'PRESIDENT APPROVED', 'PRESIDENT_APPROVED', 'OFFER DECLINED', 'OFFER_DECLINED') AND a.is_archived = 0)
                OR 
                (UPPER(a.status) IN ('PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'HIRED', 'JOB OFFER ACCEPTED', 'JOB_OFFER_ACCEPTED', 'OFFER ACCEPTED', 'OFFER_ACCEPTED', 'CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED') AND a.is_archived = 0)
                OR
                (
                    UPPER(a.status) IN (
                        'REQUIREMENT PENDING', 'REQUIREMENTS PENDING', 'REQUIREMENT_PENDING', 'REQUIREMENTS_PENDING',
                        'REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED',
                        'OFFICIALLY HIRED', 'OFFICIALLY_HIRED', 'OFFICIALLY HIRED & SIGNED', 
                        'HIRED - PRE-EMPLOYMENT', 'HIRED_PRE_EMPLOYMENT', 
                        'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED', 
                        'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED', 
                        'PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT'
                    ) 
                    AND a.is_archived = 0
                )
            ORDER BY 
                CASE 
                    WHEN a.status IN ('CONFIRMED', 'INTERVIEW_SCHEDULED') THEN 1
                    WHEN UPPER(a.status) IN ('PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW', 'PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT', 'WAITING FOR SLOT') THEN 2
                    WHEN UPPER(a.status) IN ('PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'HIRED', 'JOB OFFER ACCEPTED', 'JOB_OFFER_ACCEPTED', 'OFFER ACCEPTED', 'OFFER_ACCEPTED', 'CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED') THEN 3
                    ELSE 4
                END ASC,
                a.updated_at DESC,
                interview_date DESC, 
                start_time DESC,
                a.application_id DESC";

    $stmt = $pdo->query($sql);
    $scheduled = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Compute real-time slot capacity per job
    $capStmt = $pdo->query("
        SELECT 
            a.job_id,
            a.application_id,
            a.status,
            a.candidate_name,
            u.User_Fname,
            u.User_Lname
        FROM applications_tbl a
        LEFT JOIN users_tbl u ON a.user_id = u.user_id
        WHERE a.is_archived = 0 
          AND UPPER(a.status) IN (
            'PRESIDENT APPROVED', 'APPROVED FOR JOB OFFER', 'APPROVED_FOR_JOB_OFFER', 'APPROVED',
            'JOB OFFER PENDING', 'JOB_OFFER_PENDING', 'JOB OFFER CREATED', 'JOB_OFFER_CREATED', 'JOB OFFER SENT', 'JOB_OFFER_SENT',
            'OFFER EXTENDED', 'OFFER_EXTENDED', 'JOB OFFER ACCEPTED', 'JOB_OFFER_ACCEPTED', 'OFFER ACCEPTED', 'OFFER_ACCEPTED',
            'CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED', 'CONTRACT SCHEDULED', 'CONTRACT_SCHEDULED',
            'CONTRACT SIGNED', 'CONTRACT_SIGNED', 'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED',
            'REQUIREMENT PENDING', 'REQUIREMENTS PENDING', 'REQUIREMENT_PENDING', 'REQUIREMENTS_PENDING',
            'REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED', 'PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT',
            'HIRED - PRE-EMPLOYMENT', 'HIRED_PRE_EMPLOYMENT', 'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS',
            'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'HIRED',
            'OFFICIALLY HIRED', 'OFFICIALLY_HIRED', 'OFFICIALLY HIRED & SIGNED', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED'
          )
    ");
    $occupiedRows = $capStmt->fetchAll(PDO::FETCH_ASSOC);

    $jobOccupancy = [];
    foreach ($occupiedRows as $orow) {
        $jid = (int)$orow['job_id'];
        if (!isset($jobOccupancy[$jid])) {
            $jobOccupancy[$jid] = [
                'count' => 0,
                'holders' => []
            ];
        }
        $jobOccupancy[$jid]['count']++;
        $candName = trim($orow['candidate_name'] ?: trim("{$orow['User_Fname']} {$orow['User_Lname']}")) ?: 'Candidate';
        $jobOccupancy[$jid]['holders'][] = [
            'application_id' => (int)$orow['application_id'],
            'name' => $candName,
            'status' => $orow['status']
        ];
    }

    foreach ($scheduled as &$row) {
        $jid = (int)$row['job_id'];
        $totalSlots = max(1, (int)($row['job_availability'] ?? 1));
        $occ = $jobOccupancy[$jid] ?? ['count' => 0, 'holders' => []];
        $occupiedCount = $occ['count'];
        $availableSlots = max(0, $totalSlots - $occupiedCount);

        $row['total_slots'] = $totalSlots;
        $row['occupied_slots'] = $occupiedCount;
        $row['available_slots'] = $availableSlots;
        $row['slot_holders'] = $occ['holders'];

        // Holder other than this candidate
        $otherHolders = array_values(array_filter($occ['holders'], fn($h) => $h['application_id'] !== (int)$row['application_id']));
        $row['active_holder_name'] = !empty($otherHolders) ? $otherHolders[0]['name'] : '';
        $row['active_holder_status'] = !empty($otherHolders) ? $otherHolders[0]['status'] : '';
    }
    unset($row);

    echo json_encode([
        "status" => "success",
        "scheduled" => $scheduled
    ]);
} catch (PDOException $e) {
    error_log("[Get Scheduled Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal system error occurred while retrieving interview schedules."]);
}
?>
