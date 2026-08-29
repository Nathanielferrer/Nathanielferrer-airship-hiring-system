<?php
require_once __DIR__ . '/db.php';

try {
    // 1. Add the column
    $pdo->exec("ALTER TABLE interviews_tbl ADD COLUMN IF NOT EXISTS event_type VARCHAR(50) NOT NULL DEFAULT 'interview' AFTER interview_id;");
    echo "Added event_type column.\n";

    // 2. Migrate existing data
    $stmt = $pdo->query("SELECT interview_id, requirements FROM interviews_tbl WHERE requirements LIKE '%CONTRACT_SIGNING%'");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $updateStmt = $pdo->prepare("UPDATE interviews_tbl SET event_type = 'contract_signing', requirements = :req WHERE interview_id = :id");

    foreach ($rows as $row) {
        $reqs = $row['requirements'];
        $notes = '';
        
        $decoded = json_decode($reqs, true);
        if (json_last_error() === JSON_ERROR_NONE && isset($decoded['notes'])) {
            $notes = $decoded['notes'];
        } else {
            $notes = "Contract signing and formal onboarding orientation.";
        }

        $updateStmt->execute([
            ':req' => $notes,
            ':id' => $row['interview_id']
        ]);
        echo "Migrated interview ID: {$row['interview_id']}\n";
    }

    echo "Migration complete.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
