import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import Verify from './pages/Auth/Verify';
import VerifyEmailChange from './pages/Auth/VerifyEmailChange';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import AdminSetupPassword from './pages/Auth/AdminSetupPassword';
import ApplicantDashboard from './pages/ApplicantDashboard/ApplicantDashboard';
import ApplicationStatus from './pages/ApplicationStatus/ApplicationStatus';
import AdminDashboard from './pages/AdminDashboard/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard/SuperAdminDashboard';
import Vacancy from './pages/Vacancy/Vacancy';
import About from './pages/About/About';
import Settings from './pages/Settings/Settings';
import ChatbotWidget from './components/ChatbotWidget/ChatbotWidget';
import './App.css';

const APPLICANT_CHATBOT_ROUTES = [
  '/',
  '/applicant-dashboard',
  '/vacancy',
  '/about',
  '/application-status',
  '/settings',
];

function AppContent() {
  const location = useLocation();
  const normalizedPath = location.pathname.replace(/\/$/, '') || '/';
  const showChatbot = APPLICANT_CHATBOT_ROUTES.includes(normalizedPath);

  return (
    <div className="app-container">
      <Routes>
        {/* Public / Landing Routes */}
        <Route path="/" element={<ApplicantDashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/verify-email-change" element={<VerifyEmailChange />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/admin-setup-password" element={<AdminSetupPassword />} />
        <Route path="/vacancy" element={<Vacancy />} />
        <Route path="/about" element={<About />} />

        {/* Applicant & Admin Routes */}
        <Route path="/applicant-dashboard" element={<ApplicantDashboard />} />
        <Route path="/application-status" element={<ApplicationStatus />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/super-admin-dashboard" element={<SuperAdminDashboard />} />

        {/* Catch-all redirect to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showChatbot && <ChatbotWidget />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
