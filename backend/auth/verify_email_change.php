<?php
require_once '../db.php';

header('Content-Type: application/json');

// Read token from GET parameter or POST JSON body
$token = '';
if (isset($_GET['token'])) {
    $token = trim($_GET['token']);
} else {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    $token = trim($data['token'] ?? '');
}

if (empty($token)) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "Verification token is required."
    ]);
    exit();
}

try {
    // 1. Find user by pending_email_token
    $stmt = $pdo->prepare("
        SELECT user_id, User_Fname, User_Lname, User_Email, pending_email, pending_email_expires, status 
        FROM users_tbl 
        WHERE pending_email_token = ? 
        LIMIT 1
    ");
    $stmt->execute([$token]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode([
            "status"  => "error",
            "message" => "Invalid or unrecognized verification link. It may have already been used or cancelled."
        ]);
        exit();
    }

    $userId       = intval($user['user_id']);
    $pendingEmail = strtolower(trim($user['pending_email'] ?? ''));
    $expiresAt    = $user['pending_email_expires'];

    if (empty($pendingEmail)) {
        http_response_code(400);
        echo json_encode([
            "status"  => "error",
            "message" => "No pending email address change found for this account."
        ]);
        exit();
    }

    // 2. Check 24-hour expiration
    if (!empty($expiresAt) && strtotime($expiresAt) < time()) {
        // Clear expired pending token to clean up
        $clearStmt = $pdo->prepare("
            UPDATE users_tbl 
            SET pending_email = NULL, 
                pending_email_token = NULL, 
                pending_email_expires = NULL 
            WHERE user_id = ?
        ");
        $clearStmt->execute([$userId]);

        http_response_code(410);
        echo json_encode([
            "status"  => "expired",
            "message" => "This verification link has expired (24-hour limit). Please return to your Account Settings and submit a new request."
        ]);
        exit();
    }

    // 3. Double-check that the new email hasn't been registered by another user in the interim
    $chkStmt = $pdo->prepare("SELECT user_id FROM users_tbl WHERE LOWER(User_Email) = ? AND user_id != ? LIMIT 1");
    $chkStmt->execute([$pendingEmail, $userId]);
    if ($chkStmt->fetch()) {
        http_response_code(409);
        echo json_encode([
            "status"  => "error",
            "message" => "This email address is already registered to another account. Please choose a different email."
        ]);
        exit();
    }

    // 4. Atomic Resolution & Cascading Update
    $pdo->beginTransaction();

    // A. Update users_tbl official email & clear pending columns
    $updUser = $pdo->prepare("
        UPDATE users_tbl 
        SET User_Email = :new_email,
            pending_email = NULL,
            pending_email_token = NULL,
            pending_email_expires = NULL
        WHERE user_id = :uid
    ");
    $updUser->execute([
        'new_email' => $pendingEmail,
        'uid'       => $userId
    ]);

    // B. Cascading sync: Update applications_tbl.candidate_email so all ongoing/future candidate emails stay accurate
    $updApps = $pdo->prepare("
        UPDATE applications_tbl 
        SET candidate_email = :new_email,
            updated_at = NOW()
        WHERE user_id = :uid
    ");
    $updApps->execute([
        'new_email' => $pendingEmail,
        'uid'       => $userId
    ]);

    // C. Insert in-app notification
    $notifStmt = $pdo->prepare("
        INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
        VALUES (:uid, NULL, 'Email Address Updated', :msg, 'account_update', '/settings', 0, NOW())
    ");
    $notifStmt->execute([
        'uid' => $userId,
        'msg' => "Your registered account email has been successfully updated to {$pendingEmail}."
    ]);

    $pdo->commit();

    echo json_encode([
        "status"    => "success",
        "message"   => "Email address verified and updated successfully! Please log in with your updated credentials.",
        "new_email" => $pendingEmail
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        "status"  => "error",
        "message" => "Database error during email update: " . $e->getMessage()
    ]);
}
?>
