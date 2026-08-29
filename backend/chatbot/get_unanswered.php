<?php
require_once '../db.php';
header('Content-Type: application/json');

try {
    $stmt = $pdo->query("
        SELECT  uq.query_id AS id,
                uq.query_id,
                uq.user_id AS applicant_id,
                uq.user_id,
                uq.raw_question_text,
                uq.status,
                uq.created_at,
                u.User_Fname   AS first_name,
                u.User_Lname   AS last_name,
                u.User_Email   AS email
        FROM    chatbot_unresolved_queries_tbl uq
        LEFT JOIN users_tbl u ON u.user_id = uq.user_id
        WHERE   uq.status = 'pending review'
        ORDER   BY uq.created_at DESC
    ");
    $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['status' => 'success', 'entries' => $entries]);
} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
