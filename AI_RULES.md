# AI_RULES

## Retrieval Priority
1. Read `SYSTEM_CONTEXT.md` — project overview, constraints
2. Read `ARCHITECTURE_MAP.md` — module relationships, data flow
3. Read `DECISIONS.md` — before changing architecture
4. Read `TODO_STATE.md` — current state, risks
5. Do NOT scan entire project — use targeted reads

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

## ICM Automation
- Run `tools\icm-maintain.ps1 -Mode quick` after session with changes
- Log critical changes: `icm store --topic <topic> --content "..." --importance critical`
- Run `icm extract-pending` periodically to process queued extractions

## Code Style
- Use `const` for imports and invariants, `let` for mutable state
- All functions in global scope (no modules)
- Russian locale for user-facing strings
- Event handlers: inline onclick attributes (existing pattern)
