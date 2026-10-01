import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { TableSkeleton, DatabaseErrorState } from '../../../../components/Loading';
import { useToast } from '../../../../components/Toast/Toast';

import { API_BASE_URL } from '../../../../utils/apiConfig';
const JobsTab = ({ showToast: propShowToast }) => {
  const { showToast: localShowToast, ToastPortal } = useToast();
  const showToast = propShowToast || localShowToast;
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [jobToArchive, setJobToArchive] = useState(null);
  const [jobToRestore, setJobToRestore] = useState(null);
  const [jobToToggleHide, setJobToToggleHide] = useState(null);
  const [isTogglingHide, setIsTogglingHide] = useState(false);
  const [currentTab, setCurrentTab] = useState('active');
  const [currentPage, setCurrentPage] = useState(1);
  const JOBS_PAGE_SIZE = 8;
  
  const [newJob, setNewJob] = useState({ title: '', category: 'Operations', location: 'Airship Express HQ', employment_type: 'Full Time', salary: '', description: '', requirements: '', availability: 1, is_hidden: 0 });
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [modalError, setModalError] = useState(null);
  const [expandedField, setExpandedField] = useState(null); // 'description' | 'requirements' | null
  
  const fileInputRef = useRef(null);

  // Dynamic distinct categories collected ONLY from existing job records
  const existingCategories = useMemo(() => {
    const set = new Set();
    jobs.forEach(j => {
      const cat = (j.category || '').trim();
      if (cat && cat.toLowerCase() !== 'all' && cat.toLowerCase() !== 'general') {
        set.add(cat);
      }
    });
    // Sensible fallback if no jobs have categories yet
    if (set.size === 0) {
      set.add('Operations');
      set.add('Logistics');
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [jobs]);
  
  // Parsed requirements list for clean enlarged preview without cramped scrollbars
  const parsedRequirementsList = useMemo(() => {
    if (!newJob.requirements) return [];
    return newJob.requirements
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^[•\-\*\u2022\u2023\u25E6\u2043\u2219\d+\.\s]+/, '').trim())
      .filter(line => line.length > 0);
  }, [newJob.requirements]);

  // Parsed description paragraphs for clean enlarged preview
  const parsedDescriptionParagraphs = useMemo(() => {
    if (!newJob.description) return [];
    return newJob.description
      .split(/\r?\n\s*\r?\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }, [newJob.description]);

  // Close expanded modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && expandedField) {
        setExpandedField(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedField]);

  // Get admin identity for audit logging
  const adminUser = (() => {
    try { return JSON.parse(localStorage.getItem('hiring_user') || '{}'); } catch { return {}; }
  })();
  const actorId = adminUser?.id || adminUser?.User_ID || 1;
  const actorName = (adminUser?.first_name || adminUser?.User_Fname)
    ? `${adminUser.first_name || adminUser.User_Fname} ${adminUser.last_name || adminUser.User_Lname}`.trim()
    : (adminUser?.email || adminUser?.User_Email || 'Admin');

  // ── Application Template Management State ───────────────────────────────
  const [templateInfo, setTemplateInfo] = useState(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState(null);
  const [selectedTemplateFile, setSelectedTemplateFile] = useState(null);
  const [templateDisplayName, setTemplateDisplayName] = useState('');
  const [templateUploadError, setTemplateUploadError] = useState(null);
  const [templateUploading, setTemplateUploading] = useState(false);
  const [isTemplateDragOver, setIsTemplateDragOver] = useState(false);
  const templateFileInputRef = useRef(null);

  const fetchTemplateInfo = async () => {
    setTemplateLoading(true);
    setTemplateError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/get_template_info.php`);
      if (!response.ok) throw new Error(`Server returned status ${response.status}`);
      const data = await response.json();
      if (data.status === 'success') {
        setTemplateInfo(data.template);
      } else {
        throw new Error(data.message || 'Failed to load template information.');
      }
    } catch (err) {
      console.error("Failed to load template info:", err);
      setTemplateError(err.message || 'Error connecting to template server.');
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleTemplateFileSelect = (file) => {
    setTemplateUploadError(null);
    if (!file) return;

    const extension = file.name.split('.').pop().toLowerCase();
    if (extension !== 'docx') {
      setTemplateUploadError('Invalid File Format: Only Microsoft Word documents (.docx) are permitted. PDF and other formats are not accepted.');
      setSelectedTemplateFile(null);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setTemplateUploadError('File Too Large: Maximum allowed file size is 15 MB.');
      setSelectedTemplateFile(null);
      return;
    }

    setSelectedTemplateFile(file);
    if (!templateDisplayName) {
      setTemplateDisplayName(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleTemplateUploadSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedTemplateFile) {
      setTemplateUploadError('Please select a .docx file to upload.');
      return;
    }

    setTemplateUploading(true);
    setTemplateUploadError(null);

    try {
      const formData = new FormData();
      formData.append('template_file', selectedTemplateFile);
      formData.append('display_name', templateDisplayName.trim() || selectedTemplateFile.name);
      formData.append('actor_name', actorName);
      formData.append('actor_id', actorId);

      const response = await fetch(`${API_BASE_URL}/jobs/upload_template.php`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to upload and replace template.');
      }

      if (showToast) {
        showToast(data.message || 'Application template updated and replaced successfully!', 'success');
      }

      setSelectedTemplateFile(null);
      setTemplateDisplayName('');
      if (templateFileInputRef.current) {
        templateFileInputRef.current.value = '';
      }
      fetchTemplateInfo();
    } catch (err) {
      console.error("Template upload error:", err);
      setTemplateUploadError(err.message || 'Failed to upload template. Please try again.');
    } finally {
      setTemplateUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  useEffect(() => {
    setCurrentPage(1);
    if (currentTab === 'template') {
      fetchTemplateInfo();
    } else {
      fetchJobs();
    }
  }, [currentTab]);

  const fetchJobs = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const url = currentTab === 'archived'
        ? `${API_BASE_URL}/jobs/get_jobs.php?archived_only=true`
        : `${API_BASE_URL}/jobs/get_jobs.php`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Server returned status ${response.status}`);
      const data = await response.json();
      if (data.status === 'success') {
        setJobs(data.jobs || []);
      } else {
        throw new Error(data.message || 'Failed to load job listings.');
      }
    } catch (err) {
      console.error("Failed to load jobs list:", err);
      setFetchError(err.message || 'Database connection error while retrieving job postings.');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditMode(false);
    setCurrentJobId(null);
    setModalError(null);
    const initialCat = existingCategories[0] || 'Operations';
    setNewJob({ 
      title: '', 
      category: initialCat, 
      location: 'Airship Express HQ', 
      employment_type: 'Full Time',
      salary: '',
      description: '',
      requirements: '', 
      availability: 1,
      is_hidden: 0
    });
    setIsCustomCategory(false);
    setCustomCategoryInput('');
    setSelectedImage(null);
    setImagePreview(null);
    setExpandedField(null);
    setJobModalOpen(true);
  };

  const openEditModal = (job) => {
    setEditMode(true);
    setCurrentJobId(job.id);
    setModalError(null);
    const cat = (job.category || '').trim() || 'Operations';
    const isKnown = existingCategories.includes(cat);
    if (!isKnown && cat.toLowerCase() !== 'general') {
      setIsCustomCategory(true);
      setCustomCategoryInput(cat);
    } else {
      setIsCustomCategory(false);
      setCustomCategoryInput('');
    }
    setNewJob({ 
      title: job.title, 
      category: isKnown ? cat : (existingCategories[0] || 'Operations'),
      location: job.location || 'Airship Express HQ',
      employment_type: job.employment_type || 'Full Time',
      salary: job.salary || '',
      description: job.description || '',
      requirements: job.requirements, 
      availability: job.total_slots ?? job.raw_availability ?? job.availability ?? 1,
      is_hidden: parseInt(job.is_hidden) === 1 ? 1 : 0
    });
    setSelectedImage(null);
    setImagePreview(job.image_path ? `${API_BASE_URL}/${job.image_path}` : null);
    setExpandedField(null);
    setJobModalOpen(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveJob = async (e) => {
    e.preventDefault();
    setModalError(null);
    const finalCategory = isCustomCategory 
        ? (customCategoryInput.trim() || 'Operations') 
        : (newJob.category || 'Operations');

    const formData = new FormData();
    formData.append('title', newJob.title);
    formData.append('category', finalCategory);
    formData.append('location', newJob.location?.trim() || 'Airship Express HQ');
    formData.append('employment_type', newJob.employment_type || 'Full Time');
    formData.append('salary', newJob.salary?.trim() || '');
    formData.append('description', newJob.description?.trim() || '');
    formData.append('requirements', newJob.requirements);
    formData.append('availability', newJob.availability);
    formData.append('is_hidden', newJob.is_hidden ? 1 : 0);
    
    const computedStatus = parseInt(newJob.availability) > 0 ? 'Active' : 'Closed';
    formData.append('status', computedStatus);
    
    formData.append('actor_id', actorId);
    formData.append('actor_name', actorName);

    if (selectedImage) {
      formData.append('image', selectedImage);
    }

    const url = editMode 
      ? `${API_BASE_URL}/jobs/update_job.php`
      : `${API_BASE_URL}/jobs/add_job.php`;
      
    if (editMode) {
      formData.append('id', currentJobId);
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
        },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setJobModalOpen(false);
        setModalError(null);
        if (showToast) showToast(editMode ? 'Job position updated successfully.' : 'New job position created successfully.', 'success');
        fetchJobs();
      } else {
        const errorMsg = data.message || "Failed to save job.";
        setModalError(errorMsg);
        if (showToast) showToast(errorMsg, 'danger');
      }
    } catch (e) { 
      console.error(e); 
      setModalError("Failed to save job. Please check server connection.");
      if (showToast) showToast("Failed to save job. Please check server connection.", 'danger');
    }
  };

  const handleArchiveJob = async () => {
    if (!jobToArchive) return;
    try {
      const res = await fetch(`${API_BASE_URL}/jobs/archive_job.php`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
        },
        body: JSON.stringify({ id: jobToArchive.id, actor_id: actorId, actor_name: actorName })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setJobToArchive(null);
        if (showToast) showToast('Job position archived successfully.', 'success');
        fetchJobs();
      } else {
        const msg = data.message || "Failed to archive job.";
        if (showToast) showToast(msg, 'danger');
      }
    } catch (e) {
      console.error(e);
      if (showToast) showToast("Connection error while archiving job.", 'danger');
    }
  };

  const handleRestoreJob = async () => {
    if (!jobToRestore) return;
    try {
      const res = await fetch(`${API_BASE_URL}/jobs/restore_job.php`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
        },
        body: JSON.stringify({ id: jobToRestore.id, actor_id: actorId, actor_name: actorName })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setJobToRestore(null);
        if (showToast) showToast('Job position restored and activated successfully.', 'success');
        fetchJobs();
      } else {
        const msg = data.message || "Failed to restore job.";
        if (showToast) showToast(msg, 'danger');
      }
    } catch (e) {
      console.error(e);
      if (showToast) showToast("Connection error while restoring job.", 'danger');
    }
  };

  const handleToggleHideJob = async () => {
    if (!jobToToggleHide) return;
    setIsTogglingHide(true);
    try {
      const isCurrentlyHidden = parseInt(jobToToggleHide.is_hidden) === 1;
      const res = await fetch(`${API_BASE_URL}/jobs/toggle_hide.php`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
        },
        body: JSON.stringify({
          id: jobToToggleHide.id || jobToToggleHide.job_id,
          is_hidden: isCurrentlyHidden ? 0 : 1,
          actor_id: actorId,
          actor_name: actorName
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        const title = jobToToggleHide.title;
        setJobToToggleHide(null);
        if (showToast) {
          showToast(
            isCurrentlyHidden
              ? `"${title}" unhidden. Public intake is now active.`
              : `"${title}" hidden. Public intake is now paused.`,
            'success'
          );
        }
        fetchJobs();
      } else {
        const msg = data.message || "Failed to update job visibility.";
        if (showToast) showToast(msg, 'danger');
      }
    } catch (e) {
      console.error(e);
      if (showToast) showToast("Connection error while updating job visibility.", 'danger');
    } finally {
      setIsTogglingHide(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!jobToDelete) return;
    try {
      const res = await fetch(`${API_BASE_URL}/jobs/delete_job.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}` },
        body: JSON.stringify({ id: jobToDelete.id, actor_id: actorId, actor_name: actorName })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setJobToDelete(null);
        if (showToast) showToast('Job position deleted permanently.', 'success');
        fetchJobs();
      } else {
        const msg = data.message || "Failed to delete job.";
        if (showToast) showToast(msg, 'danger');
      }
    } catch (e) {
      console.error(e);
      if (showToast) showToast("Connection error while deleting job.", 'danger');
    }
  };

  return (
    <>
      <div className="admin-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="admin-header-title">Job Posting</h1>
          <p style={{ color: '#64748b', fontSize: '13.5px', margin: '4px 0 0 0' }}>
            {currentTab === 'template'
              ? 'Manage and replace the official Word template (.docx) that candidates download when applying.'
              : 'Manage recruitment positions, vacancy slot availability, and job listing status.'}
          </p>
        </div>
        {currentTab !== 'template' ? (
          <button 
            className="admin-btn-primary" 
            onClick={openAddModal}
            style={{
              background: '#e6007e',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '13.5px',
              padding: '10px 22px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(230, 0, 126, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: "'Montserrat', sans-serif"
            }}
          >
            <i className='bx bx-plus-circle' style={{ fontSize: '18px' }}></i> Create Job Posting
          </button>
        ) : (
          <button
            type="button"
            onClick={() => templateFileInputRef.current && templateFileInputRef.current.click()}
            style={{
              background: '#0f172a',
              color: '#ffffff',
              fontWeight: '600',
              fontSize: '13px',
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              fontFamily: "'Montserrat', sans-serif",
              transition: 'all 0.15s ease'
            }}
          >
            <i className='bx bx-upload' style={{ fontSize: '16px' }}></i> Replace Template
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setCurrentTab('active')}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            border: currentTab === 'active' ? '1.5px solid #0f172a' : '1.5px solid #e2e8f0',
            background: currentTab === 'active' ? '#0f172a' : '#ffffff',
            color: currentTab === 'active' ? '#ffffff' : '#64748b',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Active Listings
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('archived')}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            border: currentTab === 'archived' ? '1.5px solid #0f172a' : '1.5px solid #e2e8f0',
            background: currentTab === 'archived' ? '#0f172a' : '#ffffff',
            color: currentTab === 'archived' ? '#ffffff' : '#64748b',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Archived Listings
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab('template')}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            border: currentTab === 'template' ? '1.5px solid #0f172a' : '1.5px solid #e2e8f0',
            background: currentTab === 'template' ? '#0f172a' : '#ffffff',
            color: currentTab === 'template' ? '#ffffff' : '#64748b',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          Application Template
        </button>
      </div>

      {currentTab === 'template' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card 1: Active Live Template */}
          <div style={{
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '20px 24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f8fafc',
                  color: '#334155',
                  border: '1px solid #e2e8f0',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                  Active in Job Applications
                </span>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                  Served dynamically to applicants in the Vacancy application modal
                </span>
              </div>

              {templateInfo && (
                <a
                  href={templateInfo.download_url || `${API_BASE_URL}/jobs/download_template.php`}
                  download={templateInfo.original_filename || "RESUME TEMPLATE.docx"}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '7px 15px',
                    background: '#ffffff',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Download Current Template (.docx)
                </a>
              )}
            </div>

            {templateLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                <p style={{ margin: 0, fontSize: '13px' }}>Loading template details...</p>
              </div>
            ) : templateError ? (
              <div style={{ padding: '14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '13px' }}>
                Failed to load template info: {templateError}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
                {/* Minimalist Professional Document Icon Box */}
                <div style={{
                  width: '48px',
                  height: '54px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#334155',
                  flexShrink: 0
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                  <span style={{ fontSize: '9px', fontWeight: '700', color: '#64748b', marginTop: '2px', letterSpacing: '0.5px' }}>DOCX</span>
                </div>

                {/* Template Info Breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '240px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                      {templateInfo?.original_filename || 'RESUME TEMPLATE.docx'}
                    </h3>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '500',
                      padding: '1px 7px',
                      borderRadius: '4px',
                      background: '#f8fafc',
                      color: '#64748b',
                      border: '1px solid #e2e8f0'
                    }}>
                      Word Document
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    {templateInfo?.display_name || 'Standard Airship Express Job Application Template'}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '2px', flexWrap: 'wrap', fontSize: '12px', color: '#64748b' }}>
                    <span>
                      File Size: <strong style={{ color: '#334155' }}>{formatFileSize(templateInfo?.file_size)}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Last Updated: <strong style={{ color: '#334155' }}>{templateInfo?.updated_at || 'Default'}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Updated By: <strong style={{ color: '#334155' }}>{templateInfo?.updated_by || 'Admin'}</strong>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Upload & Replace Section */}
          <div style={{
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '22px 24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                Upload & Replace Application Template
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Upload a new Microsoft Word (.docx) file to replace the active template. Candidates applying will download this updated document.
              </p>
            </div>

            {/* Error Message */}
            {templateUploadError && (
              <div style={{
                margin: '0 0 14px 0',
                padding: '10px 14px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span style={{ fontSize: '12.5px', color: '#b91c1c', fontWeight: '500' }}>
                  {templateUploadError}
                </span>
              </div>
            )}

            {/* Unified Upload Box: File details and actions are rendered directly INSIDE this box */}
            <div
              onDragOver={(e) => { e.preventDefault(); if (!selectedTemplateFile) setIsTemplateDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsTemplateDragOver(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsTemplateDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleTemplateFileSelect(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => {
                if (!selectedTemplateFile && templateFileInputRef.current) {
                  templateFileInputRef.current.click();
                }
              }}
              style={{
                border: isTemplateDragOver ? '1.5px dashed #0f172a' : '1.5px dashed #cbd5e1',
                background: isTemplateDragOver ? '#f1f5f9' : '#fafafa',
                borderRadius: '10px',
                padding: selectedTemplateFile ? '20px 24px' : '32px 20px',
                textAlign: selectedTemplateFile ? 'left' : 'center',
                cursor: selectedTemplateFile ? 'default' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <input
                ref={templateFileInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleTemplateFileSelect(e.target.files[0]);
                  }
                }}
                style={{ display: 'none' }}
              />

              {!selectedTemplateFile ? (
                /* Empty Dropzone State */
                <>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: '#f1f5f9',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                  </div>

                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                    Drag and drop your new .docx template here, or <span style={{ textDecoration: 'underline', color: '#334155' }}>browse</span>
                  </p>
                  <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Strictly Microsoft Word (.docx) • Max 15 MB
                  </p>
                </>
              ) : (
                /* Selected File State INSIDE THE BOX */
                <div style={{ maxWidth: '520px', margin: '0 auto' }}>
                  {/* Selected File Details */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    marginBottom: '14px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '6px',
                        background: '#f1f5f9',
                        color: '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: '700',
                        flexShrink: 0
                      }}>
                        DOCX
                      </div>
                      <div style={{ minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {selectedTemplateFile.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {formatFileSize(selectedTemplateFile.size)} • Ready to replace live template
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTemplateFile(null);
                        setTemplateDisplayName('');
                        if (templateFileInputRef.current) templateFileInputRef.current.value = '';
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11.5px',
                        color: '#64748b',
                        cursor: 'pointer',
                        fontWeight: '500',
                        flexShrink: 0,
                        marginLeft: '8px'
                      }}
                    >
                      Change
                    </button>
                  </div>

                  {/* Display Name Input */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                      Template Display Title (Optional)
                    </label>
                    <input
                      type="text"
                      value={templateDisplayName}
                      onChange={(e) => setTemplateDisplayName(e.target.value)}
                      placeholder="e.g. Standard Application Resume Template 2026"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box',
                        background: '#ffffff'
                      }}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTemplateFile(null);
                        setTemplateDisplayName('');
                        if (templateFileInputRef.current) templateFileInputRef.current.value = '';
                      }}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '7px 14px',
                        fontSize: '12.5px',
                        color: '#475569',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleTemplateUploadSubmit}
                      disabled={templateUploading}
                      style={{
                        background: '#0f172a',
                        color: '#ffffff',
                        fontWeight: '600',
                        fontSize: '12.5px',
                        padding: '7px 18px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: templateUploading ? 'not-allowed' : 'pointer',
                        opacity: templateUploading ? 0.7 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {templateUploading ? (
                        <>
                          <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                          Replacing...
                        </>
                      ) : (
                        'Upload & Replace Template'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
      <div className="admin-table-card">
        {loading ? (
          <TableSkeleton
            columns={['Position Title', 'Category', 'Vacancy Availability', 'Date Posted', 'Actions']}
            columnTypes={['avatar', 'status', 'text', 'date', 'actions']}
            rows={4}
          />
        ) : fetchError ? (
          <DatabaseErrorState
            title="Unable to Load Job Postings"
            message={fetchError}
            onRetry={fetchJobs}
          />
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>
            <p style={{ margin: 0, fontSize: '14px' }}>
              {currentTab === 'active' ? 'No active job postings found.' : 'No archived job listings.'}
            </p>
          </div>
        ) : (() => {
          const totalPages = Math.max(1, Math.ceil(jobs.length / JOBS_PAGE_SIZE));
          const safeCurrentPage = Math.min(currentPage, totalPages);
          const paginatedJobs = jobs.slice((safeCurrentPage - 1) * JOBS_PAGE_SIZE, safeCurrentPage * JOBS_PAGE_SIZE);

          return (
            <>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Position Title</th>
                    <th>Category</th>
                    <th>Vacancy Availability</th>
                    <th>Date Posted</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                {paginatedJobs.map(j => (
                  <tr key={j.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {j.image_path ? (
                          <img src={`${API_BASE_URL}/${j.image_path}`} alt="" style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                        ) : (
                          <div style={{ width: '42px', height: '42px', background: '#f1f5f9', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '14.5px' }}>{j.title}</span>
                            {parseInt(j.is_hidden) === 1 && (
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                padding: '2px 8px', 
                                borderRadius: '12px', 
                                fontSize: '11px', 
                                fontWeight: '700', 
                                background: '#fef3c7', 
                                color: '#92400e', 
                                border: '1px solid #fde68a' 
                              }}>
                                <i className='bx bx-hide'></i> Hidden (Intake Paused)
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: '700', 
                              padding: '1px 7px', 
                              borderRadius: '4px', 
                              background: j.employment_type === 'Part Time' ? '#fef3c7' : '#eff6ff', 
                              color: j.employment_type === 'Part Time' ? '#b45309' : '#1d4ed8',
                              border: j.employment_type === 'Part Time' ? '1px solid #fde68a' : '1px solid #bfdbfe'
                            }}>
                              {j.employment_type || 'Full Time'}
                            </span>
                            {j.salary && (
                              <span style={{ fontSize: '11.5px', color: '#059669', fontWeight: '700' }}>
                                ₱ {j.salary}
                              </span>
                            )}
                            <span style={{ fontSize: '12px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <i className='bx bx-map' style={{ color: '#ec4899', fontSize: '13px' }}></i> {j.location || 'Airship Express HQ'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '13.5px', color: '#475569', fontWeight: '500' }}>{j.category || 'N/A'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: '700',
                          background: parseInt(j.availability) === 0 ? '#fef2f2' : '#f0fdf4',
                          color: parseInt(j.availability) === 0 ? '#991b1b' : '#166534',
                          border: parseInt(j.availability) === 0 ? '1px solid #fecaca' : '1px solid #bbf7d0'
                        }}>
                          {parseInt(j.availability) === 0 ? '0 Slot' : `${j.availability} Slot${parseInt(j.availability) !== 1 ? 's' : ''}`}
                        </span>
                        {parseInt(j.is_hidden) === 1 && (
                          <span style={{ fontSize: '11px', color: '#b45309', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <i className='bx bx-pause-circle'></i> Intake Paused
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>
                        {j.created_at ? new Date(j.created_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {currentTab === 'active' ? (
                          <>
                            <button
                              type="button"
                              style={{
                                background: parseInt(j.is_hidden) === 1 ? '#ecfdf5' : '#f8fafc',
                                border: parseInt(j.is_hidden) === 1 ? '1px solid #a7f3d0' : '1.5px solid #cbd5e1',
                                color: parseInt(j.is_hidden) === 1 ? '#047857' : '#475569',
                                fontWeight: '600',
                                fontSize: '13px',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s ease'
                              }}
                              onClick={() => setJobToToggleHide(j)}
                              title={parseInt(j.is_hidden) === 1 ? 'Unhide job and resume public intake' : 'Hide job to pause intake from new applicants'}
                            >
                              <i className={parseInt(j.is_hidden) === 1 ? 'bx bx-show' : 'bx bx-hide'} style={{ fontSize: '14px' }}></i>
                              {parseInt(j.is_hidden) === 1 ? 'Unhide' : 'Hide'}
                            </button>
                            <button
                              style={{
                                background: '#ffffff',
                                border: '1.5px solid #cbd5e1',
                                color: '#0f172a',
                                fontWeight: '600',
                                fontSize: '13px',
                                padding: '6px 14px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onClick={() => openEditModal(j)}
                            >
                              Edit
                            </button>
                            <button
                              style={{
                                background: '#fee2e2',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                fontWeight: '600',
                                fontSize: '13px',
                                padding: '6px 14px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onClick={() => setJobToArchive(j)}
                            >
                              Archive
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              style={{
                                background: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                color: '#166534',
                                fontWeight: '600',
                                fontSize: '13px',
                                padding: '6px 14px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onClick={() => setJobToRestore(j)}
                            >
                              Restore
                            </button>
                            <button
                              style={{
                                background: '#fee2e2',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                fontWeight: '600',
                                fontSize: '13px',
                                padding: '6px 14px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onClick={() => setJobToDelete(j)}
                            >
                              Delete Permanently
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {jobs.length > 0 && (
              <div style={{
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid #e2e8f0',
                background: '#ffffff',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>
                  Showing <strong>{(safeCurrentPage - 1) * JOBS_PAGE_SIZE + 1}</strong> to <strong>{Math.min(safeCurrentPage * JOBS_PAGE_SIZE, jobs.length)}</strong> of <strong>{jobs.length}</strong> job posting{jobs.length !== 1 ? 's' : ''}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: safeCurrentPage <= 1 ? '#f8fafc' : '#ffffff',
                      color: safeCurrentPage <= 1 ? '#94a3b8' : '#334155',
                      cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}
                  >
                    &larr; Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '6px',
                        border: safeCurrentPage === p ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                        background: safeCurrentPage === p ? '#0f172a' : '#ffffff',
                        color: safeCurrentPage === p ? '#ffffff' : '#334155',
                        fontWeight: safeCurrentPage === p ? '700' : '500',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: safeCurrentPage >= totalPages ? '#f8fafc' : '#ffffff',
                      color: safeCurrentPage >= totalPages ? '#94a3b8' : '#334155',
                      cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>
            )}
          </>
        );
      })()}
      </div>
      )}

      {jobModalOpen && ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="admin-modal-card" style={{ background: 'white', padding: '28px', borderRadius: '12px', width: '580px', maxWidth: '92%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>{editMode ? 'Edit Job Posting' : 'Create Job Posting'}</h3>
            {modalError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', fontWeight: '600' }}>
                {modalError}
              </div>
            )}
            <form onSubmit={handleSaveJob}>
              
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', marginBottom: '8px', letterSpacing: '0.5px' }}>Job Image (JPG/PNG)</label>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div 
                    style={{ width: '110px', height: '110px', border: '2px dashed #cbd5e1', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', background: '#f8fafc', flexShrink: 0 }}
                    onClick={() => fileInputRef.current.click()}
                  >
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#64748b' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        <div style={{ fontSize: '11px', marginTop: '4px', fontWeight: '600' }}>Upload Image</div>
                      </div>
                    )}
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageChange} 
                      accept="image/jpeg, image/png, image/webp" 
                      style={{ display: 'none' }} 
                    />
                    <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 8px 0', lineHeight: '1.4' }}>Upload a photo for this role. It will be featured on the Vacancies platform.</p>
                    {selectedImage && <p style={{ fontSize: '12.5px', color: '#10b981', fontWeight: '600', margin: 0 }}>Selected: {selectedImage.name}</p>}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px', letterSpacing: '0.5px' }}>Job Title</label>
                <input required type="text" placeholder="e.g. Flight Attendant" value={newJob.title} onChange={e => setNewJob({...newJob, title: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                    Job Category
                  </label>
                  {isCustomCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomCategory(false);
                        setCustomCategoryInput('');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ec4899',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      <i className='bx bx-list-ul' style={{ fontSize: '15px' }}></i> Choose from existing list
                    </button>
                  )}
                </div>

                {!isCustomCategory ? (
                  <div style={{ position: 'relative', width: '100%' }}>
                    <select
                      value={newJob.category}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCustomCategory(true);
                          setCustomCategoryInput('');
                        } else {
                          setNewJob({ ...newJob, category: e.target.value });
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '11px 40px 11px 14px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: '14px',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                    >
                      {existingCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__custom__">+ Add New Category...</option>
                    </select>
                    <i 
                      className="bx bx-chevron-down" 
                      style={{ 
                        position: 'absolute', 
                        right: '14px', 
                        top: '50%', 
                        transform: 'translateY(-50%)', 
                        fontSize: '20px', 
                        color: '#64748b', 
                        pointerEvents: 'none' 
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        required
                        type="text"
                        placeholder="Enter new category name (e.g. Flight Operations)..."
                        value={customCategoryInput}
                        onChange={(e) => setCustomCategoryInput(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          borderRadius: '8px',
                          border: '1.5px solid #ec4899',
                          background: '#fdf2f8',
                          color: '#0f172a',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                          fontFamily: 'inherit',
                          outline: 'none',
                          boxShadow: '0 0 0 3px rgba(236, 72, 153, 0.12)'
                        }}
                        autoFocus
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomCategory(false);
                        setCustomCategoryInput('');
                      }}
                      title="Switch back to dropdown list"
                      style={{
                        height: '44px',
                        padding: '0 14px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#475569',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#475569'; }}
                    >
                      <i className='bx bx-x' style={{ fontSize: '18px' }}></i> Cancel
                    </button>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px', letterSpacing: '0.5px' }}>
                  Company Location / Hub
                </label>
                <div style={{ position: 'relative' }}>
                  <i className="bx bx-map" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: '#ec4899', pointerEvents: 'none' }}></i>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Pasay City, Metro Manila or Main Office Hub"
                    value={newJob.location}
                    onChange={e => setNewJob({ ...newJob, location: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 38px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px', letterSpacing: '0.5px' }}>
                    Employment Type
                  </label>
                  <select
                    value={newJob.employment_type || 'Full Time'}
                    onChange={e => setNewJob({ ...newJob, employment_type: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="Full Time">Full Time</option>
                    <option value="Part Time">Part Time</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px', letterSpacing: '0.5px' }}>
                    Salary / Compensation
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: '#64748b', fontSize: '14px', pointerEvents: 'none' }}>₱</span>
                    <input
                      type="text"
                      placeholder="e.g. 25,000 - 35,000 / month"
                      value={newJob.salary || ''}
                      onChange={e => setNewJob({ ...newJob, salary: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 28px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                    Job Description / Role Overview
                  </label>
                  <button
                    type="button"
                    onClick={() => setExpandedField('description')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '5px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: '11.5px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                    title="Expand view"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <polyline points="9 21 3 21 3 15"></polyline>
                      <line x1="21" y1="3" x2="14" y2="10"></line>
                      <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>
                    Expand / View Full
                  </button>
                </div>
                <textarea
                  placeholder="Provide an overview of the role, core responsibilities, and day-to-day duties..."
                  value={newJob.description || ''}
                  onChange={e => setNewJob({ ...newJob, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    minHeight: '85px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontFamily: 'inherit',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                    Requirements / Qualifications
                  </label>
                  <button
                    type="button"
                    onClick={() => setExpandedField('requirements')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '5px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: '11.5px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                    title="Expand view"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <polyline points="9 21 3 21 3 15"></polyline>
                      <line x1="21" y1="3" x2="14" y2="10"></line>
                      <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>
                    Expand / View Full
                  </button>
                </div>
                <textarea 
                  required 
                  placeholder="List minimum qualifications and requirements..." 
                  value={newJob.requirements} 
                  onChange={e => setNewJob({...newJob, requirements: e.target.value})} 
                  style={{ 
                    width: '100%', 
                    padding: '10px 14px', 
                    minHeight: '110px', 
                    borderRadius: '8px', 
                    border: '1.5px solid #cbd5e1', 
                    fontFamily: 'inherit', 
                    background: '#ffffff', 
                    color: '#0f172a', 
                    fontSize: '13.5px', 
                    boxSizing: 'border-box', 
                    resize: 'vertical' 
                  }} 
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px', letterSpacing: '0.5px' }}>Availability (Open Positions)</label>
                <input required type="number" min="1" value={newJob.availability} onChange={e => {
                  const val = parseInt(e.target.value) || 0;
                  setNewJob(prev => ({
                    ...prev,
                    availability: val
                  }));
                }} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => { setJobModalOpen(false); setExpandedField(null); }} style={{ padding: '10px 20px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontWeight: '600', color: '#475569', fontSize: '13.5px' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #ec4899, #db2777)', color: 'white', cursor: 'pointer', fontWeight: '700', fontSize: '13.5px', boxShadow: '0 4px 10px rgba(236, 72, 153, 0.3)' }}>Save Job</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Enlarged Modal for Job Description & Requirements ── */}
      {jobModalOpen && expandedField && ReactDOM.createPortal(
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            width: '100vw', 
            height: '100vh', 
            zIndex: 10050, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            background: 'rgba(15, 23, 42, 0.65)', 
            backdropFilter: 'blur(3px)',
            padding: '20px',
            boxSizing: 'border-box'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setExpandedField(null);
            }
          }}
        >
          <div 
            className="admin-modal-card" 
            style={{ 
              background: '#ffffff', 
              borderRadius: '12px', 
              width: '900px', 
              maxWidth: '95vw', 
              height: '80vh', 
              maxHeight: '750px', 
              display: 'flex', 
              flexDirection: 'column', 
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)', 
              border: '1px solid #cbd5e1',
              overflow: 'hidden' 
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: '1px solid #e2e8f0',
              background: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setExpandedField('description')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: expandedField === 'description' ? '#0f172a' : '#cbd5e1',
                    background: expandedField === 'description' ? '#0f172a' : '#ffffff',
                    color: expandedField === 'description' ? '#ffffff' : '#475569',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Job Description
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedField('requirements')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: expandedField === 'requirements' ? '#0f172a' : '#cbd5e1',
                    background: expandedField === 'requirements' ? '#0f172a' : '#ffffff',
                    color: expandedField === 'requirements' ? '#ffffff' : '#475569',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Requirements ({parsedRequirementsList.length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setExpandedField(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>

            {/* Body */}
            <div style={{
              flex: 1,
              minHeight: 0,
              padding: '20px',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {expandedField === 'description' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                    Job Description
                  </label>
                  <textarea
                    autoFocus
                    placeholder="Provide an overview of the role, core responsibilities, and day-to-day duties..."
                    value={newJob.description || ''}
                    onChange={e => setNewJob(prev => ({ ...prev, description: e.target.value }))}
                    style={{
                      flex: 1,
                      width: '100%',
                      padding: '14px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      resize: 'none',
                      outline: 'none'
                    }}
                  />
                </div>
              )}

              {expandedField === 'requirements' && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  height: '100%',
                  minHeight: 0
                }}>
                  {/* Left: Simple Edit */}
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                    <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                      Edit Requirements (One per line)
                    </label>
                    <textarea
                      autoFocus
                      placeholder="List qualifications and requirements (one per line)..."
                      value={newJob.requirements || ''}
                      onChange={e => setNewJob(prev => ({ ...prev, requirements: e.target.value }))}
                      style={{
                        flex: 1,
                        width: '100%',
                        padding: '14px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                        resize: 'none',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Right: Simple List View */}
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                    <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                      Requirements List ({parsedRequirementsList.length})
                    </label>
                    <div style={{
                      flex: 1,
                      background: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '14px',
                      overflowY: 'auto',
                      boxSizing: 'border-box'
                    }}>
                      {parsedRequirementsList.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {parsedRequirementsList.map((req, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px',
                                padding: '8px 12px',
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px'
                              }}
                            >
                              <span style={{ color: '#475569', fontWeight: '700', fontSize: '14px', flexShrink: 0 }}>•</span>
                              <div style={{ fontSize: '13.5px', color: '#0f172a', lineHeight: '1.4' }}>
                                {req}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
                          No requirements listed yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '12px 20px',
              borderTop: '1px solid #e2e8f0',
              background: '#ffffff'
            }}>
              <button
                type="button"
                onClick={() => setExpandedField(null)}
                style={{
                  padding: '8px 22px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#0f172a',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13.5px'
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {jobToArchive && ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="admin-modal-card" style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '400px', maxWidth: '92%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#ffedd5', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8v13H3V8"></path><path d="M1 3h22v5H1z"></path><path d="M10 12h4"></path></svg>
            </div>
            <h3 style={{ marginBottom: '10px', color: '#0f172a', fontSize: '19px', fontWeight: '700' }}>Archive Job Posting</h3>
            <p style={{ marginBottom: '24px', color: '#64748b', fontSize: '14px', lineHeight: '1.5' }}>Are you sure you want to archive the job posting for <strong>{jobToArchive.title}</strong>? It will be hidden from active lists but historical applications will be preserved.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button onClick={() => setJobToArchive(null)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: '600', color: '#475569', fontSize: '13.5px' }}>Cancel</button>
              <button onClick={handleArchiveJob} style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: '#ea580c', color: 'white', cursor: 'pointer', fontWeight: '700', fontSize: '13.5px', boxShadow: '0 4px 10px rgba(234, 88, 12, 0.3)' }}>Archive Job</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {jobToRestore && ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="admin-modal-card" style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '420px', maxWidth: '92%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 .49-3.5"></path></svg>
            </div>
            <h3 style={{ marginBottom: '10px', color: '#0f172a', fontSize: '19px', fontWeight: '700' }}>Restore Job Posting</h3>
            <p style={{ marginBottom: '24px', color: '#64748b', fontSize: '14px', lineHeight: '1.5' }}>Are you sure you want to restore <strong>{jobToRestore.title}</strong> back to the active listings? It will be visible to applicants again.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button onClick={() => setJobToRestore(null)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: '600', color: '#475569', fontSize: '13.5px' }}>Cancel</button>
              <button onClick={handleRestoreJob} style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: '#16a34a', color: 'white', cursor: 'pointer', fontWeight: '700', fontSize: '13.5px', boxShadow: '0 4px 10px rgba(22, 163, 74, 0.3)' }}>Restore Job</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {jobToDelete && ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="admin-modal-card" style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '420px', maxWidth: '92%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </div>
            <h3 style={{ marginBottom: '12px', color: '#0f172a', fontSize: '19px', fontWeight: '700' }}>Delete Job Posting Permanently</h3>
            <p style={{ marginBottom: '14px', color: '#334155', fontSize: '14px', fontWeight: '600', lineHeight: '1.4' }}>Are you sure you want to permanently delete <strong>{jobToDelete.title}</strong>?</p>
            <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '8px', padding: '12px 14px', marginBottom: '22px', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <i className="bx bx-error" style={{ color: '#dc2626', fontSize: '18px', marginTop: '1px', flexShrink: 0 }}></i>
              <p style={{ margin: 0, color: '#991b1b', fontSize: '12.5px', lineHeight: '1.45', fontWeight: '500' }}>
                <strong>Warning:</strong> All associated applicant submissions and interview records for this position will also be permanently deleted. This action cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button onClick={() => setJobToDelete(null)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: '600', color: '#475569', fontSize: '13.5px' }}>Cancel</button>
              <button onClick={handleDeleteJob} style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: '700', fontSize: '13.5px', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)' }}>Delete Permanently</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {jobToToggleHide && ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="admin-modal-card" style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '440px', maxWidth: '92%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: parseInt(jobToToggleHide.is_hidden) === 1 ? '#ecfdf5' : '#fef3c7',
              color: parseInt(jobToToggleHide.is_hidden) === 1 ? '#059669' : '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '28px'
            }}>
              <i className={parseInt(jobToToggleHide.is_hidden) === 1 ? 'bx bx-show' : 'bx bx-hide'}></i>
            </div>
            <h3 style={{ marginBottom: '10px', color: '#0f172a', fontSize: '19px', fontWeight: '700' }}>
              {parseInt(jobToToggleHide.is_hidden) === 1 ? 'Unhide Job Vacancy' : 'Hide Job Vacancy (Pause Intake)'}
            </h3>
            <p style={{ marginBottom: '18px', color: '#475569', fontSize: '13.5px', lineHeight: '1.55' }}>
              {parseInt(jobToToggleHide.is_hidden) === 1 ? (
                <>
                  Are you sure you want to unhide <strong>{jobToToggleHide.title}</strong>? The job vacancy will become publicly visible to all guests and applicants again on the Job Vacancies page.
                </>
              ) : (
                <>
                  Are you sure you want to hide <strong>{jobToToggleHide.title}</strong> from public listings?
                </>
              )}
            </p>
            {parseInt(jobToToggleHide.is_hidden) !== 1 && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', marginBottom: '22px', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <i className="bx bx-info-circle" style={{ color: '#0284c7', fontSize: '18px', marginTop: '1px', flexShrink: 0 }}></i>
                <div style={{ margin: 0, color: '#334155', fontSize: '12.5px', lineHeight: '1.45' }}>
                  <strong>Visibility Rules:</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    <li><strong>Guests & New Applicants:</strong> Hidden (cannot view or apply).</li>
                    <li><strong>Existing Applicants:</strong> Remains visible so they can track their application.</li>
                  </ul>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                disabled={isTogglingHide}
                onClick={() => setJobToToggleHide(null)}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: '600', color: '#475569', fontSize: '13.5px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isTogglingHide}
                onClick={handleToggleHideJob}
                style={{
                  padding: '10px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  background: parseInt(jobToToggleHide.is_hidden) === 1 ? '#059669' : '#0f172a',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '13.5px',
                  boxShadow: parseInt(jobToToggleHide.is_hidden) === 1 ? '0 4px 10px rgba(5, 150, 105, 0.3)' : '0 4px 10px rgba(15, 23, 42, 0.3)'
                }}
              >
                {isTogglingHide ? 'Updating...' : (parseInt(jobToToggleHide.is_hidden) === 1 ? 'Unhide Job' : 'Hide Job')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Standalone Toast Portal */}
      {!propShowToast && <ToastPortal />}
    </>
  );
};

export default JobsTab;
