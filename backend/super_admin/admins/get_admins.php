<?php
require_once '../../db.php';
header('Content-Type: application/json');

try {
    $stmt = $pdo->query("SELECT user_id, user_id AS User_ID, User_Fname, User_Lname, User_Email, Created_at, requires_password_reset, COALESCE(status, 'Active') as status FROM users_tbl WHERE is_admin = 1 ORDER BY Created_at DESC");
    $admins = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "status" => "success",
        "admins" => $admins
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
