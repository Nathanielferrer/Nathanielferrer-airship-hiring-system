<?php
require_once __DIR__ . '/../db.php';
header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);
$id = intval($data['id'] ?? ($data['query_id'] ?? 0));

if (!$id) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid query ID."]);
    exit();
}

try {
    $qStmt = $pdo->prepare("SELECT raw_question_text FROM chatbot_unresolved_queries_tbl WHERE query_id = ?");
    $qStmt->execute([$id]);
    $qText = $qStmt->fetchColumn() ?: "Query #{$id}";

    $stmt = $pdo->prepare("DELETE FROM chatbot_unresolved_queries_tbl WHERE query_id = ?");
    $stmt->execute([$id]);

    require_once __DIR__ . '/../audit_helper.php';
    $actorId = intval($data['actor_id'] ?? 0);
    $actorName = trim($data['actor_name'] ?? 'Admin');
    log_system_audit(
        $pdo,
        $actorId,
        $actorName,
        'Knowledge Base Deletion',
        'Chatbot Module',
        "Dismissed and deleted unanswered question query #{$id} ('{$qText}').",
        'Info'
    );

    echo json_encode(["status" => "success", "message" => "Unanswered question removed from review queue."]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
