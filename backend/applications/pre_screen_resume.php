<?php
// backend/applications/pre_screen_resume.php
// Robust pre-screening gate: verifies if uploaded resume name matches registered applicant name
// Uses a two-layer approach: Gemini Flash AI micro-extraction with local heuristic fallback

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../vendor/autoload.php';

header('Content-Type: application/json');
ini_set('display_errors', 0);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit();
}

// 1. Validate uploaded file
if (!isset($_FILES['resume']) || $_FILES['resume']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'is_parse_error' => true,
        'message' => 'No resume file uploaded or an upload error occurred.'
    ]);
    exit();
}

$fileTmpPath = $_FILES['resume']['tmp_name'];
$fileName    = $_FILES['resume']['name'];
$fileSize    = $_FILES['resume']['size'];

// Check PDF extension
if (strtolower(pathinfo($fileName, PATHINFO_EXTENSION)) !== 'pdf') {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'is_parse_error' => true,
        'message' => 'Only genuine PDF documents are supported.'
    ]);
    exit();
}

if ($fileSize > 5 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'File size exceeds 5MB limit.'
    ]);
    exit();
}

// Verify PDF binary header (%PDF-)
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $fileTmpPath);
if (PHP_VERSION_ID < 80500) { @finfo_close($finfo); }

if ($mimeType !== 'application/pdf') {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'is_parse_error' => true,
        'message' => 'Invalid file format. Please upload a genuine PDF file.'
    ]);
    exit();
}

// 2. Resolve registered candidate account name and middle initial
$candidateName     = isset($_POST['candidate_name']) ? trim($_POST['candidate_name']) : '';
$userId            = isset($_POST['user_id']) ? intval($_POST['user_id']) : 0;
$candidateMInitial = isset($_POST['middle_initial']) ? strtoupper(trim(str_replace('.', '', $_POST['middle_initial']))) : '';
$dbFirst           = '';
$dbLast            = '';

if ($userId > 0) {
    try {
        $uStmt = $pdo->prepare("SELECT User_Fname, User_MInitial, User_Lname FROM users_tbl WHERE user_id = :uid LIMIT 1");
        $uStmt->execute(['uid' => $userId]);
        $userRow = $uStmt->fetch();
        if ($userRow) {
            $dbFirst = trim($userRow['User_Fname'] ?? '');
            $dbLast  = trim($userRow['User_Lname'] ?? '');
            if (empty($candidateMInitial) && !empty($userRow['User_MInitial'])) {
                $candidateMInitial = strtoupper(trim(str_replace('.', '', $userRow['User_MInitial'])));
            }
            if (empty($candidateName)) {
                $mPart = !empty($candidateMInitial) ? $candidateMInitial . '. ' : '';
                $candidateName = trim("{$dbFirst} {$mPart}{$dbLast}");
            }
        }
    } catch (Exception $e) {}
}

// 3. Parse PDF text using smalot/pdfparser
$resumeText = '';
try {
    $parser = new \Smalot\PdfParser\Parser();
    $pdf = $parser->parseFile($fileTmpPath);
    $rawText = $pdf->getText();

    // Text Normalization
    $normalizedText = str_replace(["\r\n", "\r"], "\n", (string)$rawText);
    $normalizedText = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $normalizedText);
    $normalizedText = preg_replace("/\n{3,}/", "\n\n", $normalizedText);
    $resumeText = trim($normalizedText);

    if (empty($resumeText)) {
        throw new Exception("Parsed text is empty.");
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'is_parse_error' => true,
        'message' => 'Invalid resume format detected. Please upload a standard resume or download our template to guarantee compatibility.'
    ]);
    exit();
}

// 4. Candidate Name Extraction
$extractedName = '';

// LAYER 1: Fast Gemini AI Micro-Extraction (Handles messy layouts, tables, and Canva columns)
$keysToTry = defined('GEMINI_API_KEYS') && is_array(GEMINI_API_KEYS) ? array_values(array_filter(GEMINI_API_KEYS)) : [];
if (empty($keysToTry) && defined('GEMINI_API_KEY') && !empty(GEMINI_API_KEY)) {
    $keysToTry = [GEMINI_API_KEY];
}
$modelsToTry = defined('GEMINI_MODELS') && is_array(GEMINI_MODELS) ? array_values(array_filter(GEMINI_MODELS)) : [];
if (empty($modelsToTry)) {
    $modelsToTry = [defined('GEMINI_MODEL') ? GEMINI_MODEL : 'gemini-2.5-flash'];
}

$prompt = "ROLE: Accurate Resume Identity Extractor.\n"
        . "TASK: Extract ONLY the candidate's full legal name from the resume text.\n"
        . "RULES:\n"
        . "- Do NOT extract company names, job titles, school names, degrees, or section headers (e.g. SKILL, EDUCATION, PROFILE).\n"
        . "- Return ONLY a valid JSON object matching this exact schema: {\"extracted_name\": \"Full Name\"}\n\n"
        . "RESUME TEXT:\n" . substr($resumeText, 0, 2000);

$postData = [
    "contents" => [
        ["parts" => [["text" => $prompt]]]
    ],
    "generationConfig" => [
        "responseMimeType" => "application/json",
        "temperature" => 0.0,
        "candidateCount" => 1
    ]
];

foreach ($keysToTry as $currentKey) {
    foreach ($modelsToTry as $currentModel) {
        $geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$currentModel}:generateContent?key=" . $currentKey;
        $ch = curl_init($geminiUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
        curl_setopt($ch, CURLOPT_TCP_NODELAY, 1);
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);

        $rawResp = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($rawResp !== false && $httpCode === 200) {
            $decoded = json_decode($rawResp, true);
            if (isset($decoded['candidates'][0]['content']['parts'][0]['text'])) {
                $textPart = $decoded['candidates'][0]['content']['parts'][0]['text'];
                $parsedJson = json_decode(trim($textPart), true);
                if (!empty($parsedJson['extracted_name']) && strlen(trim($parsedJson['extracted_name'])) >= 3) {
                    $extractedName = trim($parsedJson['extracted_name']);
                    break 2;
                }
            }
        }
    }
}

// LAYER 2: Fallback Heuristic Parser (If Gemini is unavailable or timed out)
if (empty($extractedName)) {
    // Separate concatenated ALL-CAPS section headers (e.g. "EDUCATIONNhelycita" -> "EDUCATION\nNhelycita")
    $headersToSplit = [
        'EDUCATION', 'WORK EXPERIENCE', 'PROFESSIONAL EXPERIENCE', 'EMPLOYMENT HISTORY',
        'EXPERIENCE', 'PROFILE', 'PROFESSIONAL SUMMARY', 'SUMMARY', 'CAREER OBJECTIVE',
        'OBJECTIVE', 'TECHNICAL SKILLS', 'SKILLS', 'SKILL', 'PROJECTS', 'CERTIFICATIONS',
        'CERTIFICATES', 'REFERENCES', 'AWARDS', 'LANGUAGES'
    ];
    $cleanText = $resumeText;
    foreach ($headersToSplit as $hdr) {
        $cleanText = preg_replace('/\b(' . preg_quote($hdr, '/') . ')([A-Z][a-z])/', "$1\n$2", $cleanText);
    }

    $forbiddenList = array_merge(array_map('strtolower', $headersToSplit), [
        'resume', 'curriculum', 'vitae', 'cv', 'page', 'email', 'phone', 'contact', 'address',
        'bachelor', 'college', 'university', 'school', 'corporation', 'assistant', 'manager', 'associate'
    ]);

    $lines = array_filter(array_map('trim', explode("\n", substr($cleanText, 0, 1500))));
    foreach ($lines as $line) {
        $cleanLine = trim(preg_replace('/[^a-zA-Z\s\.\,\-\']/', '', $line));
        $words = array_values(array_filter(explode(' ', $cleanLine), fn($w) => strlen($w) > 0));
        $wCount = count($words);

        // Candidate full name must have at least 2 words (e.g. "First Last") and maximum 5 words
        if ($wCount < 2 || $wCount > 5) continue;
        if (strlen($cleanLine) < 4 || strlen($cleanLine) > 50) continue;
        if (preg_match('/(@|http|www|\.com|\+?\d{7,})/i', $line)) continue;

        $hasForbidden = false;
        foreach ($forbiddenList as $fWord) {
            if (stripos($cleanLine, $fWord) !== false) {
                $hasForbidden = true;
                break;
            }
        }
        if ($hasForbidden) continue;

        // Check capitalization: words must start with uppercase letter
        $caps = 0;
        foreach ($words as $w) {
            if (ctype_upper($w[0])) $caps++;
        }
        if ($caps >= 2) {
            $extractedName = $cleanLine;
            break;
        }
    }
}

if (empty($extractedName)) {
    $extractedName = 'Candidate';
}

// 5. Compare Candidate Account Name with Extracted Resume Name
$matched = true;
$discrepancyType = null;

if (!empty($candidateName) || !empty($dbFirst)) {
    // Determine target first and last name (using DB fields if available for precision)
    if (!empty($dbFirst) && !empty($dbLast)) {
        $cleanDbFirst = strtolower(preg_replace('/[^a-z0-9\s]/i', '', $dbFirst));
        $firstTokens  = array_values(array_filter(explode(' ', $cleanDbFirst), fn($w) => strlen($w) >= 2));
        $inputFirst   = reset($firstTokens) ?: strtolower($dbFirst);

        $cleanDbLast  = strtolower(preg_replace('/[^a-z0-9\s]/i', '', $dbLast));
        $lastTokens   = array_values(array_filter(explode(' ', $cleanDbLast), fn($w) => strlen($w) >= 2));
        $inputLast    = end($lastTokens) ?: strtolower($dbLast);
    } else {
        // Clean and tokenize account name, ignoring 1-letter middle initial tokens
        $cleanAccount = strtolower(preg_replace('/[^a-z0-9\s]/i', '', $candidateName));
        $accWords = array_values(array_filter(explode(' ', $cleanAccount), fn($w) => strlen($w) >= 2));
        $inputFirst = reset($accWords) ?: '';
        $inputLast  = end($accWords) ?: '';
    }

    // Clean and tokenize extracted resume name
    $cleanExtracted = strtolower(preg_replace('/[^a-z0-9\s]/i', '', $extractedName));
    $resWords = array_values(array_filter(explode(' ', $cleanExtracted), fn($w) => strlen($w) >= 2));

    $resumeFirst = reset($resWords) ?: '';
    $resumeLast  = end($resWords) ?: '';

    // Check direct first name match
    $firstMatches = ($inputFirst === $resumeFirst) ||
                    (levenshtein($inputFirst, $resumeFirst) <= 1) ||
                    (str_starts_with($inputFirst, $resumeFirst) && strlen($inputFirst) - strlen($resumeFirst) <= 2) ||
                    (str_starts_with($resumeFirst, $inputFirst) && strlen($resumeFirst) - strlen($inputFirst) <= 2);

    // Check direct last name match
    $lastMatches = ($inputLast === $resumeLast) || (levenshtein($inputLast, $resumeLast) <= 1);

    // Check inverted / reverse name order (e.g. "Dela Cruz, Juan M." on resume)
    $reverseMatches = ($inputFirst === $resumeLast || levenshtein($inputFirst, $resumeLast) <= 1) &&
                      ($inputLast === $resumeFirst || levenshtein($inputLast, $resumeFirst) <= 1);
    if ($reverseMatches) {
        $firstMatches = true;
        $lastMatches  = true;
    }

    // Also check if candidate's first name appears anywhere in the top 1500 chars of resume text
    if (!$firstMatches && !empty($inputFirst)) {
        if (stripos(substr($resumeText, 0, 1500), $inputFirst) !== false) {
            $firstMatches = true;
        }
    }

    // Also check if candidate's last name appears anywhere in the top 1500 chars of resume text
    if (!$lastMatches && !empty($inputLast)) {
        if (stripos(substr($resumeText, 0, 1500), $inputLast) !== false) {
            $lastMatches = true;
        }
    }

    // Middle initial tolerance: Middle initial is purely optional; omitting it or including it on either account or resume will NOT reject candidate.
    if (!$firstMatches && !$lastMatches) {
        $matched = false;
        $discrepancyType = 'full_mismatch';
    } else if (!$firstMatches) {
        $matched = false;
        $discrepancyType = 'first_name_mismatch';
    } else if (!$lastMatches) {
        $matched = false;
        $discrepancyType = 'last_name_mismatch';
    }
}

// 6. Return Pre-Screening Gate Decision
echo json_encode([
    'status'           => 'success',
    'matched'          => $matched,
    'discrepancy_type' => $discrepancyType,
    'extracted_name'   => $extractedName,
    'account_name'     => $candidateName,
    'message'          => $matched 
        ? "Resume verified: Matches registered account ({$candidateName})." 
        : "Resume name mismatch: The resume belongs to '{$extractedName}', which does not match your registered account ('{$candidateName}')."
]);
