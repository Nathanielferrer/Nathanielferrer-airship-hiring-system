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

        // 1. Guard: Check if the actor is Super Admin in database (is_admin = 3)
        if ($adminIdInt > 0) {
            $userCheck = $pdo->prepare("SELECT is_admin FROM user WHERE User_ID = ?");
            $userCheck->execute([$adminIdInt]);
            $role = $userCheck->fetchColumn();
            if ($role !== false && intval($role) === 3) {
                return true; // Skip recording Super Admin actions
            }
        } else {
            // 2. Fallback Guard: If ID is missing (0), only skip if name is EXACTLY the root Super Admin to avoid false positives on Admins
            if (trim(strtolower($adminNameStr)) === 'super admin' || trim(strtolower($adminNameStr)) === 'super admin root') {
                return true; // Skip recording Super Admin actions
            }
        }

        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        if (isset($_SERVER['HTTP_X_FORWARDED_FOR']) && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ip = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        }

        $detailsStr = is_array($details) ? json_encode($details, JSON_UNESCAPED_UNICODE) : (string)$details;

        $stmt = $pdo->prepare("
            INSERT INTO system_audit_logs (admin_id, admin_name, action_category, module, details, ip_address, created_at)
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
