<?php
require_once '../db.php';
require_once __DIR__ . '/../auth/auth_guard.php';
header('Content-Type: application/json');

// ── AUTHENTICATION: Admin required ──────────────────────────────────────────
$admin = require_admin();
$actorId = (int)$admin['sub'];
$actorName = trim(($admin['first_name'] ?? '') . ' ' . ($admin['last_name'] ?? '')) ?: 'Admin';

$id           = intval($_POST['id'] ?? ($_POST['job_id'] ?? 0));
$title        = trim($_POST['title']        ?? '');
$description  = trim($_POST['description']  ?? '');
$requirements = trim($_POST['requirements'] ?? '');
$availability = intval($_POST['availability'] ?? 1);
$status       = trim($_POST['status'] ?? 'Active');
$category     = trim($_POST['category'] ?? 'Operations');
$location     = trim($_POST['location'] ?? 'Airship Express HQ');
if (empty($location)) $location = 'Airship Express HQ';
$salary       = trim($_POST['salary'] ?? '');
$employment_type = trim($_POST['employment_type'] ?? 'Full Time');
if (empty($employment_type)) $employment_type = 'Full Time';
$is_hidden    = isset($_POST['is_hidden']) ? (intval($_POST['is_hidden']) ? 1 : 0) : null;

if ($availability <= 0) {
    $status = 'Closed';
} else if ($availability > 0 && $status === 'Closed') {
    $status = 'Active';
}

if (!$id || !$title || !$requirements) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "ID, Title, and requirements are required."]);
    exit();
}

$image_path = null;
$update_image_sql = "";

if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
    $fileTmpPath = $_FILES['image']['tmp_name'];
    $fileName    = $_FILES['image']['name'];
    $fileNameCmps = explode(".", $fileName);
    $fileExtension = strtolower(end($fileNameCmps));
    $allowedfileExtensions = array('jpg', 'jpeg', 'png', 'webp');
    if (in_array($fileExtension, $allowedfileExtensions)) {
        $uploadFileDir = '../uploads/jobs/';
        if (!is_dir($uploadFileDir)) mkdir($uploadFileDir, 0755, true);
        $newFileName = md5(time() . $fileName) . '.' . $fileExtension;
        $dest_path   = $uploadFileDir . $newFileName;
        if (move_uploaded_file($fileTmpPath, $dest_path)) {
            // Encode as persistent Base64 Data URL so images survive cloud container restarts
            $mimeType = mime_content_type($dest_path) ?: ('image/' . ($fileExtension === 'jpg' ? 'jpeg' : $fileExtension));
            $rawContent = file_get_contents($dest_path);
            if ($rawContent !== false && strlen($rawContent) > 0) {
                $image_path = 'data:' . $mimeType . ';base64,' . base64_encode($rawContent);
            } else {
                $image_path = 'uploads/jobs/' . $newFileName;
            }
            $update_image_sql = ", image_path = ?";
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

// ── Utility: split a text block into non-empty trimmed lines ──────────────────
function splitLines(string $text): array {
    $lines = preg_split('/\r\n|\r|\n/', $text);
    return array_values(array_filter(array_map('trim', $lines), fn($l) => $l !== ''));
}

// ── Utility: generate a detailed human-readable diff for a text block field ──
function textBlockDiff(string $label, string $oldText, string $newText): array {
    if ($oldText === $newText) return [];

    $oldLines = splitLines($oldText);
    $newLines = splitLines($newText);

    $added   = array_diff($newLines, $oldLines);
    $removed = array_diff($oldLines, $newLines);

    $messages = [];

    if (count($added) > 0 && count($removed) > 0 && count($added) === count($removed)) {
        $addedReindexed   = array_values($added);
        $removedReindexed = array_values($removed);
        for ($i = 0; $i < count($addedReindexed); $i++) {
            $messages[] = "Modified {$label} from \"{$removedReindexed[$i]}\" to \"{$addedReindexed[$i]}\".";
        }
    } else {
        foreach ($removed as $line) {
            $messages[] = "Removed {$label}: \"{$line}\".";
        }
        foreach ($added as $line) {
            $messages[] = "Added {$label}: \"{$line}\".";
        }
    }

    if (empty($messages)) {
        $messages[] = "{$label} content was reorganized or reformatted.";
    }

    return $messages;
}

try {
    // Check for duplicate job posting title (excluding current job)
    $dupCheck = $pdo->prepare("SELECT COUNT(*) FROM jobs_tbl WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) AND job_id != ? AND is_archived = 0");
    $dupCheck->execute([$title, $id]);
    if ($dupCheck->fetchColumn() > 0) {
        http_response_code(400);
        echo json_encode([
            "status"  => "error",
            "message" => "Duplicate Job Posting Error: A job posting with the title \"{$title}\" already exists."
        ]);
        exit();
    }

    // Fetch ALL previous job fields for detailed diff
    $prevStmt = $pdo->prepare("SELECT title, description, requirements, salary, employment_type, availability, status, is_hidden, category, location FROM jobs_tbl WHERE job_id = ?");
    $prevStmt->execute([$id]);
    $prevJob  = $prevStmt->fetch(PDO::FETCH_ASSOC);

    $prevTitle        = $prevJob['title']           ?? $title;
    $prevDescription  = $prevJob['description']     ?? $description;
    $prevRequirements = $prevJob['requirements']    ?? $requirements;
    $prevSalary       = $prevJob['salary']          ?? $salary;
    $prevEmpType      = $prevJob['employment_type'] ?? $employment_type;
    $prevAvail        = $prevJob['availability']    ?? $availability;
    $prevStatus       = $prevJob['status']          ?? $status;
    $prevCategory     = $prevJob['category']        ?? $category;
    $prevLocation     = $prevJob['location']        ?? $location;

    // Reset posting timestamp if reactivating a closed job
    $resetDateSql = "";
    if (strtoupper($prevStatus) === 'CLOSED' || (int)$prevAvail <= 0) {
        if ($availability > 0 && strtoupper($status) === 'ACTIVE') {
            $resetDateSql = ", created_at = NOW()";
        }
    }

    $hiddenSql = ($is_hidden !== null) ? ", is_hidden = {$is_hidden}" : "";

    // Perform the update
    if ($image_path) {
        $stmt = $pdo->prepare("UPDATE jobs_tbl SET title = ?, description = ?, requirements = ?, salary = ?, employment_type = ?, availability = ?, status = ?, category = ?, location = ? {$hiddenSql} {$resetDateSql} {$update_image_sql} WHERE job_id = ?");
        $stmt->execute([$title, $description, $requirements, $salary, $employment_type, $availability, $status, $category, $location, $image_path, $id]);
    } else {
        $stmt = $pdo->prepare("UPDATE jobs_tbl SET title = ?, description = ?, requirements = ?, salary = ?, employment_type = ?, availability = ?, status = ?, category = ?, location = ? {$hiddenSql} {$resetDateSql} WHERE job_id = ?");
        $stmt->execute([$title, $description, $requirements, $salary, $employment_type, $availability, $status, $category, $location, $id]);
    }

    // Archive candidates if closing
    $archivedCount = 0;
    if ($status === 'Closed' || $availability <= 0) {
        $archiveStmt = $pdo->prepare("
            UPDATE applications_tbl 
            SET is_archived = 1 
            WHERE job_id = :jid 
            AND status IN ('HIRED', 'Hired', 'hired', 'PASSED', 'HIRED / PASSED', 'rejected', 'REJECTED', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED', 'DECLINED - UNRESPONSIVE', 'SCHEDULING EXPIRED', 'SCHEDULING_EXPIRED', 'Scheduling Expired', 'UNRESPONSIVE')
        ");
        $archiveStmt->execute(['jid' => $id]);
        $archivedCount = $archiveStmt->rowCount();
    }

    // Audit log
    require_once '../audit_helper.php';
    $actorId   = intval($_POST['actor_id']   ?? 0);
    $actorName = trim($_POST['actor_name']   ?? 'Admin');

    $changeLines = [];

    if ($prevTitle !== $title) {
        $changeLines[] = "Renamed title from \"{$prevTitle}\" to \"{$title}\".";
    }

    if ((string)$prevAvail !== (string)$availability) {
        $changeLines[] = "Updated available openings from {$prevAvail} to {$availability}.";
    }

    if ($prevStatus !== $status) {
        $changeLines[] = "Changed status from \"{$prevStatus}\" to \"{$status}\".";
    }

    if ($prevCategory !== $category) {
        $changeLines[] = "Changed category from \"{$prevCategory}\" to \"{$category}\".";
    }

    if ($prevLocation !== $location) {
        $changeLines[] = "Updated location from \"{$prevLocation}\" to \"{$location}\".";
    }

    $reqChanges = textBlockDiff('requirement', $prevRequirements, $requirements);
    foreach ($reqChanges as $msg) $changeLines[] = $msg;

    $descChanges = textBlockDiff('description line', $prevDescription, $description);
    foreach ($descChanges as $msg) $changeLines[] = $msg;

    if ($image_path) {
        $changeLines[] = "Updated job image/banner.";
    }

    if ($is_hidden !== null && isset($prevJob['is_hidden']) && (int)$prevJob['is_hidden'] !== $is_hidden) {
        $changeLines[] = $is_hidden === 1 ? "Paused intake (hid job from public)." : "Resumed intake (unhid job).";
    }

    if (empty($changeLines)) {
        $changeLines[] = "No detectable content changes.";
    }

    $jobLabel = "\"{$title}\"";
    if ($status === 'Closed') {
        $closingNote = $archivedCount > 0 ? " Auto-archived {$archivedCount} candidate application(s)." : "";
        $auditMsg    = "Closed job vacancy {$jobLabel}.{$closingNote} " . implode(' ', $changeLines);
        $auditCat    = 'Candidate Archiving';
        $severity    = 'Warning';
    } else {
        $auditMsg = "Updated job vacancy {$jobLabel}. " . implode(' ', $changeLines);
        $auditCat = 'Job Update';
        $severity = 'Info';
    }

    log_system_audit($pdo, $actorId, $actorName, $auditCat, 'Jobs Module', $auditMsg, $severity);

    echo json_encode(["status" => "success", "message" => "Job updated successfully." . ($archivedCount > 0 ? " Auto-archived {$archivedCount} candidate(s)." : "")]);

} catch (PDOException $e) {
    error_log("[Update Job Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal system error occurred while updating the job vacancy."]);
}
?>
