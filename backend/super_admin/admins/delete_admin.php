<?php
require_once '../../db.php';
require_once '../../auth/auth_guard.php';
header('Content-Type: application/json');

// ── AUTHENTICATION: Super Admin required ─────────────────────────────────────
$superAdmin = require_super_admin();

$json = file_get_contents('php://input');
$data = json_decode($json, true);
$id = intval($data['id'] ?? ($data['user_id'] ?? 0));
// Identity strictly extracted from verified JWT token
$actorId = (int)$superAdmin['sub'];
$actorName = trim(($superAdmin['first_name'] ?? '') . ' ' . ($superAdmin['last_name'] ?? '')) ?: 'Super Admin';

if (!$id) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid ID."]);
    exit();
}

try {
    // Verify target admin
    $stmt = $pdo->prepare("SELECT user_id, User_Fname, User_Lname, User_Email, is_admin FROM users_tbl WHERE user_id = ?");
    $stmt->execute([$id]);
    $targetAdmin = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$targetAdmin || intval($targetAdmin['is_admin']) !== 1) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Target account is not an HR Admin."]);
        exit();
    }

    $fullName = trim("{$targetAdmin['User_Fname']} {$targetAdmin['User_Lname']}");
    $email = $targetAdmin['User_Email'];

    // Soft delete: status -> Inactive
    $updateStmt = $pdo->prepare("UPDATE users_tbl SET status = 'Inactive' WHERE user_id = ? AND is_admin = 1");
    $updateStmt->execute([$id]);

    echo json_encode(["status" => "success", "message" => "Admin account deactivated successfully."]);

} catch (PDOException $e) {
    error_log("[Delete Admin Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal system error occurred while deleting the admin account."]);
}
?>
