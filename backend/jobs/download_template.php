<?php
require_once __DIR__ . '/../db.php';

$metaPath = __DIR__ . '/../uploads/templates/template_info.json';
$filePath = __DIR__ . '/../uploads/templates/resume_template.docx';
$fallbackPath = __DIR__ . '/../../frontend/public/RESUME TEMPLATE.docx';

$downloadFilename = 'RESUME TEMPLATE.docx';

if (file_exists($metaPath)) {
    $meta = json_decode(file_get_contents($metaPath), true);
    if (!empty($meta['original_filename'])) {
        $downloadFilename = basename($meta['original_filename']);
    }
}

if (!str_ends_with(strtolower($downloadFilename), '.docx')) {
    $downloadFilename .= '.docx';
}

$targetFile = null;
if (file_exists($filePath)) {
    $targetFile = $filePath;
} elseif (file_exists($fallbackPath)) {
    $targetFile = $fallbackPath;
}

if (!$targetFile || !file_exists($targetFile)) {
    http_response_code(404);
    echo "Application template file not found.";
    exit();
}

// Clean output buffer before sending file
if (ob_get_level()) {
    ob_end_clean();
}

header('Content-Description: File Transfer');
header('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
header('Content-Disposition: attachment; filename="' . $downloadFilename . '"');
header('Content-Transfer-Encoding: binary');
header('Expires: 0');
header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
header('Pragma: public');
header('Content-Length: ' . filesize($targetFile));

readfile($targetFile);
exit();
