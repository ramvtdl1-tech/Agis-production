# AGIS Production-Ready Reference Implementation

This repository is a production-oriented implementation of the 12-screen AGIS (Adaptive GenAI Intelligence System) workflow from the supplied AGIS-SIH2026 reference PDF.

## What is included

- React + Vite frontend refined against all 12 reference screens.
- FastAPI backend.
- PostgreSQL + SQLAlchemy persistence.
- Redis rate limiting.
- Celery background jobs.
- MinIO/S3-compatible object storage.
- PDF/DOCX/XLSX extraction pipeline.
- Email OTP + JWT authentication.
- Backend permission enforcement and frontend role gates.
- Audit logging.
- AI generation adapter in `backend/app/ai.py`.
- Docker Compose for local production-like orchestration.

## Reference screen map

See `docs/AGIS-screen-reference.md` for the page-by-page mapping and visual tokens.

## Run

1. Copy `.env.example` to `.env` and set real secrets/API credentials.
2. Run `docker compose up --build`.
3. Seed the database from the backend container with `python seed.py`.
4. Open the frontend exposed by the compose stack.

The development seed uses intentionally non-production credentials. Replace them immediately in any real environment.

## Production hardening still required before deployment

- Use managed PostgreSQL/Redis/object storage where appropriate.
- Put secrets in a real secret manager.
- Add a malware/content scanner before object storage.
- Add database migrations (Alembic) instead of `Base.metadata.create_all`.
- Add TLS, secure cookie/token rotation strategy, structured logging, metrics, tracing, backups, and alerting.
- Configure an approved model provider and validate prompts/output against the organization's data-handling policy.
- Add automated visual regression tests against the supplied 12 reference screens.

## Automated visual regression

The frontend includes a Playwright visual-regression suite covering all 12 AGIS screens at a fixed 1365×768 viewport. It uses deterministic visual-test authentication (`?visual=1`) so screenshot runs do not require a live backend or OTP service.

From `frontend/`:

```bash
npm install
npx playwright install chromium
npm run test:visual:update   # first run / intentionally update baselines
npm run test:visual          # regression check
npm run test:visual:report   # inspect the HTML report
```

The suite uses a strict 0.1% pixel-difference threshold and disables animation/caret motion to reduce screenshot noise. See `frontend/tests/visual/README.md` and `frontend/playwright.config.js`.
