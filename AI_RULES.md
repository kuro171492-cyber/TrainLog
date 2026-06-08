# AI_RULES

## Retrieval Priority
1. Read `SYSTEM_CONTEXT.md` — project overview, constraints
2. Read `ARCHITECTURE_MAP.md` — module relationships, data flow
3. Read `DECISIONS.md` — before changing architecture
4. Read `TODO_STATE.md` — current state, risks
5. Do NOT scan entire project — use targeted reads

## Professional Developer Role
- AI must act as a professional application developer for vanilla JS, web, and related technologies.
- Produce idiomatic, maintainable, and well-documented code that follows the project's conventions.
- Include appropriate tests and small reproducible examples for changes.
- Prioritize security, performance, accessibility, and developer experience; surface trade-offs when proposing solutions.
- Ask clarifying questions for ambiguous requirements, propose alternatives, and provide implementation estimates when relevant.
- Do NOT introduce new frameworks, large dependencies, or breaking changes without an explicit request and decision log entry.

## Architecture Preservation
- Do NOT introduce frameworks — project is vanilla JS
- Do NOT split files — keep globals_and_storage.js, ui_components.js, app_logic.js
- Preserve the three-file pattern and load order
- Do NOT change persistence pipeline without decision log entry

## State Management
- Single source of truth: LocalStorage + trainlog_data.json + GitHub
- State flows: globals_and_storage → ui_components → app_logic → back to storage
- No hidden derived state; use explicit getters (getAnalyticsRows, etc.)

## After Changes
- Update TODO_STATE.md if task status changed
- Update DECISIONS.md if architectural decision was made
- Update SYSTEM_CONTEXT.md if constraints or assumptions changed
- Leave clear breadcrumb comments at changed locations

## Session Lifecycle (Agent Must Follow)
AI cannot independently determine session end. Sessions operate by explicit signals:

### Session Start
- New conversation initiated or task explicitly assigned
- AI reads SYSTEM_CONTEXT.md, TODO_STATE.md, DECISIONS.md for context
- AI remembers: this is a working session

### Session Active
- AI performs work: code changes, analysis, decisions
- AI updates documentation incrementally (TODO_STATE, DECISIONS, SYSTEM_CONTEXT)
- AI may ask clarifying questions but does NOT assume session end

### Session End (Explicit Signal Required)
- **User says**: "Session complete", "Done", "Finish up", or "Let's wrap up"
- **Host signal**: explicit `SESSION_END` command or conversation termination
- **If unsure**: AI must ask: "Task complete? Should I wrap up the session?"
- **AI cannot assume** session end based on:
  - Long silence (user might be reading)
  - User switching tasks (might be pausing, not ending)
  - AI completing one task (more tasks might follow)

## Session Confirmation (Agent Must Follow)
Before executing post-session cleanup, AI must confirm all work is complete:

1. **Ask explicitly**: "Ready for session wrap-up? Any remaining tasks?"
2. **If yes**: proceed to post-session checklist
3. **If no**: continue working
4. **If unsure**: ask user to confirm

## ICM Automation (Agent Must Follow)
ICM hooks are installed globally (wake-up, recall, extract, transcript auto-run). Keep memory useful, verified, and low-noise.

### After Every Session
- Run `tools\icm-maintain.ps1 -Mode quick` after a session with meaningful changes.
- Run `tools\icm-maintain.ps1 -Mode full` after architectural changes or a large refactor.
- Update memory files (`SYSTEM_CONTEXT.md`, `TODO_STATE.md`, `DECISIONS.md`) when project state changes.
- Store critical changes manually in ICM with topic, source, date, ttl, and importance metadata.

### ICM Metadata Policy
Every `icm store` call **must** encode metadata:
- `topic` (required): main category (e.g., `architecture`, `bug-fix`, `refactor`, `decision`)
- `source` (required): where memory originated — `session` (human+AI session), `design`, `experiment`, `external`
- `date` (required): ISO 8601 format, e.g. `2026-06-03`
- `ttl` (required): time-to-live in days — `365` (ordinary), `90` (temporary), `infinite` (critical)
- `importance` (required): `low`, `normal`, `critical` (policy) — map to `low`, `medium`, `high`, `critical` (CLI)
- `session_id` (optional but recommended): unique session identifier if available (for tracing back to conversation)
- `task` (optional): task or ticket ID if applicable

Example:
```
icm store --topic refactor \
  --content "Refactored auth module for performance" \
  --importance medium \
  --keywords "refactor,auth,source=session,date=2026-06-03,ttl=365,importance=normal,session_id=abc123,task=AUTH-42"
```

### Classification When Storing
- Policy importance values are `low`, `normal`, `critical`. Current `icm.exe` accepts `low`, `medium`, `high`, `critical`; use `medium` as the CLI equivalent of policy `normal`.
- Current `icm.exe store` has `--keywords` instead of `--tags`, `--date`, and `--ttl`; encode metadata as keywords until native fields exist.
- Do NOT store secrets, credentials, or tokens in ICM — delete immediately.
- Do NOT store incomplete thoughts — store only verified, consolidated memories.

### TTL And Archiving
- Default TTL: 365 days for ordinary memories, 90 days for temporary/spontaneous notes, infinite for `critical`.
- When TTL expires, mark the memory as archived or replace it with a refreshed, verified entry.
- If a `normal` memory has no access for more than `ttl/2`, downgrade it to `low` and notify the topic owner.

### Validation And Health Checks
- Weekly: run `tools\icm-maintain.ps1 -Mode validate`.
- During validation, review memories with TTL expiring within 30 days, set `review=true` in metadata or replacement content, and notify the topic owner.
- Review low-importance memories with no access/use for 180 days and propose archive/delete.
- Review all `critical` memories every 90 days and confirm or update their content.

### Garbage Cleanup
- Quick maintain: after a work session.
- `icm extract-pending`: every 1-7 days; daily is recommended for active projects.
- Weekly: `icm extract-pending` plus `tools\icm-maintain.ps1 -Mode quick`.
- Monthly: `tools\icm-maintain.ps1 -Mode prune`.
- Garbage criteria: duplicates, empty/short content under 50 chars without tags, obsolete claims, entries marked `user=deleted`, and any temporary tokens/passwords. Secrets must be deleted immediately, not archived.

### Audit And Snapshots
- Log every prune/archive/delete operation to `icm-audit` with `--importance critical`; keep audit logs for at least 90 days.
- Before monthly prune, create a snapshot/export. If `icm export` is unavailable, save `icm list --all --sort created` output under `snapshots/`.
- Recommended schedule: daily quick at 00:30, weekly validate on Sunday 03:00, monthly prune on the 1st at 04:00, quarterly critical review.

### Post-Session Checklist (Agent Must Complete Before Ending)
After session end is confirmed, execute this checklist **before** terminating session:

1. **Document State**
   - ✓ SYSTEM_CONTEXT.md is up-to-date with project changes
   - ✓ TODO_STATE.md reflects current work status and risks
   - ✓ DECISIONS.md logs any architectural decisions made
   - ✓ All code changes have breadcrumb comments at modified locations

2. **Store Memories in ICM**
   - ✓ All significant changes stored with proper metadata (topic, source, date, ttl, importance)
   - ✓ Critical architectural decisions marked as `critical` importance
   - ✓ Session-specific learnings logged with `source=session`
   - ✓ Use session_id and task fields if available for traceability

3. **Run ICM Maintenance**
   - ✓ If normal changes made: `tools\icm-maintain.ps1 -Mode quick`
   - ✓ If architectural refactor: `tools\icm-maintain.ps1 -Mode full`
   - ✓ If no changes: optional (but validate health weekly)

4. **Verify No Blockers**
   - ✓ No incomplete tasks left in TODO_STATE.md marked urgent
   - ✓ No critical decisions in DECISIONS.md awaiting action
   - ✓ All changed files committed to git (if applicable)

5. **Notify Completion**
   - ✓ Confirm completion: "Session wrapped up. ICM maintained. Ready to close."
   - ✓ Provide brief summary of what was done
## Code Style
- Use `const` for imports and invariants, `let` for mutable state
- All functions in global scope (no modules)
- Russian locale for user-facing strings
- Event handlers: inline onclick attributes (existing pattern)

## Available Skills (локальные, `.agents/skills/`)

- **frontend-design** — создание production-grade UI с высоким дизайном, избегая AI-шаблонности
- **web-design-guidelines** — аудит UI/UX и accessibility по гайдлайнам Vercel
- **vercel-react-best-practices** — 70+ правил оптимизации React/Next.js (водопады, бандл, сервер, рендер, JS)

## Available Skills (глобальные, `~\.agents\skills\`)

- **find-skills** — поиск подходящих skills по описанию задачи

Установка локального скилла: `npx skills add <repo> --skill <name>`
Установка глобального скилла: `npx skills add <repo> --skill <name> --global`

