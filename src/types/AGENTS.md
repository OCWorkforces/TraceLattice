# TYPES MODULE

**Updated:** 2026-05-17
**Parent:** ../AGENTS.md

## OVERVIEW

Shared TypeScript type definitions for domain objects. Hand-written interfaces (NOT inferred from schemas) because normalizer fills optional fields that are required in runtime types.

## STRUCTURE

```
types/
├── tool.ts          # Tool, ToolRecommendation, JsonSchema (87L)
├── skill.ts         # Skill, SkillRecommendation (84L)
├── disposable.ts    # IDisposable interface (21L)
└── server-config.ts # ServerConfig re-export alias (930B)
```

## KEY TYPES

| Symbol | File | Role |
|--------|------|------|
| `Tool` | `tool.ts` | `{ name, description, inputSchema: JsonSchema }` |
| `ToolRecommendation` | `tool.ts` | `{ tool_name, confidence, rationale, priority, suggested_inputs?, alternatives? }` — `priority` REQUIRED (unlike schema) |
| `JsonSchema` | `tool.ts` | `Record<string, unknown>` alias for tool `inputSchema` |
| `Skill` | `skill.ts` | `{ name, description, user_invocable?, allowed_tools? }` |
| `SkillRecommendation` | `skill.ts` | `{ skill_name, confidence, rationale, priority, alternatives?, allowed_tools?, user_invocable? }` — `confidence`/`rationale`/`priority` REQUIRED |
| `IDisposable` | `disposable.ts` | `{ dispose(): Promise<void> }` — implement on services with resources |

## NOTES

- `ToolRecommendation.priority` and `SkillRecommendation.confidence/rationale/priority` are REQUIRED here even though they're optional in valibot schemas. The normalizer fills defaults; these types reflect post-normalization state.
- `IDisposable` is used by `Container.registerDisposable()` — anything with open resources (DB, timers, file handles) should implement it.
- Do NOT infer these types from `schema.ts` schemas — the optionality mismatch would break call sites.
