# CACHE MODULE

**Updated:** 2026-05-17
**Parent:** ../AGENTS.md

## OVERVIEW

Generic LRU+TTL cache for tool/skill discovery results. Avoids repeated filesystem scans. Used by `BaseRegistry` for `getAll()` and per-name lookups.

## STRUCTURE

```
cache/
└── DiscoveryCache.ts   # LRU+TTL cache<T> with Prometheus metrics (377L)
```

## KEY TYPES

| Symbol | Role |
|--------|------|
| `DiscoveryCache<T>` (class) | LRU+TTL cache; evicts least-recently-used when at capacity |
| `IDiscoveryCache<T>` (interface) | Contract in `contracts/interfaces.ts`: `get/set/has/invalidate/clear/size` |
| `DiscoveryCacheOptions` | `{ maxSize?: number (100), ttl?: number (300000ms) }` |
| `CacheEntry<T>` | `{ data: T[], timestamp: number, accessCount: number }` |

## NOTES

- Default TTL: 300s (5 minutes). Default max size: 100 entries.
- Cache key `'all'` is used for the full item list; per-name keys for individual lookups.
- `invalidate(key)` removes one entry; `clear()` empties everything.
- Prometheus metrics injected via `IMetrics` constructor param (optional); tracks hit/miss/eviction.
- TTL check happens on `get()` — no background sweep. Expired entries evicted lazily.
