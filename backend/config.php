<?php

// THIS IS MY API KEY GEMINI 
define('GEMINI_API_KEY', 'AQ.Ab8RN6IgVRsyucDj3gdb4PH0jYEDesmPB5aiIK9miBoSW3tOzQ');
define('GEMINI_MODEL', 'gemini-3.5-flash-lite');

// Secret key used to sign and verify all JWT tokens (HMAC SHA-256)
// SECURITY: Keep this private. Never expose this to the frontend or public repos.
define('JWT_SECRET', 'airship_express_jwt_secret_2026_!@#$%^&*_SECURE_KEY');

// Token validity duration: 24 hours (in seconds)
define('JWT_EXPIRY_SECONDS', 86400);

