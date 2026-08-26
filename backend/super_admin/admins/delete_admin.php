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
    echo json_encode(["status" => "error", "message" => "Invalid ID."]);
    exit();
}

try {
    // Verify target admin
    $stmt = $pdo->prepare("SELECT User_ID, User_Fname, User_Lname, User_Email, is_admin FROM user WHERE User_ID = ?");
    $stmt->execute([$id]);
    $targetAdmin = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$targetAdmin || intval($targetAdmin['is_admin']) !== 1) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Target account is not an HR Admin."]);
        exit();
    }

    $fullName = trim("{$targetAdmin['User_Fname']} {$targetAdmin['User_Lname']}");
    $email = $targetAdmin['User_Email'];

    // Soft delete: status -> Inactive (NEVER hard delete)
    $updateStmt = $pdo->prepare("UPDATE user SET status = 'Inactive' WHERE User_ID = ? AND is_admin = 1");
    $updateStmt->execute([$id]);

    echo json_encode(["status" => "success", "message" => "Admin account deactivated successfully."]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
