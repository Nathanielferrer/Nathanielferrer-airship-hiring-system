<?php
// Include database connection (sets CORS headers)
require_once '../db.php';

header('Content-Type: application/json');

$userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid user ID parameter."
    ]);
    exit();
}

try {
    $stmt = $pdo->prepare("SELECT 
                                a.id, 
                                a.job_id, 
                                a.resume_path, 
                                a.ai_match_score, 
                                a.ai_summary, 
                                a.status, 
                                a.applied_at, 
                                a.candidate_name,
                                a.candidate_email,
                                j.title AS job_title 
                            FROM applications a 
                            INNER JOIN jobs j ON a.job_id = j.id 
                            WHERE a.user_id = :user_id 
                            ORDER BY a.applied_at DESC");
    $stmt->execute(['user_id' => $userId]);
    $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "status" => "success",
        "applications" => $applications
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Failed to fetch user applications: " . $e->getMessage()
    ]);
}
