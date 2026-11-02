# Task attachment preview

- Existing `GET /tasks/{task}/attachments/{attachment}` remains a forced download (`url` in the resource).
- New `GET /tasks/{task}/attachments/{attachment}/preview` opens an authorized preview (`preview_url` in the resource).
- Both endpoints require task view permission and attachment/task ownership; missing files return 404.
- Preview detects MIME from stored contents, not the uploaded MIME claim. Only JPEG, PNG, GIF, WebP, PDF, and plain text are served inline. Other formats render a safe explanation with an explicit download link. HTML and SVG are never served inline.
- Inline responses use private/no-store caching, nosniff, and a sandbox CSP.
- Task Info file names and image thumbnails open preview in a new tab. Download is a separate link; removal remains unchanged. Failed thumbnails fall back to the file name.
- Upload limits (10 MiB per file) and comment attachments are unchanged.
