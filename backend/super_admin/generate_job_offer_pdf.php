<?php
require_once __DIR__ . '/../db.php';

$applicationId = intval($_GET['application_id'] ?? ($_POST['application_id'] ?? 0));

$salary = trim($_GET['salary'] ?? ($_POST['salary'] ?? ''));
$employmentType = trim($_GET['employment_type'] ?? ($_POST['employment_type'] ?? ''));
$department = trim($_GET['department'] ?? ($_POST['department'] ?? ''));
$specialProvisions = trim($_GET['special_provisions'] ?? ($_POST['special_provisions'] ?? ''));

$candidateName = 'Candidate';
$candidateEmail = '';
$candidateMobile = '';
$jobTitle = 'Position';

if ($applicationId > 0) {
    $stmt = $pdo->prepare("
        SELECT 
            a.application_id, 
            a.candidate_name, 
            a.candidate_email, 
            a.candidate_mobile, 
            a.job_offer_details,
            j.title AS job_title,
            u.User_Fname,
            u.User_Lname,
            u.User_Email,
            u.User_Mobile
        FROM applications_tbl a
        LEFT JOIN jobs_tbl j ON j.job_id = a.job_id
        LEFT JOIN users_tbl u ON u.user_id = a.user_id
        WHERE a.application_id = ?
    ");
    $stmt->execute([$applicationId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        $candidateName = trim($row['candidate_name'] ?? '') ?: trim(($row['User_Fname'] ?? '') . ' ' . ($row['User_Lname'] ?? '')) ?: 'Candidate';
        $candidateEmail = trim($row['candidate_email'] ?? '') ?: trim($row['User_Email'] ?? '');
        $candidateMobile = trim($row['candidate_mobile'] ?? '') ?: trim($row['User_Mobile'] ?? '09978675756');
        $jobTitle = trim($row['job_title'] ?? '') ?: 'Position';

        if (!empty($row['job_offer_details'])) {
            $savedOffer = json_decode($row['job_offer_details'], true);
            if (is_array($savedOffer)) {
                if (empty($salary)) $salary = $savedOffer['salary'] ?? '';
                if (empty($employmentType)) $employmentType = $savedOffer['employment_type'] ?? '';
                if (empty($department)) $department = $savedOffer['department'] ?? '';
                if (empty($specialProvisions)) $specialProvisions = $savedOffer['special_provisions'] ?? '';
                if (empty($offerExpiresAt)) $offerExpiresAt = $savedOffer['offer_expires_at'] ?? '';
            }
        }
    }
}

// Fallback defaults
if (empty($salary)) $salary = '₱25,000.00 / month';
if (empty($employmentType)) $employmentType = 'Full-Time';
if (empty($department)) $department = 'Operations & Logistics Department';
if (empty($offerExpiresAt)) $offerExpiresAt = trim($_GET['offer_expires_at'] ?? date('Y-m-d 08:00:00', strtotime('+3 days')));

$formattedExpiry = date('F j, Y, g:i A', strtotime($offerExpiresAt));
$dateIssued = date('F j, Y');
$refNo = 'AE-OFFER-' . str_pad($applicationId > 0 ? (string)$applicationId : '101', 6, '0', STR_PAD_LEFT);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Airship Express - Official Job Offer Letter</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #f1f5f9;
      color: #0f172a;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 30px 16px;
      font-size: 13.5px;
      line-height: 1.6;
    }
    .pdf-actions-bar {
      max-width: 820px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .pdf-btn {
      padding: 8px 18px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 13px;
      font-family: 'Montserrat', sans-serif;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
      border: none;
    }
    .pdf-btn-primary {
      background: #e6007e;
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(230, 0, 126, 0.3);
    }
    .pdf-btn-primary:hover {
      background: #d00070;
    }
    .pdf-container {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      padding: 44px 50px;
      border: 1px solid #e2e8f0;
    }
    .pdf-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 1.5px solid #f1f5f9;
    }
    .company-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .company-icon-box {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: linear-gradient(135deg, #e6007e 0%, #b80062 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 22px;
      box-shadow: 0 4px 10px rgba(230, 0, 126, 0.25);
    }
    .company-name {
      font-family: 'Montserrat', sans-serif;
      font-weight: 800;
      font-size: 18px;
      color: #0f172a;
      letter-spacing: 0.5px;
      line-height: 1.2;
    }
    .company-tagline {
      font-size: 11.5px;
      color: #64748b;
      font-weight: 500;
      margin-top: 2px;
    }
    .offer-meta {
      text-align: right;
      font-size: 12px;
      color: #475569;
      line-height: 1.5;
    }
    .offer-meta strong {
      color: #0f172a;
    }
    .offer-banner {
      background: #f8fafc;
      border-left: 4.5px solid #e6007e;
      border-radius: 0 8px 8px 0;
      padding: 12px 18px;
      margin-bottom: 24px;
    }
    .offer-banner-title {
      font-family: 'Montserrat', sans-serif;
      font-weight: 800;
      font-size: 15px;
      color: #0f172a;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .recipient-block {
      margin-bottom: 22px;
      font-size: 13px;
      color: #334155;
      line-height: 1.6;
    }
    .recipient-name {
      font-weight: 700;
      color: #0f172a;
    }
    .letter-body {
      margin-bottom: 24px;
      color: #334155;
    }
    .letter-body p {
      margin-bottom: 12px;
    }
    .letter-body strong {
      color: #0f172a;
    }
    .terms-card-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 18px 20px;
      margin-bottom: 24px;
    }
    .term-item {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .term-label {
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #64748b;
    }
    .term-value {
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
    }
    .term-value-salary {
      color: #059669;
      font-weight: 800;
      font-size: 14.5px;
    }
    .provisions-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 24px;
    }
    .provisions-title {
      font-weight: 700;
      font-size: 12.5px;
      color: #92400e;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .provisions-content {
      font-size: 12.5px;
      color: #78350f;
      line-height: 1.5;
      white-space: pre-line;
    }
    .general-terms-section {
      margin-bottom: 30px;
    }
    .general-terms-title {
      font-weight: 700;
      font-size: 13px;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .general-terms-list {
      list-style-type: disc;
      padding-left: 20px;
      color: #475569;
      font-size: 12.5px;
    }
    .general-terms-list li {
      margin-bottom: 8px;
      line-height: 1.5;
    }
    .signatures-row {
      display: flex;
      justify-content: space-between;
      margin-top: 36px;
      padding-top: 24px;
      border-top: 1.5px solid #f1f5f9;
      gap: 40px;
    }
    .sig-col {
      flex: 1;
    }
    .sig-line {
      border-top: 1.5px solid #94a3b8;
      margin-top: 46px;
      margin-bottom: 6px;
    }
    .sig-name {
      font-weight: 700;
      color: #0f172a;
      font-size: 13px;
    }
    .sig-title {
      font-size: 11.5px;
      color: #64748b;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .pdf-actions-bar {
        display: none !important;
      }
      .pdf-container {
        box-shadow: none !important;
        border: none !important;
        padding: 20px 24px !important;
        max-width: 100% !important;
      }
    }
  </style>
</head>
<body>

  <div class="pdf-actions-bar">
    <button class="pdf-btn pdf-btn-primary" onclick="window.print()">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
      Print / Save as PDF
    </button>
  </div>

  <div class="pdf-container">
    <!-- Header -->
    <div class="pdf-header">
      <div class="company-brand">
        <div class="company-icon-box">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"></path><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </div>
        <div>
          <div class="company-name">AIRSHIP EXPRESS</div>
          <div class="company-tagline">Logistics &amp; Supply Chain Solutions Philippines</div>
        </div>
      </div>
      <div class="offer-meta">
        <div>Date: <strong><?= htmlspecialchars($dateIssued) ?></strong></div>
        <div>Ref No: <strong><?= htmlspecialchars($refNo) ?></strong></div>
        <div>Offer Expiry: <strong style="color: #dc2626;"><?= htmlspecialchars($formattedExpiry) ?></strong></div>
        <div>Status: <span style="color: #059669; font-weight: 700;">Official Offer Letter</span></div>
      </div>
    </div>

    <!-- Title Banner -->
    <div class="offer-banner">
      <div class="offer-banner-title">Employment Job Offer Letter</div>
    </div>

    <!-- Recipient Info -->
    <div class="recipient-block">
      <div>To: <span class="recipient-name"><?= htmlspecialchars($candidateName) ?></span></div>
      <div>Email: <?= htmlspecialchars($candidateEmail) ?></div>
      <div>Contact No: <?= htmlspecialchars($candidateMobile) ?></div>
    </div>

    <!-- Letter Body -->
    <div class="letter-body">
      <p>Dear <strong><?= htmlspecialchars($candidateName) ?></strong>,</p>
      <p>
        Following the successful evaluation of your application and complete review of your qualifications, <strong>Airship Express</strong> is delighted to offer you official employment for the position of <strong><?= htmlspecialchars($jobTitle) ?></strong>!
      </p>
      <p>
        We were impressed by your skills, qualifications, and dedication demonstrated throughout our recruitment process. We are confident that your expertise will make a vital contribution to our team's mission.
      </p>
    </div>

    <!-- Terms Grid (NO TARGET EFFECTIVE DATE) -->
    <div class="terms-card-grid">
      <div class="term-item">
        <span class="term-label">Position Title</span>
        <span class="term-value"><?= htmlspecialchars($jobTitle) ?></span>
      </div>
      <div class="term-item">
        <span class="term-label">Employment Status</span>
        <span class="term-value"><?= htmlspecialchars($employmentType) . (stripos($employmentType, 'probationary') === false ? ' (6-Month Probationary)' : '') ?></span>
      </div>
      <div class="term-item">
        <span class="term-label">Department / Division</span>
        <span class="term-value"><?= htmlspecialchars($department) ?></span>
      </div>
      <div class="term-item">
        <span class="term-label">Monthly Starting Compensation</span>
        <span class="term-value term-value-salary"><?= htmlspecialchars($salary) ?></span>
      </div>
    </div>

    <!-- Special Provisions (if present) -->
    <?php if (!empty($specialProvisions)): ?>
    <div class="provisions-box">
      <div class="provisions-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        Special Benefits, Additional Terms &amp; Custom Provisions:
      </div>
      <div class="provisions-content"><?= htmlspecialchars($specialProvisions) ?></div>
    </div>
    <?php endif; ?>

    <!-- General Terms of Employment -->
    <div class="general-terms-section">
      <div class="general-terms-title">General Terms of Employment:</div>
      <ul class="general-terms-list">
        <li><strong>Work Schedule &amp; Location:</strong> You will report to Airship Express HQ, 352 T. Pinpin Escolta St., Binondo, Manila, 1006, adhering to standard operational business hours.</li>
        <li><strong>Pre-Employment Clearance:</strong> This offer is contingent upon your successful completion and verification of mandatory pre-employment requirements (including medical clearance and government compliance documents) following contract signing.</li>
        <li><strong>First Day of Work &amp; Onboarding:</strong> Your official work start date, reporting time, and onboarding schedule will be formally assigned by HR upon the complete submission and verification of your pre-employment requirements.</li>
        <li><strong>Statutory Benefits &amp; Compliance:</strong> You are entitled to mandatory government contributions (SSS, PhilHealth, Pag-IBIG), 13th-month pay, and applicable statutory leaves in accordance with the Philippine Labor Code and Airship Express company policies.</li>
      </ul>
    </div>

    <!-- Signatures -->
    <div class="signatures-row">
      <div class="sig-col">
        <div class="sig-line"></div>
        <div class="sig-name">Human Resources Department</div>
        <div class="sig-title">Airship Express Logistics Inc.</div>
      </div>
      <div class="sig-col">
        <div class="sig-line"></div>
        <div class="sig-name"><?= htmlspecialchars($candidateName) ?></div>
        <div class="sig-title">Candidate Acceptance Signature &amp; Date</div>
      </div>
    </div>
  </div>

</body>
</html>
