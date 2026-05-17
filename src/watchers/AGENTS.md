# WATCHERS MODULE

**Updated:** 2026-05-17
**Parent:** ../AGENTS.md

## OVERVIEW

File-system watchers for live tool/skill discovery. Monitors configured directories with chokidar; triggers registry updates when files are added, changed, or removed. Keeps the tool/skill registries in sync without server restarts.

## STRUCTURE

```
watchers/
├── ToolWatcher.ts    # Watches .claude/tools + ~/.claude/tools (184L)
└── SkillWatcher.ts   # Watches .claude/skills + ~/.claude/skills (215L)
```

## BEHAVIOR

| Watcher | add | change | unlink |
|---------|-----|--------|--------|
| `ToolWatcher` | triggers `ToolRegistry.discoverAsync()` | — | removes tool by name |
| `SkillWatcher` | triggers `SkillRegistry.discoverAsync()` | triggers re-discovery | removes skill by name |

Note: `ToolWatcher` does NOT watch `change` events — tools don't support hot-reload of tool body; only add/remove. `SkillWatcher` watches `change` because skill frontmatter can be updated without re-adding.

## NOTES

- Both watchers use chokidar `persistent: true` and ignore `node_modules`.
- Instantiated in `lib.ts` during `initializeServer()`, stopped on `SIGINT`/`SIGTERM`.
- Watched dirs are hardcoded: `.claude/tools` / `~/.claude/tools` for tools; `.claude/skills` / `~/.claude/skills` for skills. Configurable via `SKILL_DIRS` only affects the registry discovery dirs, not the watcher dirs.
- Errors are logged and swallowed (watcher failures should not crash the server).
