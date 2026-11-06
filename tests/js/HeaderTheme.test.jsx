import { afterEach, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('resources/css/dashboard.css', 'utf8');

// Check the actual stylesheet rather than only a theme class on the component.
afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });

it.each(['', 'dashboard-profile-theme'])('uses the shared red header with readable controls and notification popup (%s)', theme => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    document.body.innerHTML = `<div class="dashboard-shell ${theme}"><header class="dashboard-header">
        <div class="dashboard-account"><small>Staff</small><button class="dashboard-inbox-trigger">Notifications</button>
        <span class="dashboard-unread-count">2</span><section class="dashboard-inbox-panel">Notifikasi</section></div>
    </header></div>`;
    const computed = selector => getComputedStyle(document.querySelector(selector));
    expect(computed('.dashboard-header').backgroundColor).toBe('rgb(241, 61, 49)');
    expect(computed('.dashboard-header').color).toBe('rgb(255, 255, 255)');
    expect(computed('.dashboard-account small').color).toBe('rgb(255, 227, 223)');
    expect(computed('.dashboard-inbox-trigger').color).toBe('rgb(255, 255, 255)');
    expect(computed('.dashboard-inbox-panel').color).toBe('rgb(23, 34, 55)');
    expect(computed('.dashboard-unread-count').backgroundColor).toBe('rgb(255, 255, 255)');
});
