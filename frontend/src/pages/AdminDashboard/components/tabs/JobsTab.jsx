import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

const JobsTab = () => {
  const [jobs, setJobs] = useState([]);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [jobToDelete, setJobToDelete] = useState(null);
  
  const [newJob, setNewJob] = useState({ title: '', requirements: '', availability: 1 });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  const fileInputRef = useRef(null);
  
  // Get admin identity for audit logging
  const adminUser = (() => {
    try { return JSON.parse(localStorage.getItem('hiring_user') || '{}'); } catch { return {}; }
  })();
  const actorId = adminUser?.id || adminUser?.User_ID || 1;
  const actorName = (adminUser?.first_name || adminUser?.User_Fname)
    ? `${adminUser.first_name || adminUser.User_Fname} ${adminUser.last_name || adminUser.User_Lname}`.trim()
    : (adminUser?.email || adminUser?.User_Email || 'Admin');

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await fetch('http://localhost/Hiring%20System/backend/jobs/get_jobs.php');
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setJobs(data.jobs);
      }
    } catch (err) {
      console.error("Failed to load jobs list:", err);
    }
  };

  const openAddModal = () => {
    setEditMode(false);
    setCurrentJobId(null);
    setNewJob({ title: '', requirements: '', availability: 1 });
    setSelectedImage(null);
    setImagePreview(null);
    setJobModalOpen(true);
  };

  const openEditModal = (job) => {
    setEditMode(true);
    setCurrentJobId(job.id);
    setNewJob({ 
      title: job.title, 
      requirements: job.requirements, 
      availability: job.availability
    });
    setSelectedImage(null);
    setImagePreview(job.image_path ? `http://localhost/Hiring%20System/backend/${job.image_path}` : null);
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
    const formData = new FormData();
    formData.append('title', newJob.title);
    formData.append('description', '');
    formData.append('requirements', newJob.requirements);
    formData.append('availability', newJob.availability);
    
    const computedStatus = parseInt(newJob.availability) > 0 ? 'Active' : 'Closed';
    formData.append('status', computedStatus);
    
    formData.append('actor_id', actorId);
    formData.append('actor_name', actorName);

    if (selectedImage) {
      formData.append('image', selectedImage);
    }

    const url = editMode 
      ? 'http://localhost/Hiring%20System/backend/jobs/update_job.php'
      : 'http://localhost/Hiring%20System/backend/jobs/add_job.php';
      
    if (editMode) {
      formData.append('id', currentJobId);
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        setJobModalOpen(false);
        fetchJobs();
      } else {
        alert(data.message || "Failed to save job.");
      }
    } catch (e) { 
      console.error(e); 
      alert("Failed to save job.");
    }
  };

  const handleDeleteJob = async () => {
    if (!jobToDelete) return;
    try {
      const res = await fetch('http://localhost/Hiring%20System/backend/jobs/delete_job.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: jobToDelete.id, actor_id: actorId, actor_name: actorName })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setJobToDelete(null);
        fetchJobs();
      } else {
        alert(data.message || "Failed to delete job.");
      }
    } catch (e) {
      console.error(e);
      alert("Connection error while deleting job.");
    }
  };

  return (
    <>
      <div className="admin-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="admin-header-title">Job Posting</h1>
          <p style={{ color: '#64748b', fontSize: '13.5px', margin: '4px 0 0 0' }}>
            Manage recruitment positions, vacancy slot availability, and job listing status.
          </p>
        </div>
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
      </div>

      <div className="admin-table-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Position Title</th>
              <th>Vacancy Availability</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {j.image_path ? (
                      <img src={`http://localhost/Hiring%20System/backend/${j.image_path}`} alt="" style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                    ) : (
                      <div style={{ width: '42px', height: '42px', background: '#f1f5f9', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                      </div>
                    )}
                    <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '14.5px' }}>{j.title}</span>
                  </div>
                </td>
                <td>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: '700',
                    background: '#f1f5f9',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1'
                  }}>
                    {j.availability} Open Slot{parseInt(j.availability) !== 1 ? 's' : ''}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
                      onClick={() => setJobToDelete(j)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr><td colSpan="3" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>No job postings found. Click "Create Job Posting" to add one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {jobModalOpen && ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="admin-modal-card" style={{ background: 'white', padding: '28px', borderRadius: '12px', width: '580px', maxWidth: '92%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>{editMode ? 'Edit Job Posting' : 'Create Job Posting'}</h3>
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px', letterSpacing: '0.5px' }}>Requirements / Qualifications</label>
                <textarea required placeholder="List minimum qualifications and requirements..." value={newJob.requirements} onChange={e => setNewJob({...newJob, requirements: e.target.value})} style={{ width: '100%', padding: '10px 14px', minHeight: '110px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontFamily: 'inherit', background: '#ffffff', color: '#0f172a', fontSize: '13.5px', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>

              <div style={{ marginBottom: '24px' }}>
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
                <button type="button" onClick={() => setJobModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontWeight: '600', color: '#475569', fontSize: '13.5px' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #ec4899, #db2777)', color: 'white', cursor: 'pointer', fontWeight: '700', fontSize: '13.5px', boxShadow: '0 4px 10px rgba(236, 72, 153, 0.3)' }}>Save Job</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {jobToDelete && ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="admin-modal-card" style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '400px', maxWidth: '92%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </div>
            <h3 style={{ marginBottom: '10px', color: '#0f172a', fontSize: '19px', fontWeight: '700' }}>Delete Job Posting</h3>
            <p style={{ marginBottom: '24px', color: '#64748b', fontSize: '14px', lineHeight: '1.5' }}>Are you sure you want to delete <strong>{jobToDelete.title}</strong>? This action cannot be undone.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button onClick={() => setJobToDelete(null)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: '600', color: '#475569', fontSize: '13.5px' }}>Cancel</button>
              <button onClick={handleDeleteJob} style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: '700', fontSize: '13.5px', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)' }}>Delete Job</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default JobsTab;
