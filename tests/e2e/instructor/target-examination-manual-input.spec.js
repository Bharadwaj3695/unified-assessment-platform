const { test, expect } = require('@playwright/test');

test.describe('Test Creator Studio — Manual Target Examination Input E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/auth/login');
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);
  });

  test('supports manual entry, draft persistence, editing, and publishing for higher-education examination names', async ({ page }) => {
    await page.goto('/instructor/test-creator?type=mock');
    await expect(page.getByRole('heading', { name: 'Test Creator Studio' })).toBeVisible({ timeout: 10000 });

    const examInput = page.getByLabel('Target Examination');
    await expect(examInput).toBeVisible();
    await expect(examInput).toHaveAttribute('type', 'text');
    await expect(examInput).toHaveAttribute('placeholder', 'Enter examination name');
    await expect(examInput).toHaveValue('');

    // Ensure no combobox dropdown/listbox or toggle exists
    await expect(page.locator('[data-testid="listbox-target-examination"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="btn-toggle-examination"]')).toHaveCount(0);

    // 1. Enter a custom higher-education examination name
    await examInput.fill('University Semester Examination');
    await expect(examInput).toHaveValue('University Semester Examination');

    // Fill title and a valid question statement + options
    const mockTitle = `CS401 Semester Mock ${Date.now()}`;
    await page.locator('input[placeholder*="Distributed Systems"]').fill(mockTitle);
    await page.locator('[data-testid="question-statement-input-0"]').fill('Explain B+ Tree indexing in database management systems.');
    const q0Options = page.locator('[data-testid="question-card-0"] input[placeholder^="Option "]');
    const optCount = await q0Options.count();
    for (let i = 0; i < optCount; i++) {
      await q0Options.nth(i).fill(`Option ${i + 1}`);
    }

    // 2. Save Draft and reopen it
    await page.locator('[data-testid="btn-save-draft"]').click();
    await expect(page.getByText(/Mock test draft saved for/)).toBeVisible({ timeout: 10000 });

    const savedDraftUrl = page.url();
    expect(savedDraftUrl).toContain('type=mock');
    expect(savedDraftUrl).toContain('id=');

    await page.goto('/instructor/dashboard');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);

    await page.goto(savedDraftUrl);
    await page.waitForLoadState('networkidle');

    // 3. Verify exact examination name is preserved after reopening draft
    await expect(page.getByLabel('Target Examination')).toHaveValue('University Semester Examination');

    // 4. Edit examination name to another higher-education assessment name and save again
    await page.getByLabel('Target Examination').fill('GATE 2027');
    await page.locator('[data-testid="btn-save-draft"]').click();
    await expect(page.getByText(/Mock test draft saved for/)).toBeVisible({ timeout: 10000 });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByLabel('Target Examination')).toHaveValue('GATE 2027');

    // 5. Edit to Placement Assessment and publish
    await page.getByLabel('Target Examination').fill('Company Hiring Assessment');
    await page.locator('[data-testid="btn-publish"]').click();
    await expect(page).toHaveURL(/\/instructor\/assessments/, { timeout: 15000 });
  });
});
