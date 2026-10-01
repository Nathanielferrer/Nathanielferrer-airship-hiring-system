<?php
require_once '../../db.php';
require_once '../../auth/auth_guard.php';
header('Content-Type: application/json');

// ── AUTHENTICATION: Admin / Super Admin required ─────────────────────────────
require_admin();

try {
    $stmt = $pdo->query("SELECT user_id, user_id AS User_ID, User_Fname, User_Lname, User_Email, Created_at, requires_password_reset, COALESCE(status, 'Active') as status FROM users_tbl WHERE is_admin = 1 ORDER BY Created_at DESC");
    $admins = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "status" => "success",
        "admins" => $admins
    ]);
} catch (PDOException $e) {
    error_log("[Get Admins Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal system error occurred while retrieving administrators."]);
}
?>
