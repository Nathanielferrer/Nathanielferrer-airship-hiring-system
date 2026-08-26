<?php
require_once __DIR__ . '/../db.php';

$start_date      = isset($_GET['start_date']) ? trim($_GET['start_date']) : '';
$end_date        = isset($_GET['end_date']) ? trim($_GET['end_date']) : '';
$admin_filter    = isset($_GET['admin_name']) ? trim($_GET['admin_name']) : '';
$category_filter = isset($_GET['action_category']) ? trim($_GET['action_category']) : '';
$severity_filter = isset($_GET['severity']) ? trim($_GET['severity']) : '';
$search_query    = isset($_GET['search']) ? trim($_GET['search']) : '';
$format          = isset($_GET['format']) ? strtolower(trim($_GET['format'])) : 'csv';
$single_date     = isset($_GET['date']) ? trim($_GET['date']) : (isset($_GET['selected_date']) ? trim($_GET['selected_date']) : '');

// ── Parse and separate Event Description & Modification Details ───────────────
function parse_audit_action_details($details, $category) {
    if (empty($details)) return ['event' => $category ?: 'Action recorded.', 'details' => ''];
    $text = trim($details);

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

    // 4. Candidate Status Change (New format with job title)
    if (preg_match('/^Status changed for candidate "([^"]+)" \(applying for "([^"]+)"\):\s*(.*)$/i', $text, $m)) {
        return [
            'event' => "Status changed for candidate \"{$m[1]}\" ({$m[2]}).",
            'details' => "Status updated: " . trim($m[3])
        ];
    }

    // 5. Legacy Candidate Status Change
    if (preg_match('/^Updated candidate \'([^\']+)\' status from \'([^\']+)\' to \'([^\']+)\'/i', $text, $m)) {
        return [
            'event' => "Updated candidate \"{$m[1]}\" status.",
            'details' => "Status updated: \"{$m[2]}\" → \"{$m[3]}\"."
        ];
    }

    // 6. Knowledge Base Update
    if (preg_match('/^Updated Chatbot KB entry \(Q:\s*"([^"]+)"\):\s*(.*)$/i', $text, $m)) {
        return [
            'event' => "Updated Chatbot KB entry (Q: \"{$m[1]}\").",
            'details' => trim($m[2])
        ];
    }

    // 7. Knowledge Base Creation
    if (preg_match('/^Added new Chatbot KB entry:\s*Q="([^"]+)"\s*\|\s*(.*)$/i', $text, $m)) {
        return [
            'event' => "Added new Chatbot KB entry (Q: \"{$m[1]}\").",
            'details' => trim($m[2])
        ];
    }

    // 8. Knowledge Base Deletion
    if (preg_match('/^Deleted Chatbot KB entry(?:\s*#\d+)?:?\s*Q="([^"]+)"\s*\|\s*(.*)$/i', $text, $m)) {
        return [
            'event' => "Deleted Chatbot KB entry (Q: \"{$m[1]}\").",
            'details' => trim($m[2])
        ];
    }

    // 9. Auto-Schedule
    if (preg_match('/auto-schedule/i', $text)) {
        $count = preg_match('/(\d+)\s*(?:screened\s*)?candidate/i', $text, $c) ? $c[1] : '1';
        return [
            'event' => "Auto-scheduled {$count} candidate(s) for interview.",
            'details' => 'Assigned screened candidates in "PASSED INITIAL" to open time slots.'
        ];
    }

    // 10. Split on first sentence
    $firstDot = strpos($text, '.');
    if ($firstDot !== false && $firstDot < strlen($text) - 1) {
        return [
            'event' => trim(substr($text, 0, $firstDot + 1)),
            'details' => trim(substr($text, $firstDot + 1))
        ];
    }

    return ['event' => $text, 'details' => ''];
}

try {
    // ── ADMIN-ONLY AUDIT REPORT QUERY (Super Admin actions are strictly excluded) ──
    $where = [
        "sal.admin_name NOT LIKE '%Super Admin%'",
        "(u.is_admin IS NULL OR u.is_admin = 1)"
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
        $where[] = "(COALESCE(NULLIF(TRIM(CONCAT(u.User_Fname, ' ', u.User_Lname)), ''), sal.admin_name) = :admin_filter OR sal.admin_name = :admin_filter)";
        $params['admin_filter'] = $admin_filter;
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

    $sql = "SELECT sal.id, sal.admin_id, 
                   COALESCE(NULLIF(TRIM(CONCAT(u.User_Fname, ' ', u.User_Lname)), ''), sal.admin_name) AS admin_name,
                   sal.action_category, sal.module, sal.details, sal.ip_address, sal.created_at
            FROM system_audit_logs sal
            LEFT JOIN user u ON sal.admin_id = u.User_ID
            WHERE {$whereClause}
            ORDER BY sal.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // ── 1. PDF / Printable HTML View ──────────────────────────────────────────
    if ($format === 'pdf') {
        header('Content-Type: text/html; charset=utf-8');
        $generatedOn = date('F d, Y \a\t h:i A');

        // Build a concise filter summary to avoid date redundancy
        $filterParts = [];
        if (!empty($single_date)) {
            $filterParts[] = "Date: " . date('M d, Y', strtotime($single_date));
        } elseif (!empty($start_date) || !empty($end_date)) {
            $filterParts[] = "Range: " . ($start_date ?: 'Start') . " to " . ($end_date ?: 'Present');
        }
        if (!empty($admin_filter) && $admin_filter !== 'All') {
            $filterParts[] = "Admin: " . htmlspecialchars($admin_filter);
        }
        if (!empty($category_filter) && $category_filter !== 'All') {
            $filterParts[] = "Category: " . htmlspecialchars($category_filter);
        }
        $filterSummary = !empty($filterParts) ? implode(' | ', $filterParts) : 'All Activity (Unfiltered)';
        ?>
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Airship Express - Administrator Audit Trail Report</title>
          <link href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" rel="stylesheet" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 28px;
              background: #ffffff;
            }
            .report-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding-bottom: 18px;
              border-bottom: 2.5px solid #0f172a;
              margin-bottom: 20px;
            }
            .brand-title {
              font-family: 'Montserrat', sans-serif;
              font-size: 22px;
              font-weight: 800;
              color: #0f172a;
              margin: 0;
            }
            .brand-subtitle {
              font-size: 13px;
              color: #64748b;
              margin-top: 3px;
            }
            .report-meta {
              text-align: right;
              font-size: 12px;
              color: #475569;
              line-height: 1.5;
            }
            .summary-box {
              display: flex;
              gap: 16px;
              margin-bottom: 20px;
              background: #f8fafc;
              padding: 14px 18px;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
            }
            .summary-item {
              flex: 1;
            }
            .summary-label {
              font-size: 10.5px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .summary-val {
              font-family: 'Montserrat', sans-serif;
              font-size: 18px;
              font-weight: 800;
              color: #0f172a;
              margin-top: 3px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
              font-size: 12px;
            }
            th {
              background: #0f172a;
              color: #ffffff;
              text-align: left;
              padding: 10px 12px;
              font-weight: 700;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            td {
              padding: 11px 12px;
              border-bottom: 1px solid #e2e8f0;
              vertical-align: top;
            }
            tr:nth-child(even) td {
              background: #fafafa;
            }
            .log-id-badge {
              font-family: Consolas, Monaco, monospace;
              font-weight: 700;
              color: #475569;
              background: #f1f5f9;
              padding: 2px 7px;
              border-radius: 5px;
              border: 1px solid #e2e8f0;
              display: inline-block;
              font-size: 11px;
            }
            .ip-chip {
              font-family: Consolas, Monaco, monospace;
              font-size: 11px;
              font-weight: 600;
              color: #475569;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 2px 6px;
              border-radius: 4px;
              display: inline-block;
            }
            .cat-badge {
              font-size: 10.5px;
              font-weight: 700;
              background: #eff6ff;
              color: #1d4ed8;
              border: 1px solid #bfdbfe;
              padding: 2px 6px;
              border-radius: 4px;
              display: inline-block;
              margin-right: 6px;
            }
            .event-label {
              font-weight: 700;
              color: #0f172a;
            }
            .mod-box {
              font-size: 11px;
              color: #334155;
              background: #f1f5f9;
              border: 1px solid #e2e8f0;
              border-radius: 4px;
              padding: 4px 8px;
              margin-top: 4px;
              line-height: 1.4;
            }
            @media print {
              body { padding: 10px; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="report-header">
            <div>
              <h1 class="brand-title">AIRSHIP EXPRESS</h1>
              <div class="brand-subtitle">Administrator Audit Trail & Activity Log Report</div>
            </div>
            <div class="report-meta">
              <div><strong>Report Date:</strong> <?= $generatedOn ?></div>
              <div><strong>Scope:</strong> <?= $filterSummary ?></div>
              <div><strong>Total Records:</strong> <?= count($logs) ?></div>
            </div>
          </div>

          <div class="summary-box">
            <div class="summary-item">
              <div class="summary-label">Total Admin Events</div>
              <div class="summary-val"><?= count($logs) ?></div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Scope Filter</div>
              <div class="summary-val" style="color: #0369a1; font-size: 14px; margin-top: 5px;">Admin Actions Only</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Audit Policy</div>
              <div class="summary-val" style="color: #047857; font-size: 14px; margin-top: 5px;">Immutable Append-Only</div>
            </div>
          </div>

          <!-- 5-Column Table Matching Dashboard -->
          <table>
            <thead>
              <tr>
                <th style="width: 9%;">Log ID</th>
                <th style="width: 17%;">Date & Time</th>
                <th style="width: 16%;">Administrator</th>
                <th style="width: 13%;">IP Address</th>
                <th style="width: 45%;">Action & Modification Details</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($logs as $log): 
                $logId = '#' . $log['id'];
                $dateTime = date('M d, Y h:i A', strtotime($log['created_at']));
                $adminName = htmlspecialchars($log['admin_name']);
                $ipAddress = !empty($log['ip_address']) ? htmlspecialchars($log['ip_address']) : '—';
                $parsed = parse_audit_action_details($log['details'], $log['action_category']);
              ?>
                <tr>
                  <td><span class="log-id-badge"><?= $logId ?></span></td>
                  <td><?= $dateTime ?></td>
                  <td><strong><?= $adminName ?></strong></td>
                  <td><span class="ip-chip"><?= $ipAddress ?></span></td>
                  <td>
                    <span class="cat-badge"><?= htmlspecialchars($log['action_category']) ?></span>
                    <strong style="color: #0f172a; font-weight: 700;">Event Description:</strong> <span style="font-weight: 400; color: #334155;"><?= htmlspecialchars($parsed['event']) ?></span>
                    <?php if (!empty($parsed['details'])): ?>
                      <div class="mod-box">
                        <strong style="color: #0f172a; font-weight: 700;">Modification Details:</strong> <span style="font-weight: 400; color: #475569;"><?= htmlspecialchars($parsed['details']) ?></span>
                      </div>
                    <?php endif; ?>
                  </td>
                </tr>
              <?php endforeach; ?>
              <?php if (empty($logs)): ?>
                <tr>
                  <td colSpan="5" style="text-align: center; padding: 24px; color: #64748b;">No admin audit records found matching the specified parameters.</td>
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

    // ── 2. CSV Export — Visible Action Category & Separated Details for Excel ──
    $filename = "Admin_Audit_Trail_" . date('Y-m-d') . ".csv";
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');

    $output = fopen('php://output', 'w');

    // Output CSV headers with dedicated Action Category, Event Description, and Modification Details
    fputcsv($output, ['Log ID', 'Date & Time', 'Administrator', 'IP Address', 'Action Category', 'Event Description', 'Modification Details']);

    // Output data rows
    foreach ($logs as $log) {
        $logId = '#' . $log['id'];
        $dateTime = date('M d, Y h:i A', strtotime($log['created_at']));
        $adminName = $log['admin_name'];
        $ipAddress = !empty($log['ip_address']) ? $log['ip_address'] : '—';
        $category = $log['action_category'];
        $parsed = parse_audit_action_details($log['details'], $category);

        fputcsv($output, [
            $logId,
            $dateTime,
            $adminName,
            $ipAddress,
            $category,
            $parsed['event'],
            $parsed['details']
        ]);
    }

    fclose($output);
    exit();

} catch (PDOException $e) {
    http_response_code(500);
    echo "Report generation failed: " . $e->getMessage();
}
?>
