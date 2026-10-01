<?php
/**
 * auto_expire_helper.php - Automated 24-Hour Interview Expiration & Slot Release
 *
 * This helper is called automatically during key API requests (db.php, get_agenda.php, etc.)
 * to check for PENDING SCHEDULED applications that have exceeded the 24-hour confirmation window.
 *
 * It will:
 *  1. Transition expired applications to 'SCHEDULING EXPIRED'
 *  2. Release booked interview slots back to 'Open'
 *  3. Send in-app notifications to affected candidates
 *  4. Send automated email notices via email_helper.php
 *  5. Log the action in system_audit_logs_tbl
 */

require_once __DIR__ . '/../email_helper.php';

/**
 * Check for and expire any PENDING SCHEDULED applications older than 24 hours.
 *
 * @param PDO $pdo Active database connection.
 */
function check_and_expire_schedules(PDO $pdo): void {
    try {
        // Find all PENDING SCHEDULED applications that have passed the 24-hour window
        $stmt = $pdo->prepare("
            SELECT 
                a.application_id, a.user_id, a.candidate_name, a.candidate_email, a.invitation_sent_at,
                j.title AS job_title, u.User_Fname, u.User_Email
            FROM applications_tbl a
            LEFT JOIN jobs_tbl j ON j.job_id = a.job_id
            LEFT JOIN users_tbl u ON u.user_id = a.user_id
            WHERE a.status = 'PENDING SCHEDULED'
            AND (
                (a.invitation_sent_at IS NOT NULL AND a.invitation_sent_at < DATE_SUB(NOW(), INTERVAL 24 HOUR))
                OR (a.invitation_sent_at IS NULL AND a.updated_at < DATE_SUB(NOW(), INTERVAL 24 HOUR))
            )
        ");
        $stmt->execute();
        $expired = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($expired)) {
            return; // Nothing to expire
        }

        foreach ($expired as $app) {
            $appId    = intval($app['application_id']);
            $userId   = intval($app['user_id']);
            $candName = trim($app['candidate_name'] ?? '') ?: trim($app['User_Fname'] ?? '') ?: "Applicant #{$appId}";
            $candEmail = trim($app['candidate_email'] ?? '') ?: trim($app['User_Email'] ?? '');
            $jobTitle  = $app['job_title'] ?? 'the position';

            // 1. Update status to SCHEDULING EXPIRED
            $updateStmt = $pdo->prepare("UPDATE applications_tbl SET status = 'SCHEDULING EXPIRED', updated_at = NOW() WHERE application_id = ?");
            $updateStmt->execute([$appId]);

            // 2. Release booked interview slots back to Open
            $freeSlot = $pdo->prepare("UPDATE interview_slots_tbl SET status = 'Open', application_id = NULL WHERE application_id = ?");
            $freeSlot->execute([$appId]);

            // 3. In-App Notification
            if ($userId > 0) {
                try {
                    $notifStmt = $pdo->prepare("
                        INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                        VALUES (?, ?, ?, ?, 'scheduling_expired', '/application-status', 0, NOW())
                    ");
                    $notifStmt->execute([
                        $userId,
                        $appId,
                        'Interview Scheduling Expired',
                        "Your interview invitation for {$jobTitle} has expired because the time slot was not confirmed within 24 hours. The slot has been released."
                    ]);
                } catch (PDOException $e) {
                    error_log("[AutoExpire] Notification insert failed for app#{$appId}: " . $e->getMessage());
                }
            }

            // 4. Send expiration email
            if (!empty($candEmail)) {
                sendApplicationStatusEmail($candEmail, $candName, $jobTitle, 'SCHEDULING_EXPIRED');
            }

            // 5. Audit log
            try {
                require_once __DIR__ . '/../audit_helper.php';
                log_system_audit(
                    $pdo,
                    0,
                    'System (Auto-Expire)',
                    'Interview Expiration',
                    'Interview Schedule',
                    "Auto-expired interview invitation for candidate \"{$candName}\" (applying for \"{$jobTitle}\"): PENDING SCHEDULED → SCHEDULING EXPIRED (24-hour window exceeded). Interview slot released.",
                    'Warning'
                );
            } catch (Exception $e) {
                error_log("[AutoExpire] Audit log failed for app#{$appId}: " . $e->getMessage());
            }
        }

    } catch (PDOException $e) {
        // Fail silently — don't block the main request
        error_log("[AutoExpire] Check failed: " . $e->getMessage());
    }
}

/**
 * Check for and expire any pending Job Offers that have passed their expiration deadline.
 * Moves expired applicants to 'Offer Expired' and archives them to Audit Records (is_archived = 1).
 *
 * @param PDO $pdo Active database connection.
 */
function check_and_expire_job_offers(PDO $pdo): void {
    try {
        $stmt = $pdo->prepare("
            SELECT 
                a.application_id, a.user_id, a.job_id, a.candidate_name, a.candidate_email,
                a.job_offer_details, j.title AS job_title, u.User_Fname, u.User_Email
            FROM applications_tbl a
            LEFT JOIN jobs_tbl j ON j.job_id = a.job_id
            LEFT JOIN users_tbl u ON u.user_id = a.user_id
            WHERE UPPER(a.status) IN ('JOB OFFER PENDING', 'JOB_OFFER_PENDING', 'OFFER EXTENDED', 'JOB OFFER EXTENDED')
            AND a.job_offer_details IS NOT NULL
        ");
        $stmt->execute();
        $pendingOffers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($pendingOffers)) {
            return;
        }

        $now = time();

        foreach ($pendingOffers as $app) {
            $appId     = intval($app['application_id']);
            $offerData = json_decode($app['job_offer_details'] ?? '', true);
            if (!is_array($offerData) || empty($offerData['offer_expires_at'])) {
                continue;
            }

            $expiryTime = strtotime($offerData['offer_expires_at']);
            if ($expiryTime && $expiryTime < $now) {
                $candName   = trim($app['candidate_name'] ?? '') ?: trim($app['User_Fname'] ?? '') ?: "Applicant #{$appId}";
                $candEmail  = trim($app['candidate_email'] ?? '') ?: trim($app['User_Email'] ?? '');
                $jobTitle   = $app['job_title'] ?? 'the position';
                $userId     = intval($app['user_id']);
                $expiredStr = $offerData['offer_expires_at'];

                $offerData['status']     = 'Offer Expired';
                $offerData['expired_at'] = date('Y-m-d H:i:s');

                // 1. Move to 'Offer Expired' and archive to Audit Records
                $upStmt = $pdo->prepare("
                    UPDATE applications_tbl 
                    SET 
                        status = 'Offer Expired',
                        is_archived = 1,
                        job_offer_details = ?,
                        updated_at = NOW()
                    WHERE application_id = ?
                ");
                $upStmt->execute([json_encode($offerData), $appId]);

                // 2. Send In-App Notification
                if ($userId > 0) {
                    try {
                        $notifStmt = $pdo->prepare("
                            INSERT INTO notifications_tbl (user_id, application_id, title, message, type, link, is_read, created_at)
                            VALUES (?, ?, 'Job Offer Expired ⏳', ?, 'job_offer_expired', '/application-status', 0, NOW())
                        ");
                        $notifStmt->execute([
                            $userId,
                            $appId,
                            "Your employment offer for {$jobTitle} expired on {$expiredStr} without response. The offer has been closed."
                        ]);
                    } catch (Exception $e) {
                        error_log("[AutoExpireOffer] Notification failed: " . $e->getMessage());
                    }
                }

                // 3. System Audit Trail Log
                try {
                    require_once __DIR__ . '/../audit_helper.php';
                    log_system_audit(
                        $pdo,
                        0,
                        'System (Auto-Expire)',
                        'Offer Expired',
                        'Job Offer',
                        "Job Offer for candidate \"{$candName}\" ({$jobTitle}) automatically expired on {$expiredStr} without candidate response. Status changed to 'Offer Expired' and candidate archived to Application Audit Records.",
                        'Warning'
                    );
                } catch (Exception $e) {
                    error_log("[AutoExpireOffer] Audit log failed: " . $e->getMessage());
                }

                // 4. Check waitlist vs public reopening rule for this released slot
                $jobId = intval($app['job_id'] ?? 0);
                if ($jobId > 0) {
                    try {
                        require_once __DIR__ . '/../applications/slot_release_helper.php';
                        handle_released_slot($pdo, $jobId, 'expired', $candName, $jobTitle);
                    } catch (Exception $e) {
                        error_log("[AutoExpireOffer] Slot release handling failed: " . $e->getMessage());
                    }
                }
            }
        }
    } catch (PDOException $e) {
        error_log("[AutoExpireOffer] Check failed: " . $e->getMessage());
    }
}
?>
