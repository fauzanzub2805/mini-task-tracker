import { initials } from '../../lib/format.js';

const roleLabels = { admin: 'Admin', manager: 'Manager', staff: 'Staff' };

function roleText(user) {
    if (!user) return 'Belum ada peran';
    const roles = (user.roles ?? []).map(value => roleLabels[value] ?? value).filter(Boolean);
    return roles.length ? roles.join(', ') : 'Belum ada peran';
}

export function ProfilePage({ user }) {
    const name = user?.name?.trim() || 'Pengguna';

    return <section className="profile-page" aria-labelledby="profile-title">
        <h1 id="profile-title">Profile</h1>
        <p className="profile-note">Informasi akun yang sedang masuk. Data profil lengkap belum tersedia di API.</p>

        <article className="profile-card">
            <span className="profile-avatar" aria-hidden="true">{initials(name)}</span>
            <div className="profile-identity">
                <h2>{name}</h2>
                <p>{roleText(user)}</p>
            </div>
            <dl className="profile-details">
                <div><dt>Nama</dt><dd>{name}</dd></div>
                <div><dt>ID pengguna</dt><dd>{user?.id ?? '—'}</dd></div>
                <div><dt>Peran</dt><dd>{roleText(user)}</dd></div>
            </dl>
            <a className="profile-message-link" href="/profile/messages">Buka Message</a>
        </article>
    </section>;
}
