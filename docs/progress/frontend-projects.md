# Projects page — feat/project

## Scope and reference

Implements the numbered Projects Page Figma references: project cards/search/sort → project information/task list → task detail → assignee picker → comments sections. Existing database demo projects remain the source of truth, so titles, member names, task counts, and descriptions intentionally follow the seeded data rather than the sample Google project in the images.

This feature extends the original PRD at the user's explicit request:

- Five statuses: `todo` (Open Task), `in_progress` (In Progress), `finish_dev` (Finish Dev), `testing` (Testing), `done` (Finished).
- Priority `urgent`, alongside low/medium/high. Colors: green/purple/orange/red respectively.
- Multiple assignees selected from project members. Assignment changes require project-member-management authority; a global Manager who is only Staff in this project cannot assign. The PRD Admin override remains applicable.
- Private task attachments, multiple files, maximum **10 MiB per file**.
- Plain-text comments with member mentions. Mentions do not imply email/push notifications.
- Automatic refresh by **10-second polling**, plus focus/visibility refresh, rather than WebSocket push.

## Frontend URLs

- `/projects`: available projects; `?view=tasks` and `?view=teams` select related views.
- `/projects/{project}`: project detail.
- `/projects/{project}/tasks/{task}`: task detail and comments.
- `/dashboard#progress-table`: database-backed monitoring table and status counts.

HTML navigation and JSON API share project URLs. API clients must send `Accept: application/json`. Existing cookie authentication and CSRF protection are retained.

The unauthenticated `/dashboard/preview` remains a clearly marked, static preview. Authenticated dashboard monitoring never silently falls back to fake rows on API failure.

## Local development

The existing Laravel Sail service serves `http://localhost`. PHP commands run through `docker compose exec -T laravel.test php artisan …`; frontend dependencies/build run on the host with `npm` (native optional bindings differ between macOS and the Linux container).

Apply new migrations without resetting the database, then build frontend assets:

```sh
docker compose exec -T laravel.test php artisan migrate --force
npm run build
```

Use existing demo login `budi.manager@example.com` / `password` to manage Website Redesign Perusahaan. Budi is only Staff in Aplikasi Mobile MVP; `citra.manager@example.com` / `password` is its manager. This demonstrates per-project authorization.

Do not run `migrate:fresh` against the development database.

## Verification completed

- `npm test`: 77 passing tests (10 files).
- `docker compose exec -T laravel.test php artisan test`: 76 passing tests, 598 assertions.
- `npm run build`: successful; optional fontaine warning only.
- Five additive migrations applied to the existing PostgreSQL development database.
- Headless Chrome authenticated as Budi: Projects cards, task detail/calendar and dashboard rendered at localhost without horizontal overflow at 1440px. Dashboard displayed all eight existing tasks across both projects, with counts 4 Open Task / 2 In Progress / 2 Finished.
- Existing dummy projects have no cover images; the Figma-style Insert Image placeholder is displayed, not an unrelated Google cover. Layout follows the reference structure; pixel-for-pixel equivalence is not claimed.
- Member creation accepts existing `role_id`, or `role: "staff"` to add the first staff member without hardcoded database role IDs.
- Comment deletion remains excluded per the original PRD; no nonfunctional Delete control is displayed.
