<?php
require_once '../db.php';
header('Content-Type: application/json');

$body     = json_decode(file_get_contents('php://input'), true);
$id       = $body['id']               ?? null;
$question = trim($body['primary_question']  ?? '');
$answer   = trim($body['predefined_answer'] ?? '');
$tags     = trim($body['keyword_tags']      ?? '');

if (empty($question) || empty($answer)) {
    echo json_encode(['status' => 'error', 'message' => 'Question and answer are required']);
    exit;
}

// ── Utility: split comma-separated tags into trimmed, non-empty array ─────────
function splitTags(string $raw): array {
    return array_values(array_filter(
        array_map('trim', explode(',', $raw)),
        fn($t) => $t !== ''
    ));
}

// ── Utility: split answer into meaningful sentences or lines ─────────────────
function splitAnswer(string $text): array {
    $lines = preg_split('/\r\n|\r|\n/', $text);
    return array_values(array_filter(array_map('trim', $lines), fn($l) => $l !== ''));
}

try {
    require_once '../audit_helper.php';
    $actorId   = intval($body['actor_id']   ?? 0);
    $actorName = trim($body['actor_name']   ?? 'Admin');

    if ($id) {
        // ── UPDATE: Fetch previous data first for granular diff ───────────────
        $prevStmt = $pdo->prepare("SELECT primary_question, predefined_answer, keyword_tags FROM knowledge_base WHERE id = :id");
        $prevStmt->execute([':id' => (int)$id]);
        $prev = $prevStmt->fetch(PDO::FETCH_ASSOC);

        $stmt = $pdo->prepare("
            UPDATE knowledge_base
            SET primary_question = :q, predefined_answer = :a, keyword_tags = :t
            WHERE id = :id
        ");
        $stmt->execute([':q' => $question, ':a' => $answer, ':t' => $tags, ':id' => (int)$id]);

        // Build granular change sentences
        $changeLines = [];

        // 1. Question changed
        if ($prev && $prev['primary_question'] !== $question) {
            $changeLines[] = "Changed question from \"{$prev['primary_question']}\" to \"{$question}\".";
        }

        // 2. Answer — line-by-line diff
        if ($prev && $prev['predefined_answer'] !== $answer) {
            $oldAnswerLines = splitAnswer($prev['predefined_answer']);
            $newAnswerLines = splitAnswer($answer);
            $addedLines     = array_diff($newAnswerLines, $oldAnswerLines);
            $removedLines   = array_diff($oldAnswerLines, $newAnswerLines);

            if (!empty($addedLines) && !empty($removedLines) && count($addedLines) === count($removedLines)) {
                // Pair as modifications
                $addArr = array_values($addedLines);
                $remArr = array_values($removedLines);
                for ($i = 0; $i < count($addArr); $i++) {
                    $changeLines[] = "Modified answer line from \"{$remArr[$i]}\" to \"{$addArr[$i]}\".";
                }
            } else {
                foreach ($removedLines as $line) {
                    $changeLines[] = "Removed answer line: \"{$line}\".";
                }
                foreach ($addedLines as $line) {
                    $changeLines[] = "Added answer line: \"{$line}\".";
                }
                // If same lines exist but no distinct diff (reformat), note it
                if (empty($addedLines) && empty($removedLines)) {
                    $changeLines[] = "Answer content was reformatted or whitespace changed.";
                }
            }
        }

        // 3. Tags — tag-by-tag diff
        if ($prev && $prev['keyword_tags'] !== $tags) {
            $oldTags = splitTags($prev['keyword_tags']);
            $newTags = splitTags($tags);
            $addedTags   = array_diff($newTags, $oldTags);
            $removedTags = array_diff($oldTags, $newTags);

            foreach ($removedTags as $tag) {
                $changeLines[] = "Removed keyword tag: \"{$tag}\".";
            }
            foreach ($addedTags as $tag) {
                $changeLines[] = "Added keyword tag: \"{$tag}\".";
            }
        }

        if (empty($changeLines)) {
            $changeLines[] = "No detectable field changes.";
        }

        $auditDetails = "Updated Chatbot KB entry (Q: \"{$question}\"): " . implode(' ', $changeLines);

        log_system_audit(
            $pdo,
            $actorId,
            $actorName,
            'Knowledge Base Update',
            'Chatbot KB',
            $auditDetails,
            'Info'
        );

        echo json_encode(['status' => 'success', 'id' => (int)$id]);

    } else {
        // ── CREATE: Detailed creation log ────────────────────────────────────
        $stmt = $pdo->prepare("
            INSERT INTO knowledge_base (primary_question, predefined_answer, keyword_tags)
            VALUES (:q, :a, :t)
        ");
        $stmt->execute([':q' => $question, ':a' => $answer, ':t' => $tags]);
        $newId = (int)$pdo->lastInsertId();

        $tagList = !empty($tags) ? "Tags: \"{$tags}\"." : "No tags added.";
        $answerSnippet = mb_strlen($answer) > 80 ? mb_substr($answer, 0, 80) . '…' : $answer;

        log_system_audit(
            $pdo,
            $actorId,
            $actorName,
            'Knowledge Base Creation',
            'Chatbot KB',
            "Added new Chatbot KB entry: Q=\"{$question}\" | Answer=\"{$answerSnippet}\" | {$tagList}",
            'Info'
        );

        echo json_encode(['status' => 'success', 'id' => $newId]);
    }
} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
