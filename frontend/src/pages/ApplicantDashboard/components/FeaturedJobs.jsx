import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useScrollReveal from '../../../hooks/useScrollReveal';
import { API_BASE_URL } from '../../../utils/apiConfig';

/**
 * Dynamic Featured Jobs section fetching active vacancies from backend database
 * with scroll-triggered staggered fade-up cards.
 */
const FeaturedJobs = ({ shouldStagger = false }) => {
  const navigate                  = useNavigate();
  const [jobs, setJobs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [sectionRef, isVisible]   = useScrollReveal({ threshold: 0.15 });
  const isRevealed                = !shouldStagger || isVisible;

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        let userIdParam = '';
        try {
          const saved = localStorage.getItem('hiring_user');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed?.id) userIdParam = `&user_id=${parsed.id}`;
          }
        } catch {}
        const res  = await fetch(`${API_BASE_URL}/jobs/get_jobs.php?active_only=true${userIdParam}`);
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

  const filteredJobs = jobs.filter(job => {
    if (filterType === 'all') return true;
    const empType = (job.employment_type || 'Full Time').toLowerCase();
    if (filterType === 'Full Time') {
      return empType.includes('full');
    }
    if (filterType === 'Part Time') {
      return empType.includes('part');
    }
    return true;
  });

  return (
    <section
      ref={sectionRef}
      className={`featured-jobs-section ${isRevealed ? 'is-revealed' : ''}`}
      id="featured-jobs-section"
    >
      <div className="featured-jobs-header">
        <h2 className="section-title">Featured Jobs</h2>
        <div className="job-tabs" role="tablist" aria-label="Filter featured jobs">
          <button
            type="button"
            className={`job-tab-btn ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`job-tab-btn ${filterType === 'Full Time' ? 'active' : ''}`}
            onClick={() => setFilterType('Full Time')}
          >
            Full Time
          </button>
          <button
            type="button"
            className={`job-tab-btn ${filterType === 'Part Time' ? 'active' : ''}`}
            onClick={() => setFilterType('Part Time')}
          >
            Part Time
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto' }}></div>
        </div>
      ) : filteredJobs.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#64748b', padding: '20px', fontFamily: 'Inter, sans-serif' }}>
          {filterType === 'all' 
            ? 'No active job vacancies available right now.' 
            : `No active ${filterType} vacancies available right now.`}
        </p>
      ) : (
        <div className="jobs-grid">
          {filteredJobs.slice(0, 4).map((job, idx) => (
            <div className="job-card" key={job.id} style={{ '--job-index': idx }}>
              <div className="job-card-content">
                <h3 className="job-card-title-text">{job.title}</h3>
                <span className="job-card-type">
                  {job.employment_type ? `${job.employment_type} • ` : ''}
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
