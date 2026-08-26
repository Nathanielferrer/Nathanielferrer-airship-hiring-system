import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Dynamic Featured Jobs section fetching active vacancies from backend database.
 */
const FeaturedJobs = () => {
  const navigate              = useNavigate();
  const [jobs, setJobs]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res  = await fetch('http://localhost/Hiring%20System/backend/jobs/get_jobs.php?active_only=true');
        const data = await res.json();
        if (res.ok && data.status === 'success' && Array.isArray(data.jobs)) {
          setJobs(data.jobs);
        }
      } catch (err) {
        console.error('Failed to load featured jobs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  return (
    <section className="featured-jobs-section" id="featured-jobs-section">
      <div className="featured-jobs-header">
        <h2 className="section-title">Featured Jobs</h2>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto' }}></div>
        </div>
      ) : jobs.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#64748b', padding: '20px', fontFamily: 'Inter, sans-serif' }}>
          No active job vacancies available right now.
        </p>
      ) : (
        <div className="jobs-grid">
          {jobs.slice(0, 4).map(job => (
            <div className="job-card" key={job.id}>
              <div className="job-card-content">
                <h3 className="job-card-title-text">{job.title}</h3>
                <span className="job-card-type">
                  {job.availability > 0 ? `${job.availability} Open Position${job.availability > 1 ? 's' : ''}` : 'Full-Time'}
                </span>
              </div>
              <button className="job-apply-btn" onClick={() => navigate('/vacancy')}>
                Apply
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default FeaturedJobs;
