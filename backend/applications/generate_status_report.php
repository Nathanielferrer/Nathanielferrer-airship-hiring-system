<?php
date_default_timezone_set('Asia/Manila');
require_once __DIR__ . '/../db.php';

$search        = isset($_GET['search']) ? trim($_GET['search']) : '';
$selectedDate  = isset($_GET['selected_date']) ? trim($_GET['selected_date']) : '';
$selectedYear  = isset($_GET['selected_year']) ? trim($_GET['selected_year']) : '';
$status_filter = isset($_GET['status_filter']) ? strtolower(trim($_GET['status_filter'])) : '';
$format        = isset($_GET['format']) ? strtolower(trim($_GET['format'])) : 'csv';
$adminParam    = isset($_GET['admin_name']) ? trim($_GET['admin_name']) : '';

// ── Human-readable status mapping ───────────────────────────────────────────
function format_applicant_status($rawStatus) {
    $norm = strtoupper(trim($rawStatus ?? ''));
    if (empty($norm)) return 'Pending Review';

    $map = [
        'PENDING'                                   => 'Pending Review',
        'REVIEW_REQUIRED'                           => 'Pending Review',
        'PENDING REVIEW'                            => 'Pending Review',
        'UNDER REVIEW'                              => 'Pending Review',
        'PENDING_REVIEW'                            => 'Pending Review',
        'PASSED INITIAL'                            => 'Passed Initial Screening',
        'PASSED_INITIAL'                            => 'Passed Initial Screening',
        'PASSED INITIAL SCREENING'                  => 'Passed Initial Screening',
        'PENDING SCHEDULED'                         => 'Pending Schedule',
        'PENDING SCHEDULE'                          => 'Pending Schedule',
        'PENDING_SCHEDULED'                         => 'Pending Schedule',
        'CONFIRMED'                                 => 'Confirmed Schedule',
        'INTERVIEW_SCHEDULED'                       => 'Confirmed Schedule',
        'CONFIRMED SCHEDULE'                        => 'Confirmed Schedule',
        'RESCHEDULING'                              => 'Rescheduling Requested',
        'RESCHEDULING REQUESTED'                    => 'Rescheduling Requested',
        'RESCHEDULE_REQUESTED'                      => 'Rescheduling Requested',
        'SCHEDULING EXPIRED'                        => 'Scheduling Expired',
        'SCHEDULING_EXPIRED'                        => 'Scheduling Expired',
        'DECLINED - UNRESPONSIVE'                   => 'Declined (Unresponsive)',
        'UNRESPONSIVE'                              => 'Declined (Unresponsive)',
        'DECLINED_UNRESPONSIVE'                     => 'Declined (Unresponsive)',
        'PASSED FINAL INTERVIEW'                    => 'Passed Final Interview',
        'PASSED_FINAL_INTERVIEW'                    => 'Passed Final Interview',
        'PASSED FINAL — WAITING FOR SLOT'           => 'Waitlisted (No Open Slot)',
        'PASSED FINAL - WAITING FOR SLOT'           => 'Waitlisted (No Open Slot)',
        'WAITING_FOR_SLOT'                          => 'Waitlisted (No Open Slot)',
        'WAITLIST'                                  => 'Waitlisted',
        'WAITLISTED'                                => 'Waitlisted',
        'APPROVED FOR JOB OFFER'                    => 'Ready for Job Offer',
        'APPROVED_FOR_JOB_OFFER'                    => 'Ready for Job Offer',
        'PRESIDENT APPROVED'                        => 'Ready for Job Offer',
        'PRESIDENT_APPROVED'                        => 'Ready for Job Offer',
        'READY FOR OFFER'                           => 'Ready for Job Offer',
        'READY_FOR_OFFER'                           => 'Ready for Job Offer',
        'PASSED FINAL APPROVAL'                     => 'Passed Final Approval',
        'PASSED_FINAL_APPROVAL'                     => 'Passed Final Approval',
        'JOB OFFER PENDING'                         => 'Job Offer Pending',
        'JOB_OFFER_PENDING'                         => 'Job Offer Pending',
        'OFFER EXTENDED'                            => 'Job Offer Extended',
        'OFFER_EXTENDED'                            => 'Job Offer Extended',
        'JOB OFFER ACCEPTED'                        => 'Job Offer Accepted',
        'JOB_OFFER_ACCEPTED'                        => 'Job Offer Accepted',
        'OFFER ACCEPTED'                            => 'Job Offer Accepted',
        'OFFER_ACCEPTED'                            => 'Job Offer Accepted',
        'JOB OFFER DECLINED'                        => 'Job Offer Declined',
        'JOB_OFFER_DECLINED'                        => 'Job Offer Declined',
        'OFFER DECLINED'                            => 'Job Offer Declined',
        'OFFER_DECLINED'                            => 'Job Offer Declined',
        'CONTRACT SIGNING SCHEDULED'                => 'Contract Signing Scheduled',
        'CONTRACT_SIGNING_SCHEDULED'                => 'Contract Signing Scheduled',
        'REQUIREMENTS VERIFIED'                     => 'Requirements Verified',
        'REQUIREMENTS_VERIFIED'                     => 'Requirements Verified',
        'CONTRACT SIGNED & ONBOARDED'               => 'Contract Signed (Requirement Pending)',
        'CONTRACT_SIGNED_AND_ONBOARDED'             => 'Contract Signed (Requirement Pending)',
        'REQUIREMENT PENDING'                       => 'Contract Signed (Requirement Pending)',
        'REQUIREMENTS PENDING'                      => 'Contract Signed (Requirement Pending)',
        'OFFICIALLY HIRED'                          => 'Officially Hired',
        'OFFICIALLY_HIRED'                          => 'Officially Hired',
        'HIRED'                                     => 'Officially Hired',
        'OFFICIALLY HIRED & SIGNED'                 => 'Officially Hired & Signed',
        'COMPLETED REQUIREMENTS'                    => 'Officially Hired (Requirements Completed)',
        'COMPLETED_REQUIREMENTS'                    => 'Officially Hired (Requirements Completed)',
        'OFFICIALLY HIRED & REQUIREMENTS COMPLETED' => 'Officially Hired (Requirements Completed)',
        'PARTIALLY COMPLIANT'                       => 'Partially Compliant',
        'PARTIALLY_COMPLIANT'                       => 'Partially Compliant',
        'HIRED - PRE-EMPLOYMENT'                    => 'Hired (Pre-Employment)',
        'HIRED_PRE_EMPLOYMENT'                      => 'Hired (Pre-Employment)',
        'FAILED INTERVIEW'                          => 'Interview Failed',
        'INTERVIEW_FAILED'                          => 'Interview Failed',
        'SCREENING_REJECTED'                        => 'Screening Rejected',
        'REJECTED'                                  => 'Rejected',
        'FAILED'                                    => 'Rejected',
        'FAILED FINAL APPROVAL'                     => "President's Approval Declined",
        'FAILED_FINAL_APPROVAL'                     => "President's Approval Declined",
        'FAILED FINAL INTERVIEW'                    => 'Failed Final Interview',
        'FAILED_FINAL_INTERVIEW'                    => 'Failed Final Interview',
        'FAILED PRE-EMPLOYMENT'                     => 'Failed Pre-Employment',
        'FAILED_PRE_EMPLOYMENT'                     => 'Failed Pre-Employment',
        'CANDIDATE NO SHOW'                         => 'Candidate No Show',
        'CANDIDATE_NO_SHOW'                         => 'Candidate No Show',
        'CANDIDATE WITHDREW'                        => 'Application Withdrawn',
        'CANDIDATE_WITHDREW'                        => 'Application Withdrawn',
        'APPLICATION WITHDRAWN'                     => 'Application Withdrawn',
        'APPLICATION_WITHDRAWN'                     => 'Application Withdrawn',
        'WITHDRAWN'                                 => 'Application Withdrawn',
        'OFFER EXPIRED'                             => 'Offer Expired',
        'OFFER_EXPIRED'                             => 'Offer Expired',
        'JOB OFFER EXPIRED'                         => 'Job Offer Expired'
    ];

    if (isset($map[$norm])) {
        return $map[$norm];
    }

    return ucwords(strtolower(str_replace('_', ' ', $rawStatus)));
}

try {
    $sql = "SELECT 
                a.application_id,
                a.status, 
                a.applied_at, 
                a.updated_at,
                a.candidate_name,
                a.remarks,
                a.user_id,
                a.resume_path,
                u.status AS user_status,
                COALESCE(a.candidate_email, u.User_Email) AS User_Email,
                COALESCE(a.candidate_mobile, u.User_Mobile) AS User_Mobile,
                u.User_Fname, 
                u.User_MInitial, 
                u.User_Lname, 
                j.title AS job_title
            FROM applications_tbl a
            LEFT JOIN users_tbl u ON a.user_id = u.user_id
            LEFT JOIN jobs_tbl j ON a.job_id = j.job_id
            WHERE 1=1";

    $params = [];

    // Date / Year Filter
    if (!empty($selectedDate)) {
        $sql .= " AND DATE(a.applied_at) = :selected_date";
        $params['selected_date'] = $selectedDate;
    } elseif (!empty($selectedYear) && is_numeric($selectedYear)) {
        $sql .= " AND YEAR(a.applied_at) = :selected_year";
        $params['selected_year'] = intval($selectedYear);
    }

    // Search Filter
    if (!empty($search)) {
        $sql .= " AND (
            u.User_Fname LIKE :s1 OR 
            u.User_Lname LIKE :s2 OR 
            u.User_Email LIKE :s3 OR 
            a.candidate_name LIKE :s4 OR 
            a.candidate_email LIKE :s5 OR 
            a.candidate_mobile LIKE :s6 OR 
            u.User_Mobile LIKE :s7 OR 
            j.title LIKE :s8 OR 
            a.status LIKE :s9
        )";
        $searchVal = '%' . $search . '%';
        for ($i = 1; $i <= 9; $i++) {
            $params["s$i"] = $searchVal;
        }
    }

    // Status Filter
    if ($status_filter === 'hired') {
        $sql .= " AND UPPER(a.status) IN ('HIRED', 'PASSED INTERVIEW', 'PASSED', 'HIRED / PASSED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'OFFICIALLY HIRED', 'OFFICIALLY_HIRED', 'OFFICIALLY HIRED & SIGNED', 'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED', 'PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT', 'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED', 'HIRED - PRE-EMPLOYMENT', 'HIRED_PRE_EMPLOYMENT')";
    } elseif ($status_filter === 'approved_for_job_offer' || $status_filter === 'president_approved' || $status_filter === 'ready_for_offer') {
        $sql .= " AND UPPER(a.status) IN ('APPROVED FOR JOB OFFER', 'APPROVED_FOR_JOB_OFFER', 'PRESIDENT APPROVED', 'PRESIDENT_APPROVED', 'READY FOR OFFER', 'READY_FOR_OFFER', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL')";
    } elseif ($status_filter === 'job_offer_pending') {
        $sql .= " AND UPPER(a.status) IN ('JOB OFFER PENDING', 'JOB_OFFER_PENDING', 'OFFER EXTENDED', 'OFFER_EXTENDED')";
    } elseif ($status_filter === 'job_offer_accepted') {
        $sql .= " AND UPPER(a.status) IN ('JOB OFFER ACCEPTED', 'JOB_OFFER_ACCEPTED', 'OFFER ACCEPTED', 'OFFER_ACCEPTED')";
    } elseif ($status_filter === 'job_offer_declined') {
        $sql .= " AND UPPER(a.status) IN ('JOB OFFER DECLINED', 'JOB_OFFER_DECLINED', 'OFFER DECLINED', 'OFFER_DECLINED')";
    } elseif ($status_filter === 'completed_requirements') {
        $sql .= " AND UPPER(a.status) IN ('COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED')";
    } elseif ($status_filter === 'partially_compliant') {
        $sql .= " AND UPPER(a.status) IN ('PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT')";
    } elseif ($status_filter === 'rejected') {
        $sql .= " AND UPPER(a.status) IN ('REJECTED', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED', 'DECLINED - UNRESPONSIVE', 'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL', 'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'JOB OFFER DECLINED', 'JOB_OFFER_DECLINED', 'OFFER DECLINED', 'OFFER_DECLINED', 'FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT', 'CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW')";
    } elseif ($status_filter === 'passed_final_interview') {
        $sql .= " AND UPPER(a.status) IN ('PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW')";
    } elseif ($status_filter === 'withdrawn') {
        $sql .= " AND UPPER(a.status) IN ('CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'APPLICATION WITHDRAWN', 'APPLICATION_WITHDRAWN', 'WITHDRAWN')";
    } elseif ($status_filter === 'no_show') {
        $sql .= " AND UPPER(a.status) IN ('CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW')";
    } elseif ($status_filter === 'contract_signing') {
        $sql .= " AND UPPER(a.status) IN ('CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED', 'REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED')";
    } elseif ($status_filter === 'pending_evaluation') {
        $sql .= " AND UPPER(a.status) IN ('PENDING', 'REVIEW_REQUIRED', 'PENDING REVIEW', 'UNDER REVIEW', 'PENDING_REVIEW')";
    } elseif ($status_filter === 'passed_initial') {
        $sql .= " AND UPPER(a.status) IN ('PASSED INITIAL', 'PASSED_INITIAL', 'PASSED INITIAL SCREENING', 'PASSED_INITIAL_SCREENING')";
    } elseif ($status_filter === 'pending_scheduled') {
        $sql .= " AND UPPER(a.status) IN ('PENDING SCHEDULED', 'PENDING SCHEDULE', 'PENDING_SCHEDULED')";
    } elseif ($status_filter === 'confirmed_schedule') {
        $sql .= " AND UPPER(a.status) IN ('CONFIRMED', 'INTERVIEW_SCHEDULED', 'CONFIRMED SCHEDULE', 'CONFIRMED_SCHEDULE')";
    } elseif ($status_filter === 'rescheduling') {
        $sql .= " AND UPPER(a.status) IN ('RESCHEDULING', 'RESCHEDULING REQUESTED', 'RESCHEDULE_REQUESTED', 'RESCHEDULED')";
    } elseif ($status_filter === 'scheduling_expired') {
        $sql .= " AND UPPER(a.status) IN ('SCHEDULING EXPIRED', 'SCHEDULING_EXPIRED', 'DECLINED - UNRESPONSIVE', 'UNRESPONSIVE', 'DECLINED_UNRESPONSIVE')";
    } elseif ($status_filter === 'offer_expired') {
        $sql .= " AND UPPER(a.status) IN ('OFFER EXPIRED', 'OFFER_EXPIRED', 'JOB OFFER EXPIRED')";
    } elseif ($status_filter === 'waitlisted') {
        $sql .= " AND UPPER(a.status) IN ('PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT', 'WAITLIST', 'WAITLISTED')";
    } elseif (!empty($status_filter)) {
        $sql .= " AND (LOWER(a.status) = :sf_exact OR LOWER(REPLACE(a.status, ' ', '_')) = :sf_slug)";
        $params['sf_exact'] = $status_filter;
        $params['sf_slug']  = str_replace(' ', '_', $status_filter);
    }

    $sql .= " ORDER BY a.applied_at DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // ── Classify records for Summary Counts ──────────────────────────────────
    $activeRecords  = [];
    $deletedRecords = [];

    $countActive    = 0;
    $countHired     = 0;
    $countRejected  = 0;
    $countDeleted   = 0;

    $hiredStatuses = [
        'HIRED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'OFFICIALLY HIRED',
        'OFFICIALLY_HIRED', 'OFFICIALLY HIRED & SIGNED', 'CONTRACT SIGNED & ONBOARDED',
        'CONTRACT_SIGNED_AND_ONBOARDED', 'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS',
        'OFFICIALLY HIRED & REQUIREMENTS COMPLETED', 'PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT',
        'HIRED - PRE-EMPLOYMENT', 'HIRED_PRE_EMPLOYMENT', 'PASSED', 'HIRED / PASSED', 'PASSED INTERVIEW'
    ];

    $rejectedStatuses = [
        'REJECTED', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED',
        'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL',
        'DECLINED - UNRESPONSIVE', 'SCHEDULING EXPIRED', 'SCHEDULING_EXPIRED', 'UNRESPONSIVE',
        'OFFER EXPIRED', 'OFFER_EXPIRED', 'JOB OFFER EXPIRED', 'JOB OFFER DECLINED',
        'JOB_OFFER_DECLINED', 'OFFER DECLINED', 'OFFER_DECLINED', 'FAILED PRE-EMPLOYMENT',
        'FAILED_PRE_EMPLOYMENT', 'CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW'
    ];

    $withdrawnStatuses = [
        'CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'APPLICATION WITHDRAWN', 'APPLICATION_WITHDRAWN', 'WITHDRAWN'
    ];

    foreach ($applications as $app) {
        $name = !empty($app['candidate_name']) ? $app['candidate_name'] : trim(($app['User_Fname'] ?? '') . ' ' . (!empty($app['User_MInitial']) ? $app['User_MInitial'] . '. ' : '') . ($app['User_Lname'] ?? ''));
        $rawStatus = strtoupper(trim($app['status'] ?? ''));

        $isAnonymized = (
            ($app['user_status'] ?? '') === 'Deleted' || 
            ($app['resume_path'] ?? '') === '[DELETED]' ||
            stripos($name, 'Deleted') !== false ||
            stripos($name, 'Anonymized') !== false ||
            ($app['User_Fname'] ?? '') === 'Deleted' ||
            ($app['User_Fname'] ?? '') === 'Anonymized'
        );

        $app['actual_status_display'] = format_applicant_status($app['status'] ?? '');

        if ($isAnonymized) {
            $countDeleted++;
            $deletedRecords[] = $app;
        } else {
            if (in_array($rawStatus, $hiredStatuses)) {
                $countHired++;
            } elseif (in_array($rawStatus, $rejectedStatuses)) {
                $countRejected++;
            } elseif (in_array($rawStatus, $withdrawnStatuses)) {
                $countDeleted++;
            } else {
                $countActive++;
            }
            $activeRecords[] = $app;
        }
    }

    $totalApplicants = count($applications);

    // ── Multi-Page Chunking Function for Portrait A4 ─────────────────────────
    // In Portrait A4:
    // - Up to 10 rows fit alongside Header, Metadata, Summary, Notices & Sign-off on Page 1 (Page 1 of 1).
    // - For larger sets: Page 1 holds 12 rows. Subsequent pages hold up to 16 rows.
    // - Final page holds remaining rows (up to 10) alongside Notices & Sign-off.
    function paginate_status_records($records) {
        $total = count($records);
        if ($total <= 10) {
            return [[
                'records'  => $records,
                'is_first' => true,
                'is_last'  => true
            ]];
        }

        $pages = [];

        // Up to 22 records: split cleanly into Page 1 and Page 2
        if ($total <= 22) {
            $p1Count = min(12, ceil($total / 2) + 1);
            $pages[] = [
                'records'  => array_slice($records, 0, $p1Count),
                'is_first' => true,
                'is_last'  => false
            ];
            $pages[] = [
                'records'  => array_slice($records, $p1Count),
                'is_first' => false,
                'is_last'  => true
            ];
            return $pages;
        }

        // More than 22 records: Page 1 holds 12 records
        $pages[] = [
            'records'  => array_slice($records, 0, 12),
            'is_first' => true,
            'is_last'  => false
        ];
        $offset = 12;

        while (($total - $offset) > 10) {
            $remaining = $total - $offset;
            if ($remaining <= 20) {
                $midCount = ceil($remaining / 2);
                $pages[] = [
                    'records'  => array_slice($records, $offset, $midCount),
                    'is_first' => false,
                    'is_last'  => false
                ];
                $offset += $midCount;
                break;
            } else {
                $pages[] = [
                    'records'  => array_slice($records, $offset, 16),
                    'is_first' => false,
                    'is_last'  => false
                ];
                $offset += 16;
            }
        }

        if ($offset < $total) {
            $pages[] = [
                'records'  => array_slice($records, $offset),
                'is_first' => false,
                'is_last'  => true
            ];
        }

        return $pages;
    }

    // Prepare display records
    $allDisplayRecords = [];
    $recNum = 1;
    foreach ($activeRecords as $app) {
        $app['rec_num'] = $recNum++;
        $app['is_deleted_record'] = false;
        $allDisplayRecords[] = $app;
    }
    foreach ($deletedRecords as $app) {
        $app['rec_num'] = $recNum++;
        $app['is_deleted_record'] = true;
        $allDisplayRecords[] = $app;
    }

    $statusPages = paginate_status_records($allDisplayRecords);
    $totalStatusPages = count($statusPages);

    // ── Metadata variables (Verification code removed) ──────────────────────
    $reportRefNo = 'AUD-' . date('Ymd') . '-001';
    $generatedFormatted = date('j F Y, g:i A') . ' (PHT)';

    if (!empty($selectedDate)) {
        $dateFilterLabel = date('j F Y', strtotime($selectedDate));
    } elseif (!empty($selectedYear)) {
        $dateFilterLabel = 'Year ' . $selectedYear;
    } else {
        $dateFilterLabel = 'All historical dates';
    }

    $statusFilterLabels = [
        'pending_evaluation'     => 'Pending Review',
        'passed_initial'         => 'Passed Initial Screening',
        'pending_scheduled'      => 'Pending Schedule',
        'confirmed_schedule'     => 'Confirmed Schedule',
        'rescheduling'           => 'Rescheduling Requested',
        'scheduling_expired'     => 'Scheduling Expired',
        'no_show'                => 'Interview No Show',
        'passed_final_interview' => 'Passed Final Interview',
        'waitlisted'             => 'Waitlisted',
        'ready_for_offer'        => 'Ready for Offer',
        'approved_for_job_offer' => 'Ready for Offer',
        'president_approved'     => 'Ready for Offer',
        'job_offer_pending'      => 'Job Offer Pending',
        'job_offer_accepted'     => 'Job Offer Accepted',
        'job_offer_declined'     => 'Job Offer Declined',
        'contract_signing'       => 'Contract Signing Scheduled',
        'hired'                  => 'Officially Hired',
        'completed_requirements' => 'Completed Requirements',
        'partially_compliant'    => 'Partially Compliant',
        'withdrawn'              => 'Application Withdrawn',
        'offer_expired'          => 'Offer Expired',
        'rejected'               => 'Rejected'
    ];
    $statusFilterLabel = !empty($status_filter) ? ($statusFilterLabels[$status_filter] ?? ucwords(str_replace('_', ' ', $status_filter))) : 'All Statuses';
    $searchFilterLabel = !empty($search) ? '"' . $search . '"' : 'None';

    $generatedBy = !empty($adminParam) ? $adminParam . ', HR Administrator' : 'HR Administrator';

    if ($format === 'pdf') {
        header('Content-Type: text/html; charset=utf-8');
        ?>
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Applicant Status Audit Report - Airship Express</title>
          <link href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" rel="stylesheet" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

            * {
              box-sizing: border-box;
            }

            @page {
              size: A4 portrait;
              margin: 10mm 12mm 10mm 12mm;
            }

            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #000000;
              margin: 0;
              padding: 0;
              background: #64748b;
              -webkit-font-smoothing: antialiased;
            }

            /* Screen Action Bar */
            .action-bar {
              background: #1e293b;
              padding: 10px 24px;
              display: flex;
              justify-content: flex-end;
              align-items: center;
              color: #ffffff;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
              position: sticky;
              top: 0;
              z-index: 1000;
            }
            .action-btn {
              background: #2563eb;
              color: #ffffff;
              border: none;
              padding: 7px 16px;
              font-size: 12px;
              font-weight: 600;
              border-radius: 4px;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 6px;
            }
            .action-btn:hover {
              background: #1d4ed8;
            }
            .action-btn-secondary {
              background: #475569;
              color: #ffffff;
              border: none;
              padding: 7px 14px;
              font-size: 12px;
              font-weight: 600;
              border-radius: 4px;
              cursor: pointer;
              margin-left: 8px;
            }
            .action-btn-secondary:hover {
              background: #64748b;
            }

            /* Authentic Portrait A4 Page Sheet (210mm x 297mm) */
            .page-sheet {
              width: 210mm;
              max-width: 100%;
              min-height: 297mm;
              margin: 22px auto;
              background: #ffffff;
              box-shadow: 0 6px 24px rgba(0, 0, 0, 0.22);
              border: 1px solid #cbd5e1;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              box-sizing: border-box;
              border-radius: 2px;
            }

            .page-inner {
              padding: 24px 28px 12px 28px;
              flex: 1;
              display: flex;
              flex-direction: column;
            }

            /* Push notices & sign-off to bottom of page when content is short */
            .bottom-sections {
              margin-top: auto;
            }

            /* Clean Header */
            .doc-header {
              border-bottom: 2px solid #000000;
              padding-bottom: 8px;
              margin-bottom: 12px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .doc-header-left h1 {
              font-size: 18px;
              font-weight: 800;
              margin: 0 0 2px 0;
              color: #000000;
              text-transform: uppercase;
              letter-spacing: 0.4px;
            }
            .doc-header-left .company-name {
              font-size: 11.5px;
              font-weight: 700;
              color: #334155;
            }
            .doc-header-right {
              text-align: right;
              font-size: 10px;
              font-weight: 600;
              color: #475569;
            }

            .continuation-header {
              border-bottom: 1.5px solid #000000;
              padding-bottom: 6px;
              margin-bottom: 12px;
            }
            .continuation-title {
              font-size: 14px;
              font-weight: 800;
              margin: 0;
              color: #000000;
              text-transform: uppercase;
              letter-spacing: 0.4px;
            }

            /* Plain Table Styles */
            .plain-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
              font-size: 10.5px;
            }
            .plain-table th,
            .plain-table td {
              border: 1px solid #334155;
              padding: 5px 7px;
              text-align: left;
              vertical-align: middle;
            }
            .plain-table th {
              background: #f1f5f9;
              color: #000000;
              font-weight: 700;
              font-size: 9.5px;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            .plain-table td {
              color: #000000;
              background: #ffffff;
            }

            /* Metadata Table */
            .meta-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
              font-size: 10px;
            }
            .meta-table td {
              border: 1px solid #64748b;
              padding: 4px 7px;
            }
            .meta-table .meta-label {
              width: 17%;
              font-weight: 700;
              color: #000000;
              background: #f8fafc;
            }
            .meta-table .meta-val {
              width: 33%;
              color: #000000;
            }

            /* Section Header */
            .section-title {
              font-size: 11px;
              font-weight: 700;
              color: #000000;
              margin: 10px 0 5px 0;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }

            /* Summary Table */
            .summary-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
              font-size: 10px;
            }
            .summary-table th,
            .summary-table td {
              border: 1px solid #334155;
              padding: 5px 7px;
              text-align: center;
            }
            .summary-table th {
              background: #f1f5f9;
              color: #000000;
              font-weight: 700;
              font-size: 9.5px;
              text-transform: uppercase;
            }
            .summary-table td {
              font-size: 12px;
              font-weight: 700;
              color: #000000;
            }

            .candidate-name {
              font-weight: 700;
              color: #000000;
            }
            .candidate-id {
              font-size: 9px;
              color: #475569;
              margin-top: 1px;
            }
            .contact-email {
              color: #000000;
              word-break: break-all;
            }
            .contact-phone {
              color: #334155;
              font-size: 9.5px;
              margin-top: 1px;
            }

            /* Notices */
            .notices-section {
              margin-top: 10px;
            }
            .notices-list {
              list-style-type: decimal;
              padding-left: 16px;
              margin: 4px 0 8px 0;
              font-size: 9.5px;
              line-height: 1.45;
              color: #1e293b;
            }
            .notices-list li {
              margin-bottom: 2px;
            }

            /* Sign-off Section */
            .signoff-section {
              margin-top: 12px;
              margin-bottom: 8px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .signoff-grid {
              display: flex;
              justify-content: space-between;
              margin-top: 8px;
            }
            .signoff-col {
              width: 44%;
            }
            .signoff-line {
              border-top: 1.2px solid #000000;
              width: 100%;
              margin-bottom: 4px;
            }
            .signoff-title {
              font-weight: 700;
              font-size: 10.5px;
              color: #000000;
            }
            .signoff-sub {
              font-size: 9.5px;
              color: #334155;
              margin-top: 1px;
            }
            .signoff-date {
              font-size: 9.5px;
              color: #000000;
              margin-top: 3px;
            }

            /* Footer */
            .report-footer {
              padding: 8px 28px 10px 28px;
              border-top: 1px solid #cbd5e1;
              font-size: 9px;
              color: #475569;
              display: flex;
              justify-content: space-between;
              background: #ffffff;
            }

            /* Print Styles (Strict A4 Portrait) */
            @media print {
              @page {
                size: A4 portrait;
                margin: 10mm 12mm 10mm 12mm;
              }
              html, body {
                width: auto !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .action-bar {
                display: none !important;
              }
              .page-sheet {
                width: 100% !important;
                max-width: 100% !important;
                min-height: auto !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
                page-break-after: always !important;
                break-after: page !important;
              }
              .page-sheet:last-of-type {
                page-break-after: avoid !important;
                break-after: avoid !important;
              }
              .page-inner {
                padding: 0 !important;
              }
              .report-footer {
                padding: 6px 0 0 0 !important;
                border-top: 1px solid #94a3b8 !important;
              }
              table {
                page-break-inside: auto;
              }
              tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }
              thead {
                display: table-header-group;
              }
              .avoid-break {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>

          <!-- Action Bar (Screen Only) -->
          <div class="action-bar no-print">
            <button class="action-btn" onclick="window.print()">
              <i class="bx bx-printer"></i> Print / Save as PDF
            </button>
          </div>

          <?php foreach ($statusPages as $pIndex => $pData): 
              $pageNumber = $pIndex + 1;
              $isFirst = $pData['is_first'];
              $isLast = $pData['is_last'];
              $pageRecords = $pData['records'];
          ?>
            <!-- Portrait A4 Page Sheet <?= $pageNumber ?> of <?= $totalStatusPages ?> -->
            <div class="page-sheet">
              <div class="page-inner">
                <?php if ($isFirst): ?>
                  <div class="doc-header">
                    <div class="doc-header-left">
                      <div class="company-name">Airship Express · Human Resources Department</div>
                      <h1>Applicant Status Audit Report</h1>
                    </div>
                    <div class="doc-header-right">
                      <div>CONFIDENTIAL · HR AUDIT USE ONLY</div>
                      <div>Ref: <?= htmlspecialchars($reportRefNo) ?></div>
                    </div>
                  </div>

                  <!-- Metadata Table -->
                  <table class="meta-table">
                    <tr>
                      <td class="meta-label">Report Ref No.</td>
                      <td class="meta-val"><?= htmlspecialchars($reportRefNo) ?></td>
                      <td class="meta-label">Generated Date</td>
                      <td class="meta-val"><?= htmlspecialchars($generatedFormatted) ?></td>
                    </tr>
                    <tr>
                      <td class="meta-label">Date Filter</td>
                      <td class="meta-val"><?= htmlspecialchars($dateFilterLabel) ?></td>
                      <td class="meta-label">Status Filter</td>
                      <td class="meta-val"><?= htmlspecialchars($statusFilterLabel) ?></td>
                    </tr>
                    <tr>
                      <td class="meta-label">Search Keyword</td>
                      <td class="meta-val"><?= htmlspecialchars($searchFilterLabel) ?></td>
                      <td class="meta-label">Generated By</td>
                      <td class="meta-val"><?= htmlspecialchars($generatedBy) ?></td>
                    </tr>
                  </table>

                  <!-- 1. Summary -->
                  <div class="section-title"> Summary</div>
                  <table class="summary-table">
                    <thead>
                      <tr>
                        <th>Total Applicants</th>
                        <th>Active / In Progress</th>
                        <th>Hired</th>
                        <th>Rejected</th>
                        <th>Deleted / Withdrawn</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><?= $totalApplicants ?></td>
                        <td><?= $countActive ?></td>
                        <td><?= $countHired ?></td>
                        <td><?= $countRejected ?></td>
                        <td><?= $countDeleted ?></td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- 2. Applicant Audit Records -->
                  <div class="section-title"> Applicant Audit Records</div>
                <?php else: ?>
                  <!-- Continuation Header for Page 2+ -->
                  <div class="doc-header continuation-header">
                    <div class="doc-header-left">
                      <div class="company-name">Airship Express · Human Resources Department</div>
                      <h2 class="continuation-title">Applicant Status Audit Report — Continued</h2>
                    </div>
                    <div class="doc-header-right">
                      <div>CONFIDENTIAL · HR AUDIT USE ONLY</div>
                      <div>Ref: <?= htmlspecialchars($reportRefNo) ?> · Sheet <?= $pageNumber ?> of <?= $totalStatusPages ?></div>
                    </div>
                  </div>
                <?php endif; ?>

                <!-- Records Table -->
                <table class="plain-table">
                  <thead>
                    <tr>
                      <th style="width: 28px; text-align: center;">#</th>
                      <th style="width: 21%;">Candidate Name</th>
                      <th style="width: 23%;">Contact Details</th>
                      <th style="width: 18%;">Applied Position</th>
                      <th style="width: 12%;">Applied Date</th>
                      <th style="width: 12%;">Last Updated</th>
                      <th style="width: 14%;">Applicant Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <?php if (!empty($pageRecords)): ?>
                      <?php foreach ($pageRecords as $app): 
                        $cNum = $app['rec_num'];
                        $isDel = $app['is_deleted_record'];
                        $appliedDate = !empty($app['applied_at']) ? date('Y-m-d', strtotime($app['applied_at'])) : '—';
                        $updatedDate = !empty($app['updated_at']) ? date('Y-m-d H:i', strtotime($app['updated_at'])) : $appliedDate;

                        if ($isDel): 
                          $uid = $app['user_id'] ?? '';
                          if (empty($uid) && preg_match('/\d+/', $app['candidate_name'] ?? '', $m)) {
                              $uid = $m[0];
                          }
                      ?>
                          <tr>
                            <td style="text-align: center;"><?= $cNum ?></td>
                            <td>
                              <div class="candidate-name">Applicant #<?= htmlspecialchars($uid ?: 'N/A') ?></div>
                              <div class="candidate-id">(Account Deleted)</div>
                            </td>
                            <td>
                              <span style="color: #475569; font-size: 9.5px;">Redacted for privacy (RA 10173)</span>
                            </td>
                            <td><?= htmlspecialchars($app['job_title'] ?: 'General Application') ?></td>
                            <td><?= $appliedDate ?></td>
                            <td><?= $updatedDate ?></td>
                            <td>
                              Deleted<br>
                              <span style="font-size: 9px; color: #64748b;">(Data subject request)</span>
                            </td>
                          </tr>
                      <?php else: 
                          $cName = !empty($app['candidate_name']) ? $app['candidate_name'] : trim(($app['User_Fname'] ?? '') . ' ' . (!empty($app['User_MInitial']) ? $app['User_MInitial'] . '. ' : '') . ($app['User_Lname'] ?? ''));
                          $plainEmail = !empty($app['User_Email']) ? $app['User_Email'] : '—';
                          $plainPhone = !empty($app['User_Mobile']) ? $app['User_Mobile'] : '';
                          $actualStatus = $app['actual_status_display'];
                      ?>
                          <tr>
                            <td style="text-align: center;"><?= $cNum ?></td>
                            <td>
                              <div class="candidate-name"><?= htmlspecialchars($cName) ?></div>
                              <div class="candidate-id">ID: #<?= htmlspecialchars($app['user_id'] ?? 'N/A') ?></div>
                            </td>
                            <td>
                              <div class="contact-email"><?= htmlspecialchars($plainEmail) ?></div>
                              <?php if (!empty($plainPhone)): ?>
                                <div class="contact-phone"><?= htmlspecialchars($plainPhone) ?></div>
                              <?php endif; ?>
                            </td>
                            <td><?= htmlspecialchars($app['job_title'] ?: 'General Application') ?></td>
                            <td><?= $appliedDate ?></td>
                            <td><?= $updatedDate ?></td>
                            <td><strong><?= htmlspecialchars($actualStatus) ?></strong></td>
                          </tr>
                      <?php endif; endforeach; ?>
                    <?php else: ?>
                      <tr>
                        <td colspan="7" style="text-align: center; color: #475569; padding: 14px;">No applicant records found matching the specified filter criteria.</td>
                      </tr>
                    <?php endif; ?>
                  </tbody>
                </table>

                <?php if ($isLast): ?>
                  <!-- Notices & Sign-off pushed to bottom of page -->
                  <div class="bottom-sections">
                    <div class="notices-section avoid-break">
                      <div class="section-title">3. Notices & Data Governance</div>
                      <ul class="notices-list">
                        <li>Personal data of deleted accounts has been redacted in compliance with the Data Privacy Act of 2012 (RA 10173). Applicant IDs are retained as pseudonymous audit references.</li>
                        <li>This report contains confidential candidate evaluation information for authorized HR administration and compliance purposes only.</li>
                        <li>This is an official system-generated audit report. All generation actions, filters, and timestamps are recorded in the audit trail.</li>
                      </ul>
                    </div>

                    <div class="signoff-section avoid-break">
                      <div class="section-title">4. Sign-off & Approvals</div>
                      <div class="signoff-grid">
                        <div class="signoff-col">
                          <div class="signoff-line"></div>
                          <div class="signoff-title">Prepared By</div>
                          <div class="signoff-sub">HR Recruitment Officer, Airship Express</div>
                          <div class="signoff-date">Date: ________________________</div>
                        </div>
                        <div class="signoff-col">
                          <div class="signoff-line"></div>
                          <div class="signoff-title">Noted and Approved By</div>
                          <div class="signoff-sub">HR Department Head, Airship Express</div>
                          <div class="signoff-date">Date: ________________________</div>
                        </div>
                      </div>
                    </div>
                  </div>
                <?php endif; ?>
              </div>

              <!-- Running Footer on EVERY page -->
              <div class="report-footer avoid-break">
                <div>Report Ref: <?= htmlspecialchars($reportRefNo) ?></div>
                <div>Confidential · Airship Express Human Resources</div>
                <div>Page <?= $pageNumber ?> of <?= $totalStatusPages ?></div>
              </div>
            </div>
          <?php endforeach; ?>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
        </html>
        <?php
        exit();
    }

    // ── CSV Export with exact data formatting matching PDF Report ───────────
    $filename = "Applicant_Status_Audit_Report_" . date('Y-m-d') . ".csv";
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');

    $output = fopen('php://output', 'w');

    // UTF-8 Byte Order Mark (BOM) for Excel display compatibility
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

    // Output CSV headers matching PDF report table exactly
    fputcsv($output, [
        'Record #', 
        'Candidate Name', 
        'Applicant ID', 
        'Contact Email', 
        'Contact Mobile', 
        'Applied Position', 
        'Applied Date', 
        'Last Updated', 
        'Applicant Status',
        'Record Classification'
    ], ',', '"', "\\");

    // Output Active Records
    $rowNum = 1;
    foreach ($activeRecords as $app) {
        $cName = !empty($app['candidate_name']) ? $app['candidate_name'] : trim(($app['User_Fname'] ?? '') . ' ' . (!empty($app['User_MInitial']) ? $app['User_MInitial'] . '. ' : '') . ($app['User_Lname'] ?? ''));
        $appliedDate = !empty($app['applied_at']) ? date('Y-m-d', strtotime($app['applied_at'])) : '—';
        $updatedDate = !empty($app['updated_at']) ? date('Y-m-d H:i', strtotime($app['updated_at'])) : $appliedDate;
        $plainEmail  = !empty($app['User_Email']) ? $app['User_Email'] : '—';
        $plainPhone  = !empty($app['User_Mobile']) ? $app['User_Mobile'] : '';
        $actualStatus = $app['actual_status_display'];

        fputcsv($output, [
            $rowNum++,
            $cName,
            $app['user_id'] ?? 'N/A',
            $plainEmail,
            $plainPhone,
            $app['job_title'] ?: 'General Application',
            $appliedDate,
            $updatedDate,
            $actualStatus,
            'Active Applicant'
        ], ',', '"', "\\");
    }

    // Output Deleted Records
    foreach ($deletedRecords as $app) {
        $uid = $app['user_id'] ?? '';
        if (empty($uid) && preg_match('/\d+/', $app['candidate_name'] ?? '', $m)) {
            $uid = $m[0];
        }
        $appliedDate = !empty($app['applied_at']) ? date('Y-m-d', strtotime($app['applied_at'])) : '—';
        $updatedDate = !empty($app['updated_at']) ? date('Y-m-d H:i', strtotime($app['updated_at'])) : $appliedDate;

        fputcsv($output, [
            $rowNum++,
            'REDACTED',
            $uid ?: 'N/A',
            'REDACTED',
            'REDACTED',
            $app['job_title'] ?: 'General Application',
            $appliedDate,
            $updatedDate,
            'Deleted',
            'Deleted (Redacted)'
        ], ',', '"', "\\");
    }

    fclose($output);
    exit();

} catch (PDOException $e) {
    http_response_code(500);
    echo "Report generation failed: " . htmlspecialchars($e->getMessage());
}
?>
