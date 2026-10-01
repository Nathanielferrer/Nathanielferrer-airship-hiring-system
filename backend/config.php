<?php
// ── LOAD ENVIRONMENT SECRETS ──────────────────────────────────────────────────
// Secrets are stored in backend/.env (excluded from version control).
// env_loader.php populates getenv()/$_ENV with the values.
require_once __DIR__ . '/env_loader.php';

// ── GEMINI AI MULTI-KEY & MODEL FAILOVER CONFIGURATION ────────────────────────
// Keys are strictly loaded from environment variables (backend/.env or Railway).
$envGeminiKeys = getenv('GEMINI_API_KEYS');
if ($envGeminiKeys && is_string($envGeminiKeys)) {
    define('GEMINI_API_KEYS', array_values(array_filter(array_map('trim', explode(',', $envGeminiKeys)))));
} else {
    define('GEMINI_API_KEYS', []);
}

// Backward compatibility with single-key references
define('GEMINI_API_KEY', GEMINI_API_KEYS[0] ?? '');

// LIST OF FALLBACK MODELS (in priority order)
// Verified working 200 OK on current Google AI Studio API: gemini-3.5-flash-lite
define('GEMINI_MODELS', [
    'gemini-3.5-flash-lite', // Primary model (fast, stable, verified 200 OK)
    'gemini-2.5-flash',
    'gemini-2.0-flash'
]);

// Backward compatibility with single-model references
define('GEMINI_MODEL', GEMINI_MODELS[0] ?? 'gemini-3.5-flash-lite');

// Secret key used to sign and verify all JWT tokens (HMAC SHA-256)
// SECURITY: Loaded from .env; fallback to hardcoded value during migration.
$envJwtSecret = getenv('JWT_SECRET');
define('JWT_SECRET', ($envJwtSecret && is_string($envJwtSecret)) ? $envJwtSecret : 'airship_express_jwt_secret_2026_!@#$%^&*_SECURE_KEY');

// Token validity duration: 24 hours (in seconds)
$envJwtExpiry = getenv('JWT_EXPIRY_SECONDS');
define('JWT_EXPIRY_SECONDS', ($envJwtExpiry && is_numeric($envJwtExpiry)) ? (int)$envJwtExpiry : 86400);
