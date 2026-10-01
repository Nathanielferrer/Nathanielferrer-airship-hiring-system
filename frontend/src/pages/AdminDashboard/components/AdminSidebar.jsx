import React from 'react';
import logoImg from '../../../assets/images/Logo Airship Express.png';

const SIDEBAR_SECTIONS = [
  {
    category: 'DASHBOARD',
    items: [
      { key: 'overview', label: 'Overview', icon: 'bx-bar-chart-alt-2' },
    ]
  },
  {
    category: 'RECRUITMENT PIPELINE',
    items: [
      { key: 'jobs',        label: 'Job Posting',               icon: 'bx-briefcase' },
      { key: 'applicants',  label: 'Resume Screening',          icon: 'bx-file-find' },
      { key: 'interviews',  label: 'Interview Management',      icon: 'bx-calendar-check' },
      { key: 'master_list', label: 'Application Audit Records', icon: 'bx-file' },
    ]
  },
  {
    category: 'KNOWLEDGE BASE',
    items: [
      { key: 'chatbot_kb', label: 'Chatbot Intelligence', icon: 'bx-bot' },
    ]
  }
];

const AdminSidebar = ({ activeTab, setActiveTab, handleLogout, user, mobileMenuOpen, setMobileMenuOpen }) => {
  const firstName = user?.first_name || user?.User_Fname || '';
  const lastName = user?.last_name || user?.User_Lname || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'Administrator';
  const roleLabel = parseInt(user?.is_admin) === 3 ? 'Super Admin' : 'Administrator';

  const firstInitial = firstName ? firstName.charAt(0) : '';
  const lastInitial = lastName ? lastName.charAt(0) : '';
  const initials = (firstInitial + lastInitial).toUpperCase() || 'AD';

  return (
    <aside className={`admin-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'space-between' }}>
      <div>
        {/* ── Brand Logo Header (No box border, clean transparent logo) ── */}
        <div className="admin-sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div className="admin-sidebar-logo-row">
              <img src={logoImg} alt="Airship Express" className="admin-sidebar-logo-img" />
              <span className="admin-brand-name">AIRSHIP EXPRESS</span>
            </div>
            {setMobileMenuOpen && (
              <button
                type="button"
                className="admin-mobile-close-btn"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close sidebar"
              >
                <i className="bx bx-x" style={{ fontSize: '22px' }}></i>
              </button>
            )}
          </div>
          <div>
            <h2 className="admin-sidebar-title">Admin Dashboard</h2>
            <span className="admin-brand-platform">Hiring Platform</span>
          </div>
        </div>

        {/* ── Categorized Menu Navigation ── */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {SIDEBAR_SECTIONS.map((section, sIdx) => (
            <div key={sIdx} style={{ marginBottom: '8px' }}>
              <div className="admin-sidebar-section-label">
                {section.category}
              </div>
              <ul className="admin-sidebar-menu">
                {section.items.map(item => {
                  const isActive = activeTab === item.key;
                  return (
                    <li key={item.key}>
                      <span
                        className={`admin-menu-item ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          setActiveTab(item.key);
                          if (setMobileMenuOpen) setMobileMenuOpen(false);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="admin-menu-left">
                          <i className={`bx ${item.icon}`} style={{ fontSize: '18px', flexShrink: 0, color: isActive ? '#f472b6' : '#94a3b8' }}></i>
                          <span className="admin-menu-text">{item.label}</span>
                        </div>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sidebar Footer Profile ── */}
      <div style={{ paddingTop: '14px', borderTop: '1px solid #1e293b', marginTop: 'auto' }}>
        {/* Admin Profile Card */}
        <div className="admin-sidebar-profile" title={user?.email || fullName}>
          <div className="admin-profile-avatar">
            {initials}
          </div>
          <div className="admin-profile-info">
            <span className="admin-profile-name">{fullName}</span>
            <span className="admin-profile-role">
              <span className="admin-profile-status-dot"></span>
              {roleLabel}
            </span>
          </div>
        </div>

        <span
          className="admin-menu-item logout-item"
          onClick={handleLogout}
          style={{ cursor: 'pointer', justifyContent: 'flex-start', gap: '10px' }}
        >
          <i className="bx bx-log-out" style={{ fontSize: '18px', flexShrink: 0 }}></i>
          <span className="admin-menu-text">Sign Out</span>
        </span>
      </div>
    </aside>
  );
};

export default AdminSidebar;


