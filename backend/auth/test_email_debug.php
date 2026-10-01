<?php
/**
 * Email Debug Endpoint - Tests SMTP connectivity on the current environment.
 * REMOVE this file after debugging is complete.
 */
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../email_helper.php';

header('Content-Type: application/json');

$results = [
    'timestamp' => date('Y-m-d H:i:s T'),
    'environment' => []
];

$smtpHost = getenv('SMTP_HOST');
$smtpPort = getenv('SMTP_PORT');
$smtpUser = getenv('SMTP_USER');
$smtpPass = getenv('SMTP_PASS');

$results['environment'] = [
    'SMTP_HOST' => $smtpHost ?: '(NOT SET)',
    'SMTP_PORT' => $smtpPort ?: '(NOT SET)',
    'SMTP_USER' => $smtpUser ? substr($smtpUser, 0, 5) . '***' : '(NOT SET)',
    'SMTP_PASS' => $smtpPass ? '***SET*** (' . strlen($smtpPass) . ' chars)' : '(NOT SET)',
    'FRONTEND_URL' => getenv('FRONTEND_URL') ?: '(NOT SET)',
    'env_file_exists' => file_exists(__DIR__ . '/../.env') ? 'YES' : 'NO',
];

// Test SMTP connection
try {
    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    configure_smtp($mail);
    $results['smtp_config'] = [
        'host' => $mail->Host,
        'port' => $mail->Port,
        'username' => substr($mail->Username, 0, 5) . '***',
        'password_length' => strlen($mail->Password),
    ];
    $connected = $mail->smtpConnect();
    if ($connected) {
        $results['connection_test'] = 'SUCCESS';
        $mail->smtpClose();
    } else {
        $results['connection_test'] = 'FAILED';
    }
} catch (\Throwable $e) {
    $results['connection_test'] = 'ERROR: ' . $e->getMessage();
}

// Send test email
try {
    $testMail = new PHPMailer\PHPMailer\PHPMailer(true);
    configure_smtp($testMail, 'Airship Express Debug');
    $testMail->addAddress($testMail->Username);
    $testMail->isHTML(true);
    $testMail->Subject = 'Railway Email Debug - ' . date('Y-m-d H:i:s');
    $testMail->Body = '<h2>Email system test</h2><p>Sent at: ' . date('Y-m-d H:i:s T') . '</p>';
    $testMail->send();
    $results['send_test'] = 'SUCCESS';
} catch (\Throwable $e) {
    $results['send_test'] = 'FAILED: ' . $e->getMessage();
}

// Test registration email function
try {
    $regResult = sendRegistrationVerificationEmail(
        $smtpUser ?: 'airship.express07@gmail.com',
        'Debug Test User',
        'test_code_' . bin2hex(random_bytes(8))
    );
    $results['registration_email_function'] = $regResult ? 'SUCCESS' : 'FAILED';
} catch (\Throwable $e) {
    $results['registration_email_function'] = 'ERROR: ' . $e->getMessage();
}

echo json_encode($results, JSON_PRETTY_PRINT);