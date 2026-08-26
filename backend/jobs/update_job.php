<?php
require_once '../db.php';
header('Content-Type: application/json');

$id           = intval($_POST['id'] ?? 0);
$title        = trim($_POST['title']        ?? '');
$description  = trim($_POST['description']  ?? '');
$requirements = trim($_POST['requirements'] ?? '');
$availability = intval($_POST['availability'] ?? 1);
$status       = trim($_POST['status'] ?? 'Active');

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
            $image_path = 'uploads/jobs/' . $newFileName;
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
// Returns an array of descriptive change sentences.
function textBlockDiff(string $label, string $oldText, string $newText): array {
    if ($oldText === $newText) return [];

    $oldLines = splitLines($oldText);
    $newLines = splitLines($newText);

    $added   = array_diff($newLines, $oldLines);  // in new but not in old
    $removed = array_diff($oldLines, $newLines);  // in old but not in new

    $messages = [];

    // If counts match and we have equal adds/removes, pair them as modifications
    if (count($added) > 0 && count($removed) > 0 && count($added) === count($removed)) {
        $addedReindexed   = array_values($added);
        $removedReindexed = array_values($removed);
        for ($i = 0; $i < count($addedReindexed); $i++) {
            $messages[] = "Modified {$label} from \"{$removedReindexed[$i]}\" to \"{$addedReindexed[$i]}\".";
        }
    } else {
        // Report removals first, then additions
        foreach ($removed as $line) {
            $messages[] = "Removed {$label}: \"{$line}\".";
        }
        foreach ($added as $line) {
            $messages[] = "Added {$label}: \"{$line}\".";
        }
    }

    // Fallback: if lines changed but diff is too complex (reorder etc), log a general note
    if (empty($messages)) {
        $messages[] = "{$label} content was reorganized or reformatted.";
    }

    return $messages;
}

try {
    // Fetch ALL previous job fields for detailed diff
    $prevStmt = $pdo->prepare("SELECT title, description, requirements, availability, status FROM jobs WHERE id = ?");
    $prevStmt->execute([$id]);
    $prevJob  = $prevStmt->fetch(PDO::FETCH_ASSOC);

    $prevTitle        = $prevJob['title']        ?? $title;
    $prevDescription  = $prevJob['description']  ?? $description;
    $prevRequirements = $prevJob['requirements'] ?? $requirements;
    $prevAvail        = $prevJob['availability'] ?? $availability;
    $prevStatus       = $prevJob['status']       ?? $status;

    // Perform the update
    if ($image_path) {
        $stmt = $pdo->prepare("UPDATE jobs SET title = ?, description = ?, requirements = ?, availability = ?, status = ? $update_image_sql WHERE id = ?");
        $stmt->execute([$title, $description, $requirements, $availability, $status, $image_path, $id]);
    } else {
        $stmt = $pdo->prepare("UPDATE jobs SET title = ?, description = ?, requirements = ?, availability = ?, status = ? WHERE id = ?");
        $stmt->execute([$title, $description, $requirements, $availability, $status, $id]);
    }

    // Archive candidates if closing
    $archivedCount = 0;
    if ($status === 'Closed' || $availability <= 0) {
        $archiveStmt = $pdo->prepare("
            UPDATE applications 
            SET is_archived = 1 
            WHERE job_id = :jid 
            AND status IN ('HIRED', 'Hired', 'hired', 'PASSED', 'HIRED / PASSED', 'rejected', 'REJECTED', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED', 'DECLINED - UNRESPONSIVE')
        ");
        $archiveStmt->execute(['jid' => $id]);
        $archivedCount = $archiveStmt->rowCount();
    }

    // ── Build granular audit messages ─────────────────────────────────────────
    require_once '../audit_helper.php';
    $actorId   = intval($_POST['actor_id']   ?? 0);
    $actorName = trim($_POST['actor_name']   ?? 'Admin');

    $changeLines = [];

    // 1. Title change
    if ($prevTitle !== $title) {
        $changeLines[] = "Renamed title from \"{$prevTitle}\" to \"{$title}\".";
    }

    // 2. Openings change
    if ((string)$prevAvail !== (string)$availability) {
        $changeLines[] = "Updated available openings from {$prevAvail} to {$availability}.";
    }

    // 3. Status change
    if ($prevStatus !== $status) {
        $changeLines[] = "Changed status from \"{$prevStatus}\" to \"{$status}\".";
    }

    // 4. Requirements — line-by-line diff (each bullet/line is tracked individually)
    $reqChanges = textBlockDiff('requirement', $prevRequirements, $requirements);
    foreach ($reqChanges as $msg) $changeLines[] = $msg;

    // 5. Description — line-by-line diff
    $descChanges = textBlockDiff('description line', $prevDescription, $description);
    foreach ($descChanges as $msg) $changeLines[] = $msg;

    // 6. Image
    if ($image_path) {
        $changeLines[] = "Updated job image/banner.";
    }

    // Format the final audit message
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
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
