<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth/auth_guard.php';
global $pdo;
header('Content-Type: application/json');

// ── AUTHENTICATION: Admin required ──────────────────────────────────────────
require_admin();

$page           = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
$limit          = 20; // 20 logs per page
$offset         = ($page - 1) * $limit;

$start_date     = isset($_GET['start_date']) ? trim($_GET['start_date']) : '';
$end_date       = isset($_GET['end_date']) ? trim($_GET['end_date']) : '';
$selected_date  = isset($_GET['date']) ? trim($_GET['date']) : (isset($_GET['selected_date']) ? trim($_GET['selected_date']) : '');
$date_range     = isset($_GET['date_range']) ? trim($_GET['date_range']) : 'all';
$admin_filter   = isset($_GET['admin_name']) ? trim($_GET['admin_name']) : '';
$category_filter= isset($_GET['action_category']) ? trim($_GET['action_category']) : '';
$search_query   = isset($_GET['search']) ? trim($_GET['search']) : '';

try {
    // ── ADMIN-ONLY AUDIT TRAIL QUERY (Track regular Admin actions only for non-repudiation; Super Admin, System, and Applicants are strictly excluded) ──
    $where = [
        "u.is_admin = 1",
        "sal.admin_name NOT LIKE '%Super Admin%'",
        "sal.admin_name != 'System'"
    ];
    $params = [];

    // Date Filtering
    if (!empty($start_date) && !empty($end_date)) {
        $where[] = "DATE(sal.created_at) >= :start_date AND DATE(sal.created_at) <= :end_date";
        $params['start_date'] = $start_date;
        $params['end_date'] = $end_date;
    } elseif (!empty($start_date)) {
        $where[] = "DATE(sal.created_at) >= :start_date";
        $params['start_date'] = $start_date;
    } elseif (!empty($end_date)) {
        $where[] = "DATE(sal.created_at) <= :end_date";
        $params['end_date'] = $end_date;
    } elseif (!empty($selected_date)) {
        $where[] = "DATE(sal.created_at) = :selected_date";
        $params['selected_date'] = $selected_date;
    } elseif ($date_range === 'today') {
        $where[] = "DATE(sal.created_at) = CURDATE()";
    } elseif ($date_range === '7days') {
        $where[] = "sal.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
    } elseif ($date_range === '30days') {
        $where[] = "sal.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
    }

    // Admin Filter (distinct parameter placeholders to prevent PDO duplicate parameter errors)
    if (!empty($admin_filter) && $admin_filter !== 'All' && $admin_filter !== '') {
        $where[] = "(COALESCE(NULLIF(TRIM(CONCAT(u.User_Fname, ' ', u.User_Lname)), ''), sal.admin_name) = :admin_filter1 OR sal.admin_name = :admin_filter2)";
        $params['admin_filter1'] = $admin_filter;
        $params['admin_filter2'] = $admin_filter;
    }

    // Action Category Filter
    if (!empty($category_filter) && $category_filter !== 'All' && $category_filter !== '') {
        $where[] = "sal.action_category = :category_filter";
        $params['category_filter'] = $category_filter;
    }

    // Search Query (distinct parameter placeholders to prevent PDO duplicate parameter errors)
    if (!empty($search_query)) {
        $where[] = "(COALESCE(NULLIF(TRIM(CONCAT(u.User_Fname, ' ', u.User_Lname)), ''), sal.admin_name) LIKE :search1 OR sal.action_category LIKE :search2 OR sal.details LIKE :search3)";
        $params['search1'] = "%{$search_query}%";
        $params['search2'] = "%{$search_query}%";
        $params['search3'] = "%{$search_query}%";
    }

    $whereClause = implode(" AND ", $where);

    // Total Records Count (strictly Admin is_admin = 1)
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM system_audit_logs_tbl sal INNER JOIN users_tbl u ON sal.admin_id = u.user_id WHERE {$whereClause}");
    $countStmt->execute($params);
    $totalRecords = (int)$countStmt->fetchColumn();

    $totalPages = max(1, ceil($totalRecords / $limit));

    // Fetch Records (strictly Admin is_admin = 1)
    $sql = "SELECT sal.log_id AS id, sal.log_id, sal.admin_id, 
                   COALESCE(NULLIF(TRIM(CONCAT(u.User_Fname, ' ', u.User_Lname)), ''), sal.admin_name) AS admin_name,
                   sal.action_category, sal.details, sal.ip_address, sal.created_at
            FROM system_audit_logs_tbl sal
            INNER JOIN users_tbl u ON sal.admin_id = u.user_id
            WHERE {$whereClause}
            ORDER BY sal.log_id DESC
            LIMIT :limit OFFSET :offset";
    
    $stmt = $pdo->prepare($sql);
    foreach ($params as $k => $v) {
        $stmt->bindValue(":{$k}", $v);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Fetch distinct filter options (Strictly Admin is_admin = 1 only)
    $adminsList = $pdo->query("
        SELECT DISTINCT COALESCE(NULLIF(TRIM(CONCAT(u.User_Fname, ' ', u.User_Lname)), ''), sal.admin_name) AS admin_name 
        FROM system_audit_logs_tbl sal
        INNER JOIN users_tbl u ON sal.admin_id = u.user_id
        WHERE u.is_admin = 1
          AND sal.admin_name NOT LIKE '%Super Admin%'
          AND sal.admin_name != 'System'
          AND COALESCE(NULLIF(TRIM(CONCAT(u.User_Fname, ' ', u.User_Lname)), ''), sal.admin_name) != ''
        ORDER BY admin_name ASC
    ")->fetchAll(PDO::FETCH_COLUMN);

    $categoriesList = $pdo->query("
        SELECT DISTINCT sal.action_category 
        FROM system_audit_logs_tbl sal
        INNER JOIN users_tbl u ON sal.admin_id = u.user_id
        WHERE u.is_admin = 1
          AND sal.admin_name NOT LIKE '%Super Admin%'
          AND sal.admin_name != 'System'
          AND sal.action_category != ''
        ORDER BY sal.action_category ASC
    ")->fetchAll(PDO::FETCH_COLUMN);

    echo json_encode([
        "status"         => "success",
        "logs"           => $logs,
        "meta"           => [
            "total_records" => $totalRecords,
            "total_pages"   => $totalPages,
            "current_page"  => $page,
            "per_page"      => $limit,
            "has_next_page" => $page < $totalPages,
            "has_prev_page" => $page > 1
        ],
        "filter_options" => [
            "admins"     => $adminsList,
            "categories" => $categoriesList
        ],
        "data"           => [
            "logs"           => $logs,
            "total_records"  => $totalRecords,
            "total_pages"    => $totalPages,
            "current_page"   => $page,
            "filters"        => [
                "admins"     => $adminsList,
                "categories" => $categoriesList
            ]
        ]
    ]);

} catch (Throwable $e) {
    error_log("[Get Audit Logs Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status"  => "error",
        "message" => "An internal system error occurred while retrieving system audit logs."
    ]);
}
?>
