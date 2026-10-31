import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import ConfirmModal from '../../../../components/ConfirmModal/ConfirmModal';
import { TableSkeleton, DatabaseErrorState } from '../../../../components/Loading';

const API = `${API_BASE_URL}/chatbot`;

// ── Inline modal backdrop (Click outside disabled to prevent accidental data loss) ──
const ModalBackdrop = ({ children }) => ReactDOM.createPortal(
  <div
    style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.65)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)', padding: '20px'
    }}
  >
    <div style={{ width: '100%', maxWidth: '580px', position: 'relative' }}>
      {children}
    </div>
  </div>,
  document.body
);

// ── Shared label style ─────────────────────────────────────────────────────────
import { useToast } from '../../../../components/Toast/Toast';

import { API_BASE_URL } from '../../../../utils/apiConfig';
const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' };
const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', color: '#0f172a', background: '#ffffff', outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' };
const textareaStyle = { ...inputStyle, resize: 'vertical', minHeight: '110px', lineHeight: '1.5' };
const primaryBtn = { background: '#e6007e', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 22px', fontWeight: '700', fontSize: '13.5px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', boxShadow: '0 4px 12px rgba(230,0,126,0.3)' };
const ghostBtn   = { background: '#ffffff', color: '#64748b', border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '10px 20px', fontWeight: '600', fontSize: '13.5px', cursor: 'pointer' };

// ─────────────────────────────────────────────────────────────────────────────
const ChatbotKbTab = ({ showToast: propShowToast }) => {
  const { showToast: localShowToast, ToastPortal } = useToast();
  const triggerToast = propShowToast || localShowToast;

  const [activeSubTab, setActiveSubTab] = useState('kb_entries');

  // Pagination state for both tabs
  const KB_PAGE_SIZE = 8;
  const QUEUE_PAGE_SIZE = 8;
  const [kbPage, setKbPage] = useState(1);
  const [queuePage, setQueuePage] = useState(1);

  // Get admin identity for audit logging
  const adminUser = (() => {
    try { return JSON.parse(localStorage.getItem('hiring_user') || '{}'); } catch { return {}; }
  })();
  const actorId = adminUser?.id || adminUser?.User_ID || 1;
  const actorName = (adminUser?.first_name || adminUser?.User_Fname)
    ? `${adminUser.first_name || adminUser.User_Fname} ${adminUser.last_name || adminUser.User_Lname}`.trim()
    : (adminUser?.email || adminUser?.User_Email || 'Admin');

  // KB Entries
  const [kbEntries,   setKbEntries]   = useState([]);
  const [loadingKb,   setLoadingKb]   = useState(true);
  const [kbError,     setKbError]     = useState(null);
  const [kbSearch,    setKbSearch]    = useState('');

  // Review Queue
  const [queueEntries, setQueueEntries] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [queueError,   setQueueError]   = useState(null);

  // KB Entry Modal (add / edit)
  const [showKbModal,   setShowKbModal]   = useState(false);
  const [editingEntry,  setEditingEntry]  = useState(null);
  const [kbForm,        setKbForm]        = useState({ primary_question: '', predefined_answer: '', keyword_tags: '' });
  const [formErrors,    setFormErrors]    = useState({});
  const [savingKb,      setSavingKb]      = useState(false);
  const [deletingId,    setDeletingId]    = useState(null);

  const setToast = (t) => {
    if (!t) return;
    const type = t.type === 'error' ? 'danger' : (t.type || 'success');
    triggerToast(t.message, type);
  };

  // Confirmation Modals (Replacing browser popups)
  const [kbToDelete,    setKbToDelete]    = useState(null);
  const [queueToDelete, setQueueToDelete] = useState(null);

  // Map Query Modal
  const [showMapModal,  setShowMapModal]  = useState(false);
  const [mapTarget,     setMapTarget]     = useState(null);
  const [mapMode,       setMapMode]       = useState('existing');
  const [selectedKbId,  setSelectedKbId]  = useState('');
  const [appendTags,    setAppendTags]    = useState('');
  const [newForm,       setNewForm]       = useState({ primary_question: '', predefined_answer: '', keyword_tags: '' });
  const [savingMap,     setSavingMap]     = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchKbEntries();
    fetchQueueEntries();
  }, []);

  const fetchKbEntries = async () => {
    setLoadingKb(true);
    setKbError(null);
    try {
      const res  = await fetch(`${API}/get_knowledge_base.php`);
      if (!res.ok) throw new Error(`Server status ${res.status}`);
      const data = await res.json();
      if (data.status === 'success') {
        setKbEntries(data.entries || []);
      } else {
        throw new Error(data.message || 'Failed to load knowledge base entries.');
      }
    } catch (e) {
      console.error(e);
      setKbError(e.message || 'Database connection error while retrieving knowledge base.');
    } finally {
      setLoadingKb(false);
    }
  };

  const fetchQueueEntries = async () => {
    setLoadingQueue(true);
    setQueueError(null);
    try {
      const res  = await fetch(`${API}/get_unanswered.php`);
      if (!res.ok) throw new Error(`Server status ${res.status}`);
      const data = await res.json();
      if (data.status === 'success') {
        setQueueEntries(data.entries || []);
      } else {
        throw new Error(data.message || 'Failed to load unanswered queries.');
      }
    } catch (e) {
      console.error(e);
      setQueueError(e.message || 'Database connection error while retrieving unanswered queries.');
    } finally {
      setLoadingQueue(false);
    }
  };

  // ── Form Validation ──────────────────────────────────────────────────────────
  const validateKbForm = () => {
    const errors = {};
    if (!kbForm.primary_question.trim()) {
      errors.primary_question = 'Please provide a primary question.';
    }
    if (!kbForm.predefined_answer.trim()) {
      errors.predefined_answer = 'Please enter a predefined answer.';
    }
    if (!kbForm.keyword_tags.trim()) {
      errors.keyword_tags = 'Please enter at least one keyword tag for matching.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── KB CRUD ──────────────────────────────────────────────────────────────────
  const openAddModal = () => {
    setEditingEntry(null);
    setKbForm({ primary_question: '', predefined_answer: '', keyword_tags: '' });
    setFormErrors({});
    setShowKbModal(true);
  };

  const openEditModal = (entry) => {
    setEditingEntry(entry);
    setKbForm({ primary_question: entry.primary_question, predefined_answer: entry.predefined_answer, keyword_tags: entry.keyword_tags });
    setFormErrors({});
    setShowKbModal(true);
  };

  const handleSaveKb = async () => {
    if (!validateKbForm()) return;
    setSavingKb(true);
    try {
      const res  = await fetch(`${API}/save_kb_entry.php`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: editingEntry?.id ?? null, ...kbForm, actor_id: actorId, actor_name: actorName }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setShowKbModal(false);
        setToast({
          type: 'success',
          message: editingEntry ? 'Saved response updated successfully!' : 'New saved response added successfully!'
        });
        setTimeout(() => setToast(null), 4000);
        fetchKbEntries();
      } else {
        setFormErrors({ general: data.message || 'Failed to save response.' });
      }
    } catch (err) {
      setFormErrors({ general: 'Server connection error. Please try again.' });
    } finally {
      setSavingKb(false);
    }
  };

  // ── Confirm Delete Saved Response (Modal Handler) ──────────────────────────
  const confirmDeleteKb = async () => {
    if (!kbToDelete) return;
    const id = kbToDelete.id;
    setDeletingId(id);
    try {
      const res = await fetch(`${API}/delete_kb_entry.php`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id, actor_id: actorId, actor_name: actorName }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setToast({ type: 'success', message: 'Saved response deleted successfully.' });
        setTimeout(() => setToast(null), 4000);
        fetchKbEntries();
      } else {
        setToast({ type: 'error', message: data.message || 'Failed to delete response.' });
        setTimeout(() => setToast(null), 4000);
      }
    } catch {
      setToast({ type: 'error', message: 'Network error while deleting response.' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDeletingId(null);
      setKbToDelete(null);
    }
  };

  // ── Map Query ────────────────────────────────────────────────────────────────
  const openMapModal = (entry) => {
    setMapTarget(entry);
    setMapMode('existing');
    setSelectedKbId('');
    setAppendTags('');
    setNewForm({ primary_question: entry.raw_question_text, predefined_answer: '', keyword_tags: '' });
    setShowMapModal(true);
  };

  const handleResolveQuery = async () => {
    if (!mapTarget) return;
    if (mapMode === 'existing') {
      if (!selectedKbId) {
        setToast({ type: 'error', message: 'Please select a saved response to map this query.' });
        setTimeout(() => setToast(null), 3500);
        return;
      }
    }
    if (mapMode === 'new') {
      if (!newForm.primary_question.trim()) {
        setToast({ type: 'error', message: 'Primary question is required.' });
        setTimeout(() => setToast(null), 3500);
        return;
      }
      if (!newForm.predefined_answer.trim()) {
        setToast({ type: 'error', message: 'Predefined answer is required.' });
        setTimeout(() => setToast(null), 3500);
        return;
      }
      if (!newForm.keyword_tags.trim()) {
        setToast({ type: 'error', message: 'Keyword tags are required for the chatbot to match this question.' });
        setTimeout(() => setToast(null), 3500);
        return;
      }
    }
    setSavingMap(true);
    try {
      const payload = mapMode === 'existing'
        ? { query_id: mapTarget.id, mode: 'existing', kb_id: selectedKbId, append_tags: appendTags }
        : { query_id: mapTarget.id, mode: 'new', ...newForm };
      const res  = await fetch(`${API}/resolve_query.php`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setShowMapModal(false);
        setToast({ type: 'success', message: 'Query resolved and saved!' });
        setTimeout(() => setToast(null), 4000);
        fetchQueueEntries();
        fetchKbEntries();
      } else {
        setToast({ type: 'error', message: data.message || 'Failed to resolve query.' });
        setTimeout(() => setToast(null), 4000);
      }
    } catch {
      setToast({ type: 'error', message: 'Network error while resolving query.' });
      setTimeout(() => setToast(null), 4000);
    }
    finally { setSavingMap(false); }
  };

  // ── Confirm Delete Unanswered Queue Entry (Modal Handler) ───────────────────
  const confirmDeleteQueueEntry = async () => {
    if (!queueToDelete) return;
    try {
      const res = await fetch(`${API}/delete_unanswered.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: queueToDelete.id, actor_id: actorId, actor_name: actorName })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setToast({ type: 'success', message: 'Unanswered query deleted from queue.' });
        setTimeout(() => setToast(null), 4000);
        fetchQueueEntries();
      } else {
        setToast({ type: 'error', message: data.message || 'Failed to delete query.' });
        setTimeout(() => setToast(null), 4000);
      }
    } catch {
      setToast({ type: 'error', message: 'Network error while deleting query.' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setQueueToDelete(null);
    }
  };

  // ── Filtered & paginated KB entries ────────────────────────────────────────
  const filteredKb = kbEntries.filter(e =>
    !kbSearch ||
    e.primary_question.toLowerCase().includes(kbSearch.toLowerCase()) ||
    e.keyword_tags.toLowerCase().includes(kbSearch.toLowerCase())
  );
  const kbTotalPages = Math.max(1, Math.ceil(filteredKb.length / KB_PAGE_SIZE));
  const kbSafePage = Math.min(kbPage, kbTotalPages);
  const paginatedKb = filteredKb.slice((kbSafePage - 1) * KB_PAGE_SIZE, kbSafePage * KB_PAGE_SIZE);

  // Reset page when search changes
  React.useEffect(() => { setKbPage(1); }, [kbSearch]);

  // ── Paginated queue entries ──────────────────────────────────────────────────
  const queueTotalPages = Math.max(1, Math.ceil(queueEntries.length / QUEUE_PAGE_SIZE));
  const queueSafePage = Math.min(queuePage, queueTotalPages);
  const paginatedQueue = queueEntries.slice((queueSafePage - 1) * QUEUE_PAGE_SIZE, queueSafePage * QUEUE_PAGE_SIZE);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: 'calc(100vh - 64px)', boxSizing: 'border-box', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <div style={{ width: '40px', height: '40px', background: '#1e293b', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className='bx bx-bot' style={{ fontSize: '22px', color: '#ffffff' }}></i>
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a', fontFamily: 'Montserrat, sans-serif' }}>Chatbot Intelligence Knowledge Base</h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Configure automated Q&amp;A responses and resolve unmatched candidate inquiries.</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <span style={{ background: '#f0fdf4', color: '#15803d', borderRadius: '20px', padding: '4px 14px', fontSize: '12px', fontWeight: '700', border: '1px solid #bbf7d0' }}>{kbEntries.length} Saved Responses</span>
          <span style={{ background: queueEntries.length > 0 ? '#fff7ed' : '#f8fafc', color: queueEntries.length > 0 ? '#c2410c' : '#94a3b8', borderRadius: '20px', padding: '4px 14px', fontSize: '12px', fontWeight: '700', border: `1px solid ${queueEntries.length > 0 ? '#fed7aa' : '#e2e8f0'}` }}>{queueEntries.length} Pending Review</span>
        </div>
      </div>

      {/* ══ Full-Width Manager Container ═════════════════════════════════════════ */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid #e2e8f0', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Sub-tab bar */}
        <div style={{ display: 'flex', borderBottom: '1.5px solid #e2e8f0', padding: '0 20px', flexShrink: 0 }}>
          {[
            { key: 'kb_entries',    label: 'Saved Responses',    count: kbEntries.length },
            { key: 'review_queue',  label: 'Unanswered Review Queue',  count: queueEntries.length, alert: queueEntries.length > 0 },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveSubTab(tab.key)}
              style={{ padding: '14px 20px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: activeSubTab === tab.key ? '700' : '500', color: activeSubTab === tab.key ? '#e6007e' : '#64748b', borderBottom: activeSubTab === tab.key ? '2px solid #e6007e' : '2px solid transparent', marginBottom: '-1.5px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
              {tab.label}
              <span style={{ background: tab.alert ? '#fee2e2' : '#f1f5f9', color: tab.alert ? '#b91c1c' : '#475569', borderRadius: '20px', padding: '1px 8px', fontSize: '11px', fontWeight: '700' }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── KB Entries Tab ── */}
        {activeSubTab === 'kb_entries' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            {/* Toolbar */}
            <div style={{ padding: '16px 20px', display: 'flex', gap: '10px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
              <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                <i className='bx bx-search' style={{ position: 'absolute', left: '12px', fontSize: '18px', color: '#94a3b8', pointerEvents: 'none' }}></i>
                <input
                  value={kbSearch}
                  onChange={e => setKbSearch(e.target.value)}
                  placeholder="Search questions or tags..."
                  style={{ ...inputStyle, paddingLeft: '38px', width: '100%' }}
                />
              </div>
              <button onClick={openAddModal} style={{ ...primaryBtn, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                <i className='bx bx-plus' style={{ fontSize: '18px' }}></i>
                Add Response
              </button>
            </div>

            {/* Scrollable Table Area */}
            <div className="admin-table-responsive" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minHeight: 0 }}>
              {loadingKb ? (
                <TableSkeleton
                  columns={['Question', 'Predefined Answer', 'Keyword Tags', 'Actions']}
                  columnTypes={['text', 'text', 'status', 'actions']}
                  rows={4}
                />
              ) : kbError ? (
                <DatabaseErrorState
                  title="Unable to Load Knowledge Base"
                  message={kbError}
                  onRetry={fetchKbEntries}
                />
              ) : filteredKb.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  {kbSearch ? 'No responses match your search.' : 'No saved responses yet. Add your first response!'}
                </div>
              ) : (
                <table className="admin-table" style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Question', 'Predefined Answer', 'Keyword Tags', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedKb.map((entry) => (
                      <tr key={entry.id} style={{ borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
                        <td className="admin-cell-multiline" style={{ padding: '14px 18px', color: '#1e293b', fontWeight: '600', minWidth: '240px', maxWidth: '320px', wordBreak: 'break-word', whiteSpace: 'normal' }}>{entry.primary_question}</td>
                        <td className="admin-cell-multiline" style={{ padding: '14px 18px', color: '#475569', minWidth: '320px', maxWidth: '440px', wordBreak: 'break-word', lineHeight: '1.5', whiteSpace: 'normal' }}>{entry.predefined_answer}</td>
                        <td style={{ padding: '14px 18px', maxWidth: '200px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {entry.keyword_tags.split(',').map((tag, ti) => (
                              <span key={ti} style={{ background: '#f0fdf4', color: '#15803d', borderRadius: '20px', padding: '3px 9px', fontSize: '11px', fontWeight: '600', border: '1px solid #bbf7d0' }}>{tag.trim()}</span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                          <button onClick={() => openEditModal(entry)} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', marginRight: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <i className='bx bx-edit' style={{ fontSize: '14px' }}></i> Edit
                          </button>
                          <button onClick={() => setKbToDelete(entry)} disabled={deletingId === entry.id} style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', opacity: deletingId === entry.id ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <i className='bx bx-trash' style={{ fontSize: '14px' }}></i> {deletingId === entry.id ? '…' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {/* KB Pagination */}
              {filteredKb.length > 0 && (
                <div style={{
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #e2e8f0',
                  background: '#ffffff',
                  flexWrap: 'wrap',
                  gap: '12px',
                  flexShrink: 0
                }}>
                  <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>
                    Showing <strong>{(kbSafePage - 1) * KB_PAGE_SIZE + 1}</strong> to <strong>{Math.min(kbSafePage * KB_PAGE_SIZE, filteredKb.length)}</strong> of <strong>{filteredKb.length}</strong> saved response{filteredKb.length !== 1 ? 's' : ''}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      disabled={kbSafePage <= 1}
                      onClick={() => setKbPage(p => Math.max(1, p - 1))}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: kbSafePage <= 1 ? '#f8fafc' : '#ffffff',
                        color: kbSafePage <= 1 ? '#94a3b8' : '#334155',
                        cursor: kbSafePage <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    >
                      &larr; Previous
                    </button>

                    {Array.from({ length: kbTotalPages }, (_, idx) => idx + 1).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setKbPage(p)}
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '6px',
                          border: kbSafePage === p ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                          background: kbSafePage === p ? '#0f172a' : '#ffffff',
                          color: kbSafePage === p ? '#ffffff' : '#334155',
                          fontWeight: kbSafePage === p ? '700' : '500',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        {p}
                      </button>
                    ))}

                    <button
                      type="button"
                      disabled={kbSafePage >= kbTotalPages}
                      onClick={() => setKbPage(p => Math.min(kbTotalPages, p + 1))}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: kbSafePage >= kbTotalPages ? '#f8fafc' : '#ffffff',
                        color: kbSafePage >= kbTotalPages ? '#94a3b8' : '#334155',
                        cursor: kbSafePage >= kbTotalPages ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    >
                      Next &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Review Queue Tab ── */}
        {activeSubTab === 'review_queue' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Applicant questions that didn't match any saved response. Resolve them with an existing response or draft a new response to train the chatbot.</p>
              <button onClick={fetchQueueEntries} style={{ ...ghostBtn, padding: '6px 14px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <i className='bx bx-refresh' style={{ fontSize: '16px' }}></i> Refresh Queue
              </button>
            </div>
            <div className="admin-table-responsive" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minHeight: 0 }}>
              {loadingQueue ? (
                <TableSkeleton
                  columns={['Date', 'Applicant', 'Question Asked', 'Status', 'Action']}
                  columnTypes={['date', 'text-with-subtitle', 'text', 'status', 'actions']}
                  rows={4}
                />
              ) : queueError ? (
                <DatabaseErrorState
                  title="Unable to Load Unanswered Queue"
                  message={queueError}
                  onRetry={fetchQueueEntries}
                />
              ) : queueEntries.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center' }}>
                  <i className='bx bx-check-double' style={{ fontSize: '48px', color: '#10b981', marginBottom: '12px' }}></i>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '14px', fontWeight: '600' }}>All caught up! No pending queries to review.</p>
                  <p style={{ color: '#94a3b8', margin: '4px 0 0 0', fontSize: '12px' }}>Unanswered questions asked by applicants will automatically land here.</p>
                </div>
              ) : (
                <table className="admin-table" style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Date', 'Applicant', 'Question Asked', 'Status', 'Action'].map(h => (
                        <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedQueue.map((entry) => (
                      <tr key={entry.id} style={{ borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
                        <td style={{ padding: '14px 18px', color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ padding: '14px 18px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {entry.first_name ? (
                            <div>
                              <div style={{ fontWeight: '600', color: '#1e293b' }}>{entry.first_name} {entry.last_name}</div>
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>{entry.email}</div>
                            </div>
                          ) : <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>Guest / Pre-login</span>}
                        </td>
                        <td className="admin-cell-multiline" style={{ padding: '14px 18px', color: '#1e293b', minWidth: '280px', maxWidth: '420px', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                          <span style={{ background: '#fff7ed', color: '#92400e', borderRadius: '8px', padding: '6px 12px', display: 'inline-block', fontSize: '13px', border: '1px solid #ffedd5', fontWeight: '500' }}>"{entry.raw_question_text}"</span>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{ background: '#fef3c7', color: '#b45309', borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>{entry.status}</span>
                        </td>
                        <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button onClick={() => openMapModal(entry)} style={{ ...primaryBtn, padding: '7px 14px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <i className='bx bx-git-repo-forked' style={{ fontSize: '15px' }}></i> Resolve
                            </button>
                            <button
                              onClick={() => setQueueToDelete(entry)}
                              style={{
                                background: '#fef2f2',
                                color: '#dc2626',
                                border: '1.5px solid #fecaca',
                                borderRadius: '8px',
                                padding: '6px 12px',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s ease'
                              }}
                              title="Delete unanswered question from queue"
                            >
                              <i className='bx bx-trash' style={{ fontSize: '14px' }}></i> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {/* Queue Pagination */}
              {queueEntries.length > 0 && (
                <div style={{
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #e2e8f0',
                  background: '#ffffff',
                  flexWrap: 'wrap',
                  gap: '12px',
                  flexShrink: 0
                }}>
                  <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>
                    Showing <strong>{(queueSafePage - 1) * QUEUE_PAGE_SIZE + 1}</strong> to <strong>{Math.min(queueSafePage * QUEUE_PAGE_SIZE, queueEntries.length)}</strong> of <strong>{queueEntries.length}</strong> unanswered query{queueEntries.length !== 1 ? 'ies' : 'y'}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      disabled={queueSafePage <= 1}
                      onClick={() => setQueuePage(p => Math.max(1, p - 1))}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: queueSafePage <= 1 ? '#f8fafc' : '#ffffff',
                        color: queueSafePage <= 1 ? '#94a3b8' : '#334155',
                        cursor: queueSafePage <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    >
                      &larr; Previous
                    </button>

                    {Array.from({ length: queueTotalPages }, (_, idx) => idx + 1).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setQueuePage(p)}
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '6px',
                          border: queueSafePage === p ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                          background: queueSafePage === p ? '#0f172a' : '#ffffff',
                          color: queueSafePage === p ? '#ffffff' : '#334155',
                          fontWeight: queueSafePage === p ? '700' : '500',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        {p}
                      </button>
                    ))}

                    <button
                      type="button"
                      disabled={queueSafePage >= queueTotalPages}
                      onClick={() => setQueuePage(p => Math.min(queueTotalPages, p + 1))}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: queueSafePage >= queueTotalPages ? '#f8fafc' : '#ffffff',
                        color: queueSafePage >= queueTotalPages ? '#94a3b8' : '#334155',
                        cursor: queueSafePage >= queueTotalPages ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    >
                      Next &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══ MODAL: Centered Pop-up KB Entry (Add / Edit) ════════════════════════ */}
      {showKbModal && (
        <ModalBackdrop onClose={() => setShowKbModal(false)}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0', animation: 'scaleIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a', fontFamily: 'Montserrat, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className={`bx ${editingEntry ? 'bx-edit' : 'bx-plus-circle'}`} style={{ fontSize: '22px', color: '#e6007e' }}></i>
                {editingEntry ? 'Edit Saved Response' : 'Add New Saved Response'}
              </h3>
              <button onClick={() => setShowKbModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                <i className='bx bx-x'></i>
              </button>
            </div>

            {formErrors.general && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                {formErrors.general}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Primary Question *</label>
                <input
                  value={kbForm.primary_question}
                  onChange={e => {
                    setKbForm(f => ({ ...f, primary_question: e.target.value }));
                    if (formErrors.primary_question) setFormErrors(err => ({ ...err, primary_question: null }));
                  }}
                  placeholder="e.g. How do I apply for a job?"
                  style={{ ...inputStyle, borderColor: formErrors.primary_question ? '#ef4444' : '#cbd5e1' }}
                />
                {formErrors.primary_question && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', display: 'block', fontWeight: '600' }}>{formErrors.primary_question}</span>}
              </div>

              <div>
                <label style={labelStyle}>Predefined Answer *</label>
                <textarea
                  value={kbForm.predefined_answer}
                  onChange={e => {
                    setKbForm(f => ({ ...f, predefined_answer: e.target.value }));
                    if (formErrors.predefined_answer) setFormErrors(err => ({ ...err, predefined_answer: null }));
                  }}
                  placeholder="Enter the full answer applicants will receive when this question is asked..."
                  style={{ ...textareaStyle, borderColor: formErrors.predefined_answer ? '#ef4444' : '#cbd5e1' }}
                />
                {formErrors.predefined_answer && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', display: 'block', fontWeight: '600' }}>{formErrors.predefined_answer}</span>}
              </div>

              <div>
                <label style={labelStyle}>Keyword Tags * <span style={{ color: '#94a3b8', textTransform: 'none', fontWeight: '400' }}>(comma-separated)</span></label>
                <input
                  value={kbForm.keyword_tags}
                  onChange={e => {
                    setKbForm(f => ({ ...f, keyword_tags: e.target.value }));
                    if (formErrors.keyword_tags) setFormErrors(err => ({ ...err, keyword_tags: null }));
                  }}
                  placeholder="e.g. apply, job, how to apply, application, submit"
                  style={{ ...inputStyle, borderColor: formErrors.keyword_tags ? '#ef4444' : '#cbd5e1' }}
                />
                {formErrors.keyword_tags && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', display: 'block', fontWeight: '600' }}>{formErrors.keyword_tags}</span>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowKbModal(false)} style={ghostBtn}>Cancel</button>
              <button onClick={handleSaveKb} disabled={savingKb} style={{ ...primaryBtn, opacity: savingKb ? 0.6 : 1 }}>
                {savingKb ? 'Saving…' : (editingEntry ? 'Save Changes' : 'Save Response')}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* ══ MODAL: Map Unanswered Query ════════════════════════════════════════ */}
      {showMapModal && mapTarget && (
        <ModalBackdrop onClose={() => setShowMapModal(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: '800', color: '#0f172a', fontFamily: 'Montserrat, sans-serif' }}>Resolve Unmatched Query</h3>
            <p style={{ margin: '0 0 18px', fontSize: '12px', color: '#64748b' }}>After saving, this query is removed from the review queue and the KB is updated.</p>

            {/* Logged question */}
            <div style={{ background: '#fff7ed', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px', border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#92400e', marginBottom: '4px', textTransform: 'uppercase' }}>Logged Question</div>
              <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>"{mapTarget.raw_question_text}"</div>
              {mapTarget.first_name && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>from {mapTarget.first_name} {mapTarget.last_name} ({mapTarget.email})</div>}
            </div>

            {/* Mode switcher */}
            <div className="segmented-control">
              {[['existing', 'Use Saved Response'], ['new', 'Draft New Response']].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setMapMode(mode)}
                  className={`segmented-control-btn ${mapMode === mode ? 'active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Existing mode */}
            {mapMode === 'existing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Select a Saved Response</label>
                  <select value={selectedKbId} onChange={e => setSelectedKbId(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                    <option value="">— Choose a saved response —</option>
                    {kbEntries.map(e => (
                      <option key={e.id} value={e.id}>{e.primary_question.slice(0, 70)}{e.primary_question.length > 70 ? '…' : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Append Keyword Tags <span style={{ color: '#94a3b8', textTransform: 'none', fontWeight: '400' }}>(optional)</span></label>
                  <input value={appendTags} onChange={e => setAppendTags(e.target.value)} placeholder="e.g. salary inquiry, how much do I earn" style={inputStyle} />
                </div>
              </div>
            )}

            {/* New mode */}
            {mapMode === 'new' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Primary Question *</label>
                  <input
                    value={newForm.primary_question}
                    onChange={e => setNewForm(f => ({ ...f, primary_question: e.target.value }))}
                    placeholder="How to phrase this question"
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>Predefined Answer *</label>
                  <textarea
                    value={newForm.predefined_answer}
                    onChange={e => setNewForm(f => ({ ...f, predefined_answer: e.target.value }))}
                    placeholder="Write the answer applicants will receive…"
                    style={textareaStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Keyword Tags * <span style={{ color: '#e6007e', textTransform: 'none', fontWeight: '500', fontSize: '11px' }}>(required, comma-separated)</span>
                  </label>
                  <input
                    value={newForm.keyword_tags}
                    onChange={e => setNewForm(f => ({ ...f, keyword_tags: e.target.value }))}
                    placeholder="e.g. overtime, extra hours, additional shifts"
                    style={inputStyle}
                    required
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '22px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowMapModal(false)} style={ghostBtn}>Cancel</button>
              <button onClick={handleResolveQuery} disabled={savingMap}
                style={{ ...primaryBtn, opacity: savingMap ? 0.6 : 1 }}>
                {savingMap ? 'Saving…' : 'Save & Resolve'}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* ══ Centered Confirmation Modal: Delete Saved Response ══ */}
      <ConfirmModal
        isOpen={!!kbToDelete}
        title="Delete Saved Response"
        message={`Are you sure you want to delete the response for "${kbToDelete?.primary_question}"? This action cannot be undone.`}
        confirmText={deletingId === kbToDelete?.id ? "Deleting..." : "Delete Response"}
        cancelText="Cancel"
        type="danger"
        onConfirm={confirmDeleteKb}
        onCancel={() => setKbToDelete(null)}
      />

      {/* ══ Centered Confirmation Modal: Delete Unanswered Queue Item ══ */}
      <ConfirmModal
        isOpen={!!queueToDelete}
        title="Delete Unanswered Question"
        message={`Are you sure you want to delete this unanswered question from the review queue: "${queueToDelete?.raw_question_text}"?`}
        confirmText="Delete Query"
        cancelText="Cancel"
        type="danger"
        onConfirm={confirmDeleteQueueEntry}
        onCancel={() => setQueueToDelete(null)}
      />

      {/* Standalone Toast Portal */}
      {!propShowToast && <ToastPortal />}

    </div>
  );
};

export default ChatbotKbTab;
