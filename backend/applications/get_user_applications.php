<?php
// Include database connection (sets CORS headers)
require_once '../db.php';
require_once __DIR__ . '/../auth/auth_guard.php';

// Auto-expire unconfirmed interview invitations and job offers past deadline
require_once __DIR__ . '/../interviews/auto_expire_helper.php';
check_and_expire_schedules($pdo);
check_and_expire_job_offers($pdo);

header('Content-Type: application/json');

// ── AUTHENTICATION REQUIRED ──────────────────────────────────────────────────
$authUser = require_auth();

$userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid user ID parameter."
    ]);
    exit();
}

// ── AUTHORIZATION: Candidates can only view their own applications ──────────
// Admins (is_admin >= 1) can view any candidate's applications.
if ((int)$authUser['is_admin'] < 1 && (int)$authUser['sub'] !== $userId) {
    http_response_code(403);
    echo json_encode([
        "status" => "error",
        "message" => "Forbidden: You cannot access application records belonging to another candidate."
    ]);
    exit();
}

try {
    $stmt = $pdo->prepare("SELECT 
                                a.application_id AS id, 
                                a.application_id,
                                a.job_id, 
                                a.resume_path, 
                                a.ai_match_score, 
                                a.ai_summary, 
                                a.status, 
                                a.applied_at, 
                                a.updated_at,
                                a.withdrawn_at,
                                a.candidate_name,
                                a.candidate_email,
                                a.contract_signing_date,
                                a.contract_signing_time,
                                a.contract_signing_location,
                                a.contract_signing_notes,
                                a.pre_employment_checklist,
                                a.job_offer_details,
                                a.work_start_date,
                                a.work_start_time,
                                a.work_start_location,
                                a.work_start_reporting_to,
                                a.work_start_notes,
                                a.remarks,
                                a.reschedule_reason,
                                a.reschedule_requested_slot_id,
                                req_slot.slot_date AS requested_interview_date,
                                req_slot.start_time AS requested_interview_start_time,
                                req_slot.end_time AS requested_interview_end_time,
                                j.title AS job_title,
                                inv.scheduled_date AS interview_date,
                                inv.scheduled_time AS interview_time,
                                inv.location AS interview_location
                            FROM applications_tbl a 
                            INNER JOIN jobs_tbl j ON a.job_id = j.job_id 
                            LEFT JOIN (
                                SELECT application_id, scheduled_date, scheduled_time, location
                                FROM interviews_tbl
                                WHERE interview_id IN (SELECT MAX(interview_id) FROM interviews_tbl GROUP BY application_id)
                            ) inv ON inv.application_id = a.application_id
                            LEFT JOIN interview_slots_tbl req_slot ON a.reschedule_requested_slot_id = req_slot.slot_id
                            WHERE a.user_id = :user_id 
                            ORDER BY a.applied_at DESC");
    $stmt->execute(['user_id' => $userId]);
    $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Fetch fresh user profile from users_tbl to keep client state synced
    $uStmt = $pdo->prepare("SELECT user_id, User_Fname, User_MInitial, User_Lname, User_Email, User_Mobile, is_admin, status, pending_email, pending_email_expires FROM users_tbl WHERE user_id = :uid");
    $uStmt->execute(['uid' => $userId]);
    $freshUser = $uStmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        "status" => "success",
        "applications" => $applications,
        "user" => $freshUser ?: null
    ]);
} catch (PDOException $e) {
    error_log('[Get User Applications Error] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An internal server error occurred while fetching applications."
    ]);
}
?>
