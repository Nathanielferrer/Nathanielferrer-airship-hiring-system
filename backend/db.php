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
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
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

    // Create the login_attempts table dynamically if it does not exist
    $pdo->exec("CREATE TABLE IF NOT EXISTS login_attempts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ip_address VARCHAR(45) NOT NULL,
        email VARCHAR(255) NOT NULL,
        success TINYINT(1) NOT NULL DEFAULT 0,
        attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (ip_address),
        INDEX (email),
        INDEX (attempted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Add success column if it doesn't exist yet (safe migration for existing tables)
    $pdo->exec("ALTER TABLE login_attempts ADD COLUMN IF NOT EXISTS success TINYINT(1) NOT NULL DEFAULT 0;");

    // Auto-purge login_attempts records older than 24 hours to keep the table lean
    $pdo->exec("DELETE FROM login_attempts WHERE attempted_at < DATE_SUB(NOW(), INTERVAL 24 HOUR);");


    // Create the jobs table
    $pdo->exec("CREATE TABLE IF NOT EXISTS jobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        requirements TEXT NOT NULL,
        availability INT DEFAULT 1,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Create the applications table
    $pdo->exec("CREATE TABLE IF NOT EXISTS applications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        job_id INT NOT NULL,
        resume_path VARCHAR(255) NOT NULL,
        ai_match_score INT DEFAULT NULL,
        ai_summary TEXT DEFAULT NULL,
        status VARCHAR(100) DEFAULT 'pending',
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES user(User_ID) ON DELETE CASCADE,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Migrate status column from ENUM to VARCHAR(100) to support extended workflow statuses
    // This runs safely every request - MODIFY only takes effect if the column type differs
    try {
        $colType = $pdo->query("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'status'")->fetchColumn();
        if ($colType && strpos($colType, 'enum') !== false) {
            $pdo->exec("ALTER TABLE applications MODIFY COLUMN status VARCHAR(100) DEFAULT 'pending'");
        }
    } catch (PDOException $e) { /* ignore */ }

    // Ensure a user can only apply to a specific job once
    try {
        $pdo->exec("ALTER TABLE applications ADD CONSTRAINT unique_user_job_application UNIQUE (user_id, job_id)");
    } catch (PDOException $e) {
        // Ignore if constraint already exists or there are duplicates
    }

    // Create the interviews table
    $pdo->exec("CREATE TABLE IF NOT EXISTS interviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        application_id INT NOT NULL,
        scheduled_date DATE NOT NULL,
        scheduled_time TIME NOT NULL,
        location VARCHAR(255) NOT NULL,
        requirements TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Create the interview_slots table for the Two-Step Scheduling Pipeline
    $pdo->exec("CREATE TABLE IF NOT EXISTS interview_slots (
        slot_id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        status ENUM('Open', 'Booked') DEFAULT 'Open',
        applicant_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (applicant_id) REFERENCES applications(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Create the notifications table (with extended columns for interview workflow)
    $pdo->exec("CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'general',
        application_id INT DEFAULT NULL,
        link VARCHAR(255) DEFAULT '',
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES user(User_ID) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Dynamically add new columns to notifications if missing
    try {
        $notifCols = $pdo->query("DESCRIBE notifications")->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('type', $notifCols)) {
            $pdo->exec("ALTER TABLE notifications ADD COLUMN type VARCHAR(50) DEFAULT 'general' AFTER message");
        }
        if (!in_array('application_id', $notifCols)) {
            $pdo->exec("ALTER TABLE notifications ADD COLUMN application_id INT DEFAULT NULL AFTER type");
        }
    } catch (PDOException $e) { /* ignore */ }

    // Dynamically append candidate_name and candidate_email columns to applications if they do not exist
    $appColumns = $pdo->query("DESCRIBE applications")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('candidate_name', $appColumns)) {
        $pdo->exec("ALTER TABLE applications ADD COLUMN candidate_name VARCHAR(255) DEFAULT NULL");
    }
    if (!in_array('candidate_email', $appColumns)) {
        $pdo->exec("ALTER TABLE applications ADD COLUMN candidate_email VARCHAR(255) DEFAULT NULL");
    }
    if (!in_array('viewed', $appColumns)) {
        $pdo->exec("ALTER TABLE applications ADD COLUMN viewed TINYINT(1) DEFAULT 0");
    }
    if (!in_array('updated_at', $appColumns)) {
        $pdo->exec("ALTER TABLE applications ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    }
    if (!in_array('is_archived', $appColumns)) {
        $pdo->exec("ALTER TABLE applications ADD COLUMN is_archived TINYINT(1) DEFAULT 0");
    }
    if (!in_array('reschedule_reason', $appColumns)) {
        $pdo->exec("ALTER TABLE applications ADD COLUMN reschedule_reason TEXT DEFAULT NULL");
    }
    if (!in_array('reschedule_requested_slot_id', $appColumns)) {
        $pdo->exec("ALTER TABLE applications ADD COLUMN reschedule_requested_slot_id INT DEFAULT NULL");
    }


    // Dynamically append reset_token and reset_expires columns to the user table if they do not exist
    $userColumns = $pdo->query("DESCRIBE user")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('reset_token', $userColumns)) {
        $pdo->exec("ALTER TABLE user ADD COLUMN reset_token VARCHAR(255) DEFAULT NULL");
    }
    if (!in_array('reset_expires', $userColumns)) {
        $pdo->exec("ALTER TABLE user ADD COLUMN reset_expires DATETIME DEFAULT NULL");
    }

    // ── Forced Password Reset flag ─────────────────────────────────────────────
    // Tracks whether an Admin must set a new password before accessing dashboard
    if (!in_array('requires_password_reset', $userColumns)) {
        $pdo->exec("ALTER TABLE user ADD COLUMN requires_password_reset TINYINT(1) NOT NULL DEFAULT 0");
    }

    // ── Account Status (Active / Inactive for soft delete) ──────────────────────
    if (!in_array('status', $userColumns)) {
        $pdo->exec("ALTER TABLE user ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Active'");
    }

    // ── One-time Setup Token (used during forced-reset intercept flow) ─────────
    if (!in_array('setup_token', $userColumns)) {
        $pdo->exec("ALTER TABLE user ADD COLUMN setup_token VARCHAR(64) DEFAULT NULL");
    }
    if (!in_array('setup_token_expires', $userColumns)) {
        $pdo->exec("ALTER TABLE user ADD COLUMN setup_token_expires DATETIME DEFAULT NULL");
    }

    // ── System Audit Logs table (Append-Only) ──────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS system_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
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

    // ── Admin Audit Log table ──────────────────────────────────────────────────
    // Records every account creation, password reset, and setup completion by Super Admin
    $pdo->exec("CREATE TABLE IF NOT EXISTS admin_audit_log (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        actor_id     INT NOT NULL,
        target_id    INT DEFAULT NULL,
        action       VARCHAR(100) NOT NULL,
        details      TEXT DEFAULT NULL,
        performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (actor_id),
        INDEX (target_id),
        INDEX (action)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    // ── Seed Root Super Admin Account (airship.express07@gmail.com) ───────────
    $superAdminEmail = 'airship.express07@gmail.com';
    $chkSuperAdmin = $pdo->prepare("SELECT User_ID FROM user WHERE User_Email = :email LIMIT 1");
    $chkSuperAdmin->execute(['email' => $superAdminEmail]);
    if (!$chkSuperAdmin->fetch()) {
        $tempPasswordHash = password_hash('AirshipAdmin2026!', PASSWORD_BCRYPT);
        $insertSuperStmt = $pdo->prepare("
            INSERT INTO user (User_Fname, User_Lname, User_Email, User_Pass, is_admin, verified, is_verified, requires_password_reset)
            VALUES ('Super Admin', 'Root', :email, :pass, 3, 1, 1, 1)
        ");
        $insertSuperStmt->execute([
            'email' => $superAdminEmail,
            'pass'  => $tempPasswordHash
        ]);
    }


    // ── Chatbot Knowledge Base table ──────────────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS knowledge_base (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        primary_question  TEXT NOT NULL,
        predefined_answer TEXT NOT NULL,
        keyword_tags      VARCHAR(500) DEFAULT '',
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FULLTEXT(primary_question, keyword_tags)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Add FULLTEXT index if the table existed before this migration
    try {
        $ftIdx = $pdo->query("SHOW INDEX FROM knowledge_base WHERE Key_name = 'primary_question'")->fetch();
        if (!$ftIdx) {
            $pdo->exec("ALTER TABLE knowledge_base ADD FULLTEXT(primary_question, keyword_tags)");
        }
    } catch (PDOException $e) { /* ignore */ }

    // ── Unanswered Queries table ──────────────────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS unanswered_queries (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        applicant_id      INT NULL,
        raw_question_text TEXT NOT NULL,
        status            VARCHAR(50) DEFAULT 'pending review',
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (applicant_id) REFERENCES user(User_ID) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // ── Chatbot History table ──────────────────────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS chatbot_history (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        applicant_id INT NOT NULL,
        sender       ENUM('user', 'bot') NOT NULL,
        message_text TEXT NOT NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (applicant_id) REFERENCES user(User_ID) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // ── Seed knowledge_base with default HR entries if empty ─────────────────
    $kbCount = (int)$pdo->query("SELECT COUNT(*) FROM knowledge_base")->fetchColumn();
    if ($kbCount === 0) {
        $pdo->exec("INSERT INTO knowledge_base (primary_question, predefined_answer, keyword_tags) VALUES
        ('How do I apply for a job?',
         'To apply for a position at Airship Express, navigate to the Vacancy page and click the Apply button next to the role you are interested in. Upload your resume and fill in your details. Our HR team will review your application and get back to you within 3–5 business days.',
         'apply, application, how to apply, job, position, submit, register, sign up, start'),
        ('What positions are currently available?',
         'Just ask me about available jobs and I will pull the live list of current openings directly from our system! Or visit the Vacancy page to see all open roles and apply directly.',
         'positions, jobs, vacancies, available, openings, roles, hiring, what jobs, current jobs, job list'),
        ('How do I check my application status?',
         'Just ask me about your application status and I will show you the real-time status of all your applications! You can also visit your Application Status page by clicking your profile icon in the top-right corner. Your status will display as Under Review, Passed Screening, Interview Scheduled, or a final decision.',
         'status, check, application status, track, where, progress, update, view, see, my application'),
        ('What is the salary for these positions?',
         'Salary details for each position are discussed during the interview stage. Our compensation packages are competitive and based on experience and role requirements. Our HR team will be happy to discuss this with shortlisted candidates.',
         'salary, pay, compensation, how much, wage, income, benefits, rate, monthly, pay rate'),
        ('What are the requirements to apply?',
         'General requirements include willingness to work in a fast-paced logistics environment, good communication skills, and an updated resume. Specific role requirements such as live selling experience or warehouse operations familiarity are listed on each job posting in the Vacancy section.',
         'requirements, qualifications, skills, needed, criteria, education, experience, qualifications, eligible'),
        ('What is the interview process?',
         'After your application is reviewed and shortlisted, you will receive a notification with an Interview Scheduled status. Interviews are conducted in-person at our office. You will receive the date, time, and location in your Application Status page. Please confirm your attendance there.',
         'interview, process, steps, what happens, how, when, schedule, attend, in person, face to face'),
        ('How long does the application review take?',
         'Our HR team typically reviews applications within 3 to 5 business days. You will receive an email notification and an in-platform update once a decision has been made. Please ensure your contact information and email address are accurate.',
         'how long, timeline, duration, wait, days, review, process time, response, result, waiting'),
        ('Do I need to upload a resume?',
         'Yes, uploading a resume is required to complete your application. Accepted formats are PDF and DOC/DOCX. Our system will automatically analyze your resume to check its match with the job requirements. Please make sure your resume is up to date before applying.',
         'resume, cv, upload, document, file, required, need, attach, pdf, doc, curriculum vitae')
        ");
    }

    // Ensure company background entry exists in KB
    try {
        $bgChk = (int)$pdo->query("SELECT COUNT(*) FROM knowledge_base WHERE keyword_tags LIKE '%background%' OR primary_question LIKE '%background%'")->fetchColumn();
        if ($bgChk === 0) {
            $pdo->exec("INSERT INTO knowledge_base (primary_question, predefined_answer, keyword_tags) VALUES
            ('What is the background of the company?',
             'Airship Express is a premier logistics and modern e-commerce delivery company dedicated to fast, reliable, and precise operations across regional hubs. We empower local sellers and workforce talents through streamlined digital hiring.',
             'background, company, about, history, airship, express, info, company background')");
        }
    } catch (PDOException $e) { /* ignore */ }

} catch (PDOException $e) {
    // Return structured JSON error for the API
    header('Content-Type: application/json', true, 500);
    echo json_encode([
        "status" => "error",
        "message" => "Database connection failed: " . $e->getMessage()
    ]);
    exit();
}
