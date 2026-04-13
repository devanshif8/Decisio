import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, RefreshCw, Sparkles, User, ChevronDown } from 'lucide-react';
import { getDecisionLineage, updateDecisionStatus } from '../services/API';

const statusConfig = {
    New: { icon: Sparkles, color: '#9CA3AF', dotColor: 'var(--text-tertiary)', label: 'New' },
    Updated: { icon: RefreshCw, color: 'var(--accent-blue)', dotColor: 'var(--accent-blue)', label: 'Updated' },
    Conflicted: { icon: AlertTriangle, color: 'var(--accent-rose)', dotColor: 'var(--accent-rose)', label: 'Conflict' },
    Resolved: { icon: CheckCircle2, color: 'var(--accent-mint)', dotColor: 'var(--accent-mint)', label: 'Resolved' },
};

const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const DecisionTimeline = ({ decisionId }) => {
    const [lineage, setLineage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statusDropdown, setStatusDropdown] = useState(null);

    useEffect(() => {
        setLoading(true);
        getDecisionLineage(decisionId)
            .then(setLineage)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [decisionId]);

    const handleStatusChange = async (id, newStatus) => {
        try {
            await updateDecisionStatus(id, newStatus);
            // Refresh
            const updated = await getDecisionLineage(decisionId);
            setLineage(updated);
        } catch {}
        setStatusDropdown(null);
    };

    if (loading) {
        return (
            <div className="skeleton-container">
                {[1, 2, 3].map((n) => (
                    <div key={n} className="skeleton-card">
                        <div className="skeleton-line" style={{ width: '40%', marginBottom: '12px', height: '16px' }} />
                        <div className="skeleton-line" style={{ width: '80%', marginBottom: '8px' }} />
                        <div className="skeleton-line" style={{ width: '60%' }} />
                    </div>
                ))}
            </div>
        );
    }

    if (!lineage) {
        return <p style={{ color: 'var(--text-tertiary)', textAlign: 'center' }}>Could not load lineage.</p>;
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '6px' }}>
                Decision Lineage
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '28px' }}>
                Tracking how this decision evolved across {lineage.lineage.length} meeting{lineage.lineage.length !== 1 ? 's' : ''}
            </p>

            <div style={{ position: 'relative', paddingLeft: '32px' }}>
                {/* Vertical line */}
                <div style={{
                    position: 'absolute',
                    left: '11px',
                    top: '12px',
                    bottom: '12px',
                    width: '2px',
                    background: 'var(--border-subtle)',
                    borderRadius: '1px',
                }} />

                {lineage.lineage.map((node, i) => {
                    const config = statusConfig[node.status] || statusConfig.New;
                    const Icon = config.icon;
                    const isCurrent = node.id === lineage.current.id;

                    return (
                        <motion.div
                            key={node.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1, duration: 0.4 }}
                            style={{ position: 'relative', marginBottom: '24px' }}
                        >
                            {/* Status dot */}
                            <div style={{
                                position: 'absolute',
                                left: '-27px',
                                top: '6px',
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                background: config.dotColor,
                                border: '3px solid var(--bg-primary)',
                                zIndex: 1,
                                boxShadow: isCurrent ? `0 0 0 3px ${config.dotColor}33` : 'none',
                            }} />

                            <div
                                className="glass-card"
                                style={{
                                    padding: '18px',
                                    border: isCurrent ? `1px solid ${config.dotColor}44` : undefined,
                                }}
                            >
                                {/* Top row: meeting + date */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '10px',
                                }}>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        color: 'var(--text-tertiary)',
                                        letterSpacing: '0.05em',
                                        textTransform: 'uppercase',
                                    }}>
                                        {node.meeting_title}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                                        {formatDate(node.created_at)}
                                    </span>
                                </div>

                                {/* Statement */}
                                <h4 style={{
                                    margin: '0 0 8px 0',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    lineHeight: 1.4,
                                }}>
                                    {node.statement}
                                </h4>

                                {/* Context */}
                                <p style={{
                                    fontSize: '0.8rem',
                                    color: 'var(--text-secondary)',
                                    margin: '0 0 12px 0',
                                    lineHeight: 1.5,
                                }}>
                                    {node.context}
                                </p>

                                {/* Bottom row: status + assignee */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}>
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            onClick={() => setStatusDropdown(statusDropdown === node.id ? null : node.id)}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '3px 10px',
                                                borderRadius: 'var(--radius-full)',
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                fontFamily: 'Inter, sans-serif',
                                                background: statusConfig[node.status]?.dotColor ? `${statusConfig[node.status].dotColor}20` : 'var(--accent-blue-soft)',
                                                color: config.color,
                                                border: 'none',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <Icon size={11} />
                                            {config.label}
                                            <ChevronDown size={10} />
                                        </button>

                                        {statusDropdown === node.id && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="glass-card"
                                                style={{
                                                    position: 'absolute',
                                                    top: '100%',
                                                    left: 0,
                                                    marginTop: '4px',
                                                    padding: '6px',
                                                    zIndex: 10,
                                                    minWidth: '120px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '2px',
                                                }}
                                            >
                                                {Object.entries(statusConfig).map(([key, cfg]) => {
                                                    const SI = cfg.icon;
                                                    return (
                                                        <button
                                                            key={key}
                                                            onClick={() => handleStatusChange(node.id, key)}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                padding: '6px 10px',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                background: node.status === key ? 'var(--border-subtle)' : 'transparent',
                                                                color: cfg.color,
                                                                fontSize: '0.75rem',
                                                                fontWeight: 500,
                                                                fontFamily: 'Inter, sans-serif',
                                                                cursor: 'pointer',
                                                                width: '100%',
                                                                textAlign: 'left',
                                                            }}
                                                        >
                                                            <SI size={12} />
                                                            {cfg.label}
                                                        </button>
                                                    );
                                                })}
                                            </motion.div>
                                        )}
                                    </div>

                                    {node.assignee && (
                                        <span style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '0.75rem',
                                            color: 'var(--text-tertiary)',
                                        }}>
                                            <User size={12} />
                                            {node.assignee}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </motion.div>
    );
};

export default DecisionTimeline;
