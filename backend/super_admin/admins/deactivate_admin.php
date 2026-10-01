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
    echo json_encode(["status" => "error", "message" => "Invalid admin ID."]);
    exit();
}

try {
    // Verify target exists and is an admin
    $stmt = $pdo->prepare("SELECT user_id, User_Fname, User_Lname, User_Email, is_admin, status FROM users_tbl WHERE user_id = ?");
    $stmt->execute([$id]);
    $targetAdmin = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$targetAdmin || intval($targetAdmin['is_admin']) !== 1) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Target account is not a valid HR Admin account."]);
        exit();
    }

    $fullName = trim("{$targetAdmin['User_Fname']} {$targetAdmin['User_Lname']}");
    $email = $targetAdmin['User_Email'];

    // Soft delete: status -> Inactive
    $updateStmt = $pdo->prepare("UPDATE users_tbl SET status = 'Inactive' WHERE user_id = ? AND is_admin = 1");
    $updateStmt->execute([$id]);

    require_once '../../audit_helper.php';
    
    $adminAuditDetails = "Deactivated Admin account \"{$fullName}\" (Email: {$email}, ID:{$id}). Status set to Inactive.";
    log_system_audit($pdo, $actorId, $actorName, 'Admin Deactivated', 'Admin Management', $adminAuditDetails);

    echo json_encode([
        "status"  => "success",
        "message" => "Admin account for \"{$fullName}\" has been deactivated."
    ]);

} catch (PDOException $e) {
    error_log("[Deactivate Admin Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal system error occurred while deactivating the admin account."]);
}
?>
