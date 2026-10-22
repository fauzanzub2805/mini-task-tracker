import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MessagePage } from '../../resources/js/pages/profile/MessagePage.jsx';

const me = { id: 1, name: 'Dewi Lestari', roles: ['staff'] };

function json(data, status = 200) {
    return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => data });
}

function conversation(overrides = {}) {
    return {
        user: { id: 2, name: 'Henry Dholi' },
        last_message: 'Halo, apa kabar?',
        last_message_at: '2026-10-04T10:00:00+00:00',
        unread_count: 1,
        status: 'unread',
        ...overrides,
    };
}

function message(overrides = {}) {
    return {
        id: 10,
        sender_id: 2,
        recipient_id: 1,
        body: 'Halo, apa kabar?',
        created_at: '2026-10-04T10:00:00+00:00',
        read_at: null,
        attachment: null,
        ...overrides,
    };
}

function stubFetch(handler) {
    const fetch = vi.fn(handler);
    vi.stubGlobal('fetch', fetch);
    return fetch;
}

beforeEach(() => {
    document.head.innerHTML = '<meta name="csrf-token" content="csrf-test-token">';
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.head.innerHTML = '';
});

it('renders the authenticated name, real conversations and green/red indicators', async () => {
    const fetch = stubFetch(url => {
        if (url.startsWith('/messaging/conversations')) {
            return json({
                data: [
                    conversation(),
                    conversation({ user: { id: 3, name: 'Rina Marlina' }, status: 'awaiting_reply', unread_count: 0, last_message: 'Menunggu balasan Anda' }),
                    conversation({ user: { id: 4, name: 'Budi' }, status: null, unread_count: 0, last_message: 'Selesai' }),
                ],
                unread_count: 2,
            });
        }
        return json({ data: [] });
    });

    render(<MessagePage user={me} />);

    expect(await screen.findByText('Henry Dholi')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Dewi Lestari' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Pesan masuk belum dibaca' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Pesan masuk sudah dibaca, belum dibalas' })).toBeInTheDocument();
    expect(screen.getByLabelText('1 pesan belum dibaca')).toBeVisible();
    expect(screen.getByText('Budi').closest('.message-conversation').querySelector('.message-status-dot')).toBeNull();
    expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin' });
    expect(screen.getByText(/maksimal 100 pesan terbaru/)).toBeVisible();
});

it('loads the thread, renders bubbles and timestamps, then marks reads up to the last visible incoming id', async () => {
    const fetch = stubFetch((url, options = {}) => {
        const method = options.method ?? 'GET';
        if (url.startsWith('/messaging/conversations')) return json({ data: [conversation()], unread_count: 1 });
        if (url === '/messaging/users/2/messages' && method === 'GET') {
            return json({
                data: [
                    message(),
                    message({ id: 11, sender_id: 1, recipient_id: 2, body: 'Baik, saya cek dulu', read_at: null }),
                ],
            });
        }
        if (url === '/messaging/users/2/read' && method === 'POST') {
            return json({ data: { updated: 1, unread_count: 0 }, unread_count: 0 });
        }
        return json({ data: [] });
    });

    render(<MessagePage user={me} />);
    fireEvent.click(await screen.findByRole('button', { name: /Henry Dholi/ }));

    expect(await screen.findByText('Halo, apa kabar?')).toBeVisible();
    expect(screen.getByText('Baik, saya cek dulu')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Henry Dholi' })).toBeVisible();
    expect(screen.getByText('Reply to message')).toBeVisible();

    const bubbles = document.querySelectorAll('.message-bubble');
    expect(bubbles).toHaveLength(2);
    expect(bubbles[0]).toHaveClass('is-incoming');
    expect(bubbles[1]).toHaveClass('is-own');

    const times = [...document.querySelectorAll('.message-meta time')];
    expect(times).toHaveLength(2);
    times.forEach(time => {
        expect(time).toHaveAttribute('datetime', '2026-10-04T10:00:00+00:00');
        expect(time).toHaveTextContent(/\d{1,2}:\d{2}(am|pm)/);
    });

    await waitFor(() => {
        const call = fetch.mock.calls.find(([url]) => url === '/messaging/users/2/read');
        expect(call).toBeTruthy();
        expect(call[1].method).toBe('POST');
        expect(call[1].headers['X-CSRF-TOKEN']).toBe('csrf-test-token');
        expect(JSON.parse(call[1].body)).toEqual({ through_id: 10 });
    });
});

it('searches user names and message bodies and lets you start a new conversation', async () => {
    const fetch = stubFetch((url, options = {}) => {
        if (url.startsWith('/messaging/conversations?q=ha')) return json({ data: [], unread_count: 0 });
        if (url.startsWith('/messaging/conversations')) return json({
            data: [conversation({ last_message: 'Halo, apa kabar?' })],
            unread_count: 1,
        });
        if (url.startsWith('/messaging/users?q=ha')) return json({ data: [{ id: 5, name: 'Hana' }] });
        if (url.startsWith('/messaging/users?q=')) return json({ data: [] });
        if (url === '/messaging/users/5/messages' && (options.method ?? 'GET') === 'GET') return json({ data: [] });
        return json({ data: [] });
    });

    render(<MessagePage user={me} />);
    await screen.findByText('Henry Dholi');

    fireEvent.change(screen.getByLabelText('Cari nama pengguna atau isi pesan'), { target: { value: 'ha' } });

    expect(await screen.findByRole('button', { name: /Hana/ })).toBeVisible();
    expect(screen.getByText('Pengguna lain')).toBeVisible();
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => url === '/messaging/conversations?q=ha')).toBe(true));
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => url === '/messaging/users?q=ha')).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: /Hana/ }));
    expect(screen.getByRole('heading', { name: 'Hana' })).toBeVisible();
    expect(await screen.findByText('Belum ada pesan. Kirim pesan pertama Anda.')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Tulis pesan' })).toBeVisible();
});

it('sends the typed message to the selected recipient and clears the draft', async () => {
    const fetch = stubFetch((url, options = {}) => {
        const method = options.method ?? 'GET';
        if (url.startsWith('/messaging/conversations')) return json({ data: [conversation()], unread_count: 1 });
        if (url === '/messaging/users/2/messages' && method === 'GET') return json({ data: [message()] });
        if (url === '/messaging/users/2/messages' && method === 'POST') {
            return json({ data: message({ id: 12, sender_id: 1, recipient_id: 2, body: 'Siap, terima kasih', read_at: null }) }, 201);
        }
        if (url === '/messaging/users/2/read') return json({ data: { updated: 1, unread_count: 0 }, unread_count: 0 });
        return json({ data: [] });
    });

    render(<MessagePage user={me} />);
    fireEvent.click(await screen.findByRole('button', { name: /Henry Dholi/ }));
    const composer = await screen.findByRole('textbox', { name: 'Tulis pesan' });

    fireEvent.change(composer, { target: { value: 'Siap, terima kasih' } });
    expect(screen.getByRole('button', { name: 'Kirim pesan' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Kirim pesan' }));

    await waitFor(() => {
        const call = fetch.mock.calls.find(([url, options]) => url === '/messaging/users/2/messages' && options.method === 'POST');
        expect(call).toBeTruthy();
        const body = call[1].body;
        expect(body).toBeInstanceOf(FormData);
        expect(body.get('body')).toBe('Siap, terima kasih');
        expect(body.get('attachment')).toBeNull();
        expect(call[1].credentials).toBe('same-origin');
        expect(call[1].headers['X-CSRF-TOKEN']).toBe('csrf-test-token');
    });

    expect(await screen.findByText('Siap, terima kasih', { selector: '.message-body' })).toBeVisible();
    await waitFor(() => expect(composer).toHaveValue(''));
});

it('uploads an allowed attachment and rejects a disallowed extension before sending', async () => {
    const fetch = stubFetch((url, options = {}) => {
        const method = options.method ?? 'GET';
        if (url.startsWith('/messaging/conversations')) return json({ data: [conversation()], unread_count: 1 });
        if (url === '/messaging/users/2/messages' && method === 'GET') return json({ data: [message()] });
        if (url === '/messaging/users/2/messages' && method === 'POST') {
            return json({
                data: message({
                    id: 13,
                    sender_id: 1,
                    recipient_id: 2,
                    body: null,
                    attachment: { name: 'laporan.pdf', size: 2048, url: '/messaging/messages/13/attachment' },
                }),
            }, 201);
        }
        if (url === '/messaging/users/2/read') return json({ data: { updated: 1, unread_count: 0 }, unread_count: 0 });
        return json({ data: [] });
    });

    render(<MessagePage user={me} />);
    fireEvent.click(await screen.findByRole('button', { name: /Henry Dholi/ }));
    const input = await screen.findByLabelText('Lampirkan file');

    const file = new File([new Uint8Array(2048)], 'laporan.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText(/laporan\.pdf/)).toBeVisible();
    expect(within(screen.getByText(/laporan\.pdf/).closest('.message-pending-file')).getByText(/2 KB/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Kirim pesan' }));

    await waitFor(() => {
        const call = fetch.mock.calls.find(([url, options]) => url === '/messaging/users/2/messages' && options.method === 'POST');
        expect(call).toBeTruthy();
        expect(call[1].body.get('attachment').name).toBe('laporan.pdf');
    });

    expect(await screen.findByRole('link', { name: /laporan\.pdf/ })).toHaveAttribute('href', '/messaging/messages/13/attachment');

    const blocked = new File(['<svg/>'], 'gambar.svg', { type: 'image/svg+xml' });
    fireEvent.change(input, { target: { files: [blocked] } });
    expect(await screen.findByText(/Jenis file \.svg tidak diizinkan/)).toBeVisible();
    await waitFor(() => {
        const posts = fetch.mock.calls.filter(([url, options]) => url === '/messaging/users/2/messages' && options.method === 'POST');
        expect(posts).toHaveLength(1);
    });
});

it('deletes only own messages through the API', async () => {
    const fetch = stubFetch((url, options = {}) => {
        const method = options.method ?? 'GET';
        if (url.startsWith('/messaging/conversations')) return json({ data: [conversation()], unread_count: 1 });
        if (url === '/messaging/users/2/messages' && method === 'GET') {
            return json({ data: [message(), message({ id: 11, sender_id: 1, recipient_id: 2, body: 'Pesan saya' })] });
        }
        if (url === '/messaging/messages/11' && method === 'DELETE') {
            return Promise.resolve({ ok: true, status: 204, json: async () => { throw new Error('no body'); } });
        }
        if (url === '/messaging/users/2/read') return json({ data: { updated: 1, unread_count: 0 }, unread_count: 0 });
        return json({ data: [] });
    });

    render(<MessagePage user={me} />);
    fireEvent.click(await screen.findByRole('button', { name: /Henry Dholi/ }));

    expect(await screen.findByText('Pesan saya')).toBeVisible();
    expect(screen.getAllByRole('button', { name: /Hapus pesan/ })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Hapus pesan: Pesan saya' }));

    await waitFor(() => {
        const call = fetch.mock.calls.find(([url]) => url === '/messaging/messages/11');
        expect(call).toBeTruthy();
        expect(call[1].method).toBe('DELETE');
    });
    await waitFor(() => expect(screen.queryByText('Pesan saya')).not.toBeInTheDocument());
});

it('keeps the draft when sending fails and surfaces validation errors', async () => {
    stubFetch((url, options = {}) => {
        const method = options.method ?? 'GET';
        if (url.startsWith('/messaging/conversations')) return json({ data: [conversation()], unread_count: 1 });
        if (url === '/messaging/users/2/messages' && method === 'GET') return json({ data: [message()] });
        if (url === '/messaging/users/2/messages' && method === 'POST') {
            return json({ message: 'Unprocessable', errors: { body: ['Pesan maksimal 4000 karakter.'] } }, 422);
        }
        if (url === '/messaging/users/2/read') return json({ data: { updated: 1, unread_count: 0 }, unread_count: 0 });
        return json({ data: [] });
    });

    render(<MessagePage user={me} />);
    fireEvent.click(await screen.findByRole('button', { name: /Henry Dholi/ }));
    const composer = await screen.findByRole('textbox', { name: 'Tulis pesan' });

    fireEvent.change(composer, { target: { value: 'Draft penting' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kirim pesan' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Pesan maksimal 4000 karakter.');
    expect(composer).toHaveValue('Draft penting');
});

it('offers a login link when the session expired', async () => {
    stubFetch(() => json({ message: 'Unauthenticated.' }, 419));

    render(<MessagePage user={me} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Sesi Anda berakhir.');
    expect(screen.getByRole('link', { name: 'Masuk kembali' })).toHaveAttribute('href', '/login');
});

it('ignores a delayed thread GET that resolves after a successful send', async () => {
    let resolveOldGet;
    let getCount = 0;

    const fetch = stubFetch((url, options = {}) => {
        const method = options.method ?? 'GET';
        if (url.startsWith('/messaging/conversations')) return json({ data: [conversation()], unread_count: 0 });
        if (url === '/messaging/users/2/messages' && method === 'GET') {
            getCount += 1;
            if (getCount === 1) {
                return new Promise(resolve => {
                    resolveOldGet = () => resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({ data: [message({ id: 10, read_at: '2026-10-04T10:05:00+00:00' })] }),
                    });
                });
            }
            return json({ data: [message({ id: 10, read_at: '2026-10-04T10:05:00+00:00' })] });
        }
        if (url === '/messaging/users/2/messages' && method === 'POST') {
            return json({ data: message({ id: 12, sender_id: 1, recipient_id: 2, body: 'Pesan baru' }) }, 201);
        }
        if (url === '/messaging/users/2/read') return json({ data: { updated: 1, unread_count: 0 }, unread_count: 0 });
        return json({ data: [] });
    });

    render(<MessagePage user={me} />);
    fireEvent.click(await screen.findByRole('button', { name: /Henry Dholi/ }));

    const composer = await screen.findByRole('textbox', { name: 'Tulis pesan' });
    fireEvent.change(composer, { target: { value: 'Pesan baru' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kirim pesan' }));

    expect(await screen.findByText('Pesan baru', { selector: '.message-body' })).toBeVisible();
    expect(fetch.mock.calls.some(([url, options]) => url === '/messaging/users/2/messages' && options.method === 'POST')).toBe(true);

    // GET lama akhirnya selesai; hasilnya harus dibuang, bukan menimpa pesan baru.
    await act(async () => { resolveOldGet(); });

    expect(screen.getByText('Pesan baru', { selector: '.message-body' })).toBeVisible();
    expect(screen.queryByText('Halo, apa kabar?', { selector: '.message-body' })).not.toBeInTheDocument();
    expect(document.querySelectorAll('.message-bubble')).toHaveLength(1);
});

it('marks the whole loaded conversation read explicitly through the highest loaded id', async () => {
    const fetch = stubFetch((url, options = {}) => {
        const method = options.method ?? 'GET';
        if (url.startsWith('/messaging/conversations')) return json({ data: [conversation({ status: 'unread', unread_count: 1 })], unread_count: 1 });
        if (url === '/messaging/users/2/messages' && method === 'GET') {
            // Hanya pesan keluar yang termuat; pesan masuk lama berada di luar
            // jendela 100 terbaru dan tidak terlihat oleh auto-read.
            return json({
                data: [
                    message({ id: 150, sender_id: 1, recipient_id: 2, body: 'Pesan keluar lama' }),
                    message({ id: 160, sender_id: 1, recipient_id: 2, body: 'Pesan keluar baru' }),
                ],
            });
        }
        if (url === '/messaging/users/2/read' && method === 'POST') {
            return json({ data: { updated: 2, unread_count: 0 }, unread_count: 0 });
        }
        return json({ data: [] });
    });

    render(<MessagePage user={me} />);
    fireEvent.click(await screen.findByRole('button', { name: /Henry Dholi/ }));

    await screen.findByText('Pesan keluar baru');
    fireEvent.click(screen.getByRole('button', { name: 'Tandai percakapan dibaca' }));

    await waitFor(() => {
        const call = fetch.mock.calls.find(([url]) => url === '/messaging/users/2/read');
        expect(call).toBeTruthy();
        expect(call[1].method).toBe('POST');
        expect(call[1].headers['X-CSRF-TOKEN']).toBe('csrf-test-token');
        expect(JSON.parse(call[1].body)).toEqual({ through_id: 160 });
    });
});

it('keeps text typed while a send is still in flight', async () => {
    let resolvePost;

    stubFetch((url, options = {}) => {
        const method = options.method ?? 'GET';
        if (url.startsWith('/messaging/conversations')) return json({ data: [conversation()], unread_count: 1 });
        if (url === '/messaging/users/2/messages' && method === 'GET') return json({ data: [message()] });
        if (url === '/messaging/users/2/messages' && method === 'POST') {
            return new Promise(resolve => {
                resolvePost = () => resolve({
                    ok: true,
                    status: 201,
                    json: async () => ({ data: message({ id: 12, sender_id: 1, recipient_id: 2, body: 'Terkirim' }) }),
                });
            });
        }
        if (url === '/messaging/users/2/read') return json({ data: { updated: 1, unread_count: 0 }, unread_count: 0 });
        return json({ data: [] });
    });

    render(<MessagePage user={me} />);
    fireEvent.click(await screen.findByRole('button', { name: /Henry Dholi/ }));
    const composer = await screen.findByRole('textbox', { name: 'Tulis pesan' });

    fireEvent.change(composer, { target: { value: 'Terkirim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kirim pesan' }));

    // Pengguna mulai mengetik pesan berikutnya selagi POST belum selesai.
    fireEvent.change(composer, { target: { value: 'Draft berikutnya' } });

    await act(async () => { resolvePost(); });

    expect(await screen.findByText('Terkirim', { selector: '.message-body' })).toBeVisible();
    expect(composer).toHaveValue('Draft berikutnya');

    // Kirim pertama selesai, jadi isi composer bukan lagi snapshot awal.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Kirim pesan' })).toBeEnabled());
});
