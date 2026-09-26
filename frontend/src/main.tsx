import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App.js';
import { ToastProvider } from './components/ToastProvider.js';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');
createRoot(root).render(
  <ToastProvider>
    <App />
  </ToastProvider>
);
