<?php
require_once '../db.php';
header('Content-Type: application/json');

$search        = isset($_GET['search']) ? trim($_GET['search']) : '';
$selectedDate  = isset($_GET['selected_date']) ? trim($_GET['selected_date']) : '';
$status_filter = isset($_GET['status_filter']) ? strtolower(trim($_GET['status_filter'])) : '';
$page          = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
$limit         = 20;
$offset        = ($page - 1) * $limit;

try {
    // Base SQL for counting and fetching
    $baseSql = "FROM applications a
                INNER JOIN user u ON a.user_id = u.User_ID
                INNER JOIN jobs j ON a.job_id = j.id
                WHERE 1=1";
    $params = [];

    if (!empty($selectedDate)) {
        $baseSql .= " AND DATE(a.applied_at) = :selected_date";
        $params['selected_date'] = $selectedDate;
    }

    if (!empty($search)) {
        $baseSql .= " AND (u.User_Fname LIKE :search OR u.User_Lname LIKE :search OR u.User_Email LIKE :search OR a.candidate_name LIKE :search OR a.candidate_email LIKE :search OR j.title LIKE :search OR a.status LIKE :search)";
        $params['search'] = '%' . $search . '%';
    }

    if ($status_filter === 'hired') {
        $baseSql .= " AND UPPER(a.status) IN ('HIRED', 'PASSED INTERVIEW', 'PASSED', 'HIRED / PASSED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL')";
    } else if ($status_filter === 'rejected') {
        $baseSql .= " AND UPPER(a.status) IN ('REJECTED', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED', 'DECLINED - UNRESPONSIVE', 'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL', 'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW')";
    } else if ($status_filter === 'passed_final_interview') {
        $baseSql .= " AND UPPER(a.status) IN ('PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW')";
    } else if ($status_filter === 'withdrawn') {
        $baseSql .= " AND UPPER(a.status) IN ('CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW')";
    } else if ($status_filter === 'incomplete_requirements') {
        $baseSql .= " AND UPPER(a.status) IN ('INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS')";
    } else if ($status_filter === 'failed_pre_employment') {
        $baseSql .= " AND UPPER(a.status) IN ('FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT')";
    }

    // 1. Get Total Count for Pagination
    $countStmt = $pdo->prepare("SELECT COUNT(*) " . $baseSql);
    $countStmt->execute($params);
    $totalRecords = $countStmt->fetchColumn();
    $totalPages = ceil($totalRecords / $limit);

    // 2. Fetch Paginated Records
    $sql = "SELECT 
                a.id, 
                a.user_id, 
                a.job_id, 
                a.status, 
                a.applied_at, 
                a.candidate_name,
                a.candidate_email,
                a.ai_match_score,
                a.ai_summary,
                a.resume_path,
                u.User_Fname, 
                u.User_Lname, 
                u.User_Email, 
                j.title AS job_title
            " . $baseSql . " ORDER BY a.applied_at DESC LIMIT :limit OFFSET :offset";

    $stmt = $pdo->prepare($sql);
    
    // Bind all params correctly
    foreach ($params as $key => &$val) {
        $stmt->bindParam(":$key", $val);
    }
    $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
    
    $stmt->execute();
    $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "status"       => "success",
        "applications" => $applications,
        "total_records"=> $totalRecords,
        "total_pages"  => $totalPages,
        "current_page" => $page
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database fetch failed: " . $e->getMessage()
    ]);
}
?>
