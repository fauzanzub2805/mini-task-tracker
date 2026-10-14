import { describe, expect, it } from 'vitest';
import { csrfHeaders, describeFailure, readXsrfCookie, translateMessage, validateCredentials } from '../../resources/js/pages/login/loginCore.js';

describe('login helpers', () => {
    it('validates required fields and email', () => {
        expect(validateCredentials({ email: '', password: '' })).toEqual({ email: 'Email wajib diisi.', password: 'Kata sandi wajib diisi.' });
        expect(validateCredentials({ email: 'invalid', password: 'x' })).toEqual({ email: 'Format email tidak valid.' });
        expect(validateCredentials({ email: ' a@b.co ', password: 'x' })).toEqual({});
    });
    it('translates Laravel messages', () => {
        expect(translateMessage('These credentials do not match our records.')).toMatch(/tidak cocok/);
        expect(translateMessage('Pesan lain')).toBe('Pesan lain');
    });
    it('prefers fresh XSRF cookie over bootstrap token', () => {
        expect(readXsrfCookie('a=1; XSRF-TOKEN=abc%3D')).toBe('abc=');
        expect(csrfHeaders('meta', 'XSRF-TOKEN=cookie')).toEqual({ 'X-XSRF-TOKEN': 'cookie' });
        expect(csrfHeaders('meta', '')).toEqual({ 'X-CSRF-TOKEN': 'meta' });
    });
    it('describes CSRF, throttle and server errors', () => {
        expect(describeFailure(419).kind).toBe('csrf');
        expect(describeFailure(429, {}, '42').retryAfter).toBe(42);
        expect(describeFailure(429, {}, null).retryAfter).toBe(60);
        expect(describeFailure(500).kind).toBe('server');
    });
});
