import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { TaskAttachmentItem } from '../../resources/js/pages/projects/TaskAttachmentItem.jsx';

const attachment = { id: 1, name: 'cover.png', size: 2048, mime_type: 'image/png', url: '/tasks/11/attachments/1', preview_url: '/tasks/11/attachments/1/preview' };
afterEach(cleanup);

it('opens the file name and thumbnail as previews with a separate explicit download', () => {
    const remove = vi.fn();
    render(<ul><TaskAttachmentItem attachment={attachment} onRemove={remove} /></ul>);
    const name = screen.getByRole('link', { name: 'cover.png' });
    expect(name).toHaveAttribute('href', attachment.preview_url);
    expect(name).toHaveAttribute('target', '_blank');
    expect(name).not.toHaveAttribute('download');
    expect(screen.getByRole('link', { name: 'Preview cover.png' })).toHaveAttribute('href', attachment.preview_url);
    expect(screen.getByAltText('Thumbnail cover.png')).toHaveAttribute('src', attachment.preview_url);
    const download = screen.getByRole('link', { name: 'Download cover.png' });
    expect(download).toHaveAttribute('href', attachment.url);
    expect(download).toHaveAttribute('download', attachment.name);
    fireEvent.click(screen.getByRole('button', { name: 'Hapus lampiran cover.png' }));
    expect(remove).toHaveBeenCalledWith(attachment);
});

it('keeps preview and download accessible if a thumbnail fails', () => {
    render(<ul><TaskAttachmentItem attachment={attachment} /></ul>);
    fireEvent.error(screen.getByAltText('Thumbnail cover.png'));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('link', { name: 'cover.png' })).toHaveAttribute('href', attachment.preview_url);
    expect(screen.getByRole('link', { name: 'Download cover.png' })).toBeInTheDocument();
});

it.each(['application/pdf', 'text/plain', 'application/zip', 'image/svg+xml'])('opens %s using the preview endpoint without an image thumbnail', mime_type => {
    render(<ul><TaskAttachmentItem attachment={{ ...attachment, mime_type }} /></ul>);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('link', { name: attachment.name })).toHaveAttribute('href', attachment.preview_url);
});

it('does not silently download when an older API response lacks a preview URL', () => {
    render(<ul><TaskAttachmentItem attachment={{ ...attachment, preview_url: null }} /></ul>);
    expect(screen.queryByRole('link', { name: attachment.name })).toBeNull();
    expect(screen.getByRole('link', { name: 'Download cover.png' })).toHaveAttribute('href', attachment.url);
});
