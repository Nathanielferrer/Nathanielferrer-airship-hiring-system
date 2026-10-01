<?php
date_default_timezone_set('Asia/Manila');
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth/auth_guard.php';

// ── AUTHENTICATION: Admin / Super Admin required ─────────────────────────────
$authUser = get_authenticated_user();
if (!$authUser || empty($authUser['is_admin'])) {
    require_admin();
}

$start_date      = isset($_GET['start_date']) ? trim($_GET['start_date']) : '';
$end_date        = isset($_GET['end_date']) ? trim($_GET['end_date']) : '';
$admin_filter    = isset($_GET['admin_name']) ? trim($_GET['admin_name']) : '';
$category_filter = isset($_GET['action_category']) ? trim($_GET['action_category']) : '';
$severity_filter = isset($_GET['severity']) ? trim($_GET['severity']) : '';
$search_query    = isset($_GET['search']) ? trim($_GET['search']) : '';
$format          = isset($_GET['format']) ? strtolower(trim($_GET['format'])) : 'csv';
$single_date     = isset($_GET['date']) ? trim($_GET['date']) : (isset($_GET['selected_date']) ? trim($_GET['selected_date']) : '');

// ── Parse and separate Event Description & Modification Details (No IP) ──────
function parse_audit_action_details($details, $category) {
    if (empty($details)) return ['event' => $category ?: 'Action recorded.', 'details' => ''];
    $text = trim($details);

    // Sanitize any IP addresses from modification details
    $text = preg_replace('/Login from IP\s+[^\s,;]+/i', 'Session authenticated', $text);
    $text = preg_replace('/\b(?:from IP|IP)\s*[:=]?\s*(?:[0-9a-fA-F:]+|(?:\d{1,3}\.){3}\d{1,3})\b/i', '', $text);
    $text = trim(preg_replace('/\s+/', ' ', $text));

    // 0. Authentication Logins (Cleanly handle email addresses without splitting at .com)
    if (preg_match('/successfully logged in/i', $text)) {
        return ['event' => 'Admin logged in successfully.', 'details' => 'Session authenticated.'];
    }

    // 1. Job Updates
    if (preg_match('/^(Updated job vacancy\s*(?:"[^"]*"|\'[^\']*\'|\S+)\.)\s*(.*)$/i', $text, $m)) {
        return ['event' => $m[1], 'details' => trim($m[2])];
    }

    // 1b. Job Closed
    if (preg_match('/^(Closed job vacancy\s*(?:"[^"]*"|\'[^\']*\'|\S+)\.)\s*(.*)$/i', $text, $m)) {
        return ['event' => $m[1], 'details' => trim($m[2])];
    }

    // 2. Job Creation
    if (preg_match('/^(Posted new job vacancy(?::\s*Title="([^"]+)")?)\s*,?\s*(.*)$/i', $text, $m)) {
        $title = !empty($m[2]) ? " \"{$m[2]}\"" : "";
        $det = !empty($m[3]) ? str_replace(', ', ' | ', $m[3]) : '';
        return ['event' => "Posted new job vacancy{$title}.", 'details' => $det];
    }

    // 3. Job Deletion
    if (preg_match('/^(Deleted job vacancy\s*(?:"[^"]*"|\'[^\']*\'|\S+)\.)\s*(?:Details:\s*)?(.*)$/i', $text, $m)) {
        return ['event' => $m[1], 'details' => trim($m[2])];
    }

    // 4. Job Visibility (Resumed / Paused)
    if (preg_match('/^(Resumed public intake[^\.]*\.|Paused public intake[^\.]*\.)\s*(.*)$/i', $text, $m)) {
        return ['event' => $m[1], 'details' => trim($m[2])];
    }

    // 5. Password Setup Completed
    if (preg_match('/^(Completed forced password setup\.)\s*(.*)$/i', $text, $m)) {
        return ['event' => $m[1], 'details' => trim($m[2])];
    }

    // 6. Candidate Status Change (New format with job title)
    if (preg_match('/^Status changed for candidate "([^"]+)" \(applying for "([^"]+)"\):\s*(.*)$/i', $text, $m)) {
        return [
            'event' => "Status changed for candidate \"{$m[1]}\" ({$m[2]}).",
            'details' => "Status: " . trim($m[3])
        ];
    }

    // 7. Legacy Candidate Status Change
    if (preg_match('/^Updated candidate \'([^\']+)\' status from \'([^\']+)\' to \'([^\']+)\'/i', $text, $m)) {
        return [
            'event' => "Updated candidate \"{$m[1]}\" status.",
            'details' => "Status: \"{$m[2]}\" to \"{$m[3]}\"."
        ];
    }

    // 8. Knowledge Base Update
    if (preg_match('/^Updated Chatbot KB entry \(Q:\s*"([^"]+)"\):\s*(.*)$/i', $text, $m)) {
        return [
            'event' => "Updated Chatbot KB entry (Q: \"{$m[1]}\").",
            'details' => trim($m[2])
        ];
    }

    // 9. Knowledge Base Creation
    if (preg_match('/^Added new Chatbot KB entry:\s*Q="([^"]+)"\s*\|\s*(.*)$/i', $text, $m)) {
        return [
            'event' => "Added new Chatbot KB entry (Q: \"{$m[1]}\").",
            'details' => trim($m[2])
        ];
    }

    // 10. Knowledge Base Deletion
    if (preg_match('/^Deleted Chatbot KB entry(?:\s*#\d+)?:?\s*Q="([^"]+)"\s*\|\s*(.*)$/i', $text, $m)) {
        return [
            'event' => "Deleted Chatbot KB entry (Q: \"{$m[1]}\").",
            'details' => trim($m[2])
        ];
    }

    // 11. Auto-Schedule
    if (preg_match('/auto-schedule/i', $text)) {
        $count = preg_match('/(\d+)\s*(?:screened\s*)?candidate/i', $text, $c) ? $c[1] : '1';
        return [
            'event' => "Auto-scheduled {$count} candidate(s) for interview.",
            'details' => 'Screened candidates in "Passed Initial Screening" assigned to open time slots.'
        ];
    }

    // 12. Split on first sentence
    $firstDot = strpos($text, '.');
    if ($firstDot !== false && $firstDot < strlen($text) - 1) {
        return [
            'event' => trim(substr($text, 0, $firstDot + 1)),
            'details' => trim(substr($text, $firstDot + 1))
        ];
    }

    return ['event' => $text, 'details' => ''];
}

// ── Multi-Page Chunking Function for Portrait A4 ─────────────────────────────
// In Portrait A4:
// - Up to 10 rows fit alongside Title, Metadata, Summary, Notices & Sign-off on Page 1 (Page 1 of 1).
// - For larger sets: Page 1 holds 12-14 rows. Intermediate pages hold 16-18 rows.
// - Final page holds 8-10 rows alongside Notices & Sign-off.
function paginate_audit_logs($logs) {
    $total = count($logs);
    if ($total <= 10) {
        return [[
            'logs'     => $logs,
            'is_first' => true,
            'is_last'  => true
        ]];
    }

    $pages = [];

    // Up to 22 records: split cleanly into Page 1 and Page 2
    if ($total <= 22) {
        $p1Count = min(14, ceil($total / 2) + 2);
        $pages[] = [
            'logs'     => array_slice($logs, 0, $p1Count),
            'is_first' => true,
            'is_last'  => false
        ];
        $pages[] = [
            'logs'     => array_slice($logs, $p1Count),
            'is_first' => false,
            'is_last'  => true
        ];
        return $pages;
    }

    // More than 22 records: multi-page pagination
    $pages[] = [
        'logs'     => array_slice($logs, 0, 14),
        'is_first' => true,
        'is_last'  => false
    ];
    $offset = 14;

    while (($total - $offset) > 10) {
        $remaining = $total - $offset;
        if ($remaining <= 20) {
            $midCount = ceil($remaining / 2);
            $pages[] = [
                'logs'     => array_slice($logs, $offset, $midCount),
                'is_first' => false,
                'is_last'  => false
            ];
            $offset += $midCount;
            break;
        } else {
            $pages[] = [
                'logs'     => array_slice($logs, $offset, 18),
                'is_first' => false,
                'is_last'  => false
            ];
            $offset += 18;
        }
    }

    if ($offset < $total) {
        $pages[] = [
            'logs'     => array_slice($logs, $offset),
            'is_first' => false,
            'is_last'  => true
        ];
    }

    return $pages;
}

try {
    // ── ADMIN-ONLY AUDIT REPORT QUERY ─────────────────────────────────────────
    $where = [
        "u.is_admin = 1",
        "sal.admin_name NOT LIKE '%Super Admin%'",
        "sal.admin_name != 'System'"
    ];
    $params = [];

    if (!empty($single_date)) {
        $where[] = "DATE(sal.created_at) = :single_date";
        $params['single_date'] = $single_date;
    } else {
        if (!empty($start_date)) {
            $where[] = "DATE(sal.created_at) >= :start_date";
            $params['start_date'] = $start_date;
        }
        if (!empty($end_date)) {
            $where[] = "DATE(sal.created_at) <= :end_date";
            $params['end_date'] = $end_date;
        }
    }
    if (!empty($admin_filter) && $admin_filter !== 'All' && $admin_filter !== '') {
        $where[] = "(COALESCE(NULLIF(TRIM(CONCAT(u.User_Fname, ' ', u.User_Lname)), ''), sal.admin_name) = :admin_filter1 OR sal.admin_name = :admin_filter2)";
        $params['admin_filter1'] = $admin_filter;
        $params['admin_filter2'] = $admin_filter;
    }
    if (!empty($category_filter) && $category_filter !== 'All' && $category_filter !== '') {
        $where[] = "sal.action_category = :category_filter";
        $params['category_filter'] = $category_filter;
    }
    if (!empty($search_query)) {
        $where[] = "(COALESCE(NULLIF(TRIM(CONCAT(u.User_Fname, ' ', u.User_Lname)), ''), sal.admin_name) LIKE :search1 OR sal.action_category LIKE :search2 OR sal.details LIKE :search3)";
        $params['search1'] = "%{$search_query}%";
        $params['search2'] = "%{$search_query}%";
        $params['search3'] = "%{$search_query}%";
    }

    $whereClause = implode(" AND ", $where);

    $sql = "SELECT sal.log_id AS id, sal.log_id, sal.admin_id, 
                   COALESCE(NULLIF(TRIM(CONCAT(u.User_Fname, ' ', u.User_Lname)), ''), sal.admin_name) AS admin_name,
                   sal.action_category, sal.module, sal.details, sal.created_at
            FROM system_audit_logs_tbl sal
            INNER JOIN users_tbl u ON sal.admin_id = u.user_id
            WHERE {$whereClause}
            ORDER BY sal.log_id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $totalLogs = count($logs);

    // ── Category Distribution (Counts for active categories) ─────────────────
    $categoryCounts = [];
    foreach ($logs as $log) {
        $cat = !empty($log['action_category']) ? trim($log['action_category']) : 'General Action';
        $categoryCounts[$cat] = ($categoryCounts[$cat] ?? 0) + 1;
    }
    arsort($categoryCounts);

    // ── Metadata variables ───────────────────────────────────────────────────
    $reportRefNo = 'ADM-' . date('Ymd') . '-001';
    $generatedFormatted = date('j F Y, g:i A') . ' (PHT)';

    if (!empty($single_date)) {
        $dateFilterLabel = date('j F Y', strtotime($single_date));
    } elseif (!empty($start_date) && !empty($end_date)) {
        $dateFilterLabel = date('j M Y', strtotime($start_date)) . ' - ' . date('j M Y', strtotime($end_date));
    } elseif (!empty($start_date)) {
        $dateFilterLabel = 'From ' . date('j M Y', strtotime($start_date));
    } elseif (!empty($end_date)) {
        $dateFilterLabel = 'Until ' . date('j M Y', strtotime($end_date));
    } else {
        $dateFilterLabel = 'All historical dates';
    }

    $adminName = '';
    if ($authUser) {
        $adminName = trim(($authUser['first_name'] ?? '') . ' ' . ($authUser['last_name'] ?? ''));
    }
    $generatedBy = !empty($adminName) ? $adminName . ', HR Administrator' : (!empty($_GET['generated_by']) ? htmlspecialchars(trim($_GET['generated_by'])) : 'Kurtney Cruz, HR Administrator');

    $actionFilterLabel = (!empty($category_filter) && $category_filter !== 'All') 
        ? htmlspecialchars($category_filter) 
        : 'All actions (administrator actions only)';

    $adminFilterLabel = (!empty($admin_filter) && $admin_filter !== 'All') 
        ? htmlspecialchars($admin_filter) 
        : 'All administrators';

    // ── 1. PDF / Multi-Page Printable View in Portrait A4 ────────────────────
    if ($format === 'pdf') {
        header('Content-Type: text/html; charset=utf-8');
        $pages = paginate_audit_logs($logs);
        $totalPages = count($pages);
        ?>
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Administrator Audit Trail & Activity Log Report - Airship Express</title>
          <link href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" rel="stylesheet" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

            * {
              box-sizing: border-box;
            }

            @page {
              size: A4 portrait;
              margin: 0;
            }

            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 0;
              background: #64748b;
              -webkit-font-smoothing: antialiased;
            }

            /* Screen Print Bar */
            .action-bar {
              background: #0f172a;
              padding: 12px 30px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              color: #ffffff;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
              position: sticky;
              top: 0;
              z-index: 1000;
            }
            .action-bar-title {
              font-family: 'Montserrat', sans-serif;
              font-size: 13px;
              font-weight: 700;
              letter-spacing: 0.5px;
            }
            .action-btn {
              background: #2563eb;
              color: #ffffff;
              border: none;
              padding: 8px 18px;
              font-size: 12.5px;
              font-weight: 600;
              border-radius: 6px;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 6px;
              transition: background 0.2s;
            }
            .action-btn:hover {
              background: #1d4ed8;
            }
            .action-btn-secondary {
              background: #334155;
              color: #ffffff;
              border: none;
              padding: 8px 14px;
              font-size: 12.5px;
              font-weight: 600;
              border-radius: 6px;
              cursor: pointer;
              margin-left: 8px;
            }
            .action-btn-secondary:hover {
              background: #475569;
            }

            /* Discrete Standard A4 Portrait Page Sheets (210mm x 297mm) */
            .page-sheet {
              width: 210mm;
              max-width: 100%;
              min-height: 297mm;
              margin: 24px auto;
              background: #ffffff;
              box-shadow: 0 6px 24px rgba(0, 0, 0, 0.22);
              border-radius: 2px;
              position: relative;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              box-sizing: border-box;
            }

            /* Top Banner */
            .top-banner {
              background: #0b132b;
              color: #ffffff;
              padding: 9px 24px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .banner-left {
              font-family: 'Montserrat', sans-serif;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.8px;
              text-transform: uppercase;
            }
            .banner-right {
              font-family: 'Montserrat', sans-serif;
              font-size: 10.5px;
              font-weight: 700;
              letter-spacing: 0.8px;
              text-transform: uppercase;
            }

            /* Main Page Content */
            .page-content {
              padding: 20px 26px 14px 26px;
              flex: 1;
              display: flex;
              flex-direction: column;
            }

            /* Push notices & sign-off to bottom of page when content is short */
            .bottom-sections {
              margin-top: auto;
            }

            .report-title {
              font-family: 'Montserrat', sans-serif;
              font-size: 20px;
              font-weight: 800;
              color: #0f172a;
              margin: 0 0 12px 0;
              letter-spacing: -0.3px;
            }

            .continuation-title {
              font-family: 'Montserrat', sans-serif;
              font-size: 12.5px;
              font-weight: 800;
              color: #0f172a;
              margin: 0 0 10px 0;
              text-transform: uppercase;
              letter-spacing: 0.4px;
            }

            /* Metadata Grid Table */
            .meta-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 14px;
            }
            .meta-table td {
              border: 1px solid #e2e8f0;
              padding: 5px 10px;
              font-size: 10.5px;
            }
            .meta-table .meta-label {
              width: 17%;
              font-weight: 700;
              color: #0f172a;
              background: #f8fafc;
            }
            .meta-table .meta-val {
              width: 33%;
              color: #1e293b;
            }

            /* Section Header */
            .section-title {
              font-family: 'Montserrat', sans-serif;
              font-size: 12px;
              font-weight: 800;
              color: #0f172a;
              margin: 12px 0 6px 0;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }

            /* Summary Table */
            .summary-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
            }
            .summary-table th {
              background: #0f172a;
              color: #ffffff;
              padding: 6px 8px;
              text-align: center;
              font-size: 9.5px;
              font-weight: 700;
              border: 1px solid #1e293b;
              font-family: 'Inter', sans-serif;
              text-transform: uppercase;
            }
            .summary-table td {
              padding: 7px 10px;
              text-align: center;
              font-size: 14px;
              font-weight: 800;
              color: #0f172a;
              border: 1px solid #e2e8f0;
              background: #ffffff;
            }

            /* Data Tables */
            .data-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 8px;
            }
            .data-table th {
              background: #0f172a;
              color: #ffffff;
              padding: 6px 8px;
              text-align: left;
              font-size: 9.5px;
              font-weight: 700;
              letter-spacing: 0.4px;
              text-transform: uppercase;
              border: 1px solid #1e293b;
              font-family: 'Inter', sans-serif;
            }
            .data-table td {
              padding: 6px 8px;
              font-size: 10.5px;
              color: #0f172a;
              border: 1px solid #e2e8f0;
              vertical-align: top;
            }
            .data-table tr:nth-child(even) td {
              background: #fafafa;
            }

            .log-id {
              font-weight: 700;
              color: #0f172a;
              text-align: center;
            }
            .admin-name {
              font-weight: 700;
              color: #0f172a;
            }
            .admin-id {
              font-size: 9.5px;
              color: #64748b;
              margin-top: 1px;
            }

            .action-header {
              font-weight: 700;
              color: #0f172a;
            }
            .action-event {
              color: #1e293b;
            }
            .mod-box {
              margin-top: 3px;
              font-size: 10px;
              color: #475569;
            }

            .table-subnote {
              font-size: 9.5px;
              color: #64748b;
              margin: 4px 0 10px 0;
            }

            /* Notices */
            .notices-list {
              list-style-type: none;
              padding: 0;
              margin: 5px 0 12px 0;
              font-size: 10px;
              line-height: 1.5;
              color: #334155;
            }
            .notices-list li {
              margin-bottom: 3px;
              position: relative;
              padding-left: 12px;
            }
            .notices-list li::before {
              content: "-";
              position: absolute;
              left: 0;
              font-weight: 700;
              color: #0f172a;
            }

            /* Sign-off Section */
            .signoff-grid {
              display: flex;
              justify-content: space-between;
              margin-top: 12px;
              margin-bottom: 10px;
            }
            .signoff-col {
              width: 44%;
            }
            .signoff-line {
              border-top: 1.5px solid #0f172a;
              width: 100%;
              margin-bottom: 5px;
            }
            .signoff-title {
              font-weight: 700;
              font-size: 11px;
              color: #0f172a;
            }
            .signoff-sub {
              font-size: 10px;
              color: #475569;
              margin-top: 1px;
            }
            .signoff-date {
              font-size: 10px;
              color: #0f172a;
              margin-top: 4px;
            }

            /* Footer */
            .report-footer {
              padding: 7px 24px 8px 24px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 9.5px;
              color: #64748b;
              background: #ffffff;
            }

            /* Print Styles (Strict A4 Portrait, 210mm x 297mm) */
            @media print {
              @page {
                size: A4 portrait;
                margin: 0;
              }
              html, body {
                width: 210mm !important;
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
                width: 210mm !important;
                height: 297mm !important;
                max-height: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                border: none !important;
                page-break-after: always !important;
                break-after: page !important;
                overflow: hidden !important;
              }
              .page-sheet:last-of-type {
                page-break-after: avoid !important;
                break-after: avoid !important;
              }
              .page-content {
                padding: 16px 20px !important;
              }
              .report-footer {
                padding: 6px 20px 8px 20px !important;
              }
              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>

          <!-- Action Bar (Screen Only) -->
          <div class="action-bar no-print" style="justify-content: flex-end;">
            <div>
              <button class="action-btn" onclick="window.print()">
                <i class="bx bx-printer"></i> Print / Save as PDF
              </button>
            </div>
          </div>

          <?php 
          // ── Render each standard page sheet ───────────────────────────────
          $displayCategories = array_slice($categoryCounts, 0, 5, true);

          foreach ($pages as $pIdx => $pageData): 
            $pageNumber = $pIdx + 1;
            $isFirstPage = $pageData['is_first'];
            $isLastPage = $pageData['is_last'];
            $pageLogs = $pageData['logs'];
          ?>
            <div class="page-sheet">
              <div>
                <!-- Top Dark Banner on Every Page -->
                <div class="top-banner">
                  <span class="banner-left">AIRSHIP EXPRESS | Human Resources Department</span>
                  <span class="banner-right">CONFIDENTIAL - HR AUDIT USE ONLY</span>
                </div>

                <div class="page-content">
                  <?php if ($isFirstPage): ?>
                    <!-- Page 1 Header & Metadata -->
                    <h1 class="report-title">Administrator Audit Trail & Activity Log Report</h1>

                    <!-- Metadata Table -->
                    <table class="meta-table">
                      <tr>
                        <td class="meta-label">Report Ref No.</td>
                        <td class="meta-val"><?= htmlspecialchars($reportRefNo) ?></td>
                        <td class="meta-label">Generated</td>
                        <td class="meta-val"><?= htmlspecialchars($generatedFormatted) ?></td>
                      </tr>
                      <tr>
                        <td class="meta-label">Date Range Filter</td>
                        <td class="meta-val"><?= htmlspecialchars($dateFilterLabel) ?></td>
                        <td class="meta-label">Generated By</td>
                        <td class="meta-val"><?= htmlspecialchars($generatedBy) ?></td>
                      </tr>
                      <tr>
                        <td class="meta-label">Action Filter</td>
                        <td class="meta-val"><?= htmlspecialchars($actionFilterLabel) ?></td>
                        <td class="meta-label">Administrator Filter</td>
                        <td class="meta-val"><?= htmlspecialchars($adminFilterLabel) ?></td>
                      </tr>
                    </table>

                    <!-- 1. Summary -->
                    <div class="section-title">1. Summary</div>
                    <table class="summary-table">
                      <thead>
                        <tr>
                          <th>Total Admin Events</th>
                          <?php if (!empty($displayCategories)): ?>
                            <?php foreach ($displayCategories as $catName => $count): ?>
                              <th><?= htmlspecialchars(str_replace('_', ' ', $catName)) ?></th>
                            <?php endforeach; ?>
                          <?php else: ?>
                            <th>No Recorded Events</th>
                          <?php endif; ?>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><?= $totalLogs ?></td>
                          <?php if (!empty($displayCategories)): ?>
                            <?php foreach ($displayCategories as $catName => $count): ?>
                              <td><?= $count ?></td>
                            <?php endforeach; ?>
                          <?php else: ?>
                            <td>0</td>
                          <?php endif; ?>
                        </tr>
                      </tbody>
                    </table>

                    <!-- 2. Administrator Activity Records -->
                    <div class="section-title">2. Administrator Activity Records</div>
                  <?php else: ?>
                    <!-- Continuation Pages Header -->
                    <div class="continuation-title">2. Administrator Activity Records (Continued)</div>
                  <?php endif; ?>

                  <!-- Activity Records Table for This Page -->
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th style="width: 11%; text-align: center;">LOG ID</th>
                        <th style="width: 19%;">DATE & TIME (PHT)</th>
                        <th style="width: 22%;">ADMINISTRATOR</th>
                        <th style="width: 48%;">ACTION & MODIFICATION DETAILS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <?php if (!empty($pageLogs)): ?>
                        <?php foreach ($pageLogs as $log): 
                          $logId = '#' . $log['id'];
                          $dateTime = date('Y-m-d h:i A', strtotime($log['created_at']));
                          $adminName = htmlspecialchars($log['admin_name']);
                          $adminId = htmlspecialchars($log['admin_id']);
                          $parsed = parse_audit_action_details($log['details'], $log['action_category']);
                        ?>
                          <tr>
                            <td class="log-id"><?= $logId ?></td>
                            <td><?= $dateTime ?></td>
                            <td>
                              <div class="admin-name"><?= $adminName ?></div>
                              <div class="admin-id">(Admin ID: #<?= $adminId ?>)</div>
                            </td>
                            <td>
                              <div>
                                <strong class="action-header"><?= htmlspecialchars(str_replace('_', ' ', $log['action_category'])) ?>:</strong> 
                                <span class="action-event"><?= htmlspecialchars($parsed['event']) ?></span>
                              </div>
                              <?php if (!empty($parsed['details'])): ?>
                                <div class="mod-box">
                                  <span style="font-weight: 600;">Modification Details:</span> <?= htmlspecialchars($parsed['details']) ?>
                                </div>
                              <?php endif; ?>
                            </td>
                          </tr>
                        <?php endforeach; ?>
                      <?php else: ?>
                        <tr>
                          <td colspan="4" style="text-align: center; padding: 20px; color: #64748b;">
                            No administrator activity records found matching the specified filter criteria.
                          </td>
                        </tr>
                      <?php endif; ?>
                    </tbody>
                  </table>

                  <?php if ($isLastPage): ?>
                    <div class="table-subnote">
                      Records are listed newest first. Passwords and other confidential credentials are never written to the log.
                    </div>

                    <!-- Notices & Sign-off pushed to bottom of page -->
                    <div class="bottom-sections">
                      <!-- 3. Notices & Data Governance -->
                      <div class="section-title">3. Notices & Data Governance</div>
                      <ul class="notices-list">
                        <li>Audit policy: log entries are append-only. They cannot be edited or deleted through the application, which supports accountability and non-repudiation of administrator actions.</li>
                        <li>Each entry records who acted (name and Admin ID), when (PHT), and what changed (before and after values).</li>
                        <li>This report contains administrator activity data for authorized HR audit and compliance purposes only.</li>
                        <li>The generation of this report has been recorded in the system activity log (user, timestamp, filters).</li>
                      </ul>

                      <!-- 4. Sign-off & Approvals -->
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
                  <?php endif; ?>

                </div>
              </div>

              <!-- Footer with Page X of Y -->
              <div class="report-footer">
                <div>Ref: <?= htmlspecialchars($reportRefNo) ?></div>
                <div>Contains administrator activity data. For authorized audit and compliance use only.</div>
                <div><strong>Page <?= $pageNumber ?> of <?= $totalPages ?></strong></div>
              </div>
            </div>
          <?php endforeach; ?>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 600);
            };
          </script>
        </body>
        </html>
        <?php
        exit();
    }

    // ── 2. CSV Export (No IP Address, Formatted for Excel) ───────────────────
    $filename = "Admin_Audit_Trail_" . date('Y-m-d') . ".csv";
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');

    $output = fopen('php://output', 'w');

    // UTF-8 BOM for Excel compatibility
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

    // CSV headers without IP Address
    fputcsv($output, [
        'Log ID', 
        'Date & Time (PHT)', 
        'Administrator', 
        'Admin ID', 
        'Action Category', 
        'Event Description', 
        'Modification Details'
    ], ',', '"', "\\");

    // Data rows
    foreach ($logs as $log) {
        $logId = '#' . $log['id'];
        $dateTime = date('Y-m-d H:i', strtotime($log['created_at']));
        $adminName = $log['admin_name'];
        $adminId = $log['admin_id'];
        $category = $log['action_category'];
        $parsed = parse_audit_action_details($log['details'], $category);

        fputcsv($output, [
            $logId,
            $dateTime,
            $adminName,
            $adminId,
            $category,
            $parsed['event'],
            $parsed['details']
        ], ',', '"', "\\");
    }

    fclose($output);
    exit();

} catch (PDOException $e) {
    error_log("[Generate Audit Report Error] " . $e->getMessage());
    http_response_code(500);
    echo "An internal system error occurred while generating the audit report: " . htmlspecialchars($e->getMessage());
}
?>
