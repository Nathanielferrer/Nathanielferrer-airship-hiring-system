import React from 'react';
import './LoadingStyles.css';

/**
 * Reusable Card Skeleton component for card grids (jobs, interviews, applications).
 * @param {number} count - Number of skeleton cards to render (default: 6)
 * @param {string} layout - 'grid' | 'list'
 */
const CardSkeleton = ({ count = 6, layout = 'grid' }) => {
  const cards = Array.from({ length: count }, (_, i) => i);

  return (
    <div
      className="card-skeleton-grid"
      style={layout === 'list' ? { gridTemplateColumns: '1fr' } : {}}
    >
      {cards.map((idx) => (
        <div className="card-skeleton" key={idx}>
          {/* Card Header */}
          <div className="card-skeleton-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '70%' }}>
              <div
                className="skeleton-shimmer skeleton-circle"
                style={{ width: '42px', height: '42px' }}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  className="skeleton-shimmer skeleton-text"
                  style={{ width: `${65 + (idx % 3) * 12}%`, height: '14px' }}
                />
                <div
                  className="skeleton-shimmer skeleton-text"
                  style={{ width: '40%', height: '10px' }}
                />
              </div>
            </div>
            <div
              className="skeleton-shimmer skeleton-pill"
              style={{ width: '80px', height: '22px' }}
            />
          </div>

          {/* Card Body */}
          <div className="card-skeleton-body">
            <div
              className="skeleton-shimmer skeleton-text skeleton-text-long"
              style={{ height: '11px' }}
            />
            <div
              className="skeleton-shimmer skeleton-text skeleton-text-medium"
              style={{ height: '11px' }}
            />
            <div
              className="skeleton-shimmer skeleton-text skeleton-text-short"
              style={{ height: '11px' }}
            />
          </div>

          {/* Card Footer */}
          <div className="card-skeleton-footer">
            <div
              className="skeleton-shimmer skeleton-text"
              style={{ width: '90px', height: '12px' }}
            />
            <div
              className="skeleton-shimmer skeleton-btn"
              style={{ width: '100px', height: '32px' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default CardSkeleton;
