import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ApplicantDashboard from '../pages/ApplicantDashboard/ApplicantDashboard';
import About from '../pages/About/About';

// Mock child components or fetch calls if needed
vi.mock('../pages/ApplicantDashboard/components/FeaturedJobs', () => ({
  default: () => <div data-testid="featured-jobs-mock" />
}));

vi.mock('../pages/ApplicantDashboard/components/PartnersCarousel', () => ({
  default: () => <div data-testid="partners-carousel-mock" />
}));

describe('Staggering Entrance Animation Rules', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('triggers staggering on the very first guest visit ever and marks guest as visited', () => {
    expect(localStorage.getItem('airship_guest_visited')).toBeNull();

    const { container } = render(
      <BrowserRouter>
        <ApplicantDashboard />
      </BrowserRouter>
    );

    const wrapper = container.querySelector('.dashboard-wrapper');
    // Initially renders with stagger state (either pre-stagger or stagger class)
    expect(
      wrapper.classList.contains('applicant-dashboard--pre-stagger') ||
      wrapper.classList.contains('applicant-dashboard--stagger')
    ).toBe(true);
    expect(wrapper.classList.contains('applicant-dashboard--ready')).toBe(false);

    // Synchronously records that the guest has now visited
    expect(localStorage.getItem('airship_guest_visited')).toBe('true');
    expect(sessionStorage.getItem('airship_guest_visited')).toBe('true');
  });

  it('DOES NOT trigger staggering when the user is a guest and already visited the website', () => {
    // Pre-set guest visited flag
    localStorage.setItem('airship_guest_visited', 'true');
    sessionStorage.setItem('airship_guest_visited', 'true');

    const { container } = render(
      <BrowserRouter>
        <ApplicantDashboard />
      </BrowserRouter>
    );

    const wrapper = container.querySelector('.dashboard-wrapper');
    // Must immediately be in ready state with no staggering classes
    expect(wrapper.classList.contains('applicant-dashboard--ready')).toBe(true);
    expect(wrapper.classList.contains('applicant-dashboard--stagger')).toBe(false);
    expect(wrapper.classList.contains('applicant-dashboard--pre-stagger')).toBe(false);
  });

  it('DOES NOT trigger staggering when a logged-in user navigates between pages', () => {
    // Logged in user in localStorage, but NO post-login trigger flags in sessionStorage
    localStorage.setItem('hiring_user', JSON.stringify({ id: 10, first_name: 'John', is_admin: 0 }));

    const { container } = render(
      <BrowserRouter>
        <ApplicantDashboard />
      </BrowserRouter>
    );

    const wrapper = container.querySelector('.dashboard-wrapper');
    expect(wrapper.classList.contains('applicant-dashboard--ready')).toBe(true);
    expect(wrapper.classList.contains('applicant-dashboard--stagger')).toBe(false);
    expect(wrapper.classList.contains('applicant-dashboard--pre-stagger')).toBe(false);
  });

  it('triggers staggering immediately after login and consumes trigger flags so re-visiting stays static', () => {
    localStorage.setItem('hiring_user', JSON.stringify({ id: 10, first_name: 'Jane', is_admin: 0 }));
    sessionStorage.setItem('trigger_dashboard_stagger', 'true');
    sessionStorage.setItem('just_logged_in', 'true');

    const { container, unmount } = render(
      <BrowserRouter>
        <ApplicantDashboard />
      </BrowserRouter>
    );

    const wrapper = container.querySelector('.dashboard-wrapper');
    expect(
      wrapper.classList.contains('applicant-dashboard--pre-stagger') ||
      wrapper.classList.contains('applicant-dashboard--stagger')
    ).toBe(true);

    // Both sessionStorage flags must be consumed immediately
    expect(sessionStorage.getItem('trigger_dashboard_stagger')).toBeNull();
    expect(sessionStorage.getItem('just_logged_in')).toBeNull();

    unmount();

    // Now re-mount (user navigated to Vacancies and came back)
    const { container: container2 } = render(
      <BrowserRouter>
        <ApplicantDashboard />
      </BrowserRouter>
    );

    const wrapper2 = container2.querySelector('.dashboard-wrapper');
    expect(wrapper2.classList.contains('applicant-dashboard--ready')).toBe(true);
    expect(wrapper2.classList.contains('applicant-dashboard--stagger')).toBe(false);
  });

  it('DOES NOT trigger staggering on About page when user already visited the website', () => {
    localStorage.setItem('airship_guest_visited', 'true');

    const { container } = render(
      <BrowserRouter>
        <About />
      </BrowserRouter>
    );

    const wrapper = container.querySelector('.about-wrapper');
    expect(wrapper.classList.contains('about--ready')).toBe(true);
    expect(wrapper.classList.contains('about--stagger')).toBe(false);
    expect(wrapper.classList.contains('about--pre-stagger')).toBe(false);
  });
});
