import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, X, Info } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
    success: { Icon: CheckCircle2, color: 'var(--accent-mint)' },
    error: { Icon: AlertTriangle, color: 'var(--accent-rose)' },
    info: { Icon: Info, color: 'var(--accent-blue)' },
};

const ToastItem = ({ toast, onDismiss }) => {
    const { Icon, color } = ICONS[toast.type] || ICONS.info;

    useEffect(() => {
        const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 4000);
        return () => clearTimeout(timer);
    }, [toast, onDismiss]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-glass)',
                borderLeft: `3px solid ${color}`,
                borderRadius: 'var(--radius-sm)',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                boxShadow: 'var(--shadow-lg)',
                maxWidth: '380px',
                width: '100%',
                backdropFilter: 'blur(20px)',
            }}
        >
            <Icon size={18} style={{ color, flexShrink: 0, marginTop: '1px' }} />
            <p style={{
                margin: 0, fontSize: '0.85rem', lineHeight: 1.5,
                color: 'var(--text-primary)', flex: 1,
            }}>
                {toast.message}
            </p>
            <button
                onClick={() => onDismiss(toast.id)}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-tertiary)', padding: '0', flexShrink: 0,
                    display: 'flex', alignItems: 'center',
                }}
            >
                <X size={14} />
            </button>
        </motion.div>
    );
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const dismiss = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const show = useCallback((message, type = 'info', duration = 4000) => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, message, type, duration }]);
    }, []);

    const toast = useCallback({
        success: (msg, dur) => show(msg, 'success', dur),
        error: (msg, dur) => show(msg, 'error', dur || 5000),
        info: (msg, dur) => show(msg, 'info', dur),
    }, [show]);

    // Hack: make toast callable with .success/.error/.info
    const api = Object.assign(show, toast);

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div style={{
                position: 'fixed', top: '20px', right: '20px',
                display: 'flex', flexDirection: 'column', gap: '8px',
                zIndex: 9999, pointerEvents: 'none',
            }}>
                <AnimatePresence>
                    {toasts.map((t) => (
                        <div key={t.id} style={{ pointerEvents: 'auto' }}>
                            <ToastItem toast={t} onDismiss={dismiss} />
                        </div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
};
