<?php
// Include database connection (which sets CORS headers)
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../rate_limit.php';
require_once __DIR__ . '/../email_helper.php';

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

    // 7. Send Verification Email using centralized email helper
    $fullName = trim($fname . ' ' . $lname) ?: 'Applicant';
    sendRegistrationVerificationEmail($email, $fullName, $verificationCode);

    echo json_encode([
        "status" => "success",
        "message" => "Registration successful. Please check your email to verify your account."
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database Error: " . $e->getMessage()
    ]);
}
