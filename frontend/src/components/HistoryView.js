import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronRight, AlertTriangle, CheckCircle2, RefreshCw, Sparkles, Trash2, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';
import { getMeetings, getMeeting, deleteMeeting } from '../services/API';
import DecisionTimeline from './DecisionTimeline';
import { useToast } from './Toast';

const statusConfig = {
    New: { icon: Sparkles, color: 'var(--text-tertiary)', bg: 'var(--accent-blue-soft)', label: 'New' },
    Updated: { icon: RefreshCw, color: 'var(--accent-blue)', bg: 'var(--accent-blue-soft)', label: 'Updated' },
    Conflicted: { icon: AlertTriangle, color: 'var(--accent-rose)', bg: 'var(--accent-rose-soft)', label: 'Conflict' },
    Resolved: { icon: CheckCircle2, color: 'var(--accent-mint)', bg: 'var(--accent-mint-soft)', label: 'Resolved' },
};

const priorityConfig = {
    High: { icon: ArrowUp, color: '#EF4444', bg: 'var(--accent-rose-soft)' },
    Medium: { icon: ArrowRight, color: 'var(--accent-blue)', bg: 'var(--accent-blue-soft)' },
    Low: { icon: ArrowDown, color: 'var(--accent-mint)', bg: 'var(--accent-mint-soft)' },
};

const PriorityBadge = ({ priority }) => {
    const config = priorityConfig[priority];
    if (!config) return null;
    const Icon = config.icon;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '3px',
            padding: '3px 8px', borderRadius: 'var(--radius-full)',
            fontSize: '0.65rem', fontWeight: 600, background: config.bg, color: config.color,
        }}>
            <Icon size={10} />
            {priority}
        </span>
    );
};

const StatusBadge = ({ status }) => {
    const config = statusConfig[status] || statusConfig.New;
    const Icon = config.icon;
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.7rem',
            fontWeight: 600,
            background: config.bg,
            color: config.color,
        }}>
            <Icon size={11} />
            {config.label}
        </span>
    );
};

const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const HistoryView = () => {
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMeeting, setSelectedMeeting] = useState(null);
    const [meetingDetail, setMeetingDetail] = useState(null);
    const [selectedDecisionId, setSelectedDecisionId] = useState(null);
    const toast = useToast();

    useEffect(() => {
        getMeetings()
            .then(setMeetings)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Delete this meeting and all its decisions?')) return;
        try {
            await deleteMeeting(id);
            setMeetings((prev) => prev.filter((m) => m.id !== id));
            toast.success('Meeting deleted');
        } catch {
            toast.error('Failed to delete meeting');
        }
    };

    const openMeeting = async (id) => {
        setSelectedMeeting(id);
        setSelectedDecisionId(null);
        try {
            const data = await getMeeting(id);
            setMeetingDetail(data);
        } catch {
            setMeetingDetail(null);
        }
    };

    // If viewing a decision's lineage
    if (selectedDecisionId) {
        return (
            <div>
                <motion.button
                    onClick={() => setSelectedDecisionId(null)}
                    whileHover={{ x: -2 }}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontFamily: 'Inter, sans-serif',
                        padding: '0',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                    }}
                >
                    ← Back to meeting
                </motion.button>
                <DecisionTimeline decisionId={selectedDecisionId} />
            </div>
        );
    }

    // If viewing a specific meeting's decisions
    if (selectedMeeting && meetingDetail) {
        return (
            <div>
                <motion.button
                    onClick={() => { setSelectedMeeting(null); setMeetingDetail(null); }}
                    whileHover={{ x: -2 }}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontFamily: 'Inter, sans-serif',
                        padding: '0',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                    }}
                >
                    ← Back to all meetings
                </motion.button>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '6px' }}>
                        {meetingDetail.title}
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '24px' }}>
                        {formatDate(meetingDetail.created_at)} · {meetingDetail.decisions.length} decisions
                    </p>

                    {meetingDetail.summary && (
                        <div className="glass-card" style={{
                            marginBottom: '20px',
                            fontStyle: 'italic',
                            fontSize: '0.875rem',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.7,
                            borderLeft: '3px solid var(--accent-lavender)',
                        }}>
                            {meetingDetail.summary}
                        </div>
                    )}

                    <div className="history-decisions-grid">
                    {meetingDetail.decisions.map((d, i) => (
                        <motion.div
                            key={d.id}
                            className="glass-card"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                            onClick={() => setSelectedDecisionId(d.id)}
                            style={{
                                cursor: 'pointer',
                                borderLeft: '3px solid var(--accent-mint)',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, flex: 1 }}>
                                    {d.statement}
                                </h4>
                                <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                                    {d.predicted_priority && <PriorityBadge priority={d.predicted_priority} />}
                                    <StatusBadge status={d.status} />
                                </div>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: 1.5 }}>
                                {d.context}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                    {d.assignee}
                                </span>
                                <span style={{
                                    fontSize: '0.7rem',
                                    color: 'var(--accent-lavender)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                }}>
                                    View lineage <ChevronRight size={12} />
                                </span>
                            </div>
                        </motion.div>
                    ))}
                    </div>
                </motion.div>
            </div>
        );
    }

    // Meetings list
    if (loading) {
        return (
            <div className="skeleton-container">
                {[1, 2, 3].map((n) => (
                    <div key={n} className="skeleton-card">
                        <div className="skeleton-line" style={{ width: '50%', marginBottom: '12px', height: '16px' }} />
                        <div className="skeleton-line" style={{ width: '30%' }} />
                    </div>
                ))}
            </div>
        );
    }

    if (meetings.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ textAlign: 'center', padding: '60px 24px' }}
            >
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'var(--accent-lavender-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px',
                }}>
                    <Calendar size={28} style={{ color: 'var(--accent-lavender)' }} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>No meetings yet</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                    Record or analyze a meeting to start tracking decisions across sessions.
                </p>
            </motion.div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px' }}>
                Meeting History
            </h2>
            <div className="history-decisions-grid">
            {meetings.map((m, i) => (
                <motion.div
                    key={m.id}
                    className="glass-card"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    onClick={() => openMeeting(m.id)}
                    whileHover={{ scale: 1.01 }}
                    style={{
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 600 }}>
                            {m.title}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Calendar size={12} />
                                {formatDate(m.created_at)} · {formatTime(m.created_at)}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                {m.decision_count} decision{m.decision_count !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <motion.button
                            onClick={(e) => handleDelete(e, m.id)}
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                color: 'var(--text-tertiary)',
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            <Trash2 size={15} />
                        </motion.button>
                        <ChevronRight size={18} style={{ color: 'var(--text-tertiary)' }} />
                    </div>
                </motion.div>
            ))}
            </div>
        </motion.div>
    );
};

export default HistoryView;
