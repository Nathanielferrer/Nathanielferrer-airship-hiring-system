// ── Centralized API Base URL Configuration ──────────────────────────────────
// In development:  Falls back to http://localhost/Hiring%20System/backend
// In production:   Set VITE_API_BASE_URL in Railway environment variables
//                  e.g. https://api-hiring.yourdomain.com
//
// Usage: import { API_BASE_URL } from '../utils/apiConfig';
//        fetch(`${API_BASE_URL}/auth/login.php`, { ... })

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost/Hiring%20System/backend'
).replace(/\/+$/, ''); // Strip trailing slash for consistent concatenation
