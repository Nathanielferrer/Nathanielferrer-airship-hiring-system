import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import Verify from './pages/Auth/Verify';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import AdminSetupPassword from './pages/Auth/AdminSetupPassword';
import ApplicantDashboard from './pages/ApplicantDashboard/ApplicantDashboard';
import ApplicationStatus from './pages/ApplicationStatus/ApplicationStatus';
import AdminDashboard from './pages/AdminDashboard/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard/SuperAdminDashboard';
import Vacancy from './pages/Vacancy/Vacancy';
import About from './pages/About/About';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin-setup-password" element={<AdminSetupPassword />} />
          <Route path="/vacancy" element={<Vacancy />} />
          <Route path="/about" element={<About />} />

          {/* Protected Routes */}
          <Route path="/applicant-dashboard" element={<ApplicantDashboard />} />
          <Route path="/application-status" element={<ApplicationStatus />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/super-admin-dashboard" element={<SuperAdminDashboard />} />

          {/* Catch-all redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
