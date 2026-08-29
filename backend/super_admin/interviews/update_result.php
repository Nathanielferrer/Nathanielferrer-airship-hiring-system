<?php
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../audit_helper.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../../libs/PHPMailer/src/Exception.php';
require_once __DIR__ . '/../../libs/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/../../libs/PHPMailer/src/SMTP.php';

header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$application_id = intval($data['application_id'] ?? ($data['id'] ?? 0));
$result = trim($data['result'] ?? '');
$actor_id = intval($data['actor_id'] ?? 0);
$actor_name = trim($data['actor_name'] ?? 'Super Admin');

$validResults = [
    'PASS_FINAL_INTERVIEW', 'Passed Final Interview',
    'FAIL_FINAL_INTERVIEW', 'Failed Final Interview',
    'PASS_FINAL_APPROVAL', 'Passed Final Approval', 'HIRED',
    'FAIL_FINAL_APPROVAL', 'Failed Final Approval',
    'Candidate Withdrew', 'CANDIDATE_WITHDREW', 'CANDIDATE WITHDREW',
    'Incomplete Requirements', 'INCOMPLETE_REQUIREMENTS', 'INCOMPLETE REQUIREMENTS',
    'Failed Pre-Employment', 'FAILED_PRE_EMPLOYMENT', 'FAILED PRE-EMPLOYMENT',
    'VERIFY_REQUIREMENTS', 'Requirements Verified', 'REQUIREMENTS_VERIFIED', 'VERIFY_ALL_REQUIREMENTS',
    'CONTRACT_SIGNED', 'Contract Signed & Onboarded', 'CONTRACT_SIGNED_AND_ONBOARDED', 'Officially Hired & Signed',
    'INTERVIEW_FAILED', 'rejected', 'UNDO', 'REVERT'
];

if (!$application_id || !in_array($result, $validResults)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid parameters or evaluation action."]);
    exit();
}

try {
    $pdo->beginTransaction();

    // Fetch candidate info, user details, job details, and previous status
    $candStmt = $pdo->prepare("
        SELECT 
            a.application_id, 
            a.user_id, 
            a.job_id, 
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
    $candStmt->execute([$application_id]);
    $candData = $candStmt->fetch(PDO::FETCH_ASSOC);

    if (!$candData) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Application record not found."]);
        exit();
    }

    $candName = trim($candData['candidate_name'] ?? '') ?: trim(($candData['User_Fname'] ?? '') . ' ' . ($candData['User_Lname'] ?? '')) ?: "Application #{$application_id}";
    $candEmail = trim($candData['candidate_email'] ?? '') ?: trim($candData['User_Email'] ?? '');
    $userId = intval($candData['user_id'] ?? 0);
    $prevStatus = $candData['status'] ?? '';
    $jobId = intval($candData['job_id'] ?? 0);
    $jobTitle = $candData['job_title'] ?? 'Position';

    // Compute deadline (+7 days from current date)
    $todayDay = date('l, F j, Y');
    $deadlineDate = date('l, F j, Y', strtotime('+7 days'));

    if ($result === 'UNDO' || $result === 'REVERT') {
        // Determine appropriate rollback status
        if (in_array(strtoupper($prevStatus), ['PASSED FINAL APPROVAL', 'FAILED FINAL APPROVAL', 'HIRED'])) {
            $newStatus = 'Passed Final Interview';
        } else {
            $newStatus = 'CONFIRMED';
        }

        $stmt = $pdo->prepare("UPDATE applications_tbl SET status = ?, updated_at = NOW() WHERE application_id = ?");
        $stmt->execute([$newStatus, $application_id]);

        // If previous decision was HIRED / Passed Final Approval, reverse job slot decrement
        if (in_array(strtoupper($prevStatus), ['PASSED FINAL APPROVAL', 'HIRED']) && $jobId > 0) {
            $incStmt = $pdo->prepare("UPDATE jobs_tbl SET availability = availability + 1 WHERE job_id = ?");
            $incStmt->execute([$jobId]);

            // Re-activate job if it was closed
            $checkStmt = $pdo->prepare("SELECT availability, status FROM jobs_tbl WHERE job_id = ?");
            $checkStmt->execute([$jobId]);
            $jobData = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if ($jobData && (int)$jobData['availability'] > 0 && $jobData['status'] === 'Closed') {
                $reactivateStmt = $pdo->prepare("UPDATE jobs_tbl SET status = 'Active' WHERE job_id = ?");
                $reactivateStmt->execute([$jobId]);
            }
        }

        $details = "Reverted candidate \"{$candName}\" (applying for \"{$jobTitle}\") evaluation decision: \"{$prevStatus}\" → \"{$newStatus}\".";
        log_system_audit($pdo, $actor_id, $actor_name, 'Status Change', 'Evaluation Module', $details, 'Info');

        $respMsg = "Decision reverted successfully. Candidate moved back to {$newStatus}.";
    } elseif (in_array($result, ['Candidate Withdrew', 'CANDIDATE_WITHDREW', 'CANDIDATE WITHDREW', 'Incomplete Requirements', 'INCOMPLETE_REQUIREMENTS', 'INCOMPLETE REQUIREMENTS', 'Failed Pre-Employment', 'FAILED_PRE_EMPLOYMENT', 'FAILED PRE-EMPLOYMENT'])) {
        if (in_array($result, ['Candidate Withdrew', 'CANDIDATE_WITHDREW', 'CANDIDATE WITHDREW'])) {
            $newStatus = 'Candidate Withdrew';
            $actionPhrase = 'withdrew from consideration';
        } elseif (in_array($result, ['Incomplete Requirements', 'INCOMPLETE_REQUIREMENTS', 'INCOMPLETE REQUIREMENTS'])) {
            $newStatus = 'Incomplete Requirements';
            $actionPhrase = 'missed the 1-week pre-employment submission deadline';
        } else {
            $newStatus = 'Failed Pre-Employment';
            $actionPhrase = 'did not pass pre-employment clearance (medical/drug screening)';
        }

        $stmt = $pdo->prepare("UPDATE applications_tbl SET status = ?, updated_at = NOW() WHERE application_id = ?");
        $stmt->execute([$newStatus, $application_id]);

        // If previous decision was HIRED / Passed Final Approval, restore job slot
        if (in_array(strtoupper($prevStatus), ['PASSED FINAL APPROVAL', 'HIRED', 'PASSED']) && $jobId > 0) {
            $incStmt = $pdo->prepare("UPDATE jobs_tbl SET availability = availability + 1 WHERE job_id = ?");
            $incStmt->execute([$jobId]);

            // Re-activate job if it was closed
            $checkStmt = $pdo->prepare("SELECT availability, status FROM jobs_tbl WHERE job_id = ?");
            $checkStmt->execute([$jobId]);
            $jobData = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if ($jobData && (int)$jobData['availability'] > 0 && $jobData['status'] === 'Closed') {
                $reactivateStmt = $pdo->prepare("UPDATE jobs_tbl SET status = 'Active' WHERE job_id = ?");
                $reactivateStmt->execute([$jobId]);
            }
        }

        $details = "Candidate \"{$candName}\" (applying for \"{$jobTitle}\") {$actionPhrase}: Status set to \"{$newStatus}\" (Previous: \"{$prevStatus}\"). 1 position slot restored.";
        log_system_audit($pdo, $actor_id, $actor_name, 'Status Change', 'Evaluation Module', $details, 'Warning');

        $respMsg = "Candidate status updated to {$newStatus}. Position opening restored.";
    } else {
        // Map action to standard application status
        $statusToSave = '';
        $auditCategory = 'Status Change';
        $severity = 'Info';
        $respMsg = '';
        $sendHireNotifications = false;

        switch ($result) {
            case 'PASS_FINAL_INTERVIEW':
            case 'Passed Final Interview':
                $statusToSave = 'Passed Final Interview';
                $respMsg = "Candidate passed final interview and forwarded for President's Final Approval.";
                $details = "Candidate \"{$candName}\" (applying for \"{$jobTitle}\") passed final interview: \"{$prevStatus}\" → \"Passed Final Interview\". Forwarded to President for executive decision.";
                
                // In-App Notification for candidate
                if ($userId > 0) {
                    $notifTitle = "You Passed the Final Interview - Pending Executive Approval";
                    $notifMsg = "Congratulations! You have successfully passed the final interview for {$jobTitle}. Your application has been submitted to the Company President for final executive review and decision.";
                    $notifStmt = $pdo->prepare("
                        INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                        VALUES (?, ?, ?, ?, 'interview_passed', '/application-status', 0, NOW())
                    ");
                    $notifStmt->execute([$userId, $application_id, $notifTitle, $notifMsg]);
                }
                break;

            case 'FAIL_FINAL_INTERVIEW':
            case 'Failed Final Interview':
            case 'INTERVIEW_FAILED':
            case 'rejected':
                $statusToSave = 'Failed Final Interview';
                $severity = 'Warning';
                $respMsg = "Candidate marked as Failed Final Interview.";
                $details = "Candidate \"{$candName}\" (applying for \"{$jobTitle}\") failed final interview: \"{$prevStatus}\" → \"Failed Final Interview\".";
                break;

            case 'PASS_FINAL_APPROVAL':
            case 'Passed Final Approval':
            case 'HIRED':
                $statusToSave = 'Passed Final Approval';
                $respMsg = "Candidate officially approved by President and Hired! Pre-employment requirements and notifications sent.";
                $details = "Candidate \"{$candName}\" (applying for \"{$jobTitle}\") received President's Executive Approval: \"{$prevStatus}\" → \"Passed Final Approval\". Officially Hired. 1 job opening deducted. Pre-employment requirements issued.";
                $sendHireNotifications = true;

                // Slot deduction for the job opening
                if ($jobId > 0) {
                    $decStmt = $pdo->prepare("UPDATE jobs_tbl SET availability = availability - 1 WHERE job_id = ? AND availability > 0");
                    $decStmt->execute([$jobId]);

                    $checkStmt = $pdo->prepare("SELECT availability FROM jobs_tbl WHERE job_id = ?");
                    $checkStmt->execute([$jobId]);
                    $jobData = $checkStmt->fetch(PDO::FETCH_ASSOC);

                    if ($jobData && (int)$jobData['availability'] <= 0) {
                        $closeStmt = $pdo->prepare("UPDATE jobs_tbl SET status = 'Closed' WHERE job_id = ?");
                        $closeStmt->execute([$jobId]);

                        $autoArchStmt = $pdo->prepare("
                            UPDATE applications_tbl 
                            SET is_archived = 1 
                            WHERE job_id = ? 
                            AND UPPER(status) IN ('HIRED', 'PASSED FINAL APPROVAL', 'FAILED FINAL APPROVAL', 'FAILED FINAL INTERVIEW', 'REJECTED', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'DECLINED - UNRESPONSIVE', 'CANDIDATE WITHDREW')
                        ");
                        $autoArchStmt->execute([$jobId]);
                    }
                }
                break;

            case 'FAIL_FINAL_APPROVAL':
            case 'Failed Final Approval':
                $statusToSave = 'Failed Final Approval';
                $severity = 'Warning';
                $respMsg = "Candidate marked as Failed Final Approval by President.";
                $details = "Candidate \"{$candName}\" (applying for \"{$jobTitle}\") was not approved at President's Final Approval: \"{$prevStatus}\" → \"Failed Final Approval\".";
                break;

            case 'VERIFY_REQUIREMENTS':
            case 'Requirements Verified':
            case 'REQUIREMENTS_VERIFIED':
            case 'VERIFY_ALL_REQUIREMENTS':
                $statusToSave = 'Requirements Verified';
                $respMsg = "All 7 pre-employment requirements verified for {$candName}. Ready to schedule contract signing.";
                $details = "Verified all 7 pre-employment physical documents for candidate \"{$candName}\" (applying for \"{$jobTitle}\"): Status set to \"Requirements Verified\".";
                
                if ($userId > 0) {
                    $notifTitle = "Requirements Verified - Next: Contract Signing";
                    $notifMsg = "Your physical pre-employment requirements have been verified. Our HR team will schedule your contract signing appointment shortly.";
                    $notifStmt = $pdo->prepare("
                        INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                        VALUES (?, ?, ?, ?, 'requirements_verified', '/application-status', 0, NOW())
                    ");
                    $notifStmt->execute([$userId, $application_id, $notifTitle, $notifMsg]);
                }
                break;

            case 'CONTRACT_SIGNED':
            case 'Contract Signed & Onboarded':
            case 'CONTRACT_SIGNED_AND_ONBOARDED':
            case 'Officially Hired & Signed':
                $statusToSave = 'Contract Signed & Onboarded';
                $respMsg = "Contract confirmed signed for {$candName}. Candidate officially onboarded!";
                $details = "Candidate \"{$candName}\" (applying for \"{$jobTitle}\") completed contract signing and onboarding: Status set to \"Contract Signed & Onboarded\".";
                
                // 1. In-App Notification
                if ($userId > 0) {
                    $notifTitle = "Welcome to Airship Express! Officially Hired & Onboarded";
                    $notifMsg = "Congratulations {$candName}! Your employment contract for {$jobTitle} has been executed. You are officially hired! Your new hire training will begin the following next week. Your HR onboarding coordinator will provide your first-day reporting instructions and orientation schedule.";
                    $notifStmt = $pdo->prepare("
                        INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                        VALUES (?, ?, ?, ?, 'contract_signed', '/application-status', 0, NOW())
                    ");
                    $notifStmt->execute([$userId, $application_id, $notifTitle, $notifMsg]);
                }

                // 2. Email Delivery via PHPMailer
                if (!empty($candEmail) && filter_var($candEmail, FILTER_VALIDATE_EMAIL)) {
                    try {
                        $mail = new PHPMailer(true);
                        $mail->isSMTP();
                        $mail->Host       = 'smtp.gmail.com';
                        $mail->SMTPAuth   = true;
                        $mail->Username   = 'airshipexpress2026@gmail.com';
                        $mail->Password   = 'vyqf gsmv vryc ftic';
                        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
                        $mail->Port       = 587;
                        $mail->CharSet    = 'UTF-8';
                        $mail->Encoding   = 'base64';

                        $mail->setFrom('airshipexpress2026@gmail.com', 'Airship Express HR');
                        $mail->addAddress($candEmail, $candName);

                        $mail->isHTML(true);
                        $mail->Subject = "Welcome to Airship Express! Employment Contract Executed - {$jobTitle}";

                        $mail->Body = "
                        <div style='font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff; color: #0f172a;'>
                            <div style='text-align: center; border-bottom: 2px solid #059669; padding-bottom: 20px;'>
                                <h2 style='color: #059669; margin: 0; font-family: Montserrat, Arial, sans-serif; font-size: 22px; letter-spacing: 1px;'>AIRSHIP EXPRESS</h2>
                                <p style='color: #64748b; margin: 4px 0 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;'>Official Notice of Onboarding & Training</p>
                            </div>

                            <div style='padding: 24px 0;'>
                                <p style='font-size: 15px; color: #0f172a; margin-top: 0;'>Dear <strong>{$candName}</strong>,</p>
                                
                                <p style='font-size: 14.5px; color: #334155; line-height: 1.6;'>
                                    Congratulations! Your employment contract for <strong>{$jobTitle}</strong> has been executed, and your pre-employment onboarding is officially completed. Welcome to the Airship Express team!
                                </p>

                                <div style='background: #f0fdf4; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px 20px; margin: 22px 0;'>
                                    <p style='margin: 0; font-size: 14px; color: #065f46; font-weight: 700;'>
                                        New Hire Training Schedule:
                                    </p>
                                    <p style='margin: 6px 0 0 0; font-size: 13.5px; color: #166534; line-height: 1.5;'>
                                        Your comprehensive new hire training will begin <strong>the following next week</strong>. Your HR onboarding coordinator will provide your first-day reporting instructions and orientation schedule.
                                    </p>
                                </div>

                                <div style='text-align: center; margin: 28px 0 16px 0;'>
                                    <a href='http://localhost:5173/application-status' style='background-color: #059669; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;'>
                                        View Application Status & Profile
                                    </a>
                                </div>
                            </div>

                            <div style='border-top: 1px solid #e2e8f0; padding-top: 18px; text-align: center; font-size: 12px; color: #94a3b8;'>
                                <p style='margin: 0 0 4px 0;'>Airship Express Recruitment & HR Department</p>
                                <p style='margin: 0;'>This is an automated notification. Please do not reply directly to this email.</p>
                            </div>
                        </div>
                        ";

                        $mail->send();
                    } catch (\Exception $emailEx) {
                        error_log("Email sending error on Contract Signed: " . $emailEx->getMessage());
                    }
                }
                break;

            default:
                $statusToSave = $result;
                $details = "Updated candidate \"{$candName}\" status: \"{$prevStatus}\" → \"{$statusToSave}\".";
                $respMsg = "Status updated to {$statusToSave}.";
                break;
        }

        $stmt = $pdo->prepare("UPDATE applications_tbl SET status = ?, updated_at = NOW() WHERE application_id = ?");
        $stmt->execute([$statusToSave, $application_id]);

        log_system_audit($pdo, $actor_id, $actor_name, $auditCategory, 'Evaluation Module', $details, $severity);

        // ── In-App Notification & Email Delivery on Passing Final Approval (Hired) ──
        if ($sendHireNotifications) {
            // 1. In-App Notification
            if ($userId > 0) {
                $reqSummary = "Please submit the following physical documents to HR by {$deadlineDate}:\n1. Medical Certificate (Fit to Work)\n2. Drug Test Result\n3. NBI Clearance\n4. Police Clearance\n5. Certificate of Employment (if applicable)\n6. Transcript of Records (TOR) or Diploma";
                $hireNotifTitle = "Congratulations! You are Officially Hired - Pre-Employment Requirements";
                $notifStmt = $pdo->prepare("
                    INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'hired', '/application-status', 0, NOW())
                ");
                $notifStmt->execute([$userId, $application_id, $hireNotifTitle, $reqSummary]);
            }

            // 2. Email Delivery via PHPMailer
            if (!empty($candEmail) && filter_var($candEmail, FILTER_VALIDATE_EMAIL)) {
                try {
                    $mail = new PHPMailer(true);
                    $mail->isSMTP();
                    $mail->Host       = 'smtp.gmail.com';
                    $mail->SMTPAuth   = true;
                    $mail->Username   = 'nathanielferrer691@gmail.com';
                    $mail->Password   = 'enzc ppph jran heso';
                    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
                    $mail->Port       = 587;

                    $mail->CharSet    = 'UTF-8';
                    $mail->Encoding   = 'base64';

                    $mail->setFrom('nathanielferrer691@gmail.com', 'Airship Express Hiring Portal');
                    $mail->addAddress($candEmail, $candName);

                    $mail->isHTML(true);
                    $mail->Subject = "Congratulations! Official Job Offer & Requirements Checklist - Airship Express";

                    $mail->Body = "
                    <div style='font-family: Arial, Helvetica, sans-serif; max-width: 620px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff; color: #0f172a;'>
                        <div style='text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px;'>
                            <h2 style='color: #e6007e; margin: 0; font-family: Montserrat, Arial, sans-serif; font-size: 22px; letter-spacing: 1px;'>AIRSHIP EXPRESS</h2>
                            <p style='color: #64748b; margin: 4px 0 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;'>Official Notice of Employment</p>
                        </div>

                        <div style='padding: 24px 0;'>
                            <p style='font-size: 15px; color: #0f172a; margin-top: 0;'>Dear <strong>{$candName}</strong>,</p>
                            
                            <p style='font-size: 14.5px; color: #334155; line-height: 1.6;'>
                                On behalf of <strong>Airship Express</strong>, we are pleased to inform you that your application for the <strong>{$jobTitle}</strong> position has received <strong>Final Executive Approval</strong>.
                            </p>

                            <p style='font-size: 14.5px; color: #334155; line-height: 1.6;'>
                                You have successfully completed all screening and interview stages of our recruitment process. Welcome to the Airship Express team!
                            </p>

                            <div style='background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin: 22px 0;'>
                                <p style='margin: 0; font-size: 13.5px; color: #0f172a; font-weight: 700;'>
                                    Submission Deadline: {$deadlineDate} (Within 7 Calendar Days)
                                </p>
                                <p style='margin: 6px 0 0 0; font-size: 13px; color: #475569; line-height: 1.5;'>
                                    Since your hiring was confirmed today ({$todayDay}), please bring and submit all physical documents listed below to the HR Department on or before next week ({$deadlineDate}).
                                </p>
                            </div>

                            <p style='font-size: 14px; font-weight: 700; color: #0f172a; margin: 20px 0 10px 0;'>
                                Mandatory Pre-Employment Documents:
                            </p>

                            <ol style='margin: 0 0 22px 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.8;'>
                                <li><strong>Medical Certificate</strong> - Fit to Work assessment from an accredited clinic</li>
                                <li><strong>Drug Test Result</strong> - Official negative screening from an accredited diagnostic center</li>
                                <li><strong>NBI Clearance</strong> - Valid and updated original copy</li>
                                <li><strong>Police Clearance</strong> - Issued by your local police station / precinct</li>
                                <li><strong>Certificate of Employment (COE)</strong> - From previous employer (if applicable)</li>
                                <li><strong>Transcript of Records (TOR) or Diploma</strong> - Photocopy (bring original for verification)</li>
                            </ol>

                            <div style='text-align: center; margin: 28px 0 16px 0;'>
                                <a href='http://localhost:5173/application-status' style='background-color: #e6007e; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;'>
                                    View Application Status & Checklist
                                </a>
                            </div>
                        </div>

                        <div style='border-top: 1px solid #e2e8f0; padding-top: 18px; text-align: center; font-size: 12px; color: #94a3b8;'>
                            <p style='margin: 0 0 4px 0;'>Airship Express Recruitment & HR Department</p>
                            <p style='margin: 0;'>This is an automated notification. Please do not reply directly to this email.</p>
                        </div>
                    </div>
                    ";

                    $mail->send();
                } catch (Exception $emailEx) {
                    error_log("Email sending error on Passed Final Approval: " . $emailEx->getMessage());
                }
            }
        }
    }

    $pdo->commit();

    echo json_encode([
        "status" => "success",
        "message" => $respMsg
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
