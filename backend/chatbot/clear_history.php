<?php
require_once '../db.php';

header('Content-Type: application/json');

$body = json_decode(file_get_contents('php://input'), true);
$applicantId = !empty($body['applicant_id']) ? (int)$body['applicant_id'] : (isset($_GET['applicant_id']) ? (int)$_GET['applicant_id'] : null);

if (!$applicantId) {
    echo json_encode(['status' => 'error', 'message' => 'Missing applicant_id']);
    exit;
}

try {
    $stmt = $pdo->prepare("DELETE FROM chatbot_history WHERE applicant_id = :applicant_id");
    $stmt->execute([':applicant_id' => $applicantId]);

    echo json_encode([
        'status'  => 'success',
        'message' => 'Chat history cleared successfully'
    ]);
} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
