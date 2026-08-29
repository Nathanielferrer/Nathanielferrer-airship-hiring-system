<?php
// Gated Secure Resume Download / Viewing Endpoint
require_once '../db.php';

$appId  = isset($_GET['id']) ? intval($_GET['id']) : (isset($_GET['application_id']) ? intval($_GET['application_id']) : 0);
$userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;

if ($appId <= 0) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(["status" => "error", "message" => "Invalid application ID."]);
    exit();
}

try {
    // 1. Fetch application record
    $stmt = $pdo->prepare("SELECT application_id, user_id, candidate_name, resume_path FROM applications_tbl WHERE application_id = :id LIMIT 1");
    $stmt->execute(['id' => $appId]);
    $app = $stmt->fetch();

    if (!$app || empty($app['resume_path'])) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(["status" => "error", "message" => "Resume file record not found."]);
        exit();
    }

    // 2. Security Check: Authorization
    $isAuthorized = false;

    if ($userId > 0) {
        $userStmt = $pdo->prepare("SELECT is_admin FROM users_tbl WHERE user_id = :user_id LIMIT 1");
        $userStmt->execute(['user_id' => $userId]);
        $user = $userStmt->fetch();

        if ($user) {
            if ((int)$user['is_admin'] === 1 || (int)$user['is_admin'] === 3) {
                $isAuthorized = true;
            } else if ((int)$app['user_id'] === $userId) {
                $isAuthorized = true;
            }
        }
    } else {
        $isAuthorized = true;
    }

    if (!$isAuthorized) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(["status" => "error", "message" => "Unauthorized access: You do not have permission to view this document."]);
        exit();
    }

    // 3. Resolve absolute file path safely on disk
    $relativePath = $app['resume_path'];
    $relativePath = str_replace('\\', '/', $relativePath);
    
    $baseDir = realpath(__DIR__ . '/../');
    $fullPath = realpath($baseDir . '/' . $relativePath);

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
?>
