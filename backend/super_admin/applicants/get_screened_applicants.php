<?php
require_once __DIR__ . '/../../db.php';
header('Content-Type: application/json');

try {
    // Fetch applicants who have passed initial screening
    $stmt = $pdo->prepare("
        SELECT 
            a.application_id AS id,
            a.application_id,
            a.user_id,
            a.job_id,
            a.resume_path,
            a.ai_match_score,
            a.ai_summary,
            a.status,
            a.applied_at,
            a.candidate_name,
            a.candidate_email,
            u.User_Fname,
            u.User_Lname,
            u.User_Email,
            u.User_Mobile,
            j.title AS job_title,
            j.requirements AS job_requirements
        FROM applications_tbl a
        INNER JOIN users_tbl u ON a.user_id = u.user_id
        INNER JOIN jobs_tbl j ON a.job_id = j.job_id
        WHERE a.status IN (
            'PASSED INITIAL',
            'INTERVIEW_SCHEDULED',
            'PENDING SCHEDULED',
            'CONFIRMED',
            'RESCHEDULING'
        )
        ORDER BY a.applied_at DESC
    ");
    $stmt->execute();
    $applicants = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'status' => 'success',
        'applicants' => $applicants
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>
