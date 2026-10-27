# Dashboard live-data validation

## Branch and scope

Previous project/dashboard work was fast-forwarded and pushed to `main` at
`79f93e6` at the user's request. `feat/dashboard-live-data` was then created from
that updated main. The original implementation was delivered in `feat/project`;
this follow-up does not retroactively claim it was developed on this branch.

The dashboard already uses ProjectMonitoring for authenticated users and keeps
sample data only for the anonymous preview. Existing layout, navigation, APIs,
and production components are unchanged by this follow-up.

## Added coverage

- Frontend: counts all five task statuses across projects; initial loading;
  empty results with zero counts; failed request followed by successful retry.
- Existing frontend coverage: pagination, data refresh, polling cleanup, expired session.
- Backend: manager and staff membership scoping for projects/tasks/members;
  foreign project denial; admin access; guest denial; 30 tasks across paginated
  responses with all five statuses preserved.

## Validation

- `npm test`: 92 tests passed (11 files).
- `npm run build`: passed; optional fontaine warning remains unrelated.
- `WWWUSER=$(id -u) WWWGROUP=$(id -g) docker compose run --rm -e APP_ENV=testing -e DB_DATABASE=testing laravel.test php artisan test`:
  86 tests passed, 705 assertions. Dedicated testing database; not application data.
- Targeted DashboardLiveDataApiTest: 3 tests, 40 assertions passed.
- `git diff --check`: passed.
- jsdom emits scroll/navigation not-implemented warnings in existing navigation tests.

## Pull request scope

Only dashboard integration tests and this validation record belong in the
follow-up PR. No UI redesign or unrelated project changes. GitHub CLI is not
installed; remote branch publication and a compare link do not constitute PR creation.
