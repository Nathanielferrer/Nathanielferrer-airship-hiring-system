<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../audit_helper.php';
require_once __DIR__ . '/../email_helper.php';
require_once __DIR__ . '/../auth/auth_guard.php';

header('Content-Type: application/json');

// ── AUTHENTICATION: Admin / Super Admin required ─────────────────────────────
$admin = require_admin();

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$applicationId     = intval($data['application_id'] ?? 0);
$salary            = trim($data['salary'] ?? '₱25,000.00 / month');
$employmentType    = trim($data['employment_type'] ?? 'Full-Time');
$department        = trim($data['department'] ?? 'Operations & Logistics Department');
$specialProvisions = trim($data['special_provisions'] ?? '');
$offerExpiresAt    = trim($data['offer_expires_at'] ?? '');
// Identity strictly extracted from verified JWT token
$actorId           = (int)$admin['sub'];
$actorName         = trim(($admin['first_name'] ?? '') . ' ' . ($admin['last_name'] ?? '')) ?: 'Super Admin';

if (!$offerExpiresAt) {
    // Default 3 business days at 8:00 AM
    $offerExpiresAt = date('Y-m-d 08:00:00', strtotime('+3 days'));
}

$expTimestamp = strtotime($offerExpiresAt);
if (!$expTimestamp || $expTimestamp <= time()) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Offer Expiration Date & Time must be set to a future date and time."]);
    exit();
}

$dayOfWeek = date('w', $expTimestamp);
if ($dayOfWeek == 0 || $dayOfWeek == 6) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Weekends are disabled. Please select a weekday (Monday to Friday)."]);
    exit();
}

$timeStr = date('H:i', $expTimestamp);
if ($timeStr < '08:00' || $timeStr > '17:00') {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Offer expiration must be scheduled between 8:00 AM and 5:00 PM only."]);
    exit();
}

if (!$applicationId) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Application ID is required."]);
    exit();
}

try {
    // 1. Fetch candidate and job info
    $stmt = $pdo->prepare("
        SELECT 
            a.application_id, 
            a.user_id, 
            a.candidate_name, 
            a.candidate_email, 
            a.status,
            j.title AS job_title,
            u.User_Fname, 
            u.User_Lname, 
            u.User_Email
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

    $candidateName  = trim($app['candidate_name'] ?? '') ?: trim(($app['User_Fname'] ?? '') . ' ' . ($app['User_Lname'] ?? '')) ?: 'Candidate';
    $candidateEmail = trim($app['candidate_email'] ?? '') ?: trim($app['User_Email'] ?? '');
    $userId         = intval($app['user_id'] ?? 0);
    $jobTitle       = trim($app['job_title'] ?? '') ?: 'Position';

    // 2. Prepare JSON offer details
    $formattedExpiry = date('M j, Y, g:i A', strtotime($offerExpiresAt));
    $offerDetails = [
        'salary'             => $salary,
        'employment_type'    => $employmentType,
        'department'         => $department,
        'special_provisions' => $specialProvisions,
        'offer_expires_at'   => $offerExpiresAt,
        'sent_at'            => date('Y-m-d H:i:s'),
        'status'             => 'Pending Candidate Acceptance'
    ];

    // 3. Update application status to Job Offer Pending
    $updateStmt = $pdo->prepare("
        UPDATE applications_tbl 
        SET 
            status = 'Job Offer Pending', 
            job_offer_details = ?, 
            updated_at = NOW() 
        WHERE application_id = ?
    ");
    $updateStmt->execute([json_encode($offerDetails), $applicationId]);

    // 4. Send In-App Notification
    if ($userId > 0) {
        $notifTitle = "Official Job Offer Letter Extended 📜";
        $notifMsg   = "Congratulations, {$candidateName}! Airship Express has extended an official employment offer for {$jobTitle}. Please view your offer letter and confirm before {$formattedExpiry}.";
        $notifStmt  = $pdo->prepare("
            INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
            VALUES (?, ?, ?, ?, 'job_offer', '/application-status', 0, NOW())
        ");
        $notifStmt->execute([$userId, $applicationId, $notifTitle, $notifMsg]);
    }

    // 5. Send Branded Email with direct PDF Link
    $pdfUrl = get_backend_url() . "/super_admin/generate_job_offer_pdf.php?application_id=" . $applicationId;
    $portalUrl = get_frontend_url() . "/application-status";
    
    if (!empty($candidateEmail) && filter_var($candidateEmail, FILTER_VALIDATE_EMAIL)) {
        try {
            $mail = new PHPMailer\PHPMailer\PHPMailer(true);
            configure_smtp($mail, 'Airship Express Recruitment');
            $mail->addAddress($candidateEmail, $candidateName);
            $mail->isHTML(true);
            $mail->Subject = "Official Employment Job Offer - Airship Express ({$jobTitle})";

            $mail->Body = "
            <div style='font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #1e293b;'>
                <div style='max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;'>
                    <div style='text-align: center; margin-bottom: 24px;'>
                        <h2 style='color: #e6007e; margin: 0; font-size: 22px; font-weight: 800;'>AIRSHIP EXPRESS</h2>
                        <p style='color: #64748b; font-size: 13px; margin-top: 4px;'>Official Employment Job Offer</p>
                    </div>
                    <p style='font-size: 14px;'>Dear <strong>{$candidateName}</strong>,</p>
                    <p style='font-size: 14px; line-height: 1.6;'>
                        Following the successful evaluation of your application and President's final approval, Airship Express is pleased to extend you an official Job Offer for the position of <strong>{$jobTitle}</strong>!
                    </p>
                    <div style='background: #fdf2f8; border-left: 4px solid #e6007e; padding: 16px; border-radius: 6px; margin: 20px 0;'>
                        <p style='margin: 0 0 6px 0; font-size: 13px;'><strong>Position:</strong> {$jobTitle}</p>
                        <p style='margin: 0 0 6px 0; font-size: 13px;'><strong>Employment Status:</strong> {$employmentType}</p>
                        <p style='margin: 0 0 6px 0; font-size: 13px;'><strong>Department:</strong> {$department}</p>
                        <p style='margin: 0 0 6px 0; font-size: 13px; color: #059669;'><strong>Monthly Compensation:</strong> {$salary}</p>
                        <p style='margin: 0; font-size: 13px; color: #dc2626; font-weight: bold;'><strong>Offer Expiration Deadline:</strong> {$formattedExpiry}</p>
                    </div>
                    <div style='text-align: center; margin: 28px 0;'>
                        <a href='{$pdfUrl}' target='_blank' style='display: inline-block; background: #e6007e; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: bold; text-decoration: none; font-size: 14px;'>
                            View / Download Official Offer Letter (PDF)
                        </a>
                    </div>
                    <p style='font-size: 13px; color: #475569;'>
                        Please log into your <a href='{$portalUrl}' style='color: #e6007e; font-weight: bold;'>Applicant Portal</a> to review the terms and confirm your job offer acceptance before <strong>{$formattedExpiry}</strong>.
                    </p>
                    <p style='font-size: 12px; color: #64748b; margin-top: 10px;'>Portal URL: <span style='color: #e6007e;'>{$portalUrl}</span></p>
                    <hr style='border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;'>
                    <p style='font-size: 11px; color: #94a3b8; text-align: center;'>Airship Express Logistics & Supply Chain Solutions Philippines</p>
                </div>
            </div>";

            send_email($candidateEmail, $candidateName, $mail->Subject, $mail->Body, '', 'Airship Express Executive Recruitment');
        } catch (\Throwable $e) {
            error_log("Failed to send Job Offer email: " . $e->getMessage());
        }
    }

    // 6. Audit Logging
    $auditMsg = "Official Job Offer Letter generated & sent to \"{$candidateName}\" for \"{$jobTitle}\". Salary: {$salary}, Type: {$employmentType}, Expiry: {$formattedExpiry}. Status moved to 'Job Offer Pending'.";
    log_system_audit($pdo, $actorId, $actorName, 'Job Offer', 'Evaluation Pipeline', $auditMsg, 'Info');

    echo json_encode([
        "status"  => "success",
        "message" => "Official Job Offer Letter generated and sent successfully to {$candidateName}.",
        "pdf_url" => $pdfUrl
    ]);
} catch (Exception $e) {
    error_log("[Send Job Offer Error] " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "An internal error occurred while processing the job offer. Please try again."]);
}
