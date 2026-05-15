# REASONING MODULE

**Parent:** ../AGENTS.md

## OVERVIEW

Two concerns live here: `OutcomeRecorder` (calibration data collection) and `strategies/` (pluggable reasoning policies). They share no state. `OutcomeRecorder` feeds `Calibrator`; `strategies/` feeds `ThoughtProcessor`.

## STRUCTURE

```
reasoning/
├── OutcomeRecorder.ts   # Per-session calibration outcome storage (116L)
└── strategies/          # Pure reasoning policies — has own AGENTS.md
    ├── SequentialStrategy.ts
    ├── TreeOfThoughtStrategy.ts
    ├── StrategyFactory.ts
    ├── totScoring.ts
    └── plateau.ts
```

## OUTCOME RECORDER

`OutcomeRecorder` records a `VerificationOutcome` per thought so `Calibrator` can compute calibration metrics (Brier, ECE) over real outcomes.

| Field | Type | Notes |
|-------|------|-------|
| `thoughtId` | `ThoughtId` | Branded |
| `thoughtNumber` | `number` | Ordinal within session |
| `sessionId` | `SessionId` | Branded |
| `predicted` | `number` (0–1) | The `confidence` on the thought |
| `actual` | `number` (0–1) | Observed outcome (set by LLM on `tool_observation`) |
| `type` | `ThoughtType` | For per-type breakdown |

- Gated by `outcomeRecording` feature flag. When off, `OutcomeRecorder` is a no-op.
- Registered in `ServiceRegistry` as `outcomeRecorder`.
- `Calibrator` reads outcomes via `ICalibrator` contract (`src/contracts/calibrator.ts`).

## WHERE TO LOOK

| Task | File |
|------|------|
| Outcome recording logic | `OutcomeRecorder.ts` |
| Calibration computation | `src/core/evaluator/Calibrator.ts` |
| Add / change reasoning strategy | `strategies/` + `StrategyFactory.ts` — see `strategies/AGENTS.md` |
| Strategy contract | `src/contracts/strategy.ts` |

## NOTES

- `OutcomeRecorder` is a dumb store — it records, it does not compute. All metric derivation happens in `Calibrator`.
- `strategies/` sub-directory is at depth 4 deliberately. Strategies are leaf policies; they import from `contracts/` and `core/` types only, never from infrastructure or DI.
