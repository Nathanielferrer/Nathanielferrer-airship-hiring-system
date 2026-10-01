<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth/auth_guard.php';

header('Content-Type: application/json');

// ── AUTHENTICATION: Admin required ──────────────────────────────────────────
require_admin();

$search       = isset($_GET['search']) ? trim($_GET['search']) : '';
$jobId        = isset($_GET['job_id']) ? intval($_GET['job_id']) : 0;
$status       = isset($_GET['status']) ? trim($_GET['status']) : '';
$sort         = isset($_GET['sort']) ? trim($_GET['sort']) : 'newest';
$selectedDate = isset($_GET['selected_date']) ? trim($_GET['selected_date']) : '';

try {
    $statsDateCond = "";
    if (!empty($selectedDate)) {
        $statsDateCond = " AND DATE(applied_at) = " . $pdo->quote($selectedDate);
    }

    // 1. Calculate stats dynamically based on date for active Resume Screening pipeline
    $pendingCount       = intval($pdo->query("SELECT COUNT(*) FROM applications_tbl WHERE is_archived = 0 AND status IN ('pending', 'review_required')" . $statsDateCond)->fetchColumn());
    $passedInitialCount = intval($pdo->query("SELECT COUNT(*) FROM applications_tbl WHERE is_archived = 0 AND status = 'PASSED INITIAL'" . $statsDateCond)->fetchColumn());
    $rejectedCount      = intval($pdo->query("SELECT COUNT(*) FROM applications_tbl WHERE is_archived = 0 AND status IN ('rejected', 'SCREENING_REJECTED')" . $statsDateCond)->fetchColumn());

    $stats = [
        "total"           => $pendingCount + $passedInitialCount + $rejectedCount,
        "pending"         => $pendingCount,
        "review_required" => $pendingCount,
        "passed_initial"  => $passedInitialCount,
        "rejected"        => $rejectedCount,
        "new_today"       => intval($pdo->query("SELECT COUNT(*) FROM applications_tbl WHERE is_archived = 0 AND DATE(applied_at) = CURDATE()")->fetchColumn())
    ];

    // 2. Fetch the list of applications
    $sql = "SELECT 
                a.application_id AS id,
                a.application_id, 
                a.user_id, 
                a.job_id, 
                a.resume_path, 
                a.ai_match_score, 
                a.ai_summary, 
                a.status, 
                a.remarks,
                a.applied_at, 
                a.candidate_name,
                a.candidate_email,
                COALESCE(a.candidate_mobile, u.User_Mobile) AS candidate_mobile,
                a.viewed,
                u.User_Fname, 
                u.User_Lname, 
                u.User_Email, 
                u.User_Mobile,
                j.title AS job_title,
                j.requirements AS job_requirements
            FROM applications_tbl a
            INNER JOIN users_tbl u ON a.user_id = u.user_id
            INNER JOIN jobs_tbl j ON a.job_id = j.job_id
            WHERE a.is_archived = 0";

    $params = [];

    if (!empty($selectedDate)) {
        $sql .= " AND DATE(a.applied_at) = :selected_date";
        $params['selected_date'] = $selectedDate;
    }

    if (!empty($search)) {
        $sql .= " AND (u.User_Fname LIKE :search OR u.User_Lname LIKE :search OR u.User_Email LIKE :search OR a.candidate_name LIKE :search OR a.candidate_email LIKE :search OR u.User_Mobile LIKE :search OR a.candidate_mobile LIKE :search)";
        $params['search'] = '%' . $search . '%';
    }

    if ($jobId > 0) {
        $sql .= " AND a.job_id = :job_id";
        $params['job_id'] = $jobId;
    }

    if (empty($status) || $status === 'all') {
        $sql .= " AND a.status IN ('pending', 'review_required', 'PASSED INITIAL', 'rejected', 'SCREENING_REJECTED')";
    } else {
        if ($status === 'pending') {
            $sql .= " AND a.status IN ('pending', 'review_required')";
        } elseif ($status === 'passed_initial') {
            $sql .= " AND a.status = 'PASSED INITIAL'";
        } elseif ($status === 'rejected') {
            $sql .= " AND a.status IN ('rejected', 'SCREENING_REJECTED')";
        } else {
            $sql .= " AND a.status = :status";
            $params['status'] = $status;
        }
    }

    switch ($sort) {
        case 'oldest':
        case 'date_asc':
            $sql .= " ORDER BY a.applied_at ASC";
            break;
        case 'newest':
        case 'date_desc':
            $sql .= " ORDER BY a.applied_at DESC";
            break;
        case 'score_desc':
            $sql .= " ORDER BY a.ai_match_score DESC, a.applied_at DESC";
            break;
        case 'score_asc':
            $sql .= " ORDER BY a.ai_match_score ASC, a.applied_at DESC";
            break;
        default:
            $sql .= " ORDER BY a.applied_at DESC";
            break;
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "status" => "success",
        "stats" => $stats,
        "applications" => $applications
    ]);

} catch (PDOException $e) {
    error_log("[Get Applications Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An internal system error occurred while retrieving candidate applications."
    ]);
}
?>
