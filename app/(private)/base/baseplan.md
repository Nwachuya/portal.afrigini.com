# Base Admin Plan

## Purpose
`/base` is the super-user admin area for platform-wide control and observability.
It is not for normal org workflows.

## Principles
- Super-user only access.
- Every mutation is auditable.
- Safe defaults for high-impact actions.
- Build in vertical slices so each phase is deployable.

## Route Map

### Phase 1 (MVP)
- `/base/dashboard`
- `/base/users`
- `/base/orgs`
- `/base/audit-log`

### Phase 2
- `/base/jobs`
- `/base/applications`
- `/base/billing`
- `/base/system`

### Phase 3
- `/base/access`
- `/base/impersonation`
- `/base/moderation`
- `/base/integrations`
- `/base/settings`

## Must-Have Guardrails (before feature work)
1. Route guard for `/base/*` that only allows super user admin.
2. Standard admin action logger (who, what, target, before/after, timestamp, reason).
3. Confirmation + reason prompt for destructive actions.
4. Read-only by default for all pages unless explicit mutation action is triggered.

## Data + Logging Contract
For every admin mutation, record:
- `actor_user_id`
- `actor_email`
- `action_type`
- `target_type`
- `target_id`
- `reason`
- `diff_summary` (small JSON summary)
- `created_at`

## Build Order (Step by Step)

### Step 0: Foundation
- Create `/base/layout.tsx` and shared admin shell.
- Add base sidebar/navigation.
- Add super-user route protection.
- Add audit log utility + collection write helper.

Acceptance:
- Non-admin user cannot access `/base/*`.
- Admin shell renders and logs can be written from one test action.

### Step 1: Dashboard
- Build global KPI cards (users, orgs, jobs, applications).
- Add “Needs Attention” panels (failed billing, flagged content, system alerts placeholder).
- Add quick links to MVP pages.

Acceptance:
- Dashboard loads with real totals and fallback empty states.

### Step 2: Users
- Table + search + filters.
- View user details drawer/page.
- Actions: change role, suspend/reactivate, verify/unverify.
- Log all actions to audit log.

Acceptance:
- User mutation works and produces audit entry with reason.

### Step 3: Organizations
- Table + search + filters.
- Org detail page with owners/members, plan, credits.
- Actions: change status, adjust credits, transfer owner (if model supports it).
- Log all actions to audit log.

Acceptance:
- Org mutation works and produces audit entry with reason.

### Step 4: Audit Log
- Read-only table with filtering by actor/action/target/date.
- Detail view with diff summary and reason.
- Export CSV (optional).

Acceptance:
- Can trace all mutations from Steps 2-3.

### Step 5: Jobs + Applications
- Global oversight pages for moderation and triage.
- Force archive/unarchive jobs.
- Stage correction tools for problematic applications.

Acceptance:
- Admin can resolve a bad record without using direct DB edits.

### Step 6: Billing + System
- Billing exception triage page.
- System page for queue/webhook/cron health indicators.

Acceptance:
- Admin can diagnose operational issues from UI.

### Step 7: Advanced Controls
- Access matrix editor.
- Secure impersonation with reason + timeout + banner.
- Feature flags/platform settings.

Acceptance:
- Privileged tools are gated and audited.

## UI/UX Rules
- Dense, scannable tables for admin pages.
- Destructive actions in danger style only.
- Always show affected object clearly before confirm.
- Keep admin pages consistent and simple; avoid decorative UI.

## Technical Constraints
- No client-only trust for permissions; enforce on server/API.
- Keep read endpoints paginated and filterable.
- Keep mutation endpoints idempotent when possible.
- Never allow audit log deletion from UI.

## Open Questions
- What exact field marks “super user admin” in `users`?
- Which actions require step-up auth?
- Which billing actions are manual vs read-only?
- Do we need soft-delete recovery tools in base?

## Immediate Next Task
Implement Step 0 only:
- `app/(private)/base/layout.tsx`
- `app/(private)/base/dashboard/page.tsx` (placeholder)
- access guard
- admin navigation shell
