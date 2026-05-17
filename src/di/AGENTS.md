# DI MODULE

**Updated:** 2026-05-17
**Parent:** ../AGENTS.md

## OVERVIEW

Lightweight IoC container + typed service registry for the 19-service dependency graph. No framework dependency — plain TypeScript Maps with circular detection and disposable lifecycle.

## STRUCTURE

```
src/di/
├── Container.ts         # DIContainer class — singleton/transient/lazy, circular detection (424L)
└── ServiceRegistry.ts   # Typed service key map (interface + ServiceKey union, 51L)
```

## CONTAINER API

```typescript
// Singleton-direct (resolved immediately, always same instance)
container.registerInstance('Logger', new StructuredLogger());

// Lazy-singleton (factory called once, result cached)
container.register('HistoryManager', () => new HistoryManager({ ... }));

// Transient factory (new instance every resolve)
container.registerFactory('RequestContext', () => new RequestContext());

// Typed resolution (inferred from ServiceRegistry)
const logger = container.resolve('Logger');  // type: StructuredLogger

// Escape hatch — dynamic string key, returns unknown
const svc = container.resolveDynamic('SomeDynamic') as MyService;

// Lifecycle cleanup
container.registerDisposable('Persistence', backend);
await container.dispose();  // calls dispose() on all registered IDisposable
```

## SERVICE REGISTRY (19 keys)

| Key | Type | Notes |
|-----|------|-------|
| `Logger` | `StructuredLogger` | JSON/pretty stderr logger |
| `Config` | `ServerConfig` | Validated config + 7 feature flags |
| `FileConfig` | `ConfigFileOptions` | Raw YAML/JSON from disk before validation |
| `HistoryManager` | `HistoryManager` | Coordinates thought history + sessions |
| `ThoughtProcessor` | `ThoughtProcessor` | 7-stage pipeline entrypoint |
| `ThoughtFormatter` | `IThoughtFormatter` | Chalk display (stderr only) |
| `ThoughtEvaluator` | `ThoughtEvaluator` | Stateless quality signals |
| `Persistence` | `PersistenceBackend \| null` | File/SQLite/Memory backend |
| `ToolRegistry` | `ToolRegistry` | MCP tool discovery |
| `SkillRegistry` | `SkillRegistry` | Claude skill discovery |
| `Metrics` | `Metrics` | Prometheus counters/gauges/histograms |
| `EdgeStore` | `EdgeStore` | Per-session DAG edge CRUD |
| `reasoningStrategy` | `IReasoningStrategy` | Sequential or ToT policy |
| `outcomeRecorder` | `IOutcomeRecorder` | Per-session verification outcomes |
| `calibrator` | `ICalibrator` | Beta(2,2) confidence calibration |
| `summaryStore` | `ISummaryStore` | Branch rollup summaries |
| `compressionService` | `CompressionService` | Branch collapse coordination |
| `suspensionStore` | `ISuspensionStore` | Tool interleave suspend/resume |
| `sessionLock` | `ISessionLock` | Per-session concurrency lock (`@internal`) |

## RULES

- Add new services: (1) extend `ServiceRegistry` interface, (2) register in `lib.ts` `_createContainerCore()`.
- Never use `resolveDynamic` for services in `ServiceRegistry` — use typed `resolve(key)`.
- The deprecated `resolve<T>(string)` string overload was removed; rely on `ServiceKey` inference.
- `Container` detects circular dependencies by tracking a `_resolving: Set<string>` during factory calls — throws `CircularDependencyError` on re-entry.
- Concrete types are imported into `ServiceRegistry.ts` (not interfaces) to enable full type-safe resolution. Prefer interface imports in `ServiceRegistry` only when the concrete type isn't needed for callers.
