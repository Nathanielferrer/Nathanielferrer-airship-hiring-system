<?php
require_once '../db.php';
require_once __DIR__ . '/../auth/auth_guard.php';
header('Content-Type: application/json');

// ── AUTHENTICATION: Admin required ──────────────────────────────────────────
$admin = require_admin();

$title = trim($_POST['title'] ?? '');
$description = trim($_POST['description'] ?? '');
$requirements = trim($_POST['requirements'] ?? '');
$availability = intval($_POST['availability'] ?? 1);
$status = trim($_POST['status'] ?? 'Active');
$category = trim($_POST['category'] ?? 'Operations');
$location = trim($_POST['location'] ?? 'Airship Express HQ');
if (empty($location)) $location = 'Airship Express HQ';

$salary = trim($_POST['salary'] ?? '');
$employment_type = trim($_POST['employment_type'] ?? 'Full Time');
if (empty($employment_type)) $employment_type = 'Full Time';

if (!$title || !$requirements) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Title and requirements are required."]);
    exit();
}

// ── Check for duplicate job posting title ───────────
$dupCheck = $pdo->prepare("SELECT COUNT(*) FROM jobs_tbl WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) AND is_archived = 0");
$dupCheck->execute([$title]);
if ($dupCheck->fetchColumn() > 0) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "Duplicate Job Posting Error: A job posting with the title \"{$title}\" already exists."
    ]);
    exit();
}

$image_path = null;

if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
    $fileTmpPath = $_FILES['image']['tmp_name'];
    $fileName = $_FILES['image']['name'];
    $fileNameCmps = explode(".", $fileName);
    $fileExtension = strtolower(end($fileNameCmps));
    
    $allowedfileExtensions = array('jpg', 'jpeg', 'png', 'webp');
    if (in_array($fileExtension, $allowedfileExtensions)) {
        $uploadFileDir = '../uploads/jobs/';
        if (!is_dir($uploadFileDir)) {
            mkdir($uploadFileDir, 0755, true);
        }
        $newFileName = md5(time() . $fileName) . '.' . $fileExtension;
        $dest_path = $uploadFileDir . $newFileName;
        
        if (move_uploaded_file($fileTmpPath, $dest_path)) {
            // Encode as persistent Base64 Data URL so images survive cloud container restarts
            $mimeType = mime_content_type($dest_path) ?: ('image/' . ($fileExtension === 'jpg' ? 'jpeg' : $fileExtension));
            $rawContent = file_get_contents($dest_path);
            if ($rawContent !== false && strlen($rawContent) > 0) {
                $image_path = 'data:' . $mimeType . ';base64,' . base64_encode($rawContent);
            } else {
                $image_path = 'uploads/jobs/' . $newFileName;
            }
        } else {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "There was an error moving the uploaded file."]);
            exit();
        }
    } else {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Upload failed. Allowed file types: " . implode(',', $allowedfileExtensions)]);
        exit();
    }
}
try {
    $stmt = $pdo->prepare("INSERT INTO jobs_tbl (title, description, requirements, salary, employment_type, availability, status, image_path, category, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$title, $description, $requirements, $salary, $employment_type, $availability, $status, $image_path, $category, $location]);
    $newJobId = (int)$pdo->lastInsertId();

    require_once '../audit_helper.php';
    // Identity strictly extracted from verified JWT token
    $actorId = (int)$admin['sub'];
    $actorName = trim(($admin['first_name'] ?? '') . ' ' . ($admin['last_name'] ?? '')) ?: 'Admin';
    log_system_audit(
        $pdo,
        $actorId,
        $actorName,
        'Job Creation',
        'Jobs Module',
        "Posted new job vacancy: Title=\"{$title}\", Category=\"{$category}\", Location=\"{$location}\", Openings={$availability}, Status={$status}.",
        'Info'
    );

    echo json_encode(["status" => "success", "message" => "Job added successfully.", "job_id" => $newJobId]);
} catch (PDOException $e) {
    error_log("[Add Job Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal system error occurred while creating the job vacancy."]);
}
?>
