import { useState } from 'react';
import { formatFileSize } from './projectsApi.js';

export function TaskAttachmentItem({ attachment, onRemove }) {
    const [failedPreview, setFailedPreview] = useState(null);
    const previewUrl = attachment.preview_url;
    const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(attachment.mime_type);

    return <li>
        {previewUrl && isImage && failedPreview !== previewUrl && <a className="projects-task-attachment-thumb"
            href={previewUrl} target="_blank" rel="noopener noreferrer" aria-label={`Preview ${attachment.name}`}>
            <img src={previewUrl} alt={`Thumbnail ${attachment.name}`} loading="lazy" onError={() => setFailedPreview(previewUrl)} />
        </a>}
        <div className="projects-task-attachment-details">
            {previewUrl
                ? <a href={previewUrl} target="_blank" rel="noopener noreferrer" title="Open preview">{attachment.name}</a>
                : <span>{attachment.name}</span>}
            <small>{formatFileSize(attachment.size)}</small>
        </div>
        <a className="projects-task-attachment-download" href={attachment.url} download={attachment.name} aria-label={`Download ${attachment.name}`}>Download</a>
        <button type="button" aria-label={`Hapus lampiran ${attachment.name}`} onClick={() => onRemove(attachment)}>×</button>
    </li>;
}
