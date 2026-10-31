import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../pages/Auth/Login';
import Register from '../pages/Auth/Register';
import ForgotPassword from '../pages/Auth/ForgotPassword';
import ResetPassword from '../pages/Auth/ResetPassword';

// Helper to render with Router
const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('Redesigned Auth Pages - UI & Functional Requirements', () => {
  describe('Login Page', () => {
    it('renders shared split-screen branding at top-left, promotional copy, explore opportunities link, and feature badges without arrows', () => {
      const { container } = renderWithRouter(<Login />);

      // Top-Left Official Branding in Left Panel
      expect(screen.getByText('AIRSHIP')).toBeInTheDocument();
      expect(screen.getByText('EXPRESS')).toBeInTheDocument();
      expect(screen.getByText('HIRING SYSTEM')).toBeInTheDocument();

      // Ensure arrow watermark is removed
      expect(container.querySelector('.auth-promo-watermark')).not.toBeInTheDocument();

      // Heading & Description
      expect(screen.getByText(/Your Next Career/i)).toBeInTheDocument();
      expect(screen.getByText(/Starts Here\./i)).toBeInTheDocument();
      expect(screen.getByText(/Discover exciting career opportunities/i)).toBeInTheDocument();

      // Explore Opportunities Link pointing to /vacancy
      const exploreLink = screen.getByRole('link', { name: /Explore Opportunities/i });
      expect(exploreLink).toBeInTheDocument();
      expect(exploreLink).toHaveAttribute('href', '/vacancy');

      // Three features
      expect(screen.getByText('Real Opportunities')).toBeInTheDocument();
      expect(screen.getByText('Find the right role for you.')).toBeInTheDocument();
      expect(screen.getByText('Easy Tracking')).toBeInTheDocument();
      expect(screen.getByText('Stay updated, always.')).toBeInTheDocument();
      expect(screen.getByText('Build Your Future')).toBeInTheDocument();
      expect(screen.getByText('Grow with Airship Express.')).toBeInTheDocument();

      // Form Header
      expect(screen.getByText('Welcome Back!')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Sign in to your account to manage your applications and stay updated on your hiring progress.'
        )
      ).toBeInTheDocument();

      // Form Fields
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
      expect(screen.getByText('Forgot Password?')).toBeInTheDocument();

      // Buttons & Navigation
      expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
      expect(screen.getByText(/Don't have an account\?/i)).toBeInTheDocument();
      expect(screen.getByText(/Create an Account/i)).toBeInTheDocument();

      // Disallowed elements
      expect(screen.queryByText(/Sign in with GitHub/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Need help\?/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Contact Us/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Terms of Service/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Privacy Policy/i)).not.toBeInTheDocument();
    });

    it('displays proper validation error message when submitting empty credentials', () => {
      renderWithRouter(<Login />);
      const submitBtn = screen.getByRole('button', { name: /Sign In/i });

      // Click sign-in with no inputs
      fireEvent.click(submitBtn);

      expect(screen.getByText('Please enter your email address and password.')).toBeInTheDocument();

      // Fill in password only
      const passInput = screen.getByLabelText(/^Password/i);
      fireEvent.change(passInput, { target: { value: 'password123' } });
      fireEvent.click(submitBtn);

      expect(screen.getByText('Please enter your email address.')).toBeInTheDocument();

      // Fill in invalid email format
      const emailInput = screen.getByLabelText(/Email Address/i);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.click(submitBtn);

      expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();

      // Fill in valid email and empty password
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.change(passInput, { target: { value: '' } });
      fireEvent.click(submitBtn);

      expect(screen.getByText('Please enter your password.')).toBeInTheDocument();
    });

    it('toggles password visibility when the eye button is clicked', () => {
      renderWithRouter(<Login />);
      const passInput = screen.getByLabelText(/^Password/i);
      const toggleBtn = screen.getByLabelText(/password/i, { selector: 'button' });

      expect(passInput).toHaveAttribute('type', 'password');
      fireEvent.click(toggleBtn);
      expect(passInput).toHaveAttribute('type', 'text');
      fireEvent.click(toggleBtn);
      expect(passInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Register Page', () => {
    it('preserves all required fields, explore link, and dynamic password checklist', () => {
      renderWithRouter(<Register />);

      // Left branding preserved
      expect(screen.getByText(/Your Next Career/i)).toBeInTheDocument();
      expect(screen.getByText('Real Opportunities')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Explore Opportunities/i })).toHaveAttribute('href', '/vacancy');

      // Right form title & description
      expect(screen.getByText('Create Your Account')).toBeInTheDocument();
      expect(screen.getByText('Join our team. Build your future today!')).toBeInTheDocument();

      // Row 1 - Personal info fields
      expect(screen.getByPlaceholderText('First Name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('M')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Last Name')).toBeInTheDocument();

      // Row 2 - Email
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();

      // Row 3 - Personal details
      expect(screen.getByLabelText(/Date of Birth/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Gender/i)).toBeInTheDocument();

      // Row 4 - Password with 4-item criteria
      expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
      expect(screen.getByText('8–64 Characters')).toBeInTheDocument();
      expect(screen.getByText('Uppercase (A–Z)')).toBeInTheDocument();
      expect(screen.getByText('Lowercase (a–z)')).toBeInTheDocument();
      expect(screen.getByText('Number & Special')).toBeInTheDocument();

      // Row 5 - Confirm Password
      expect(screen.getByPlaceholderText('Confirm your password')).toBeInTheDocument();

      // Action button and link to sign in
      expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
      expect(screen.getByText(/Already have an account\?/i)).toBeInTheDocument();
      expect(screen.getByText(/Sign In/i)).toBeInTheDocument();

      // Removed links check
      expect(screen.queryByText(/Need help\?/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Terms of Service/i)).not.toBeInTheDocument();
    });

    it('dynamically marks password requirements as satisfied when typing valid password', () => {
      renderWithRouter(<Register />);
      const passInput = screen.getByPlaceholderText('Enter your password');

      // Initially unmet
      expect(screen.getByText('8–64 Characters').closest('.auth-req-item')).not.toHaveClass('is-met');

      // Type valid strong password
      fireEvent.change(passInput, { target: { value: 'Secret123!' } });

      expect(screen.getByText('8–64 Characters').closest('.auth-req-item')).toHaveClass('is-met');
      expect(screen.getByText('Uppercase (A–Z)').closest('.auth-req-item')).toHaveClass('is-met');
      expect(screen.getByText('Lowercase (a–z)').closest('.auth-req-item')).toHaveClass('is-met');
      expect(screen.getByText('Number & Special').closest('.auth-req-item')).toHaveClass('is-met');
    });

    it('shows password matching feedback', () => {
      renderWithRouter(<Register />);
      const passInput = screen.getByPlaceholderText('Enter your password');
      const confirmInput = screen.getByPlaceholderText('Confirm your password');

      fireEvent.change(passInput, { target: { value: 'Secret123!' } });
      fireEvent.change(confirmInput, { target: { value: 'Secret999!' } });

      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();

      fireEvent.change(confirmInput, { target: { value: 'Secret123!' } });
      expect(screen.getByText('Passwords match')).toBeInTheDocument();
    });
  });

  describe('Forgot Password Page', () => {
    it('renders clean minimal split-screen interface with email field and action button', () => {
      renderWithRouter(<ForgotPassword />);

      // Split screen branding preserved
      expect(screen.getByText(/Your Next Career/i)).toBeInTheDocument();

      // Right Section
      expect(screen.getByText('Forgot Your Password?')).toBeInTheDocument();
      expect(
        screen.getByText(
          /Enter your registered applicant email address and we'll send you a password reset link\./i
        )
      ).toBeInTheDocument();

      expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send Recovery Link/i })).toBeInTheDocument();

      // Navigation back to Sign In
      expect(screen.getByText(/Remember your password\?/i)).toBeInTheDocument();
      expect(screen.getByText(/Sign In/i)).toBeInTheDocument();

      // Removed links check
      expect(screen.queryByText(/Need help\?/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Terms of Service/i)).not.toBeInTheDocument();
    });

    it('validates empty email on submission', () => {
      renderWithRouter(<ForgotPassword />);
      const sendBtn = screen.getByRole('button', { name: /Send Recovery Link/i });

      fireEvent.click(sendBtn);
      expect(screen.getByText('Please enter your email address.')).toBeInTheDocument();
    });
  });

  describe('Reset Password Page', () => {
    it('renders redesign with split-screen layout, no explore link, and no back-to-login link on form', () => {
      renderWithRouter(<ResetPassword />);

      // Split screen hero copy
      expect(screen.getByText(/Your Next Career/i)).toBeInTheDocument();

      // Explore Opportunities link should NOT be visible on Reset Password
      expect(screen.queryByRole('link', { name: /Explore Opportunities/i })).not.toBeInTheDocument();

      // Form header
      expect(screen.getByText('New Password')).toBeInTheDocument();

      // Missing token guard alert
      expect(
        screen.getByText(/Missing password reset token\. Please request a new recovery link\./i)
      ).toBeInTheDocument();

      // Go back to login link should NOT be present on the reset password form
      expect(screen.queryByText(/Back to/i)).not.toBeInTheDocument();
    });
  });
});
