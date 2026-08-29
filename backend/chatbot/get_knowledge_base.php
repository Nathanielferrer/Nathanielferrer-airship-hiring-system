<?php
require_once '../db.php';
header('Content-Type: application/json');

try {
    $stmt    = $pdo->query("SELECT kb_id AS id, kb_id, primary_question, predefined_answer, keyword_tags, created_at FROM chatbot_knowledge_base_tbl ORDER BY created_at DESC");
    $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['status' => 'success', 'entries' => $entries]);
} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
