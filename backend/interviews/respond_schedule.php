<?php
require_once '../db.php';
header('Content-Type: application/json');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$applicationId = isset($data['application_id']) ? intval($data['application_id']) : 0;
$userId        = isset($data['user_id'])        ? intval($data['user_id'])        : 0;
$action        = isset($data['action'])         ? trim($data['action'])           : ''; // 'confirm' or 'reschedule'

if ($applicationId <= 0 || $userId <= 0 || !in_array($action, ['confirm', 'reschedule'])) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid parameters."]);
    exit();
}

try {
    // Security: verify ownership
    $appStmt = $pdo->prepare("SELECT id, status FROM applications WHERE id = :app_id AND user_id = :user_id");
    $appStmt->execute(['app_id' => $applicationId, 'user_id' => $userId]);
    $app = $appStmt->fetch();

    if (!$app) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "Unauthorized."]);
        exit();
    }

    if ($app['status'] !== 'PENDING SCHEDULED') {
        echo json_encode(["status" => "error", "message" => "This interview is already confirmed or processed."]);
        exit();
    }

    if ($action === 'confirm') {
        // Mark as CONFIRMED
        $pdo->prepare("UPDATE applications SET status = 'CONFIRMED' WHERE id = :id")->execute(['id' => $applicationId]);

        // Insert admin notification (optional – notify admin that candidate confirmed)
        // For now just update application status

        echo json_encode([
            "status"  => "success",
            "message" => "You have confirmed your schedule. See you there!"
        ]);

    } elseif ($action === 'reschedule') {
        $reason = isset($data['reason']) ? trim($data['reason']) : '';
        $slotId = isset($data['slot_id']) && intval($data['slot_id']) > 0
            ? intval($data['slot_id'])
            : (isset($data['requested_slot_id']) && intval($data['requested_slot_id']) > 0 ? intval($data['requested_slot_id']) : null);

        // Mark as RESCHEDULING and store reason & requested slot
        $stmt = $pdo->prepare("UPDATE applications SET status = 'RESCHEDULING', reschedule_reason = :reason, reschedule_requested_slot_id = :slot_id WHERE id = :id");
        $stmt->execute([
            'reason' => $reason,
            'slot_id' => $slotId,
            'id' => $applicationId
        ]);

        // Free the previous slot
        $pdo->prepare("UPDATE interview_slots SET status = 'Open', applicant_id = NULL WHERE applicant_id = :app_id")->execute(['app_id' => $applicationId]);

        // Notify applicant that request was received
        $pdo->prepare("
            INSERT INTO notifications (user_id, application_id, title, message, type, link, is_read)
            VALUES (:user_id, :app_id, 'Reschedule Request Received', 'Your request to reschedule your interview has been noted. Our recruitment team will reach out to you with a new schedule shortly.', 'reschedule_requested', '/applicant-dashboard', 0)
        ")->execute(['user_id' => $userId, 'app_id' => $applicationId]);

        echo json_encode([
            "status"  => "success",
            "message" => "Your reschedule request has been submitted. Our recruitment team will contact you with a new schedule."
        ]);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Action failed: " . $e->getMessage()]);
}
?>
