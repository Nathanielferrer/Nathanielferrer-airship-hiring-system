<?php
// Include database connection (which sets CORS headers)
require_once '../db.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

// Autoload PHPMailer classes manually since we are using Vanilla PHP
require '../libs/PHPMailer/src/Exception.php';
require '../libs/PHPMailer/src/PHPMailer.php';
require '../libs/PHPMailer/src/SMTP.php';

// Disable HTML error output to prevent JSON corruption
ini_set('display_errors', 0);

// Set response format to JSON
header('Content-Type: application/json');

// Handle JSON input from React frontend (Axios/Fetch)
$json = file_get_contents('php://input');
$data = json_decode($json, true);
if ($data) {
    $_POST = array_merge($_POST, $data);
}

// 1. Collect POST input
$fname  = isset($_POST['User_Fname'])  ? trim($_POST['User_Fname'])  : '';
$lname  = isset($_POST['User_Lname'])  ? trim($_POST['User_Lname'])  : '';
$email  = isset($_POST['User_Email'])  ? trim($_POST['User_Email'])  : '';
$mobile = isset($_POST['User_Mobile']) ? trim($_POST['User_Mobile']) : '';
$pass   = isset($_POST['User_Pass'])   ? $_POST['User_Pass']         : '';
$bday   = isset($_POST['User_Bday'])   ? trim($_POST['User_Bday'])   : '';
$gender = isset($_POST['User_Gender']) ? trim($_POST['User_Gender']) : '';

// 2. Server-side Validation
// SECURITY CONCEPT 1 (Syntax explanation):
// - empty(): Built-in PHP function checks if variable is null, empty string, or false.
// - filter_var($email, FILTER_VALIDATE_EMAIL): Validates the string against RFC email standards on the server side.
// - strlen($pass) < 6: Measures the raw string length to enforce password strength rules on the server.
if (empty($fname) || empty($lname) || empty($email) || empty($mobile) || empty($pass) || empty($bday) || empty($gender)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "All fields are required. Please fill in the entire form."
    ]);
    exit();
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Please enter a valid email address."
    ]);
    exit();
}

if (strlen($pass) < 6) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Password must be at least 6 characters long."
    ]);
    exit();
}

try {
    // 3. Check if email already exists
    // SECURITY CONCEPT 1 / SQL INJECTION PREVENTION (Syntax explanation):
    // - $pdo->prepare(): Compiles the SQL query template first.
    // - :email placeholder: Separates the SQL query structure from raw input data.
    // - $stmt->execute(['email' => $email]): Binds the variable safely, making SQL Injection impossible.
    $stmt = $pdo->prepare("SELECT User_ID FROM user WHERE User_Email = :email");
    $stmt->execute(['email' => $email]);
    if ($stmt->fetch()) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "An account with this email address already exists."
        ]);
        exit();
    }

    // 4. Secure password hashing
    // SECURITY CONCEPT 2 (Syntax explanation):
    // - password_hash(): PHP built-in function that secure-hashes plain text passwords.
    // - PASSWORD_BCRYPT: Uses the industry-standard bcrypt algorithm to output a secure 60-character hash string.
    $hashedPassword = password_hash($pass, PASSWORD_BCRYPT);

    // 5. Generate a unique 64-character verification code
    // SECURITY CONCEPT 5 (Syntax explanation):
    // - random_bytes(32): Generates cryptographically secure pseudo-random bytes.
    // - bin2hex(): Converts binary bytes to a 64-character hex string to prevent token guessing.
    $verificationCode = bin2hex(random_bytes(32)); // 32 bytes = 64 characters

    // SECURITY CONCEPT 3 (Syntax explanation):
    // - Hardcoded '0' for is_admin: The registration query forces 'is_admin = 0' on line insertion.
    //   This prevents clients from self-promoting or submitting parameters to escalate role privileges.
    $sql = "INSERT INTO user (
                User_Fname, User_Lname, User_Email, User_Mobile, 
                User_Pass, User_Bday, User_Gender, is_verified, 
                verified, verification_code, verification_token, is_admin
            ) VALUES (
                :fname, :lname, :email, :mobile, 
                :pass, :bday, :gender, 0, 
                0, :code, :token, 0
            )";
    
    $insertStmt = $pdo->prepare($sql);
    $insertStmt->execute([
        'fname'  => $fname,
        'lname'  => $lname,
        'email'  => $email,
        'mobile' => $mobile,
        'pass'   => $hashedPassword,
        'bday'   => $bday,
        'gender' => $gender,
        'code'   => $verificationCode,
        'token'  => $verificationCode
    ]);

    // 7. Send Verification Email using PHPMailer
    $mail = new PHPMailer(true);

    // SMTP Configuration for Gmail
    $mail->isSMTP();
    $mail->Host       = 'smtp.gmail.com';
    $mail->SMTPAuth   = true;

    // ==========================================
    // !!! CRITICAL: INSERT YOUR GMAIL CREDENTIALS HERE !!!
    // ==========================================
    $mail->Username   = 'nathanielferrer691@gmail.com';     // Replace with your Gmail address
    $mail->Password   = 'enzc ppph jran heso';         // Replace with your 16-character Google App Password
    // ==========================================

    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = 587;

    $mail->CharSet    = 'UTF-8';
    $mail->Encoding   = 'base64';

    // Sender & Recipient Settings
    $mail->setFrom('nathanielferrer691@gmail.com', 'Airship Express Hiring Portal');
    $mail->addAddress($email, $fname . ' ' . $lname);

    // Email Body Content
    $mail->isHTML(true);
    $mail->Subject = 'Verify Your Email Address - Airship Express';
    
    $verificationLink = "http://localhost:5173/verify?token=" . $verificationCode;

    // Clean, modern CSS styled email matching Airship Express brand
    $mail->Body = "
    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e4e7; border-radius: 8px; background-color: #ffffff;'>
        <div style='text-align: center; border-bottom: 1px solid #e5e4e7; padding-bottom: 20px;'>
            <h2 style='color: #e6007e; margin: 0; font-family: Montserrat, Arial, sans-serif;'>AIRSHIP EXPRESS</h2>
            <p style='color: #64748b; margin: 5px 0 0 0;'>Hiring Management Portal</p>
        </div>
        <div style='padding: 20px 0;'>
            <p style='font-size: 16px; color: #1e293b;'>Hello " . htmlspecialchars($fname) . ",</p>
            <p style='font-size: 16px; color: #475569; line-height: 1.6;'>Thank you for registering with us! To complete your registration and activate your account, please verify your email address by clicking the button below:</p>
            <div style='text-align: center; margin: 30px 0;'>
                <a href='" . $verificationLink . "' style='background-color: #e6007e; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(230, 0, 126, 0.2);'>Verify Email Address</a>
            </div>
        </div>
        <div style='border-top: 1px solid #e5e4e7; padding-top: 20px; text-align: center; font-size: 12px; color: #9ca3af;'>
            <p style='margin: 0;'>This is an automated email, please do not reply.</p>
        </div>
    </div>
    ";

    $mail->AltBody = "Hello " . $fname . ",\n\nTo complete your registration, please verify your email address by visiting this link: " . $verificationLink;

    // Check if credentials are still placeholder templates
    $isPlaceholder = ($mail->Username === 'YOUR_GMAIL_ADDRESS@gmail.com' || $mail->Password === 'YOUR_GOOGLE_APP_PASSWORD');
    
    if ($isPlaceholder) {
        $logFile = __DIR__ . '/email_log.txt';
        $logContent = "=== VERIFICATION EMAIL (DEV PLACEHOLDER MODE) ===\n" .
                      "Date: " . date('Y-m-d H:i:s') . "\n" .
                      "To: $email ($fname $lname)\n" .
                      "Verification Link: $verificationLink\n" .
                      "================================================\n\n";
        file_put_contents($logFile, $logContent, FILE_APPEND);
        
        echo json_encode([
            "status" => "success",
            "message" => "Registration successful. [Dev Mode] Gmail placeholders detected, so the verification link was written to 'backend/email_log.txt' instead."
        ]);
        exit();
    }

    $mail->send();

    echo json_encode([
        "status" => "success",
        "message" => "Registration successful. Please check your email to verify your account."
    ]);

} catch (Exception $e) {
    // If SMTP fails, write the verification email contents to local log file instead of blocking the user
    $logFile = __DIR__ . '/email_log.txt';
    $logContent = "=== VERIFICATION EMAIL (SMTP AUTHENTICATION FAILED) ===\n" .
                  "Date: " . date('Y-m-d H:i:s') . "\n" .
                  "To: $email ($fname $lname)\n" .
                  "Verification Link: $verificationLink\n" .
                  "Mailer Error: " . $mail->ErrorInfo . "\n" .
                  "=======================================================\n\n";
    file_put_contents($logFile, $logContent, FILE_APPEND);

    echo json_encode([
        "status" => "success",
        "message" => "Registration successful! SMTP failed to authenticate, but the verification link was written to 'backend/email_log.txt'."
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database Error: " . $e->getMessage()
    ]);
}
