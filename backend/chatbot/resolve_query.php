<?php
require_once '../db.php';
header('Content-Type: application/json');

$body    = json_decode(file_get_contents('php://input'), true);
$queryId = $body['query_id'] ?? ($body['id'] ?? null);
$mode    = $body['mode']     ?? 'new'; // 'existing' | 'new'

if (!$queryId) {
    echo json_encode(['status' => 'error', 'message' => 'query_id required']);
    exit;
}

try {
    $pdo->beginTransaction();

    if ($mode === 'existing') {
        $kbId      = $body['kb_id'] ?? ($body['id'] ?? null);
        $appendTags = trim($body['append_tags'] ?? '');

        if (!$kbId) {
            throw new Exception('kb_id required when mode is "existing"');
        }

        if (!empty($appendTags)) {
            $stmt = $pdo->prepare("
                UPDATE chatbot_knowledge_base_tbl
                SET    keyword_tags = CONCAT(
                           TRIM(BOTH ', ' FROM keyword_tags),
                           ', ',
                           :tags
                       )
                WHERE  kb_id = :id
            ");
            $stmt->execute([':tags' => $appendTags, ':id' => (int)$kbId]);
        }
    } else {
        $question = trim($body['primary_question']  ?? '');
        $answer   = trim($body['predefined_answer'] ?? '');
        $tags     = trim($body['keyword_tags']      ?? '');

        if (empty($question) || empty($answer)) {
            throw new Exception('Question and answer are required when creating a new KB entry');
        }

        $stmt = $pdo->prepare("
            INSERT INTO chatbot_knowledge_base_tbl (primary_question, predefined_answer, keyword_tags)
            VALUES (:q, :a, :t)
        ");
        $stmt->execute([':q' => $question, ':a' => $answer, ':t' => $tags]);
    }

    // Always remove from the review queue
    $del = $pdo->prepare("DELETE FROM chatbot_unresolved_queries_tbl WHERE query_id = :id");
    $del->execute([':id' => (int)$queryId]);

    $pdo->commit();
    echo json_encode(['status' => 'success']);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
