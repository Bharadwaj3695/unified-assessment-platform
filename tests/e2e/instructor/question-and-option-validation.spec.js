const { test, expect } = require('@playwright/test');

test.describe('Test Creator Studio — Question and Answer Option Validation E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/auth/login');
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);
  });

  test('validates empty statements, single & multiple empty MCQ options, Q3 of 5, missing correct answer, dynamic clearing, type change, and actions', async ({ page }) => {
    await page.goto('/instructor/test-creator?type=assessment');
    await expect(page.getByRole('heading', { name: 'Test Creator Studio' })).toBeVisible({ timeout: 10000 });

    const testTitle = `Option Validation E2E ${Date.now()}`;
    await page.locator('input[placeholder*="Distributed Systems"]').fill(testTitle);

    // Scenario 1: Empty question statement + empty options on Q1
    await page.locator('[data-testid="btn-validate"]').click();
    await expect(page.locator('[data-testid="question-validation-summary"]')).toContainText('Question 1 has incomplete fields.');
    await expect(page.locator('[data-testid="question-validation-summary"]')).toContainText('Question 1: Question statement is empty.');
    await expect(page.locator('[data-testid="question-statement-error-0"]')).toHaveText(
      'Question 1 is empty. Please enter the question statement.'
    );

    // Fill Q1 statement and all 4 options
    await page.locator('[data-testid="question-statement-input-0"]').fill('What is a semaphore?');
    await expect(page.locator('[data-testid="question-statement-error-0"]')).toHaveCount(0);
    for (let o = 0; o < 4; o++) {
      await page.locator(`[data-testid="question-option-input-0-${o}"]`).fill(`Q1 Choice ${o + 1}`);
    }
    await expect(page.locator('[data-testid="question-validation-summary"]')).toHaveCount(0);

    // Add 4 more questions for a 5-question test
    for (let i = 0; i < 4; i++) {
      await page.locator('[data-testid="btn-add-question-top"]').click();
    }
    await expect(page.getByText('5 Questions', { exact: true }).first()).toBeVisible();

    // Fill Q2..Q5 statements and options, except:
    // - Q2: leave Option B and Option D empty (Scenario 3: multiple empty options in one question)
    // - Q3: leave Option B empty (Scenario 4: empty option in Question 3 of a five-question test)
    const statements = [
      'What is a semaphore?',
      'Which algorithm prevents starvation?',
      'Which HTTP method is idempotent?',
      'What causes thrashing?',
      'Define deadlock conditions.',
    ];

    for (let qIdx = 1; qIdx < 5; qIdx++) {
      await page.locator(`[data-testid="question-statement-input-${qIdx}"]`).fill(statements[qIdx]);
      for (let o = 0; o < 4; o++) {
        if (qIdx === 1 && (o === 1 || o === 3)) continue; // Q2 Option B & D empty
        if (qIdx === 2 && o === 1) continue; // Q3 Option B whitespace-only
        await page.locator(`[data-testid="question-option-input-${qIdx}-${o}"]`).fill(`Q${qIdx + 1} Choice ${o + 1}`);
      }
    }
    await page.locator('[data-testid="question-option-input-2-1"]').fill('   ');

    // Collapse Q2 to verify collapsed invalid cards automatically expand on validation
    await page.locator('[data-testid="question-card-1"] button[title="Collapse Question"]').click();
    await expect(page.locator('[data-testid="question-option-input-1-1"]')).toHaveCount(0);

    // Scenario 8: Save Draft, Preview, and Publish attempted with invalid fields
    await page.locator('[data-testid="btn-save-draft"]').click();
    await expect(page.locator('[data-testid="question-validation-summary"]')).toContainText('2 questions have incomplete fields.');
    await expect(page.locator('[data-testid="question-validation-summary"]')).toContainText('Question 2: Option B is empty.');
    await expect(page.locator('[data-testid="question-validation-summary"]')).toContainText('Question 2: Option D is empty.');
    await expect(page.locator('[data-testid="question-validation-summary"]')).toContainText('Question 3: Option B is empty.');
    await expect(page.locator('[data-testid="badge-publication-status"]')).toHaveText('Draft');

    // Collapsed Q2 card was auto-expanded and scrolled into view
    await expect(page.locator('[data-testid="question-option-input-1-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="question-card-1"]')).toBeInViewport();

    // Inline messages and red borders on Q2 Option B and Option D
    await expect(page.locator('[data-testid="question-option-error-1-1"]')).toHaveText(
      'Option B is empty. Please enter the answer option.'
    );
    await expect(page.locator('[data-testid="question-option-error-1-3"]')).toHaveText(
      'Option D is empty. Please enter the answer option.'
    );
    await expect(page.locator('[data-testid="question-option-input-1-1"]')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('[data-testid="question-option-input-1-3"]')).toHaveAttribute('aria-invalid', 'true');

    // Student Preview is also blocked
    await page.locator('[data-testid="btn-student-preview"]').click();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);

    // Publish is also blocked
    await page.locator('[data-testid="btn-publish"]').click();
    await expect(page).toHaveURL(/\/instructor\/test-creator/);

    // Scenario 6: Empty option corrected after validation clears immediately
    await page.locator('[data-testid="question-option-input-1-1"]').fill('Aging');
    await expect(page.locator('[data-testid="question-option-error-1-1"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="question-option-input-1-1"]')).toHaveAttribute('aria-invalid', 'false');
    await expect(page.locator('[data-testid="question-option-error-1-3"]')).toBeVisible();

    // Intentionally remove Option D from Q2 (minimum 2 rule preserved, remaining 3 options valid)
    await page.locator('[data-testid="question-option-remove-1-3"]').click();
    await expect(page.locator('[data-testid="question-card-1"]')).toHaveAttribute('data-invalid', 'false');

    // Now ONLY Q3 has an empty Option B -> verify summary identifies Question 3 specifically
    await page.locator('[data-testid="btn-validate"]').click();
    await expect(page.locator('[data-testid="question-validation-summary"]')).toContainText('Question 3 has incomplete fields.');
    await expect(page.locator('[data-testid="question-validation-summary"]')).toContainText('Question 3: Option B is empty.');
    await expect(page.locator('[data-testid="question-option-error-2-1"]')).toHaveText(
      'Option B is empty. Please enter the answer option.'
    );

    // Fix Q3 Option B
    await page.locator('[data-testid="question-option-input-2-1"]').fill('PUT');
    await expect(page.locator('[data-testid="question-validation-summary"]')).toHaveCount(0);

    // Scenario 5: No correct answer selected (switch Q4 to MULTI_SELECT and uncheck default opt_1)
    await page.locator('[data-testid="question-type-select-3"]').selectOption('MULTI_SELECT');
    await page.locator('[data-testid="question-option-correct-3-0"]').uncheck();
    await page.locator('[data-testid="btn-validate"]').click();
    await expect(page.locator('[data-testid="question-correct-answer-error-3"]')).toHaveText(
      'Please select at least one correct answer.'
    );
    await expect(page.locator('[data-testid="question-validation-summary"]')).toContainText(
      'Question 4: No correct answer selected.'
    );
    // Re-check a correct answer -> clears immediately
    await page.locator('[data-testid="question-option-correct-3-1"]').check();
    await expect(page.locator('[data-testid="question-correct-answer-error-3"]')).toHaveCount(0);

    // Scenario 7: Question type changed from MCQ (with empty options) to Coding
    await page.locator('[data-testid="question-option-input-4-1"]').fill('');
    await page.locator('[data-testid="btn-validate"]').click();
    await expect(page.locator('[data-testid="question-option-error-4-1"]')).toBeVisible();
    await page.locator('[data-testid="question-type-select-4"]').selectOption('CODING');
    await expect(page.locator('[data-testid="question-card-4"] [data-testid="faculty-code-ide"]')).toBeVisible();
    await expect(page.locator('[data-testid="question-card-4"]')).toHaveAttribute('data-invalid', 'false');
    await expect(page.locator('[data-testid="question-validation-summary"]')).toHaveCount(0);

    // Scenario 9: Valid test successfully previewed, saved as draft, and published
    await page.locator('[data-testid="btn-student-preview"]').click();
    const modal = page.locator('[role="dialog"]');
    await expect(modal.getByRole('heading', { name: 'Student Examination Preview' })).toBeVisible({ timeout: 5000 });
    await modal.getByRole('button', { name: 'Close modal' }).click();
    await expect(modal).not.toBeVisible();

    await page.locator('[data-testid="btn-save-draft"]').click();
    await expect(page.getByText(`Draft saved for "${testTitle}".`)).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="btn-publish"]').click();
    await expect(page).toHaveURL(/\/instructor\/assessments/, { timeout: 15000 });
  });
});
