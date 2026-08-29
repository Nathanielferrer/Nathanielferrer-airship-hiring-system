<?php
require_once '../db.php';

header('Content-Type: application/json');

$applicantId = isset($_GET['applicant_id']) ? (int)$_GET['applicant_id'] : (isset($_GET['user_id']) ? (int)$_GET['user_id'] : null);

if (!$applicantId) {
    // Also try JSON body if passed via POST
    $body = json_decode(file_get_contents('php://input'), true);
    $applicantId = !empty($body['applicant_id']) ? (int)$body['applicant_id'] : (!empty($body['user_id']) ? (int)$body['user_id'] : null);
}

if (!$applicantId) {
    echo json_encode(['status' => 'error', 'message' => 'Missing applicant_id']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT chat_id AS id, chat_id, user_id AS applicant_id, user_id, sender, message_text, created_at
        FROM chatbot_history_tbl
        WHERE user_id = :applicant_id
        ORDER BY chat_id ASC
    ");
    $stmt->execute([':applicant_id' => $applicantId]);
    $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'status'  => 'success',
        'history' => $history
    ]);
} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
