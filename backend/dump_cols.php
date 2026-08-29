<?php
require_once __DIR__ . '/db.php';

$tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
$allColumns = [];

foreach ($tables as $table) {
    $columns = $pdo->query("DESCRIBE `$table`")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($columns as $col) {
        $allColumns[] = ['table' => $table, 'column' => $col];
    }
}

// Write to a temporary JSON file to be processed by a node script or powershell
file_put_contents(__DIR__ . '/columns.json', json_encode($allColumns, JSON_PRETTY_PRINT));
echo "Columns dumped.\n";
