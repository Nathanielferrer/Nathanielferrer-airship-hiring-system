<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../rate_limit.php';

header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "status"  => "error",
        "message" => "Method not allowed. POST required."
    ]);
    exit();
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

$userId        = intval($data['user_id'] ?? ($data['id'] ?? 0));
$password      = $data['password'] ?? '';
$confirmPhrase = trim($data['confirm_phrase'] ?? ($data['confirmPhrase'] ?? ''));

// 1. Basic validation
if ($userId <= 0 || empty($password) || empty($confirmPhrase)) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "User ID, current password, and confirmation phrase are required."
    ]);
    exit();
}

if (strtoupper($confirmPhrase) !== 'DELETE') {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => 'You must type "DELETE" exactly to confirm account deletion.'
    ]);
    exit();
}

// 2. Rate limiting: Max 5 attempts per 15 minutes per user
check_rate_limit($pdo, 'delete_account', 5, 15, 'user_id', $userId, true);

try {
    // 3. Fetch user details and enforce security guards
    $userStmt = $pdo->prepare("
        SELECT user_id, User_Pass, is_admin, User_Email, status 
        FROM users_tbl 
        WHERE user_id = ?
    ");
    $userStmt->execute([$userId]);
    $user = $userStmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode([
            "status"  => "error",
            "message" => "User account not found."
        ]);
        exit();
    }

    // Role guard: Only Applicants (is_admin = 0) can self-delete
    if (intval($user['is_admin']) !== 0) {
        http_response_code(403);
        echo json_encode([
            "status"  => "error",
            "message" => "Administrative accounts cannot be deleted through the applicant portal."
        ]);
        exit();
    }

    // Check if account already deleted
    if (strtolower($user['status'] ?? '') === 'deleted') {
        http_response_code(400);
        echo json_encode([
            "status"  => "error",
            "message" => "This account has already been deleted."
        ]);
        exit();
    }

    // Verify password
    if (!password_verify($password, $user['User_Pass'])) {
        http_response_code(401);
        echo json_encode([
            "status"  => "error",
            "message" => "Incorrect account password. Please check your password and try again."
        ]);
        exit();
    }

    // 4. Check for active applications
    // A candidate cannot delete their account while an application is actively being processed
    $terminalStatuses = [
        'hired', 'officially hired', 'officially_hired', 'officially hired & signed',
        'officially hired & requirements completed', 'completed requirements', 'completed_requirements',
        'contract signed & onboarded', 'contract_signed_and_onboarded', 'archived',
        'screening_rejected', 'screening rejected', 'rejected', 'failed interview', 'failed', 'interview_failed',
        'failed initial', 'failed_initial', 'failed initial interview', 'failed_initial_interview',
        'failed final', 'failed_final', 'failed final interview', 'failed_final_interview',
        'failed final approval', 'failed_final_approval',
        'failed pre-employment', 'failed_pre_employment', 'incomplete requirements', 'incomplete_requirements',
        'candidate withdrew', 'candidate_withdrew', 'withdrawn', 'withdraw',
        'offer declined', 'offer_declined', 'job offer declined', 'job_offer_declined', 'declined',
        'offer expired', 'offer_expired', 'scheduling expired', 'scheduling_expired',
        'declined - unresponsive', 'declined_unresponsive', 'unresponsive',
        'candidate no show', 'candidate_no_show', 'no show', 'no_show'
    ];

    $appStmt = $pdo->prepare("
        SELECT a.application_id, a.status, j.title AS job_title
        FROM applications_tbl a
        LEFT JOIN jobs_tbl j ON a.job_id = j.job_id
        WHERE a.user_id = ?
    ");
    $appStmt->execute([$userId]);
    $applications = $appStmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($applications as $app) {
        $st = strtolower(trim($app['status'] ?? ''));
        if (!in_array($st, $terminalStatuses, true)) {
            $jobTitle = $app['job_title'] ?: 'an active position';
            http_response_code(409);
            echo json_encode([
                "status"  => "error",
                "code"    => "ACTIVE_APPLICATION_EXISTS",
                "message" => "Cannot delete account: You have an active application in progress for \"{$jobTitle}\" (Status: " . htmlspecialchars($app['status']) . "). Please withdraw your application from the Application Status page first."
            ]);
            exit();
        }
    }

    // 5. Begin Atomic Transaction for Soft Delete & Anonymization
    $pdo->beginTransaction();

    $backendDir = dirname(__DIR__);

    // Step A: Safely unlink physical resume files from server disk
    $resumeStmt = $pdo->prepare("SELECT resume_path FROM applications_tbl WHERE user_id = ?");
    $resumeStmt->execute([$userId]);
    $resumes = $resumeStmt->fetchAll(PDO::FETCH_COLUMN);

    foreach ($resumes as $path) {
        if (!empty($path) && $path !== '[DELETED]') {
            $candidates = [
                $path,
                $backendDir . '/' . ltrim($path, '/\\'),
                $backendDir . '/../' . ltrim($path, '/\\')
            ];
            foreach ($candidates as $cand) {
                if (file_exists($cand) && is_file($cand)) {
                    @unlink($cand);
                    break;
                }
            }
        }
    }

    // Step B: Free any reserved interview slots linked to this candidate's applications
    $freeSlotsStmt = $pdo->prepare("
        UPDATE interview_slots_tbl 
        SET status = 'Open', application_id = NULL 
        WHERE application_id IN (SELECT application_id FROM applications_tbl WHERE user_id = ?)
    ");
    $freeSlotsStmt->execute([$userId]);

    // Step C: Anonymize user profile in users_tbl
    // Change email to release the UNIQUE constraint for any future re-application
    $timestamp       = time();
    $anonymizedEmail = 'deleted_' . $userId . '_' . $timestamp . '@anonymized.local';
    $scrambledPass   = 'DELETED_' . bin2hex(random_bytes(16));
    $anonymizedLname = 'Applicant #' . $userId;

    $anonymizeUserStmt = $pdo->prepare("
        UPDATE users_tbl SET
            User_Fname             = 'Anonymized',
            User_MInitial          = NULL,
            User_Lname             = :anonymized_lname,
            User_Email             = :anonymized_email,
            User_Mobile            = NULL,
            User_Pass              = :scrambled_pass,
            User_Bday              = '1970-01-01',
            User_Gender            = 'Other',
            status                 = 'Deleted',
            verification_token     = NULL,
            verification_code      = NULL,
            reset_token            = NULL,
            reset_expires          = NULL,
            setup_token            = NULL,
            setup_token_expires    = NULL,
            pending_email          = NULL,
            pending_email_token    = NULL,
            pending_email_expires  = NULL
        WHERE user_id = :user_id
    ");
    $anonymizeUserStmt->execute([
        'anonymized_lname' => $anonymizedLname,
        'anonymized_email' => $anonymizedEmail,
        'scrambled_pass'   => $scrambledPass,
        'user_id'          => $userId
    ]);

    // Step D: Anonymize candidate applications in applications_tbl
    // Preserve status and audit trail for Master List / Application Audit Records, but scrub PII
    $anonymizeAppsStmt = $pdo->prepare("
        UPDATE applications_tbl SET
            candidate_name   = :candidate_name,
            candidate_email  = NULL,
            candidate_mobile = NULL,
            resume_path      = '[DELETED]'
        WHERE user_id = :user_id
    ");
    $anonymizeAppsStmt->execute([
        'candidate_name' => 'Anonymized Applicant #' . $userId,
        'user_id'        => $userId
    ]);

    // Step F: Purge candidate's personal notifications and chatbot chat history
    $delNotifsStmt = $pdo->prepare("DELETE FROM notifications_tbl WHERE user_id = ?");
    $delNotifsStmt->execute([$userId]);

    $delChatStmt = $pdo->prepare("DELETE FROM chatbot_history_tbl WHERE user_id = ?");
    $delChatStmt->execute([$userId]);

    $pdo->commit();

    echo json_encode([
        "status"  => "success",
        "message" => "Your account and personal data have been successfully deleted."
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Account Deletion Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "status"  => "error",
        "message" => "A server error occurred while processing account deletion. Please try again later."
    ]);
}
