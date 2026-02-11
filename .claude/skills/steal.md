---
name: steal
description: Investigate how a feature is implemented in emdash and adapt it to Dash
---

# Steal from Emdash

Investigate how a feature is implemented in emdash and figure out how to adopt it in Dash.

## Context

**Two codebases, shared heritage:**
- `~/repos/emdash` — Full-featured multi-agent orchestration platform (MIT-licensed)
- This repo (Dash) — Simpler OSS tool focused solely on Claude Code orchestration

Both are Electron 30 + React 18 + TypeScript desktop apps using xterm.js/node-pty terminals, SQLite/Drizzle ORM, and git worktree isolation. Dash was heavily inspired by emdash but has a much narrower scope.

## Key Differences

### Scope

| Aspect | emdash | Dash |
|--------|--------|------|
| Agents | 20+ CLI providers (Claude, Codex, Qwen, Amp…) | Claude Code only |
| Conversations | Multi-chat per task, message persistence | Single terminal per task |
| Integrations | GitHub, Linear, Jira, auto-update, telemetry | None (standalone) |
| Code viewer | Monaco Editor with side-by-side diff | Simple unified DiffViewer component |
| Agent Skills | Full Agent Skills standard with symlink sync | None |
| Settings | JSON files + database | localStorage |
| Platforms | macOS, Linux, Windows | macOS arm64 only |

### Architecture

| Aspect | emdash | Dash |
|--------|--------|------|
| Services | 33 service files | ~7 service files |
| IPC handlers | 18 IPC files | 5 IPC files |
| Components | 96 component files | ~10 component files |
| Hooks | 41 custom hooks | Inline in App.tsx |
| State | React Context + custom hooks + localStorage | All state in App.tsx root |
| DB schema | 5 tables (projects, tasks, conversations, messages, lineComments) | 3 tables (projects, tasks, conversations) |
| Native modules | sqlite3, node-pty, keytar | better-sqlite3, node-pty |

### Shared Patterns

These are architecturally identical and can often be adapted directly:
- IPC request-response pattern (`{ success, data?, error? }`)
- Worktree pool pre-creation strategy
- PTY manager with direct CLI spawn path
- Terminal snapshot/restore for session persistence
- PATH fixing at startup for CLI discovery
- Drizzle ORM schema + migration approach
- Preload context bridge with typed `electronAPI`
- Vite + concurrent main/renderer dev setup

## Investigation Process

When investigating a feature in emdash:

1. **Locate the feature** in `~/repos/emdash`
   - Frontend: `src/renderer/components/` or `src/renderer/hooks/`
   - Backend services: `src/main/services/`
   - IPC layer: `src/main/ipc/`
   - Database: `src/main/db/schema.ts`

2. **Understand the implementation**
   - Read the component/service code
   - Identify dependencies (hooks, utilities, IPC calls)
   - Note the data flow and state management
   - Check if it touches the provider registry (if so, simplify to Claude-only)

3. **Map to Dash equivalents**
   - Find corresponding files in this repo
   - Identify what can be adapted directly vs what needs simplification

4. **Simplify, don't copy**
   - Strip multi-agent/multi-provider logic (Dash is Claude Code only)
   - Remove integrations Dash doesn't have (GitHub, Linear, Jira, telemetry)
   - Flatten complex hook hierarchies into App.tsx state if appropriate
   - Keep the core idea, reduce the surface area

## Reference Files

### emdash
- Main entry: `~/repos/emdash/src/main/main.ts`
- Preload (full API surface): `~/repos/emdash/src/main/preload.ts`
- DB schema: `~/repos/emdash/src/main/db/schema.ts`
- Services: `~/repos/emdash/src/main/services/`
- IPC handlers: `~/repos/emdash/src/main/ipc/`
- Components: `~/repos/emdash/src/renderer/components/`
- Hooks: `~/repos/emdash/src/renderer/hooks/`
- Provider registry: `~/repos/emdash/src/shared/providers/registry.ts`

### Dash (this repo)
- Main entry: `src/main/entry.ts` → `src/main/main.ts`
- Preload: `src/main/preload.ts`
- DB schema: `src/main/db/schema.ts`
- Services: `src/main/services/`
- IPC handlers: `src/main/ipc/`
- Components: `src/renderer/components/`
- Shared types: `src/shared/types.ts`
- ElectronAPI types: `src/types/electron-api.d.ts`

## Common Pitfalls

1. **Don't bring in provider abstractions** — emdash's provider registry is complex. Dash only supports Claude Code, so hardcode paths and skip the registry pattern.

2. **Watch for multi-chat assumptions** — emdash supports multiple conversations per task with per-conversation terminals. Dash has one terminal per task.

3. **Don't pull in integrations** — emdash has GitHub, Linear, Jira services. Dash doesn't need these.

4. **Simplify state management** — emdash uses many custom hooks and stores. Dash keeps state in App.tsx. Only extract to hooks/stores if complexity genuinely warrants it.

5. **Schema differences** — emdash has `messages` and `lineComments` tables that Dash doesn't. Don't assume these exist.

6. **Native module differences** — emdash uses `sqlite3` + `keytar`; Dash uses `better-sqlite3` and has no keytar. API surfaces differ.

7. **Subagent path confusion** — When delegating to subagents (Task tool), always pass **absolute paths** (e.g. `/Users/nicolaibthomsen/repos/emdash/src/main/services/GitService.ts`), never relative ones. Subagents inherit the Dash working directory, so a relative path like `src/main/services/GitService.ts` will resolve to the Dash file, not the emdash one.

## Your Task

$ARGUMENTS

---

**Remember:** Dash is intentionally simpler than emdash. The goal is to capture the essence of a feature while keeping Dash's smaller, focused codebase clean. When in doubt, leave it out.
