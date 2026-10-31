import React, { useState } from 'react';
import ReactDOM from 'react-dom';

import { API_BASE_URL } from '../../../../utils/apiConfig';
const ApplicantDrawer = ({
  drawerApp,
  setDrawerApp,
  handleUpdateStatus,
  confirmPass,
  confirmReject,
  confirmArchive
}) => {
  if (!drawerApp) return null;

  const [expanded, setExpanded] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);

  const isHired = ['HIRED', 'Hired', 'hired', 'PASSED', 'HIRED / PASSED'].includes(drawerApp.status);

  let aiData = null;
  if (drawerApp.ai_summary && drawerApp.ai_summary.trim().startsWith('{')) {
    try {
      aiData = JSON.parse(drawerApp.ai_summary);
    } catch (e) {
      console.error("Failed to parse AI summary JSON:", e);
    }
  }

  const getAiBadgeDetails = (app) => {
    const rawScore = app.ai_match_score;
    const score = rawScore !== null && rawScore !== undefined ? (rawScore <= 1 && rawScore > 0 ? Math.round(rawScore * 100) : Math.round(rawScore)) : null;
    if (score === null) return { class: 'neutral', text: 'AI Pending', score: null };
    if (score >= 80) return { class: 'excellent', text: 'Highly Recommended', score };
    if (score >= 60) return { class: 'good', text: 'Good Match', score };
    return { class: 'poor', text: 'Low Match', score };
  };

  const badgeInfo = getAiBadgeDetails(drawerApp);

  return ReactDOM.createPortal(
    <div className="admin-drawer-overlay" onClick={() => setDrawerApp(null)}>
      <div
        className="admin-drawer-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: expanded ? 'min(880px, 92vw)' : '460px',
          maxWidth: '96vw',
          transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        
        {/* Header profile information */}
        <div className="admin-drawer-header" style={{ position: 'relative' }}>
          {/* Top-Right Control Buttons: Expand & Close */}
          <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 10 }}>
            <button
              type="button"
              onClick={() => setExpanded(prev => !prev)}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '7px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#475569',
                transition: 'all 0.15s ease'
              }}
              title={expanded ? "Collapse Drawer" : "Maximize / Expand Drawer"}
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? (
                <i className='bx bx-collapse-alt' style={{ fontSize: '18px' }}></i>
              ) : (
                <i className='bx bx-expand-alt' style={{ fontSize: '18px' }}></i>
              )}
            </button>

            <button
              className="admin-drawer-close"
              onClick={() => setDrawerApp(null)}
              aria-label="Close details"
              style={{
                position: 'static',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '7px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                color: '#475569'
              }}
            >
              <i className='bx bx-x' style={{ fontSize: '20px', lineHeight: 1 }}></i>
            </button>
          </div>

          <div className="admin-drawer-avatar">
            <i className='bx bx-user' style={{ fontSize: '44px' }}></i>
          </div>

          {(() => {
            const resumeName = aiData?.applicant_info?.name || '';
            const accountName = (drawerApp.candidate_name || `${drawerApp.User_Fname || ''} ${drawerApp.User_Lname || ''}`).trim();
            const drawerTitle = resumeName || accountName || 'Applicant';

            return (
              <div className="admin-drawer-profile-text" style={{ paddingRight: '70px' }}>
                <span className="admin-drawer-name">{drawerTitle}</span>
                <span className="admin-drawer-role">{drawerApp.job_title}</span>
              </div>
            );
          })()}
        </div>

        {/* Main drawer content */}
        <div className="admin-drawer-body">
          {/* Contact information details */}
          <div className="admin-drawer-contact-list">
            <div className="admin-contact-item">
              <i className='bx bx-envelope admin-contact-icon'></i>
              <span>{drawerApp.candidate_email || drawerApp.User_Email}</span>
            </div>
            <div className="admin-contact-item">
              <i className='bx bx-phone admin-contact-icon'></i>
              {(drawerApp.candidate_mobile || drawerApp.User_Mobile) ? (
                <span style={{ color: '#334155', fontWeight: '500' }}>
                  {drawerApp.candidate_mobile || drawerApp.User_Mobile}
                </span>
              ) : (
                <span>Not provided</span>
              )}
            </div>
            <div className="admin-contact-item">
              <i className='bx bx-map admin-contact-icon'></i>
              <span>{aiData?.applicant_info?.location || drawerApp.Address || drawerApp.location || "Location not provided"}</span>
            </div>
          </div>


          {/* AI recommendation alert header box */}
          {drawerApp.ai_match_score !== null && (
            <div className={`admin-drawer-ai-alert ${badgeInfo.class}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div className={`admin-drawer-ai-badge ${badgeInfo.class}`}>
                  <i className='bx bx-bot' style={{ fontSize: '18px' }}></i>
                  <span>{badgeInfo.text}</span>
                </div>
                <span className="admin-drawer-ai-confidence">
                  Match Score: {badgeInfo.score !== null ? `${badgeInfo.score}%` : 'N/A'}
                </span>
              </div>

              {/* Job Requirements Accordion Toggle Button */}
              <div style={{ marginTop: '10px', borderTop: '1px solid rgba(0, 0, 0, 0.08)', paddingTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowRequirements(prev => !prev)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.85)',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    borderRadius: '7px',
                    padding: '7px 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#1e293b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className='bx bx-list-check' style={{ fontSize: '16px', color: '#6366f1' }}></i>
                    <span>View Job Requirements</span>
                  </span>
                  <i className={`bx ${showRequirements ? 'bx-chevron-up' : 'bx-chevron-down'}`} style={{ fontSize: '16px', color: '#64748b' }}></i>
                </button>

                {showRequirements && (
                  <div style={{
                    marginTop: '8px',
                    padding: '12px 14px',
                    background: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    fontSize: '12.5px',
                    color: '#334155',
                    lineHeight: '1.6',
                    maxHeight: '220px',
                    overflowY: 'auto'
                  }}>
                    <strong style={{ display: 'block', marginBottom: '6px', color: '#0f172a', fontSize: '13px' }}>
                      📋 {drawerApp.job_title} Requirements:
                    </strong>
                    {drawerApp.job_requirements ? (
                      <div style={{ whiteSpace: 'pre-line' }}>{drawerApp.job_requirements}</div>
                    ) : (
                      <p style={{ margin: 0, fontStyle: 'italic', color: '#94a3b8' }}>
                        No specific requirements text specified for this position.
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              {drawerApp.ai_summary && (() => {
                let list = [];
                if (aiData && aiData.summary) {
                  if (Array.isArray(aiData.summary)) {
                    list = aiData.summary;
                  } else if (typeof aiData.summary === 'string') {
                    list = aiData.summary.split('\n');
                  }
                } else {
                  list = drawerApp.ai_summary.split('\n');
                }
                return (
                  <ul className="admin-drawer-ai-bullets" style={{ marginTop: '10px' }}>
                    {list.map((bullet, idx) => (
                      <li key={idx}>{bullet.replace(/^[-\s*•]+/, '')}</li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          )}

          {/* Dynamic qualification matching fields */}
          <div>
            <h4 className="admin-drawer-section-title">Skills</h4>
            <div className="admin-drawer-skills-grid">
              {aiData && aiData.skills_analysis && Array.isArray(aiData.skills_analysis.found_skills) && aiData.skills_analysis.found_skills.length > 0 ? (
                aiData.skills_analysis.found_skills.map((skill, idx) => (
                  <span key={idx} className="admin-drawer-skill-tag">{skill}</span>
                ))
              ) : (
                <span style={{ fontSize: '13px', color: '#6b7280', fontStyle: 'italic' }}>No skills extracted.</span>
              )}
            </div>
          </div>

          <div>
            <h4 className="admin-drawer-section-title">Experience</h4>
            {aiData && Array.isArray(aiData.extracted_work_history) && aiData.extracted_work_history.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {aiData.extracted_work_history.map((job, idx) => (
                  <div key={idx} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    <p className="admin-drawer-detail-p" style={{ fontWeight: '600', color: '#111827' }}>
                      {job.job_title} ({job.duration})
                    </p>
                    {Array.isArray(job.key_responsibilities) && job.key_responsibilities.map((resp, rIdx) => (
                      <p key={rIdx} className="admin-drawer-detail-p" style={{ fontSize: '12px', paddingLeft: '8px' }}>
                        • {resp}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            ) : aiData && aiData.ranking_logic && aiData.ranking_logic.experience_relevance ? (
              <p className="admin-drawer-detail-p" style={{ color: '#374151', lineHeight: '1.5' }}>
                {aiData.ranking_logic.experience_relevance}
              </p>
            ) : (
              <p className="admin-drawer-detail-p" style={{ color: '#6b7280', fontStyle: 'italic' }}>
                No experience records extracted.
              </p>
            )}
          </div>

          <div>
            <h4 className="admin-drawer-section-title">Education</h4>
            {aiData && Array.isArray(aiData.extracted_education) && aiData.extracted_education.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {aiData.extracted_education.map((edu, idx) => (
                  <p key={idx} className="admin-drawer-detail-p" style={{ color: '#374151' }}>
                    <strong>{edu.degree}</strong> ({edu.year_graduated})
                  </p>
                ))}
              </div>
            ) : (
              <p className="admin-drawer-detail-p" style={{ color: '#6b7280', fontStyle: 'italic' }}>
                No education records extracted.
              </p>
            )}
          </div>

          {drawerApp.remarks && (
            <div>
              <h4 className="admin-drawer-section-title">Evaluator Remarks</h4>
              {(() => {
                let actualRemarks = (drawerApp.remarks || '').trim();
                let evalName = '';
                let evalDate = '';
                if (actualRemarks.includes('|||SIG|||')) {
                  const parts = actualRemarks.split('|||SIG|||');
                  actualRemarks = parts[0].trim();
                  if (parts[1]) {
                    const sigParts = parts[1].split('|||');
                    evalName = sigParts[0]?.trim() || '';
                    evalDate = sigParts[1]?.trim() || '';
                  }
                }
                if (!actualRemarks) {
                  actualRemarks = 'No remarks provided.';
                }
                const fallbackEvaluator = (() => {
                  try {
                    const user = JSON.parse(localStorage.getItem('hiring_user') || '{}');
                    return (user?.first_name || user?.User_Fname)
                      ? `${user.first_name || user.User_Fname} ${user.last_name || user.User_Lname || ''}`.trim()
                      : 'Kurtney Cruz';
                  } catch {
                    return 'Kurtney Cruz';
                  }
                })();
                return (
                  <>
                    <div style={{
                      padding: '12px 14px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '13px',
                      color: '#334155',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-line',
                      fontStyle: 'italic',
                      marginBottom: '10px'
                    }}>
                      "{actualRemarks}"
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <i className='bx bx-info-circle' style={{ fontSize: '14px' }}></i>
                      Interviewed by: <strong>{evalName || fallbackEvaluator}</strong> {evalDate ? `on ${evalDate}` : ''}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Documents attachment rows */}
          <div>
            <h4 className="admin-drawer-section-title">Documents</h4>
            <div className="admin-drawer-doc-list">
              <button 
                className="admin-drawer-doc-btn"
                onClick={() => window.open(`${API_BASE_URL}/applications/download_resume.php?id=${drawerApp.id}&token=${encodeURIComponent(localStorage.getItem('hiring_token') || '')}`, '_blank')}
              >
                <div className="admin-drawer-doc-btn-left">
                  <i className='bx bxs-file-pdf admin-drawer-doc-icon' style={{ fontSize: '16px' }}></i>
                  <span>Download Resume PDF</span>
                </div>
                <i className='bx bx-download' style={{ fontSize: '16px' }}></i>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Actions Drawer Footer */}
        {(drawerApp.status === 'pending' || drawerApp.status === 'review_required' || !drawerApp.status || isHired) && (
          <div className="admin-drawer-footer">
            {/* Case 1: Pending Evaluation / Review Required -> Show Perfectly Aligned Pass & Reject Actions */}
            {(drawerApp.status === 'pending' || drawerApp.status === 'review_required' || !drawerApp.status) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '100%' }}>
                <button 
                  type="button"
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    height: '44px',
                    padding: '0 16px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: '700',
                    fontSize: '13.5px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif",
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => {
                    setDrawerApp(null);
                    if (confirmPass) {
                      confirmPass(drawerApp);
                    } else {
                      handleUpdateStatus(drawerApp.id, 'PASSED INITIAL');
                    }
                  }}
                >
                  <span>Pass Initial Interview</span>
                </button>

                <button 
                  type="button"
                  style={{
                    background: '#ffffff',
                    color: '#ef4444',
                    border: '1.5px solid #fca5a5',
                    height: '44px',
                    padding: '0 16px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: '700',
                    fontSize: '13.5px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif",
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => {
                    setDrawerApp(null);
                    if (confirmReject) {
                      confirmReject(drawerApp);
                    } else {
                      handleUpdateStatus(drawerApp.id, 'INITIAL_INTERVIEW_REJECTED');
                    }
                  }}
                >
                  <span>Reject</span>
                </button>
              </div>
            )}

            {/* Case 2: Candidate Hired */}
            {isHired && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '9px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '700' }}>
                  <i className='bx bx-award' style={{ fontSize: '19px' }}></i>
                  <span>Candidate Hired</span>
                </div>
                <button
                  style={{ background: '#475569', color: '#ffffff', border: 'none', margin: 0, padding: '9px 16px', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: '700', borderRadius: '8px', cursor: 'pointer', fontSize: '12.5px', fontFamily: 'Inter, sans-serif' }}
                  onClick={() => confirmArchive ? confirmArchive(drawerApp) : handleUpdateStatus(drawerApp.id, 'Archived')}
                >
                  <i className='bx bx-archive-in' style={{ fontSize: '17px' }}></i>
                  <span>Archive Record</span>
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>,
    document.body
  );
};

export default ApplicantDrawer;
