import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain, Layers, AlertTriangle, ArrowUp, ArrowRight, ArrowDown,
    BarChart3, Sparkles, RefreshCw, User,
} from 'lucide-react';
import { getMLInsights } from '../services/API';

const priorityConfig = {
    High: { icon: ArrowUp, color: '#EF4444', bg: 'var(--accent-rose-soft)' },
    Medium: { icon: ArrowRight, color: 'var(--accent-blue)', bg: 'var(--accent-blue-soft)' },
    Low: { icon: ArrowDown, color: 'var(--accent-mint)', bg: 'var(--accent-mint-soft)' },
};

const CLUSTER_COLORS = [
    'var(--accent-mint)', 'var(--accent-lavender)', 'var(--accent-blue)',
    'var(--accent-rose)', '#F59E0B', '#8B5CF6', '#06B6D4', '#84CC16',
];

const PriorityBadge = ({ priority }) => {
    const config = priorityConfig[priority] || priorityConfig.Medium;
    const Icon = config.icon;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 10px', borderRadius: 'var(--radius-full)',
            fontSize: '0.7rem', fontWeight: 600, background: config.bg, color: config.color,
        }}>
            <Icon size={11} />
            {priority}
        </span>
    );
};

const MetricCard = ({ label, value, sub }) => (
    <div style={{
        background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
        borderRadius: 'var(--radius-sm)', padding: '16px', textAlign: 'center', flex: 1,
    }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>{label}</div>
        {sub && <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>{sub}</div>}
    </div>
);

const PriorityBar = ({ distribution, total }) => {
    const order = ['High', 'Medium', 'Low'];
    return (
        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', height: '28px', marginTop: '12px' }}>
            {order.map((level) => {
                const count = distribution[level] || 0;
                const pct = total > 0 ? (count / total) * 100 : 0;
                if (pct === 0) return null;
                const config = priorityConfig[level];
                return (
                    <div key={level} style={{
                        width: `${pct}%`, background: config.color, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.65rem', fontWeight: 600, color: '#fff',
                        transition: 'width 0.5s ease',
                    }}>
                        {pct >= 10 && `${Math.round(pct)}%`}
                    </div>
                );
            })}
        </div>
    );
};

const InsightsView = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('clusters');

    const loadInsights = () => {
        setLoading(true);
        setError(null);
        getMLInsights()
            .then(setData)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadInsights(); }, []);

    if (loading) {
        return (
            <div className="skeleton-container">
                {[1, 2, 3].map((n) => (
                    <div key={n} className="skeleton-card">
                        <div className="skeleton-line" style={{ width: '50%', marginBottom: '12px', height: '16px' }} />
                        <div className="skeleton-line" style={{ width: '80%', marginBottom: '8px' }} />
                        <div className="skeleton-line" style={{ width: '30%' }} />
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                style={{ textAlign: 'center', padding: '60px 24px' }}>
                <div style={{
                    width: '64px', height: '64px', borderRadius: '50%',
                    background: 'var(--accent-rose-soft)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
                }}>
                    <AlertTriangle size={28} style={{ color: 'var(--accent-rose)' }} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>
                    {error.includes('No decisions') ? 'No data yet' : 'Something went wrong'}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                    {error.includes('No decisions')
                        ? 'Analyze a few meetings first so the ML models have data to work with.'
                        : error}
                </p>
            </motion.div>
        );
    }

    const { clustering, priority } = data;
    const totalDecisions = priority.predictions.length;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Brain size={20} /> ML Insights
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                        Topic clustering & priority prediction
                    </p>
                </div>
                <motion.button onClick={loadInsights} whileHover={{ rotate: 180 }}
                    transition={{ duration: 0.3 }}
                    style={{
                        background: 'none', border: '1px solid var(--border-glass)',
                        borderRadius: '50%', width: '36px', height: '36px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--text-secondary)',
                    }}>
                    <RefreshCw size={16} />
                </motion.button>
            </div>

            {/* Metrics overview */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <MetricCard label="Decisions" value={totalDecisions} />
                <MetricCard label="Topics" value={clustering.metrics.n_clusters} sub="K-Means clusters" />
                <MetricCard
                    label="Silhouette"
                    value={clustering.metrics.silhouette_score != null
                        ? clustering.metrics.silhouette_score.toFixed(2) : 'N/A'}
                    sub="Cluster quality"
                />
                {priority.evaluation?.cv_accuracy_mean != null && (
                    <MetricCard
                        label="CV Accuracy"
                        value={`${(priority.evaluation.cv_accuracy_mean * 100).toFixed(0)}%`}
                        sub={`${priority.evaluation.cv_folds}-fold`}
                    />
                )}
            </div>

            {/* Priority distribution bar */}
            <div className="glass-card" style={{ marginBottom: '20px', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <BarChart3 size={15} style={{ color: 'var(--text-tertiary)' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Priority Distribution</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                        Random Forest Classifier
                    </span>
                </div>
                <PriorityBar distribution={priority.distribution} total={totalDecisions} />
                <div style={{ display: 'flex', gap: '16px', marginTop: '10px', justifyContent: 'center' }}>
                    {['High', 'Medium', 'Low'].map((level) => {
                        const config = priorityConfig[level];
                        const Icon = config.icon;
                        return (
                            <span key={level} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                <Icon size={12} style={{ color: config.color }} />
                                {level}: {priority.distribution[level] || 0}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Tab switcher */}
            <div className="mode-switcher" style={{ marginBottom: '20px' }}>
                <button className={`mode-btn ${activeTab === 'clusters' ? 'active' : ''}`}
                    onClick={() => setActiveTab('clusters')}>
                    <Layers size={15} /> Topic Clusters
                </button>
                <button className={`mode-btn ${activeTab === 'priorities' ? 'active' : ''}`}
                    onClick={() => setActiveTab('priorities')}>
                    <BarChart3 size={15} /> Priorities
                </button>
                <button className={`mode-btn ${activeTab === 'evaluation' ? 'active' : ''}`}
                    onClick={() => setActiveTab('evaluation')}>
                    <Sparkles size={15} /> Model Eval
                </button>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'clusters' && (
                    <motion.div key="clusters" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        {Object.entries(clustering.clusters).map(([id, cluster], ci) => (
                            <motion.div key={id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: ci * 0.08 }} style={{ marginBottom: '16px' }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px',
                                }}>
                                    <div style={{
                                        width: '10px', height: '10px', borderRadius: '50%',
                                        background: CLUSTER_COLORS[ci % CLUSTER_COLORS.length],
                                    }} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                        {cluster.name}
                                    </span>
                                    <span style={{
                                        fontSize: '0.7rem', color: 'var(--text-tertiary)',
                                        background: 'var(--border-subtle)', padding: '2px 8px',
                                        borderRadius: 'var(--radius-full)',
                                    }}>
                                        {cluster.decisions.length} decision{cluster.decisions.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div className="history-decisions-grid">
                                {cluster.decisions.map((d, di) => (
                                    <div key={d.id} className="glass-card" style={{
                                        padding: '14px 18px',
                                        borderLeft: `3px solid ${CLUSTER_COLORS[ci % CLUSTER_COLORS.length]}`,
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                            <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, flex: 1 }}>{d.statement}</h4>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                                {d.status}
                                            </span>
                                        </div>
                                        {d.context && (
                                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.5 }}>
                                                {d.context}
                                            </p>
                                        )}
                                        {d.assignee && d.assignee !== 'Unassigned' && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                                <User size={11} /> {d.assignee}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}

                {activeTab === 'priorities' && (
                    <motion.div key="priorities" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        {['High', 'Medium', 'Low'].map((level) => {
                            const config = priorityConfig[level];
                            const Icon = config.icon;
                            const items = priority.predictions.filter((p) => p.priority === level);
                            if (items.length === 0) return null;
                            return (
                                <motion.div key={level} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                                    style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                        <Icon size={16} style={{ color: config.color }} />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{level} Priority</span>
                                        <span style={{
                                            fontSize: '0.7rem', color: 'var(--text-tertiary)',
                                            background: 'var(--border-subtle)', padding: '2px 8px',
                                            borderRadius: 'var(--radius-full)',
                                        }}>
                                            {items.length}
                                        </span>
                                    </div>
                                    <div className="history-decisions-grid">
                                    {items.map((p) => (
                                        <div key={p.decision_id} className="glass-card" style={{
                                            padding: '14px 18px',
                                            borderLeft: `3px solid ${config.color}`,
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, flex: 1 }}>{p.statement}</h4>
                                                <PriorityBadge priority={p.priority} />
                                            </div>
                                            {p.probabilities && (
                                                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                                    {Object.entries(p.probabilities).map(([cls, prob]) => (
                                                        <span key={cls} style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                                                            {cls}: {(prob * 100).toFixed(0)}%
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}

                {activeTab === 'evaluation' && (
                    <motion.div key="evaluation" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        {/* Clustering metrics */}
                        <div className="glass-card" style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                                <Layers size={15} style={{ color: 'var(--accent-lavender)' }} />
                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Topic Clustering — TF-IDF + K-Means</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem' }}>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Algorithm:</span> K-Means</div>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Vectorizer:</span> TF-IDF</div>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Clusters (k):</span> {clustering.metrics.n_clusters}</div>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Samples:</span> {clustering.metrics.n_samples}</div>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>TF-IDF Features:</span> {clustering.metrics.n_features}</div>
                                <div>
                                    <span style={{ color: 'var(--text-tertiary)' }}>Silhouette Score:</span>{' '}
                                    <span style={{ fontWeight: 600, color: clustering.metrics.silhouette_score > 0.3 ? 'var(--accent-mint)' : 'var(--accent-rose)' }}>
                                        {clustering.metrics.silhouette_score != null ? clustering.metrics.silhouette_score.toFixed(4) : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Priority model metrics */}
                        <div className="glass-card" style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                                <BarChart3 size={15} style={{ color: 'var(--accent-blue)' }} />
                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Priority Predictor — TF-IDF + Random Forest</span>
                            </div>
                            {priority.evaluation ? (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem', marginBottom: '14px' }}>
                                        <div><span style={{ color: 'var(--text-tertiary)' }}>Algorithm:</span> Random Forest</div>
                                        <div><span style={{ color: 'var(--text-tertiary)' }}>Estimators:</span> 100</div>
                                        <div><span style={{ color: 'var(--text-tertiary)' }}>Training Samples:</span> {priority.evaluation.n_samples}</div>
                                        {priority.evaluation.cv_accuracy_mean != null && (
                                            <div>
                                                <span style={{ color: 'var(--text-tertiary)' }}>CV Accuracy:</span>{' '}
                                                <span style={{ fontWeight: 600, color: 'var(--accent-mint)' }}>
                                                    {(priority.evaluation.cv_accuracy_mean * 100).toFixed(1)}% (+/- {(priority.evaluation.cv_accuracy_std * 100).toFixed(1)}%)
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Label distribution */}
                                    {priority.evaluation.label_distribution && (
                                        <div style={{ marginBottom: '14px' }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Label Distribution</span>
                                            <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                                                {Object.entries(priority.evaluation.label_distribution).map(([label, count]) => (
                                                    <span key={label} style={{
                                                        fontSize: '0.75rem', padding: '3px 10px', borderRadius: 'var(--radius-full)',
                                                        background: priorityConfig[label]?.bg || 'var(--border-subtle)',
                                                        color: priorityConfig[label]?.color || 'var(--text-secondary)',
                                                        fontWeight: 600,
                                                    }}>
                                                        {label}: {count}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Classification report */}
                                    {priority.evaluation.classification_report && (
                                        <div style={{ marginBottom: '14px' }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Classification Report</span>
                                            <div style={{
                                                marginTop: '8px', fontSize: '0.72rem', fontFamily: 'monospace',
                                                background: 'var(--bg-primary)', borderRadius: '8px', padding: '12px', overflowX: 'auto',
                                            }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr style={{ color: 'var(--text-tertiary)' }}>
                                                            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Class</th>
                                                            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Precision</th>
                                                            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Recall</th>
                                                            <th style={{ textAlign: 'right', padding: '4px 8px' }}>F1-Score</th>
                                                            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Support</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {Object.entries(priority.evaluation.classification_report).map(([key, val]) => (
                                                            <tr key={key} style={{
                                                                borderTop: key === 'accuracy' || key === 'macro avg' ? '1px solid var(--border-subtle)' : 'none',
                                                            }}>
                                                                <td style={{ padding: '4px 8px', fontWeight: 600 }}>{key}</td>
                                                                <td style={{ textAlign: 'right', padding: '4px 8px' }}>
                                                                    {typeof val === 'object' ? (val.precision * 100).toFixed(0) + '%' : (val * 100).toFixed(0) + '%'}
                                                                </td>
                                                                <td style={{ textAlign: 'right', padding: '4px 8px' }}>
                                                                    {typeof val === 'object' ? (val.recall * 100).toFixed(0) + '%' : ''}
                                                                </td>
                                                                <td style={{ textAlign: 'right', padding: '4px 8px' }}>
                                                                    {typeof val === 'object' ? (val['f1-score'] * 100).toFixed(0) + '%' : ''}
                                                                </td>
                                                                <td style={{ textAlign: 'right', padding: '4px 8px' }}>
                                                                    {typeof val === 'object' && val.support != null ? val.support : ''}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Top features */}
                                    {priority.evaluation.top_features && priority.evaluation.top_features.length > 0 && (
                                        <div>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Top Features (Importance)</span>
                                            <div style={{ marginTop: '8px' }}>
                                                {priority.evaluation.top_features.slice(0, 10).map((f, i) => (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                        <span style={{
                                                            fontSize: '0.72rem', color: 'var(--text-tertiary)', width: '120px',
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                        }}>
                                                            {f.feature}
                                                        </span>
                                                        <div style={{
                                                            flex: 1, height: '6px', borderRadius: '3px',
                                                            background: 'var(--border-subtle)', overflow: 'hidden',
                                                        }}>
                                                            <div style={{
                                                                width: `${(f.importance / priority.evaluation.top_features[0].importance) * 100}%`,
                                                                height: '100%', borderRadius: '3px',
                                                                background: 'var(--accent-lavender)',
                                                                transition: 'width 0.5s ease',
                                                            }} />
                                                        </div>
                                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', width: '40px', textAlign: 'right' }}>
                                                            {(f.importance * 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                    Need at least 5 decisions to train the model.
                                </p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default InsightsView;
