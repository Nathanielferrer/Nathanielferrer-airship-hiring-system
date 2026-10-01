<?php
require_once '../db.php';

// 1. Handle one-click cancellation from email link (GET ?token=...)
if (isset($_GET['token']) && !empty(trim($_GET['token']))) {
    $token = trim($_GET['token']);
    try {
        $stmt = $pdo->prepare("
            UPDATE users_tbl 
            SET pending_email = NULL,
                pending_email_token = NULL,
                pending_email_expires = NULL 
            WHERE pending_email_token = ?
        ");
        $stmt->execute([$token]);
        // Redirect to Account Settings with cancelled confirmation query param
        header('Location: ' . get_frontend_url() . '/settings?email_change_cancelled=1');
        exit();
    } catch (PDOException $e) {
        header('Location: ' . get_frontend_url() . '/settings?email_cancel_error=1');
        exit();
    }
}

// 2. Handle POST JSON cancellation from Settings UI
header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$userId = intval($data['user_id'] ?? ($data['id'] ?? 0));

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "Valid user ID is required."
    ]);
    exit();
}

try {
    $stmt = $pdo->prepare("
        UPDATE users_tbl 
        SET pending_email = NULL,
            pending_email_token = NULL,
            pending_email_expires = NULL 
        WHERE user_id = ?
    ");
    $stmt->execute([$userId]);

    echo json_encode([
        "status"  => "success",
        "message" => "Pending email change request has been cancelled."
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status"  => "error",
        "message" => "Database error: " . $e->getMessage()
    ]);
}
?>
