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
$fname    = isset($_POST['User_Fname'])    ? trim($_POST['User_Fname'])    : '';
$minitial = isset($_POST['User_MInitial']) ? strtoupper(trim(str_replace('.', '', $_POST['User_MInitial']))) : (isset($_POST['middle_initial']) ? strtoupper(trim(str_replace('.', '', $_POST['middle_initial']))) : null);
$minitial = ($minitial !== '' && $minitial !== null) ? substr($minitial, 0, 1) : null;
$lname    = isset($_POST['User_Lname'])    ? trim($_POST['User_Lname'])    : '';
$email    = isset($_POST['User_Email'])    ? trim($_POST['User_Email'])    : '';
$mobile   = isset($_POST['User_Mobile']) && trim($_POST['User_Mobile']) !== '' ? trim($_POST['User_Mobile']) : null;
$pass     = isset($_POST['User_Pass'])     ? $_POST['User_Pass']           : '';
$bday     = isset($_POST['User_Bday'])     ? trim($_POST['User_Bday'])     : '';
$gender   = isset($_POST['User_Gender'])   ? trim($_POST['User_Gender'])   : '';

// 2. Server-side Validation
if (empty($fname) || empty($lname) || empty($email) || empty($pass) || empty($bday) || empty($gender)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "All required fields must be filled. Please complete the form."
    ]);
    exit();
}

// First name validation: 2 - 50 characters, letters, spaces, hyphen, apostrophe, period
if (mb_strlen($fname) < 2 || mb_strlen($fname) > 50 || !preg_match("/^[a-zA-Z\s\-'\.]+$/", $fname)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "First name must be between 2 and 50 characters and can only contain letters, spaces, hyphens, apostrophes, and periods."
    ]);
    exit();
}

// Last name validation: 2 - 50 characters, same rules as first name
if (mb_strlen($lname) < 2 || mb_strlen($lname) > 50 || !preg_match("/^[a-zA-Z\s\-'\.]+$/", $lname)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Last name must be between 2 and 50 characters and can only contain letters, spaces, hyphens, apostrophes, and periods."
    ]);
    exit();
}

// Middle initial validation: optional, max 1 letter only
if ($minitial !== null && !preg_match("/^[a-zA-Z]?$/", $minitial)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Middle initial must be a single letter only."
    ]);
    exit();
}

// Email validation
if (strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Please enter a valid email address (max 254 characters)."
    ]);
    exit();
}

// Password validation: min 8, max 64 characters, allow all characters including spaces, enforce strength
$passLen = strlen($pass);
if ($passLen < 8 || $passLen > 64) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Password must be between 8 and 64 characters long."
    ]);
    exit();
}

$hasUpper   = preg_match('/[A-Z]/', $pass);
$hasLower   = preg_match('/[a-z]/', $pass);
$hasNumSpec = preg_match('/[0-9]/', $pass) && preg_match('/[^A-Za-z0-9]/', $pass);
if (!$hasUpper || !$hasLower || !$hasNumSpec) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Password must contain uppercase, lowercase, and a number with special character."
    ]);
    exit();
}

// Server-side Date of Birth validation
$bdayTimestamp = strtotime($bday);
if ($bdayTimestamp === false) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Please enter a valid date of birth."
    ]);
    exit();
}

$bdayYear = (int)date('Y', $bdayTimestamp);
$currentYear = (int)date('Y');

if ($bdayYear < 1900 || $bdayYear > $currentYear) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Date of birth year must be between 1900 and $currentYear."
    ]);
    exit();
}

// Minimum age check (15 years - Philippine minimum working age)
$bdayDateObj = new DateTime($bday);
$todayObj = new DateTime('today');
$age = $todayObj->diff($bdayDateObj)->y;
if ($age < 15) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "You must be at least 15 years old to create an account."
    ]);
    exit();
}

try {
    // ── Rate Limiting: 15 registration attempts per hour per IP ─────────────
    // Guest users have no user_id yet, so we track by IP address.
    // A generous limit of 15/hour stops bot spam while allowing shared Wi-Fi users.
    require_once '../rate_limit.php';
    check_rate_limit($pdo, 'register', 15, 60, 'ip');

    // 3. Check if email already exists
    // SECURITY CONCEPT 1 / SQL INJECTION PREVENTION (Syntax explanation):
    // - $pdo->prepare(): Compiles the SQL query template first.
    // - :email placeholder: Separates the SQL query structure from raw input data.
    // - $stmt->execute(['email' => $email]): Binds the variable safely, making SQL Injection impossible.
    $stmt = $pdo->prepare("SELECT user_id FROM users_tbl WHERE User_Email = :email");
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
    $sql = "INSERT INTO users_tbl (
                User_Fname, User_MInitial, User_Lname, User_Email, User_Mobile, 
                User_Pass, User_Bday, User_Gender, is_verified, 
                verification_code, verification_token, is_admin
            ) VALUES (
                :fname, :minitial, :lname, :email, :mobile, 
                :pass, :bday, :gender, 0, 
                :code, :token, 0
            )";
    
    $insertStmt = $pdo->prepare($sql);
    $insertStmt->execute([
        'fname'    => $fname,
        'minitial' => $minitial,
        'lname'    => $lname,
        'email'    => $email,
        'mobile'   => $mobile,
        'pass'     => $hashedPassword,
        'bday'     => $bday,
        'gender'   => $gender,
        'code'     => $verificationCode,
        'token'    => $verificationCode
    ]);

    // 7. Send Verification Email using PHPMailer
    $mail = new PHPMailer(true);

    // SMTP Configuration — credentials loaded from .env via env_loader
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
    $mail->Timeout    = 10;
    $mail->SMTPOptions = [
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true
        ]
    ];

    $mail->CharSet    = 'UTF-8';
    $mail->Encoding   = 'base64';

    // Sender & Recipient Settings
    $mail->setFrom($mail->Username, 'Airship Express Hiring Portal');
    $mail->addAddress($email, $fname . ' ' . $lname);

    // Email Body Content
    $mail->isHTML(true);
    $mail->Subject = 'Verify Your Email Address - Airship Express';

    $verificationLink = get_frontend_url() . "/verify?token=" . $verificationCode;

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
