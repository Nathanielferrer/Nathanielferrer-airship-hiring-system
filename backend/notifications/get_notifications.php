<?php
require_once '../db.php';
header('Content-Type: application/json');

// Ensure the notifications table exists and has all required columns
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'general',
        application_id INT DEFAULT NULL,
        link VARCHAR(255) DEFAULT '',
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES user(User_ID) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Add missing columns to notifications table if they don't exist
    $notifCols = $pdo->query("DESCRIBE notifications")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('type', $notifCols)) {
        $pdo->exec("ALTER TABLE notifications ADD COLUMN type VARCHAR(50) DEFAULT 'general' AFTER message");
    }
    if (!in_array('application_id', $notifCols)) {
        $pdo->exec("ALTER TABLE notifications ADD COLUMN application_id INT DEFAULT NULL AFTER type");
    }
} catch (PDOException $e) { /* ignore */ }

$userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid user ID."]);
    exit();
}

try {
    $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 50");
    $stmt->execute(['user_id' => $userId]);
    $notifications = $stmt->fetchAll();

    echo json_encode([
        "status" => "success",
        "notifications" => $notifications
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to fetch notifications."]);
}
?>
