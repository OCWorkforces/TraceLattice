# CONFIG MODULE

**Updated:** 2026-05-17
**Parent:** ../AGENTS.md

## OVERVIEW

Two-layer configuration: `ConfigLoader` reads YAML/JSON from standard locations + env var overrides → `ServerConfig` in `src/ServerConfig.ts` validates and exposes a typed, immutable config + 7 feature flags.

## STRUCTURE

```
src/config/
├── ConfigLoader.ts    # YAML+JSON loader, env override mapping, ConfigFileOptions schema (480L)
└── server-config.ts   # Re-export shim (thin, delegates to src/ServerConfig.ts)
```

> Note: The canonical `ServerConfig` class lives at `src/ServerConfig.ts` (517L), not inside this directory.

## CONFIGLOADER

Loads from the following locations in priority order (env > project > user > defaults):

1. `TRACELATTICE_CONFIG` env var (custom path)
2. `.claude/config.yaml` / `.claude/config.json` (project-local)
3. `~/.claude/config.yaml` / `~/.claude/config.json` (user-global)

```typescript
const loader = new ConfigLoader();
const config: ConfigFileOptions = await loader.load();
```

`ConfigFileOptions` exported type fields:
- `maxHistorySize`, `maxBranches`, `maxBranchSize`
- `logLevel: 'debug'|'info'|'warn'|'error'`, `prettyLog: boolean`
- `skillDirs: string[]`
- `discoveryCache: { ttl?, maxSize? }`
- `persistence` (backend config blob, shape varies by backend type)
- `features` (feature flag overrides blob)
- `toolInterleaveTtlMs`, `toolInterleaveSweepMs`
- `maxSessionsPerOwner`

All fields optional. Unknown extra fields are preserved (Valibot `looseObject`).

## ENV VAR OVERRIDES

All config fields can be overridden via `TRACELATTICE_*` env vars:

```
TRACELATTICE_MAX_HISTORY_SIZE=1000
TRACELATTICE_LOG_LEVEL=debug
TRACELATTICE_PRETTY_LOG=true
TRACELATTICE_FEATURES_DAG_EDGES=true
TRACELATTICE_FEATURES_REASONING_STRATEGY=tot
TRACELATTICE_FEATURES_CALIBRATION=true
TRACELATTICE_FEATURES_COMPRESSION=true
TRACELATTICE_FEATURES_TOOL_INTERLEAVE=true
TRACELATTICE_FEATURES_NEW_THOUGHT_TYPES=true
TRACELATTICE_FEATURES_OUTCOME_RECORDING=true
```

## SERVERCONFIG (src/ServerConfig.ts)

Canonical config class with validation + feature flag resolution.

- `ServerConfig.validateFeatures()`: defaults all boolean flags to `true`; env vars document off-by-default opt-ins.
- 7 feature flags: `dagEdges`, `reasoningStrategy ('sequential'|'tot')`, `calibration`, `compression`, `toolInterleave`, `newThoughtTypes`, `outcomeRecording`.
- Exposes `hasFeature(flag)` from `contracts/features.ts`.

## NOTES

- CLI (`cli.ts`) does not parse config args — all config via env vars or config files.
- `ConfigFileOptions` is exported and registered as `FileConfig` in DI (raw pre-validation data).
- `ServerConfig` is registered as `Config` in DI (validated config + feature flags).
