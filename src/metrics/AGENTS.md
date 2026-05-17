# METRICS MODULE

**Updated:** 2026-05-17
**Parent:** ../AGENTS.md

## OVERVIEW

Prometheus-compatible metrics collection. Counters, gauges, and histograms. Exported via the `/metrics` HTTP endpoint on `StreamableHttpTransport` and `HttpTransport`. Implements `IMetrics` from `contracts/interfaces.ts`.

## STRUCTURE

```
metrics/
└── metrics.impl.ts   # Metrics class + MetricType enum + Metric interface (470L)
```

## KEY TYPES

| Symbol | Role |
|--------|------|
| `Metrics` (class) | Thread-safe collector; `counter/gauge/histogram()` methods |
| `IMetrics` (interface) | In `contracts/interfaces.ts`: `counter`, `gauge`, `histogram`, `export()` |
| `MetricType` | `Counter \| Gauge \| Histogram` enum |
| `Metric` | `{ name, type, value, labels, help?, timestamp? }` |

## CONVENTIONS

- Inject `IMetrics` from DI (`container.resolve('Metrics')`).
- Histogram buckets default: `[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]` (in seconds).
- `export()` returns Prometheus text format string (for `/metrics` endpoint).
- Labels are `Record<string, string>` — keep them low-cardinality.
- Counters only increase. Use gauge for values that go up and down (e.g., active sessions).
