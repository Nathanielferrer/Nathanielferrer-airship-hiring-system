<?php
// ── Lightweight Environment Variable Loader ──────────────────────────────────
// Reads key=value pairs from a .env file and populates putenv(), $_ENV, and $_SERVER.
// Zero external dependencies (no Composer packages required).
// 
// Usage: Include this file early in db.php or config.php.
//        Secrets are loaded from backend/.env (which MUST be excluded from version control).

function load_env(?string $path = null): void {
    if ($path === null) {
        $path = __DIR__ . '/.env';
    }
    if (!file_exists($path)) {
        return; // Silently skip if .env is missing (fallback to hardcoded defaults)
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        // Skip empty lines and comments
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if (str_contains($line, '=')) {
            [$key, $val] = explode('=', $line, 2);
            $key = trim($key);
            $val = trim($val);
            // Don't override existing environment variables (system env takes priority)
            if (!array_key_exists($key, $_ENV)) {
                putenv("$key=$val");
                $_ENV[$key] = $val;
                $_SERVER[$key] = $val;
            }
        }
    }
}

// Auto-load on include
load_env();

// ── URL Helper Functions ─────────────────────────────────────────────────────
// Returns the frontend app URL (e.g., https://hiring.yourdomain.com or http://localhost:5173)
function get_frontend_url(): string {
    $url = getenv('FRONTEND_URL');
    return ($url && is_string($url)) ? rtrim($url, '/') : 'http://localhost:5173';
}

// Returns the backend API URL (e.g., https://api-hiring.yourdomain.com or http://localhost/Hiring%20System/backend)
function get_backend_url(): string {
    $url = getenv('BACKEND_URL');
    return ($url && is_string($url)) ? rtrim($url, '/') : 'http://localhost/Hiring%20System/backend';
}
