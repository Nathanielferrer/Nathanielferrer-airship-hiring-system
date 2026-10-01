<?php
// ── Error Handling: Log internally, never display to client ───────────────────
// Raw error messages can leak server paths (C:\xampp\...) and SQL schemas.
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Set default timezone to Philippines (Asia/Manila)
date_default_timezone_set('Asia/Manila');

// Load environment variables (.env file and helpers)
require_once __DIR__ . '/env_loader.php';

// CORS Headers — read allowed origins from env, fallback to localhost for dev
$origin = isset($_SERVER['HTTP_ORIGIN']) ? trim($_SERVER['HTTP_ORIGIN']) : '';
$envAllowed = getenv('ALLOWED_ORIGINS');

if ($envAllowed) {
    $rawList = array_map('trim', explode(',', $envAllowed));
    $allowed_origins = [];
    foreach ($rawList as $item) {
        $allowed_origins[] = $item;
        if (!preg_match('~^https?://~i', $item)) {
            $allowed_origins[] = 'https://' . $item;
            $allowed_origins[] = 'http://' . $item;
        }
    }
} else {
    $allowed_origins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'];
}

// Check if origin matches allowed list or is a Railway preview app
$originMatched = in_array($origin, $allowed_origins, true) ||
    (!empty($origin) && (str_ends_with($origin, '.up.railway.app') || str_ends_with($origin, '.railway.app')));

if ($originMatched) {
    header("Access-Control-Allow-Origin: $origin");
} elseif (!empty($origin)) {
    header("Access-Control-Allow-Origin: $origin");
} elseif (!empty($allowed_origins[0])) {
    $fallbackOrigin = $allowed_origins[0];
    if (!preg_match('~^https?://~i', $fallbackOrigin)) {
        $fallbackOrigin = 'https://' . $fallbackOrigin;
    }
    header("Access-Control-Allow-Origin: $fallbackOrigin");
}

header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");

// Handle preflight OPTIONS request
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Database Credentials — loaded from .env or Railway MySQL provision
define('DB_HOST', getenv('DB_HOST') ?: (getenv('MYSQLHOST') ?: '127.0.0.1'));
define('DB_PORT', getenv('DB_PORT') ?: (getenv('MYSQLPORT') ?: '3306'));
define('DB_USER', getenv('DB_USER') ?: (getenv('MYSQLUSER') ?: 'root'));
define('DB_PASS', getenv('DB_PASS') !== false ? getenv('DB_PASS') : (getenv('MYSQLPASSWORD') ?: ''));
define('DB_NAME', getenv('DB_NAME') ?: (getenv('MYSQLDATABASE') ?: 'hiring_db'));

try {
    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::ATTR_TIMEOUT            => 10, // Safe connection timeout for cloud hosting
    ];
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);

    // Compatibility with MySQL 8.0 on cloud hosts (disable ONLY_FULL_GROUP_BY and NO_ZERO_DATE errors)
    try {
        $pdo->exec("SET SESSION sql_mode = (SELECT REPLACE(REPLACE(REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY,', ''), 'ONLY_FULL_GROUP_BY', ''), 'NO_ZERO_DATE,', ''))");
    } catch (Throwable $e) {}

    // ── 1. users_tbl ─────────────────────────────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS users_tbl (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        User_Fname VARCHAR(50) NOT NULL,
        User_MInitial VARCHAR(10) DEFAULT NULL,
        User_Lname VARCHAR(50) NOT NULL,
        User_Email VARCHAR(50) NOT NULL UNIQUE,
        User_Mobile VARCHAR(20) DEFAULT NULL,
        User_Pass VARCHAR(255) NOT NULL,
        User_Bday DATE,
        User_Gender VARCHAR(50),
        Created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_admin TINYINT(1) DEFAULT 0,
        is_verified TINYINT(1) DEFAULT 0,
        verification_token VARCHAR(255) DEFAULT NULL,
        verification_code VARCHAR(64) DEFAULT NULL,
        approval_token VARCHAR(255) DEFAULT NULL,
        User_ProfilePic VARCHAR(255) DEFAULT NULL,
        reset_token VARCHAR(255) DEFAULT NULL,
        reset_expires DATETIME DEFAULT NULL,
        requires_password_reset TINYINT(1) NOT NULL DEFAULT 0,
        setup_token VARCHAR(64) DEFAULT NULL,
        setup_token_expires DATETIME DEFAULT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Active',
        pending_email VARCHAR(100) DEFAULT NULL,
        pending_email_token VARCHAR(255) DEFAULT NULL,
        pending_email_expires DATETIME DEFAULT NULL,
        INDEX idx_pending_email_token (pending_email_token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // ── 2. login_attempts_tbl ────────────────────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS login_attempts_tbl (
        attempt_id INT AUTO_INCREMENT PRIMARY KEY,
        ip_address VARCHAR(45) NOT NULL,
        email VARCHAR(255) NOT NULL,
        success TINYINT(1) NOT NULL DEFAULT 0,
        attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (ip_address),
        INDEX (email),
        INDEX (attempted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Auto-purge login_attempts_tbl records older than 24 hours to keep table lean
    $pdo->exec("DELETE FROM login_attempts_tbl WHERE attempted_at < DATE_SUB(NOW(), INTERVAL 24 HOUR);");

    // ── 3. jobs_tbl ──────────────────────────────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS jobs_tbl (
        job_id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        requirements TEXT NOT NULL,
        availability INT DEFAULT 1,
        status VARCHAR(50) DEFAULT 'Active',
        category VARCHAR(100) DEFAULT 'Operations',
        location VARCHAR(255) DEFAULT 'Airship Express HQ',
        image_path VARCHAR(255) DEFAULT NULL,
        is_archived TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // ── 4. applications_tbl ──────────────────────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS applications_tbl (
        application_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        job_id INT NOT NULL,
        resume_path VARCHAR(255) NOT NULL,
        ai_match_score INT DEFAULT NULL,
        ai_summary TEXT DEFAULT NULL,
        status VARCHAR(100) DEFAULT 'pending',
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        candidate_name VARCHAR(255) DEFAULT NULL,
        candidate_email VARCHAR(255) DEFAULT NULL,
        viewed TINYINT(1) DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_archived TINYINT(1) DEFAULT 0,
        reschedule_reason TEXT DEFAULT NULL,
        reschedule_requested_slot_id INT DEFAULT NULL,
        contract_signing_date DATE NULL,
        contract_signing_time VARCHAR(50) NULL,
        contract_signing_location VARCHAR(255) NULL,
        contract_signing_notes TEXT NULL,
        pre_employment_checklist TEXT DEFAULT NULL,
        withdrawn_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users_tbl(user_id) ON DELETE CASCADE,
        FOREIGN KEY (job_id) REFERENCES jobs_tbl(job_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // ── 5. interviews_tbl ────────────────────────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS interviews_tbl (
        interview_id INT AUTO_INCREMENT PRIMARY KEY,
        application_id INT NOT NULL,
        scheduled_date DATE NOT NULL,
        scheduled_time TIME NOT NULL,
        location VARCHAR(255) NOT NULL,
        requirements TEXT NOT NULL,
        event_type VARCHAR(50) DEFAULT 'interview',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES applications_tbl(application_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // ── 6. interview_slots_tbl ───────────────────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS interview_slots_tbl (
        slot_id INT AUTO_INCREMENT PRIMARY KEY,
        slot_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        duration_minutes INT DEFAULT 30,
        status ENUM('Open', 'Booked') DEFAULT 'Open',
        application_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES applications_tbl(application_id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // ── 7. notifications_tbl ─────────────────────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS notifications_tbl (
        notification_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'general',
        application_id INT DEFAULT NULL,
        link VARCHAR(255) DEFAULT '',
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users_tbl(user_id) ON DELETE CASCADE,
        FOREIGN KEY (application_id) REFERENCES applications_tbl(application_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // ── 8. system_audit_logs_tbl ─────────────────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS system_audit_logs_tbl (
        log_id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT NOT NULL,
        admin_name VARCHAR(255) NOT NULL,
        action_category VARCHAR(100) NOT NULL,
        module VARCHAR(100) NOT NULL,
        details TEXT NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (admin_id),
        INDEX (action_category),
        INDEX (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // ── 9. chatbot_knowledge_base_tbl ────────────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS chatbot_knowledge_base_tbl (
        kb_id INT AUTO_INCREMENT PRIMARY KEY,
        primary_question TEXT NOT NULL,
        predefined_answer TEXT NOT NULL,
        keyword_tags VARCHAR(500) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FULLTEXT(primary_question, keyword_tags)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // ── 10. chatbot_unresolved_queries_tbl ───────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS chatbot_unresolved_queries_tbl (
        query_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        raw_question_text TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending review',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users_tbl(user_id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // ── 11. chatbot_history_tbl ──────────────────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS chatbot_history_tbl (
        chat_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        sender ENUM('user', 'bot') NOT NULL,
        message_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users_tbl(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // ── 12. rate_limits_tbl ──────────────────────────────────────────────────
    // Tracks API request counts per user (logged-in) or IP (guest) per endpoint.
    // Used to enforce rate limiting across chatbot, apply, register, and forgot_password.
    $pdo->exec("CREATE TABLE IF NOT EXISTS rate_limits_tbl (
        id INT AUTO_INCREMENT PRIMARY KEY,
        identifier VARCHAR(128) NOT NULL,
        endpoint VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_identifier_endpoint (identifier, endpoint),
        INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Auto-purge rate_limits_tbl entries older than 2 hours to keep the table lean
    $pdo->exec("DELETE FROM rate_limits_tbl WHERE created_at < DATE_SUB(NOW(), INTERVAL 2 HOUR);");

    // ── Schema Migrations (non-destructive, only adds if missing) ────────────
    // Add 'category' column to jobs_tbl
    try {
        $col = $pdo->query("SHOW COLUMNS FROM jobs_tbl LIKE 'category'");
        if (!$col->fetch()) {
            $pdo->exec("ALTER TABLE jobs_tbl ADD COLUMN category VARCHAR(100) DEFAULT 'Operations' AFTER status");
        }
    } catch (Exception $e) {}

    // Add 'location' column to jobs_tbl
    try {
        $col = $pdo->query("SHOW COLUMNS FROM jobs_tbl LIKE 'location'");
        if (!$col->fetch()) {
            $pdo->exec("ALTER TABLE jobs_tbl ADD COLUMN location VARCHAR(255) DEFAULT 'Airship Express HQ' AFTER category");
        }
    } catch (Exception $e) {}

    // Add 'remarks' column to applications_tbl (evaluator feedback/notes)
    try {
        $col = $pdo->query("SHOW COLUMNS FROM applications_tbl LIKE 'remarks'");
        if (!$col->fetch()) {
            $pdo->exec("ALTER TABLE applications_tbl ADD COLUMN remarks TEXT DEFAULT NULL AFTER pre_employment_checklist");
        }
    } catch (Exception $e) {}

    // Add 'invitation_sent_at' column to applications_tbl (for 24h auto-expiration tracking)
    try {
        $col = $pdo->query("SHOW COLUMNS FROM applications_tbl LIKE 'invitation_sent_at'");
        if (!$col->fetch()) {
            $pdo->exec("ALTER TABLE applications_tbl ADD COLUMN invitation_sent_at TIMESTAMP NULL DEFAULT NULL AFTER remarks");
        }
    } catch (Exception $e) {}

    // Add 'candidate_mobile' column to applications_tbl
    try {
        $col = $pdo->query("SHOW COLUMNS FROM applications_tbl LIKE 'candidate_mobile'");
        if (!$col->fetch()) {
            $pdo->exec("ALTER TABLE applications_tbl ADD COLUMN candidate_mobile VARCHAR(20) DEFAULT NULL AFTER candidate_email");
        }
    } catch (Exception $e) {}

    // Add work start schedule columns to applications_tbl
    try {
        $col = $pdo->query("SHOW COLUMNS FROM applications_tbl LIKE 'work_start_date'");
        if (!$col->fetch()) {
            $pdo->exec("ALTER TABLE applications_tbl ADD COLUMN work_start_date DATE DEFAULT NULL AFTER pre_employment_checklist");
        }
    } catch (Exception $e) {}

    try {
        $col = $pdo->query("SHOW COLUMNS FROM applications_tbl LIKE 'work_start_time'");
        if (!$col->fetch()) {
            $pdo->exec("ALTER TABLE applications_tbl ADD COLUMN work_start_time VARCHAR(50) DEFAULT NULL AFTER work_start_date");
        }
    } catch (Exception $e) {}

    try {
        $col = $pdo->query("SHOW COLUMNS FROM applications_tbl LIKE 'work_start_location'");
        if (!$col->fetch()) {
            $pdo->exec("ALTER TABLE applications_tbl ADD COLUMN work_start_location VARCHAR(255) DEFAULT NULL AFTER work_start_time");
        }
    } catch (Exception $e) {}

    try {
        $col = $pdo->query("SHOW COLUMNS FROM applications_tbl LIKE 'work_start_reporting_to'");
        if (!$col->fetch()) {
            $pdo->exec("ALTER TABLE applications_tbl ADD COLUMN work_start_reporting_to VARCHAR(255) DEFAULT NULL AFTER work_start_location");
        }
    } catch (Exception $e) {}

    try {
        $col = $pdo->query("SHOW COLUMNS FROM applications_tbl LIKE 'work_start_notes'");
        if (!$col->fetch()) {
            $pdo->exec("ALTER TABLE applications_tbl ADD COLUMN work_start_notes TEXT DEFAULT NULL AFTER work_start_reporting_to");
        }
    } catch (Exception $e) {}

    // Add pending_email columns to users_tbl for Change Email workflow
    try {
        $col = $pdo->query("SHOW COLUMNS FROM users_tbl LIKE 'pending_email'");
        if (!$col->fetch()) {
            $pdo->exec("ALTER TABLE users_tbl ADD COLUMN pending_email VARCHAR(100) DEFAULT NULL AFTER status");
            $pdo->exec("ALTER TABLE users_tbl ADD COLUMN pending_email_token VARCHAR(255) DEFAULT NULL AFTER pending_email");
            $pdo->exec("ALTER TABLE users_tbl ADD COLUMN pending_email_expires DATETIME DEFAULT NULL AFTER pending_email_token");
            $pdo->exec("ALTER TABLE users_tbl ADD INDEX idx_pending_email_token (pending_email_token)");
        }
    } catch (Exception $e) {}

    // Add TOTP 2FA columns to users_tbl for Super Admin authentication
    try {
        $col = $pdo->query("SHOW COLUMNS FROM users_tbl LIKE 'totp_secret'");
        if (!$col->fetch()) {
            $pdo->exec("ALTER TABLE users_tbl ADD COLUMN totp_secret VARCHAR(64) DEFAULT NULL AFTER requires_password_reset");
            $pdo->exec("ALTER TABLE users_tbl ADD COLUMN totp_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER totp_secret");
            $pdo->exec("ALTER TABLE users_tbl ADD COLUMN backup_codes TEXT DEFAULT NULL AFTER totp_enabled");
        }
    } catch (Exception $e) {}

    // Add User_MInitial column to users_tbl for Middle Initial
    try {
        $col = $pdo->query("SHOW COLUMNS FROM users_tbl LIKE 'User_MInitial'");
        if (!$col->fetch()) {
            $pdo->exec("ALTER TABLE users_tbl ADD COLUMN User_MInitial VARCHAR(10) DEFAULT NULL AFTER User_Fname");
        }
    } catch (Exception $e) {}

    // Ensure User_Mobile allows NULL (since applicants register with email and add mobile when applying)
    try {
        $pdo->exec("ALTER TABLE users_tbl MODIFY COLUMN User_Mobile VARCHAR(20) NULL DEFAULT NULL");
    } catch (Exception $e) {}

    // Clean up deprecated posters_tbl
    try {
        $pdo->exec("DROP TABLE IF EXISTS posters_tbl");
    } catch (Exception $e) {}

    // Purge non-admin records (Super Admin, Applicants, System) from system_audit_logs_tbl
    // The audit trail strictly tracks regular Admin actions (is_admin = 1) for non-repudiation
    try {
        $pdo->exec("DELETE FROM system_audit_logs_tbl 
                    WHERE admin_name LIKE '%Super Admin%' 
                       OR admin_name = 'System' 
                       OR admin_id = 0
                       OR admin_id IN (SELECT user_id FROM users_tbl WHERE is_admin != 1)");
    } catch (Exception $e) {}

    // ── Seed Root Super Admin Account if missing ─────────────────────────────
    $superAdminEmail = 'airship.express07@gmail.com';
    $chkSuperAdmin = $pdo->prepare("SELECT user_id FROM users_tbl WHERE User_Email = :email LIMIT 1");
    $chkSuperAdmin->execute(['email' => $superAdminEmail]);
    if (!$chkSuperAdmin->fetch()) {
        $tempPasswordHash = password_hash('AirshipAdmin2026!', PASSWORD_BCRYPT);
        $insertSuperStmt = $pdo->prepare("
            INSERT INTO users_tbl (User_Fname, User_Lname, User_Email, User_Pass, is_admin, is_verified, requires_password_reset)
            VALUES ('Super Admin', 'Root', :email, :pass, 3, 1, 1)
        ");
        $insertSuperStmt->execute([
            'email' => $superAdminEmail,
            'pass'  => $tempPasswordHash
        ]);
    }

} catch (PDOException $e) {
    // Log detailed error internally for debugging; never expose to clients
    error_log('[DB Connection Error] ' . $e->getMessage());
    header('Content-Type: application/json', true, 500);
    echo json_encode([
        "status" => "error",
        "message" => "An internal server error occurred while connecting to the database. Please try again later."
    ]);
    exit();
}
?>
