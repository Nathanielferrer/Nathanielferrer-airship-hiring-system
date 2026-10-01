import React from 'react';
import './LoadingStyles.css';

/**
 * Reusable Table Skeleton component with animated shimmer placeholders.
 * @param {Array<string>|number} columns - Array of column header names or count
 * @param {number} rows - Number of skeleton rows to display (default: 5)
 * @param {boolean} hasAvatar - Whether column 1 displays an avatar circle
 * @param {boolean} hasActions - Whether the last column displays action button placeholders
 */
const TableSkeleton = ({
  columns = 5,
  rows = 5,
  hasAvatar = true,
  hasActions = true,
  columnTypes = [] // Optional array e.g., ['avatar', 'text', 'status', 'actions', 'date']
}) => {
  const columnHeaders = Array.isArray(columns)
    ? columns
    : Array.from({ length: columns }, (_, i) => `Column ${i + 1}`);

  const colCount = columnHeaders.length;
  const rowList = Array.from({ length: rows }, (_, i) => i);

  return (
    <div className="table-skeleton-container">
      <table className="table-skeleton">
        <thead>
          <tr>
            {columnHeaders.map((header, idx) => (
              <th key={idx}>
                {typeof header === 'string' && header ? (
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {header}
                  </span>
                ) : (
                  <div className="skeleton-shimmer skeleton-text" style={{ width: '65%', height: '12px' }} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowList.map((rowIdx) => (
            <tr key={rowIdx}>
              {columnHeaders.map((_, colIdx) => {
                const colType = columnTypes.length > 0
                  ? columnTypes[colIdx]
                  : (colIdx === 0 && hasAvatar ? 'avatar'
                     : colIdx === colCount - 1 && hasActions ? 'actions'
                     : colIdx === colCount - 2 && colCount > 3 ? 'status'
                     : 'text');

                if (colType === 'avatar') {
                  return (
                    <td key={colIdx}>
                      <div className="skeleton-cell-flex">
                        <div
                          className="skeleton-shimmer skeleton-circle"
                          style={{ width: '38px', height: '38px' }}
                        />
                        <div className="skeleton-cell-stack">
                          <div
                            className="skeleton-shimmer skeleton-text"
                            style={{ width: `${60 + ((rowIdx * 13 + colIdx * 7) % 30)}%`, height: '13px' }}
                          />
                          <div
                            className="skeleton-shimmer skeleton-text"
                            style={{ width: '45%', height: '10px' }}
                          />
                        </div>
                      </div>
                    </td>
                  );
                }

                if (colType === 'status') {
                  return (
                    <td key={colIdx}>
                      <div
                        className="skeleton-shimmer skeleton-pill"
                        style={{ width: '90px' }}
                      />
                    </td>
                  );
                }

                if (colType === 'actions') {
                  return (
                    <td key={colIdx} style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <div
                          className="skeleton-shimmer skeleton-btn"
                          style={{ width: '64px' }}
                        />
                        <div
                          className="skeleton-shimmer skeleton-btn"
                          style={{ width: '32px' }}
                        />
                      </div>
                    </td>
                  );
                }

                if (colType === 'date') {
                  return (
                    <td key={colIdx}>
                      <div className="skeleton-cell-stack">
                        <div className="skeleton-shimmer skeleton-text" style={{ width: '50%', height: '12px' }} />
                        <div className="skeleton-shimmer skeleton-text" style={{ width: '35%', height: '10px' }} />
                      </div>
                    </td>
                  );
                }

                // Standard Data Column
                const widthPercent = 45 + ((rowIdx * 19 + colIdx * 23) % 45);
                const hasSubtitle = colIdx === 1 || colType === 'text-with-subtitle';
                return (
                  <td key={colIdx}>
                    <div className="skeleton-cell-stack">
                      <div
                        className="skeleton-shimmer skeleton-text"
                        style={{ width: `${widthPercent}%`, height: '12px' }}
                      />
                      {hasSubtitle && (
                        <div
                          className="skeleton-shimmer skeleton-text"
                          style={{ width: '35%', height: '10px' }}
                        />
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableSkeleton;
