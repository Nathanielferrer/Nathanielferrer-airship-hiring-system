import React from 'react';
import logoImg from '../../../assets/images/Logo Airship Express.png';

const SIDEBAR_ITEMS = [
  { key: 'overview',    label: 'Overview',                  icon: 'bx-bar-chart-alt-2' },
  { key: 'jobs',        label: 'Job Posting',               icon: 'bx-briefcase' },
  { key: 'applicants',  label: 'Resume Screening',          icon: 'bx-file-find' },
  { key: 'interviews',  label: 'Interview Management',      icon: 'bx-calendar-check' },
  { key: 'master_list', label: 'Application Audit Records', icon: 'bx-file' },
  { key: 'chatbot_kb',  label: 'Chatbot Intelligence',      icon: 'bx-bot' },
];

const AdminSidebar = ({ activeTab, setActiveTab, handleLogout, user }) => {
  const firstName = user?.first_name || user?.User_Fname || '';
  const lastName = user?.last_name || user?.User_Lname || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'Administrator';
  const roleLabel = user?.is_admin === 3 ? 'Super Admin' : 'Administrator';

  const firstInitial = firstName ? firstName.charAt(0) : '';
  const lastInitial = lastName ? lastName.charAt(0) : '';
  const initials = (firstInitial + lastInitial).toUpperCase() || 'AD';

  return (
    <aside className="admin-sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'space-between' }}>
      <div>
        <div className="admin-sidebar-header" style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <img src={logoImg} alt="Airship Logo" style={{ height: '24px', width: 'auto', objectFit: 'contain' }} />
            <span className="admin-brand-name" style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '1px' }}>AIRSHIP EXPRESS</span>
          </div>
          <h2 className="admin-sidebar-title" style={{ fontSize: '20px', fontWeight: '800', margin: 0, fontFamily: "'Montserrat', sans-serif", letterSpacing: '-0.4px' }}>
            Admin Dashboard
          </h2>
          <span style={{ fontSize: '11px', color: '#475569', fontWeight: '500' }}>Hiring Platform</span>
        </div>

        <ul className="admin-sidebar-menu">
          {SIDEBAR_ITEMS.map(item => (
            <li key={item.key}>
              <span
                className={`admin-menu-item ${activeTab === item.key ? 'active' : ''}`}
                onClick={() => setActiveTab(item.key)}
                style={{ cursor: 'pointer' }}
              >
                <i className={`bx ${item.icon}`} style={{ fontSize: '17px', flexShrink: 0 }}></i>
                <span className="admin-menu-text">{item.label}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ paddingTop: '16px', borderTop: '1px solid #1e293b', marginTop: 'auto' }}>
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
          style={{ cursor: 'pointer' }}
        >
          <i className="bx bx-log-out" style={{ fontSize: '17px', flexShrink: 0 }}></i>
          <span className="admin-menu-text">Sign Out</span>
        </span>
      </div>
    </aside>
  );
};

export default AdminSidebar;


