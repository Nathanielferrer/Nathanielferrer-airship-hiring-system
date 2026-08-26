<?php
require_once '../db.php';
header('Content-Type: application/json');

try {
    $stmt    = $pdo->query("SELECT * FROM knowledge_base ORDER BY created_at DESC");
    $entries = $stmt->fetchAll();
    echo json_encode(['status' => 'success', 'entries' => $entries]);
} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
