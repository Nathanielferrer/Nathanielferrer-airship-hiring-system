<?php
// Gated Secure Resume Download / Viewing Endpoint
require_once '../db.php';
require_once __DIR__ . '/../auth/auth_guard.php';

// ── AUTHENTICATION REQUIRED ──────────────────────────────────────────────────
// Token is accepted via Authorization header, ?token= query param, or POST body.
// This ensures both fetch() API calls and window.open() new-tab downloads work.
$authUser = get_authenticated_user();

if (!$authUser) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(["status" => "error", "message" => "Unauthorized: Authentication required to access resume files."]);
    exit();
}

$appId  = isset($_GET['id']) ? intval($_GET['id']) : (isset($_GET['application_id']) ? intval($_GET['application_id']) : 0);

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

    // 2. Security Check: Authorization (token-verified identity only)
    $isAuthorized = false;

    // Admin or Super Admin (is_admin >= 1) can view any resume
    if (isset($authUser['is_admin']) && (int)$authUser['is_admin'] >= 1) {
        $isAuthorized = true;
    }
    // Candidate can only view their own resume
    else if (isset($authUser['sub']) && (int)$authUser['sub'] === (int)$app['user_id']) {
        $isAuthorized = true;
    }

    if (!$isAuthorized) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(["status" => "error", "message" => "Forbidden: You do not have permission to view this document."]);
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
    error_log('[Resume Download Error] ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(["status" => "error", "message" => "An internal server error occurred while retrieving the resume."]);
    exit();
}
?>
