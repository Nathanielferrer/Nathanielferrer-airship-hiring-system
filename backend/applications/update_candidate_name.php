<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../audit_helper.php';

header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$appId         = intval($data['application_id'] ?? 0);
$firstName     = trim($data['first_name'] ?? '');
$middleInitial = strtoupper(trim(str_replace('.', '', $data['middle_initial'] ?? ($data['User_MInitial'] ?? ''))));
$middleInitial = ($middleInitial !== '') ? mb_substr($middleInitial, 0, 1) : '';
$lastName      = trim($data['last_name'] ?? '');
$reason        = trim($data['reason'] ?? 'Typo correction');
$adminId       = intval($data['admin_id'] ?? 0);
$adminName     = trim($data['admin_name'] ?? 'Admin');

if ($appId <= 0 || empty($firstName) || empty($lastName)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Application ID, First Name, and Last Name are required."
    ]);
    exit();
}

// First name validation: 2 - 50 characters, letters, spaces, hyphen, apostrophe, period
if (mb_strlen($firstName) < 2 || mb_strlen($firstName) > 50 || !preg_match("/^[a-zA-Z\s\-'\.]+$/", $firstName)) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "First name must be between 2 and 50 characters and can only contain letters, spaces, hyphens, apostrophes, and periods."
    ]);
    exit();
}

// Last name validation: 2 - 50 characters, same rules as first name
if (mb_strlen($lastName) < 2 || mb_strlen($lastName) > 50 || !preg_match("/^[a-zA-Z\s\-'\.]+$/", $lastName)) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "Last name must be between 2 and 50 characters and can only contain letters, spaces, hyphens, apostrophes, and periods."
    ]);
    exit();
}

// Middle initial validation: optional, max 1 letter only
if ($middleInitial !== '' && !preg_match("/^[a-zA-Z]$/", $middleInitial)) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "Middle initial must be a single letter only."
    ]);
    exit();
}

try {
    // 1. Fetch current application & user info
    $stmt = $pdo->prepare("
        SELECT a.application_id, a.user_id, a.candidate_name, a.ai_summary, 
               u.User_Fname, u.User_MInitial, u.User_Lname, u.User_Email
        FROM applications_tbl a
        LEFT JOIN users_tbl u ON a.user_id = u.user_id
        WHERE a.application_id = ?
    ");
    $stmt->execute([$appId]);
    $app = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$app) {
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "Application record not found."
        ]);
        exit();
    }

    $existingMi = !empty($app['User_MInitial']) ? " {$app['User_MInitial']}. " : " ";
    $oldCandidateName = trim($app['candidate_name'] ?: trim("{$app['User_Fname']}{$existingMi}{$app['User_Lname']}"));
    $mPart = $middleInitial ? " {$middleInitial}. " : " ";
    $newCandidateName = trim("{$firstName}{$mPart}{$lastName}");
    $userId = intval($app['user_id'] ?? 0);

    // 2. Resolve discrepancy flags inside ai_summary JSON
    $aiSummaryJson = $app['ai_summary'];
    if (!empty($aiSummaryJson) && trim($aiSummaryJson)[0] === '{') {
        $aiData = json_decode($aiSummaryJson, true);
        if (is_array($aiData)) {
            $aiData['name_mismatch'] = false;
            $aiData['name_variation'] = false;
            if (isset($aiData['ranking_logic']['review_reason']) && str_contains(strtolower($aiData['ranking_logic']['review_reason']), 'name discrepancy')) {
                $aiData['ranking_logic']['review_reason'] = "Name verified by Admin ({$reason})";
            }
            $aiSummaryJson = json_encode($aiData, JSON_UNESCAPED_UNICODE);
        }
    }

    // 3. Update applications_tbl
    $updApp = $pdo->prepare("
        UPDATE applications_tbl 
        SET candidate_name = :cand_name,
            ai_summary = :ai_summary,
            updated_at = NOW()
        WHERE application_id = :app_id
    ");
    $updApp->execute([
        'cand_name'   => $newCandidateName,
        'ai_summary'  => $aiSummaryJson,
        'app_id'      => $appId
    ]);

    // 4. Update users_tbl if linked user exists
    if ($userId > 0) {
        $updUser = $pdo->prepare("
            UPDATE users_tbl 
            SET User_Fname = :fname,
                User_MInitial = :minitial,
                User_Lname = :lname,
                name_updated_at = NOW()
            WHERE user_id = :uid
        ");
        $updUser->execute([
            'fname'    => $firstName,
            'minitial' => $middleInitial ?: null,
            'lname'    => $lastName,
            'uid'      => $userId
        ]);
    }

    // 5. Audit Logging (Only logs for HR Admin; SuperAdmin root actions bypass audit helper cleanly)
    log_system_audit(
        $pdo,
        $adminId,
        $adminName,
        'APPLICATION_MANAGEMENT',
        'Applicants',
        "Corrected candidate name for Application #{$appId} from '{$oldCandidateName}' to '{$newCandidateName}'. Reason: {$reason}"
    );

    echo json_encode([
        "status" => "success",
        "message" => "Candidate name updated successfully to {$newCandidateName}.",
        "updated_name" => $newCandidateName,
        "first_name" => $firstName,
        "last_name" => $lastName,
        "ai_summary" => $aiSummaryJson
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database error: " . $e->getMessage()
    ]);
}
