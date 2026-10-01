<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth/auth_guard.php';
header('Content-Type: application/json');

// ── AUTHENTICATION: Admin required ──────────────────────────────────────────
require_admin();

$search        = isset($_GET['search']) ? trim($_GET['search']) : '';
$selectedDate  = isset($_GET['selected_date']) ? trim($_GET['selected_date']) : '';
$selectedYear  = isset($_GET['selected_year']) ? trim($_GET['selected_year']) : '';
$status_filter = isset($_GET['status_filter']) ? strtolower(trim($_GET['status_filter'])) : '';
$page          = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
$limit         = 20;
$offset        = ($page - 1) * $limit;

try {
    // Base SQL for counting and fetching
    $baseSql = "FROM applications_tbl a
                INNER JOIN users_tbl u ON a.user_id = u.user_id
                INNER JOIN jobs_tbl j ON a.job_id = j.job_id
                WHERE 1=1";
    $params = [];

    if (!empty($selectedDate)) {
        $baseSql .= " AND DATE(a.applied_at) = :selected_date";
        $params['selected_date'] = $selectedDate;
    } elseif (!empty($selectedYear) && ctype_digit($selectedYear)) {
        $baseSql .= " AND YEAR(a.applied_at) = :selected_year";
        $params['selected_year'] = $selectedYear;
    }

    if (!empty($search)) {
        $baseSql .= " AND (u.User_Fname LIKE :search1 OR u.User_Lname LIKE :search2 OR u.User_Email LIKE :search3 OR a.candidate_name LIKE :search4 OR a.candidate_email LIKE :search5 OR j.title LIKE :search6 OR a.status LIKE :search7)";
        $searchVal = '%' . $search . '%';
        $params['search1'] = $searchVal;
        $params['search2'] = $searchVal;
        $params['search3'] = $searchVal;
        $params['search4'] = $searchVal;
        $params['search5'] = $searchVal;
        $params['search6'] = $searchVal;
        $params['search7'] = $searchVal;
    }

    if ($status_filter === 'hired') {
        $baseSql .= " AND UPPER(a.status) IN ('HIRED', 'PASSED INTERVIEW', 'PASSED', 'HIRED / PASSED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'OFFICIALLY HIRED', 'OFFICIALLY_HIRED', 'OFFICIALLY HIRED & SIGNED', 'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED', 'PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT', 'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED', 'HIRED - PRE-EMPLOYMENT', 'HIRED_PRE_EMPLOYMENT')";
    } else if ($status_filter === 'approved_for_job_offer' || $status_filter === 'president_approved' || $status_filter === 'ready_for_offer') {
        $baseSql .= " AND UPPER(a.status) IN ('APPROVED FOR JOB OFFER', 'APPROVED_FOR_JOB_OFFER', 'PRESIDENT APPROVED', 'PRESIDENT_APPROVED', 'READY FOR OFFER', 'READY_FOR_OFFER', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL')";
    } else if ($status_filter === 'job_offer_pending') {
        $baseSql .= " AND UPPER(a.status) IN ('JOB OFFER PENDING', 'JOB_OFFER_PENDING', 'OFFER EXTENDED', 'OFFER_EXTENDED')";
    } else if ($status_filter === 'job_offer_accepted') {
        $baseSql .= " AND UPPER(a.status) IN ('JOB OFFER ACCEPTED', 'JOB_OFFER_ACCEPTED', 'OFFER ACCEPTED', 'OFFER_ACCEPTED')";
    } else if ($status_filter === 'job_offer_declined') {
        $baseSql .= " AND UPPER(a.status) IN ('JOB OFFER DECLINED', 'JOB_OFFER_DECLINED', 'OFFER DECLINED', 'OFFER_DECLINED')";
    } else if ($status_filter === 'completed_requirements') {
        $baseSql .= " AND UPPER(a.status) IN ('COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED')";
    } else if ($status_filter === 'partially_compliant') {
        $baseSql .= " AND UPPER(a.status) IN ('PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT')";
    } else if ($status_filter === 'rejected') {
        $baseSql .= " AND UPPER(a.status) IN ('REJECTED', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED', 'DECLINED - UNRESPONSIVE', 'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL', 'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'JOB OFFER DECLINED', 'JOB_OFFER_DECLINED')";
    } else if ($status_filter === 'passed_final_interview') {
        $baseSql .= " AND UPPER(a.status) IN ('PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW')";
    } else if ($status_filter === 'withdrawn') {
        $baseSql .= " AND UPPER(a.status) IN ('CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW')";
    } else if ($status_filter === 'no_show') {
        $baseSql .= " AND UPPER(a.status) IN ('CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW')";
    } else if ($status_filter === 'contract_signing') {
        $baseSql .= " AND UPPER(a.status) IN ('CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED', 'REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED')";
    } else if ($status_filter === 'pending_evaluation') {
        $baseSql .= " AND UPPER(a.status) IN ('PENDING', 'REVIEW_REQUIRED')";
    } else if ($status_filter === 'passed_initial') {
        $baseSql .= " AND UPPER(a.status) IN ('PASSED INITIAL', 'PASSED_INITIAL', 'PASSED INITIAL SCREENING')";
    } else if ($status_filter === 'pending_scheduled') {
        $baseSql .= " AND UPPER(a.status) IN ('PENDING SCHEDULED', 'PENDING SCHEDULE', 'PENDING_SCHEDULED')";
    } else if ($status_filter === 'confirmed_schedule') {
        $baseSql .= " AND UPPER(a.status) IN ('CONFIRMED', 'INTERVIEW_SCHEDULED', 'CONFIRMED SCHEDULE')";
    } else if ($status_filter === 'rescheduling') {
        $baseSql .= " AND UPPER(a.status) IN ('RESCHEDULING', 'RESCHEDULING REQUESTED', 'RESCHEDULE_REQUESTED')";
    } else if ($status_filter === 'scheduling_expired') {
        $baseSql .= " AND UPPER(a.status) IN ('SCHEDULING EXPIRED', 'SCHEDULING_EXPIRED', 'DECLINED - UNRESPONSIVE', 'UNRESPONSIVE', 'DECLINED_UNRESPONSIVE')";
    } else if ($status_filter === 'offer_expired') {
        $baseSql .= " AND UPPER(a.status) IN ('OFFER EXPIRED', 'OFFER_EXPIRED', 'JOB OFFER EXPIRED')";
    } else if ($status_filter === 'waitlisted') {
        $baseSql .= " AND UPPER(a.status) IN ('PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT', 'WAITLIST', 'WAITLISTED')";
    }

    // 1. Get Total Count for Pagination
    $countStmt = $pdo->prepare("SELECT COUNT(*) " . $baseSql);
    $countStmt->execute($params);
    $totalRecords = $countStmt->fetchColumn();
    $totalPages = ceil($totalRecords / $limit);

    // 2. Fetch Paginated Records
    $sql = "SELECT 
                a.application_id AS id, 
                a.application_id, 
                a.user_id, 
                a.job_id, 
                a.status, 
                a.applied_at, 
                a.updated_at,
                a.candidate_name,
                a.candidate_email,
                a.remarks,
                COALESCE(a.candidate_mobile, u.User_Mobile) AS User_Mobile,
                a.ai_match_score,
                a.ai_summary,
                a.resume_path,
                u.User_Fname, 
                u.User_Lname, 
                u.User_Email, 
                u.status AS user_status,
                j.title AS job_title
            " . $baseSql . " ORDER BY a.applied_at DESC LIMIT :limit OFFSET :offset";

    $stmt = $pdo->prepare($sql);
    
    foreach ($params as $key => &$val) {
        $stmt->bindParam(":$key", $val);
    }
    $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
    
    $stmt->execute();
    $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Fetch all distinct years that have application records
    $yearsStmt = $pdo->query("SELECT DISTINCT YEAR(applied_at) AS yr FROM applications_tbl WHERE applied_at IS NOT NULL AND applied_at != '0000-00-00 00:00:00' ORDER BY yr DESC");
    $availableYears = array_values(array_filter(array_map('intval', $yearsStmt->fetchAll(PDO::FETCH_COLUMN))));

    echo json_encode([
        "status"          => "success",
        "applications"    => $applications,
        "total_records"   => $totalRecords,
        "total_pages"     => $totalPages,
        "current_page"    => $page,
        "available_years" => $availableYears
    ]);

} catch (PDOException $e) {
    error_log("[Get All Applications Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "An internal system error occurred while retrieving master applications list."
    ]);
}
?>
