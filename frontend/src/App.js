import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Type, Mic, Sparkles, MessageSquare, Clock, Brain } from 'lucide-react';
import Header from './components/header';
import DecisionCard from './components/decisionCard';
import VoiceRecorder from './components/VoiceRecorder';
import HistoryView from './components/HistoryView';
import InsightsView from './components/InsightsView';
import { useToast } from './components/Toast';
import { analyzeMeeting } from './services/API';
import './styles/theme.css';

/* Skeleton loader for text analysis */
const AnalysisSkeleton = () => (
    <motion.div
        className="skeleton-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ marginTop: '40px' }}
    >
        {[1, 2, 3].map((n) => (
            <div key={n} className="skeleton-card">
                <div className="skeleton-line" style={{ width: '65%', marginBottom: '16px', height: '18px' }} />
                <div className="skeleton-line" style={{ width: '100%', marginBottom: '10px' }} />
                <div className="skeleton-line" style={{ width: '80%', marginBottom: '20px' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="skeleton-line" style={{ width: '80px', borderRadius: '20px' }} />
                    <div className="skeleton-line" style={{ width: '100px', borderRadius: '20px' }} />
                </div>
            </div>
        ))}
    </motion.div>
);

/* Beautiful empty state */
const EmptyState = () => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        style={{
            textAlign: 'center',
            padding: '60px 24px',
            marginTop: '20px',
        }}
    >
        <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{ marginBottom: '24px' }}
        >
            <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'var(--accent-mint-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
            }}>
                <MessageSquare size={32} style={{ color: 'var(--accent-mint)' }} />
            </div>
        </motion.div>
        <h3 style={{
            fontSize: '1.15rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '8px',
        }}>
            No meetings yet
        </h3>
        <p style={{
            fontSize: '0.9rem',
            color: 'var(--text-tertiary)',
            maxWidth: '320px',
            margin: '0 auto',
            lineHeight: 1.6,
        }}>
            Record a meeting or paste a transcript to extract decisions, action items, and assignees.
        </p>
    </motion.div>
);

function App() {
    const [text, setText] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState('voice'); // 'voice' | 'text'
    const [page, setPage] = useState('new'); // 'new' | 'history'
    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem('decisio-theme') === 'dark';
    });
    const toast = useToast();

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
        localStorage.setItem('decisio-theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

    const toggleDarkMode = () => setDarkMode((d) => !d);

    const handleRun = async () => {
        setLoading(true);
        try {
            const result = await analyzeMeeting(text);
            setData(result);
            toast.success(`Extracted ${result.decisions?.length || 0} decisions`);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            maxWidth: '1080px',
            margin: '0 auto',
            padding: '0 32px 80px',
            minHeight: '100vh',
        }}>
            <Header darkMode={darkMode} toggleDarkMode={toggleDarkMode} />

            {/* Page Switcher: New Meeting | History */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.05 }}
                style={{ marginBottom: '24px' }}
            >
                <div className="mode-switcher">
                    <button
                        className={`mode-btn ${page === 'new' ? 'active' : ''}`}
                        onClick={() => setPage('new')}
                    >
                        <Sparkles size={15} />
                        New Meeting
                    </button>
                    <button
                        className={`mode-btn ${page === 'history' ? 'active' : ''}`}
                        onClick={() => setPage('history')}
                    >
                        <Clock size={15} />
                        History
                    </button>
                    <button
                        className={`mode-btn ${page === 'insights' ? 'active' : ''}`}
                        onClick={() => setPage('insights')}
                    >
                        <Brain size={15} />
                        ML Insights
                    </button>
                </div>
            </motion.div>

            <AnimatePresence mode="wait">
                {page === 'history' ? (
                    <motion.div
                        key="history"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <HistoryView />
                    </motion.div>
                ) : page === 'insights' ? (
                    <motion.div
                        key="insights"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <InsightsView />
                    </motion.div>
                ) : (
                    <motion.div
                        key="new"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {/* Input Mode Switcher */}
                        <div className="mode-switcher" style={{ marginBottom: '24px' }}>
                            <button
                                className={`mode-btn ${mode === 'voice' ? 'active' : ''}`}
                                onClick={() => setMode('voice')}
                            >
                                <Mic size={16} />
                                Voice
                            </button>
                            <button
                                className={`mode-btn ${mode === 'text' ? 'active' : ''}`}
                                onClick={() => setMode('text')}
                            >
                                <Type size={16} />
                                Text
                            </button>
                        </div>

                        {/* Input Area */}
                        <AnimatePresence mode="wait">
                            {mode === 'voice' ? (
                                <motion.div
                                    key="voice"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                                >
                                    <VoiceRecorder onResult={setData} disabled={loading} />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="text"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                                >
                                    <textarea
                                        className="text-input"
                                        placeholder="Paste your meeting transcript here..."
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                    />
                                    <motion.button
                                        className="btn-primary"
                                        onClick={handleRun}
                                        disabled={loading || !text}
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        style={{
                                            width: '100%',
                                            marginTop: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                        }}
                                    >
                                        <Sparkles size={16} />
                                        {loading ? 'Analyzing...' : 'Extract Decisions'}
                                    </motion.button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Results */}
                        <AnimatePresence mode="wait">
                            {loading && mode === 'text' ? (
                                <AnalysisSkeleton key="skeleton" />
                            ) : data ? (
                                <motion.div
                                    key="results"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    style={{ marginTop: '40px' }}
                                >
                                    {/* Summary */}
                                    <motion.div
                                        className="glass-card"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5 }}
                                        style={{
                                            marginBottom: '24px',
                                            fontStyle: 'italic',
                                            fontSize: '0.9rem',
                                            lineHeight: 1.7,
                                            color: 'var(--text-secondary)',
                                            borderLeft: '3px solid var(--accent-lavender)',
                                        }}
                                    >
                                        {data.summary}
                                    </motion.div>

                                    {/* Decision Cards */}
                                    <div className="decisions-grid">
                                        {data.decisions.map((d, i) => (
                                            <DecisionCard key={d.id || i} decision={d} index={i} />
                                        ))}
                                    </div>
                                </motion.div>
                            ) : (
                                <EmptyState key="empty" />
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default App;
