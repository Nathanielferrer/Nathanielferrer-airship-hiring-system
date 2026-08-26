<?php
require_once '../db.php';

header('Content-Type: application/json');

$applicantId = isset($_GET['applicant_id']) ? (int)$_GET['applicant_id'] : null;

if (!$applicantId) {
    // Also try JSON body if passed via POST
    $body = json_decode(file_get_contents('php://input'), true);
    $applicantId = !empty($body['applicant_id']) ? (int)$body['applicant_id'] : null;
}

if (!$applicantId) {
    echo json_encode(['status' => 'error', 'message' => 'Missing applicant_id']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT id, sender, message_text, created_at
        FROM chatbot_history
        WHERE applicant_id = :applicant_id
        ORDER BY id ASC
    ");
    $stmt->execute([':applicant_id' => $applicantId]);
    $history = $stmt->fetchAll();

    echo json_encode([
        'status'  => 'success',
        'history' => $history
    ]);
} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
