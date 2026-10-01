<?php
/**
 * Email Debug Endpoint - Tests email connectivity on the current environment.
 * Tests both SMTP and Resend API transports.
 * REMOVE this file after debugging is complete.
 */
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../email_helper.php';

header('Content-Type: application/json');

$results = [
    'timestamp' => date('Y-m-d H:i:s T'),
    'environment' => [],
    'transport' => 'unknown'
];

$smtpUser = getenv('SMTP_USER');
$resendKey = getenv('RESEND_API_KEY');
$brevoKey  = getenv('BREVO_API_KEY');

$results['environment'] = [
    'SMTP_HOST' => getenv('SMTP_HOST') ?: '(NOT SET - fallback: smtp.gmail.com)',
    'SMTP_PORT' => getenv('SMTP_PORT') ?: '(NOT SET - fallback: 587)',
    'SMTP_USER' => $smtpUser ? substr($smtpUser, 0, 5) . '***' : '(NOT SET - fallback used)',
    'SMTP_PASS' => getenv('SMTP_PASS') ? '***SET***' : '(NOT SET - fallback used)',
    'RESEND_API_KEY' => $resendKey ? substr($resendKey, 0, 8) . '***' : '(NOT SET)',
    'RESEND_FROM_EMAIL' => getenv('RESEND_FROM_EMAIL') ?: '(NOT SET - will use onboarding@resend.dev)',
    'BREVO_API_KEY' => $brevoKey ? substr($brevoKey, 0, 8) . '***' : '(NOT SET)',
    'BREVO_FROM_EMAIL' => getenv('BREVO_FROM_EMAIL') ?: '(NOT SET - fallback used)',
    'FRONTEND_URL' => getenv('FRONTEND_URL') ?: '(NOT SET - fallback: localhost:5173)',
    'env_file_exists' => file_exists(__DIR__ . '/../.env') ? 'YES' : 'NO',
];

// Determine which transport will be used
if ($resendKey) {
    $results['transport'] = 'RESEND_API (HTTPS)';
    
    // Test Resend API directly
    try {
        $testResult = send_email_via_resend(
            $smtpUser ?: 'airship.express07@gmail.com',
            'Debug Test',
            'Resend API Test - ' . date('Y-m-d H:i:s'),
            '<h2>Resend API Email Test</h2><p>This email was sent via Resend HTTPS API from Railway at ' . date('Y-m-d H:i:s T') . '</p>'
        );
        $results['resend_test'] = $testResult ? 'SUCCESS' : 'FAILED';
    } catch (\Throwable $e) {
        $results['resend_test'] = 'ERROR: ' . $e->getMessage();
    }

    // Test registration email function (will auto-route to Resend)
    try {
        $regResult = sendRegistrationVerificationEmail(
            $smtpUser ?: 'airship.express07@gmail.com',
            'Debug Test User',
            'test_code_' . bin2hex(random_bytes(8))
        );
        $results['registration_email_test'] = $regResult ? 'SUCCESS' : 'FAILED';
    } catch (\Throwable $e) {
        $results['registration_email_test'] = 'ERROR: ' . $e->getMessage();
    }
} elseif ($brevoKey) {
    $results['transport'] = 'BREVO_API (HTTPS)';
    
    try {
        $testResult = send_email_via_brevo(
            $smtpUser ?: 'airship.express07@gmail.com',
            'Debug Test',
            'Brevo API Test - ' . date('Y-m-d H:i:s'),
            '<h2>Brevo API Email Test</h2><p>This email was sent via Brevo HTTPS API from Railway at ' . date('Y-m-d H:i:s T') . '</p>'
        );
        $results['brevo_test'] = $testResult ? 'SUCCESS' : 'FAILED';
    } catch (\Throwable $e) {
        $results['brevo_test'] = 'ERROR: ' . $e->getMessage();
    }

    try {
        $regResult = sendRegistrationVerificationEmail(
            $smtpUser ?: 'airship.express07@gmail.com',
            'Debug Test User',
            'test_code_' . bin2hex(random_bytes(8))
        );
        $results['registration_email_test'] = $regResult ? 'SUCCESS' : 'FAILED';
    } catch (\Throwable $e) {
        $results['registration_email_test'] = 'ERROR: ' . $e->getMessage();
    }
} else {
    $results['transport'] = 'SMTP (PHPMailer)';
    $results['smtp_warning'] = 'Railway blocks SMTP ports 25/465/587. Set RESEND_API_KEY env var to use Resend HTTPS API instead.';
    
    // Still try SMTP connection test (will likely timeout on Railway)
    try {
        $mail = new PHPMailer\PHPMailer\PHPMailer(true);
        configure_smtp($mail);
        $results['smtp_config'] = [
            'host' => $mail->Host,
            'port' => $mail->Port,
            'username' => substr($mail->Username, 0, 5) . '***',
        ];
        $connected = $mail->smtpConnect();
        $results['smtp_connection'] = $connected ? 'SUCCESS' : 'FAILED';
        if ($connected) $mail->smtpClose();
    } catch (\Throwable $e) {
        $results['smtp_connection'] = 'ERROR: ' . $e->getMessage();
    }
}

echo json_encode($results, JSON_PRETTY_PRINT);