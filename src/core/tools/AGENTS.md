# TOOLS MODULE

**Parent:** ../AGENTS.md

## OVERVIEW

Tool interleave subsystem. Single file. Implements the suspend/resume flow that lets `ThoughtProcessor` pause a thinking chain on a `tool_call` thought and resume it after the LLM receives the tool result. Gated by the `toolInterleave` feature flag.

## STRUCTURE

```
tools/
└── InMemorySuspensionStore.ts  # ISuspensionStore impl: TTL expiry + background sweep timer (150L)
```

`ISuspensionStore` contract lives in `src/contracts/suspension.ts` (8 methods).

## SUSPEND / RESUME FLOW

1. `ThoughtProcessor` receives a `tool_call` thought → calls `store.suspend(token, record)`
2. Returns suspension token to LLM
3. LLM executes the tool, then submits a `tool_observation` thought with the token
4. `ThoughtProcessor` calls `store.resume(token)` → retrieves `SuspensionRecord` → continues

## INTERFACE

`ISuspensionStore` (8 methods: `suspend`, `resume`, `peek`, `expire`, `clearSession`, `size`, `start`, `stop`):

- `suspend(token, record)` — stores a `SuspensionRecord` keyed by `SuspensionToken`
- `resume(token)` — retrieves and removes; throws `SuspensionNotFoundError` or `SuspensionExpiredError`
- `peek(token)` — read-only check without removing
- `expire(token)` — manually expire before TTL
- `start()` / `stop()` — lifecycle for the background sweep timer

## KEY TYPES

| Type | Location | Notes |
|------|----------|-------|
| `ISuspensionStore` | `src/contracts/suspension.ts` | Interface — 8 methods |
| `SuspensionRecord` | `src/contracts/suspension.ts` | token, sessionId, toolCallThoughtNumber, toolName, toolArguments, timestamps |
| `SuspensionToken` | `src/contracts/ids.ts` | Branded string; construct via `generateSuspensionToken()` |
| `SuspensionNotFoundError` | `src/errors.ts` | Code: `SUSPENSION_NOT_FOUND` |
| `SuspensionExpiredError` | `src/errors.ts` | Code: `SUSPENSION_EXPIRED` |
| `InvalidToolCallError` | `src/errors.ts` | Code: `INVALID_TOOL_CALL` — thrown for malformed tool_call thoughts |

## NOTES

- Default TTL: `300_000` ms (5 min). Default sweep interval: `60_000` ms (1 min).
- TTL is per-record, not per-session. Expired records are reaped by the background sweep.
- `toolInterleave` feature flag gates the write path only. `ISuspensionStore` is always registered in DI so reads stay safe when the flag is off.
- Never catch `SuspensionExpiredError` silently upstream — let it surface so the LLM knows the chain is stale.
