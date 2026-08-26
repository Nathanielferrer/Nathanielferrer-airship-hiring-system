<?php
// Include database and configurations
require_once '../db.php';
require_once '../config.php';

// Include smalot/pdfparser autoload
require_once '../vendor/autoload.php';

header('Content-Type: application/json');

// Disable HTML error output to prevent JSON corruption
ini_set('display_errors', 0);

// 1. Verify file upload is set and successful
if (!isset($_FILES['resume']) || $_FILES['resume']['error'] !== UPLOAD_ERR_OK) {
    $errorMessage = "No resume file uploaded or an upload error occurred.";
    if (isset($_FILES['resume'])) {
        switch ($_FILES['resume']['error']) {
            case UPLOAD_ERR_INI_SIZE:
            case UPLOAD_ERR_FORM_SIZE:
                $errorMessage = "The uploaded file is too large. Please upload a smaller PDF.";
                break;
            case UPLOAD_ERR_PARTIAL:
                $errorMessage = "The file was only partially uploaded.";
                break;
            case UPLOAD_ERR_NO_FILE:
                $errorMessage = "No file was uploaded.";
                break;
        }
    }
    
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => $errorMessage
    ]);
    exit();
}

$jobId  = isset($_POST['job_id']) ? intval($_POST['job_id']) : 0;
$userId = isset($_POST['user_id']) ? intval($_POST['user_id']) : 0;
$candidateName  = isset($_POST['candidate_name']) ? trim($_POST['candidate_name']) : '';
$candidateEmail = isset($_POST['candidate_email']) ? trim($_POST['candidate_email']) : '';

if ($jobId <= 0 || $userId <= 0) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid job ID or user credentials."
    ]);
    exit();
}

// 1.5. Check for duplicate application (Fail-Safe)
try {
    $dupStmt = $pdo->prepare("SELECT id FROM applications WHERE user_id = :user_id AND job_id = :job_id LIMIT 1");
    $dupStmt->execute(['user_id' => $userId, 'job_id' => $jobId]);
    if ($dupStmt->fetch()) {
        http_response_code(409); // Conflict
        echo json_encode([
            "status" => "error",
            "message" => "You have already submitted an application for this position."
        ]);
        exit();
    }

    // 1.6. Check if user already has an active application elsewhere
    $activeStmt = $pdo->prepare("SELECT id FROM applications WHERE user_id = :user_id AND status IN ('pending', 'review_required', 'shortlisted', 'INTERVIEW_SCHEDULED') LIMIT 1");
    $activeStmt->execute(['user_id' => $userId]);
    if ($activeStmt->fetch()) {
        http_response_code(409); // Conflict
        echo json_encode([
            "status" => "error",
            "message" => "You already have an active application under review. Please wait for a final decision on your current application before applying to other roles."
        ]);
        exit();
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database query failed: " . $e->getMessage()
    ]);
    exit();
}

// 2. Fetch the target job requirements
try {
    $jobStmt = $pdo->prepare("SELECT title, description, requirements FROM jobs WHERE id = :id");
    $jobStmt->execute(['id' => $jobId]);
    $job = $jobStmt->fetch();

    if (!$job) {
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "Selected job vacancy not found."
        ]);
        exit();
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database query failed: " . $e->getMessage()
    ]);
    exit();
}

// 3. Secure File Upload Validation & Storage
$maxSizeBytes = 5 * 1024 * 1024; // 5 MB Max Cap
if ($_FILES['resume']['size'] > $maxSizeBytes) {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "File size exceeds the 5 MB limit. Please upload a smaller PDF."
    ]);
    exit();
}

// (A) Extension check
$fileExtension = strtolower(pathinfo($_FILES['resume']['name'], PATHINFO_EXTENSION));
if ($fileExtension !== 'pdf') {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "Only PDF files are supported."
    ]);
    exit();
}

// (B) Server-Side MIME-Type Byte Verification (finfo_file checks magic bytes, preventing renamed scripts)
$finfo    = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $_FILES['resume']['tmp_name']);
finfo_close($finfo);

if ($mimeType !== 'application/pdf') {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "Security Violation: File content does not match genuine PDF binary signature."
    ]);
    exit();
}

// (C) Store in protected private directory (outside direct web URL access)
$uploadDir = '../private/resumes/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0750, true);
}

// Ensure .htaccess exists inside private/resumes to deny all web access
$htaccessPath = $uploadDir . '.htaccess';
if (!file_exists($htaccessPath)) {
    file_put_contents($htaccessPath, "Require all denied\n");
}

// (D) Cryptographically secure random filename
$newFileName = bin2hex(random_bytes(16)) . '.pdf';
$filePath    = $uploadDir . $newFileName;
$dbFilePath  = 'private/resumes/' . $newFileName;

if (!move_uploaded_file($_FILES['resume']['tmp_name'], $filePath)) {
    http_response_code(500);
    echo json_encode([
        "status"  => "error",
        "message" => "Failed to securely save the uploaded file."
    ]);
    exit();
}

// 4. Parse PDF text using smalot/pdfparser
$resumeText = '';
try {
    $parser = new \Smalot\PdfParser\Parser();
    $pdf = $parser->parseFile($filePath);
    $rawText = $pdf->getText();

    // Text Normalization & Sanitization
    // (A) Normalize all newline representations to standard \n
    $normalizedText = str_replace(["\r\n", "\r"], "\n", (string)$rawText);
    // (B) Strip null bytes and non-printable control characters (retain standard whitespace, tabs, and newlines)
    $normalizedText = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $normalizedText);
    // (C) Collapse excessive consecutive line breaks to maintain clean structural flow
    $normalizedText = preg_replace("/\n{3,}/", "\n\n", $normalizedText);
    $resumeText = trim($normalizedText);

    if (empty($resumeText)) {
        throw new Exception("Parsed text is empty.");
    }
} catch (Exception $e) {
    // If pdf parser fails, try to fallback to a basic text scan or return error
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "is_parse_error" => true,
        "message" => "Invalid resume format detected. Please upload a standard resume or download our template to guarantee compatibility."
    ]);
    exit();
}

// 4.5. Dual-Category Pre-Screening Gate (runs before any API call to save quota)
// A valid resume MUST contain both personal identity indicators and structural section headers.
$lowerText = strtolower($resumeText);

// (A) Personal Identity Signals: Email address, Phone number, or Contact labels
$hasEmail   = (bool) preg_match('/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i', $resumeText);
$hasPhone   = (bool) preg_match('/(\+?\d[\d\s\-().]{7,15}\d)/', $resumeText);
$hasContactLabel = (bool) preg_match('/\b(name\s*:|address\s*:|contact\s*:|email\s*:|phone\s*:|mobile\s*:|linkedin|github)\b/i', $lowerText);
$hasPersonalSignal = ($hasEmail || $hasPhone || $hasContactLabel);

// (B) Structural Resume Section Keywords
$sectionKeywords = [
    'work experience', 'employment history', 'job experience', 'professional experience',
    'education', 'educational background', 'educational attainment',
    'skills', 'technical skills', 'core competencies', 'summary', 'profile',
    'professional summary', 'career objective', 'certifications', 'references'
];
$sectionMatchCount = 0;
foreach ($sectionKeywords as $kw) {
    if (strpos($lowerText, $kw) !== false) {
        $sectionMatchCount++;
    }
}

// Reject if it lacks personal contact details OR fails to have at least 2 distinct structural resume section headers
if (!$hasPersonalSignal || $sectionMatchCount < 2) {
    if (file_exists($filePath)) unlink($filePath); // cleanup uploaded file
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "is_parse_error" => true,
        "message" => "Invalid resume format detected. Please upload a standard resume or download our template to guarantee compatibility."
    ]);
    exit();
}

// Dont mind this is just to avoid crashing the system since testing palang nmn, ano lang to basta 
// 5. Invoke Gemini API for AI assessment
if (empty(GEMINI_API_KEY)) {
    // If API Key is placeholder, mock a successful response for testing/development
    $aiResult = [
        "applicant_info" => [
            "name" => "Kurtney Soriano",
            "contact" => "delacruzkurtney07@gmail.com",
            "location" => "Metro Manila, Philippines"
        ],
        "extracted_education" => [
            [ "degree" => "High School Graduate", "year_graduated" => "2022" ]
        ],
        "extracted_work_history" => [
            [ "job_title" => "Repacker at Logistics Inc.", "duration" => "2 Years", "key_responsibilities" => ["Packing goods", "Labeling inventory"] ]
        ],
        "skills_analysis" => [
            "found_skills" => ["Packing", "Item checking"],
            "missing_skills" => ["Product testing"]
        ],
        "ranking_logic" => [
            "match_score" => 85,
            "review_flag" => false,
            "review_reason" => ""
        ],
        "summary" => [
            "Demonstration of fast learning skills matches the repacker requirements.",
            "Clean tenure history shown on resume (2+ years at last role).",
            "Lacks specific product testing experience requested by client."
        ]
    ];
} else {
    // Build prompt for Gemini API
    $prompt = "ROLE: Strict Recruitment Evaluator.\n\n";
    $prompt .= "TASK: Strictly evaluate the RESUME_TEXT against the provided JOB_REQUIREMENTS. Return ONLY a raw, valid JSON object.\n\n";
    $prompt .= "STRICT OUTPUT RULES:\n";
    $prompt .= "- NO Markdown (no ```json ... ```).\n";
    $prompt .= "- NO conversational filler (e.g., \"Here is the parsed data\").\n";
    $prompt .= "- You must provide valid, parseable JSON — invalid JSON crashes the system.\n\n";
    $prompt .= "CORE EVALUATION DIRECTIVE:\n";
    $prompt .= "- Strictly evaluate the resume against the provided Job Requirements. The job requirements are the ONLY benchmark.\n";
    $prompt .= "- Do NOT award points for impressive technical skills if they are completely irrelevant to the job title and its requirements.\n";
    $prompt .= "- If the candidate does not meet the minimum Education or Location requirements stated in the job, deduct points heavily.\n";
    $prompt .= "- Be conservative. A candidate must genuinely earn their score through direct relevance — not potential.\n";
    $prompt .= "- IGNORE formatting, structure, or template design. Direct uploads and template uploads containing the exact same textual information MUST receive the EXACT SAME score. Evaluate purely on the literal content provided.\n\n";
    $prompt .= "EXTRACTION LOGIC:\n";
    $prompt .= "- applicant_info: Extract the candidate's full name, contact (email/phone), and physical location (city/province/country) from the resume header or contact section.\n";
    $prompt .= "- skills_analysis: Extract skills EXACTLY AND VERBATIM from the resume. DO NOT infer, guess, or synthesize soft skills (e.g., 'Teamwork', 'Flexibility'). Only extract literal bullet points or comma-separated skill lists as written in the resume.\n";
    $prompt .= "- extracted_work_history: Extract job title, duration, and responsibilities ONLY from the text provided.\n\n";
    $prompt .= "SCORING RUBRIC (Strict — Total: 100 points):\n";
    $prompt .= "1. Work Experience Relevance (max 50 pts): Award points ONLY if the candidate's past job titles and responsibilities are DIRECTLY relevant to this specific job title and requirements. Do NOT award points for unrelated experience, no matter how impressive. Example: a software engineer applying for a warehouse role earns 0 experience points.\n";
    $prompt .= "2. Skills Match (max 30 pts): Award points ONLY for verbatim skills from the resume that directly match or are highly analogous to skills explicitly required by the job. Irrelevant technical skills — however advanced — score 0 in this category.\n";
    $prompt .= "3. Education & Qualifications (max 20 pts): Compare the candidate's education to the minimum education requirement in the job. Award points proportionally. If the job does not state an education requirement, award full 20 pts if candidate has any degree/diploma.\n\n";
    $prompt .= "MANDATORY PENALTIES (apply BEFORE finalizing the score):\n";
    $prompt .= "- PENALTY A — Missing Minimum Education: If the job explicitly requires a minimum education level (e.g., Bachelor's Degree) and the candidate does NOT meet it, deduct 15 points from the total score.\n";
    $prompt .= "- PENALTY B — Location Mismatch: If the job specifies a required work location or residency and the candidate's extracted location does not match, deduct 10 points from the total score.\n";
    $prompt .= "- PENALTY C — Completely Irrelevant Experience: If the candidate's entire work history is unrelated to the job role, experience score is 0. No partial credit for 'transferable general skills' unless explicitly listed in the job requirements.\n";
    $prompt .= "- PENALTY D — Zero Match (No Skills + No Relevant Experience): If the candidate has no extracted skills matching the job AND no relevant work history, the final match_score MUST be 0.\n\n";
    $prompt .= "CALIBRATION EXAMPLES:\n";
    $prompt .= "- Warehouse Staff applicant with 3 years repacking, matching location, relevant physical skills → 75–90.\n";
    $prompt .= "- Warehouse Staff applicant who is a software developer with zero warehouse background → 0–15.\n";
    $prompt .= "- Admin role applicant with college degree, partially matching skills → 50–70.\n";
    $prompt .= "- Applicant meeting no requirements at all → 0.\n\n";
    $prompt .= "JSON SCHEMA:\n";
    $prompt .= "{\n";
    $prompt .= "  \"applicant_info\": {\n";
    $prompt .= "    \"name\": \"String\",\n";
    $prompt .= "    \"contact\": \"String\",\n";
    $prompt .= "    \"location\": \"String (city, province/state, country as written in the resume)\"\n";
    $prompt .= "  },\n";
    $prompt .= "  \"extracted_education\": [\n";
    $prompt .= "    { \"degree\": \"String\", \"year_graduated\": \"String\" }\n";
    $prompt .= "  ],\n";
    $prompt .= "  \"extracted_work_history\": [\n";
    $prompt .= "    { \"job_title\": \"String\", \"duration\": \"String\", \"key_responsibilities\": [\"String\"] }\n";
    $prompt .= "  ],\n";
    $prompt .= "  \"skills_analysis\": {\n";
    $prompt .= "    \"found_skills\": [\"String (verbatim skills found in resume)\"],\n";
    $prompt .= "    \"missing_skills\": [\"String (required skills from JOB_REQUIREMENTS that are absent in the resume)\"]\n";
    $prompt .= "  },\n";
    $prompt .= "  \"ranking_logic\": {\n";
    $prompt .= "    \"match_score\": \"Integer (0–100, computed strictly per rubric with all penalties applied)\",\n";
    $prompt .= "    \"review_flag\": \"Boolean (true if score is borderline or manual review is warranted)\",\n";
    $prompt .= "    \"review_reason\": \"String (explain which requirements the candidate failed to meet, or which penalties were applied and why)\"\n";
    $prompt .= "  },\n";
    $prompt .= "  \"summary\": [\n";
    $prompt .= "    \"String (Bullet 1: Overall score rationale — which rubric categories scored high/low and why)\",\n";
    $prompt .= "    \"String (Bullet 2: Relevance of the candidate's experience to this specific job role)\",\n";
    $prompt .= "    \"String (Bullet 3: Key unmet requirements — missing education, location mismatch, or absent critical skills)\"\n";
    $prompt .= "  ]\n";
    $prompt .= "}\n\n";
    $prompt .= "INPUT DATA:\n\n";
    $prompt .= "JOB_REQUIREMENTS:\n" . $job['requirements'] . "\n\n";
    $prompt .= "RESUME_TEXT:\n" . $resumeText . "\n\n";

    $geminiModel = defined('GEMINI_MODEL') ? GEMINI_MODEL : 'gemini-3.5-flash-lite';
    $geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$geminiModel}:generateContent?key=" . GEMINI_API_KEY;

    $postData = [
        "contents" => [
            [
                "parts" => [
                    ["text" => $prompt]
                ]
            ]
        ],
        "generationConfig" => [
            "responseMimeType" => "application/json",
            "temperature"      => 0.0,
            "topP"             => 0.0,
            "candidateCount"   => 1
        ]
    ];

    $ch = curl_init($geminiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // For local XAMPP environments
    curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4); // Avoid Windows IPv6 DNS resolution delay
    curl_setopt($ch, CURLOPT_TCP_NODELAY, 1); // Disable Nagle's algorithm for faster packet dispatch
    curl_setopt($ch, CURLOPT_TIMEOUT, 45);

    $response = curl_exec($ch);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Gemini API request failed: " . $curlError
        ]);
        exit();
    }

    $apiData = json_decode($response, true);
    
    // Check for explicit API errors (e.g. Quota Exceeded, Invalid Model, etc.)
    if (isset($apiData['error'])) {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Gemini API Error: " . (isset($apiData['error']['message']) ? $apiData['error']['message'] : json_encode($apiData['error']))
        ]);
        exit();
    }

    $aiText = '';
    if (isset($apiData['candidates'][0]['content']['parts'][0]['text'])) {
        $aiText = trim($apiData['candidates'][0]['content']['parts'][0]['text']);
    }

    // Strip out markdown formatting ```json if returned
    $aiText = preg_replace('/^```(?:json)?/i', '', $aiText);
    $aiText = preg_replace('/```$/', '', $aiText);
    $aiText = trim($aiText);

    $aiResult = json_decode($aiText, true);

    // Enforce Zero-Skill / Zero-Experience hard cap in PHP
    if (is_array($aiResult) && isset($aiResult['ranking_logic'])) {
        $foundSkills = isset($aiResult['skills_analysis']['found_skills']) ? (array)$aiResult['skills_analysis']['found_skills'] : [];
        $workHistory = isset($aiResult['extracted_work_history']) ? (array)$aiResult['extracted_work_history'] : [];

        if (empty($foundSkills) && empty($workHistory)) {
            $aiResult['ranking_logic']['match_score'] = 0;
        }
    }

    // Phase 3 Quality Check — allow low-confidence parses through for manual HR review
    // (Keyword pre-screening already blocked non-resume documents upstream)

    // Fallback if parsing fails
    if (!$aiResult || !isset($aiResult['ranking_logic']['match_score'])) {
        $aiResult = [
            "applicant_info" => [
                "name" => $candidateName,
                "contact" => $candidateEmail,
                "location" => "",
                "years_of_experience" => 0
            ],
            "extracted_education" => [],
            "extracted_work_history" => [],
            "skills_analysis" => [
                "found_skills" => [],
                "missing_skills" => []
            ],
            "ranking_logic" => [
                "match_score" => 50,
                "experience_relevance" => "Not evaluated due to parsing failure.",
                "review_flag" => true,
                "review_reason" => "Failed to parse evaluation response."
            ],
            "summary" => "- Assessment completed but response parsing failed.\n- Manual review is recommended."
        ];
    }
}

// 6. Save the application results to database
try {
    // Resolve score and status
    $score = intval($aiResult['ranking_logic']['match_score']);
    
    // Set status based on review flag and score
    // Phase 4 Status Routing — HR retains full control over rejections
    $status = 'pending';
    if ($aiResult['ranking_logic']['review_flag'] === true) {
        $status = 'review_required';
    } else if ($score >= 80) {
        $status = 'shortlisted';
    }
    // Note: score < 50 routes to 'pending' so HR admin can decide to reject manually

    // Extract the candidate's name parsed directly from the uploaded resume document
    $resumeParsedName = isset($aiResult['applicant_info']['name']) ? trim($aiResult['applicant_info']['name']) : '';
    $finalCandidateName = !empty($resumeParsedName) ? $resumeParsedName : $candidateName;

    $insertStmt = $pdo->prepare("INSERT INTO applications (user_id, job_id, resume_path, ai_match_score, ai_summary, status, candidate_name, candidate_email) VALUES (:user_id, :job_id, :resume_path, :score, :summary, :status, :candidate_name, :candidate_email)");
    $insertStmt->execute([
        'user_id'        => $userId,
        'job_id'         => $jobId,
        'resume_path'    => $dbFilePath,
        'score'          => $score,
        'summary'        => json_encode($aiResult), // Save the whole JSON string
        'status'         => $status,
        'candidate_name' => $finalCandidateName,
        'candidate_email' => $candidateEmail
    ]);

    $appId = $pdo->lastInsertId();

    echo json_encode([
        "status" => "success",
        "message" => "Application submitted and evaluated successfully!",
        "application" => [
            "id" => $appId,
            "job_id" => $jobId,
            "ai_match_score" => $score,
            "ai_summary" => json_encode($aiResult),
            "status" => $status
        ]
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database save failed: " . $e->getMessage()
    ]);
}
