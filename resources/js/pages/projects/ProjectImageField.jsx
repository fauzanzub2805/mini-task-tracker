import { useEffect, useRef, useState } from 'react';
import { MAX_PROJECT_IMAGE_BYTES, PROJECT_IMAGE_TYPES } from './projectsApi.js';

export function ProjectImageField({ image, onChange, disabled = false }) {
    const inputRef = useRef(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [error, setError] = useState('');
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        if (!image) { setPreviewUrl(null); return undefined; }
        const url = URL.createObjectURL(image);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [image]);

    function selectImage(files) {
        if (disabled || !files?.length) return;
        if (files.length !== 1) { setError('Pilih satu gambar saja.'); return; }
        const file = files[0];
        if (!PROJECT_IMAGE_TYPES.includes(file.type) || file.size > MAX_PROJECT_IMAGE_BYTES) {
            setError('Pilih gambar JPEG, JPG, atau PNG maksimal 5 MB.');
            return;
        }
        setError('');
        onChange(file);
    }

    return <div className="projects-field projects-image-card">
        <label className="projects-field-label" htmlFor="projects-new-image">Image</label>
        <div className="projects-field-body projects-image-editor">
            <input ref={inputRef} id="projects-new-image" className="projects-image-input" type="file"
                accept="image/jpeg,image/png,.jpg,.jpeg,.png" disabled={disabled}
                aria-describedby={`projects-new-image-help${error ? ' projects-new-image-error' : ''}`} aria-invalid={Boolean(error)}
                onChange={event => { selectImage(event.target.files); event.target.value = ''; }} />
            <button type="button" className={`projects-image-dropzone${dragging ? ' is-dragging' : ''}`} disabled={disabled}
                aria-label={image ? 'Replace Image' : 'Choose Image'} aria-describedby="projects-new-image-help"
                onClick={() => inputRef.current?.click()}
                onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={event => { event.preventDefault(); setDragging(false); selectImage(event.dataTransfer.files); }}>
                {previewUrl ? <img className="projects-image-preview" src={previewUrl} alt="Project image preview" /> :
                    <svg className="projects-image-icon" viewBox="0 0 80 80" fill="none" stroke="#101828" strokeWidth="2" aria-hidden="true">
                        <path d="M40 5C9 5 5 9 5 40s4 35 35 35 35-4 35-35S71 5 40 5Z" />
                        <circle cx="26" cy="24" r="8" />
                        <path d="M5 43c11-1 20 4 25 13M28 75c-2-24 17-48 47-43" />
                    </svg>}
                <span className="projects-image-prompt">{image ? 'Drop or click to replace image' : 'Drop your image here'}</span>
                <span id="projects-new-image-help" className="projects-image-help">Max 5 MB, only JPEG, JPG, PNG accepted</span>
            </button>
            {image && <button type="button" className="projects-secondary" disabled={disabled} onClick={() => { onChange(null); setError(''); }}>Remove Image</button>}
            {error && <p id="projects-new-image-error" className="projects-error" role="alert">{error}</p>}
        </div>
    </div>;
}
