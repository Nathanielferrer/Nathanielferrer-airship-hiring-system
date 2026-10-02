<?php
/**
 * email_helper.php - Centralized Email Notification Helper
 *
 * Sends branded HTML emails to candidates via:
 *   1. Resend HTTPS API (when RESEND_API_KEY is set — for Railway/cloud)
 *   2. PHPMailer SMTP (fallback — for local XAMPP development)
 *
 * Recruitment stages supported:
 *   INITIAL_PASSED, INITIAL_REJECTED, FINAL_PASSED, FINAL_FAILED,
 *   PRESIDENT_APPROVED, PRESIDENT_REJECTED, SCHEDULING_EXPIRED
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/libs/PHPMailer/src/Exception.php';
require_once __DIR__ . '/libs/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/libs/PHPMailer/src/SMTP.php';
require_once __DIR__ . '/env_loader.php';

/**
 * Send an email via Resend HTTPS API (bypasses Railway's SMTP port blocking).
 *
 * @param string $toEmail   Recipient email.
 * @param string $toName    Recipient name.
 * @param string $subject   Email subject.
 * @param string $htmlBody  Full HTML body.
 * @param string $textBody  Optional plain text body.
 * @param string $fromName  Sender display name.
 * @return bool             True on success.
 */
function send_email_via_resend(
    string $toEmail,
    string $toName,
    string $subject,
    string $htmlBody,
    string $textBody = '',
    string $fromName = 'Airship Express Recruitment'
): bool {
    $apiKey = getenv('RESEND_API_KEY');
    if (!$apiKey) {
        error_log('[EmailHelper/Resend] RESEND_API_KEY not set');
        return false;
    }

    // Determine the "from" address: use verified Resend domain, or default onboarding address
    $fromEmail = getenv('RESEND_FROM_EMAIL') ?: 'Airship Express <onboarding@resend.dev>';

    // If RESEND_FROM_EMAIL is just an email, wrap it with the name
    if (!str_contains($fromEmail, '<')) {
        $fromEmail = "{$fromName} <{$fromEmail}>";
    }

    $payload = json_encode([
        'from'    => $fromEmail,
        'to'      => [$toEmail],
        'subject' => $subject,
        'html'    => $htmlBody,
    ]);

    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ],
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        error_log("[EmailHelper/Resend] cURL error sending to {$toEmail}: {$curlError}");
        return false;
    }

    if ($httpCode >= 200 && $httpCode < 300) {
        error_log("[EmailHelper/Resend] ✅ Email sent to {$toEmail} (HTTP {$httpCode})");
        return true;
    }

    error_log("[EmailHelper/Resend] ❌ Failed to send to {$toEmail} (HTTP {$httpCode}): {$response}");
    return false;
}

/**
 * Send an email via Brevo (Sendinblue) HTTPS API (bypasses Railway's SMTP port blocking).
 * Brevo allows 300 free emails/day to any recipient without domain verification.
 *
 * @param string $toEmail   Recipient email.
 * @param string $toName    Recipient name.
 * @param string $subject   Email subject.
 * @param string $htmlBody  Full HTML body.
 * @param string $textBody  Optional plain text body.
 * @param string $fromName  Sender display name.
 * @return bool             True on success.
 */
function send_email_via_brevo(
    string $toEmail,
    string $toName,
    string $subject,
    string $htmlBody,
    string $textBody = '',
    string $fromName = 'Airship Express Recruitment'
): bool {
    $apiKey = getenv('BREVO_API_KEY');
    if (!$apiKey) {
        error_log('[EmailHelper/Brevo] BREVO_API_KEY not set');
        return false;
    }

    $fromEmail = getenv('BREVO_FROM_EMAIL') ?: (getenv('SMTP_USER') ?: 'airship.express07@gmail.com');

    $payloadData = [
        'sender'      => ['name' => $fromName, 'email' => $fromEmail],
        'to'          => [['email' => $toEmail, 'name' => $toName]],
        'subject'     => $subject,
        'htmlContent' => $htmlBody,
        'textContent' => $textBody ?: strip_tags($htmlBody),
        'headers'     => [
            'X-Mailin-ClickTrack' => '0'
        ]
    ];
    $payload = json_encode($payloadData);

    $ch = curl_init('https://api.brevo.com/v3/smtp/email');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => [
            'api-key: ' . $apiKey,
            'Content-Type: application/json',
            'Accept: application/json'
        ],
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        error_log("[EmailHelper/Brevo] cURL error sending to {$toEmail}: {$curlError}");
        return false;
    }

    if ($httpCode >= 200 && $httpCode < 300) {
        error_log("[EmailHelper/Brevo] ✅ Email sent to {$toEmail} (HTTP {$httpCode})");
        return true;
    }

    error_log("[EmailHelper/Brevo] ❌ Failed to send to {$toEmail} (HTTP {$httpCode}): {$response}");
    return false;
}

/**
 * Unified email dispatcher: uses Resend or Brevo API if available, otherwise PHPMailer SMTP.
 *
 * @param string $toEmail   Recipient email.
 * @param string $toName    Recipient name.
 * @param string $subject   Email subject.
 * @param string $htmlBody  Full HTML body.
 * @param string $textBody  Optional plain text body.
 * @param string $fromName  Sender display name.
 * @return bool             True on success.
 */
function send_email(
    string $toEmail,
    string $toName,
    string $subject,
    string $htmlBody,
    string $textBody = '',
    string $fromName = 'Airship Express Recruitment'
): bool {
    // Route 1: Resend HTTPS API (Railway / cloud deployments)
    if (getenv('RESEND_API_KEY')) {
        $sent = send_email_via_resend($toEmail, $toName, $subject, $htmlBody, $textBody, $fromName);
        if ($sent) return true;
    }

    // Route 2: Brevo HTTPS API (Railway / cloud deployments)
    if (getenv('BREVO_API_KEY')) {
        $sent = send_email_via_brevo($toEmail, $toName, $subject, $htmlBody, $textBody, $fromName);
        if ($sent) return true;
    }

    // Route 2: PHPMailer SMTP (local XAMPP development)
    try {
        $mail = new PHPMailer(true);
        configure_smtp($mail, $fromName);
        $mail->addAddress($toEmail, $toName);
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $htmlBody;
        if ($textBody) {
            $mail->AltBody = $textBody;
        }
        $mail->send();
        error_log("[EmailHelper/SMTP] ✅ Email sent to {$toEmail}");
        return true;
    } catch (\Throwable $e) {
        error_log("[EmailHelper/SMTP] ❌ Failed to send to {$toEmail}: " . $e->getMessage());
        return false;
    }
}

/**
 * Configure a PHPMailer instance with SMTP credentials from .env.
 * Centralizes credential management so secrets are never duplicated inline.
 */
function configure_smtp(PHPMailer $mail, string $fromName = 'Airship Express Recruitment'): void {
    $mail->isSMTP();
    $mail->Host       = getenv('SMTP_HOST') ?: 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = getenv('SMTP_USER') ?: 'airship.express07@gmail.com';
    $mail->Password   = getenv('SMTP_PASS') ?: 'wqpb nije pcqz qwlc';
    $port             = (int)(getenv('SMTP_PORT') ?: 587);
    $mail->Port       = $port;
    if ($port === 465) {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    } else {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    }
    $mail->Timeout    = 10; // Prevent 300s timeout hang
    $mail->CharSet    = 'UTF-8';
    $mail->Encoding   = 'base64';
    $mail->setFrom($mail->Username, $fromName);
    $mail->SMTPOptions = [
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true
        ]
    ];
}

/**
 * Send a branded HTML status notification email to a candidate.
 *
 * @param string $toEmail     Candidate's email address.
 * @param string $toName      Candidate's full name.
 * @param string $jobTitle    Title of the job position.
 * @param string $statusType  One of: INITIAL_PASSED, INITIAL_REJECTED, FINAL_PASSED, FINAL_FAILED,
 *                            PRESIDENT_APPROVED, PRESIDENT_REJECTED, SCHEDULING_EXPIRED
 * @param string $remarks     Optional evaluator remarks/feedback.
 * @param array  $details     Optional extra details (e.g., ['deadline' => '...'])
 * @return bool               True if email sent successfully, false otherwise.
 */
function sendApplicationStatusEmail(
    string $toEmail,
    string $toName,
    string $jobTitle,
    string $statusType,
    string $remarks = '',
    array  $details = []
): bool {
    if (empty($toEmail) || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    try {
        $mail = new PHPMailer(true);
        configure_smtp($mail, 'Airship Express Recruitment');
        $mail->addAddress($toEmail, $toName);
        $mail->isHTML(true);

        $safeName     = htmlspecialchars($toName);
        $safeJobTitle = htmlspecialchars($jobTitle);
        $safeRemarks  = htmlspecialchars($remarks);

        // Build remarks HTML block (only if non-empty)
        $remarksBlock = '';
        if (!empty($remarks)) {
            $remarksBlock = "
                <div style='border: 1px solid #e2e8f0; padding: 14px 18px; border-radius: 8px; margin: 20px 0;'>
                    <p style='margin: 0 0 6px 0; font-size: 11.5px; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;'>Evaluator Remarks & Feedback</p>
                    <p style='margin: 0; font-size: 14px; color: #334155; line-height: 1.6; white-space: pre-line; font-style: italic;'>{$safeRemarks}</p>
                </div>
            ";
        }

        // Common template variables
        $subtitle = '';
        $statusBadge = '';
        $bodyContent = '';
        $ctaText = 'View Application Status';

        switch ($statusType) {
            case 'INITIAL_PASSED':
                $mail->Subject = "Application Update: Initial Interview Passed";
                $subtitle = 'Initial Interview Passed';
                $statusBadge = "<span style='background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;'>🎉 Initial Interview Passed</span>";
                $bodyContent = "
                    <p style='font-size: 14.5px; color: #334155; line-height: 1.6;'>
                        Congratulations! You have successfully passed the initial interview for the <strong>{$safeJobTitle}</strong> position at Airship Express.
                    </p>
                    <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                        Our recruitment team is currently organizing the calendar for the final interview stage. You will receive a notification shortly with the exact date and time of your assigned schedule.
                    </p>
                    <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                        Please log in to your applicant portal to check your real-time status.
                    </p>
                    {$remarksBlock}
                ";
                break;

            case 'INITIAL_REJECTED':
                $mail->Subject = "Application Update - {$safeJobTitle} | Airship Express";
                $subtitle = 'Initial Screening Update';
                $statusBadge = "<span style='background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;'>Application Closed</span>";
                $bodyContent = "
                    <p style='font-size: 14.5px; color: #334155; line-height: 1.6;'>
                        Thank you for your interest in the <strong>{$safeJobTitle}</strong> position at Airship Express and for taking the time to submit your application.
                    </p>
                    <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                        After careful review of all submissions against our current operational requirements, we regret to inform you that your application did not advance to the next stage at this time.
                    </p>
                    {$remarksBlock}
                    <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                        We encourage you to apply for future opportunities that align with your skillset. We sincerely wish you the best in your career.
                    </p>
                    <p style='font-size: 13px; color: #64748b; line-height: 1.6; border-top: 1px solid #e2e8f0; padding-top: 12px;'>
                        <strong>Re-application Policy:</strong> Re-applying for this role is available after a 6-month cooling period. You are welcome to explore and apply for other open positions anytime.
                    </p>
                ";
                break;

            case 'FINAL_PASSED':
                $mail->Subject = "Application Update: Final Interview Passed - {$safeJobTitle}";
                $subtitle = 'Final Interview Passed';
                $statusBadge = "<span style='background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;'>🎉 Final Interview Passed</span>";
                $bodyContent = "
                    <p style='font-size: 14.5px; color: #334155; line-height: 1.6; margin-top: 0;'>
                        Congratulations! You have successfully passed the final interview for the <strong>{$safeJobTitle}</strong> position at Airship Express.
                    </p>
                    <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                        Your application has now been forwarded to the President for final approval. We are completing the final evaluations, and you will receive an official notification as soon as a decision is made.
                    </p>
                    <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                        Please log in to your dashboard to monitor your real-time status.
                    </p>
                    {$remarksBlock}
                ";
                break;

            case 'FINAL_FAILED':
                $mail->Subject = "Application Update: Final Interview Results";
                $subtitle = 'Final Interview Update';
                $statusBadge = "<span style='background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;'>Application Closed</span>";
                $bodyContent = "
                    <p style='font-size: 14.5px; color: #334155; line-height: 1.6; margin-top: 0;'>
                        Thank you for attending the final face-to-face interview for the <strong>{$safeJobTitle}</strong> position at Airship Express. We truly appreciate the time you spent meeting with our team.
                    </p>
                    <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                        After a thorough evaluation of your final interview, we have decided not to proceed with your application at this time.
                    </p>
                    <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                        We are very grateful for your interest in our company and the effort you dedicated to our interview process. We wish you great success in your future professional endeavors.
                    </p>
                    {$remarksBlock}
                    <p style='font-size: 13px; color: #64748b; line-height: 1.6; border-top: 1px solid #e2e8f0; padding-top: 12px;'>
                        <strong>Re-application Policy:</strong> Re-applying for this role is available after a 6-month cooling period. You are welcome to explore and apply for other open positions anytime.
                    </p>
                ";
                break;

            case 'PRESIDENT_APPROVED':
                $mail->Subject = "Congratulations! President's Approval & Employment Offer";
                $subtitle = "President's Approval & Employment Offer";
                $statusBadge = "<span style='background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;'>✨ President's Approval Granted</span>";
                $bodyContent = "
                    <p style='font-size: 15px; color: #0f172a; line-height: 1.6; margin-top: 0;'>
                        <strong>Welcome to Airship Express!</strong>
                    </p>
                    <p style='font-size: 14.5px; color: #334155; line-height: 1.6;'>
                        We are thrilled to announce that your application for the <strong>{$safeJobTitle}</strong> position has received the President's final approval.
                    </p>
                    <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                        Our HR department is currently drafting your official employment contract. Please log in to your portal to monitor your status and await your contract signing schedule.
                    </p>
                    {$remarksBlock}
                ";
                break;

            case 'WAITLIST_STANDBY':
            case 'PRIORITY_WAITLIST':
                $mail->Subject = "Application Update: You Passed All Interviews! Priority Standby for {$safeJobTitle}";
                $subtitle = "Passed Final Interview — Priority Standby";
                $statusBadge = "<span style='background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;'>🌟 Priority Standby / Waitlist</span>";
                $bodyContent = "
                    <p style='font-size: 15px; color: #0f172a; line-height: 1.6; margin-top: 0;'>
                        <strong>Congratulations on an outstanding interview performance!</strong>
                    </p>
                    <p style='font-size: 14.5px; color: #334155; line-height: 1.6;'>
                        We are pleased to inform you that you have <strong>successfully passed both your Initial Screening and Final Interview</strong> for the <strong>{$safeJobTitle}</strong> position at Airship Express.
                    </p>
                    <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                        Because opening capacity for this cycle is currently reserved by an earlier finalist, you have been officially placed at the top of our <strong>Priority Standby List</strong>.
                    </p>
                    <div style='background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin: 18px 0;'>
                        <p style='margin: 0 0 6px 0; font-size: 12.5px; font-weight: 700; color: #1e40af;'>What does this mean for your application?</p>
                        <ul style='margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.6;'>
                            <li><strong>No re-interview required:</strong> Your passed scores remain on record and fully valid.</li>
                            <li><strong>First in line:</strong> If the reserved opening becomes available or if an additional slot is authorized, you will be immediately prioritized for an official Job Offer.</li>
                            <li><strong>Real-time tracking:</strong> You can monitor your application status at any time in your candidate portal.</li>
                        </ul>
                    </div>
                    <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                        We appreciate your dedication throughout our recruitment process and will notify you immediately of any updates.
                    </p>
                    {$remarksBlock}
                ";
                break;

            case 'PRESIDENT_REJECTED':
                $mail->Subject = "Application Decision - {$safeJobTitle} | Airship Express";
                $subtitle = "President's Final Decision";
                $statusBadge = "<span style='background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;'>Application Closed</span>";
                $bodyContent = "
                    <p style='font-size: 14.5px; color: #334155; line-height: 1.6;'>
                        Thank you for your dedication throughout our recruitment process for the <strong>{$safeJobTitle}</strong> position.
                    </p>
                    <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                        After final executive review, we regret to inform you that your application was not approved for hiring at this time.
                    </p>
                    {$remarksBlock}
                    <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                        We sincerely thank you for considering a career with Airship Express.
                    </p>
                    <p style='font-size: 13px; color: #64748b; line-height: 1.6; border-top: 1px solid #e2e8f0; padding-top: 12px;'>
                        <strong>Re-application Policy:</strong> Re-applying for this role is available after a 6-month cooling period. You are welcome to explore and apply for other open positions anytime.
                    </p>
                ";
                break;

            case 'SCHEDULING_EXPIRED':
                $mail->Subject = "Interview Scheduling Expired - {$safeJobTitle} | Airship Express";
                $subtitle = 'Interview Scheduling Update';
                $statusBadge = "<span style='background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;'>⏳ Scheduling Expired</span>";
                $bodyContent = "
                    <p style='font-size: 14.5px; color: #334155; line-height: 1.6;'>
                        We are writing to inform you that your interview invitation for <strong>{$safeJobTitle}</strong> has <strong>expired</strong> because a time slot was not confirmed within the required 24-hour window.
                    </p>
                    <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                        The reserved slot has been released. If you believe this occurred in error or wish to re-apply, please visit the portal or contact our recruitment team.
                    </p>
                ";
                break;

            case 'FINAL_NO_SHOW':
            case 'CANDIDATE_NO_SHOW':
                $mail->Subject = "Application Update: Final Interview No-Show - {$safeJobTitle}";
                $subtitle = 'Final Interview Update';
                $statusBadge = "<span style='background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;'>Interview No-Show</span>";
                
                $intvDate = !empty($details['interview_date']) ? $details['interview_date'] : '';
                $intvTime = !empty($details['interview_time']) ? $details['interview_time'] : '';
                $timeContext = ($intvDate && $intvTime) ? " on <strong>{$intvDate}</strong> at <strong>{$intvTime}</strong>" : ($intvDate ? " on <strong>{$intvDate}</strong>" : "");

                $bodyContent = "
                    <p style='font-size: 14.5px; color: #334155; line-height: 1.6;'>
                        Our records indicate that you were unable to attend your scheduled Final Interview{$timeContext}, and your application for the <strong>{$safeJobTitle}</strong> role has been closed.
                    </p>
                    <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                        Thank you for your interest in Airship Express, and we welcome you to re-apply for future openings.
                    </p>
                    {$remarksBlock}
                    <p style='font-size: 13px; color: #64748b; line-height: 1.6; border-top: 1px solid #e2e8f0; padding-top: 12px;'>
                        <strong>Re-application Policy:</strong> You are welcome to explore and apply for future openings that match your qualifications.
                    </p>
                ";
                break;

            case 'CONTRACT_SIGNED':
            case 'OFFICIALLY_HIRED':
                $mail->Subject = "Welcome to Airship Express! Employment Contract Officially Signed - {$safeJobTitle}";
                $subtitle = "Official Employment Contract Executed";
                $statusBadge = "<span style='background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;'>🖋️ Contract Officially Signed</span>";
                $bodyContent = "
                    <p style='font-size: 15px; color: #0f172a; line-height: 1.6; margin-top: 0;'>
                        <strong>Welcome to the team!</strong>
                    </p>
                    <p style='font-size: 14.5px; color: #334155; line-height: 1.6;'>
                        Congratulations! Your official employment contract for the <strong>{$safeJobTitle}</strong> position has been successfully executed and recorded. You are now officially hired and part of the Airship Express team.
                    </p>
                    <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                        Please log in to your dashboard to monitor your onboarding progress and submit your mandatory physical pre-employment documents to HR.
                    </p>
                    {$remarksBlock}
                ";
                break;

            case 'COMPLETED_REQUIREMENTS':
            case 'DAY_ONE_CLEARED':
            case 'CLEARED_FOR_DAY_1':
                $mail->Subject = "🎉 Cleared for Day 1: Welcome to Airship Express! - {$safeJobTitle}";
                $subtitle = "Your pre-employment requirements are verified.";
                $statusBadge = "<span style='background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;'>🎉 Cleared for Day 1</span>";
                
                $startDate = !empty($details['work_start_date']) ? date('l, F j, Y', strtotime($details['work_start_date'])) : 'To be confirmed by HR';
                $startTime = !empty($details['work_start_time']) ? (date('g:i A', strtotime($details['work_start_time'])) ?: $details['work_start_time']) : '08:00 AM';
                $location  = !empty($details['work_start_location']) ? htmlspecialchars($details['work_start_location']) : '352 T. Pinpin Escolta St., Binondo, Manila, 1006';
                $reportingTo = !empty($details['work_start_reporting_to']) ? htmlspecialchars($details['work_start_reporting_to']) : 'HR Department / Branch Head';
                $notes = !empty($details['work_start_notes']) ? htmlspecialchars($details['work_start_notes']) : '';

                $notesHtml = '';
                if (!empty($notes)) {
                    $notesHtml = "
                        <div style='margin-top: 14px; padding-top: 12px; border-top: 1px dashed #cbd5e1;'>
                            <p style='margin: 0 0 4px 0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;'>Day 1 Instructions</p>
                            <p style='margin: 0; font-size: 13.5px; color: #334155; line-height: 1.5;'>{$notes}</p>
                        </div>
                    ";
                }

                $bodyContent = "
                    <div style='margin-bottom: 20px;'>
                        <h3 style='margin: 0 0 6px 0; color: #0f172a; font-size: 18px; font-weight: 800;'>🎉 Cleared for Day 1: Welcome to Airship Express!</h3>
                        <p style='margin: 0; color: #059669; font-size: 14px; font-weight: 600;'>Your pre-employment requirements are verified.</p>
                    </div>

                    <p style='font-size: 14.5px; color: #334155; line-height: 1.6;'>
                        Congratulations! All your mandatory pre-employment requirements for the <strong>{$safeJobTitle}</strong> position have been thoroughly verified and approved. You are officially cleared to begin your journey at Airship Express!
                    </p>

                    <!-- Details Grid -->
                    <div style='background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 24px 0;'>
                        <table width='100%' cellpadding='0' cellspacing='0' border='0'>
                            <tr>
                                <td width='50%' style='padding-bottom: 16px; vertical-align: top;'>
                                    <div style='font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em;'>START DATE</div>
                                    <div style='font-size: 14.5px; font-weight: 700; color: #0f172a; margin-top: 4px;'>{$startDate}</div>
                                </td>
                                <td width='50%' style='padding-bottom: 16px; vertical-align: top; padding-left: 12px;'>
                                    <div style='font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em;'>ARRIVAL TIME</div>
                                    <div style='font-size: 14.5px; font-weight: 700; color: #0f172a; margin-top: 4px;'>{$startTime}</div>
                                </td>
                            </tr>
                            <tr>
                                <td width='50%' style='vertical-align: top; padding-top: 8px;'>
                                    <div style='font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em;'>LOCATION</div>
                                    <div style='font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px; line-height: 1.4;'>{$location}</div>
                                </td>
                                <td width='50%' style='vertical-align: top; padding-top: 8px; padding-left: 12px;'>
                                    <div style='font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em;'>REPORTING TO</div>
                                    <div style='font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px;'>{$reportingTo}</div>
                                </td>
                            </tr>
                        </table>
                        {$notesHtml}
                    </div>

                    <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                        Please check your applicant portal for full details regarding your onboarding schedule and orientation.
                    </p>
                    {$remarksBlock}
                ";
                $ctaText = 'View Application Status';
                break;

            default:
                return false;
        }

        if (empty($ctaText)) {
            $ctaText = 'Log In to your Dashboard';
        }

        $portalUrl = get_frontend_url() . '/application-status';

        // Build the full HTML body with plain branding
        $mail->Body = "
        <div style='background-color: #ffffff; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif;'>
            <table align='center' border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;'>
                <tr>
                    <td style='padding: 32px;'>
                        <h2 style='margin: 0 0 24px 0; color: #e6007e; font-size: 20px; font-weight: 700;'>
                            Airship Express Hiring Platform
                        </h2>
                        
                        <p style='font-size: 15px; color: #334155; margin: 0 0 16px 0;'>Dear <strong>{$safeName}</strong>,</p>
                        
                        {$bodyContent}
                        
                        <div style='margin: 24px 0;'>
                            <table border='0' cellspacing='0' cellpadding='0' role='presentation'>
                                <tr>
                                    <td align='center' bgcolor='#e6007e' style='border-radius: 6px;'>
                                        <a href='{$portalUrl}' target='_blank' rel='noopener noreferrer' style='background-color: #e6007e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block; mso-padding-alt: 0; text-underline-color: #e6007e;'>
                                            <!--[if mso]><i style='letter-spacing: 24px; mso-font-width: -100%; mso-text-raise: 18pt;'>&nbsp;</i><![endif]-->
                                            <span style='mso-text-raise: 9pt; color: #ffffff;'>{$ctaText}</span>
                                            <!--[if mso]><i style='letter-spacing: 24px; mso-font-width: -100%;'>&nbsp;</i><![endif]-->
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </div>
                        <p style='font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 14px;'>If the button above does not work, copy and paste this link into your browser:<br><span style='color: #e6007e; word-break: break-all; font-family: monospace; font-size: 13px; font-weight: 600;'>{$portalUrl}</span></p>
                        
                        <div style='margin-top: 32px; font-size: 14px; color: #94a3b8; line-height: 1.5;'>
                            Regards,<br>
                            Airship Express Recruitment Team
                        </div>
                    </td>
                </tr>
            </table>
        </div>
        ";

        // Use HTTPS API on Railway (SMTP ports blocked), fallback to PHPMailer locally
        if (getenv('RESEND_API_KEY')) {
            $sent = send_email_via_resend($toEmail, $toName, $mail->Subject, $mail->Body);
            if ($sent) return true;
        }
        if (getenv('BREVO_API_KEY')) {
            $sent = send_email_via_brevo($toEmail, $toName, $mail->Subject, $mail->Body);
            if ($sent) return true;
        }
        $mail->send();
        return true;

    } catch (Exception $e) {
        error_log("[EmailHelper] Failed to send {$statusType} email to {$toEmail}: " . $e->getMessage());
        return false;
    }
}

/**
 * Send a branded HTML final interview schedule invitation email to a candidate.
 *
 * @param string $toEmail   Candidate's email address.
 * @param string $toName    Candidate's full name.
 * @param string $jobTitle  Title of the job position.
 * @param string $date      Scheduled date (YYYY-MM-DD).
 * @param string $startTime Scheduled start time (HH:MM:SS).
 * @param string $endTime   Optional scheduled end time (HH:MM:SS).
 * @param string $location  Venue/Location string.
 * @return bool             True if sent, false on failure.
 */
function sendInterviewScheduleEmail(
    string $toEmail,
    string $toName,
    string $jobTitle,
    string $date,
    string $startTime,
    string $endTime = '',
    string $location = '352 T. Pinpin Escolta st., Binondo Manila, 1006'
): bool {
    if (empty($toEmail) || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    try {
        $mail = new PHPMailer(true);
        configure_smtp($mail, 'Airship Express Recruitment');
        $mail->addAddress($toEmail, $toName);
        $mail->isHTML(true);

        $safeName     = htmlspecialchars($toName);
        $safeJobTitle = htmlspecialchars($jobTitle ?: 'Position');
        $safeLocation = htmlspecialchars($location);

        $friendlyDate  = !empty($date) ? date('l, F j, Y', strtotime($date)) : '';
        $friendlyStart = !empty($startTime) ? date('g:i A', strtotime($startTime)) : '';
        $friendlyEnd   = !empty($endTime) ? date('g:i A', strtotime($endTime)) : '';
        $timeRange     = $friendlyEnd ? "{$friendlyStart} - {$friendlyEnd}" : $friendlyStart;
        $portalUrl     = get_frontend_url() . '/application-status';

        $mail->Subject = "Action Required: Final Interview Schedule - {$safeJobTitle}";
        $mail->Body    = "
        <div style='background-color: #ffffff; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif;'>
            <table align='center' border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;'>
                <tr>
                    <td style='padding: 32px;'>
                        <h2 style='margin: 0 0 24px 0; color: #e6007e; font-size: 20px; font-weight: 700;'>
                            Airship Express Hiring Platform
                        </h2>
                        
                        <p style='font-size: 15px; color: #334155; margin: 0 0 16px 0;'>Dear <strong>{$safeName}</strong>,</p>
                        
                        <p style='font-size: 14.5px; color: #334155; line-height: 1.6;'>
                            Congratulations on making it to the final stage of the hiring process for the <strong>{$safeJobTitle}</strong> position at Airship Express!
                        </p>
                        <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                            You have been scheduled for an in-person final interview. Please review the details below:
                        </p>
                        
                        <div style='background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;'>
                            <p style='margin: 5px 0; font-size: 14px; color: #334155;'><strong>Date:</strong> {$friendlyDate}</p>
                            <p style='margin: 5px 0; font-size: 14px; color: #334155;'><strong>Time:</strong> {$timeRange}</p>
                            <p style='margin: 5px 0; font-size: 14px; color: #334155;'><strong>Location:</strong> {$safeLocation}</p>
                        </div>

                        <p style='font-size: 14px; color: #334155; line-height: 1.6;'>
                            Your confirmation is required. Please log in to your applicant portal to accept this schedule or request a reschedule if you have a conflict.
                        </p>
                        
                        <div style='margin: 24px 0;'>
                            <table border='0' cellspacing='0' cellpadding='0' role='presentation'>
                                <tr>
                                    <td align='center' bgcolor='#e6007e' style='border-radius: 6px;'>
                                        <a href='{$portalUrl}' target='_blank' rel='noopener noreferrer' style='background-color: #e6007e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block; mso-padding-alt: 0; text-underline-color: #e6007e;'>
                                            <!--[if mso]><i style='letter-spacing: 24px; mso-font-width: -100%; mso-text-raise: 18pt;'>&nbsp;</i><![endif]-->
                                            <span style='mso-text-raise: 9pt; color: #ffffff;'>Log In to Confirm or Reschedule</span>
                                            <!--[if mso]><i style='letter-spacing: 24px; mso-font-width: -100%;'>&nbsp;</i><![endif]-->
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </div>
                        <p style='font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 14px;'>If the button above does not work, copy and paste this link into your browser:<br><span style='color: #e6007e; word-break: break-all; font-family: monospace; font-size: 13px; font-weight: 600;'>{$portalUrl}</span></p>
                        
                        <div style='margin-top: 32px; font-size: 14px; color: #94a3b8; line-height: 1.5;'>
                            Regards,<br>
                            Airship Express Recruitment Team
                        </div>
                    </td>
                </tr>
            </table>
        </div>
        ";

        // Use HTTPS API on Railway (SMTP ports blocked), fallback to PHPMailer locally
        if (getenv('RESEND_API_KEY')) {
            $sent = send_email_via_resend($toEmail, $toName, $mail->Subject, $mail->Body);
            if ($sent) return true;
        }
        if (getenv('BREVO_API_KEY')) {
            $sent = send_email_via_brevo($toEmail, $toName, $mail->Subject, $mail->Body);
            if ($sent) return true;
        }
        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("[EmailHelper] Failed to send interview schedule email to {$toEmail}: " . $e->getMessage());
        return false;
    }
}

/**
 * Send a security alert email to the candidate's OLD email address
 * notifying them of an email change request.
 *
 * @param string $oldEmail    Candidate's current/old email.
 * @param string $toName      Candidate's full name.
 * @param string $newEmail    Requested new email.
 * @param string $cancelToken Optional token to cancel directly from email.
 * @return bool
 */
function sendEmailChangeSecurityAlert(string $oldEmail, string $toName, string $newEmail, string $cancelToken = ''): bool {
    if (empty($oldEmail) || !filter_var($oldEmail, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $safeName     = htmlspecialchars($toName ?: 'Candidate');
    $safeNewEmail = htmlspecialchars($newEmail);
    $currentDate  = date('F j, Y, g:i A');

    $cancelUrl = !empty($cancelToken)
        ? get_backend_url() . "/auth/cancel_email_change.php?token=" . urlencode($cancelToken)
        : get_frontend_url() . "/settings";

    try {
        $mail = new PHPMailer(true);
        configure_smtp($mail, 'Airship Express Security');
        $mail->addAddress($oldEmail, $toName);
        $mail->isHTML(true);

        $mail->Subject = 'Security Alert: Email update requested - Airship Express';
        $mail->Body    = "
        <div style='background-color: #f8fafc; padding: 40px 16px; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif;'>
            <table align='center' border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;'>
                <tr>
                    <td style='padding: 36px 36px 32px;'>
                        <!-- Centered Brand Header -->
                        <div style='text-align: center; padding-bottom: 24px;'>
                            <span style='font-family: \"Montserrat\", -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 20px; font-weight: 900; letter-spacing: 1.5px; color: #e6007e;'>AIRSHIP</span>
                            <span style='font-family: \"Montserrat\", -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 20px; font-weight: 900; letter-spacing: 1.5px; color: #0f172a; margin-left: 3px;'>EXPRESS</span>
                        </div>

                        <!-- Title -->
                        <h1 style='margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.2px;'>
                            Security Alert: Email update requested
                        </h1>
                        
                        <p style='font-size: 14px; color: #334155; margin: 0 0 14px 0; line-height: 1.5;'>
                            Dear <strong>{$safeName}</strong>,
                        </p>
                        
                        <p style='font-size: 14px; color: #334155; line-height: 1.5; margin: 0 0 18px 0;'>
                            A request was recently submitted on your Airship Express candidate account to change your registered email address.
                        </p>
                        
                        <!-- Request Details Box -->
                        <div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin: 18px 0 24px 0;'>
                            <table border='0' cellpadding='0' cellspacing='0' width='100%' style='font-size: 13.5px; border-collapse: collapse;'>
                                <tr>
                                    <td style='color: #64748b; padding: 6px 0; width: 42%; font-weight: 500;'>Requested New Email:</td>
                                    <td style='color: #0f172a; font-weight: 600; padding: 6px 0; word-break: break-all;'>{$safeNewEmail}</td>
                                </tr>
                                <tr>
                                    <td style='color: #64748b; padding: 6px 0; font-weight: 500;'>Date &amp; Time Requested:</td>
                                    <td style='color: #334155; font-weight: 500; padding: 6px 0;'>{$currentDate}</td>
                                </tr>
                            </table>
                        </div>

                        <!-- Action Section 1 (Authorized) -->
                        <div style='margin-bottom: 22px;'>
                            <h3 style='margin: 0 0 6px 0; font-size: 14.5px; font-weight: 700; color: #1e293b;'>
                                Did you make this request?
                            </h3>
                            <p style='margin: 0; font-size: 13.5px; color: #475569; line-height: 1.5;'>
                                If you authorized this change, no action is required here. Please check your new inbox to complete the verification.
                            </p>
                        </div>

                        <!-- Action Section 2 (Unauthorized - Critical) -->
                        <div style='margin-bottom: 26px;'>
                            <h3 style='margin: 0 0 6px 0; font-size: 14.5px; font-weight: 700; color: #991b1b;'>
                                If you did not authorize this request:
                            </h3>
                            <p style='margin: 0; font-size: 13.5px; color: #475569; line-height: 1.5;'>
                                Someone may have compromised your account. Please secure your account immediately by resetting your password.
                            </p>
                        </div>
                        
                        <!-- Primary Button -->
                        <div style='margin: 24px 0 10px;'>
                            <a href='" . get_frontend_url() . "/settings' style='background-color: #e6007e; color: #ffffff; padding: 12px 26px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 14px; display: inline-block;'>
                                Secure Account & Change Password
                            </a>
                        </div>
                        
                        <!-- Minimal Footer -->
                        <div style='margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; line-height: 1.5;'>
                            This is an automated security alert from Airship Express Hiring Management System.
                        </div>
                    </td>
                </tr>
            </table>
        </div>
        ";

        // Use HTTPS API on Railway (SMTP ports blocked), fallback to PHPMailer locally
        if (getenv('RESEND_API_KEY')) {
            $sent = send_email_via_resend($oldEmail, $toName, $mail->Subject, $mail->Body, '', 'Airship Express Security');
            if ($sent) return true;
        }
        if (getenv('BREVO_API_KEY')) {
            $sent = send_email_via_brevo($oldEmail, $toName, $mail->Subject, $mail->Body, '', 'Airship Express Security');
            if ($sent) return true;
        }
        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("[EmailHelper] Failed to send email change security alert to {$oldEmail}: " . $e->getMessage());
        $logFile = __DIR__ . '/auth/email_log.txt';
        $logMsg = "[" . date('Y-m-d H:i:s') . "] SECURITY ALERT to {$oldEmail} for change to {$newEmail}\n";
        @file_put_contents($logFile, $logMsg, FILE_APPEND);
        return false;
    }
}

/**
 * Send a clean, professional verification link email to the candidate's NEW email address.
 *
 * @param string $newEmail          Candidate's requested new email.
 * @param string $toName            Candidate's full name.
 * @param string $verificationToken Secure hex verification token.
 * @param int    $expiryHours       Expiration in hours (default: 24).
 * @return bool
 */
function sendEmailChangeVerificationLink(string $newEmail, string $toName, string $verificationToken, int $expiryHours = 24): bool {
    if (empty($newEmail) || !filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    // Extract first name for a natural friendly greeting
    $nameParts     = explode(' ', trim($toName ?: ''));
    $safeFirstName = htmlspecialchars($nameParts[0] ?: 'Candidate');
    $verifyUrl     = get_frontend_url() . "/verify-email-change?token=" . urlencode($verificationToken);

    try {
        $mail = new PHPMailer(true);
        configure_smtp($mail, 'Airship Express Recruitment');
        $mail->addAddress($newEmail, $toName);
        $mail->isHTML(true);

        $mail->Subject = 'Verify your new email address - Airship Express';
        $mail->Body    = "
        <div style='background-color: #f8fafc; padding: 40px 16px; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif;'>
            <table align='center' border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;'>
                <tr>
                    <td style='padding: 36px;'>
                        <!-- Centered Brand Header -->
                        <div style='text-align: center; padding-bottom: 20px;'>
                            <span style='font-family: \"Montserrat\", -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 20px; font-weight: 900; letter-spacing: 1.5px; color: #e6007e;'>AIRSHIP</span>
                            <span style='font-family: \"Montserrat\", -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 20px; font-weight: 900; letter-spacing: 1.5px; color: #0f172a; margin-left: 3px;'>EXPRESS</span>
                        </div>

                        <!-- Centered Title -->
                        <h2 style='margin: 0 0 18px 0; font-size: 22px; font-weight: 700; color: #0f172a; text-align: center; letter-spacing: -0.3px;'>
                            Verify your new email address
                        </h2>
                        
                        <!-- Body Text -->
                        <p style='font-size: 14.5px; color: #334155; line-height: 1.6; text-align: center; margin: 0 0 28px 0;'>
                            Hello <strong>{$safeFirstName}</strong>,<br><br>
                            You recently requested to update the email address associated with your Airship Express candidate account. Please confirm this change by clicking the button below.
                        </p>
                        
                        <!-- Centered CTA Button -->
                        <div style='margin: 0 0 28px 0; text-align: center;'>
                            <a href='{$verifyUrl}' style='background-color: #e6007e; color: #ffffff; padding: 13px 32px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 14.5px; display: inline-block;'>
                                Verify Email Address
                            </a>
                        </div>
                        
                        <!-- Expiration Note (small clock, no heavy box) -->
                        <div style='text-align: center; margin-bottom: 24px;'>
                            <p style='margin: 0; font-size: 13px; color: #64748b;'>
                                ⏳ This secure link expires in {$expiryHours} hours.
                            </p>
                        </div>
                        
                        <!-- Security Note -->
                        <p style='font-size: 12px; color: #94a3b8; text-align: center; margin: 0; padding-top: 16px; border-top: 1px solid #f1f5f9;'>
                            If you did not request this, you can safely ignore this email.
                        </p>
                    </td>
                </tr>
            </table>
        </div>
        ";

        // Use HTTPS API on Railway (SMTP ports blocked), fallback to PHPMailer locally
        if (getenv('RESEND_API_KEY')) {
            $sent = send_email_via_resend($newEmail, $toName, $mail->Subject, $mail->Body);
            if ($sent) return true;
        }
        if (getenv('BREVO_API_KEY')) {
            $sent = send_email_via_brevo($newEmail, $toName, $mail->Subject, $mail->Body);
            if ($sent) return true;
        }
        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("[EmailHelper] Failed to send email change verification link to {$newEmail}: " . $e->getMessage());
        $logFile = __DIR__ . '/auth/email_log.txt';
        $logMsg = "[" . date('Y-m-d H:i:s') . "] VERIFY LINK to {$newEmail}: {$verifyUrl}\n";
        @file_put_contents($logFile, $logMsg, FILE_APPEND);
        return false;
    }
}

/**
 * Send an email verification link to a newly registered user.
 *
 * @param string $toEmail          User's registered email address.
 * @param string $toName           User's full name.
 * @param string $verificationCode 6-digit or secure token code.
 * @return bool
 */
function sendRegistrationVerificationEmail(string $toEmail, string $toName, string $verificationCode): bool {
    if (empty($toEmail) || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    try {
        $mail = new PHPMailer(true);
        configure_smtp($mail, 'Airship Express Hiring Portal');
        $mail->addAddress($toEmail, $toName);
        $mail->isHTML(true);
        $mail->Subject = 'Verify Your Email Address - Airship Express';

        $safeName = htmlspecialchars($toName ?: 'Applicant');
        $verificationLink = get_frontend_url() . "/verify?token=" . urlencode($verificationCode);

        $mail->Body = "
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e4e7; border-radius: 8px; background-color: #ffffff;'>
            <div style='text-align: center; border-bottom: 1px solid #e5e4e7; padding-bottom: 20px;'>
                <h2 style='color: #e6007e; margin: 0; font-family: Montserrat, Arial, sans-serif;'>AIRSHIP EXPRESS</h2>
                <p style='color: #64748b; margin: 5px 0 0 0;'>Hiring Management Portal</p>
            </div>
            <div style='padding: 24px 0;'>
                <p style='font-size: 16px; color: #1e293b; margin: 0 0 12px;'>Hello <strong>{$safeName}</strong>,</p>
                <p style='font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 20px;'>Thank you for registering with us! To complete your registration and activate your candidate account, please verify your email address by clicking the button below:</p>
                <div style='text-align: center; margin: 30px 0;'>
                    <a href='{$verificationLink}' style='background-color: #e6007e; color: #ffffff; padding: 13px 32px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px rgba(230, 0, 126, 0.2);'>Verify Email Address</a>
                </div>
                <p style='font-size: 13px; color: #64748b; line-height: 1.5;'>If the button above does not work, copy and paste this URL into your browser:<br><a href='{$verificationLink}' style='color: #e6007e; word-break: break-all;'>{$verificationLink}</a></p>
            </div>
            <div style='border-top: 1px solid #e5e4e7; padding-top: 20px; text-align: center; font-size: 12px; color: #9ca3af;'>
                <p style='margin: 0;'>This is an automated message from Airship Express Hiring Management System. Please do not reply.</p>
            </div>
        </div>
        ";
        $mail->AltBody = "Hello {$safeName},\n\nTo complete your registration, please verify your email address by visiting this link:\n{$verificationLink}";

        // Use HTTPS API on Railway (SMTP ports blocked), fallback to PHPMailer locally
        if (getenv('RESEND_API_KEY')) {
            $sent = send_email_via_resend($toEmail, $toName, $mail->Subject, $mail->Body, $mail->AltBody, 'Airship Express Hiring Portal');
            if ($sent) return true;
        }
        if (getenv('BREVO_API_KEY')) {
            $sent = send_email_via_brevo($toEmail, $toName, $mail->Subject, $mail->Body, $mail->AltBody, 'Airship Express Hiring Portal');
            if ($sent) return true;
        }
        $mail->send();
        return true;
    } catch (\Throwable $e) {
        error_log("[EmailHelper] Failed to send registration verification email to {$toEmail}: " . $e->getMessage());
        return false;
    }
}

/**
 * Send password reset email to an Applicant, Admin, or Super Admin.
 *
 * @param string $toEmail    Recipient's email address.
 * @param string $toName     Recipient's full name.
 * @param string $resetToken 64-character hex reset token.
 * @param int    $isAdmin    User's admin level (0 = Applicant, 1 = Admin, 3 = Super Admin).
 * @return bool
 */
function sendPasswordResetEmail(string $toEmail, string $toName, string $resetToken, int $isAdmin = 0): bool {
    if (empty($toEmail) || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    try {
        $mail = new PHPMailer(true);
        configure_smtp($mail, 'Airship Express Security Portal');
        $mail->addAddress($toEmail, $toName);
        $mail->isHTML(true);

        $safeName  = htmlspecialchars($toName ?: 'User');
        $resetLink = get_frontend_url() . "/reset-password?token=" . urlencode($resetToken);

        // Client IP determination
        $clientIp = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        if (isset($_SERVER['HTTP_X_FORWARDED_FOR']) && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $clientIp = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        }
        if ($clientIp === '::1' || $clientIp === '::ffff:127.0.0.1') {
            $clientIp = '127.0.0.1 (Localhost)';
        }

        date_default_timezone_set('Asia/Manila');
        $requestTime = date('F j, Y, h:i A') . ' (Philippine Time)';

        if ($isAdmin === 3) {
            // High-Security Email for Root Super Administrator
            $mail->Subject = '🔒 Super Admin Password Reset Authorization - Airship Express';
            $mail->Body = "
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e4e7; border-radius: 8px; background-color: #ffffff;'>
                <div style='text-align: center; border-bottom: 1px solid #e5e4e7; padding-bottom: 20px;'>
                    <h2 style='color: #e6007e; margin: 0; font-family: Montserrat, Arial, sans-serif; letter-spacing: 0.5px;'>AIRSHIP EXPRESS</h2>
                    <p style='color: #64748b; margin: 5px 0 0 0; font-size: 13px;'>Hiring Management Portal • Root Security</p>
                </div>
                <div style='padding: 24px 0;'>
                    <div style='background-color: #fff1f2; border-left: 4px solid #e6007e; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;'>
                        <strong style='color: #9f1239; font-size: 14px;'>Privileged Access Recovery Request</strong>
                        <p style='color: #475569; margin: 4px 0 0 0; font-size: 13px;'>A password reset was requested for the Super Administrator account.</p>
                    </div>

                    <p style='font-size: 16px; color: #1e293b; margin: 0 0 12px 0;'>Hello <strong>{$safeName}</strong>,</p>
                    <p style='font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px 0;'>
                        To authorize and complete this password reset, click the button below. For security, you will be required to provide your <strong>6-digit Google Authenticator code</strong> or an <strong>Emergency Backup Code</strong> before a new password can be set.
                    </p>

                    <div style='background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #334155; line-height: 1.6;'>
                        <p style='margin: 0 0 6px 0; font-weight: bold; color: #0f172a;'>Request Details:</p>
                        <p style='margin: 0 0 4px 0;'>• Timestamp: <strong>{$requestTime}</strong></p>
                        <p style='margin: 0 0 4px 0;'>• Requesting IP: <strong>{$clientIp}</strong></p>
                        <p style='margin: 0;'>• Validity Window: <strong>15 minutes</strong></p>
                    </div>

                    <div style='text-align: center; margin: 28px 0;'>
                        <a href='{$resetLink}' style='background-color: #e6007e; color: #ffffff; padding: 13px 32px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 8px rgba(230, 0, 126, 0.25);'>Authorize & Reset Password</a>
                    </div>
                    <p style='font-size: 12.5px; color: #64748b; line-height: 1.5; margin-top: 14px;'>If the button above does not work, copy and paste this link directly into your browser:<br><span style='color: #e6007e; word-break: break-all; font-family: monospace; font-size: 12px;'>{$resetLink}</span></p>
                    <p style='font-size: 12.5px; color: #64748b; line-height: 1.5; margin: 0;'>If you did not initiate this request, someone may be attempting to access your account. Your account remains protected by your Two-Factor Authenticator.</p>
                </div>
                <div style='border-top: 1px solid #e5e4e7; padding-top: 18px; text-align: center; font-size: 12px; color: #9ca3af;'>
                    <p style='margin: 0;'>This is an automated high-priority security dispatch. Do not reply.</p>
                </div>
            </div>
            ";
            $mail->AltBody = "Super Admin Password Reset Request\n\nVisit this link within 15 minutes to reset your password:\n{$resetLink}\n\nYou will be required to provide your Google Authenticator 6-digit code or an Emergency Backup Code.";
        } elseif ($isAdmin === 1) {
            // Admin Account Password Reset
            $mail->Subject = '🔑 Admin Password Reset Request - Airship Express';
            $mail->Body = "
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e4e7; border-radius: 8px; background-color: #ffffff;'>
                <div style='text-align: center; border-bottom: 1px solid #e5e4e7; padding-bottom: 20px;'>
                    <h2 style='color: #e6007e; margin: 0; font-family: Montserrat, Arial, sans-serif;'>AIRSHIP EXPRESS</h2>
                    <p style='color: #64748b; margin: 5px 0 0 0;'>Hiring Management Portal • Admin Security</p>
                </div>
                <div style='padding: 24px 0;'>
                    <p style='font-size: 16px; color: #1e293b; margin: 0 0 12px;'>Hello <strong>{$safeName}</strong>,</p>
                    <p style='font-size: 15px; color: #475569; line-height: 1.6;'>We received a password reset request for your Administrator account. Click the button below to set a new password. This secure link expires in 15 minutes.</p>
                    <div style='background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #334155; line-height: 1.6;'>
                        <p style='margin: 0 0 4px;'>• Timestamp: <strong>{$requestTime}</strong></p>
                        <p style='margin: 0;'>• Validity: <strong>15 minutes</strong></p>
                    </div>
                    <div style='text-align: center; margin: 28px 0;'>
                        <a href='{$resetLink}' style='background-color: #e6007e; color: #ffffff; padding: 13px 32px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px rgba(230, 0, 126, 0.2);'>Reset Admin Password</a>
                    </div>
                    <p style='font-size: 12.5px; color: #64748b; line-height: 1.5; margin-top: 14px;'>If the button above does not work, copy and paste this link directly into your browser:<br><span style='color: #e6007e; word-break: break-all; font-family: monospace; font-size: 12px;'>{$resetLink}</span></p>
                    <p style='font-size: 12.5px; color: #64748b;'>If you did not request a password reset, please notify your Super Administrator immediately.</p>
                </div>
                <div style='border-top: 1px solid #e5e4e7; padding-top: 18px; text-align: center; font-size: 12px; color: #9ca3af;'>
                    <p style='margin: 0;'>This is an automated administrative notification from Airship Express.</p>
                </div>
            </div>
            ";
            $mail->AltBody = "Hello {$safeName},\n\nTo reset your admin password, please visit this link within 15 minutes:\n{$resetLink}";
        } else {
            // Standard Applicant Email
            $mail->Subject = 'Reset Your Password - Airship Express';
            $mail->Body = "
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e4e7; border-radius: 8px; background-color: #ffffff;'>
                <div style='text-align: center; border-bottom: 1px solid #e5e4e7; padding-bottom: 20px;'>
                    <h2 style='color: #e6007e; margin: 0; font-family: Montserrat, Arial, sans-serif;'>AIRSHIP EXPRESS</h2>
                    <p style='color: #64748b; margin: 5px 0 0 0;'>Hiring Management Portal</p>
                </div>
                <div style='padding: 24px 0;'>
                    <p style='font-size: 16px; color: #1e293b; margin: 0 0 12px;'>Hello <strong>{$safeName}</strong>,</p>
                    <p style='font-size: 15px; color: #475569; line-height: 1.6;'>We received a request to reset your password. Click the button below to choose a new password. This link will expire in 15 minutes.</p>
                    <div style='text-align: center; margin: 30px 0;'>
                        <a href='{$resetLink}' style='background-color: #e6007e; color: #ffffff; padding: 13px 32px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px rgba(230, 0, 126, 0.2);'>Reset Password</a>
                    </div>
                    <p style='font-size: 13px; color: #64748b; line-height: 1.5;'>If the button above does not work or your browser blocks redirects, copy and paste this link directly into your browser:<br><span style='color: #e6007e; word-break: break-all; font-family: monospace; font-size: 12px;'>{$resetLink}</span></p>
                    <p style='font-size: 13px; color: #64748b;'>If you did not request this, you can safely ignore this email.</p>
                </div>
                <div style='border-top: 1px solid #e5e4e7; padding-top: 20px; text-align: center; font-size: 12px; color: #9ca3af;'>
                    <p style='margin: 0;'>This is an automated email from Airship Express, please do not reply.</p>
                </div>
            </div>
            ";
            $mail->AltBody = "Hello {$safeName},\n\nTo reset your password, please visit this link (expires in 15 minutes):\n{$resetLink}";
        }

        // Use HTTPS API on Railway (SMTP ports blocked), fallback to PHPMailer locally
        if (getenv('RESEND_API_KEY')) {
            $sent = send_email_via_resend($toEmail, $toName, $mail->Subject, $mail->Body, $mail->AltBody ?? '', 'Airship Express Security Portal');
            if ($sent) return true;
        }
        if (getenv('BREVO_API_KEY')) {
            $sent = send_email_via_brevo($toEmail, $toName, $mail->Subject, $mail->Body, $mail->AltBody ?? '', 'Airship Express Security Portal');
            if ($sent) return true;
        }
        $mail->send();
        return true;
    } catch (\Throwable $e) {
        error_log("[EmailHelper] Failed to send password reset email to {$toEmail}: " . $e->getMessage());
        return false;
    }
}
?>
