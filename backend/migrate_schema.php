<?php
/**
 * Safe In-Place Database Schema Migration Script
 * Standardizes:
 * 1. Table names -> *_tbl suffix
 * 2. Primary Keys -> entity_id (user_id, job_id, application_id, interview_id, slot_id, notification_id, log_id, attempt_id, kb_id, query_id, chat_id)
 * 3. Foreign Keys -> Exact same name & casing as referenced primary key (user_id, job_id, application_id)
 */

define('DB_HOST', '127.0.0.1');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'hiring_db');

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    echo "=== Starting Database Schema Standardization Migration ===\n\n";

    // Helper: Check if a table exists
    function tableExists($pdo, $tableName) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?");
        $stmt->execute([$tableName]);
        return (int)$stmt->fetchColumn() > 0;
    }

    // Helper: Check if a column exists in a table
    function columnExists($pdo, $tableName, $columnName) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
        $stmt->execute([$tableName, $columnName]);
        return (int)$stmt->fetchColumn() > 0;
    }

    // Helper: Drop all existing foreign keys for a table so we can safely rename columns
    function dropAllForeignKeys($pdo, $tableName) {
        $stmt = $pdo->prepare("
            SELECT CONSTRAINT_NAME 
            FROM information_schema.KEY_COLUMN_USAGE 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = ? 
              AND REFERENCED_TABLE_NAME IS NOT NULL
        ");
        $stmt->execute([$tableName]);
        $fks = $stmt->fetchAll(PDO::FETCH_COLUMN);
        foreach ($fks as $fk) {
            try {
                $pdo->exec("ALTER TABLE `{$tableName}` DROP FOREIGN KEY `{$fk}`");
                echo "  - Dropped FK constraint `{$fk}` from `{$tableName}`\n";
            } catch (Exception $e) {
                echo "  - Note: could not drop FK {$fk}: " . $e->getMessage() . "\n";
            }
        }
    }

    // ── STEP 1: Drop foreign keys before renaming ─────────────────────────────
    echo "[Step 1] Dropping existing foreign keys across tables...\n";
    $allKnownTables = [
        'applications', 'applications_tbl',
        'interviews', 'interviews_tbl',
        'interview_slots', 'interview_slots_tbl',
        'notifications', 'notifications_tbl',
        'chatbot_history', 'chatbot_history_tbl',
        'unanswered_queries', 'chatbot_unresolved_queries_tbl'
    ];
    foreach ($allKnownTables as $t) {
        if (tableExists($pdo, $t)) {
            dropAllForeignKeys($pdo, $t);
        }
    }

    // ── STEP 2: Rename Tables to *_tbl ───────────────────────────────────────
    echo "\n[Step 2] Renaming tables to *_tbl...\n";
    $tableRenames = [
        'user'               => 'users_tbl',
        'jobs'               => 'jobs_tbl',
        'applications'       => 'applications_tbl',
        'interviews'         => 'interviews_tbl',
        'interview_slots'    => 'interview_slots_tbl',
        'notifications'      => 'notifications_tbl',
        'system_audit_logs'  => 'system_audit_logs_tbl',
        'login_attempts'     => 'login_attempts_tbl',
        'knowledge_base'     => 'chatbot_knowledge_base_tbl',
        'unanswered_queries' => 'chatbot_unresolved_queries_tbl',
        'chatbot_history'    => 'chatbot_history_tbl',
    ];

    foreach ($tableRenames as $oldName => $newName) {
        if (tableExists($pdo, $oldName) && !tableExists($pdo, $newName)) {
            $pdo->exec("RENAME TABLE `{$oldName}` TO `{$newName}`");
            echo "  ✓ Renamed table `{$oldName}` -> `{$newName}`\n";
        } elseif (tableExists($pdo, $newName)) {
            echo "  ✓ Table `{$newName}` already exists.\n";
        }
    }

    // ── STEP 3: Rename Columns to Standard Primary and Foreign Keys ──────────
    echo "\n[Step 3] Renaming columns to standard primary & foreign keys...\n";

    // 1. users_tbl: User_ID -> user_id
    if (tableExists($pdo, 'users_tbl')) {
        if (columnExists($pdo, 'users_tbl', 'User_ID')) {
            $pdo->exec("ALTER TABLE `users_tbl` CHANGE COLUMN `User_ID` `user_id` INT NOT NULL AUTO_INCREMENT");
            echo "  ✓ users_tbl: Renamed `User_ID` -> `user_id`\n";
        }
    }

    // 2. jobs_tbl: id -> job_id
    if (tableExists($pdo, 'jobs_tbl')) {
        if (columnExists($pdo, 'jobs_tbl', 'id')) {
            $pdo->exec("ALTER TABLE `jobs_tbl` CHANGE COLUMN `id` `job_id` INT NOT NULL AUTO_INCREMENT");
            echo "  ✓ jobs_tbl: Renamed `id` -> `job_id`\n";
        }
    }

    // 3. applications_tbl: id -> application_id
    if (tableExists($pdo, 'applications_tbl')) {
        if (columnExists($pdo, 'applications_tbl', 'id')) {
            $pdo->exec("ALTER TABLE `applications_tbl` CHANGE COLUMN `id` `application_id` INT NOT NULL AUTO_INCREMENT");
            echo "  ✓ applications_tbl: Renamed `id` -> `application_id`\n";
        }
    }

    // 4. interviews_tbl: id -> interview_id
    if (tableExists($pdo, 'interviews_tbl')) {
        if (columnExists($pdo, 'interviews_tbl', 'id')) {
            $pdo->exec("ALTER TABLE `interviews_tbl` CHANGE COLUMN `id` `interview_id` INT NOT NULL AUTO_INCREMENT");
            echo "  ✓ interviews_tbl: Renamed `id` -> `interview_id`\n";
        }
    }

    // 5. interview_slots_tbl: applicant_id -> application_id
    if (tableExists($pdo, 'interview_slots_tbl')) {
        if (columnExists($pdo, 'interview_slots_tbl', 'applicant_id')) {
            $pdo->exec("ALTER TABLE `interview_slots_tbl` CHANGE COLUMN `applicant_id` `application_id` INT DEFAULT NULL");
            echo "  ✓ interview_slots_tbl: Renamed `applicant_id` -> `application_id`\n";
        }
        if (columnExists($pdo, 'interview_slots_tbl', 'date') && !columnExists($pdo, 'interview_slots_tbl', 'slot_date')) {
            $pdo->exec("ALTER TABLE `interview_slots_tbl` CHANGE COLUMN `date` `slot_date` DATE NOT NULL");
            echo "  ✓ interview_slots_tbl: Renamed `date` -> `slot_date`\n";
        }
    }

    // 6. notifications_tbl: id -> notification_id
    if (tableExists($pdo, 'notifications_tbl')) {
        if (columnExists($pdo, 'notifications_tbl', 'id')) {
            $pdo->exec("ALTER TABLE `notifications_tbl` CHANGE COLUMN `id` `notification_id` INT NOT NULL AUTO_INCREMENT");
            echo "  ✓ notifications_tbl: Renamed `id` -> `notification_id`\n";
        }
    }

    // 7. chatbot_knowledge_base_tbl: id -> kb_id
    if (tableExists($pdo, 'chatbot_knowledge_base_tbl')) {
        if (columnExists($pdo, 'chatbot_knowledge_base_tbl', 'id')) {
            $pdo->exec("ALTER TABLE `chatbot_knowledge_base_tbl` CHANGE COLUMN `id` `kb_id` INT NOT NULL AUTO_INCREMENT");
            echo "  ✓ chatbot_knowledge_base_tbl: Renamed `id` -> `kb_id`\n";
        }
    }

    // 8. chatbot_unresolved_queries_tbl: id -> query_id, applicant_id -> user_id
    if (tableExists($pdo, 'chatbot_unresolved_queries_tbl')) {
        if (columnExists($pdo, 'chatbot_unresolved_queries_tbl', 'id')) {
            $pdo->exec("ALTER TABLE `chatbot_unresolved_queries_tbl` CHANGE COLUMN `id` `query_id` INT NOT NULL AUTO_INCREMENT");
            echo "  ✓ chatbot_unresolved_queries_tbl: Renamed `id` -> `query_id`\n";
        }
        if (columnExists($pdo, 'chatbot_unresolved_queries_tbl', 'applicant_id')) {
            $pdo->exec("ALTER TABLE `chatbot_unresolved_queries_tbl` CHANGE COLUMN `applicant_id` `user_id` INT NULL");
            echo "  ✓ chatbot_unresolved_queries_tbl: Renamed `applicant_id` -> `user_id`\n";
        }
    }

    // 9. chatbot_history_tbl: id -> chat_id, applicant_id -> user_id
    if (tableExists($pdo, 'chatbot_history_tbl')) {
        if (columnExists($pdo, 'chatbot_history_tbl', 'id')) {
            $pdo->exec("ALTER TABLE `chatbot_history_tbl` CHANGE COLUMN `id` `chat_id` INT NOT NULL AUTO_INCREMENT");
            echo "  ✓ chatbot_history_tbl: Renamed `id` -> `chat_id`\n";
        }
        if (columnExists($pdo, 'chatbot_history_tbl', 'applicant_id')) {
            $pdo->exec("ALTER TABLE `chatbot_history_tbl` CHANGE COLUMN `applicant_id` `user_id` INT NOT NULL");
            echo "  ✓ chatbot_history_tbl: Renamed `applicant_id` -> `user_id`\n";
        }
    }

    // 10. system_audit_logs_tbl: id -> log_id
    if (tableExists($pdo, 'system_audit_logs_tbl')) {
        if (columnExists($pdo, 'system_audit_logs_tbl', 'id')) {
            $pdo->exec("ALTER TABLE `system_audit_logs_tbl` CHANGE COLUMN `id` `log_id` INT NOT NULL AUTO_INCREMENT");
            echo "  ✓ system_audit_logs_tbl: Renamed `id` -> `log_id`\n";
        }
    }

    // 11. login_attempts_tbl: id -> attempt_id
    if (tableExists($pdo, 'login_attempts_tbl')) {
        if (columnExists($pdo, 'login_attempts_tbl', 'id')) {
            $pdo->exec("ALTER TABLE `login_attempts_tbl` CHANGE COLUMN `id` `attempt_id` INT NOT NULL AUTO_INCREMENT");
            echo "  ✓ login_attempts_tbl: Renamed `id` -> `attempt_id`\n";
        }
    }

    // ── STEP 4: Add New Foreign Key Constraints ──────────────────────────────
    echo "\n[Step 4] Adding new Foreign Key constraints...\n";

    $constraints = [
        [
            'table' => 'applications_tbl',
            'name'  => 'fk_applications_user',
            'sql'   => 'ALTER TABLE `applications_tbl` ADD CONSTRAINT `fk_applications_user` FOREIGN KEY (`user_id`) REFERENCES `users_tbl`(`user_id`) ON DELETE CASCADE'
        ],
        [
            'table' => 'applications_tbl',
            'name'  => 'fk_applications_job',
            'sql'   => 'ALTER TABLE `applications_tbl` ADD CONSTRAINT `fk_applications_job` FOREIGN KEY (`job_id`) REFERENCES `jobs_tbl`(`job_id`) ON DELETE CASCADE'
        ],
        [
            'table' => 'interviews_tbl',
            'name'  => 'fk_interviews_application',
            'sql'   => 'ALTER TABLE `interviews_tbl` ADD CONSTRAINT `fk_interviews_application` FOREIGN KEY (`application_id`) REFERENCES `applications_tbl`(`application_id`) ON DELETE CASCADE'
        ],
        [
            'table' => 'interview_slots_tbl',
            'name'  => 'fk_interview_slots_application',
            'sql'   => 'ALTER TABLE `interview_slots_tbl` ADD CONSTRAINT `fk_interview_slots_application` FOREIGN KEY (`application_id`) REFERENCES `applications_tbl`(`application_id`) ON DELETE SET NULL'
        ],
        [
            'table' => 'notifications_tbl',
            'name'  => 'fk_notifications_user',
            'sql'   => 'ALTER TABLE `notifications_tbl` ADD CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users_tbl`(`user_id`) ON DELETE CASCADE'
        ],
        [
            'table' => 'notifications_tbl',
            'name'  => 'fk_notifications_application',
            'sql'   => 'ALTER TABLE `notifications_tbl` ADD CONSTRAINT `fk_notifications_application` FOREIGN KEY (`application_id`) REFERENCES `applications_tbl`(`application_id`) ON DELETE CASCADE'
        ],
        [
            'table' => 'chatbot_history_tbl',
            'name'  => 'fk_chatbot_history_user',
            'sql'   => 'ALTER TABLE `chatbot_history_tbl` ADD CONSTRAINT `fk_chatbot_history_user` FOREIGN KEY (`user_id`) REFERENCES `users_tbl`(`user_id`) ON DELETE CASCADE'
        ],
        [
            'table' => 'chatbot_unresolved_queries_tbl',
            'name'  => 'fk_unresolved_queries_user',
            'sql'   => 'ALTER TABLE `chatbot_unresolved_queries_tbl` ADD CONSTRAINT `fk_unresolved_queries_user` FOREIGN KEY (`user_id`) REFERENCES `users_tbl`(`user_id`) ON DELETE SET NULL'
        ],
    ];

    foreach ($constraints as $c) {
        try {
            $pdo->exec($c['sql']);
            echo "  ✓ Added constraint `{$c['name']}` on `{$c['table']}`\n";
        } catch (Exception $e) {
            echo "  - Constraint `{$c['name']}`: " . $e->getMessage() . "\n";
        }
    }

    echo "\n=== Database Migration Completed Successfully! ===\n";

} catch (Exception $e) {
    echo "\n[ERROR] Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
