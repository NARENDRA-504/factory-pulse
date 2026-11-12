# Machine changes and Super Admin

## Operator workflow
Open Request Machine Change. Choose a different active machine within the current Supervisor team and enter a reason (8–1,000 characters). A pending request does not change the current assignment. Only one request may be pending. The requesting Operator can cancel it with a note.

## Supervisor workflow
Open Machine Change Approvals. Only requests naming this Supervisor, matching their department and authorized machines are visible. Enter a decision note (5–1,000 characters) and approve or reject. Approval checks that the Operator assignment/team has not changed and the target machine remains available. Another active Operator on the target machine in the same shift blocks approval; resolve coverage through existing account management first. No silent swaps are performed.

## Super Admin
Super Admin now passes all role permission gates, can review machine-change requests across teams, and manages ordinary users and Admins. Record validation, required context and ownership safeguards remain enforced. Ordinary Admins may view requests but cannot approve them or create/change/reset/deactivate Super Admin accounts. Super Admin demotion/deactivation is protected pending an explicit ownership-transfer workflow. No password disclosure or public role switcher is added.

## Database activation
Run scripts/migrations/20261112_machine_change_and_super_admin.sql using the existing schema-owner Workbench connection. The runtime database account intentionally has no ALTER privileges. The script extends users.role, creates machine_change_requests, and upgrades only active FACTORYPULSE-ADMIN-3 from Admin to Super Admin, adding an audit event. Password hashes, telemetry and other account fields are not modified. After success refresh/sign in again with the existing password. Do not run older migrations.

Requests, decisions, assignment changes and audit entries commit together in MySQL. A failed audit rolls back the assignment. Timestamps are stored UTC and displayed in browser local time. Existing account refresh picks up an approved assignment within approximately 10 seconds. Simulator machine identities and delivery are untouched.

## Verification, 2026-11-12
20 targeted tests passed: request lifecycle, permissions, same-shift occupancy, stale assignments, audit rollback, SOP compatibility. Approval transaction tests use an isolated SQLite SQL adapter (FOR UPDATE is removed for the test); production MySQL locking/concurrency remains to be verified after migration. TypeScript check and production build passed, with existing Vite config/bundle warnings. Isolated browser preview checked Operator/Supervisor/Admin/Super Admin views, approval controls, Admin read-only view and mobile bounds using mocked API data. Live read-only MySQL verification found FACTORYPULSE-ADMIN-3 active as Admin, no request table and no ALTER privilege. The user then applied the migration: live MySQL confirmed the account is active as Super Admin, the request table exists, one bootstrap audit event exists, and the SQL-backed Super Admin request list reads successfully (0 requests). No real employee request/decision has been submitted for this verification. Backend /health and frontend returned HTTP 200; anonymous request access returned 401.


## Super Admin employee dropdown (2026-11-12)
The top bar contains Jump to user for the real Super Admin session owner only. It lists employee names, IDs and roles; inactive accounts are disabled. Selecting an employee opens their actual role workspace without disclosing or changing any password and without issuing an employee login token. An amber banner identifies the real owner and viewed employee, with Return to Super Admin always available. Signing out ends the original owner session.

Selection is server-controlled and bound to the original authenticated session. Each request revalidates that session, owner role and target account. Normal employees and Admins cannot access the list or switch endpoint. Viewed employees retain their own role and machine restrictions. All writes using the standard audit writer record the real Super Admin as actor and the viewed employee in details; switching and returning have their own committed audit events. This is delegated access, not an employee sign-in or attendance event. Views are process-local and end on a backend restart. No migration is required.

Eight new isolated tests cover access denial, switch/return, machine scope, inactive/missing accounts, owner demotion, audit failure, safe directory fields and real-owner audit attribution. Combined targeted suite:28 PASS. A real browser login has not been automated with employee passwords.

Browser verification passed with mocked users: root dropdown, viewed-employee banner, return request, inactive options disabled, ordinary employees hidden and mobile bounds. Backend restarted and /health returned200; anonymous directory access401.
