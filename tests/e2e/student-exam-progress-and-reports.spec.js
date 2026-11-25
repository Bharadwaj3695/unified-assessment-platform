const { test, expect } = require('@playwright/test');

test.describe('UAP Exam-Wise Progress, My Results, Individual Reports & Faculty Verification', () => {
  test('Student Progress, My Results, My Attempts, Individual Report & PDF', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });

    // 1. Log in as Student
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'student@uap.edu');
    await page.fill('#password', 'Student@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student\/dashboard/, { timeout: 20000 });

    // 2. Verify existing Assessment Performance dashboard remains intact
    await expect(page.getByText('Assessment Performance').first()).toBeVisible({ timeout: 15000 });

    // 3. Verify My Attempts preserves complete history tabs including Pending Review & In Progress
    await page.goto('/student/attempts');
    await expect(page.getByText('My Attempts').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Pending Review/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /In Progress/ })).toBeVisible();
    await expect(page.getByText('Full-Stack Web Architecture & Engineering').first()).toBeVisible();

    // 4. Verify My Results excludes Pending Review & In Progress tabs and displays finalized outcomes
    await page.goto('/student/results');
    await expect(page.getByText('My Results').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Pending Review/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /In Progress/ })).toHaveCount(0);
    await expect(page.getByText('Full-Stack Web Architecture & Engineering').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'View Report' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download PDF' }).first()).toBeVisible();

    // 5. Verify Progress page displays Exam Performance, View Report, Download PDF, and AI placeholder
    await page.goto('/student/progress');
    const progressView = page.getByTestId('student-exam-progress-view');
    await expect(progressView).toBeVisible({ timeout: 15000 });
    await expect(progressView.getByText('Exam Performance')).toBeVisible();
    await expect(progressView.getByText('Full-Stack Web Architecture & Engineering')).toBeVisible();
    await expect(progressView.getByText('95 / 100')).toBeVisible();
    await expect(progressView.getByText('95%')).toBeVisible();
    await expect(progressView.getByText('Passed').first()).toBeVisible();

    const aiBox = page.getByTestId('progress-ai-predictor');
    await expect(aiBox).toBeVisible();
    await expect(aiBox).toContainText('not yet operational');

    // 6. Open Individual Exam Performance Report
    await progressView.getByRole('button', { name: 'View Report' }).first().click();
    await expect(page).toHaveURL(/\/student\/reports\/assessment\//, { timeout: 15000 });

    await expect(page.getByTestId('report-exam-name')).toHaveText('Full-Stack Web Architecture & Engineering');
    await expect(page.getByTestId('report-score')).toHaveText('95 / 100');
    await expect(page.getByTestId('report-percentage')).toHaveText('95%');
    await expect(page.getByText('Question-Wise Performance')).toBeVisible();
    await expect(page.getByText('Faculty Feedback & Grading Remarks')).toBeVisible();
    await expect(page.getByTestId('report-ai-placeholder')).toContainText('not yet operational');

    // Verify PDF download endpoint returns 200 application/pdf
    const pdfDownloadPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/analytics/reports/assessment/') && resp.url().endsWith('/pdf')
    );
    await page.getByTestId('btn-download-report-pdf').click();
    const pdfResponse = await pdfDownloadPromise;
    expect(pdfResponse.status()).toBe(200);
    expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
  });

  test('Faculty Report Access from Submissions Queue', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });

    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/, { timeout: 20000 });

    await page.goto('/instructor/submissions');
    await expect(page.getByText('Submission Evaluation Queue')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Full-Stack Web Architecture & Engineering').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'View Report' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'View Report' }).first().click();
    await expect(page).toHaveURL(/\/instructor\/reports\/assessment\//, { timeout: 15000 });
    await expect(page.getByTestId('report-exam-name')).toHaveText('Full-Stack Web Architecture & Engineering');
    await expect(page.getByTestId('report-score')).toHaveText('95 / 100');
  });
});
