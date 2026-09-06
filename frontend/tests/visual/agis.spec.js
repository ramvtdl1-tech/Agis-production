import { test, expect } from '@playwright/test';

const screens = [
  ['01-login', '/__visual/login'],
  ['02-dashboard', '/dashboard?visual=1'],
  ['03-documents', '/documents?visual=1'],
  ['04-new-transformation', '/transformations/new?visual=1'],
  ['05-configuration', '/transformations/config?visual=1'],
  ['06-generated-output', '/transformations/mock?visual=1'],
  ['07-review-approval', '/transformations/mock/review?visual=1'],
  ['08-audit-logs', '/audit-logs?visual=1'],
  ['09-user-management', '/users?visual=1'],
  ['10-system-configuration', '/system?visual=1'],
  ['11-roles-permissions', '/roles?visual=1'],
  ['12-template-management', '/templates?visual=1'],
];

test.beforeEach(async ({ page }) => {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });
});

for (const [name, path] of screens) {
  test(`AGIS visual regression — ${name}`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' });
    await page.locator('body').waitFor();
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.001,
    });
  });
}
