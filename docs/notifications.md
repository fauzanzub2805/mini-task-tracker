# In-app notifications

Persistent recipient-owned notifications. No email/browser push or WebSocket is implied. Header polls every 15 seconds while visible and refreshes on focus/project changes. Calendar date is computed server-side using NOTIFICATION_TIMEZONE (default Asia/Jakarta), not seeded dates.

Events: incoming direct message, project membership added, newly assigned task, task status/deadline changes to current assignees and creator, comment mentions. Actor is excluded. Due today/overdue reminders are generated on notification fetch for unfinished assigned tasks the user can still access, once per task/due date/kind. Stale reminders are removed on fetch when date, assignment, completion or access changes. Other project/task events are hidden after access removal. Reading a conversation marks corresponding message alerts read.

API (session auth + CSRF for mutations):
- GET /notifications?before_id=N: newest 20, `{data:[{id,recipientId,type,title,body,url,readAt,createdAt}],unread_count,next_before_id,through_id,timezone,today}`. through_id is newest visible id for snapshot-safe bulk read.
- POST /notifications/{id}/read: recipient-only, idempotent.
- POST /notifications/read-all `{through_id}`: reads only owned records up to snapshot id; new notifications stay unread.

Message/member/task/comment event notifications start with new actions after deployment; historical events are not backfilled. Existing currently due/overdue tasks are included on the first fetch.

Deployment: run `php artisan migrate`, `npm ci && npm run build`, then `php artisan optimize:clear`. Configure `NOTIFICATION_TIMEZONE=Asia/Jakarta` (or the desired IANA timezone) in the server environment.

Deadline generation is lazy (on fetch), so localhost requires no scheduler/queue. Alerts become visible within the next poll while the application is open, including date rollover. A user returning later sees current reminders, not a backlog of daily duplicates. In-app project invitation means membership addition in the existing product; email registration invitation remains a separate flow.
