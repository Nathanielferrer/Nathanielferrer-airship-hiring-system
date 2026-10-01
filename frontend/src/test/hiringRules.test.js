import { describe, it, expect } from 'vitest';

// ════════════════════════════════════════════════════════════════════════════
// MODULE VALIDATORS & BUSINESS LOGIC HELPERS
// ════════════════════════════════════════════════════════════════════════════

// ── 1. Time Formatting Helper (Schedule Displays) ───────────────────────────
const formatTime12h = (t) => {
  if (!t) return '';
  if (/AM|PM/i.test(t)) return t;
  const parts = t.split(':');
  if (parts.length < 2) return t;
  let hour = parseInt(parts[0], 10);
  const minute = parts[1];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${String(hour).padStart(2, '0')}:${minute} ${ampm}`;
};

// ── 2. Weekday Validator (Interview Slots) ──────────────────────────────────
const isWeekday = (dateStr) => {
  const day = new Date(dateStr + 'T00:00:00').getDay();
  return day >= 1 && day <= 5; // 1 = Mon, 5 = Fri, 0 = Sun, 6 = Sat
};

// ── 3. Office Hours Validator (8:00 AM to 5:00 PM) ────────────────────────
const isWithinOfficeHours = (time24h) => {
  const [h, m] = time24h.split(':').map(Number);
  const totalMins = h * 60 + m;
  return totalMins >= 480 && totalMins < 1020; // 8:00 AM (480m) to 5:00 PM (1020m)
};

// ── 4. Slot Capacity Conflict Checker (Candidate Evaluation) ───────────────
const findSlotConflicts = (selectedCandidates) => {
  const groups = {};
  selectedCandidates.forEach(cand => {
    const jId = cand.job_id || 'unknown';
    if (!groups[jId]) {
      groups[jId] = {
        jobTitle: cand.job_title,
        availableSlots: cand.available_slots ?? 0,
        candidates: []
      };
    }
    groups[jId].candidates.push(cand);
  });
  return Object.values(groups).filter(g => g.candidates.length > g.availableSlots);
};

// ── 5. Duplicate Contract Signing Conflict Checker ────────────────────────
const hasScheduleConflict = (newDate, newTime24, existingAppointments) => {
  return existingAppointments.some(
    app => app.date === newDate && app.time24 === newTime24
  );
};

// ── 6. Account Deletion Eligibility Checker (Settings) ────────────────────
const TERMINAL_STATUSES = [
  'hired', 'officially hired', 'officially_hired', 'officially hired & signed',
  'officially hired & requirements completed', 'completed requirements', 'completed_requirements',
  'contract signed & onboarded', 'contract_signed_and_onboarded', 'archived',
  'screening_rejected', 'screening rejected', 'rejected', 'failed interview', 'failed', 'interview_failed',
  'failed initial', 'failed_initial', 'failed initial interview', 'failed_initial_interview',
  'failed final', 'failed_final', 'failed final interview', 'failed_final_interview',
  'failed final approval', 'failed_final_approval',
  'failed pre-employment', 'failed_pre_employment', 'incomplete requirements', 'incomplete_requirements',
  'candidate withdrew', 'candidate_withdrew', 'withdrawn', 'withdraw',
  'offer declined', 'offer_declined', 'job offer declined', 'job_offer_declined', 'declined',
  'offer expired', 'offer_expired', 'scheduling expired', 'scheduling_expired',
  'declined - unresponsive', 'declined_unresponsive', 'unresponsive',
  'candidate no show', 'candidate_no_show', 'no show', 'no_show'
];

const canDeleteAccount = (applications = []) => {
  if (!applications || applications.length === 0) return true;
  return applications.every(app =>
    TERMINAL_STATUSES.includes((app.status || '').toLowerCase().trim())
  );
};

const validateDeletePhrase = (phrase) => {
  return typeof phrase === 'string' && phrase.trim().toUpperCase() === 'DELETE';
};

// ── 7. Resume Format Validator (PDF Only & 5MB Limit) ───────────────────────
const validateResumeFile = (file) => {
  if (!file || !file.name) {
    return { valid: false, error: 'Please upload your resume in PDF format.' };
  }
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'pdf') {
    return { valid: false, error: 'Only PDF files are supported.' };
  }
  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'File size exceeds the 5 MB limit. Please upload a smaller PDF.' };
  }
  return { valid: true };
};

// ── 8. Parsed Match Score Sorter & Filter (Resume Screening) ───────────────
const sortApplicantsByScore = (applicants, sortOrder = 'score_desc') => {
  return [...applicants].sort((a, b) => {
    const scoreA = Number(a.ai_match_score ?? 0);
    const scoreB = Number(b.ai_match_score ?? 0);
    if (sortOrder === 'score_desc') return scoreB - scoreA;
    if (sortOrder === 'score_asc') return scoreA - scoreB;
    return 0;
  });
};

const filterApplicantsByStatus = (applicants, statusFilter) => {
  if (!statusFilter || statusFilter === 'all') return applicants;
  return applicants.filter(app => (app.status || '').toLowerCase() === statusFilter.toLowerCase());
};

// ── 9. Reschedule Window Policy (Application Status - 2-Day Limit) ─────────
const isWithinRescheduleWindow = (scheduleAssignedAt, currentTime) => {
  if (!scheduleAssignedAt) return false;
  const assigned = new Date(scheduleAssignedAt).getTime();
  const current = new Date(currentTime).getTime();
  const diffHours = (current - assigned) / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours <= 48; // Must be within 48 hours (2 days)
};

// ── 10. Job Requisition Form Validator (Job Posting) ───────────────────────
const validateJobPosting = (job) => {
  if (!job.title || !job.title.trim()) return { valid: false, error: 'Job title is required.' };
  if (!job.department || !job.department.trim()) return { valid: false, error: 'Department is required.' };
  const vacancies = Number(job.available_slots);
  if (isNaN(vacancies) || vacancies <= 0) return { valid: false, error: 'Vacancy slots must be greater than zero.' };
  const minSal = Number(job.salary_min);
  const maxSal = Number(job.salary_max);
  if (!isNaN(minSal) && !isNaN(maxSal) && minSal > maxSal) {
    return { valid: false, error: 'Minimum salary cannot exceed maximum salary.' };
  }
  return { valid: true };
};

// ── 11. Administrative Access & Governance (Super Admin) ────────────────────
const canDeactivateAdmin = (targetAdminId, loggedInSuperAdminId) => {
  if (targetAdminId === loggedInSuperAdminId) {
    return { allowed: false, error: 'You cannot deactivate your own Super Administrator account.' };
  }
  return { allowed: true };
};

// ── 12. Super Admin MFA TOTP & Backup Code Validator ───────────────────────
const validateMfaTotpCode = (code) => {
  if (typeof code !== 'string') return false;
  return /^\d{6}$/.test(code.trim()); // Must be exactly 6 digits
};

const validateBackupCode = (code, validBackupCodes = []) => {
  if (typeof code !== 'string') return false;
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return validBackupCodes.some(c => c.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') === clean);
};

// ── 13. Chatbot FAQ Matching (Chatbot Intelligence) ─────────────────────────
const matchChatbotQuery = (query, knowledgeBase = []) => {
  if (!query || !query.trim()) return null;
  const normalizedQuery = query.toLowerCase().trim();

  // 1. Exact match check
  const exact = knowledgeBase.find(kb => kb.question.toLowerCase().trim() === normalizedQuery);
  if (exact) return exact.answer;

  // 2. Keyword containment check
  const match = knowledgeBase.find(kb => {
    const q = kb.question.toLowerCase();
    const keywords = normalizedQuery.split(/\s+/).filter(w => w.length > 3);
    return keywords.some(kw => q.includes(kw));
  });

  return match ? match.answer : null;
};

// ── 14. Interview Schedule Lifecycle & Active Slot Retention ───────────────
const ACTIVE_INTERVIEW_STATUSES = [
  'confirmed', 'interview_scheduled', 'pending scheduled', 'pending_scheduled', 'reschedule requested', 'reschedule_requested'
];

const shouldRetainSlotInSchedule = (appStatus) => {
  if (!appStatus) return false;
  return ACTIVE_INTERVIEW_STATUSES.includes(appStatus.toLowerCase().trim());
};

const sanitizeScheduleSlot = (slot) => {
  if (!slot) return null;
  if (slot.status === 'Open' || !slot.application_id) {
    return { ...slot, applicant_name: null, job_title: null };
  }
  if (!shouldRetainSlotInSchedule(slot.application_status)) {
    return null; // Concluded candidate slot is pruned from active schedule
  }
  return slot;
};

// ── 15. Final Interview No-Show Notice Formatter ────────────────────────────
const generateNoShowNotice = (jobTitle, formattedDate, formattedTime) => {
  const role = jobTitle || 'designated';
  if (formattedDate && formattedTime) {
    return `Our records indicate that you were unable to attend your scheduled Final Interview on ${formattedDate} at ${formattedTime}, and your active application for the ${role} role has been closed. Thank you for your interest in Airship Express, and we welcome you to re-apply for future openings.`;
  }
  if (formattedDate) {
    return `Our records indicate that you were unable to attend your scheduled Final Interview on ${formattedDate}, and your active application for the ${role} role has been closed. Thank you for your interest in Airship Express, and we welcome you to re-apply for future openings.`;
  }
  return `Our records indicate that you were unable to attend your scheduled Final Interview, and your active application for the ${role} role has been closed. Thank you for your interest in Airship Express, and we welcome you to re-apply for future openings.`;
};

// ── 16. Vacancy Apply Button State Resolver ────────────────────────────────
const resolveVacancyButtonText = ({ jobStatus, cooldownInfo, isActive = true, isHiredUser = false, hasActiveApp = false }) => {
  const normSt = (jobStatus || '').trim().toUpperCase();
  const isNoShow = [
    'CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW', 'NO SHOW', 'NO_SHOW', 'CANDIDATE NO-SHOW'
  ].includes(normSt) || normSt.includes('NO SHOW') || normSt.includes('NO_SHOW') || cooldownInfo?.type === 'no_show';
  const isRejected = [
    'REJECTED', 'SCREENING_REJECTED',
    'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED',
    'DECLINED - UNRESPONSIVE', 'SCHEDULING EXPIRED', 'SCHEDULING_EXPIRED', 'UNRESPONSIVE',
    'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW',
    'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL'
  ].includes(normSt) || cooldownInfo?.type === 'rejected';
  const isDeclined = [
    'OFFER DECLINED', 'OFFER_DECLINED', 'JOB OFFER DECLINED', 'JOB_OFFER_DECLINED'
  ].includes(normSt) || cooldownInfo?.type === 'declined';
  const isHiredForThisJob = [
    'OFFICIALLY HIRED', 'OFFICIALLY_HIRED', 'OFFICIALLY HIRED & SIGNED',
    'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED',
    'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED',
    'HIRED', 'PASSED', 'HIRED / PASSED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL'
  ].includes(normSt);

  if (isHiredForThisJob) return 'You have been hired for this position!';
  if (isNoShow) return 'Application Closed — Missed Scheduled Final Interview';
  if (isRejected) return 'Application Closed';
  if (isDeclined && cooldownInfo?.in_cooldown) return 'Job Offer Declined';
  if (cooldownInfo?.in_cooldown) return 'Cooldown Active';
  if (jobStatus) {
    const isWithdrawn = ['Candidate Withdrew', 'CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW'].includes(jobStatus);
    if (isWithdrawn) {
      return isActive ? 'Apply Now' : 'Application Withdrawn (Closed)';
    }
    if (isNoShow) return 'Application Closed — Missed Scheduled Final Interview';
    if (isRejected) return 'Application Closed';
    return 'You have an active application for this position';
  }
  if (isHiredUser) return 'Already Hired (Active Employee)';
  if (hasActiveApp) return 'Cannot Apply (Application Pending)';
  return isActive ? 'Apply Now' : 'Position Closed';
};

// ── 17. 6-Month Re-application Cooldown Formatter ───────────────────────────
const calculateReapplyCooldown = (rawDate) => {
  if (!rawDate) return null;
  const d = new Date(rawDate);
  d.setMonth(d.getMonth() + 6);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const formatReapplyPolicyNotice = (eligibleDate) => {
  if (!eligibleDate) return '';
  return `Re-application Policy: Re-applying for this position is available after a 6-month waiting period (Eligible on ${eligibleDate}). You may explore and apply for other open opportunities anytime.`;
};

// ════════════════════════════════════════════════════════════════════════════
// VITEST TEST SUITES ACROSS ALL MODULES
// ════════════════════════════════════════════════════════════════════════════

describe('Hiring System Modules - Verification & Business Rules Suite', () => {

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Time & Schedule Formatting
  // ──────────────────────────────────────────────────────────────────────────
  describe('Module: Schedule Formatting', () => {
    it('converts 24-hour time to 12-hour AM/PM format accurately', () => {
      expect(formatTime12h('09:00')).toBe('09:00 AM');
      expect(formatTime12h('14:30')).toBe('02:30 PM');
      expect(formatTime12h('12:00')).toBe('12:00 PM');
      expect(formatTime12h('00:15')).toBe('12:15 AM');
    });

    it('returns empty string if time is empty or invalid', () => {
      expect(formatTime12h('')).toBe('');
      expect(formatTime12h(null)).toBe('');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Interview Schedule (Slots)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Module: Interview Schedule (Slots Management)', () => {
    it('allows weekdays (Monday to Friday)', () => {
      expect(isWeekday('2026-09-28')).toBe(true); // Monday
      expect(isWeekday('2026-09-30')).toBe(true); // Wednesday
      expect(isWeekday('2026-10-02')).toBe(true); // Friday
    });

    it('blocks weekends (Saturday and Sunday)', () => {
      expect(isWeekday('2026-10-03')).toBe(false); // Saturday
      expect(isWeekday('2026-10-04')).toBe(false); // Sunday
    });

    it('approves appointments within office hours (8:00 AM to 5:00 PM)', () => {
      expect(isWithinOfficeHours('08:00')).toBe(true);
      expect(isWithinOfficeHours('10:30')).toBe(true);
      expect(isWithinOfficeHours('16:45')).toBe(true);
    });

    it('rejects appointments before 8:00 AM or at/after 5:00 PM', () => {
      expect(isWithinOfficeHours('07:30')).toBe(false);
      expect(isWithinOfficeHours('17:00')).toBe(false);
      expect(isWithinOfficeHours('18:30')).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Candidate Evaluation & Smart Slot Capacity
  // ──────────────────────────────────────────────────────────────────────────
  describe('Module: Candidate Evaluation (Smart Slot Capacity)', () => {
    it('flags conflict when selected candidates exceed available job quota', () => {
      const selected = [
        { job_id: 10, job_title: 'Delivery Rider', available_slots: 1, name: 'Candidate A' },
        { job_id: 10, job_title: 'Delivery Rider', available_slots: 1, name: 'Candidate B' }
      ];

      const conflicts = findSlotConflicts(selected);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].jobTitle).toBe('Delivery Rider');
      expect(conflicts[0].candidates.length).toBe(2);
      expect(conflicts[0].availableSlots).toBe(1);
    });

    it('passes cleanly when selected candidates do not exceed available slots', () => {
      const selected = [
        { job_id: 10, job_title: 'Delivery Rider', available_slots: 2, name: 'Candidate A' },
        { job_id: 10, job_title: 'Delivery Rider', available_slots: 2, name: 'Candidate B' }
      ];

      const conflicts = findSlotConflicts(selected);
      expect(conflicts.length).toBe(0);
    });

    it('detects duplicate contract signing appointments for the same date and time', () => {
      const existing = [{ name: 'Nhelycita Ferrer', date: '2026-09-29', time24: '09:00' }];
      expect(hasScheduleConflict('2026-09-29', '09:00', existing)).toBe(true);
      expect(hasScheduleConflict('2026-09-29', '10:00', existing)).toBe(false);
      expect(hasScheduleConflict('2026-09-30', '09:00', existing)).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Job Vacancy & Application Submission (Resume PDF-Only Rule)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Module: Job Vacancy (Resume Upload Validation)', () => {
    it('accepts valid PDF resume within 5MB limit', () => {
      const validPdf = { name: 'Juan_Cruz_Resume.pdf', size: 2 * 1024 * 1024 }; // 2MB
      const res = validateResumeFile(validPdf);
      expect(res.valid).toBe(true);
    });

    it('strictly rejects DOCX, DOC, PNG, and non-PDF files', () => {
      expect(validateResumeFile({ name: 'Resume.docx', size: 1000 }).valid).toBe(false);
      expect(validateResumeFile({ name: 'Resume.doc', size: 1000 }).valid).toBe(false);
      expect(validateResumeFile({ name: 'Photo.png', size: 1000 }).valid).toBe(false);
      expect(validateResumeFile({ name: 'Resume.docx', size: 1000 }).error).toBe('Only PDF files are supported.');
    });

    it('rejects PDF resumes larger than 5 MB', () => {
      const largePdf = { name: 'Huge_Resume.pdf', size: 6 * 1024 * 1024 }; // 6MB
      const res = validateResumeFile(largePdf);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('exceeds the 5 MB limit');
    });

    it('rejects empty or missing file submissions', () => {
      expect(validateResumeFile(null).valid).toBe(false);
      expect(validateResumeFile({}).valid).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Resume Screening (Parsed Match Scores)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Module: Resume Screening (Parsed Match Scores)', () => {
    const candidates = [
      { id: 1, name: 'Candidate A', ai_match_score: 45, status: 'pending' },
      { id: 2, name: 'Candidate B', ai_match_score: 88, status: 'pending' },
      { id: 3, name: 'Candidate C', ai_match_score: 72, status: 'passed' }
    ];

    it('sorts candidates by parsed match score descending (highest to lowest)', () => {
      const sorted = sortApplicantsByScore(candidates, 'score_desc');
      expect(sorted[0].ai_match_score).toBe(88);
      expect(sorted[1].ai_match_score).toBe(72);
      expect(sorted[2].ai_match_score).toBe(45);
    });

    it('sorts candidates by parsed match score ascending (lowest to highest)', () => {
      const sorted = sortApplicantsByScore(candidates, 'score_asc');
      expect(sorted[0].ai_match_score).toBe(45);
      expect(sorted[2].ai_match_score).toBe(88);
    });

    it('filters candidate pool by screening status', () => {
      const pending = filterApplicantsByStatus(candidates, 'pending');
      expect(pending.length).toBe(2);
      const passed = filterApplicantsByStatus(candidates, 'passed');
      expect(passed.length).toBe(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Application Status & Reschedule Policy
  // ──────────────────────────────────────────────────────────────────────────
  describe('Module: Application Status (2-Day Reschedule Window)', () => {
    it('allows reschedule within 48 hours of assignment', () => {
      const assigned = '2026-09-28T09:00:00';
      const within24h = '2026-09-29T09:00:00';
      expect(isWithinRescheduleWindow(assigned, within24h)).toBe(true);
    });

    it('blocks reschedule requests after 48 hours have elapsed', () => {
      const assigned = '2026-09-25T09:00:00';
      const after3Days = '2026-09-28T10:00:00';
      expect(isWithinRescheduleWindow(assigned, after3Days)).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Job Posting & Requisitions
  // ──────────────────────────────────────────────────────────────────────────
  describe('Module: Job Posting Requisitions', () => {
    it('validates required fields: title, department, and positive vacancy slots', () => {
      const validJob = { title: 'Delivery Rider', department: 'Operations', available_slots: 3, salary_min: 18000, salary_max: 22000 };
      expect(validateJobPosting(validJob).valid).toBe(true);

      const missingTitle = { title: '', department: 'Operations', available_slots: 3 };
      expect(validateJobPosting(missingTitle).valid).toBe(false);

      const zeroSlots = { title: 'Driver', department: 'Operations', available_slots: 0 };
      expect(validateJobPosting(zeroSlots).valid).toBe(false);
    });

    it('ensures minimum salary does not exceed maximum salary', () => {
      const invalidSalary = { title: 'Manager', department: 'Logistics', available_slots: 1, salary_min: 50000, salary_max: 30000 };
      const res = validateJobPosting(invalidSalary);
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Minimum salary cannot exceed maximum salary.');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Administrative Access & Governance (Super Admin)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Module: Administrative Access Governance', () => {
    it('prevents a Super Admin from deactivating their own account', () => {
      const superAdminId = 1;
      const res = canDeactivateAdmin(superAdminId, superAdminId);
      expect(res.allowed).toBe(false);
      expect(res.error).toContain('cannot deactivate your own');
    });

    it('permits deactivating another administrator', () => {
      const res = canDeactivateAdmin(5, 1);
      expect(res.allowed).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Super Admin Multi-Factor Authentication (MFA)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Module: Super Admin MFA Verification', () => {
    it('validates 6-digit TOTP numeric verification codes strictly', () => {
      expect(validateMfaTotpCode('123456')).toBe(true);
      expect(validateMfaTotpCode('009812')).toBe(true);
      expect(validateMfaTotpCode('12345')).toBe(false);  // Too short
      expect(validateMfaTotpCode('1234567')).toBe(false); // Too long
      expect(validateMfaTotpCode('ABCDEF')).toBe(false);  // Letters
      expect(validateMfaTotpCode('')).toBe(false);
    });

    it('validates one-time emergency backup recovery codes', () => {
      const validCodes = ['A1B2-C3D4', 'E5F6-G7H8'];
      expect(validateBackupCode('A1B2-C3D4', validCodes)).toBe(true);
      expect(validateBackupCode('a1b2c3d4', validCodes)).toBe(true); // Case-insensitive
      expect(validateBackupCode('XXXX-9999', validCodes)).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. Chatbot Support & Knowledge Base Intelligence
  // ──────────────────────────────────────────────────────────────────────────
  describe('Module: Chatbot Knowledge Base Intelligence', () => {
    const kb = [
      { id: 1, question: 'What are the required documents for application?', answer: 'You need an updated resume in PDF format and a valid ID.' },
      { id: 2, question: 'How do I reschedule my interview?', answer: 'Go to Application Status and click Reschedule within 2 days.' }
    ];

    it('matches exact applicant FAQ questions accurately', () => {
      const answer = matchChatbotQuery('What are the required documents for application?', kb);
      expect(answer).toBe('You need an updated resume in PDF format and a valid ID.');
    });

    it('matches questions by keyword containment', () => {
      const answer = matchChatbotQuery('Can I reschedule my interview date?', kb);
      expect(answer).toContain('Go to Application Status');
    });

    it('returns null for unrecognized questions to trigger unanswered query logging', () => {
      const answer = matchChatbotQuery('Where is the nearest moon base?', kb);
      expect(answer).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 11. Applicant Account Deletion Protection & Validation (Settings)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Module: Settings (Account Deletion Safeguards)', () => {
    it('blocks account deletion if user has an active application in progress', () => {
      const apps = [
        { id: 1, status: 'Interview Scheduled' },
        { id: 2, status: 'Rejected' }
      ];
      expect(canDeleteAccount(apps)).toBe(false);
    });

    it('blocks account deletion for pending review or job offer pending statuses', () => {
      expect(canDeleteAccount([{ id: 1, status: 'Pending' }])).toBe(false);
      expect(canDeleteAccount([{ id: 1, status: 'Job Offer Pending' }])).toBe(false);
      expect(canDeleteAccount([{ id: 1, status: 'Requirement Pending' }])).toBe(false);
    });

    it('permits account deletion if all applications are in terminal statuses', () => {
      const apps = [
        { id: 1, status: 'Rejected' },
        { id: 2, status: 'Candidate Withdrew' }
      ];
      expect(canDeleteAccount(apps)).toBe(true);
    });

    it('permits account deletion if candidate declined their job offer (Offer Declined)', () => {
      expect(canDeleteAccount([{ id: 336, status: 'Offer Declined' }])).toBe(true);
    });

    it('permits account deletion for all completed pipeline exit statuses', () => {
      expect(canDeleteAccount([{ id: 1, status: 'Candidate No Show' }])).toBe(true);
      expect(canDeleteAccount([{ id: 2, status: 'No Show' }])).toBe(true);
      expect(canDeleteAccount([{ id: 3, status: 'Rejected' }])).toBe(true);
      expect(canDeleteAccount([{ id: 4, status: 'Screening Rejected' }])).toBe(true);
      expect(canDeleteAccount([{ id: 5, status: 'Failed Initial Interview' }])).toBe(true);
      expect(canDeleteAccount([{ id: 6, status: 'Failed Interview' }])).toBe(true);
      expect(canDeleteAccount([{ id: 7, status: 'Failed Final Interview' }])).toBe(true);
      expect(canDeleteAccount([{ id: 8, status: 'Failed Final' }])).toBe(true);
      expect(canDeleteAccount([{ id: 9, status: 'Failed Final Approval' }])).toBe(true);
      expect(canDeleteAccount([{ id: 10, status: 'Candidate Withdrew' }])).toBe(true);
      expect(canDeleteAccount([{ id: 11, status: 'Withdraw' }])).toBe(true);
    });

    it('permits account deletion if user has never applied for any job', () => {
      expect(canDeleteAccount([])).toBe(true);
      expect(canDeleteAccount(null)).toBe(true);
    });

    it('validates explicit confirmation keyword "DELETE" strictly', () => {
      expect(validateDeletePhrase('DELETE')).toBe(true);
      expect(validateDeletePhrase('delete')).toBe(true);
      expect(validateDeletePhrase('  delete  ')).toBe(true);
      expect(validateDeletePhrase('DEL')).toBe(false);
      expect(validateDeletePhrase('CONFIRM')).toBe(false);
      expect(validateDeletePhrase('')).toBe(false);
      expect(validateDeletePhrase(null)).toBe(false);
    });
  });

  // ── 14. INTERVIEW SCHEDULE LIFECYCLE & SLOT RETENTION SUITE ──────────────
  describe('Interview Schedule Lifecycle & Slot Retention', () => {
    it('retains slot in schedule only for active un-interviewed application statuses', () => {
      expect(shouldRetainSlotInSchedule('CONFIRMED')).toBe(true);
      expect(shouldRetainSlotInSchedule('INTERVIEW_SCHEDULED')).toBe(true);
      expect(shouldRetainSlotInSchedule('PENDING SCHEDULED')).toBe(true);
      expect(shouldRetainSlotInSchedule('Reschedule Requested')).toBe(true);
    });

    it('prunes slot from schedule once candidate is evaluated as Passed Final Interview', () => {
      expect(shouldRetainSlotInSchedule('Passed Final Interview')).toBe(false);
      expect(shouldRetainSlotInSchedule('PASSED_FINAL_INTERVIEW')).toBe(false);
    });

    it('prunes slot from schedule once candidate is evaluated as Failed Final Interview', () => {
      expect(shouldRetainSlotInSchedule('Failed Final Interview')).toBe(false);
      expect(shouldRetainSlotInSchedule('INTERVIEW_FAILED')).toBe(false);
      expect(shouldRetainSlotInSchedule('Rejected')).toBe(false);
    });

    it('prunes slot from schedule once candidate is evaluated as Candidate No Show', () => {
      expect(shouldRetainSlotInSchedule('Candidate No Show')).toBe(false);
      expect(shouldRetainSlotInSchedule('CANDIDATE_NO_SHOW')).toBe(false);
      expect(shouldRetainSlotInSchedule('NO SHOW')).toBe(false);
    });

    it('prunes slot from schedule once candidate withdraws or reaches terminal status', () => {
      expect(shouldRetainSlotInSchedule('Candidate Withdrew')).toBe(false);
      expect(shouldRetainSlotInSchedule('Officially Hired')).toBe(false);
      expect(shouldRetainSlotInSchedule('Offer Declined')).toBe(false);
      expect(shouldRetainSlotInSchedule('President Approved')).toBe(false);
    });

    it('sanitizes open slots to never display ghost candidate names', () => {
      const openSlotWithGhostData = {
        slot_id: 101,
        status: 'Open',
        application_id: null,
        applicant_name: 'Ghost Name',
        job_title: 'Driver'
      };
      const cleaned = sanitizeScheduleSlot(openSlotWithGhostData);
      expect(cleaned.applicant_name).toBeNull();
      expect(cleaned.job_title).toBeNull();
    });

    it('discards concluded candidate slots from active schedule view', () => {
      const concludedSlot = {
        slot_id: 251,
        status: 'Booked',
        application_id: 334,
        applicant_name: 'Bianca Isanan',
        application_status: 'Officially Hired'
      };
      expect(sanitizeScheduleSlot(concludedSlot)).toBeNull();
    });

    it('preserves active candidate slots in active schedule view', () => {
      const activeSlot = {
        slot_id: 255,
        status: 'Booked',
        application_id: 400,
        applicant_name: 'Active Candidate',
        application_status: 'CONFIRMED'
      };
      const cleaned = sanitizeScheduleSlot(activeSlot);
      expect(cleaned).not.toBeNull();
      expect(cleaned.applicant_name).toBe('Active Candidate');
    });

    it('generates improved No-Show notice including date, time, and position title', () => {
      const notice = generateNoShowNotice('Delivery Driver', 'September 28, 2026', '09:30 AM');
      expect(notice).toContain('unable to attend your scheduled Final Interview on September 28, 2026 at 09:30 AM, and your active application for the Delivery Driver role has been closed.');
      expect(notice).toContain('welcome you to re-apply for future openings');
    });

    it('generates improved No-Show notice gracefully when time is missing', () => {
      const notice = generateNoShowNotice('Warehouse Specialist', 'September 28, 2026', null);
      expect(notice).toContain('unable to attend your scheduled Final Interview on September 28, 2026, and your active application for the Warehouse Specialist role has been closed.');
    });

    it('generates improved No-Show notice gracefully when both date and time are missing', () => {
      const notice = generateNoShowNotice(null, null, null);
      expect(notice).toContain('unable to attend your scheduled Final Interview, and your active application for the designated role has been closed.');
    });

    it('resolves Vacancy button as "Application Closed — Missed Scheduled Final Interview" for No-Show applicants instead of active application banner', () => {
      // Test when status is 'Candidate No Show'
      const btn1 = resolveVacancyButtonText({ jobStatus: 'Candidate No Show', isActive: true });
      expect(btn1).toBe('Application Closed — Missed Scheduled Final Interview');
      expect(btn1).not.toBe('You have an active application for this position');

      // Test with all case variations
      const btn2 = resolveVacancyButtonText({ jobStatus: 'CANDIDATE NO SHOW', isActive: true });
      expect(btn2).toBe('Application Closed — Missed Scheduled Final Interview');

      const btn3 = resolveVacancyButtonText({ jobStatus: 'NO SHOW', isActive: true });
      expect(btn3).toBe('Application Closed — Missed Scheduled Final Interview');

      // Test via cooldownInfo type 'no_show'
      const btn4 = resolveVacancyButtonText({ jobStatus: '', cooldownInfo: { type: 'no_show', in_cooldown: true }, isActive: true });
      expect(btn4).toBe('Application Closed — Missed Scheduled Final Interview');
    });

    it('calculates 6-month re-application cooldown and formats policy notice on Application Status', () => {
      const eventDate = '2026-09-28 10:00:00';
      const eligibleDate = calculateReapplyCooldown(eventDate);
      expect(eligibleDate).toBe('March 28, 2027');

      const policyNotice = formatReapplyPolicyNotice(eligibleDate);
      expect(policyNotice).toContain('Re-application Policy:');
      expect(policyNotice).toContain('6-month waiting period');
      expect(policyNotice).toContain('Eligible on March 28, 2027');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 12. PRESIDENT'S FINAL APPROVAL PRIORITY WAITLIST RESERVATION RULES
  // ════════════════════════════════════════════════════════════════════════════
  describe("President's Final Approval Priority Waitlist Reservation Rules", () => {
    const resolveFinalApprovalAction = (candidate, allFinalistsForJob) => {
      const isStandby = ['PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT', 'WAITLIST', 'WAITLISTED'].includes((candidate.status || '').toUpperCase());
      const waitlisted = allFinalistsForJob
        .filter(c => ['PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT', 'WAITLIST', 'WAITLISTED'].includes((c.status || '').toUpperCase()))
        .sort((a, b) => new Date(a.updated_at || 0) - new Date(b.updated_at || 0));
      
      const waitlistCount = waitlisted.length;
      const rawAvailable = candidate.available_slots !== undefined ? Math.max(0, candidate.available_slots) : 0;
      const unreservedSlots = Math.max(0, rawAvailable - waitlistCount);
      const isCapacityFull = rawAvailable <= 0 || (!isStandby && unreservedSlots <= 0);

      if (isStandby) {
        const rank = waitlisted.findIndex(c => c.application_id === candidate.application_id) + 1;
        if (isCapacityFull) {
          if (rank === 1) return { action: 'MANAGE', rank, isStandby: true };
          return { action: 'WAITLISTED_DISABLED', rank, isStandby: true };
        }
        if (rank === 1) return { action: 'PROMOTE', rank, isStandby: true };
        return { action: 'STANDBY_DISABLED', rank, isStandby: true };
      }

      if (isCapacityFull) {
        return { action: 'MANAGE', unreservedSlots, isStandby: false };
      }
      return { action: 'APPROVE', unreservedSlots, isStandby: false };
    };

    it('renders "Promote (#1)" for waitlisted candidate and "Manage" for newly passed candidate when 1 slot is available', () => {
      const waitlistCandidate = {
        application_id: 101,
        job_id: 5,
        status: 'Passed Final — Waiting for Slot',
        available_slots: 1,
        updated_at: '2026-09-29T10:00:00Z'
      };
      const newCandidate = {
        application_id: 102,
        job_id: 5,
        status: 'Passed Final Interview',
        available_slots: 1,
        updated_at: '2026-09-30T10:00:00Z'
      };
      const finalists = [waitlistCandidate, newCandidate];

      const resWaitlist = resolveFinalApprovalAction(waitlistCandidate, finalists);
      expect(resWaitlist.action).toBe('PROMOTE');
      expect(resWaitlist.rank).toBe(1);

      // The new candidate must NOT display Approve because the 1 slot is reserved for Waitlist #1!
      const resNew = resolveFinalApprovalAction(newCandidate, finalists);
      expect(resNew.action).toBe('MANAGE');
      expect(resNew.unreservedSlots).toBe(0);
    });

    it('allows newly passed candidate to show "Approve" when open slots exceed waitlist count', () => {
      const waitlistCandidate = {
        application_id: 101,
        job_id: 5,
        status: 'Passed Final — Waiting for Slot',
        available_slots: 2,
        updated_at: '2026-09-29T10:00:00Z'
      };
      const newCandidate = {
        application_id: 102,
        job_id: 5,
        status: 'Passed Final Interview',
        available_slots: 2,
        updated_at: '2026-09-30T10:00:00Z'
      };
      const finalists = [waitlistCandidate, newCandidate];

      const resWaitlist = resolveFinalApprovalAction(waitlistCandidate, finalists);
      expect(resWaitlist.action).toBe('PROMOTE');

      const resNew = resolveFinalApprovalAction(newCandidate, finalists);
      expect(resNew.action).toBe('APPROVE');
      expect(resNew.unreservedSlots).toBe(1);
    });

    it('renders "Manage" for #1 waitlisted candidate and #2 waitlisted is disabled when 0 slots are available', () => {
      const waitlistCandidate1 = {
        application_id: 101,
        job_id: 5,
        status: 'Passed Final — Waiting for Slot',
        available_slots: 0,
        updated_at: '2026-09-29T10:00:00Z'
      };
      const waitlistCandidate2 = {
        application_id: 102,
        job_id: 5,
        status: 'Passed Final — Waiting for Slot',
        available_slots: 0,
        updated_at: '2026-09-29T11:00:00Z'
      };
      const finalists = [waitlistCandidate1, waitlistCandidate2];

      // Waitlist #1 candidate can be managed directly to add a slot & approve
      const resWaitlist1 = resolveFinalApprovalAction(waitlistCandidate1, finalists);
      expect(resWaitlist1.action).toBe('MANAGE');
      expect(resWaitlist1.rank).toBe(1);
      expect(resWaitlist1.isStandby).toBe(true);

      // Waitlist #2 candidate remains disabled until rank #1 is processed
      const resWaitlist2 = resolveFinalApprovalAction(waitlistCandidate2, finalists);
      expect(resWaitlist2.action).toBe('WAITLISTED_DISABLED');
      expect(resWaitlist2.rank).toBe(2);
    });
  });

});

