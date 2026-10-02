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
    // 1. Explicit FRONTEND_URL in environment (check getenv, $_ENV, and $_SERVER)
    $url = getenv('FRONTEND_URL') ?: ($_ENV['FRONTEND_URL'] ?? ($_SERVER['FRONTEND_URL'] ?? ''));
    if ($url && is_string($url) && !str_contains($url, 'localhost') && !str_contains($url, '127.0.0.1')) {
        return rtrim($url, '/');
    }

    // 2. Live HTTP Origin header (e.g. when an admin or candidate triggers actions via the subdomain in browser)
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? trim($_SERVER['HTTP_ORIGIN']) : '';
    if (!empty($origin) && !str_contains($origin, 'localhost') && !str_contains($origin, '127.0.0.1')) {
        return rtrim($origin, '/');
    }

    // 3. Live HTTP Referer header
    if (!empty($_SERVER['HTTP_REFERER'])) {
        $parsed = parse_url($_SERVER['HTTP_REFERER']);
        if (!empty($parsed['scheme']) && !empty($parsed['host']) && !str_contains($parsed['host'], 'localhost') && !str_contains($parsed['host'], '127.0.0.1')) {
            $refPort = (!empty($parsed['port']) && !in_array($parsed['port'], [80, 443])) ? ':' . $parsed['port'] : '';
            return rtrim($parsed['scheme'] . '://' . $parsed['host'] . $refPort, '/');
        }
    }

    // 4. ALLOWED_ORIGINS list (if FRONTEND_URL was not set, take first live allowed subdomain)
    $envAllowed = getenv('ALLOWED_ORIGINS') ?: ($_ENV['ALLOWED_ORIGINS'] ?? ($_SERVER['ALLOWED_ORIGINS'] ?? ''));
    if ($envAllowed && is_string($envAllowed)) {
        $origins = array_filter(array_map('trim', explode(',', $envAllowed)));
        foreach ($origins as $candidate) {
            if (!empty($candidate) && !str_contains($candidate, 'localhost') && !str_contains($candidate, '127.0.0.1')) {
                if (!preg_match('~^https?://~i', $candidate)) {
                    $candidate = 'https://' . $candidate;
                }
                return rtrim($candidate, '/');
            }
        }
    }

    // 5. Fallback to explicit FRONTEND_URL if set (even for localhost dev)
    if ($url && is_string($url)) {
        return rtrim($url, '/');
    }

    return 'http://localhost:5173';
}

// Returns the backend API URL (e.g., https://api-hiring.yourdomain.com or http://localhost/Hiring%20System/backend)
function get_backend_url(): string {
    $url = getenv('BACKEND_URL') ?: ($_ENV['BACKEND_URL'] ?? ($_SERVER['BACKEND_URL'] ?? ''));
    if ($url && is_string($url)) {
        return rtrim($url, '/');
    }

    // If running in production with live host header
    if (!empty($_SERVER['HTTP_HOST']) && !str_contains($_SERVER['HTTP_HOST'], 'localhost') && !str_contains($_SERVER['HTTP_HOST'], '127.0.0.1')) {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        return rtrim($scheme . '://' . $_SERVER['HTTP_HOST'], '/');
    }

    return 'http://localhost/Hiring%20System/backend';
}
