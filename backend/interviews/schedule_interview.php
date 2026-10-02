<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../email_helper.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../libs/PHPMailer/src/Exception.php';
require_once __DIR__ . '/../libs/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/../libs/PHPMailer/src/SMTP.php';

header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$applicationId = isset($data['application_id']) ? intval($data['application_id']) : (isset($data['id']) ? intval($data['id']) : 0);
$userId = isset($data['user_id']) ? intval($data['user_id']) : 0;
$slot_id = isset($data['slot_id']) ? intval($data['slot_id']) : 0;
$location = isset($data['location']) ? trim($data['location']) : 'Main Office';
$requirements = isset($data['requirements']) && !empty($data['requirements']) ? $data['requirements'] : ["Printed Resume"];

if ($applicationId <= 0 || $userId <= 0 || $slot_id <= 0) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid scheduling parameters."]);
    exit();
}

try {
    $pdo->beginTransaction();

    // Fetch slot details
    $slotStmt = $pdo->prepare("SELECT slot_date as date, start_time, end_time FROM interview_slots_tbl WHERE slot_id = :slot_id AND status = 'Open'");
    $slotStmt->execute(['slot_id' => $slot_id]);
    $slot = $slotStmt->fetch();

    if (!$slot) {
        throw new Exception("Slot is no longer available.");
    }

    $date = $slot['date'];
    $time = $slot['start_time'];

    // 1. Book the slot
    $bookSlotStmt = $pdo->prepare("UPDATE interview_slots_tbl SET status = 'Booked', application_id = :app_id WHERE slot_id = :slot_id");
    $bookSlotStmt->execute(['app_id' => $applicationId, 'slot_id' => $slot_id]);

    // 2. Update application status
    $updateStmt = $pdo->prepare("UPDATE applications_tbl SET status = 'INTERVIEW_SCHEDULED' WHERE application_id = :id");
    $updateStmt->execute(['id' => $applicationId]);

    // 3. Insert interview details
    $reqJson = json_encode($requirements);
    $insertInterview = $pdo->prepare("INSERT INTO interviews_tbl (application_id, scheduled_date, scheduled_time, location, requirements) VALUES (:app_id, :date, :time, :loc, :req)");
    $insertInterview->execute([
        'app_id' => $applicationId,
        'date' => $date,
        'time' => $time,
        'loc' => $location,
        'req' => $reqJson
    ]);

    // 4. Create notification for applicant
    $title = "Interview Scheduled";
    $message = "Your interview is set for " . date("F j, Y", strtotime($date)) . " at " . date("g:i A", strtotime($time)) . ". Please review the requirements.";
    $link = "/application-status";

    $insertNotif = $pdo->prepare("INSERT INTO notifications_tbl (user_id, application_id, title, message, link) VALUES (:user_id, :app_id, :title, :msg, :link)");
    $insertNotif->execute([
        'user_id' => $userId,
        'app_id'  => $applicationId,
        'title' => $title,
        'msg' => $message,
        'link' => $link
    ]);

    $pdo->commit();

    // Fetch candidate and job info for email notification
    $emailStmt = $pdo->prepare("
        SELECT a.candidate_email, a.candidate_name, u.User_Email, u.User_Fname, u.User_Lname, j.title AS job_title
        FROM applications_tbl a 
        INNER JOIN users_tbl u ON a.user_id = u.user_id 
        LEFT JOIN jobs_tbl j ON a.job_id = j.job_id
        WHERE a.application_id = :id
    ");
    $emailStmt->execute(['id' => $applicationId]);
    $emailData = $emailStmt->fetch();
    
    if ($emailData) {
        $toEmail  = !empty($emailData['candidate_email']) ? $emailData['candidate_email'] : $emailData['User_Email'];
        $toName   = !empty($emailData['candidate_name']) ? $emailData['candidate_name'] : trim(($emailData['User_Fname'] ?? '') . ' ' . ($emailData['User_Lname'] ?? ''));
        $jobTitle = $emailData['job_title'] ?? 'the position';
        
        try {
            sendInterviewScheduleEmail($toEmail, $toName, $jobTitle, $date, $time, '', $location);
        } catch (\Throwable $e) {
            error_log("Email could not be sent in schedule_interview.php. Error: " . $e->getMessage());
        }
    }

    $candName = trim(($emailData['User_Fname'] ?? '') . ' ' . ($emailData['User_Lname'] ?? ''));
    $candName = $candName ?: 'Candidate';
    echo json_encode([
        "status"         => "success",
        "message"        => "Interview Scheduled. {$candName} moved to Final Interview.",
        "candidate_name" => $candName
    ]);

} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Transaction failed: " . $e->getMessage()]);
}
?>
