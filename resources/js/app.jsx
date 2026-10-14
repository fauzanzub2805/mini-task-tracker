import { StrictMode, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { LoginApp } from './pages/login/LoginApp.jsx';
import '../css/login.css';

/**
 * Entry point Vite — memuat aplikasi React pada host Blade minimal.
 *
 * Bootstrapping aman: data awal (token CSRF, email lama, user sesi) dibaca
 * dari atribut `data-login-app` yang dirender Blade sebagai JSON. Tidak ada
 * token/kata sandi yang disimpan di localStorage/sessionStorage; autentikasi
 * sepenuhnya memakai cookie sesi Laravel (HttpOnly).
 */
function bootstrap() {
    const el = document.getElementById('login-app');
    if (!el) {
        return;
    }

    let options = {};
    try {
        options = JSON.parse(el.dataset.loginApp ?? '{}');
    } catch (error) {
        options = {};
    }

    createRoot(el).render(createElement(StrictMode, null, createElement(LoginApp, { ...options, previewState: new URLSearchParams(window.location.search).get('preview') })));
}

bootstrap();
