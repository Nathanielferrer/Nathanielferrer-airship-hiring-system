<?php
require_once '../db.php';
require_once '../config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'message' => 'Invalid method']);
    exit;
}

$body        = json_decode(file_get_contents('php://input'), true);
$rawMessage  = trim($body['message']       ?? '');
$userId      = !empty($body['user_id'])    ? (int)$body['user_id'] : null;
$isAdminTest = !empty($body['is_admin_test']) && $body['is_admin_test'] === true;

if (empty($rawMessage)) {
    echo json_encode(['status' => 'error', 'message' => 'Empty message']);
    exit;
}

// ── Validate User ID early ───────────────────────────────────────────────────
$validUserId = null;
if (!empty($userId)) {
    try {
        $chk = $pdo->prepare("SELECT User_ID FROM user WHERE User_ID = :uid");
        $chk->execute([':uid' => $userId]);
        if ($chk->fetch()) {
            $validUserId = (int)$userId;
        }
    } catch (PDOException $e) {
        $validUserId = null;
    }
}

// ── Helper to save persistent chat history ──────────────────────────────────
function saveChatHistory($pdo, $applicantId, $userMsg, $botMsg) {
    if (!$applicantId) return;
    try {
        $stmt = $pdo->prepare("
            INSERT INTO chatbot_history (applicant_id, sender, message_text)
            VALUES (:aid1, 'user', :umsg), (:aid2, 'bot', :bmsg)
        ");
        $stmt->execute([
            ':aid1' => $applicantId,
            ':aid2' => $applicantId,
            ':umsg' => $userMsg,
            ':bmsg' => $botMsg
        ]);
    } catch (PDOException $e) {
        error_log('[Chatbot] History save failed: ' . $e->getMessage());
    }
}

// Greeting using the keywords arrays if matched the ai will reply with a greeting message & also check if the user is logged in using the user id and save the chat history in the database
$greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'greetings', 'sup'];
$msgLower  = strtolower(trim($rawMessage));
foreach ($greetings as $g) {
    if ($msgLower === $g || strpos($msgLower, $g . ' ') === 0) {
        $respText = "Hello! 👋 I'm the Airship Express AI Companion. I can help you with information about job openings, the application process, interview schedules, and more. What would you like to know?";
        if ($validUserId && !$isAdminTest) {
            saveChatHistory($pdo, $validUserId, $rawMessage, $respText);
        }
        echo json_encode([
            'status'   => 'match',
            'response' => $respText,
        ]);
        exit;
    }
}

// REAL-TIME INTENT: Application Status Lookup
// Triggered when user asks about their own application status. 
// This is dynamic , if the user is logged in it will fetch the data from the database and display it to the user. 
$statusKeywords = [
    'my status', 'application status', 'my application', 'check status',
    'where is my application', 'status of my application', 'track my application',
    'application update', 'my application status', 'have i been', 'did i pass',
    'what is my status', 'my job status', 'application result', 'my result',
    'have they reviewed', 'been reviewed', 'any update', 'update on my',
    'application progress', 'my progress', 'where am i in',
];

$isStatusQuery = false;
foreach ($statusKeywords as $kw) {
    if (strpos($msgLower, $kw) !== false) {
        $isStatusQuery = true;
        break;
    }
}
// catching the status query and checking if the user is logged in using the user id and save the chat history in the database
if ($isStatusQuery) {
    if (!$validUserId) {
        $respText = "To check your application status, please log in first. Once logged in, I can show you the real-time status of all your applications! 🔐";
    } else {
        try {
            $appQ = $pdo->prepare("
                SELECT
                    a.id,
                    a.status,
                    a.applied_at,
                    j.title AS job_title,
                    i.scheduled_date,
                    i.scheduled_time,
                    i.location
                FROM applications a
                INNER JOIN jobs j ON a.job_id = j.id
                LEFT JOIN interviews i ON i.application_id = a.id
                WHERE a.user_id = :uid
                ORDER BY a.applied_at DESC
            ");
            $appQ->execute([':uid' => $validUserId]);
            $userApps = $appQ->fetchAll(PDO::FETCH_ASSOC);

            if (empty($userApps)) { // If no applications found, it will display this message 
                $respText = "It looks like you haven't submitted any applications yet. 📋 Visit our Vacancy page to browse current openings and apply!";
            } else { // If applications are found, it will display the status of the applications
                $statusLabels = [
                    'pending'                 => 'Under Review',
                    'review_required'         => 'Under Interview',
                    'PASSED INITIAL'          => 'Passed Initial Screening',
                    'PENDING SCHEDULED'       => 'Interview Being Arranged',
                    'INTERVIEW_SCHEDULED'     => 'Interview Scheduled',
                    'CONFIRMED'               => 'Interview Confirmed',
                    'RESCHEDULING'            => 'Interview Rescheduling',
                    'HIRED'                   => 'Hired',
                    'rejected'                => 'Not Shortlisted',
                    'FAILED INTERVIEW'        => 'Interview Not Passed',
                    'FAILED'                  => 'Application Unsuccessful',
                    'DECLINED - UNRESPONSIVE' => 'Declined - Unresponsive',
                ];
                // message structure format to display the status of the applications
                $lines = ["Here is the latest update on your application:\n"];
                foreach ($userApps as $idx => $app) {
                    $jobTitle  = $app['job_title'];
                    $rawStatus = $app['status'];
                    $label     = $statusLabels[$rawStatus] ?? ucwords(strtolower(str_replace('_', ' ', $rawStatus)));
                    $appliedOn = date('F j, Y', strtotime($app['applied_at']));

                    $lines[] = "Position: {$jobTitle}";
                    $lines[] = "Current Status: {$label}";
                    $lines[] = "";
                    $lines[] = "Applied On: {$appliedOn}";

                    if (!empty($app['scheduled_date'])) {
                        $intDateStr = date('l, F j, Y', strtotime($app['scheduled_date']));
                        $timeRaw = !empty($app['scheduled_time']) ? $app['scheduled_time'] : '10:00:00';
                        $intTimeStr = date('g:i A', strtotime($timeRaw));
                        $intLoc = !empty($app['location']) ? $app['location'] : '352 T. Pinpin Escolta St., Binondo, Manila 1006';
                        $lines[] = "Interview Date: {$intDateStr} at {$intTimeStr}";
                        $lines[] = "Location: {$intLoc}";
                    }
                    $lines[] = "";
                }
                $lines[] = "For more details, please visit your Application Status page.";
                $lines[] = "Is there anything else I can assist you with today?";
                $respText = implode("\n", $lines);
            }
        } catch (PDOException $e) {
            $respText = "I'm having trouble fetching your application details right now. Please try again shortly or visit your Application Status page directly.";
        }
    }

    if ($validUserId && !$isAdminTest) {
        saveChatHistory($pdo, $validUserId, $rawMessage, $respText);
    }
    echo json_encode(['status' => 'match', 'response' => $respText]);
    exit;
}

// REAL-TIME INTENT: Current Job Listings
// Triggered when user asks for available jobs/positions 
// keywrds triggering to display the list of jobs
$jobListKeywords = [
    'what jobs', 'available jobs', 'job openings', 'current openings', 'job list',
    'what positions', 'available positions', 'open positions', 'list of jobs',
    'what are the jobs', 'what vacancies', 'current jobs', 'hiring for',
    'what roles', 'open roles', 'job vacancies', 'vacancies available',
    'currently hiring', 'what can i apply', 'jobs available', 'all jobs',
    'show me jobs', 'show jobs', 'browse jobs',
];

$isJobListQuery = false;
foreach ($jobListKeywords as $kw) {
    if (strpos($msgLower, $kw) !== false) {
        $isJobListQuery = true;
        break;
    }
}

if ($isJobListQuery) {
    try {
        $jobsQ   = $pdo->query("SELECT title, description, requirements, availability FROM jobs WHERE status = 'Active' AND availability > 0 ORDER BY id ASC");
        $liveJobs = $jobsQ->fetchAll(PDO::FETCH_ASSOC);

        if (empty($liveJobs)) {
            $respText = "There are currently no open positions at Airship Express. Please check back soon as new openings are added regularly.";
            //message format if existed
        } else {
            $lines = ["Here are the currently open positions at Airship Express:\n"];
            foreach ($liveJobs as $job) {
                $lines[] = "• " . $job['title'];
            }
            $lines[] = "\nTo see full requirements for a specific position, just ask me! For example: \"What are the requirements for [Job Title]?\"\nTo apply, please visit the Vacancy page on our portal.";
            $respText = implode("\n", $lines);
        }
    } catch (PDOException $e) {
        $respText = "I'm having trouble fetching the job list right now. Please visit our Vacancy page directly to see all open positions!";
    }

    if ($validUserId && !$isAdminTest) {
        saveChatHistory($pdo, $validUserId, $rawMessage, $respText);
    }
    echo json_encode(['status' => 'match', 'response' => $respText]);
    exit;
}

// REAL-TIME INTENT: Specific Job Requirements Lookup
// Triggered when user asks about requirements for a specific job position.
$requirementKeywords = [
    'requirement', 'requirements', 'qualifications', 'qualification',
    'what do i need', 'what are the requirements', 'what is needed',
    'what is required', 'what do you require', 'criteria', 'credentials',
    'educational requirement', 'education requirement', 'apply for',
    'apply to', 'what to have', 'prerequisite', 'prerequisites',
];

$isRequirementQuery = false;
foreach ($requirementKeywords as $kw) {
    if (strpos($msgLower, $kw) !== false) {
        $isRequirementQuery = true;
        break;
    }
}

if ($isRequirementQuery) {
    // Try to find all active job titles and match against the user's message
    $matchedJob = null;
    try {
        $allJobsStmt = $pdo->query("SELECT id, title, description, requirements, status, availability FROM jobs ORDER BY id ASC");
        $allJobs = $allJobsStmt->fetchAll(PDO::FETCH_ASSOC);

        $bestMatchScore = 0;
        foreach ($allJobs as $job) {
            $titleLower = strtolower($job['title']);
            $titleWords = array_values(array_filter(
                explode(' ', preg_replace('/[^a-z0-9\s]/', ' ', $titleLower)),
                fn($t) => strlen($t) >= 2
            ));
            $titleWordCount = count($titleWords);
            if ($titleWordCount === 0) continue;

            // ── Count how many title words appear in the user's message ──
            $matchCount = 0;
            foreach ($titleWords as $tw) {
                // Match whole words only (not substrings), e.g. "delivery" should not
                // match "deliveryman". Using word boundary check.
                if (preg_match('/\b' . preg_quote($tw, '/') . '\b/', $msgLower)) {
                    $matchCount++;
                }
            }

            $score = $matchCount / $titleWordCount;

            // ── Threshold rules ──
            // For single-word titles: require exact match (100%)
            // For multi-word titles (2+ words): require ALL words match (100%)
            //   Exception: 3+ word titles allow 1 miss (e.g. "Senior Delivery Associate" can match on 2/3)
            $requiredScore = 1.0;
            if ($titleWordCount >= 3) {
                $requiredScore = ($titleWordCount - 1) / $titleWordCount; // allow 1 miss for 3+ words
            }

            if ($score >= $requiredScore && $score > $bestMatchScore) {
                // ── Extra guard: check that matched title words appear consecutively
                // in the user message (not scattered random words) ──
                // Build a regex from the title to detect the phrase in order
                $phrasePattern = '/\b' . implode('\s+', array_map(fn($w) => preg_quote($w, '/'), $titleWords)) . '\b/i';
                $fullPhraseMatch = preg_match($phrasePattern, $msgLower);

                // For 2-word titles, require the full phrase to appear together
                // For 1-word titles or 3+ word titles, scoring threshold is sufficient
                if ($titleWordCount === 2 && !$fullPhraseMatch) {
                    continue; // e.g. "pizza delivery" will NOT match "Delivery Associate"
                }

                $bestMatchScore = $score;
                $matchedJob = $job;
            }
        }
    } catch (PDOException $e) {
        $matchedJob = null;
    }

    if ($matchedJob !== null) {
        // Job found — check if it is active and available
        if ($matchedJob['status'] === 'Active' && $matchedJob['availability'] > 0) {
            $jobTitle = $matchedJob['title'];
            $reqText  = trim($matchedJob['requirements']);
            $descText = trim($matchedJob['description']);

            $respLines = ["Here are the requirements for the {$jobTitle} position:\n"];
            $respLines[] = $reqText;
            $respLines[] = "";
            if (!empty($descText)) {
                $respLines[] = "About the Role:";
                $respLines[] = $descText;
                $respLines[] = "";
            }
            $respLines[] = "To apply for this position, please visit the Vacancy page on our portal and submit your application. 📋";
            $respText = implode("\n", $respLines);
        } else {
            // Job exists in DB but is no longer active or has no slots
            $jobTitle = $matchedJob['title'];
            $respText = "The {$jobTitle} position is currently not available or has been filled. 😔\n\nWould you like to see other currently open positions? Just ask \"What jobs are available?\" or visit the Vacancy page on our portal to browse all active openings.";
        }
    } else {
        // No matching job found at all
        // Try to extract the job name the user mentioned for a personalized response
        // Look for patterns like "for [job]", "to [job]", "about [job]"
        $jobNameGuess = '';
        if (preg_match('/(?:for|to|about|position of|role of)\s+(?:the\s+)?([a-zA-Z\s]{3,40}?)(?:\s+position|\s+role|\s+job|\s+post|[?!.]|$)/i', $rawMessage, $jobMatch)) {
            $jobNameGuess = trim($jobMatch[1]);
        }

        if (!empty($jobNameGuess)) {
            $respText = "I couldn't find a job position called \"{$jobNameGuess}\" in our current openings. It may not be available right now or may have a slightly different title.\n\nHere's what you can do:\n• Ask me \"What jobs are available?\" to see all current openings.\n• Visit the Vacancy page on our portal to browse and apply for open positions.\n\nIs there anything else I can help you with? 😊";
        } else {
            $respText = "I wasn't able to identify a specific job position in your question. Could you please specify the exact job title? For example: \"What are the requirements for Delivery Rider?\"\n\nYou can also ask \"What jobs are available?\" to see all current openings, or visit the Vacancy page on our portal.";
        }
    }

    if ($validUserId && !$isAdminTest) {
        saveChatHistory($pdo, $validUserId, $rawMessage, $respText);
    }
    echo json_encode(['status' => 'match', 'response' => $respText]);
    exit;
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 1: Database Knowledge Base Search (Exact Match Priority)
// ══════════════════════════════════════════════════════════════════════════════

$stopWords = [
    'the','a','an','is','are','was','were','be','been','being','have','has','had',
    'do','does','did','will','would','could','should','may','might','shall','can',
    'to','of','in','for','on','with','at','by','from','as','into','through',
    'about','and','but','if','or','that','this','these','those','it','its',
    'they','them','their','he','she','his','her','we','us','our','you','your',
    'i','my','me','what','when','where','how','why','who','which','im','id',
    'up','down','out','so','then','also','just','now','please','help','need',
    'want','know','tell','show','find','get','see','go','make','let','give',
    'check','look','ask','try','think','some','any','all','more','there','here',
    'am','ve','ll','re','dont','cant','wont','isnt','arent','much','still',
    'already','yet','really','very','quite','rather','too','well','yes','no',
];

$rawTokens = array_filter(
    explode(' ', preg_replace('/[^a-z0-9\s]/', ' ', $msgLower)),
    fn($t) => strlen($t) >= 2
);

$meaningfulTokens = array_values(array_filter(
    $rawTokens,
    fn($t) => !in_array($t, $stopWords)
));

$candidates = [];
if (!empty($meaningfulTokens)) {
    $searchQuery = implode(' ', $meaningfulTokens);
    try {
        $ftsStmt = $pdo->prepare("
            SELECT id, primary_question, predefined_answer, keyword_tags,
                   MATCH(primary_question, keyword_tags) AGAINST(:q IN NATURAL LANGUAGE MODE) AS relevance
            FROM   knowledge_base
            WHERE  MATCH(primary_question, keyword_tags) AGAINST(:q2 IN NATURAL LANGUAGE MODE)
            ORDER  BY relevance DESC
            LIMIT  5
        ");
        $ftsStmt->execute([':q' => $searchQuery, ':q2' => $searchQuery]);
        $candidates = $ftsStmt->fetchAll();
    } catch (PDOException $e) { /* FTS fallback */ }

    if (empty($candidates)) {
        $likeParts  = [];
        $likeParams = [];
        foreach (array_slice($meaningfulTokens, 0, 4) as $i => $tok) {
            $k = ":lt{$i}";
            $likeParts[]    = "(primary_question LIKE {$k} OR keyword_tags LIKE {$k})";
            $likeParams[$k] = "%{$tok}%";
        }
        if (!empty($likeParts)) {
            try {
                $likeStmt = $pdo->prepare(
                    "SELECT id, primary_question, predefined_answer, keyword_tags, 0 AS relevance
                     FROM knowledge_base WHERE " . implode(' OR ', $likeParts) . " LIMIT 5"
                );
                $likeStmt->execute($likeParams);
                $candidates = $likeStmt->fetchAll();
            } catch (PDOException $e) { /* ignore */ }
        }
    }
}

function precisionScore(array $queryTokens, string $kbText): float {
    if (empty($queryTokens)) return 0.0;
    $kbNorm   = preg_replace('/[^a-z0-9\s]/', ' ', strtolower($kbText));
    $kbTokens = array_unique(array_filter(explode(' ', $kbNorm), fn($t) => strlen($t) >= 2));
    $unique   = array_unique($queryTokens);
    $matches  = 0;
    foreach ($unique as $qt) {
        foreach ($kbTokens as $kt) {
            if ($qt === $kt
                || (strlen($qt) >= 4 && str_contains($kt, $qt))
                || (strlen($kt) >= 4 && str_contains($qt, $kt))) {
                $matches++;
                break;
            }
        }
    }
    return $matches / count($unique);
}

$THRESHOLD  = 0.85; // This is the standard score to match the user intent
$bestScore  = 0.0;  // This is the score of the best match
$bestAnswer = null; // This is the best answer

foreach ($candidates as $row) { // Loops through each candidate entry from the database
    $score = precisionScore($meaningfulTokens, $row['primary_question'] . ' ' . $row['keyword_tags']); // Calculates word match percentage
    if ($score > $bestScore) { // If this candidate scored higher than the previous best, it becomes the new leader!
        $bestScore  = $score;
        $bestAnswer = $row['predefined_answer'];
    }
}

// ── High-confidence match in DB Knowledge Base: Return HR predefined answer ────────
if ($bestScore >= $THRESHOLD && $bestAnswer !== null) {
    if ($validUserId && !$isAdminTest) {
        saveChatHistory($pdo, $validUserId, $rawMessage, $bestAnswer);
    }
    echo json_encode(['status' => 'match', 'response' => $bestAnswer, 'score' => round($bestScore, 2)]);
    exit;
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 2: Gemini 3.6 Flash AI Fallback & Contextual Intent Classifier
// ══════════════════════════════════════════════════════════════════════════════

// Fetch live active job openings to give Gemini real-time context
$activeJobsText = "None listed currently.";
try {
    $jobStmt = $pdo->query("SELECT title, description, requirements FROM jobs WHERE status = 'Active' AND availability > 0 LIMIT 10");
    $activeJobs = $jobStmt->fetchAll(PDO::FETCH_ASSOC);
    if (!empty($activeJobs)) {
        $jobList = [];
        foreach ($activeJobs as $j) {
            $reqFull  = !empty($j['requirements']) ? $j['requirements'] : 'See portal';
            $descFull = !empty($j['description']) ? $j['description'] : '';
            $entry    = "- " . $j['title'] . "\n  Requirements: " . $reqFull;
            if (!empty($descFull)) {
                $entry .= "\n  About the Role: " . $descFull;
            }
            $jobList[] = $entry;
        }
        $activeJobsText = implode("\n\n", $jobList);
    }
} catch (PDOException $e) { /* ignore */ }

// Fetch logged-in applicant's current application context for personalized AI responses
$applicantContextText = "The user is not logged in or has no applications on file.";
if ($validUserId) {
    try {
        $ctxQ = $pdo->prepare("
            SELECT a.status, j.title AS job_title, a.applied_at
            FROM applications a
            INNER JOIN jobs j ON a.job_id = j.id
            WHERE a.user_id = :uid
            ORDER BY a.applied_at DESC
            LIMIT 5
        ");
        $ctxQ->execute([':uid' => $validUserId]);
        $ctxApps = $ctxQ->fetchAll(PDO::FETCH_ASSOC);
        if (!empty($ctxApps)) {
            $ctxLines = ["This applicant (User ID: {$validUserId}) has the following applications:"];
            foreach ($ctxApps as $ca) {
                $ctxLines[] = "  - Applied for: {$ca['job_title']} | Status: {$ca['status']} | Date: " . date('Y-m-d', strtotime($ca['applied_at']));
            }
            $applicantContextText = implode("\n", $ctxLines);
        } else {
            $applicantContextText = "This applicant (User ID: {$validUserId}) is logged in but has no applications on file yet.";
        }
    } catch (PDOException $e) { /* ignore */ }
}

// ── Fetch Recent Chat History for Conversational Context ─────────────────────
// Last 6 turns (3 user + 3 bot) to give Gemini memory of the conversation.
$recentHistory = [];
if ($validUserId) {
    try {
        $histStmt = $pdo->prepare("
            SELECT sender, message_text, created_at
            FROM chatbot_history
            WHERE applicant_id = :uid
            ORDER BY created_at DESC
            LIMIT 6
        ");
        $histStmt->execute([':uid' => $validUserId]);
        // Reverse so oldest is first (chronological order)
        $recentHistory = array_reverse($histStmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (PDOException $e) { /* ignore */ }
}

$geminiApiKey = defined('GEMINI_API_KEY') ? GEMINI_API_KEY : '';

if (!empty($geminiApiKey)) {
    $systemInstruction = <<<EOT
ROLE: You are the intelligent HR & Hiring AI Assistant for "Airship Express", a courier, logistics, and delivery company in the Philippines. You have full knowledge of their hiring process, open positions, and applicant context.

CURRENT OPEN POSITIONS AT AIRSHIP EXPRESS:
{$activeJobsText}

CURRENT APPLICANT CONTEXT:
{$applicantContextText}

TASK: Answer the user's latest message naturally and conversationally, taking the FULL CONVERSATION HISTORY above into account. You have memory of the previous messages — use them to understand follow-up questions, references, and implied context.

CRITICAL FOLLOW-UP RULES:
- If the user asks a follow-up like "so do I need to submit first?", "what should I do then?", "how do I do that?", "okay so what's next?", "where do I go?", etc. — interpret it relative to the LAST BOT RESPONSE in the conversation history.
- If the last bot response told the user they have no applications yet, then a follow-up asking "do I need to submit first?" should be answered with: Yes, you need to apply first through the Vacancy page. Walk them through what to do next.
- NEVER give a generic answer if the conversation history provides clear context for what the user is referring to.
- NEVER say "navigate to our company website" — always say "visit the Vacancy page on our portal" or "go to the Application Status page."

JSON SCHEMA:
{
  "is_hiring_related": boolean,
  "response": "string",
  "is_knowledge_gap": boolean
}

INSTRUCTIONS:
1. "is_hiring_related":
   - Set to TRUE if the question is genuinely related to Airship Express, job openings, application status/process, interviews, hiring policies, careers, workplace inquiries, OR is a natural follow-up to a previous hiring-related message.
   - Set to FALSE ONLY if the user question is completely off-topic with zero connection to hiring (e.g. "weather", "math homework", "recipes").
   - Short follow-ups like "so?" "really?" "okay" "and then?" "what should I do?" should be treated as TRUE if the conversation context is hiring-related.

2. "response":
   - If "is_hiring_related" is FALSE: Return exactly "I can only assist with Airship Express hiring-related questions. Please ask a hiring or application question."
   - If "is_hiring_related" is TRUE: Provide a warm, professional, and helpful response. Be conversational and specific. Reference what was said before when relevant.
   - FORMATTING RULES:
     * Do NOT use hashtags or markdown headers (#, ##). Use clean bullet points (•) or standard numbers.
     * Do NOT say "navigate to our company website" — say "visit the Vacancy page" or "go to your Application Status page".
     * Keep responses concise but complete. Never leave a follow-up question unanswered.

3. "is_knowledge_gap":
   - Set to TRUE only if the question is hiring-related BUT requires specific internal HR policy details, exact salary amounts, or internal admin decisions.
   - Set to FALSE for general guidance, application process questions, or anything answerable from the context above.

User's latest message: "{$rawMessage}"

Return ONLY valid JSON (no markdown block, no conversational prefix).
EOT;

    // Build multi-turn conversation contents
    // Start with the system instruction as the first user turn (Gemini pattern)
    $conversationContents = [
        [
            'role'  => 'user',
            'parts' => [['text' => $systemInstruction]]
        ],
        [
            'role'  => 'model',
            'parts' => [['text' => '{"is_hiring_related": true, "response": "Understood. I am ready to assist applicants of Airship Express.", "is_knowledge_gap": false}']]
        ]
    ];

    // Inject recent conversation history as alternating user/model turns
    foreach ($recentHistory as $turn) {
        $role = $turn['sender'] === 'user' ? 'user' : 'model';
        // Wrap bot messages in the expected JSON format so context is preserved
        if ($role === 'model') {
            $escapedText = str_replace('"', '\\"', $turn['message_text']);
            $turnText    = '{"is_hiring_related": true, "response": "' . $escapedText . '", "is_knowledge_gap": false}';
        } else {
            $turnText = $turn['message_text'];
        }
        $conversationContents[] = [
            'role'  => $role,
            'parts' => [['text' => $turnText]]
        ];
    }

    // Add the current user message as the final turn
    $conversationContents[] = [
        'role'  => 'user',
        'parts' => [['text' => $rawMessage]]
    ];

    $geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" . $geminiApiKey; //My gemini api model

    $postData = [
        "contents"        => $conversationContents,
        "generationConfig" => [
            "responseMimeType" => "application/json"
        ]
    ];

    $ch = curl_init($geminiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    $apiResponse = curl_exec($ch);
    $curlError   = curl_error($ch);
    curl_close($ch);

    if ($apiResponse && empty($curlError)) {
        $resDecoded = json_decode($apiResponse, true);
        $parts = $resDecoded['candidates'][0]['content']['parts'] ?? [];
        $rawText = '';
        foreach ($parts as $p) {
            if (isset($p['text'])) {
                $rawText = $p['text'];
            }
        }

        // Clean any markdown formatting if present
        $rawText = preg_replace('/^```json\s*|\s*```$/i', '', trim($rawText));
        $aiParsed = json_decode($rawText, true);

        if (is_array($aiParsed) && isset($aiParsed['is_hiring_related'])) {
            $isHiring       = (bool)$aiParsed['is_hiring_related'];
            $aiRespText     = trim($aiParsed['response'] ?? '');
            $isKnowledgeGap = (bool)($aiParsed['is_knowledge_gap'] ?? false);

            if (!$isHiring) {
                // Out-of-domain query (e.g., Steve Jobs, weather, etc.) -> NO unanswered query logging!
                if ($validUserId && !$isAdminTest) {
                    saveChatHistory($pdo, $validUserId, $rawMessage, $aiRespText);
                }
                echo json_encode([
                    'status'   => 'ood',
                    'response' => $aiRespText,
                ]);
                exit;
            }

            // Genuine hiring query -> Log to unanswered_queries IF it's an HR knowledge gap
            if ($isKnowledgeGap && !$isAdminTest) {
                try {
                    $logStmt = $pdo->prepare("
                        INSERT INTO unanswered_queries (applicant_id, raw_question_text, status)
                        VALUES (:uid, :q, 'pending review')
                    ");
                    if ($validUserId !== null) {
                        $logStmt->bindValue(':uid', $validUserId, PDO::PARAM_INT);
                    } else {
                        $logStmt->bindValue(':uid', null, PDO::PARAM_NULL);
                    }
                    $logStmt->bindValue(':q', $rawMessage, PDO::PARAM_STR);
                    $logStmt->execute();
                } catch (PDOException $e) {
                    error_log('[Chatbot] Log unanswered error: ' . $e->getMessage());
                }
            }

            if ($validUserId && !$isAdminTest) {
                saveChatHistory($pdo, $validUserId, $rawMessage, $aiRespText);
            }

            echo json_encode([
                'status'   => 'ai_response',
                'response' => $aiRespText,
            ]);
            exit;
        }
    }
}

// ── Fallback if Gemini is unconfigured or unavailable ────────────────────────
$fallbackText = "I don't have the exact predefined answer to that right now. I've logged your question for our HR team to review and update the knowledge base soon!";

if (!$isAdminTest) {
    try {
        $logStmt = $pdo->prepare("
            INSERT INTO unanswered_queries (applicant_id, raw_question_text, status)
            VALUES (:uid, :q, 'pending review')
        ");
        if ($validUserId !== null) {
            $logStmt->bindValue(':uid', $validUserId, PDO::PARAM_INT);
        } else {
            $logStmt->bindValue(':uid', null, PDO::PARAM_NULL);
        }
        $logStmt->bindValue(':q', $rawMessage, PDO::PARAM_STR);
        $logStmt->execute();
    } catch (PDOException $e) {
        error_log('[Chatbot] Failed to log unanswered query: ' . $e->getMessage());
    }

    if ($validUserId) {
        saveChatHistory($pdo, $validUserId, $rawMessage, $fallbackText);
    }
}

echo json_encode([
    'status'   => 'fallback',
    'response' => $fallbackText,
]);
