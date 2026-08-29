<?php
$columnsData = json_decode(file_get_contents(__DIR__ . '/columns.json'), true);

$unusedColumns = [];
$unusedTables = [];
$tables = array_unique(array_column($columnsData, 'table'));

// Recursively find all files in frontend/src and backend (excluding specific files)
$files = [];
$dirs = [__DIR__ . '/../frontend/src', __DIR__];

foreach ($dirs as $dir) {
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
    foreach ($iterator as $file) {
        if ($file->isFile()) {
            $path = str_replace('\\', '/', $file->getPathname());
            
            // Exclusions
            if (
                strpos($path, '/db.php') !== false ||
                strpos($path, '/dump_') !== false ||
                strpos($path, '/columns.json') !== false ||
                strpos($path, '/inspect_') !== false ||
                strpos($path, '/find_unused.php') !== false ||
                strpos($path, '.txt') !== false ||
                strpos($path, '/scratch/') !== false ||
                strpos($path, '.json') !== false ||
                strpos($path, '.css') !== false ||
                strpos($path, '.md') !== false
            ) {
                continue;
            }
            $files[] = $path;
        }
    }
}

// Load all file contents into memory to make search very fast
$fileContents = [];
foreach ($files as $file) {
    $fileContents[$file] = file_get_contents($file);
}

function findOccurrences($term) {
    global $fileContents;
    $count = 0;
    // Word boundary regex
    $pattern = '/\b' . preg_quote($term, '/') . '\b/i';
    
    foreach ($fileContents as $file => $content) {
        $count += preg_match_all($pattern, $content);
    }
    return $count;
}

echo "Scanning tables...\n";
foreach ($tables as $table) {
    $count = findOccurrences($table);
    if ($count == 0) {
        $unusedTables[] = $table;
        echo "Unused Table: $table\n";
    }
}

echo "Scanning columns...\n";
foreach ($columnsData as $col) {
    $tableName = $col['table'];
    if (in_array($tableName, $unusedTables)) {
        continue; // skip columns for unused tables
    }
    
    $colName = $col['column'];
    
    // Check if column is an ID or generic like status, created_at, updated_at
    if (in_array($colName, ['id', 'status', 'created_at', 'updated_at', 'location', 'type', 'link'])) {
        // We shouldn't flag highly generic names automatically unless we search contextually. We'll check anyway.
    }
    
    $count = findOccurrences($colName);
    if ($count == 0) {
        $unusedColumns[] = "{$tableName}.{$colName}";
        echo "Unused Column: {$tableName}.{$colName}\n";
    }
}

file_put_contents(__DIR__ . '/unused.json', json_encode([
    'tables' => $unusedTables,
    'columns' => $unusedColumns
], JSON_PRETTY_PRINT));

echo "Done scanning.\n";
