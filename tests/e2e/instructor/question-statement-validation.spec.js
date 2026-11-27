const { test, expect } = require('@playwright/test');

test.describe('Test Creator Studio — Question Statement Validation E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/auth/login');
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);
  });

  test('validates empty Q3 across Student Preview, Save Draft (Incomplete), and Publish, supports multi-error scroll, stable IDs, and auto-clear', async ({ page }) => {
    await page.goto('/instructor/test-creator?type=assessment');
    await expect(page.getByRole('heading', { name: 'Test Creator Studio' })).toBeVisible({ timeout: 10000 });

    const testTitle = `Validation E2E Exam ${Date.now()}`;
    await page.locator('input[placeholder*="Distributed Systems"]').fill(testTitle);

    // Add 4 more questions so there are 5 questions total
    for (let i = 0; i < 4; i++) {
      await page.locator('[data-testid="btn-add-question-top"]').click();
    }
    await expect(page.getByText('5 Questions', { exact: true }).first()).toBeVisible();

    // Fill Q1, Q2, Q4, Q5; leave Q3 whitespace-only
    await page.locator('[data-testid="question-statement-input-0"]').fill('What is a semaphore?');
    await page.locator('[data-testid="question-statement-input-1"]').fill('Explain paging vs segmentation.');
    await page.locator('[data-testid="question-statement-input-2"]').fill('   ');
    await page.locator('[data-testid="question-statement-input-3"]').fill('What causes thrashing?');
    await page.locator('[data-testid="question-statement-input-4"]').fill('Define deadlock conditions.');

    // Also fill valid MCQ options for Q1..Q5 so Publish only fails on statement when empty
    for (let qIdx = 0; qIdx < 5; qIdx++) {
      const card = page.locator(`[data-testid="question-card-${qIdx}"]`);
      const optInputs = card.locator('input[placeholder^="Option "]');
      const count = await optInputs.count();
      for (let o = 0; o < count; o++) {
        await optInputs.nth(o).fill(`Choice ${o + 1}`);
      }
    }

    // 1. Student Preview: block preview and highlight Q3
    await page.locator('[data-testid="btn-student-preview"]').click();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="question-statement-error-2"]')).toHaveText(
      'Question 3 is empty. Please enter the question statement.'
    );
    await expect(page.locator('[data-testid="question-card-2"]')).toHaveAttribute('data-invalid', 'true');
    await expect(page.locator('[data-testid="question-validation-summary"]')).toContainText(
      'Question 3 is empty. Please enter the question statement.'
    );

    // 2. Save Draft: shows validation error, highlights Q3, saves with explicit Incomplete status
    await page.locator('[data-testid="btn-save-draft"]').click();
    await expect(page.locator('[data-testid="badge-incomplete-status"]')).toHaveText('Incomplete', { timeout: 10000 });
    await expect(page.locator('[data-testid="badge-publication-status"]')).toHaveText('Draft');
    await expect(page.locator('[data-testid="question-card-2"]')).toHaveAttribute('data-invalid', 'true');

    // Reload and confirm entered data and Incomplete status are preserved (Q3 remains empty, not "Question 3")
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="badge-incomplete-status"]')).toHaveText('Incomplete', { timeout: 10000 });
    await expect(page.locator('[data-testid="question-statement-input-0"]')).toHaveValue('What is a semaphore?');
    await expect(page.locator('[data-testid="question-statement-input-2"]')).toHaveValue('');

    // 3. Publish: blocked and stays in Draft status
    await page.locator('[data-testid="btn-publish"]').click();
    await expect(page).toHaveURL(/\/instructor\/test-creator/);
    await expect(page.locator('[data-testid="badge-publication-status"]')).toHaveText('Draft');
    await expect(page.locator('[data-testid="question-statement-error-2"]')).toHaveText(
      'Question 3 is empty. Please enter the question statement.'
    );

    // 4. Multiple empty questions: clear Q1 as well -> Q1 and Q3 empty; verify both highlighted and scrolled to Q1
    await page.locator('[data-testid="question-statement-input-0"]').fill('');
    await page.locator('[data-testid="btn-student-preview"]').click();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="question-card-0"]')).toHaveAttribute('data-invalid', 'true');
    await expect(page.locator('[data-testid="question-card-2"]')).toHaveAttribute('data-invalid', 'true');
    await expect(page.locator('[data-testid="question-validation-summary"]')).toContainText(
      'Question 1 is empty. Please enter the question statement.'
    );
    await expect(page.locator('[data-testid="question-validation-summary"]')).toContainText(
      'Question 3 is empty. Please enter the question statement.'
    );

    // Verify first invalid question (Q1) is in viewport after scroll
    await expect(page.locator('[data-testid="question-card-0"]')).toBeInViewport();

    // 5. Auto-clear on correction: fix Q1 -> Q1 error clears while Q3 stays highlighted
    await page.locator('[data-testid="question-statement-input-0"]').fill('What is a semaphore?');
    await expect(page.locator('[data-testid="question-card-0"]')).toHaveAttribute('data-invalid', 'false');
    await expect(page.locator('[data-testid="question-statement-error-0"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="question-card-2"]')).toHaveAttribute('data-invalid', 'true');

    // 6. Stable question IDs across reordering: move Q3 up to position 2 -> error stays on that question and updates to Q2
    const q3Card = page.locator('[data-testid="question-card-2"]');
    const q3StableId = await q3Card.getAttribute('data-question-id');
    await q3Card.locator('button[title="Move Up"]').click();
    const movedCard = page.locator(`[data-question-id="${q3StableId}"]`);
    await expect(movedCard).toHaveAttribute('data-invalid', 'true');
    await expect(movedCard).toHaveAttribute('data-testid', 'question-card-1');
    await expect(page.locator('[data-testid="question-statement-error-1"]')).toHaveText(
      'Question 2 is empty. Please enter the question statement.'
    );

    // 7. Fix Q2 -> error clears, preview opens, Save Draft clears Incomplete badge, Publish succeeds
    await page.locator('[data-testid="question-statement-input-1"]').fill('Explain virtual memory.');
    await expect(page.locator('[data-testid="question-validation-summary"]')).toHaveCount(0);

    await page.locator('[data-testid="btn-student-preview"]').click();
    const modal = page.locator('[role="dialog"]');
    await expect(modal.getByRole('heading', { name: 'Student Examination Preview' })).toBeVisible({ timeout: 5000 });
    await modal.getByRole('button', { name: 'Close modal' }).click();

    await page.locator('[data-testid="btn-save-draft"]').click();
    await expect(page.getByText(`Draft saved for "${testTitle}".`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="badge-incomplete-status"]')).toHaveCount(0);

    await page.locator('[data-testid="btn-publish"]').click();
    await expect(page).toHaveURL(/\/instructor\/assessments/, { timeout: 10000 });
  });
});
