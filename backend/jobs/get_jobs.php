<?php
// Include database connection (sets CORS headers)
require_once __DIR__ . '/../db.php';

header('Content-Type: application/json');

try {
    $activeOnly = isset($_GET['active_only']) && $_GET['active_only'] === 'true';
    $archivedOnly = isset($_GET['archived_only']) && $_GET['archived_only'] === 'true';
    $userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;

    // 1. Calculate occupied slots per job (candidates holding offers, hired, or approved)
    $capStmt = $pdo->query("
        SELECT 
            job_id,
            COUNT(*) AS occupied_count
        FROM applications_tbl
        WHERE is_archived = 0
          AND UPPER(status) IN (
            'PRESIDENT APPROVED', 'APPROVED FOR JOB OFFER', 'APPROVED_FOR_JOB_OFFER', 'APPROVED',
            'JOB OFFER PENDING', 'JOB_OFFER_PENDING', 'JOB OFFER CREATED', 'JOB_OFFER_CREATED', 'JOB OFFER SENT', 'JOB_OFFER_SENT',
            'OFFER EXTENDED', 'OFFER_EXTENDED', 'JOB OFFER ACCEPTED', 'JOB_OFFER_ACCEPTED', 'OFFER ACCEPTED', 'OFFER_ACCEPTED',
            'CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED', 'CONTRACT SCHEDULED', 'CONTRACT_SCHEDULED',
            'CONTRACT SIGNED', 'CONTRACT_SIGNED', 'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED',
            'REQUIREMENT PENDING', 'REQUIREMENTS PENDING', 'REQUIREMENT_PENDING', 'REQUIREMENTS_PENDING',
            'REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED', 'PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT',
            'HIRED - PRE-EMPLOYMENT', 'HIRED_PRE_EMPLOYMENT', 'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS',
            'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'HIRED',
            'OFFICIALLY HIRED', 'OFFICIALLY_HIRED', 'OFFICIALLY HIRED & SIGNED', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED'
          )
        GROUP BY job_id
    ");
    $occupancyMap = [];
    while ($row = $capStmt->fetch(PDO::FETCH_ASSOC)) {
        $occupancyMap[(int)$row['job_id']] = (int)$row['occupied_count'];
    }

    // 2. Also count waitlisted candidates per job (reserved slots)
    $waitlistStmt = $pdo->query("
        SELECT 
            job_id,
            COUNT(*) AS waitlist_count
        FROM applications_tbl
        WHERE is_archived = 0
          AND UPPER(status) IN (
            'PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT',
            'WAITING_FOR_SLOT', 'WAITLIST', 'WAITLISTED'
          )
        GROUP BY job_id
    ");
    $waitlistMap = [];
    while ($row = $waitlistStmt->fetch(PDO::FETCH_ASSOC)) {
        $waitlistMap[(int)$row['job_id']] = (int)$row['waitlist_count'];
    }

    // 3. User applied jobs (for logged in candidate display)
    $userAppliedJobIds = [];
    if ($userId > 0) {
        $uAppStmt = $pdo->prepare("SELECT DISTINCT job_id FROM applications_tbl WHERE user_id = ? AND is_archived = 0");
        $uAppStmt->execute([$userId]);
        $userAppliedJobIds = array_map('intval', $uAppStmt->fetchAll(PDO::FETCH_COLUMN));
    }

    $query = "SELECT job_id AS id, job_id, title, description, requirements, salary, employment_type, availability, status, is_hidden, image_path, category, location, created_at FROM jobs_tbl";

    if ($archivedOnly) {
        $query .= " WHERE is_archived = 1";
    } else {
        $query .= " WHERE is_archived = 0";
    }
    $query .= " ORDER BY job_id ASC";

    $stmt = $pdo->query($query);
    $rawJobs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $jobs = [];
    foreach ($rawJobs as $job) {
        $jId = (int)$job['job_id'];
        $totalQuota = max(0, (int)$job['availability']);
        $occupied = $occupancyMap[$jId] ?? 0;
        $waitlist = $waitlistMap[$jId] ?? 0;
        $remainingOpenings = max(0, $totalQuota - $occupied - $waitlist);

        $job['total_slots'] = $totalQuota;
        $job['occupied_slots'] = $occupied;
        $job['waitlist_count'] = $waitlist;
        $job['raw_availability'] = $totalQuota;
        $job['remaining_openings'] = $remainingOpenings;
        // Keep actual vacancy slots from database (deducted only upon Official Hire)
        $job['availability'] = $totalQuota;
        $job['status'] = $job['status'] ?: 'Active';

        if ($activeOnly) {
            $userApplied = in_array($jId, $userAppliedJobIds);
            $isHidden = intval($job['is_hidden'] ?? 0) === 1;
            $isDbClosed = strtolower($job['status'] ?? '') === 'closed';

            // If hidden and user hasn't applied, exclude from public intake
            if ($isHidden && !$userApplied) {
                continue;
            }

            // If closed in DB or availability reached 0 upon official hire, exclude from public intake
            if (($isDbClosed || $totalQuota <= 0) && !$userApplied) {
                continue;
            }

            // If closed in DB or availability reached 0 upon official hire, reflect as closed
            if ($isDbClosed || $totalQuota <= 0) {
                $job['status'] = 'Closed';
                $job['availability'] = 0;
            }
        }

        $jobs[] = $job;
    }

    echo json_encode([
        "status" => "success",
        "jobs" => $jobs
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database query failed: " . $e->getMessage()
    ]);
}
?>
