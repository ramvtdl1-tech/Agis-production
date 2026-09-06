# AGIS visual regression suite

The suite captures all 12 AGIS screens at a fixed **1365×768 CSS-pixel viewport** and compares each render with a committed Playwright snapshot.

## Install

From `frontend/`:

```bash
npm install
npx playwright install chromium
```

## Create/update baselines

```bash
npm run test:visual:update
```

This writes the expected images under `tests/visual/__screenshots__/`.

## Run regression checks

```bash
npm run test:visual
```

A change fails when more than 0.1% of pixels differ. This threshold is intentionally strict for UI refinement.

## Review failures

```bash
npx playwright show-report
```

Failed tests also retain screenshots and traces.

## Visual fixture mode

The frontend recognizes `?visual=1` and uses a deterministic Administrator fixture instead of requiring a live authentication session. The `/__visual/login` route renders the login screen without contacting the backend. This keeps screenshots deterministic while leaving production authentication unchanged.
