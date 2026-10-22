import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { ChatPrototype } from '../../resources/js/pages/dashboard/ChatPrototype.jsx';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('sends text with a timestamp, switches conversations, simulates replies and deletes own messages', () => {
    render(<ChatPrototype />);
    expect(screen.getByRole('button', { name: 'Kirim pesan' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Tulis pesan'), { target: { value: 'Halo tim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kirim pesan' }));
    expect(screen.getByText('Halo tim')).toBeVisible();
    expect(document.querySelector('time')).toHaveAttribute('datetime');
    expect(document.querySelector('time').textContent).toMatch(/\d{2}[.:]\d{2}/);
    fireEvent.change(screen.getByLabelText('Kirim kepada'), { target: { value: 'zamrud' } });
    expect(screen.queryByText('Halo tim')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Kirim kepada'), { target: { value: 'ardhito' } });
    fireEvent.click(screen.getByRole('button', { name: /Simulasikan balasan/ }));
    expect(screen.getByText('Baik, terima kasih. Saya cek dulu ya!')).toBeVisible();
    expect(screen.getAllByRole('button', { name: /Hapus pesan/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Hapus pesan Halo tim' }));
    expect(screen.queryByText('Halo tim')).not.toBeInTheDocument();
});
it('attaches and sends a downloadable local file and releases its URL when deleted', () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL });
    render(<ChatPrototype />);
    fireEvent.change(screen.getByLabelText('Lampirkan file'), { target: { files: [new File(['hello'], 'notes.txt')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Kirim pesan' }));
    expect(screen.getByRole('link', { name: /notes.txt/ })).toHaveAttribute('download', 'notes.txt');
    fireEvent.click(screen.getByRole('button', { name: 'Hapus pesan notes.txt' }));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
});
it('rejects oversized files and allows cancelling attachments', () => {
    render(<ChatPrototype />);
    const big = new File(['x'], 'big.zip');
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText('Lampirkan file'), { target: { files: [big] } });
    expect(screen.getByRole('alert')).toHaveTextContent('maksimal 10 MB');
    expect(screen.getByRole('button', { name: 'Kirim pesan' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Lampirkan file'), { target: { files: [new File(['x'], 'ok.txt')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Batalkan lampiran' }));
    expect(screen.getByRole('button', { name: 'Kirim pesan' })).toBeDisabled();
});
