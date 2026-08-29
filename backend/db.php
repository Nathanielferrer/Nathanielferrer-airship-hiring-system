<?php
// Enable error reporting for development (disable/log in production)
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Set default timezone to Philippines (Asia/Manila)
date_default_timezone_set('Asia/Manila');

// CORS Headers
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
$allowed_origins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'];

if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: http://localhost:5173");
}

header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");

// Handle preflight OPTIONS request
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Database Credentials
define('DB_HOST', '127.0.0.1');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'hiring_db');

try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::ATTR_TIMEOUT            => 2, // Set connection timeout to 2 seconds to prevent hanging on offline db
    ];
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);

    // ── 1. users_tbl ─────────────────────────────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS users_tbl (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        User_Fname VARCHAR(50) NOT NULL,
        User_Lname VARCHAR(50) NOT NULL,
        User_Email VARCHAR(50) NOT NULL UNIQUE,
        User_Mobile VARCHAR(20),
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
        status VARCHAR(20) NOT NULL DEFAULT 'Active'
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
        image_path VARCHAR(255) DEFAULT NULL,
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
        CONSTRAINT unique_user_job_application UNIQUE (user_id, job_id),
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
    header('Content-Type: application/json', true, 500);
    echo json_encode([
        "status" => "error",
        "message" => "Database connection failed: " . $e->getMessage()
    ]);
    exit();
}
?>
