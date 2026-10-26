import { useEffect, useState } from 'react';

export function appPage(path) {
    if (path === '/dashboard') return 'dashboard';
    if (path === '/profile') return 'profile';
    if (path === '/profile/messages') return 'messages';
    if (/^\/projects(?:\/\d+(?:\/tasks\/\d+)?)?\/?$/.test(path)) return 'projects';
    return null;
}

// Only intercept application pages, never auth actions, downloads or external links.
export function useAppNavigation(initialPage) {
    const [route, setRoute] = useState(() => ({ page: initialPage, url: window.location.href }));
    useEffect(() => {
        function sync() {
            const page = appPage(window.location.pathname);
            if (page) setRoute({ page, url: window.location.href });
        }
        function click(event) {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const link = event.target.closest?.('a[href]');
            if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self') || link.rel?.includes('external')) return;
            // Preview is deliberately isolated from authenticated client navigation.
            if (window.location.pathname === '/dashboard/preview') return;
            const url = new URL(link.href, window.location.href);
            if (url.origin !== window.location.origin || !appPage(url.pathname)) return;
            event.preventDefault();
            if (url.href !== window.location.href) window.history.pushState({}, '', url.href);
            window.dispatchEvent(new Event('app:navigate'));
        }
        document.addEventListener('click', click);
        window.addEventListener('popstate', sync);
        window.addEventListener('app:navigate', sync);
        window.addEventListener('projects:navigate', sync);
        window.addEventListener('hashchange', sync);
        return () => {
            document.removeEventListener('click', click);
            window.removeEventListener('popstate', sync);
            window.removeEventListener('app:navigate', sync);
            window.removeEventListener('projects:navigate', sync);
            window.removeEventListener('hashchange', sync);
        };
    }, []);
    useEffect(() => {
        const labels = { dashboard: 'Dashboard', projects: 'Projects', profile: 'Profile', messages: 'Message' };
        document.title = `${labels[route.page] ?? 'Dashboard'} · Rekayasa Task Tracker`;
        if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView?.();
        else window.scrollTo?.({ top: 0, behavior: 'instant' });
    }, [route]);
    return route.page;
}
