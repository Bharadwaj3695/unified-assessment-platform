const { test, expect } = require('@playwright/test');

test.describe('UAP Exam-Wise Progress, My Results, My Certificates, Individual Reports & Faculty Verification', () => {
  test('Student Progress, My Results, My Attempts, My Certificates, Individual Report & PDF', async ({ page }) => {
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

    // 4. Verify My Results excludes Pending Review & In Progress tabs and displays finalized outcomes
    await page.goto('/student/results');
    await expect(page.getByText('My Results').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Pending Review/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /In Progress/ })).toHaveCount(0);

    // 5. Verify Progress page resolves without 404 and displays Exam Performance & Coming Soon AI card
    const progressRespPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/analytics/student/exam-progress') && resp.request().method() === 'GET'
    );
    await page.goto('/student/progress');
    const progressResp = await progressRespPromise;
    expect(progressResp.status()).toBe(200);

    const progressView = page.getByTestId('student-exam-progress-view');
    await expect(progressView).toBeVisible({ timeout: 15000 });
    await expect(progressView.getByRole('heading', { name: 'Exam Performance' })).toBeVisible();
    await expect(page.getByText(/Request failed with status code 404/i)).toHaveCount(0);

    const aiBox = page.getByTestId('progress-ai-predictor');
    await expect(aiBox).toBeVisible();
    await expect(aiBox).toContainText('Coming Soon');

    // Open an evaluated report if any evaluated exam row is present
    const viewReportBtn = progressView.getByRole('button', { name: 'View Report' }).first();
    if (await viewReportBtn.isVisible().catch(() => false)) {
      await viewReportBtn.click();
      await expect(page).toHaveURL(/\/student\/reports\/(assessment|mock_test)\//, { timeout: 15000 });
      await expect(page.getByTestId('report-exam-name')).toBeVisible();
      await expect(page.getByTestId('report-score')).toBeVisible();
      await expect(page.getByTestId('report-percentage')).toBeVisible();
      await expect(page.getByTestId('report-ai-placeholder')).toContainText('Coming Soon');

      const pdfDownloadPromise = page.waitForResponse(
        (resp) => resp.url().includes('/api/analytics/reports/') && resp.url().endsWith('/pdf')
      );
      await page.getByTestId('btn-download-report-pdf').click();
      const pdfResponse = await pdfDownloadPromise;
      expect(pdfResponse.status()).toBe(200);
      expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
    }

    // 6. Verify My Certificates sidebar item and page
    const certLink = page.locator('aside nav a', { hasText: 'My Certificates' });
    await expect(certLink).toBeVisible({ timeout: 10000 });
    await certLink.click();
    await expect(page).toHaveURL(/\/student\/certificates/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'My Certificates', level: 1 })).toBeVisible();

    // Either shows earned certificates with PDF/PNG/JPG download buttons OR exact empty state
    const hasEmptyState = await page.getByText('No certificates earned yet.').isVisible().catch(() => false);
    if (!hasEmptyState) {
      for (const fmt of ['pdf', 'png', 'jpg']) {
        const dlBtn = page.locator(`[data-testid^="btn-cert-download-${fmt}-"]`).first();
        await expect(dlBtn).toBeVisible();
        const certRespPromise = page.waitForResponse(
          (resp) => resp.url().includes('/api/certificates/') && resp.url().includes('/download')
        );
        await dlBtn.click();
        const certResp = await certRespPromise;
        expect(certResp.status()).toBe(200);
        const ct = certResp.headers()['content-type'] || '';
        if (fmt === 'pdf') expect(ct).toContain('application/pdf');
        if (fmt === 'png') expect(ct).toContain('image/png');
        if (fmt === 'jpg') expect(ct).toContain('image/jpeg');
      }
    } else {
      await expect(page.getByText('No certificates earned yet.')).toBeVisible();
    }
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

    const facultyReportBtn = page.getByRole('button', { name: 'View Report' }).first();
    if (await facultyReportBtn.isVisible().catch(() => false)) {
      await facultyReportBtn.click();
      await expect(page).toHaveURL(/\/instructor\/reports\/assessment\//, { timeout: 15000 });
      await expect(page.getByTestId('report-exam-name')).toBeVisible();
      await expect(page.getByTestId('report-score')).toBeVisible();
    }
  });
});
