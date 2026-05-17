# POOL MODULE

**Updated:** 2026-05-17
**Parent:** ../AGENTS.md

## OVERVIEW

Multi-user session isolation for concurrent MCP clients. Each session is a `SessionServer` with independent thought state. Enforces max-session limits, auto-cleanup via TTL, and graceful teardown.

## STRUCTURE

```
src/pool/
├── ConnectionPool.ts   # Main pool: session lifecycle, TTL cleanup, stats (467L)
└── IConnectionPool.ts  # IConnectionPool interface + ConnectionPoolStats type (2.9K)
```

## API

```typescript
const pool = new ConnectionPool({
  maxSessions: 100,           // default: 100
  sessionTimeout: 300_000,    // default: 5min in ms
  autoCleanup: true,          // default: true
  cleanupInterval: 60_000,    // default: 1min in ms
  logger?: Logger,
  serverFactory: () => Promise<SessionServer>,
});

const sessionId = await pool.createSession();  // throws MaxSessionsReachedError
await pool.process(sessionId, thought);         // throws SessionNotFoundError / SessionNotActiveError
await pool.closeSession(sessionId);
pool.getStats(): ConnectionPoolStats           // activeSessions, totalCreated, totalClosed
await pool.dispose();                           // graceful shutdown, closes all sessions
```

## SESSION ERRORS

| Error | When |
|-------|------|
| `MaxSessionsReachedError` | `createSession()` when `activeSessions >= maxSessions` |
| `SessionNotFoundError` | `process()` / `closeSession()` with unknown sessionId |
| `SessionNotActiveError` | `process()` on an already-closed session |
| `PoolTerminatedError` | Any call after `dispose()` |

All errors are subclasses of `SequentialThinkingError` from `errors.ts`.

## NOTES

- `ConnectionPool` is NOT the same as `HistoryManager`'s internal `SessionManager`. Pool manages HTTP-layer transport sessions (one per MCP client connection); `SessionManager` manages thought-history sessions (keyed by `session_id` in the thought data).
- `SessionServer` is the per-user server instance created by `serverFactory`. Consumed by SSE and StreamableHTTP transports that need per-client isolation.
- Auto-cleanup sweeps expired sessions every `cleanupInterval` ms; sessions idle longer than `sessionTimeout` ms are closed.
- `IConnectionPool` is the interface used by transport layer code — import the interface, not the concrete class.
