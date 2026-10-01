<?php
/**
 * Standalone RFC 6238 TOTP (Time-Based One-Time Password) Implementation
 * Zero external dependencies. Compatible with Google Authenticator, Microsoft Authenticator, and Authy.
 */
class TOTP {
    private static string $base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    /**
     * Generate a cryptographically secure Base32 secret key.
     * Default length: 16 characters (80 bits) or 32 characters (160 bits).
     */
    public static function generateSecret(int $length = 16): string {
        $secret = '';
        $maxIndex = strlen(self::$base32Chars) - 1;
        for ($i = 0; $i < $length; $i++) {
            $secret .= self::$base32Chars[random_int(0, $maxIndex)];
        }
        return $secret;
    }

    /**
     * Decode a Base32 string into binary bytes.
     */
    public static function base32Decode(string $secret): string {
        $clean = strtoupper(trim(str_replace('=', '', $secret)));
        $buffer = 0;
        $bitsLeft = 0;
        $binary = '';

        for ($i = 0; $i < strlen($clean); $i++) {
            $char = $clean[$i];
            $val = strpos(self::$base32Chars, $char);
            if ($val === false) {
                continue; // Skip invalid or padding characters
            }

            $buffer = ($buffer << 5) | $val;
            $bitsLeft += 5;

            if ($bitsLeft >= 8) {
                $bitsLeft -= 8;
                $binary .= chr(($buffer >> $bitsLeft) & 0xFF);
            }
        }

        return $binary;
    }

    /**
     * Encode binary string into Base32 string.
     */
    public static function base32Encode(string $binary): string {
        $buffer = 0;
        $bitsLeft = 0;
        $output = '';

        for ($i = 0; $i < strlen($binary); $i++) {
            $buffer = ($buffer << 8) | ord($binary[$i]);
            $bitsLeft += 8;

            while ($bitsLeft >= 5) {
                $bitsLeft -= 5;
                $output .= self::$base32Chars[($buffer >> $bitsLeft) & 0x1F];
            }
        }

        if ($bitsLeft > 0) {
            $output .= self::$base32Chars[($buffer << (5 - $bitsLeft)) & 0x1F];
        }

        return $output;
    }

    /**
     * Calculate 6-digit TOTP code for a secret and time slice.
     * Default period: 30 seconds.
     */
    public static function getCode(string $secret, ?int $timeSlice = null): string {
        if ($timeSlice === null) {
            $timeSlice = (int)floor(time() / 30);
        }

        $secretKey = self::base32Decode($secret);

        // Pack 64-bit counter (big-endian)
        $time = chr(0) . chr(0) . chr(0) . chr(0) . pack('N*', $timeSlice);

        // Compute HMAC-SHA1
        $hmac = hash_hmac('sha1', $time, $secretKey, true);

        // Dynamic truncation (RFC 4226)
        $offset = ord(substr($hmac, -1)) & 0x0F;
        $hashPart = substr($hmac, $offset, 4);
        $value = unpack('N', $hashPart)[1] & 0x7FFFFFFF;

        return str_pad((string)($value % 1000000), 6, '0', STR_PAD_LEFT);
    }

    /**
     * Verify a 6-digit code against a secret with allowed time drift.
     * $discrepancy = 1 checks current window, 1 before (30s ago), and 1 after (30s future).
     */
    public static function verifyCode(string $secret, string $code, int $discrepancy = 1): bool {
        $cleanCode = preg_replace('/\s+/', '', trim($code));
        if (strlen($cleanCode) !== 6 || !ctype_digit($cleanCode)) {
            return false;
        }

        $currentTimeSlice = (int)floor(time() / 30);

        for ($i = -$discrepancy; $i <= $discrepancy; $i++) {
            $calculatedCode = self::getCode($secret, $currentTimeSlice + $i);
            if (hash_equals($calculatedCode, $cleanCode)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Generate standard otpauth URI for QR codes.
     */
    public static function getOtpAuthUri(string $secret, string $accountName = 'Super Admin', string $issuer = 'Airship Express'): string {
        $encodedIssuer  = rawurlencode($issuer);
        $encodedAccount = rawurlencode($accountName);
        return "otpauth://totp/{$encodedIssuer}:{$encodedAccount}?secret={$secret}&issuer={$encodedIssuer}&algorithm=SHA1&digits=6&period=30";
    }

    /**
     * Generate 8 single-use emergency backup recovery codes.
     * Returns both plaintext (to show user once) and hashed (to store in DB).
     */
    public static function generateBackupCodes(int $count = 8): array {
        $plain = [];
        $hashed = [];

        for ($i = 0; $i < $count; $i++) {
            $part1 = strtoupper(bin2hex(random_bytes(2)));
            $part2 = strtoupper(bin2hex(random_bytes(2)));
            $code  = "{$part1}-{$part2}";
            $plain[]  = $code;
            $hashed[] = password_hash($code, PASSWORD_BCRYPT);
        }

        return [
            'plain'  => $plain,
            'hashed' => $hashed
        ];
    }

    /**
     * Verify and consume a backup code.
     * If valid, removes the matching hash from the list and returns true.
     */
    public static function verifyAndConsumeBackupCode(string $inputCode, ?string &$storedHashedCodesJson): bool {
        $input = strtoupper(trim($inputCode));
        if (empty($input) || empty($storedHashedCodesJson)) {
            return false;
        }

        $hashedList = json_decode($storedHashedCodesJson, true);
        if (!is_array($hashedList) || empty($hashedList)) {
            return false;
        }

        foreach ($hashedList as $idx => $hash) {
            if (password_verify($input, $hash)) {
                // Remove the used code
                array_splice($hashedList, $idx, 1);
                $storedHashedCodesJson = json_encode(array_values($hashedList));
                return true;
            }
        }

        return false;
    }
}
?>
