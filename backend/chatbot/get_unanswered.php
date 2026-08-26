<?php
require_once '../db.php';
header('Content-Type: application/json');

try {
    $stmt = $pdo->query("
        SELECT  uq.id,
                uq.applicant_id,
                uq.raw_question_text,
                uq.status,
                uq.created_at,
                u.User_Fname   AS first_name,
                u.User_Lname   AS last_name,
                u.User_Email   AS email
        FROM    unanswered_queries uq
        LEFT JOIN user u ON u.User_ID = uq.applicant_id
        WHERE   uq.status = 'pending review'
        ORDER   BY uq.created_at DESC
    ");
    $entries = $stmt->fetchAll();
    echo json_encode(['status' => 'success', 'entries' => $entries]);
} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
