<?php
require_once __DIR__ . '/../db.php';
header('Content-Type: application/json');

$metaPath = __DIR__ . '/../uploads/templates/template_info.json';
$filePath = __DIR__ . '/../uploads/templates/resume_template.docx';
$fallbackPath = __DIR__ . '/../../frontend/public/RESUME TEMPLATE.docx';

$templateInfo = [
    'original_filename' => 'RESUME TEMPLATE.docx',
    'display_name'      => 'Standard Resume & Application Form',
    'file_size'         => 0,
    'file_type'         => 'docx',
    'updated_at'        => date('Y-m-d H:i:s'),
    'updated_by'        => 'System Default',
    'exists'            => false,
    'download_url'      => get_backend_url() . '/jobs/download_template.php'
];

if (file_exists($metaPath)) {
    $meta = json_decode(file_get_contents($metaPath), true);
    if (is_array($meta)) {
        $templateInfo = array_merge($templateInfo, $meta);
    }
}

if (file_exists($filePath)) {
    $templateInfo['exists'] = true;
    if (empty($templateInfo['file_size'])) {
        $templateInfo['file_size'] = filesize($filePath);
    }
} elseif (file_exists($fallbackPath)) {
    $templateInfo['exists'] = true;
    $templateInfo['file_size'] = filesize($fallbackPath);
}

echo json_encode([
    'status'   => 'success',
    'template' => $templateInfo
]);
