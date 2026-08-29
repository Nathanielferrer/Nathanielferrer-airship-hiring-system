<?php
// Include database connection (sets CORS headers)
require_once '../db.php';

header('Content-Type: application/json');

try {
    $activeOnly = isset($_GET['active_only']) && $_GET['active_only'] === 'true';

    // Auto-close any job with 0 or less open slots
    $pdo->exec("UPDATE jobs_tbl SET status = 'Closed' WHERE availability <= 0");

    $query = "SELECT job_id AS id, job_id, title, description, requirements, availability, status, image_path FROM jobs_tbl";
    if ($activeOnly) {
        $query .= " WHERE status = 'Active' AND availability > 0";
    }
    $query .= " ORDER BY job_id ASC";

    $stmt = $pdo->query($query);
    $jobs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "status" => "success",
        "jobs" => $jobs
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database query failed: " . $e->getMessage()
    ]);
}
?>
