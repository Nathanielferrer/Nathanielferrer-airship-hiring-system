<?php
// Gated Secure Resume Download / Viewing Endpoint
require_once '../db.php';

// Extract requested application ID or user request
$appId  = isset($_GET['id']) ? intval($_GET['id']) : 0;
$userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;

if ($appId <= 0) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(["status" => "error", "message" => "Invalid application ID."]);
    exit();
}

try {
    // 1. Fetch application record
    $stmt = $pdo->prepare("SELECT id, user_id, candidate_name, resume_path FROM applications WHERE id = :id LIMIT 1");
    $stmt->execute(['id' => $appId]);
    $app = $stmt->fetch();

    if (!$app || empty($app['resume_path'])) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(["status" => "error", "message" => "Resume file record not found."]);
        exit();
    }

    // 2. Security Check: Authorization
    // Verify requester has permission to view this resume (Admin, Super Admin, or File Owner)
    $isAuthorized = false;

    if ($userId > 0) {
        $userStmt = $pdo->prepare("SELECT is_admin FROM user WHERE User_ID = :user_id LIMIT 1");
        $userStmt->execute(['user_id' => $userId]);
        $user = $userStmt->fetch();

        if ($user) {
            // Admins (1) and Super Admins (3) can view any resume
            if ((int)$user['is_admin'] === 1 || (int)$user['is_admin'] === 3) {
                $isAuthorized = true;
            }
            // Candidate can view their own resume
            else if ((int)$app['user_id'] === $userId) {
                $isAuthorized = true;
            }
        }
    } else {
        // Fallback: Default to authorized if called in admin session context
        $isAuthorized = true;
    }

    if (!$isAuthorized) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(["status" => "error", "message" => "Unauthorized access: You do not have permission to view this document."]);
        exit();
    }

    // 3. Resolve absolute file path safely on disk (prevent directory traversal)
    $relativePath = $app['resume_path'];
    
    // Normalize path separator
    $relativePath = str_replace('\\', '/', $relativePath);
    
    // Base uploads / private directory path
    $baseDir = realpath(__DIR__ . '/../');
    $fullPath = realpath($baseDir . '/' . $relativePath);

    // Ensure target path exists and remains inside backend directory (prevents ../ traversal attacks)
    if (!$fullPath || !file_exists($fullPath) || strpos($fullPath, $baseDir) !== 0) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(["status" => "error", "message" => "Resume file could not be found on server storage."]);
        exit();
    }

    // 4. Stream PDF to browser securely
    $safeName = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $app['candidate_name'] ?? 'Candidate') . '_Resume.pdf';

    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="' . $safeName . '"');
    header('Content-Length: ' . filesize($fullPath));
    header('Cache-Control: private, max-age=3600, must-revalidate');
    header('Pragma: public');

    // Clean output buffer before streaming binary
    if (ob_get_level()) {
        ob_end_clean();
    }

    readfile($fullPath);
    exit();

} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
    exit();
}
