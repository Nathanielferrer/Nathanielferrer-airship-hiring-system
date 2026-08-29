<?php
require_once __DIR__ . '/../db.php';

$search        = isset($_GET['search']) ? trim($_GET['search']) : '';
$selectedDate  = isset($_GET['selected_date']) ? trim($_GET['selected_date']) : '';
$status_filter = isset($_GET['status_filter']) ? strtolower(trim($_GET['status_filter'])) : '';
$format        = isset($_GET['format']) ? strtolower(trim($_GET['format'])) : 'csv';

try {
    $sql = "SELECT 
                a.status, 
                a.applied_at, 
                a.updated_at,
                a.candidate_name,
                u.User_Fname, 
                u.User_Lname, 
                j.title AS job_title
            FROM applications_tbl a
            INNER JOIN users_tbl u ON a.user_id = u.user_id
            INNER JOIN jobs_tbl j ON a.job_id = j.job_id
            WHERE 1=1";

    $params = [];

    if (!empty($selectedDate)) {
        $sql .= " AND DATE(a.applied_at) = :selected_date";
        $params['selected_date'] = $selectedDate;
    }

    if (!empty($search)) {
        $sql .= " AND (u.User_Fname LIKE :search OR u.User_Lname LIKE :search OR u.User_Email LIKE :search OR a.candidate_name LIKE :search OR a.candidate_email LIKE :search OR j.title LIKE :search OR a.status LIKE :search)";
        $params['search'] = '%' . $search . '%';
    }

    if ($status_filter === 'hired') {
        $sql .= " AND UPPER(a.status) IN ('HIRED', 'PASSED INTERVIEW', 'PASSED', 'HIRED / PASSED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED')";
    } else if ($status_filter === 'rejected') {
        $sql .= " AND UPPER(a.status) IN ('REJECTED', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED', 'DECLINED - UNRESPONSIVE', 'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL', 'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW')";
    } else if ($status_filter === 'passed_final_interview') {
        $sql .= " AND UPPER(a.status) IN ('PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW')";
    } else if ($status_filter === 'withdrawn') {
        $sql .= " AND UPPER(a.status) IN ('CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW')";
    } else if ($status_filter === 'incomplete_requirements') {
        $sql .= " AND UPPER(a.status) IN ('INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS')";
    } else if ($status_filter === 'failed_pre_employment') {
        $sql .= " AND UPPER(a.status) IN ('FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT')";
    } else if ($status_filter === 'contract_signing') {
        $sql .= " AND UPPER(a.status) IN ('CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED', 'REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED')";
    }

    $sql .= " ORDER BY a.applied_at DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if ($format === 'pdf') {
        // Render Printable PDF / HTML view
        header('Content-Type: text/html; charset=utf-8');
        $generatedOn = date('F d, Y \a\t h:i A');
        $dateFilterLabel = !empty($selectedDate) ? date('F d, Y', strtotime($selectedDate)) : 'All Historical Dates';
        ?>
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Airship Express - Applicant Status Master Report</title>
          <link href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" rel="stylesheet" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 30px;
              background: #ffffff;
            }
            .report-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding-bottom: 20px;
              border-bottom: 3px solid #0f172a;
              margin-bottom: 24px;
            }
            .brand-title {
              font-family: 'Montserrat', sans-serif;
              font-size: 24px;
              font-weight: 800;
              color: #0f172a;
              margin: 0;
            }
            .brand-subtitle {
              font-size: 13px;
              color: #64748b;
              margin-top: 4px;
            }
            .report-meta {
              text-align: right;
              font-size: 12px;
              color: #475569;
              line-height: 1.6;
            }
            .summary-box {
              display: flex;
              gap: 20px;
              margin-bottom: 24px;
              background: #f8fafc;
              padding: 16px 20px;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
            }
            .summary-item {
              flex: 1;
            }
            .summary-label {
              font-size: 11px;
              font-weight: 600;
              text-transform: uppercase;
              color: #64748b;
              letter-spacing: 0.5px;
            }
            .summary-val {
              font-size: 18px;
              font-weight: 700;
              color: #0f172a;
              margin-top: 2px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th {
              background: #0f172a;
              color: #ffffff;
              font-family: 'Montserrat', sans-serif;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              padding: 10px 14px;
              text-align: left;
              letter-spacing: 0.5px;
            }
            td {
              padding: 11px 14px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 13px;
              color: #1e293b;
            }
            tr:nth-child(even) {
              background: #f8fafc;
            }
            .badge {
              display: inline-block;
              padding: 3px 10px;
              border-radius: 12px;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.3px;
            }
            .badge-passed { background: #d1fae5; color: #047857; border: 1px solid #a7f3d0; }
            .badge-hired { background: #d1fae5; color: #047857; border: 1px solid #a7f3d0; }
            .badge-pending { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
            .badge-rejected { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
            @media print {
              body { padding: 0; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="report-header">
            <div>
              <h1 class="brand-title">AIRSHIP EXPRESS</h1>
              <div class="brand-subtitle">Applicant Status Master Audit Report</div>
            </div>
            <div class="report-meta">
              <div><strong>Generated Date:</strong> <?= $generatedOn ?></div>
              <div><strong>Date Range Filter:</strong> <?= $dateFilterLabel ?></div>
              <div><strong>Total Records:</strong> <?= count($applications) ?></div>
            </div>
          </div>

          <div class="summary-box">
            <div class="summary-item">
              <div class="summary-label">Total Applicants Listed</div>
              <div class="summary-val"><?= count($applications) ?></div>
            </div>
            <div class="summary-item">
              <div class="summary-label">System Audit Status</div>
              <div class="summary-val" style="color: #047857;">Verified & Syncing</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Applicant Name</th>
                <th>Applied Position</th>
                <th>Application Date</th>
                <th>Decision / Updated Date</th>
                <th>Current Hiring Status</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($applications as $idx => $app): 
                $name = !empty($app['candidate_name']) ? $app['candidate_name'] : trim($app['User_Fname'] . ' ' . $app['User_Lname']);
                $date = date('M d, Y', strtotime($app['applied_at']));
                $updatedDate = !empty($app['updated_at']) ? date('M d, Y h:i A', strtotime($app['updated_at'])) : $date;
                $statusUpper = strtoupper($app['status']);

                $badgeClass = 'badge-pending';
                if (in_array($statusUpper, ['HIRED', 'HIRED / PASSED', 'PASSED', 'PASSED INTERVIEW', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED', 'OFFICIALLY HIRED & SIGNED'])) {
                  $badgeClass = 'badge-hired';
                } elseif (in_array($statusUpper, ['CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED', 'REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED', 'PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW', 'PASSED INITIAL', 'CONFIRMED', 'INTERVIEW_SCHEDULED'])) {
                  $badgeClass = 'badge-passed';
                } elseif (in_array($statusUpper, ['REJECTED', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL', 'DECLINED - UNRESPONSIVE', 'CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS', 'FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT'])) {
                  $badgeClass = 'badge-rejected';
                }
                $displayStatus = $statusUpper;
                if (in_array($statusUpper, ['CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED', 'OFFICIALLY HIRED & SIGNED', 'HIRED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'PASSED', 'HIRED / PASSED'])) {
                  $displayStatus = 'OFFICIALLY HIRED';
                }
              ?>
                <tr>
                  <td><?= $idx + 1 ?></td>
                  <td><strong><?= htmlspecialchars($name) ?></strong></td>
                  <td><?= htmlspecialchars($app['job_title']) ?></td>
                  <td><?= $date ?></td>
                  <td><?= $updatedDate ?></td>
                  <td><span class="badge <?= $badgeClass ?>"><?= htmlspecialchars($displayStatus) ?></span></td>
                </tr>
              <?php endforeach; ?>
              <?php if (empty($applications)): ?>
                <tr>
                  <td colSpan="6" style="text-align: center; padding: 20px;">No application records found matching the specified parameters.</td>
                </tr>
              <?php endif; ?>
            </tbody>
          </table>

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

    // Default CSV Export
    $filename = "Applicant_Status_Report_" . date('Y-m-d') . ".csv";
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');

    $output = fopen('php://output', 'w');

    // Output CSV headers
    fputcsv($output, ['Applicant Name', 'Job Position', 'Date Applied', 'Decision / Updated Date', 'Status']);

    // Output data rows
    foreach ($applications as $app) {
        $name = !empty($app['candidate_name']) ? $app['candidate_name'] : trim($app['User_Fname'] . ' ' . $app['User_Lname']);
        $appliedDate = date('Y-m-d', strtotime($app['applied_at']));
        $updatedDate = !empty($app['updated_at']) ? date('Y-m-d H:i', strtotime($app['updated_at'])) : $appliedDate;
        $status = strtoupper($app['status']);
        if (in_array($status, ['CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED', 'OFFICIALLY HIRED & SIGNED', 'HIRED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'PASSED', 'HIRED / PASSED'])) {
            $status = 'OFFICIALLY HIRED';
        }
        
        fputcsv($output, [
            $name,
            $app['job_title'],
            $appliedDate,
            $updatedDate,
            $status
        ]);
    }

    fclose($output);
    exit();

} catch (PDOException $e) {
    http_response_code(500);
    echo "Report generation failed.";
}
?>
