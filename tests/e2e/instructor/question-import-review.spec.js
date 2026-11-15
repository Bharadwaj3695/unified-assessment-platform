const { test, expect } = require('@playwright/test');

test.describe('Instructor Question Import Review UI & Action Bar', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept import preview endpoint with structured mock data
    await page.route('**/api/question-import/jobs/test-import-job-1/preview', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          jobId: 'test-import-job-1',
          status: 'REVIEW_REQUIRED',
          sourceType: 'PDF',
          totalDetected: 4,
          totalAccepted: 1,
          totalRejected: 1,
          errors: [],
          questions: [
            {
              tempId: 'temp-1',
              questionText: 'What is polymorphism in object-oriented programming?',
              type: 'mcq',
              options: [
                { id: 'opt_1', text: 'Ability of objects to take on different forms' },
                { id: 'opt_2', text: 'Multiple inheritance in single class' },
              ],
              correctAnswer: 'opt_1',
              points: 5,
              difficulty: 'MEDIUM',
              bloomLevel: 'UNDERSTAND',
              confidence: 90,
              reviewStatus: 'PENDING',
            },
            {
              tempId: 'temp-2',
              questionText: 'Explain the working of the TCP three-way handshake.',
              type: 'short_answer',
              points: 10,
              difficulty: 'HARD',
              bloomLevel: 'ANALYZE',
              confidence: 85,
              reviewStatus: 'PENDING',
            },
            {
              tempId: 'temp-3',
              questionText: 'What is the time complexity of quicksort in the average case?',
              type: 'mcq',
              options: [
                { id: 'opt_1', text: 'O(N log N)' },
                { id: 'opt_2', text: 'O(N^2)' },
              ],
              correctAnswer: 'opt_1',
              points: 5,
              difficulty: 'EASY',
              bloomLevel: 'REMEMBER',
              confidence: 95,
              reviewStatus: 'ACCEPTED',
            },
            {
              tempId: 'temp-4',
              questionText: 'Unreadable scanned text segment.',
              type: 'short_answer',
              points: 5,
              difficulty: 'EASY',
              bloomLevel: 'REMEMBER',
              confidence: 30,
              reviewStatus: 'REJECTED',
            },
          ],
        }),
      });
    });

    // Log in as instructor
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);
  });

  test('1. Action bar displays Submissions, Save Draft, and Publish Live with consistent styling', async ({ page }) => {
    await page.goto('/instructor/question-import/review/test-import-job-1');

    // Verify Title & Breadcrumbs
    await expect(page.locator('h1', { hasText: 'Review Imported Questions' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Imports', exact: true })).toBeVisible();

    // Verify all 3 action buttons are present in action controls
    const subsBtn = page.getByRole('button', { name: 'Submissions', exact: true });
    const saveDraftBtn = page.getByRole('button', { name: 'Save Draft', exact: true });
    const publishLiveBtn = page.getByRole('button', { name: 'Publish Live', exact: true });

    await expect(subsBtn).toBeVisible();
    await expect(saveDraftBtn).toBeVisible();
    await expect(publishLiveBtn).toBeVisible();

    // Verify Submissions button navigates to /instructor/submissions
    await subsBtn.click();
    await expect(page).toHaveURL(/\/instructor\/submissions/);
  });

  test('2. Summary cards display single source of visible counts and filter tabs have no duplicate counts', async ({ page }) => {
    await page.goto('/instructor/question-import/review/test-import-job-1');

    // 2.1 Verify 4 summary cards show accurate counts
    await expect(page.getByTestId('stat-total-detected')).toContainText('4');
    await expect(page.getByTestId('stat-pending-review')).toContainText('2');
    await expect(page.getByTestId('stat-accepted-bank')).toContainText('1');
    await expect(page.getByTestId('stat-rejected')).toContainText('1');

    // 2.2 Verify filter tabs exist WITHOUT numerical counts in buttons
    const allTab = page.getByRole('button', { name: 'All', exact: true });
    const pendingTab = page.getByRole('button', { name: 'Pending Review', exact: true });
    const acceptedTab = page.getByRole('button', { name: 'Accepted', exact: true });
    const rejectedTab = page.getByRole('button', { name: 'Rejected', exact: true });

    await expect(allTab).toBeVisible();
    await expect(pendingTab).toBeVisible();
    await expect(acceptedTab).toBeVisible();
    await expect(rejectedTab).toBeVisible();

    // Verify buttons do not contain parenthesis counts
    await expect(page.getByRole('button', { name: /All \(\d+\)/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Pending \(\d+\)/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Accepted \(\d+\)/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Rejected \(\d+\)/ })).toHaveCount(0);

    // 2.3 Test filter tabs interactively
    // Filter to Pending: 2 questions visible
    await pendingTab.click();
    await expect(page.locator('text=What is polymorphism in object-oriented programming?')).toBeVisible();
    await expect(page.locator('text=Explain the working of the TCP three-way handshake.')).toBeVisible();
    await expect(page.locator('text=What is the time complexity of quicksort in the average case?')).not.toBeVisible();

    // Filter to Accepted: 1 question visible
    await acceptedTab.click();
    await expect(page.locator('text=What is the time complexity of quicksort in the average case?')).toBeVisible();
    await expect(page.locator('text=What is polymorphism in object-oriented programming?')).not.toBeVisible();

    // Filter to Rejected: 1 question visible
    await rejectedTab.click();
    await expect(page.locator('text=Unreadable scanned text segment.')).toBeVisible();
    await expect(page.locator('text=What is polymorphism in object-oriented programming?')).not.toBeVisible();

    // Filter to All: all visible
    await allTab.click();
    await expect(page.locator('text=What is polymorphism in object-oriented programming?')).toBeVisible();
    await expect(page.locator('text=Unreadable scanned text segment.')).toBeVisible();
  });

  test('3. Publish Live validates faculty review gate and Save Draft saves progress', async ({ page }) => {
    await page.goto('/instructor/question-import/review/test-import-job-1');

    // 3.1 Click Save Draft -> toast appears
    await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
    await expect(page.locator('text=Import review workflow progress saved')).toBeVisible({ timeout: 5000 });

    // 3.2 Click Publish Live with 2 pending questions -> modal shows Faculty Review Required
    await page.getByRole('button', { name: 'Publish Live', exact: true }).click();
    await expect(page.locator('text=Faculty Review Required')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Unreviewed Candidate Questions')).toBeVisible();
    await expect(page.locator('text=There are still 2 pending candidate questions')).toBeVisible();

    // Click Continue Reviewing
    await page.getByRole('button', { name: 'Continue Reviewing' }).click();
    await expect(page.locator('text=Faculty Review Required')).not.toBeVisible();
  });
});
