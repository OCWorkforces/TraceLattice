# TRANSPORT MODULE

**Updated:** 2026-05-17
**Parent:** ../AGENTS.md

## OVERVIEW

MCP transport implementations: 3 transport types + shared base. Communication channels between MCP server and clients. Factory pattern, async lifecycle, security baked in. `ITransport` contract: `src/contracts/transport.ts`.

## STRUCTURE

```
src/transport/
├── BaseTransport.ts            # 410L  Abstract base: rate limiting, CORS, validation
├── StreamableHttpTransport.ts  # 704L  MCP Streamable HTTP (stateful/stateless)
├── SseTransport.ts             # 476L  Server-Sent Events (multi-user streaming)
├── HttpTransport.ts            # 344L  HTTP JSON-RPC (stateless)
└── HttpHelpers.ts              # 109L  readRequestBody + shared utils
```

## TRANSPORTS

### StreamableHttpTransport (production, most complex)
Production MCP transport (replaced SSE as of MCP spec March 2025). Dual mode: stateful (per-client `SessionState` keyed by `Mcp-Session-Id` header) or stateless. Request streaming, graceful shutdown, session reaper.

### SseTransport (legacy)
Server-Sent Events for multi-user streaming. `Set<ServerResponse>` connection pool, message queue for late joiners, auto client IDs. Endpoints: `GET /sse` (SSE stream), `POST /sse/message` (send), `GET /health`. Session via `?session=` or `?sessionId=` query param.

### HttpTransport (simplest)
Stateless JSON-RPC 2.0 over HTTP. Pipeline: rate limit → CORS → body size → schema → delegate. Body limit 10MB, 30s timeout.

## ENDPOINTS

| Transport | Method | Path | Notes |
|-----------|--------|------|-------|
| StreamableHTTP | POST/GET | `/mcp` | Stateful: `Mcp-Session-Id` header required after init |
| StreamableHTTP | GET | `/health`, `/ready`, `/metrics` | Health/readiness/Prometheus |
| SSE | GET | `/sse` | SSE stream (long-lived) |
| SSE | POST | `/sse/message` | Client→server messages |
| SSE | GET | `/health`, `/ready` | Health/readiness |
| HTTP | POST | `/messages` | Stateless JSON-RPC 2.0 |
| HTTP | GET | `/health`, `/ready`, `/metrics` | Health/readiness/Prometheus |
## SHARED BASE

`BaseTransport` provides cross-cutting security:
- Rate limiting (100 req/min per-IP, `X-Forwarded-For` aware)
- CORS preflight + headers
- Session ID validation (`SESSION_ID_PATTERN` from `core/ids.ts`)
- Host header allowlist (`ALLOWED_HOSTS`)
- Query param sanitization, path traversal prevention, request size caps
- JSON-RPC parsing via `safeParse(JsonRpcRequestSchema, rawBody)` (valibot) — never raw `JSON.parse(...) as unknown`

## NOTES

- Factories: `createStreamableHttpTransport()`, `createSseTransport()`, `createHttpTransport()`
- All expose `start()` / `stop()` (Promise-based graceful shutdown)
- `HealthChecker` integration for `/health`
- `Mcp-Session-Id` header is the stateful StreamableHTTP session key
- `HttpHelpers.readRequestBody` shared across HTTP variants, never duplicate
