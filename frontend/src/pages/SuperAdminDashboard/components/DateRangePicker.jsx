import React, { useState, useEffect, useRef } from 'react';

// Helper: Format Date object to "YYYY-MM-DD"
const toIsoDate = (d) => {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Helper: Parse "YYYY-MM-DD" string to local Date object
const parseIsoDate = (str) => {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Helper: Format "YYYY-MM-DD" to "MM/DD/YYYY"
const formatDisplayDate = (isoStr) => {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-');
  return `${m}/${d}/${y}`;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const DateRangePicker = ({
  startDate = '',
  endDate = '',
  onChange = () => {},
  placeholder = 'MM/DD/YYYY - MM/DD/YYYY'
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Current viewed month (Date initialized to 1st of month)
  const [viewDate, setViewDate] = useState(() => {
    if (startDate) {
      const d = parseIsoDate(startDate);
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  // Temporary selection state while popup is open
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);
  const [hoverDate, setHoverDate] = useState(null);
  const [selectingStep, setSelectingStep] = useState(0); // 0 = picking start, 1 = picking end

  const containerRef = useRef(null);

  // Sync internal temp state when props change externally
  useEffect(() => {
    setTempStart(startDate);
    setTempEnd(endDate);
  }, [startDate, endDate]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSelectingStep(0);
        setHoverDate(null);
        setTempStart(startDate);
        setTempEnd(endDate);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, startDate, endDate]);

  // Month navigation
  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  // Handle clicking a day cell
  const handleDateClick = (isoString) => {
    if (selectingStep === 0) {
      // Pick start date
      setTempStart(isoString);
      setTempEnd('');
      setSelectingStep(1);
    } else if (selectingStep === 1) {
      // Pick end date
      if (isoString < tempStart) {
        // Validation: user clicked a date earlier than start date -> restart with this date as start
        setTempStart(isoString);
        setTempEnd('');
        setSelectingStep(1);
      } else {
        // Valid end date selected
        setTempEnd(isoString);
        setSelectingStep(0);
        setHoverDate(null);
        setIsOpen(false);
        onChange({ startDate: tempStart, endDate: isoString });
      }
    }
  };

  // Quick Preset Handlers
  const handlePreset = (type) => {
    const today = new Date();
    let s = null;
    let e = null;

    if (type === 'today') {
      s = toIsoDate(today);
      e = toIsoDate(today);
    } else if (type === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      s = toIsoDate(yest);
      e = toIsoDate(yest);
    } else if (type === '7days') {
      const past = new Date(today);
      past.setDate(past.getDate() - 6);
      s = toIsoDate(past);
      e = toIsoDate(today);
    } else if (type === '30days') {
      const past = new Date(today);
      past.setDate(past.getDate() - 29);
      s = toIsoDate(past);
      e = toIsoDate(today);
    } else if (type === 'thisMonth') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      s = toIsoDate(first);
      e = toIsoDate(last);
    } else if (type === 'clear') {
      s = '';
      e = '';
    }

    setTempStart(s);
    setTempEnd(e);
    setSelectingStep(0);
    setHoverDate(null);
    setIsOpen(false);
    onChange({ startDate: s, endDate: e });
  };

  // Generate calendar grid for a single month
  const renderSingleMonth = (year, month) => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const todayIso = toIsoDate(new Date());

    const days = [];
    // Blank padding cells for days before the 1st
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(<div key={`blank-${i}`} style={{ width: '34px', height: '32px' }} />);
    }

    // Days 1 to totalDays
    for (let day = 1; day <= totalDays; day++) {
      const dayIso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const isStart = tempStart === dayIso;
      const isEnd = tempEnd === dayIso;
      const isInRange = tempStart && tempEnd && dayIso > tempStart && dayIso < tempEnd;
      
      // Dynamic hover range preview
      const isHoverRange = selectingStep === 1 && tempStart && hoverDate && hoverDate >= tempStart && dayIso > tempStart && dayIso <= hoverDate;
      const isHoverEnd = selectingStep === 1 && hoverDate === dayIso && hoverDate > tempStart;
      const isToday = dayIso === todayIso;

      // Validation indicator: if selecting end date and day is before tempStart
      const isBeforeStart = selectingStep === 1 && tempStart && dayIso < tempStart;

      let bg = 'transparent';
      let color = '#0f172a';
      let borderRadius = '6px';
      let fontWeight = '500';

      if (isStart && (isEnd || (!tempEnd && !isHoverRange))) {
        bg = '#0f172a';
        color = '#ffffff';
        fontWeight = '700';
        borderRadius = '6px';
      } else if (isStart) {
        bg = '#0f172a';
        color = '#ffffff';
        fontWeight = '700';
        borderRadius = '6px 0 0 6px';
      } else if (isEnd || isHoverEnd) {
        bg = '#0f172a';
        color = '#ffffff';
        fontWeight = '700';
        borderRadius = '0 6px 6px 0';
      } else if (isInRange || isHoverRange) {
        bg = '#f1f5f9';
        color = '#0f172a';
        fontWeight = '600';
        borderRadius = '0';
      }

      days.push(
        <button
          key={dayIso}
          type="button"
          onClick={() => handleDateClick(dayIso)}
          onMouseEnter={() => {
            if (selectingStep === 1) setHoverDate(dayIso);
          }}
          style={{
            width: '34px',
            height: '32px',
            border: 'none',
            background: bg,
            color: color,
            borderRadius: borderRadius,
            fontWeight: fontWeight,
            fontSize: '12.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transition: 'background-color 0.12s ease',
            opacity: isBeforeStart ? 0.6 : 1,
            outline: 'none',
            fontFamily: 'Inter, sans-serif'
          }}
          title={isBeforeStart ? `Click to reset start date to ${dayIso}` : dayIso}
        >
          {day}
          {isToday && !isStart && !isEnd && !isHoverEnd && (
            <span style={{
              position: 'absolute',
              bottom: '3px',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: '#e6007e'
            }}></span>
          )}
        </button>
      );
    }

    return (
      <div>
        {/* Month Header with Navigation */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
          padding: '0 2px'
        }}>
          <button
            type="button"
            onClick={prevMonth}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#475569'
            }}
            title="Previous Month"
          >
            <i className="bx bx-chevron-left" style={{ fontSize: '18px' }}></i>
          </button>

          <div style={{
            fontWeight: '700',
            fontSize: '13.5px',
            color: '#0f172a',
            fontFamily: 'Montserrat, sans-serif'
          }}>
            {MONTH_NAMES[month]} {year}
          </div>

          <button
            type="button"
            onClick={nextMonth}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#475569'
            }}
            title="Next Month"
          >
            <i className="bx bx-chevron-right" style={{ fontSize: '18px' }}></i>
          </button>
        </div>

        {/* Days of Week Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 34px)',
          gap: '2px',
          marginBottom: '6px',
          textAlign: 'center'
        }}>
          {DAYS_OF_WEEK.map((d, i) => (
            <div key={i} style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Days Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 34px)',
          gap: '2px',
          rowGap: '2px'
        }}>
          {days}
        </div>
      </div>
    );
  };

  // Formatted display text for single input box
  let inputValue = '';
  if (startDate && endDate) {
    inputValue = `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
  } else if (startDate) {
    inputValue = `${formatDisplayDate(startDate)} - ...`;
  }

  const hasValue = Boolean(startDate || endDate);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', width: '250px' }}>
      {/* ── Single Input Box ── */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 12px 9px 36px',
          borderRadius: '8px',
          border: isOpen ? '1.5px solid #0f172a' : '1.5px solid #cbd5e1',
          background: '#ffffff',
          fontSize: '13px',
          fontWeight: '500',
          color: hasValue ? '#0f172a' : '#94a3b8',
          cursor: 'pointer',
          boxSizing: 'border-box',
          position: 'relative',
          userSelect: 'none',
          fontFamily: 'Inter, sans-serif',
          boxShadow: isOpen ? '0 0 0 3px rgba(15,23,42,0.08)' : 'none',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
        }}
        title="Click to select date range"
      >
        <i
          className="bx bx-calendar"
          style={{
            position: 'absolute',
            left: '11px',
            fontSize: '17px',
            color: hasValue ? '#0f172a' : '#64748b'
          }}
        ></i>

        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {inputValue || placeholder}
        </span>

        {hasValue ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePreset('clear');
            }}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: '#64748b',
              cursor: 'pointer',
              marginLeft: '6px',
              flexShrink: 0
            }}
            title="Clear date range"
          >
            ✕
          </button>
        ) : (
          <i className={`bx bx-chevron-down`} style={{ fontSize: '16px', color: '#94a3b8', marginLeft: '6px' }}></i>
        )}
      </div>

      {/* ── Single Month Calendar Popup ── */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 1000,
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.16)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            width: '280px',
            fontFamily: 'Inter, sans-serif'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Status / Instructions */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '10px',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                color: selectingStep === 1 ? '#e6007e' : '#0f172a'
              }}>
                {selectingStep === 0
                  ? (tempStart && tempEnd ? 'Selected Range:' : 'Select Start Date')
                  : 'Select End Date'}
              </span>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155', marginTop: '2px' }}>
                {tempStart ? formatDisplayDate(tempStart) : '—'}
                {' → '}
                {tempEnd ? formatDisplayDate(tempEnd) : (selectingStep === 1 ? (hoverDate ? formatDisplayDate(hoverDate) : '...') : '—')}
              </span>
            </div>

            {hasValue && (
              <button
                type="button"
                onClick={() => handlePreset('clear')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: '2px 4px'
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Single Month Calendar */}
          {renderSingleMonth(viewDate.getFullYear(), viewDate.getMonth())}

          {/* Quick Preset Buttons Toolbar */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            paddingTop: '10px',
            borderTop: '1px solid #f1f5f9'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              {[
                { label: 'Today', key: 'today' },
                { label: 'Yesterday', key: 'yesterday' },
                { label: 'Last 7 Days', key: '7days' },
                { label: 'Last 30 Days', key: '30days' }
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handlePreset(p.key)}
                  style={{
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#475569',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#0f172a';
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.borderColor = '#0f172a';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.color = '#475569';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                width: '100%',
                padding: '6px 0',
                borderRadius: '6px',
                border: 'none',
                background: '#0f172a',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
