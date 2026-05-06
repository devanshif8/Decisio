import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Copy, Check, CircleDot, ArrowUp, ArrowRight, ArrowDown, ChevronDown, X } from 'lucide-react';
import { updateDecisionPriority } from '../services/API';

const priorityConfig = {
    High: { icon: ArrowUp, color: '#EF4444', bg: 'var(--accent-rose-soft)', label: 'High' },
    Medium: { icon: ArrowRight, color: 'var(--accent-blue)', bg: 'var(--accent-blue-soft)', label: 'Medium' },
    Low: { icon: ArrowDown, color: 'var(--accent-mint)', bg: 'var(--accent-mint-soft)', label: 'Low' },
};

const DecisionCard = ({ decision, index }) => {
    const [copiedIdx, setCopiedIdx] = useState(null);
    const [userPriority, setUserPriority] = useState(decision.user_priority || null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (!dropdownOpen) return;
        const onClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [dropdownOpen]);

    const confidence = Math.round(decision.confidence_score * 100);
    const confidenceClass =
        confidence >= 80 ? 'confidence-high' :
        confidence >= 50 ? 'confidence-medium' : 'confidence-low';

    const effectivePriority = userPriority || decision.predicted_priority;
    const pConfig = priorityConfig[effectivePriority];
    const isUserSet = !!userPriority;

    const handleSetPriority = async (newPriority) => {
        setDropdownOpen(false);
        if (newPriority === userPriority) return;
        setSaving(true);
        try {
            await updateDecisionPriority(decision.id, newPriority);
            setUserPriority(newPriority);
        } catch (e) {
            // surface failure by reverting visual optimistic state if needed
        } finally {
            setSaving(false);
        }
    };

    const copyAction = (text, idx) => {
        navigator.clipboard.writeText(text);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 1500);
    };

    return (
        <motion.div
            className="glass-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.5,
                delay: index * 0.1,
                ease: [0.16, 1, 0.3, 1],
            }}
            style={{
                borderLeft: '3px solid var(--accent-mint)',
            }}
        >
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: '12px',
            }}>
                <h3 style={{
                    margin: 0,
                    fontSize: '1rem',
                    fontWeight: 600,
                    lineHeight: 1.4,
                    color: 'var(--text-primary)',
                    flex: 1,
                }}>
                    {decision.statement}
                </h3>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                    <div ref={dropdownRef} style={{ position: 'relative' }}>
                        <button
                            onClick={() => setDropdownOpen((o) => !o)}
                            disabled={saving}
                            title={isUserSet ? 'Priority set by you — click to change' : 'Click to set priority'}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                padding: '4px 8px 4px 10px', borderRadius: 'var(--radius-full)',
                                fontSize: '0.68rem', fontWeight: 600,
                                background: pConfig ? pConfig.bg : 'var(--bg-tertiary, rgba(0,0,0,0.05))',
                                color: pConfig ? pConfig.color : 'var(--text-tertiary)',
                                border: isUserSet ? `1px solid ${pConfig.color}` : '1px dashed var(--border-subtle, rgba(0,0,0,0.15))',
                                cursor: saving ? 'wait' : 'pointer',
                                opacity: saving ? 0.6 : 1,
                                fontFamily: 'inherit',
                            }}
                        >
                            {pConfig ? (() => {
                                const Icon = pConfig.icon;
                                return <><Icon size={11} />{pConfig.label}</>;
                            })() : 'Set priority'}
                            <ChevronDown size={10} />
                        </button>

                        <AnimatePresence>
                            {dropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.15 }}
                                    className="glass-card"
                                    style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        marginTop: '4px',
                                        padding: '6px',
                                        zIndex: 20,
                                        minWidth: '140px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '2px',
                                    }}
                                >
                                    {['High', 'Medium', 'Low'].map((p) => {
                                        const cfg = priorityConfig[p];
                                        const Icon = cfg.icon;
                                        const active = userPriority === p;
                                        return (
                                            <button
                                                key={p}
                                                onClick={() => handleSetPriority(p)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    padding: '6px 10px', borderRadius: '6px',
                                                    background: active ? cfg.bg : 'transparent',
                                                    color: cfg.color,
                                                    border: 'none',
                                                    fontSize: '0.75rem', fontWeight: 600,
                                                    cursor: 'pointer', textAlign: 'left',
                                                    fontFamily: 'inherit',
                                                }}
                                            >
                                                <Icon size={12} />
                                                {p}
                                                {active && <Check size={11} style={{ marginLeft: 'auto' }} />}
                                            </button>
                                        );
                                    })}
                                    {isUserSet && (
                                        <button
                                            onClick={() => handleSetPriority(null)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                padding: '6px 10px', borderRadius: '6px',
                                                background: 'transparent',
                                                color: 'var(--text-tertiary)',
                                                border: 'none',
                                                borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                                                marginTop: '2px', paddingTop: '8px',
                                                fontSize: '0.72rem', fontWeight: 500,
                                                cursor: 'pointer', textAlign: 'left',
                                                fontFamily: 'inherit',
                                            }}
                                        >
                                            <X size={11} />
                                            Clear override
                                        </button>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <span className={`confidence-badge ${confidenceClass}`}>
                        {confidence}%
                    </span>
                </div>
            </div>

            {/* Context */}
            <p style={{
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                margin: '0 0 16px 0',
            }}>
                {decision.context}
            </p>

            {/* Actions */}
            {decision.related_actions && decision.related_actions.length > 0 && (
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    marginBottom: '16px',
                }}>
                    {decision.related_actions.map((act, i) => (
                        <motion.button
                            key={i}
                            className={`action-tag ${copiedIdx === i ? 'copied' : ''}`}
                            onClick={() => copyAction(act, i)}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            title="Click to copy"
                        >
                            <CircleDot size={12} />
                            {act}
                            {copiedIdx === i ? (
                                <Check size={12} />
                            ) : (
                                <Copy size={12} style={{ opacity: 0.4 }} />
                            )}
                        </motion.button>
                    ))}
                </div>
            )}

            {/* Assignee */}
            {decision.assignee && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    color: 'var(--text-tertiary)',
                }}>
                    <User size={14} />
                    <span style={{ fontWeight: 500 }}>{decision.assignee}</span>
                </div>
            )}
        </motion.div>
    );
};

export default DecisionCard;
