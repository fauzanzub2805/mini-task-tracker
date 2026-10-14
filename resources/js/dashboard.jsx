import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DashboardApp } from './pages/dashboard/DashboardApp.jsx';
import '../css/dashboard.css';

const root = document.getElementById('dashboard-app');
if (root) {
    const options = JSON.parse(root.dataset.dashboard ?? '{}');
    createRoot(root).render(<StrictMode><DashboardApp {...options} /></StrictMode>);
}
