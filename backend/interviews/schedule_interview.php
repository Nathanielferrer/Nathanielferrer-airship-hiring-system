<?php
require_once __DIR__ . '/../db.php';

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
$requirements = isset($data['requirements']) ? $data['requirements'] : [];

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
    $link = "/applicant-dashboard";

    $insertNotif = $pdo->prepare("INSERT INTO notifications_tbl (user_id, application_id, title, message, link) VALUES (:user_id, :app_id, :title, :msg, :link)");
    $insertNotif->execute([
        'user_id' => $userId,
        'app_id'  => $applicationId,
        'title' => $title,
        'msg' => $message,
        'link' => $link
    ]);

    $pdo->commit();

    // Fetch candidate email
    $emailStmt = $pdo->prepare("SELECT a.candidate_email, u.User_Email, u.User_Fname FROM applications_tbl a INNER JOIN users_tbl u ON a.user_id = u.user_id WHERE a.application_id = :id");
    $emailStmt->execute(['id' => $applicationId]);
    $emailData = $emailStmt->fetch();
    
    if ($emailData) {
        $toEmail = !empty($emailData['candidate_email']) ? $emailData['candidate_email'] : $emailData['User_Email'];
        
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

            $mail->setFrom('nathanielferrer691@gmail.com', 'Airship Express Recruitment');
            $mail->addAddress($toEmail, $emailData['User_Fname']);

            $mail->isHTML(true);
            $mail->Subject = 'Interview Scheduled - Airship Express';
            
            $reqHtml = "<ol style='margin: 0; padding-left: 20px; line-height: 1.6;'>";
            foreach($requirements as $r) {
                $reqHtml .= "<li>" . htmlspecialchars($r) . "</li>";
            }
            $reqHtml .= "</ol>";

            $mail->Body = "
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e4e7; border-radius: 8px;'>
                <h2 style='color: #e6007e; margin-top: 0; font-family: Montserrat, Arial, sans-serif;'>Airship Express - Interview Scheduled</h2>
                <p>Hello " . htmlspecialchars($emailData['User_Fname']) . ",</p>
                <p>We are pleased to inform you that your interview has been scheduled.</p>
                <div style='background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 20px 0;'>
                    <p style='margin: 5px 0;'><strong>Date:</strong> " . date("F j, Y", strtotime($date)) . "</p>
                    <p style='margin: 5px 0;'><strong>Time:</strong> " . date("g:i A", strtotime($time)) . "</p>
                    <p style='margin: 5px 0;'><strong>Location:</strong> " . htmlspecialchars($location) . "</p>
                </div>
                <p><strong>Requirements to Bring:</strong></p>
                $reqHtml
                <p>Best regards,<br>Airship Express Recruitment Team</p>
            </div>
            ";
            
            $mail->send();
        } catch (Exception $e) {
            error_log("Email could not be sent. Mailer Error: {$mail->ErrorInfo}");
        }
    }

    echo json_encode([
        "status" => "success",
        "message" => "Interview scheduled successfully and applicant notified."
    ]);

} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Transaction failed: " . $e->getMessage()]);
}
?>
