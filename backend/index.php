<?php
// backend/index.php - Health & Service Status Endpoint
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

echo json_encode([
    'status'    => 'online',
    'service'   => 'Airship Express Hiring Management Portal API',
    'version'   => '2.0.0',
    'timestamp' => date('Y-m-d H:i:s T')
]);
