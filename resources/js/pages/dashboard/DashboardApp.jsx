import { useState } from 'react';
import { HeaderInbox } from './HeaderInbox.jsx';
import { LogoutControl } from './LogoutControl.jsx';

const rows = [
    ['Fiksasi Tim Google', 'Google Vendor', 'Ardhito Pramono', 'You', 'In Progress'],
    ['Final Recap Reimburse', 'AI for PT. Bukaka', 'Ardhito Pramono', 'Zamrud', 'Finished'],
    ['Review requirement', 'Software for PT. xxx', 'Ardhito Pramono', 'Ahmad Dhani', 'Testing'],
    ['Susun dokumentasi', 'Software for PT. xxx', 'Ardhito Pramono', 'You', 'Open Task'],
    ['Implementasi tampilan', 'Software for PT. xxx', 'Ardhito Pramono', 'Reza Artamevia', 'Finish Dev'],
];
const statuses = ['Open Task', 'In Progress', 'Finish Dev', 'Testing', 'Finished'];
const statusClass = status => status.toLowerCase().replaceAll(' ', '-');

export function DashboardApp({ user = null, notifications = [], messages = [] }) {
    const name = user ? (user.name?.trim() || 'Pengguna') : 'Fulan bin Fulan';
    const initial = Array.from(name)[0].toLocaleUpperCase('id-ID');
    const roleLabels = { admin: 'Admin', manager: 'Manager', staff: 'Staff' };
    const role = user ? (user.roles ?? []).map(value => roleLabels[value] ?? value).join(', ') || 'Belum ada peran' : 'Project Manager · Demo';
    const [expanded, setExpanded] = useState(true);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [active, setActive] = useState('ai-chatbot');
    function navigate(id) {
        setActive(id);
        setMobileOpen(false);
        // Native anchors retain keyboard behavior, URL hash and no-JS semantics.
    }
    return <div className="dashboard-shell">
        <aside className={`dashboard-sidebar ${mobileOpen ? 'is-open' : ''}`} id="dashboard-sidebar" aria-label="Navigasi utama">
            <a className="dashboard-brand" href="#ai-chatbot" onClick={() => navigate('ai-chatbot')}><span aria-hidden="true">▥</span><div><strong>Rekayasa</strong><small>Task Tracker</small></div></a>
            <nav><button className="dashboard-nav-item" aria-expanded={expanded} aria-controls="dashboard-sections" onClick={() => setExpanded(!expanded)}><span>▦</span> Dashboard <span className="dashboard-chevron">{expanded ? '⌃' : '⌄'}</span></button>
                {expanded && <div id="dashboard-sections" className="dashboard-subnav"><a href="#ai-chatbot" aria-current={active === 'ai-chatbot' ? 'location' : undefined} onClick={() => navigate('ai-chatbot')}>AI Chatbot</a><a href="#progress-table" aria-current={active === 'progress-table' ? 'location' : undefined} onClick={() => navigate('progress-table')}>Progress Table</a></div>}
                {['Projects', 'Calendar', 'Profile', 'Settings'].map((label, i) => <button key={label} className="dashboard-nav-item" disabled title={`${label} belum tersedia`}><span aria-hidden="true">{['☷', '▦', '♙', '⚙'][i]}</span>{label}<span className="dashboard-chevron">›</span></button>)}
                <LogoutControl enabled={Boolean(user)} />
                <p className="dashboard-nav-note">Menu halaman lain belum tersedia.</p>
            </nav>
        </aside>
        <div className="dashboard-main">
            <header className="dashboard-header"><button className="dashboard-menu-toggle" aria-label="Buka/tutup navigasi" aria-expanded={mobileOpen} aria-controls="dashboard-sidebar" onClick={() => setMobileOpen(!mobileOpen)}>☰</button><time dateTime={new Date().toISOString()}>{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</time><div className="dashboard-account"><HeaderInbox key={user?.id ?? 'guest'} userId={user?.id} notifications={notifications} messages={messages} /><div><strong>{name}</strong><small>{role}</small></div><span className="dashboard-avatar" aria-hidden="true">{initial}</span></div></header>
            <main className="dashboard-content"><div className="dashboard-demo" role="note">{user ? 'Tabel menggunakan data contoh. AI Chatbot belum aktif.' : 'Preview dashboard — identitas dan tabel menggunakan data contoh. AI Chatbot belum aktif.'}</div>
                <section id="ai-chatbot" className="dashboard-welcome" aria-labelledby="welcome-title"><h1 id="welcome-title">Welcome, {name.split(/\s+/)[0]}!</h1><p>Ask AI to see everything due today across all your projects here.</p><div className="dashboard-search"><div><input aria-label="AI Chatbot (belum tersedia)" placeholder="Type here to search task or make a new project & task..." disabled /><button disabled aria-label="Tambah lampiran belum tersedia">+</button></div><button disabled aria-label="Kirim ke AI belum tersedia">➤</button></div><img src="/images/login-illustration.png" alt="" className="dashboard-illustration" /></section>
                <section id="progress-table" className="dashboard-progress" aria-labelledby="progress-title"><h2 className="sr-only" id="progress-title">Progress Table</h2><div className="dashboard-stats">{statuses.map(status => <div key={status} className={`dashboard-stat ${statusClass(status)}`}><span>{status}</span><strong>{rows.filter(row => row[4] === status).length}</strong></div>)}</div>
                    <div className="dashboard-table-card"><h3>On going Projects &amp; Tasks</h3><p className="dashboard-table-note">Data contoh — ringkasan dihitung dari lima task di bawah.</p><div className="dashboard-table-scroll" tabIndex={0} role="region" aria-label="Tabel progress, geser horizontal pada layar kecil"><table><caption className="sr-only">Daftar contoh project dan task yang sedang berjalan</caption><thead><tr>{['Task', 'Project', 'Assignee', 'PM', 'Status'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={row[0]}>{row.map((value, j) => <td key={j}>{j === 4 ? <span className={`dashboard-badge ${statusClass(value)}`}>{value}</span> : j === 0 ? <div className="dashboard-task"><span className={`task-dot task-dot-${i}`} aria-hidden="true">{i === 0 ? 'G' : ''}</span>{value}</div> : value}</td>)}</tr>)}</tbody></table></div></div>
                </section>
            </main>
        </div>
    </div>;
}
