<?php
// ── JWT Helper — Pure PHP HMAC SHA-256 Implementation ─────────────────────────
// No Composer or external libraries required.
// Provides generateJWT() and verifyJWT() functions used across all auth endpoints.

require_once __DIR__ . '/../config.php';

/**
 * Base64Url encoding (JWT-safe variant of Base64)
 */
function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

/**
 * Base64Url decoding
 */
function base64url_decode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
}

/**
 * Generate a signed JWT token.
 *
 * @param array $payload  The claims to encode (sub, email, is_admin, etc.)
 * @return string         Signed JWT string: header.payload.signature
 */
function generateJWT(array $payload): string {
    // Standard header
    $header = base64url_encode(json_encode([
        'alg' => 'HS256',
        'typ' => 'JWT',
    ]));

    // Merge standard claims with provided payload
    $now = time();
    $payload = array_merge([
        'iss' => 'airship-express-hiring',  // Issuer
        'iat' => $now,                       // Issued at
        'exp' => $now + JWT_EXPIRY_SECONDS,  // Expiration (24 hours)
    ], $payload);

    $encodedPayload = base64url_encode(json_encode($payload));

    // Create HMAC SHA-256 signature using the secret key
    $signature = base64url_encode(
        hash_hmac('sha256', "$header.$encodedPayload", JWT_SECRET, true)
    );

    return "$header.$encodedPayload.$signature";
}

/**
 * Verify and decode a JWT token.
 *
 * @param string $token   The JWT string to verify
 * @return array|false    Decoded payload array on success, false on failure
 */
function verifyJWT(string $token) {
    $parts = explode('.', $token);

    // A valid JWT must have exactly 3 parts
    if (count($parts) !== 3) {
        return false;
    }

    [$header, $payload, $signature] = $parts;

    // Recompute the expected signature using our secret key
    $expectedSignature = base64url_encode(
        hash_hmac('sha256', "$header.$payload", JWT_SECRET, true)
    );

    // Timing-safe comparison to prevent timing attacks on signature validation
    if (!hash_equals($expectedSignature, $signature)) {
        return false; // Signature mismatch — token was tampered with
    }

    // Decode the payload
    $decodedPayload = json_decode(base64url_decode($payload), true);

    if (!$decodedPayload || !isset($decodedPayload['exp'])) {
        return false;
    }

    // Check token expiry
    if ($decodedPayload['exp'] < time()) {
        return false; // Token has expired
    }

    return $decodedPayload;
}
