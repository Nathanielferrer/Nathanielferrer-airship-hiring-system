<?php
require_once '../db.php';
header('Content-Type: application/json');

$title = trim($_POST['title'] ?? '');
$description = trim($_POST['description'] ?? '');
$requirements = trim($_POST['requirements'] ?? '');
$availability = intval($_POST['availability'] ?? 1);
$status = trim($_POST['status'] ?? 'Active');

if (!$title || !$requirements) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Title and requirements are required."]);
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
            $image_path = 'uploads/jobs/' . $newFileName;
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
    $stmt = $pdo->prepare("INSERT INTO jobs (title, description, requirements, availability, status, image_path) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$title, $description, $requirements, $availability, $status, $image_path]);
    $newJobId = (int)$pdo->lastInsertId();

    require_once '../audit_helper.php';
    $actorId = intval($_POST['actor_id'] ?? 0);
    $actorName = trim($_POST['actor_name'] ?? 'Admin');
    log_system_audit(
        $pdo,
        $actorId,
        $actorName,
        'Job Creation',
        'Jobs Module',
        "Posted new job vacancy: Title=\"{$title}\", Openings={$availability}, Status={$status}.",
        'Info'
    );

    echo json_encode(["status" => "success", "message" => "Job added successfully."]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
