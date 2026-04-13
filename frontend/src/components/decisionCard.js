import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Copy, Check, CircleDot, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';

const priorityConfig = {
    High: { icon: ArrowUp, color: '#EF4444', bg: 'var(--accent-rose-soft)', label: 'High' },
    Medium: { icon: ArrowRight, color: 'var(--accent-blue)', bg: 'var(--accent-blue-soft)', label: 'Medium' },
    Low: { icon: ArrowDown, color: 'var(--accent-mint)', bg: 'var(--accent-mint-soft)', label: 'Low' },
};

const DecisionCard = ({ decision, index }) => {
    const [copiedIdx, setCopiedIdx] = useState(null);

    const confidence = Math.round(decision.confidence_score * 100);
    const confidenceClass =
        confidence >= 80 ? 'confidence-high' :
        confidence >= 50 ? 'confidence-medium' : 'confidence-low';

    const priority = decision.predicted_priority;
    const pConfig = priorityConfig[priority];

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
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {pConfig && (() => {
                        const Icon = pConfig.icon;
                        return (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                padding: '4px 10px', borderRadius: 'var(--radius-full)',
                                fontSize: '0.68rem', fontWeight: 600,
                                background: pConfig.bg, color: pConfig.color,
                            }}>
                                <Icon size={11} />
                                {pConfig.label}
                            </span>
                        );
                    })()}
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
