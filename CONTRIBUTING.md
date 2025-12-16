# Developer Guidelines & Contributing

## Code Standards

### TypeScript
- **Strict Mode:** Enabled. No `any` types unless absolutely necessary (and commented).
- **Interfaces:** Define interfaces for all Agent inputs/outputs in `src/types/`.
- **Async/Await:** Prefer over raw Promises.

### Project Structure
```text
/
├── services/           # Microservices
│   ├── scraper/        # Data ingestion
│   ├── brain/          # LLM Logic
│   └── media/          # Video processing
├── shared/             # Shared types/utils
├── infrastructure/     # Docker & DB config
└── scripts/            # Helper utilities
```

## Testing Strategy

### Unit Tests (Jest/Vitest)
- Test logic *pure functions* (e.g., profit margin calculators, string formatters).
- **Mocking:** ALWAYS mock OpenAI/Shopify API calls in tests. Do not burn credits.

### Integration Tests
- Run against a local Dockerized Postgres/Redis.
- Use the `test` environment in `.env`.

## Git Workflow
- **Main Branch:** `main` (Production-ready).
- **Feature Branches:** `feat/feature-name` (e.g., `feat/tiktok-scraper`).
- **Fix Branches:** `fix/issue-name`.
- **Commit Messages:** Conventional Commits (e.g., `feat: add sourcing agent logic`, `fix: resolve redis timeout`).

## Env Variables
- Never commit `.env`.
- Update `secrets.example.md` if you add a new required variable.

