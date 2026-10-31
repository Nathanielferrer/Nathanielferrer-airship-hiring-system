import React, { useState, useRef, useEffect } from 'react';
import './WeekdayCalendarPicker.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * WeekdayCalendarPicker — A modern, accessible date picker that visibly disables
 * Saturday and Sunday with a distinct light color tint, allowing selection of
 * weekdays (Monday to Friday) only.
 */
const WeekdayCalendarPicker = ({
  value = '',
  onChange,
  min = '',
  placeholder = 'Select weekday...',
  required = false,
  disabled = false,
  style = {},
  ariaLabel = 'Select date',
  placement = 'auto' // 'auto' | 'top' | 'bottom'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [resolvedPlacement, setResolvedPlacement] = useState(placement === 'auto' ? 'bottom' : placement);
  const containerRef = useRef(null);

  // Auto-detect placement (top vs bottom) based on screen space when opened
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    if (placement !== 'auto') {
      setResolvedPlacement(placement);
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = 275;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      setResolvedPlacement('top');
    } else {
      setResolvedPlacement('bottom');
    }
  }, [isOpen, placement]);

  // Initialize viewing month/year from current value or today
  const initialDate = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  // Close popup when clicking outside or pressing Escape
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Update viewing month/year if value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  const handlePrevMonth = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day) => {
    const dateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
    if (onChange) {
      onChange(dateStr);
    }
    setIsOpen(false);
  };

  // Generate calendar days
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun, 6 = Sat
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();

  const minDateStr = min || '';
  const selectedDateStr = value || '';

  // Format value for display in the trigger input
  let formattedDisplay = '';
  if (value) {
    const d = new Date(value + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      formattedDisplay = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  }

  return (
    <div
      ref={containerRef}
      className={`weekday-picker ${disabled ? 'weekday-picker--disabled' : ''}`}
      style={{ position: 'relative', width: '100%', ...style }}
    >
      {/* ── Display Trigger Input ── */}
      <div
        className={`weekday-picker__trigger ${isOpen ? 'weekday-picker__trigger--open' : ''} ${!value ? 'weekday-picker__trigger--empty' : ''}`}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
      >
        <i className="bx bx-calendar weekday-picker__icon" />
        <span className="weekday-picker__text">
          {formattedDisplay || placeholder}
        </span>
        <i className={`bx bx-chevron-${isOpen ? 'up' : 'down'} weekday-picker__chevron`} />
      </div>

      {/* Hidden input for form validation */}
      {required && (
        <input
          type="text"
          value={value}
          required={required}
          readOnly
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            height: 0,
            width: 0,
            bottom: 0,
            left: '20px'
          }}
          tabIndex={-1}
        />
      )}

      {/* ── Dropdown Calendar Modal / Popup ── */}
      {isOpen && (
        <div
          className={`weekday-picker__dropdown ${resolvedPlacement === 'top' ? 'weekday-picker__dropdown--top' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Month / Year Navigation */}
          <div className="weekday-picker__header">
            <button
              type="button"
              className="weekday-picker__nav-btn"
              onClick={handlePrevMonth}
              title="Previous Month"
              aria-label="Previous Month"
            >
              <i className="bx bx-chevron-left" />
            </button>
            <div className="weekday-picker__title">
              <strong>{MONTH_NAMES[viewMonth]}</strong> {viewYear}
            </div>
            <button
              type="button"
              className="weekday-picker__nav-btn"
              onClick={handleNextMonth}
              title="Next Month"
              aria-label="Next Month"
            >
              <i className="bx bx-chevron-right" />
            </button>
          </div>

          {/* Day Names Row */}
          <div className="weekday-picker__weekdays">
            {DAY_LABELS.map((d, idx) => {
              const isWeekendCol = idx === 0 || idx === 6;
              return (
                <div
                  key={d}
                  className={`weekday-picker__weekday-label ${isWeekendCol ? 'weekday-picker__weekday-label--weekend' : ''}`}
                >
                  {d}
                </div>
              );
            })}
          </div>

          {/* Grid Cells */}
          <div className="weekday-picker__grid">
            {/* Blank padding cells */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`blank-${i}`} className="weekday-picker__cell weekday-picker__cell--blank" />
            ))}

            {/* Month Day Cells */}
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
              const dateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
              const dayOfWeek = new Date(viewYear, viewMonth, day).getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const isPast = minDateStr ? dateStr < minDateStr : false;
              const isSelected = selectedDateStr === dateStr;
              const isToday = (() => {
                const now = new Date();
                return (
                  now.getFullYear() === viewYear &&
                  now.getMonth() === viewMonth &&
                  now.getDate() === day
                );
              })();

              const isDisabled = isWeekend || isPast;

              let cellClass = 'weekday-picker__cell weekday-picker__cell--day';
              if (isWeekend) cellClass += ' weekday-picker__cell--weekend';
              if (isPast && !isWeekend) cellClass += ' weekday-picker__cell--past';
              if (isSelected) cellClass += ' weekday-picker__cell--selected';
              if (isToday) cellClass += ' weekday-picker__cell--today';

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => !isDisabled && handleSelectDay(day)}
                  className={cellClass}
                  title={
                    isWeekend
                      ? 'Weekends are disabled. Please choose Monday to Friday.'
                      : isPast
                      ? 'Past dates cannot be selected.'
                      : `Select ${MONTH_NAMES[viewMonth]} ${day}, ${viewYear}`
                  }
                >
                  <span className="weekday-picker__cell-num">{day}</span>
                </button>
              );
            })}
          </div>

          {/* Bottom Footer Notice */}
          <div className="weekday-picker__footer">
            <span className="weekday-picker__legend-dot" />
            <span>Weekends disabled (Mon – Fri only)</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeekdayCalendarPicker;
