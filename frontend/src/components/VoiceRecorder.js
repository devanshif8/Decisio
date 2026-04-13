import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square } from 'lucide-react';
import { useToast } from './Toast';

const WaveformVisualizer = () => {
    const bars = 24;
    return (
        <div className="waveform-container">
            {Array.from({ length: bars }).map((_, i) => (
                <div
                    key={i}
                    className="waveform-bar"
                    style={{
                        animationDelay: `${i * 0.05}s`,
                        opacity: 0.4 + Math.random() * 0.6,
                    }}
                />
            ))}
        </div>
    );
};

const SkeletonLoader = () => (
    <motion.div
        className="skeleton-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
    >
        {[1, 2].map((n) => (
            <div key={n} className="skeleton-card">
                <div className="skeleton-line" style={{ width: '70%', marginBottom: '16px', height: '18px' }} />
                <div className="skeleton-line" style={{ width: '100%', marginBottom: '10px' }} />
                <div className="skeleton-line" style={{ width: '85%', marginBottom: '20px' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="skeleton-line" style={{ width: '80px', borderRadius: '20px' }} />
                    <div className="skeleton-line" style={{ width: '100px', borderRadius: '20px' }} />
                    <div className="skeleton-line" style={{ width: '60px', borderRadius: '20px' }} />
                </div>
            </div>
        ))}
    </motion.div>
);

const VoiceRecorder = ({ onResult, disabled }) => {
    const [recording, setRecording] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const mediaRecorder = useRef(null);
    const chunks = useRef([]);
    const timerRef = useRef(null);
    const toast = useToast();

    useEffect(() => {
        if (recording) {
            setElapsed(0);
            timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [recording]);

    const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder.current = new MediaRecorder(stream);
        chunks.current = [];

        mediaRecorder.current.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.current.push(e.data);
        };

        mediaRecorder.current.onstop = async () => {
            stream.getTracks().forEach((t) => t.stop());
            const blob = new Blob(chunks.current, { type: 'audio/webm' });
            setUploading(true);
            try {
                const { analyzeAudio } = await import('../services/API');
                const result = await analyzeAudio(blob);
                onResult(result);
                toast.success(`Extracted ${result.decisions?.length || 0} decisions from audio`);
            } catch (err) {
                toast.error(err.message);
            } finally {
                setUploading(false);
            }
        };

        mediaRecorder.current.start();
        setRecording(true);
    };

    const stopRecording = () => {
        mediaRecorder.current.stop();
        setRecording(false);
    };

    if (uploading) {
        return <SkeletonLoader />;
    }

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={recording ? 'recording' : 'idle'}
                className="glass-card recorder-module"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
                {!recording ? (
                    <>
                        <motion.button
                            className="record-btn idle"
                            onClick={startRecording}
                            disabled={disabled}
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Mic size={28} color="white" />
                        </motion.button>
                        <span className="record-btn-label">Tap to Record</span>
                    </>
                ) : (
                    <>
                        <WaveformVisualizer />
                        <motion.button
                            className="record-btn recording"
                            onClick={stopRecording}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Square size={22} color="white" fill="white" />
                        </motion.button>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <span style={{
                                fontVariantNumeric: 'tabular-nums',
                                fontSize: '1.1rem',
                                fontWeight: 600,
                                color: 'var(--recording-red)',
                            }}>
                                {formatTime(elapsed)}
                            </span>
                            <span className="record-btn-label">Recording...</span>
                        </div>
                    </>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

export default VoiceRecorder;
