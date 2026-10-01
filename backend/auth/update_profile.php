<?php
require_once '../db.php';
header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$userId        = intval($data['user_id'] ?? ($data['id'] ?? 0));
$firstName     = trim($data['first_name'] ?? ($data['User_Fname'] ?? ''));
$middleInitial = strtoupper(trim(str_replace('.', '', $data['middle_initial'] ?? ($data['User_MInitial'] ?? ''))));
$middleInitial = ($middleInitial !== '') ? mb_substr($middleInitial, 0, 1) : '';
$lastName      = trim($data['last_name']  ?? ($data['User_Lname'] ?? ''));

if (!$userId || empty($firstName) || empty($lastName)) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "User ID, First Name, and Last Name are required."
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
    $checkStmt = $pdo->prepare("SELECT user_id, User_Fname, User_MInitial, User_Lname, User_Email, is_admin, status FROM users_tbl WHERE user_id = ?");
    $checkStmt->execute([$userId]);
    $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if (!$existing) {
        http_response_code(404);
        echo json_encode([
            "status"  => "error",
            "message" => "User account not found."
        ]);
        exit();
    }

    // Check if applicant has any active applications in progress
    if (intval($existing['is_admin'] ?? 0) === 0) {
        $activeCheck = $pdo->prepare("
            SELECT COUNT(*) FROM applications_tbl 
            WHERE user_id = ? AND is_archived = 0 
              AND LOWER(status) NOT IN ('hired', 'screening_rejected', 'rejected', 'failed pre-employment', 'failed_pre_employment', 'candidate withdrew', 'candidate_withdrew', 'archived')
        ");
        $activeCheck->execute([$userId]);
        $hasActiveApp = intval($activeCheck->fetchColumn()) > 0;

        $existingMi = strtoupper(trim(str_replace('.', '', $existing['User_MInitial'] ?? '')));
        if ($hasActiveApp && ($firstName !== $existing['User_Fname'] || $lastName !== $existing['User_Lname'] || $middleInitial !== $existingMi)) {
            http_response_code(403);
            echo json_encode([
                "status"  => "error",
                "message" => "Name editing is locked while you have an active application in progress."
            ]);
            exit();
        }
    }

    $updateStmt = $pdo->prepare("UPDATE users_tbl SET User_Fname = ?, User_MInitial = ?, User_Lname = ?, name_updated_at = NOW() WHERE user_id = ?");
    $updateStmt->execute([$firstName, $middleInitial ?: null, $lastName, $userId]);

    echo json_encode([
        "status"  => "success",
        "message" => "Profile updated successfully.",
        "user"    => [
            "id"             => (int)$existing['user_id'],
            "user_id"        => (int)$existing['user_id'],
            "first_name"     => $firstName,
            "middle_initial" => $middleInitial,
            "User_MInitial"  => $middleInitial,
            "last_name"      => $lastName,
            "User_Fname"     => $firstName,
            "User_Lname"     => $lastName,
            "email"          => $existing['User_Email'],
            "User_Email"     => $existing['User_Email'],
            "is_admin"       => (int)$existing['is_admin'],
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status"  => "error",
        "message" => "Database error: " . $e->getMessage()
    ]);
}
?>
