<?php
/**
 * Slot Release Helper
 * Centralized handling for released position slots when an offer is Declined, Withdrawn, or Expired.
 * 
 * Rules:
 * 1. If waitlisted candidates are waiting for this job:
 *    - Keep public job board CLOSED (status = 'Closed').
 *    - Notify admin to extend the reopened slot to the #1 waitlisted candidate.
 * 2. If waitlist is completely empty:
 *    - Reopen the job posting on the public career site (status = 'Active', availability >= 1).
 *    - Notify admin that the job is reopened for public applications.
 */

if (!function_exists('handle_released_slot')) {
    function handle_released_slot(PDO $pdo, int $jobId, string $triggerReason, string $candidateName, string $jobTitle = ''): array {
        if ($jobId <= 0) {
            return ['action' => 'none', 'message' => 'Invalid job ID'];
        }

        // Fetch job details if jobTitle not provided
        if (empty($jobTitle)) {
            $jStmt = $pdo->prepare("SELECT title, availability, status FROM jobs_tbl WHERE job_id = ?");
            $jStmt->execute([$jobId]);
            $jRow = $jStmt->fetch(PDO::FETCH_ASSOC);
            $jobTitle = $jRow['title'] ?? 'this position';
        }

        // 1. Check for waitlisted candidates in FIFO order
        $wlStmt = $pdo->prepare("
            SELECT application_id, candidate_name, user_id 
            FROM applications_tbl 
            WHERE job_id = ? 
              AND UPPER(status) IN (
                'PASSED FINAL — WAITING FOR SLOT', 
                'PASSED FINAL - WAITING FOR SLOT', 
                'WAITING_FOR_SLOT', 
                'WAITLIST', 
                'WAITLISTED'
              )
              AND is_archived = 0
            ORDER BY updated_at ASC, application_id ASC
            LIMIT 1
        ");
        $wlStmt->execute([$jobId]);
        $nextWaitlisted = $wlStmt->fetch(PDO::FETCH_ASSOC);

        if ($nextWaitlisted) {
            // Case A: Waitlist has candidates -> DO NOT open to public; keep posting Closed.
            $closeStmt = $pdo->prepare("UPDATE jobs_tbl SET status = 'Closed' WHERE job_id = ?");
            $closeStmt->execute([$jobId]);

            $nextName = trim($nextWaitlisted['candidate_name']) ?: 'A waitlisted finalist';
            $verb = ($triggerReason === 'expired') ? 'expired' : (($triggerReason === 'withdrawn') ? 'was withdrawn' : 'was declined');
            $adminMsg = "A slot has reopened for \"{$jobTitle}\" (offer {$verb} by {$candidateName}). {$nextName} is #1 on Priority Waitlist and ready to be offered.";

            try {
                $adminNotif = $pdo->prepare("
                    INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                    SELECT user_id, ?, 'Slot Reopened: Priority Waitlist Candidate Ready 🔔', ?, 'slot_reopened', '/super-admin/dashboard', 0, NOW()
                    FROM users_tbl 
                    WHERE is_admin >= 1
                ");
                $adminNotif->execute([$nextWaitlisted['application_id'], $adminMsg]);
            } catch (Exception $e) {
                error_log("[SlotReleaseHelper] Waitlist notification failed: " . $e->getMessage());
            }

            return [
                'action' => 'waitlist_notified',
                'next_candidate' => $nextWaitlisted,
                'message' => $adminMsg
            ];
        } else {
            // Case B: Waitlist is completely empty -> REOPEN job posting on public career site
            // Ensure availability is at least 1 so get_jobs doesn't auto-close it
            $reopenStmt = $pdo->prepare("
                UPDATE jobs_tbl 
                SET status = 'Active', 
                    availability = CASE WHEN availability <= 0 THEN 1 ELSE availability END 
                WHERE job_id = ?
            ");
            $reopenStmt->execute([$jobId]);

            $verb = ($triggerReason === 'expired') ? 'expired' : (($triggerReason === 'withdrawn') ? 'was withdrawn' : 'was declined');
            $adminMsg = "Job offer for \"{$jobTitle}\" {$verb} (candidate: {$candidateName}) and the waitlist is empty. The job posting has been automatically reopened on the public career site.";

            try {
                $adminNotif = $pdo->prepare("
                    INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                    SELECT user_id, 0, 'Job Vacancy Reopened to Public 📢', ?, 'job_reopened', '/admin/dashboard', 0, NOW()
                    FROM users_tbl 
                    WHERE is_admin >= 1
                ");
                $adminNotif->execute([$adminMsg]);
            } catch (Exception $e) {
                error_log("[SlotReleaseHelper] Reopen notification failed: " . $e->getMessage());
            }

            return [
                'action' => 'job_reopened',
                'next_candidate' => null,
                'message' => $adminMsg
            ];
        }
    }
}
