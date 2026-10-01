<?php
require_once __DIR__ . '/../db.php';

header('Content-Type: text/plain; charset=utf-8');

try {
    echo "=== Running Migration: Allow Multi-Application History & Add withdrawn_at ===\n\n";

    // 1. Check if unique_user_job_application index/constraint exists
    $stmt = $pdo->prepare("
        SELECT CONSTRAINT_NAME 
        FROM information_schema.TABLE_CONSTRAINTS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'applications_tbl' 
          AND CONSTRAINT_NAME = 'unique_user_job_application'
    ");
    $stmt->execute();
    $uniqueConstraint = $stmt->fetchColumn();

    if ($uniqueConstraint) {
        try {
            $pdo->exec("ALTER TABLE `applications_tbl` DROP INDEX `unique_user_job_application`");
            echo "✓ Dropped unique index `unique_user_job_application` from applications_tbl.\n";
        } catch (Exception $ex) {
            // In MySQL, sometimes drop constraint or drop key is used
            try {
                $pdo->exec("ALTER TABLE `applications_tbl` DROP CONSTRAINT `unique_user_job_application`");
                echo "✓ Dropped unique constraint `unique_user_job_application` from applications_tbl.\n";
            } catch (Exception $ex2) {
                echo "! Note dropping index/constraint: " . $ex2->getMessage() . "\n";
            }
        }
    } else {
        // Also check statistics for index if constraint name differs
        $idxStmt = $pdo->prepare("
            SELECT INDEX_NAME 
            FROM information_schema.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'applications_tbl' 
              AND INDEX_NAME = 'unique_user_job_application'
            LIMIT 1
        ");
        $idxStmt->execute();
        if ($idxStmt->fetchColumn()) {
            $pdo->exec("ALTER TABLE `applications_tbl` DROP INDEX `unique_user_job_application`");
            echo "✓ Dropped unique index `unique_user_job_application` from applications_tbl.\n";
        } else {
            echo "- Unique constraint `unique_user_job_application` is already dropped or does not exist.\n";
        }
    }

    // 2. Add withdrawn_at column if not exists
    $colStmt = $pdo->prepare("
        SELECT COUNT(*) 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'applications_tbl' 
          AND COLUMN_NAME = 'withdrawn_at'
    ");
    $colStmt->execute();
    $hasWithdrawnAt = (int)$colStmt->fetchColumn() > 0;

    if (!$hasWithdrawnAt) {
        $pdo->exec("ALTER TABLE `applications_tbl` ADD COLUMN `withdrawn_at` TIMESTAMP NULL DEFAULT NULL AFTER `updated_at`");
        echo "✓ Added `withdrawn_at` column to applications_tbl.\n";
    } else {
        echo "- `withdrawn_at` column already exists in applications_tbl.\n";
    }

    // 3. Backfill withdrawn_at for already withdrawn records
    $backfillStmt = $pdo->exec("
        UPDATE `applications_tbl` 
        SET `withdrawn_at` = COALESCE(`updated_at`, `applied_at`, NOW()) 
        WHERE `withdrawn_at` IS NULL 
          AND UPPER(`status`) IN ('CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'APPLICATION WITHDRAWN', 'APPLICATION_WITHDRAWN', 'WITHDRAWN')
    ");
    echo "✓ Backfilled `withdrawn_at` for {$backfillStmt} existing withdrawn application(s).\n";

    echo "\n=== Migration Completed Successfully! ===\n";

} catch (Exception $e) {
    echo "\n✗ Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
