<?php
/**
 * Shared System Audit Helper
 * Enforces strict audit logging ONLY for Admin actions.
 * Super Admin actions are NEVER recorded in the system audit trail.
 */
function log_system_audit($pdo, $admin_id, $admin_name, $category, $module, $details, $severity = null) {
    try {
        $adminIdInt = intval($admin_id);
        $adminNameStr = trim($admin_name ?: '');

        // 1. Guard: Skip if ID is missing (0) or if actor name represents Super Admin or System
        if ($adminIdInt <= 0 || stripos($adminNameStr, 'super admin') !== false || strtolower($adminNameStr) === 'system') {
            return true; // Skip: Audit trail strictly tracks regular Admin actions for non-repudiation
        }

        // 2. Guard: Check actor role in database — strictly track ONLY Admin (is_admin = 1)
        $userCheck = $pdo->prepare("SELECT is_admin, User_Fname, User_Lname FROM users_tbl WHERE user_id = ?");
        $userCheck->execute([$adminIdInt]);
        $u = $userCheck->fetch(PDO::FETCH_ASSOC);

        if (!$u || intval($u['is_admin']) !== 1) {
            return true; // Skip Super Admin (3), Applicants (0), and unverified users
        }

        // Resolve canonical admin name if empty or generic
        if (empty($adminNameStr) || strtolower($adminNameStr) === 'admin') {
            $resolved = trim(($u['User_Fname'] ?? '') . ' ' . ($u['User_Lname'] ?? ''));
            $adminNameStr = $resolved ?: 'Admin';
        }

        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        if (isset($_SERVER['HTTP_X_FORWARDED_FOR']) && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ip = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        }

        $detailsStr = is_array($details) ? json_encode($details, JSON_UNESCAPED_UNICODE) : (string)$details;

        $stmt = $pdo->prepare("
            INSERT INTO system_audit_logs_tbl (admin_id, admin_name, action_category, module, details, ip_address, created_at)
            VALUES (:admin_id, :admin_name, :category, :module, :details, :ip_address, NOW())
        ");
        $stmt->execute([
            'admin_id' => $adminIdInt,
            'admin_name' => $adminNameStr ?: 'Admin',
            'category' => trim($category),
            'module' => trim($module),
            'details' => $detailsStr,
            'ip_address' => $ip
        ]);
        return true;
    } catch (Throwable $e) {
        error_log("Failed to insert system audit log: " . $e->getMessage());
        return false;
    }
}
?>
