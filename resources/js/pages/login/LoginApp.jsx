import { useEffect, useState } from 'react';
import { useLogin } from './useLogin.js';

export const PREVIEW_STATES = {
    signin: 'Sign In', loading: 'Loading', 'wrong-password': 'Wrong Password',
    'account-not-found': 'Account not found', otp: 'Insert OTP',
    'otp-loading': 'Loading Token', 'wrong-token': 'Wrong Token', success: 'Success Login',
};

function Icon({ kind }) {
    return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {kind === 'email' ? <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m3 6 9 6 9-6" /></> : <><rect x="4" y="10" width="16" height="12" rx="3" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v4" /></>}
    </svg>;
}
function BrandPanel() {
    return <aside className="signin-brand" aria-label="Rekayasa Task Tracker">
        <div className="signin-logo"><svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#444ce7" /><path d="M10 9v15m6-10v10m6-13v13" stroke="white" strokeWidth="3" strokeLinecap="round" /></svg><div><strong>Rekayasa</strong><span>Task Tracker</span></div></div>
        <p>Manage well your projects.</p>
        <img className="signin-illustration" src="/images/login-illustration.png" alt="" />
    </aside>;
}
function LoadingPanel() {
    return <div className="signin-loading" role="status" aria-label="Memproses…" aria-live="polite"><svg className="signin-spinner" viewBox="0 0 100 100" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <rect key={i} x="45" y="2" width="10" height="23" rx="5" fill="#e74d53" opacity={(12 - i) / 12} transform={`rotate(${i * 30} 50 50)`} />)}</svg><span className="sr-only">Memproses…</span></div>;
}
function Notice({ title, message, warning = false, onReload }) {
    return <div className={`signin-notice ${warning ? 'is-warning' : ''}`} role="alert" data-testid="login-alert"><span aria-hidden="true">ⓘ</span><div><strong>{title}</strong><p>{message}</p>{onReload && <button type="button" onClick={onReload}>Muat ulang halaman</button>}</div></div>;
}
function Support() {
    const [open, setOpen] = useState(false);
    return <footer className="signin-support">Can’t sign in? Contact <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>Administrator</button>{open && <p role="status">Hubungi administrator perusahaan atau pengirim undangan akun Anda.</p>}</footer>;
}
function CredentialsForm({ login, preview = false }) {
    return <form className="signin-form" noValidate onSubmit={preview ? e => e.preventDefault() : login.submit} aria-busy={login.loading}>
        <div className="signin-field"><label htmlFor="email">Company/Referral Email</label><div className="signin-input-wrap"><input id="email" name="email" type="email" autoComplete="username" required placeholder="Enter your email" value={login.email} onChange={e => { login.setEmail(e.target.value); login.clearFieldError('email'); }} aria-invalid={!!login.errors.email} aria-describedby={login.errors.email ? 'email-error' : undefined} /><span className="signin-input-icon"><Icon kind="email" /></span></div>{login.errors.email && <p className="signin-field-error" id="email-error">{login.errors.email}</p>}</div>
        <div className="signin-field"><label htmlFor="password">Password</label><div className="signin-input-wrap"><input id="password" name="password" type={login.showPassword ? 'text' : 'password'} autoComplete="current-password" required placeholder="Enter your password here" value={login.password} onChange={e => { login.setPassword(e.target.value); login.clearFieldError('password'); }} aria-invalid={!!login.errors.password} aria-describedby={login.errors.password ? 'password-error' : undefined} /><button className="signin-input-icon" type="button" onClick={login.togglePassword} aria-label={login.showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} aria-pressed={login.showPassword} aria-controls="password"><Icon kind="lock" /></button></div>{login.errors.password && <p className="signin-field-error" id="password-error">{login.errors.password}</p>}</div>
        <button className="signin-button" type="submit" disabled={preview || !login.canSubmit} data-testid="login-submit">{login.retryAfter > 0 ? `Tunggu ${login.retryAfter} detik` : 'Sign In'}</button>
        <button className="signin-google" type="button" disabled title="Login Google belum tersedia" aria-describedby="google-unavailable"><span className="google-mark" aria-hidden="true">G</span>Sign in with Google</button>
        <span id="google-unavailable" className="sr-only">Login Google belum tersedia.</span>
    </form>;
}
function OtpPreview() {
    return <section className="signin-otp" aria-label="Preview verifikasi OTP"><p>Insert the OTP code for 2-step Verification</p><div className="signin-otp-fields">{[1, 2, 3, 4].map(n => <input key={n} aria-label={`OTP digit ${n} (preview)`} inputMode="numeric" maxLength={1} disabled />)}</div><button className="signin-button" disabled>Verify</button><button className="signin-button signin-resend" disabled>Re-send OTP Code</button></section>;
}
function SuccessPanel({ user, onLogout, loggingOut, preview }) {
    return <section className="signin-success" data-testid="login-success"><span className="signin-success-icon" aria-hidden="true">✓</span><h2>Login berhasil</h2><p role="status">Selamat datang, <strong>{user.name}</strong>.</p><dl><dt>Email</dt><dd>{user.email}</dd><dt>Peran</dt><dd>{user.roles?.join(', ') || '-'}</dd></dl><p className="signin-success-note">{preview ? 'Contoh tampilan saja — tidak membuat sesi login.' : 'Login berhasil. Mengarahkan ke dashboard…'}</p>{!preview && <a href="/dashboard" className="signin-button">Buka Dashboard</a>}{!preview && <button className="signin-button" onClick={onLogout} disabled={loggingOut}>{loggingOut ? 'Keluar…' : 'Keluar'}</button>}</section>;
}

/** Preview tidak pernah memanggil submit/logout atau mengubah sesi server. */
export function LoginApp({ csrfToken = '', oldEmail = '', user = null, previewState = null }) {
    const login = useLogin({ csrfToken, oldEmail, user });
    const preview = Object.hasOwn(PREVIEW_STATES, previewState ?? '');
    useEffect(() => {
        if (!preview && login.user) window.location.assign('/dashboard');
    }, [preview, login.user]);
    const busy = preview ? ['loading', 'otp-loading'].includes(previewState) : login.loading;
    const otp = preview && ['otp', 'wrong-token'].includes(previewState);
    const success = preview ? previewState === 'success' : !!login.user;
    let notice = null;
    if (preview) {
        const notices = {
            'wrong-password': { title: 'Wrong Password!', message: 'Try input your password again or contact the administrator' },
            'account-not-found': { title: 'Account not found!', message: 'Try input your email again or contact the administrator' },
            otp: { title: 'Login Successful', message: 'Hold on, type the OTP code first!', warning: true },
            'wrong-token': { title: 'Wrong OTP Code!', message: 'Check your OTP code again or contact the administrator' },
        };
        notice = notices[previewState];
    } else if (login.message) {
        // Backend sengaja tidak membedakan email tidak terdaftar vs password salah.
        notice = { title: login.errorKind === 'csrf' ? 'Session expired' : 'Sign In failed', message: login.message, warning: ['csrf', 'throttle'].includes(login.errorKind), onReload: login.errorKind === 'csrf' ? login.reloadPage : undefined };
    }
    return <div className="signin-page" data-testid="login-page">
        {preview && <nav className="signin-preview" aria-label="Preview skenario"><strong>PREVIEW UI — bukan autentikasi nyata; OTP belum aktif.</strong><div>{Object.entries(PREVIEW_STATES).map(([key, label]) => <a key={key} href={`?preview=${key}`} aria-current={key === previewState ? 'page' : undefined}>{label}</a>)}<a href="/login">Kembali ke login nyata</a></div></nav>}
        <main className="signin-card">
            {notice && <Notice {...notice} />}
            <BrandPanel />
            <section className="signin-content" aria-labelledby="login-title"><h1 id="login-title">Sign In to Rekayasa Task Tracker</h1><div className="signin-body">{busy ? <LoadingPanel /> : success ? <SuccessPanel user={preview ? { name: 'Preview User', email: 'preview@example.com', roles: ['staff'] } : login.user} onLogout={login.logout} loggingOut={login.loggingOut} preview={preview} /> : otp ? <OtpPreview /> : <CredentialsForm login={login} preview={preview} />}</div><Support /></section>
        </main>
    </div>;
}
