<?php
require_once '../db.php';
header('Content-Type: application/json');

$body = json_decode(file_get_contents('php://input'), true);
$id   = $body['id'] ?? ($body['kb_id'] ?? null);

if (!$id) {
    echo json_encode(['status' => 'error', 'message' => 'ID required']);
    exit;
}

try {
    $qStmt = $pdo->prepare("SELECT primary_question, predefined_answer, keyword_tags FROM chatbot_knowledge_base_tbl WHERE kb_id = :id");
    $qStmt->execute([':id' => (int)$id]);
    $entry = $qStmt->fetch(PDO::FETCH_ASSOC);

    $question = $entry['primary_question']  ?? "Entry #{$id}";
    $answer   = $entry['predefined_answer'] ?? '';
    $tags     = $entry['keyword_tags']      ?? '';

    $stmt = $pdo->prepare("DELETE FROM chatbot_knowledge_base_tbl WHERE kb_id = :id");
    $stmt->execute([':id' => (int)$id]);

    require_once '../audit_helper.php';
    $actorId   = intval($body['actor_id']   ?? 0);
    $actorName = trim($body['actor_name']   ?? 'Admin');

    $answerSnippet = mb_strlen($answer) > 80 ? mb_substr($answer, 0, 80) . '…' : $answer;

    log_system_audit(
        $pdo,
        $actorId,
        $actorName,
        'Knowledge Base Deletion',
        'Chatbot KB',
        "Deleted Chatbot KB entry #{$id}: Q=\"{$question}\" | Answer=\"{$answerSnippet}\" | Tags=\"{$tags}\".",
        'Warning'
    );

    echo json_encode(['status' => 'success']);
} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
