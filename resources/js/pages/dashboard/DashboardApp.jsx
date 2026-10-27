import { useEffect, useState } from 'react';
import { useAppNavigation } from '../../lib/useAppNavigation.js';
import { HeaderInbox } from './HeaderInbox.jsx';
import { MessagePage } from '../profile/MessagePage.jsx';
import { ProfilePage } from '../profile/ProfilePage.jsx';
import { messagingApi } from '../../lib/messagingApi.js';
import { initials } from '../../lib/format.js';
import { LogoutControl } from './LogoutControl.jsx';
import { ProjectMonitoring } from './ProjectMonitoring.jsx';
import { ProjectsPage } from '../projects/ProjectsPage.jsx';
import '../../../css/projects.css';

const rows = [
    ['Fiksasi Tim Google', 'Google Vendor', 'Ardhito Pramono', 'You', 'In Progress'],
    ['Final Recap Reimburse', 'AI for PT. Bukaka', 'Ardhito Pramono', 'Zamrud', 'Finished'],
    ['Review requirement', 'Software for PT. xxx', 'Ardhito Pramono', 'Ahmad Dhani', 'Testing'],
    ['Susun dokumentasi', 'Software for PT. xxx', 'Ardhito Pramono', 'You', 'Open Task'],
    ['Implementasi tampilan', 'Software for PT. xxx', 'Ardhito Pramono', 'Reza Artamevia', 'Finish Dev'],
];
const statuses = ['Open Task', 'In Progress', 'Finish Dev', 'Testing', 'Finished'];
const statusClass = status => status.toLowerCase().replaceAll(' ', '-');
const roleLabels = { admin: 'Admin', manager: 'Manager', staff: 'Staff' };

function SidebarChevron({ open = false }) {
    return <svg className={`dashboard-chevron${open ? ' is-open' : ''}`} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7" /></svg>;
}

function roleText(user) {
    if (!user) return 'Project Manager · Demo';
    const roles = (user.roles ?? []).map(value => roleLabels[value] ?? value).filter(Boolean);
    return roles.length ? roles.join(', ') : 'Belum ada peran';
}

export function DashboardApp({ user = null, notifications = [], page: initialPage = 'dashboard' }) {
    const page = useAppNavigation(initialPage);
    const name = user ? (user.name?.trim() || 'Pengguna') : 'Fulan bin Fulan';
    const initial = initials(name);
    const role = roleText(user);
    const isDashboard = page === 'dashboard';
    const [expanded, setExpanded] = useState(page !== 'projects');
    const [profileExpanded, setProfileExpanded] = useState(page === 'profile' || page === 'messages');
    const [mobileOpen, setMobileOpen] = useState(false);
    const [active, setActive] = useState(() => window.location.hash === '#progress-table' ? 'progress-table' : 'ai-chatbot');
    const projectSection = () => {
        const view = new URLSearchParams(window.location.search).get('view');
        if (view === 'teams') return 'teams';
        if (view === 'tasks' || /\/projects\/\d+\/tasks\/\d+/.test(window.location.pathname)) return 'tasks';
        return 'projects';
    };
    const [activeProject, setActiveProject] = useState(projectSection);

    useEffect(() => {
        const sync = () => {
            setActive(window.location.hash === '#progress-table' ? 'progress-table' : 'ai-chatbot');
            setActiveProject(projectSection());
        };
        sync();
        window.addEventListener('popstate', sync);
        window.addEventListener('hashchange', sync);
        window.addEventListener('projects:navigate', sync);
        window.addEventListener('app:navigate', sync);
        return () => {
            window.removeEventListener('popstate', sync);
            window.removeEventListener('hashchange', sync);
            window.removeEventListener('projects:navigate', sync);
            window.removeEventListener('app:navigate', sync);
        };
    }, [page]);
    const [chatUnread, setChatUnread] = useState(0);

    useEffect(() => {
        setExpanded(page !== 'projects');
        setProfileExpanded(page === 'profile' || page === 'messages');
        setMobileOpen(false);
    }, [page]);

    // Badge chat pada header memakai hitungan nyata. Halaman Message memegang
    // polling-nya sendiri agar tidak ada dua permintaan paralel.
    useEffect(() => {
        if (!user?.id || page === 'messages') return undefined;

        let live = true;
        const load = async () => {
            if (document.visibilityState === 'hidden') return;
            try {
                const data = await messagingApi.conversations();
                if (live) setChatUnread(data?.unread_count ?? 0);
            } catch {
                // Badge opsional: halaman Message menampilkan galat yang detail.
            }
        };

        load();
        const timer = setInterval(load, 5000);
        const onVisibility = () => load();
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            live = false;
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [user?.id, page]);

    useEffect(() => {
        if (!user?.id) setChatUnread(0);
    }, [user?.id]);

    function navigate(id) {
        setActive(id);
        setMobileOpen(false);
        // Native anchors retain keyboard behavior, URL hash and no-JS semantics.
    }
    function closeMobile() {
        setMobileOpen(false);
    }

    return <div className={`dashboard-shell ${isDashboard ? '' : 'dashboard-profile-theme'}`}>
        <aside className={`dashboard-sidebar ${mobileOpen ? 'is-open' : ''}`} id="dashboard-sidebar" aria-label="Navigasi utama">
            <a className="dashboard-brand" href="/dashboard" onClick={closeMobile}><span aria-hidden="true">▥</span><div><strong>Rekayasa</strong><small>Task Tracker</small></div></a>
            <nav>
                <button className="dashboard-nav-item" aria-expanded={expanded} aria-controls="dashboard-sections" onClick={() => setExpanded(!expanded)}><span aria-hidden="true">▦</span> Dashboard <SidebarChevron open={expanded} /></button>
                {expanded && <div id="dashboard-sections" className="dashboard-subnav">
                    <a href={isDashboard ? '#ai-chatbot' : '/dashboard#ai-chatbot'} aria-current={isDashboard && active === 'ai-chatbot' ? 'location' : undefined} onClick={() => navigate('ai-chatbot')}>AI Chatbot</a>
                    <a href={isDashboard ? '#progress-table' : '/dashboard#progress-table'} aria-current={isDashboard && active === 'progress-table' ? 'location' : undefined} onClick={() => navigate('progress-table')}>Progress Table</a>
                </div>}
                <a className="dashboard-nav-item" href="/projects" aria-current={page === 'projects' ? 'page' : undefined}><span aria-hidden="true">☷</span>Projects<SidebarChevron open={page === 'projects'} /></a>
                {page === 'projects' && <div id="project-sections" className="dashboard-subnav">
                    {['projects', 'tasks', 'teams'].map(section => <a key={section}
                        href={section === 'projects' ? '/projects' : `/projects?view=${section}`}
                        aria-current={activeProject === section ? 'page' : undefined}
                        onClick={closeMobile}
                    >{section[0].toUpperCase() + section.slice(1)}</a>)}
                </div>}
                <button className="dashboard-nav-item" disabled title="Calendar belum tersedia"><span aria-hidden="true">▦</span>Calendar<SidebarChevron /></button>

                <button className="dashboard-nav-item" aria-expanded={profileExpanded} aria-controls="profile-sections" onClick={() => setProfileExpanded(!profileExpanded)}><span aria-hidden="true">♙</span> Profile <SidebarChevron open={profileExpanded} /></button>
                {profileExpanded && <div id="profile-sections" className="dashboard-subnav">
                    <a href="/profile" aria-current={page === 'profile' ? 'page' : undefined}>Profile</a>
                    <a href="/profile/messages" aria-current={page === 'messages' ? 'page' : undefined}>Message</a>
                </div>}

                <button className="dashboard-nav-item" disabled title="Settings belum tersedia"><span aria-hidden="true">⚙</span>Settings<SidebarChevron /></button>
                <LogoutControl enabled={Boolean(user)} />
            </nav>
        </aside>
        <div className="dashboard-main">
            <header className="dashboard-header">
                <button className="dashboard-menu-toggle" aria-label="Buka/tutup navigasi" aria-expanded={mobileOpen} aria-controls="dashboard-sidebar" onClick={() => setMobileOpen(!mobileOpen)}>☰</button>
                <time dateTime={new Date().toISOString()}>{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</time>
                <div className="dashboard-account"><HeaderInbox key={user?.id ?? 'guest'} userId={user?.id} notifications={notifications} chatUnread={chatUnread} /><div><strong>{name}</strong><small>{role}</small></div><span className="dashboard-avatar" aria-hidden="true">{initial}</span></div>
            </header>
            <main className="dashboard-content">
                {page === 'messages' && <MessagePage user={user} onUnreadChange={setChatUnread} />}
                {page === 'profile' && <ProfilePage user={user} />}
                {page === 'projects' && <ProjectsPage user={user} />}
                {page === 'dashboard' && <>
                    <div className="dashboard-demo" role="note">{user ? 'Monitoring terhubung dengan data project. AI Chatbot belum aktif.' : 'Preview dashboard — identitas dan tabel menggunakan data contoh. AI Chatbot belum aktif.'}</div>
                    <section id="ai-chatbot" className="dashboard-welcome" aria-labelledby="welcome-title"><h1 id="welcome-title">Welcome, {name.split(/\s+/)[0]}!</h1><p>Ask AI to see everything due today across all your projects here.</p><div className="dashboard-search"><div><input aria-label="AI Chatbot (belum tersedia)" placeholder="Type here to search task or make a new project & task..." disabled /><button disabled aria-label="Tambah lampiran belum tersedia">+</button></div><button disabled aria-label="Kirim ke AI belum tersedia">➤</button></div><img src="/images/login-illustration.png" alt="" className="dashboard-illustration" /></section>
                    {user?.id ? <ProjectMonitoring userId={user.id} /> : <section id="progress-table" className="dashboard-progress" aria-labelledby="progress-title"><h2 className="sr-only" id="progress-title">Progress Table</h2><div className="dashboard-stats">{statuses.map(status => <div key={status} className={`dashboard-stat ${statusClass(status)}`}><span>{status}</span><strong>{rows.filter(row => row[4] === status).length}</strong></div>)}</div>
                        <div className="dashboard-table-card"><h3>On going Projects &amp; Tasks</h3><p className="dashboard-table-note">Data contoh — ringkasan dihitung dari lima task di bawah.</p><div className="dashboard-table-scroll" tabIndex={0} role="region" aria-label="Tabel progress, geser horizontal pada layar kecil"><table><caption className="sr-only">Daftar contoh project dan task yang sedang berjalan</caption><thead><tr>{['Task', 'Project', 'Assignee', 'PM', 'Status'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={row[0]}>{row.map((value, j) => <td key={j}>{j === 4 ? <span className={`dashboard-badge ${statusClass(value)}`}>{value}</span> : j === 0 ? <div className="dashboard-task"><span className={`task-dot task-dot-${i}`} aria-hidden="true">{i === 0 ? 'G' : ''}</span>{value}</div> : value}</td>)}</tr>)}</tbody></table></div></div>
                    </section>}
                </>}
            </main>
        </div>
    </div>;
}
