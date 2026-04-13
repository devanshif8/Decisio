import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToastProvider } from './components/Toast';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <ToastProvider>
        <App />
    </ToastProvider>
);