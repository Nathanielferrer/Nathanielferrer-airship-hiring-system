<?php
require_once '../../db.php';
header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);
$id = intval($data['id'] ?? 0);
$actorId = intval($data['actor_id'] ?? 0);
$actorName = trim($data['actor_name'] ?? 'Super Admin');

if (!$id) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid admin ID."]);
    exit();
}

try {
    // Verify target exists and is an admin (not super admin, not applicant)
    $stmt = $pdo->prepare("SELECT User_ID, User_Fname, User_Lname, User_Email, is_admin, status FROM user WHERE User_ID = ?");
    $stmt->execute([$id]);
    $targetAdmin = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$targetAdmin || intval($targetAdmin['is_admin']) !== 1) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Target account is not a valid HR Admin account."]);
        exit();
    }

    $fullName = trim("{$targetAdmin['User_Fname']} {$targetAdmin['User_Lname']}");
    $email = $targetAdmin['User_Email'];

    // ── SOFT DELETE: Update status to 'Inactive' (NEVER execute hard DELETE) ────
    $updateStmt = $pdo->prepare("UPDATE user SET status = 'Inactive' WHERE User_ID = ? AND is_admin = 1");
    $updateStmt->execute([$id]);

    // Internal admin_audit_log
    $adminAuditDetails = "Deactivated Admin account \"{$fullName}\" (Email: {$email}, ID:{$id}). Status set to Inactive.";
    $logStmt = $pdo->prepare("INSERT INTO admin_audit_log (actor_id, target_id, action, details) VALUES (?, ?, 'admin_deactivated', ?)");
    $logStmt->execute([$actorId, $id, $adminAuditDetails]);

    echo json_encode([
        "status"  => "success",
        "message" => "Admin account for \"{$fullName}\" has been deactivated."
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
