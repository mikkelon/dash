# pi.dev Feature Analysis for Dash

A comparison of pi.dev's coding agent features against Dash's current capabilities, filtered for relevance. Each feature includes a description, how it applies to Dash, and a high-level implementation approach.

> **Removed features:** The following have been struck from the original analysis:
> - **Custom System Prompts** — Fully superseded by Claude Code's native `CLAUDE.md` support. Worktrees already inherit these files. Adding a parallel system prompt mechanism in Dash would conflict with user-managed `CLAUDE.md` files.
> - **Extension / Plugin System** — Claude Code now has a native hooks system. Building a second extension layer in Dash would add redundant complexity. Dash's internal `HookServer` already handles activity monitoring; further extensibility should leverage Claude Code's own hook infrastructure.
> - **Multi-Provider API Key Management** — Dash is purpose-built for Claude Code. Supporting 15+ providers is out of scope.

---

## 1. Project Instructions (AGENTS.md / Hierarchical Config)

**What pi.dev offers:** Project instructions load from a hierarchy — `~/.pi/agent/`, parent directories, and the current directory. This creates layered instruction sets: global defaults, org-level standards, and project-specific rules, all merged automatically.

**Claude Code native support:** Claude Code already reads `CLAUDE.md` from `~/.claude/CLAUDE.md` (global), the project root, and subdirectories — providing the same hierarchical merge. However, users must manage these files manually outside of Dash.

**Dash today:** No instruction management. Dash is aware of the project directory and git remote but does not surface or manage any `CLAUDE.md` files. Each task's worktree inherits the project's `CLAUDE.md` via git, but Dash provides no UI for viewing, editing, or managing instructions across tasks.

**What Dash would add:**
- Detect and display existing `CLAUDE.md` files in the project tree (show an indicator in the sidebar if one exists).
- Provide a UI to view and edit the project's `CLAUDE.md` directly within Dash (a simple editor panel or modal).
- Manage Dash-level global instructions (applied to all projects/tasks) separately from Claude Code's `~/.claude/CLAUDE.md`.
- Support per-task instruction overrides — write task-specific `CLAUDE.md` content into the worktree before spawning Claude Code.
- Show a "Context" tab that previews the merged instruction stack (global + project + task) so users understand what Claude Code will see.

---

## 2. Model Selection and Switching

**What pi.dev offers:** Mid-session model switching via `/model` command, `Ctrl+P` to cycle favorites, and custom model configuration.

**Claude Code native support:** Claude Code supports `--model` flag at launch and `/model` command mid-session. However, Dash currently passes neither — the model is whatever Claude Code defaults to.

**Dash today:** No model selection UI. `ptyManager.ts` spawns Claude Code with `-c -r` and optionally `--dangerously-skip-permissions`, but never passes a `--model` flag or `ANTHROPIC_MODEL` env var.

**What Dash would add:**
- Add a model selector dropdown in task creation and/or the task header bar for Anthropic models (Sonnet, Opus, Haiku).
- Pass the selected model via `--model` flag when spawning the PTY in `ptyManager.startDirectPty()`.
- Store the preferred model per-project (with per-task override capability) in the database.
- Show the active model name in the task's status area so users always know which model is running.

---

## 3. Session Branching and Tree-Structured History

**What pi.dev offers:** Sessions are stored as trees. Users can navigate to any previous conversation point via `/tree` and continue from there, creating branches. All branches live in a single file. This enables non-linear exploration — trying different approaches and comparing results.

**Dash today:** The database schema has a `conversations` table with `isMain` and `displayOrder` fields suggesting multi-conversation support was planned, but no UI exists for branching or navigating conversation history. Terminal state is persisted via snapshots but only for recovery, not exploration.

**How it could work in Dash:**
- Leverage the existing `conversations` table to store branch points (add a `parentConversationId` and `branchPointMessage` field).
- Add a "Conversation History" panel or tree visualization accessible from the task view.
- When a user wants to branch, snapshot the current session state and create a new conversation record linked to the branch point.
- Use Claude Code's `--resume` capability combined with conversation ID tracking to restore any branch.
- Show a compact tree view in the sidebar under each task, allowing one-click navigation between branches.

---

## 4. Session Export and Sharing

**What pi.dev offers:** Export sessions to HTML via `/export` or upload as a GitHub Gist via `/share` for sharing with teammates. The rendered output preserves the conversation structure.

**Dash today:** No export or sharing capability. Conversation content lives in Claude Code's own session store — Dash's database only tracks metadata (title, active status, ordering).

**How it could work in Dash:**
- Add an "Export" button to the task header or context menu.
- Capture terminal output history (already partially available through terminal snapshots and xterm serialization) and render it as clean HTML or Markdown.
- Support "Copy as Markdown" for quick sharing in PRs, Slack, or docs.
- Optionally integrate with GitHub Gist API (Dash already passes `GH_TOKEN`) for one-click sharing.
- Store a link to the shared gist in the conversation record for later reference.

---

## 5. Context Usage Monitoring

**What pi.dev offers:** Automatic message compaction when approaching context limits, with customizable summarization strategies and visual indicators.

**Claude Code native support:** Claude Code handles context compaction internally and provides the `/compact` command for manual summarization. The actual compaction is fully handled by Claude Code.

**Dash today:** No visibility into context usage. Dash delegates the entire conversation lifecycle to Claude Code via PTY — it has no insight into how much context has been consumed in a session.

**What Dash would add:**
- Display a context usage indicator on task cards and in the task header (approximate token count or percentage) by monitoring Claude Code's terminal output for context-related signals (e.g., compaction messages, token counts).
- Show a visual warning when context is running high, giving users a cue to start a new conversation or manually trigger `/compact`.
- Surface compaction events in the task's activity timeline so users can see when auto-compaction occurred.

---

## 6. Prompt Templates and Commands

**What pi.dev offers:** Reusable prompts stored as Markdown files, expanded by typing `/name`. This streamlines repetitive workflows like code reviews, refactoring patterns, or test generation.

**Claude Code native support:** Claude Code supports custom slash commands via `.claude/commands/` directories (project-level and user-level). Users can create Markdown files that expand as `/command-name`. However, managing these files requires manual filesystem operations.

**Dash today:** No template system. Users type everything from scratch or rely on terminal history. No UI for discovering or managing `.claude/commands/` files.

**What Dash would add:**
- A **prompt store UI** with a three-tier hierarchy: global (all projects), project-level, and task-level templates.
- Add a `prompt_templates` table (id, name, content, scope, projectId/taskId) in the database.
- Create a "Prompts" section accessible from the sidebar or settings where users can create, edit, and organize templates visually.
- Sync templates to `.claude/commands/` directories in worktrees so they're available as native Claude Code slash commands.
- Add a template picker (dropdown or command palette) near the terminal input for quick insertion.
- Ship built-in starter templates (e.g., "Code Review", "Refactor", "Add Tests") that users can customize.
- Support template variables (e.g., `{{file}}`, `{{branch}}`, `{{task}}`) that auto-populate from the current task context.

---

## 7. Message Queuing and Steering

**What pi.dev offers:** Two submission modes while the agent works: `Enter` sends a steering message that interrupts after the current tool completes; `Alt+Enter` queues a follow-up that waits for the agent to finish. This enables real-time course correction vs. batched instructions.

**Dash today:** Direct PTY communication — any input goes straight to the terminal. There's no distinction between steering and queuing. Users can type while Claude Code is working, but there's no managed queue or interrupt semantics beyond what the terminal provides natively.

**How it could work in Dash:**
- Implement a **message queue overlay** that appears when Claude Code is busy (detected via the existing activity monitoring system).
- Show two input modes: "Send Now (interrupt)" and "Queue for Later."
- Queued messages are stored in memory and automatically sent when the activity monitor detects the session transitions to idle.
- Visual indicator showing queued message count.
- This builds on the existing `HookServer.ts` activity detection (Stop hook = idle, UserPromptSubmit hook = busy).

---

## 8. Package / Marketplace System

**What pi.dev offers:** Installable bundles combining extensions, skills, prompts, and themes. Distributed via npm or git with version pinning, `pi install`, `pi update`, and `pi list` commands.

**Dash today:** No package system. All functionality is built-in.

**How it could work in Dash:**
- Without a dedicated extension system (removed — Claude Code has native hooks), this shifts toward a **content marketplace** for prompt templates, project configurations, and themes.
- A lighter-weight alternative: a **community template gallery** — curated prompt templates and project configurations that users can browse and import.
- Store importable configurations as JSON/Markdown files in a public GitHub repo.
- Add an "Import from Gallery" option in the Templates or Settings UI.
- This provides community value without the complexity of a full package manager.

---

## 9. Customizable Themes Beyond Light/Dark

**What pi.dev offers:** Themes are distributable as part of packages, suggesting support for custom color schemes, fonts, and terminal styling beyond a simple light/dark toggle.

**Dash today:** Two themes (light and dark) with hardcoded color values. Terminal theme syncs with the app theme. Tailwind CSS classes used throughout.

**How it could work in Dash:**
- Define theme as a set of CSS custom properties (already partially in place via Tailwind's dark mode classes).
- Add 2-3 additional built-in themes (e.g., Solarized, Monokai, Nord).
- Allow custom terminal color schemes independent of the app theme.
- Store theme selection in settings, apply via CSS custom property overrides on the document root.

---

## 10. Bookmarks and Message Labeling

**What pi.dev offers:** Users can bookmark and label important moments in a conversation for easy reference later. Combined with the tree-structured history, this makes long sessions navigable.

**Dash today:** No bookmarking. Terminal output scrolls linearly with no way to mark or return to important points.

**How it could work in Dash:**
- Add a "Bookmark" action (keyboard shortcut or button) that captures the current terminal scroll position and a user-provided label.
- Store bookmarks in the database linked to the task/conversation.
- Show a bookmark list in the task view sidebar that jumps to the saved scroll position.
- Optionally capture a text snippet from the terminal at the bookmark point for preview.

---

## Priority Ranking for Dash

Based on impact, user demand, and implementation feasibility:

| Priority | Feature | Rationale |
|----------|---------|-----------|
| **P0** | Model Selection | High demand, low effort. Pass `--model` flag in `ptyManager.startDirectPty()`. |
| **P0** | Project Instructions UI | High impact, medium effort. Surface and manage `CLAUDE.md` hierarchy across tasks. |
| **P1** | Prompt Templates & Commands | Medium effort, high daily utility. Manage `.claude/commands/` via UI with global/project/task hierarchy. |
| **P1** | Message Queuing/Steering | Medium effort. Builds on existing `HookServer` activity monitoring. |
| **P1** | Session Export | Medium effort. Leverage existing terminal snapshots and xterm serialization. |
| **P2** | Session Branching | Higher effort. Extend existing `conversations` table with branch tracking. |
| **P2** | Context Usage Display | Low effort. Monitor PTY output for context signals, display on task cards. |
| **P2** | Bookmarks | Low effort, useful for long sessions. |
| **P3** | Additional Themes | Low effort, nice-to-have. Extend existing Tailwind dark/light system. |
| **P4** | Package Marketplace | Content marketplace for templates and themes. No extension system dependency. |
