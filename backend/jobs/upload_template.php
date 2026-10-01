<?php
require_once __DIR__ . '/../db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed. Only POST is accepted."]);
    exit();
}

if (!isset($_FILES['template_file']) || $_FILES['template_file']['error'] !== UPLOAD_ERR_OK) {
    $errCode = $_FILES['template_file']['error'] ?? 'Missing file';
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "No file uploaded or upload error occurred (Error code: {$errCode})."]);
    exit();
}

$fileTmpPath   = $_FILES['template_file']['tmp_name'];
$fileName      = $_FILES['template_file']['name'];
$fileSize      = $_FILES['template_file']['size'];
$fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

// STRICT VALIDATION: ONLY .docx ACCEPTED
if ($fileExtension !== 'docx') {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "Invalid format: Only Word documents (.docx) are permitted as application templates."
    ]);
    exit();
}

// 15 MB limit
$maxSizeBytes = 15 * 1024 * 1024;
if ($fileSize > $maxSizeBytes) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "File size exceeds the 15 MB limit."
    ]);
    exit();
}

// Ensure directory exists
$uploadDir = __DIR__ . '/../uploads/templates/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$targetPath   = $uploadDir . 'resume_template.docx';
$backupPath   = $uploadDir . 'resume_template_backup.docx';
$frontendPath = __DIR__ . '/../../frontend/public/RESUME TEMPLATE.docx';

// Backup existing template if available
if (file_exists($targetPath)) {
    @copy($targetPath, $backupPath);
}

// Move uploaded file to target
$moved = @move_uploaded_file($fileTmpPath, $targetPath);
if (!$moved && php_sapi_name() === 'cli') {
    $moved = @copy($fileTmpPath, $targetPath);
}

if (!$moved) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to save uploaded template to the server."]);
    exit();
}

// Sync to frontend/public/RESUME TEMPLATE.docx so legacy static links also serve the new file
if (file_exists(dirname($frontendPath))) {
    @copy($targetPath, $frontendPath);
}

$displayName = trim($_POST['display_name'] ?? '');
if (empty($displayName)) {
    $displayName = pathinfo($fileName, PATHINFO_FILENAME);
}

$actorName = trim($_POST['actor_name'] ?? 'Admin');
$actorId   = intval($_POST['actor_id'] ?? 0);

$templateData = [
    'original_filename' => $fileName,
    'display_name'      => $displayName,
    'file_size'         => $fileSize,
    'file_type'         => 'docx',
    'updated_at'        => date('Y-m-d H:i:s'),
    'updated_by'        => $actorName,
    'download_url'      => get_backend_url() . '/jobs/download_template.php'
];

// Save metadata JSON
$metaPath = $uploadDir . 'template_info.json';
file_put_contents($metaPath, json_encode($templateData, JSON_PRETTY_PRINT));

// Audit log entry
if (file_exists(__DIR__ . '/../audit_helper.php')) {
    require_once __DIR__ . '/../audit_helper.php';
    try {
        log_system_audit(
            $pdo,
            $actorId,
            $actorName,
            'Template Replacement',
            'Job Posting',
            "Updated application template to \"{$fileName}\" ({$displayName})",
            'Info'
        );
    } catch (Exception $e) {
        // Log error suppressed to not block response
    }
}

echo json_encode([
    'status'   => 'success',
    'message'  => "Application template \"{$fileName}\" was uploaded and replaced successfully!",
    'template' => $templateData
]);
