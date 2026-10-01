<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../audit_helper.php';

header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$applicationId = intval($data['application_id'] ?? 0);
$userId        = intval($data['user_id'] ?? 0);
$action        = trim($data['action'] ?? ''); // 'accept' | 'decline'
$reason        = trim($data['reason'] ?? '');

if (!$applicationId || !in_array($action, ['accept', 'decline'])) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Valid application ID and action ('accept' or 'decline') are required."]);
    exit();
}

if ($action === 'decline' && empty($reason)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Please select or provide a reason for declining the job offer."]);
    exit();
}

try {
    // 1. Fetch application record
    $stmt = $pdo->prepare("
        SELECT 
            a.application_id, 
            a.user_id, 
            a.job_id,
            a.candidate_name, 
            a.candidate_email, 
            a.status,
            a.job_offer_details,
            j.title AS job_title,
            u.User_Fname, 
            u.User_Lname
        FROM applications_tbl a
        LEFT JOIN jobs_tbl j ON j.job_id = a.job_id
        LEFT JOIN users_tbl u ON u.user_id = a.user_id
        WHERE a.application_id = ?
    ");
    $stmt->execute([$applicationId]);
    $app = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$app) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Application record not found."]);
        exit();
    }

    $candidateName = trim($app['candidate_name'] ?? '') ?: trim(($app['User_Fname'] ?? '') . ' ' . ($app['User_Lname'] ?? '')) ?: 'Candidate';
    $jobTitle      = trim($app['job_title'] ?? '') ?: 'Position';
    $userId        = intval($app['user_id'] ?? 0) ?: $userId;
    $offerData     = [];
    if (!empty($app['job_offer_details'])) {
        $offerData = json_decode($app['job_offer_details'], true) ?: [];
    }

    // Expiration check guard
    if (!empty($offerData['offer_expires_at']) && strtotime($offerData['offer_expires_at']) < time()) {
        $offerData['status']     = 'Offer Expired';
        $offerData['expired_at'] = date('Y-m-d H:i:s');
        $upExpired = $pdo->prepare("
            UPDATE applications_tbl 
            SET status = 'Offer Expired', is_archived = 1, job_offer_details = ?, updated_at = NOW() 
            WHERE application_id = ?
        ");
        $upExpired->execute([json_encode($offerData), $applicationId]);

        http_response_code(410);
        echo json_encode([
            "status"  => "error",
            "message" => "This official job offer expired on " . date('M j, Y, g:i A', strtotime($offerData['offer_expires_at'])) . " and can no longer be accepted."
        ]);
        exit();
    }

    if ($action === 'accept') {
        $offerData['status']       = 'Accepted';
        $offerData['responded_at'] = date('Y-m-d H:i:s');

        // Status 'Job Offer Accepted' automatically moves candidate to 'Contract Signing' tab
        $updateStmt = $pdo->prepare("
            UPDATE applications_tbl 
            SET 
                status = 'Job Offer Accepted', 
                job_offer_details = ?, 
                updated_at = NOW() 
            WHERE application_id = ?
        ");
        $updateStmt->execute([json_encode($offerData), $applicationId]);

        // In-app notification for candidate
        if ($userId > 0) {
            $notifStmt = $pdo->prepare("
                INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                VALUES (?, ?, 'Job Offer Confirmed 🎉', 'Thank you for accepting the official job offer for {$jobTitle}! Our HR department is currently preparing your official employment contract. You will be notified here as soon as your contract signing schedule is ready.', 'job_offer_accepted', '/application-status', 0, NOW())
            ");
            $notifStmt->execute([$userId, $applicationId]);
        }

        echo json_encode([
            "status"  => "success",
            "message" => "Job Offer accepted successfully! Your application has advanced to Contract Signing."
        ]);
    } else {
        // Decline flow
        $offerData['status']         = 'Declined';
        $offerData['decline_reason'] = $reason;
        $offerData['responded_at']   = date('Y-m-d H:i:s');

        $updateStmt = $pdo->prepare("
            UPDATE applications_tbl 
            SET 
                status = 'Offer Declined', 
                is_archived = 0,
                job_offer_details = ?, 
                updated_at = NOW() 
            WHERE application_id = ?
        ");
        $updateStmt->execute([json_encode($offerData), $applicationId]);

        // In-app notification for candidate
        if ($userId > 0) {
            $notifBody = "You have officially declined the job offer for this position. We appreciate the time and effort you invested during the hiring process with Airship Express. We wish you the best in your career endeavors, and you are always welcome to apply for future roles with us when you are ready.";
            $notifStmt = $pdo->prepare("
                INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                VALUES (?, ?, 'Job Offer Declined', ?, 'job_offer_declined', '/application-status', 0, NOW())
            ");
            $notifStmt->execute([$userId, $applicationId, $notifBody]);
        }

        // Check waitlist vs public reopening rule for this released slot
        $jobId = intval($app['job_id'] ?? 0);
        if ($jobId > 0) {
            require_once __DIR__ . '/slot_release_helper.php';
            handle_released_slot($pdo, $jobId, 'declined', $candidateName, $jobTitle);
        }

        echo json_encode([
            "status"  => "success",
            "message" => "Job offer response recorded. We appreciate your feedback and wish you the best in your career."
        ]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}
