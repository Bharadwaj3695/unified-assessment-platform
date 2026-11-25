const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe.serial('Faculty Unified Test Creator & Question Authoring E2E', () => {
  const screenshotsDir = path.resolve(__dirname, '../../../test-results/screenshots');
  let page;

  test.beforeAll(async ({ browser }) => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    const context = await browser.newContext({
      viewport: { width: 1366, height: 960 },
    });
    page = await context.newPage();

    // Log in once as instructor
    await page.goto('/auth/login');
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);
    await expect(page.getByText('instructor Workspace', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  test('1. Create Test Hub has concise copy, selectable cards, and launch action', async () => {
    await page.goto('/instructor/create-test');
    await expect(page.locator('[data-testid="faculty-create-test-hub"]')).toBeVisible({ timeout: 10000 });

    // Verify concise header
    await expect(page.getByRole('heading', { name: 'Create Test' })).toBeVisible();
    await expect(page.getByText('Select test type')).toBeVisible();

    // Check two cards
    const asmtCard = page.locator('[data-testid="card-assessment"]');
    const mockCard = page.locator('[data-testid="card-mock-test"]');
    await expect(asmtCard).toBeVisible();
    await expect(mockCard).toBeVisible();

    // Card 1 has short label
    await expect(asmtCard.getByText('Course assessment')).toBeVisible();
    // Card 2 has short label
    await expect(mockCard.getByText('Practice test')).toBeVisible();

    // Select Mock Test card
    await mockCard.click();
    await expect(page.getByText('Selected Test Type:').locator('..')).toContainText('Practice test');

    // Select Assessment card
    await asmtCard.click();
    await expect(page.getByText('Selected Test Type:').locator('..')).toContainText('Course assessment');

    // Capture Hub screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, 'faculty-create-test-hub-compact.png'),
    });
  });

  test('2. Assessment Workflow: Launch Test Creator, author questions, preview, and save draft', async () => {
    await page.goto('/instructor/create-test');

    // Select Assessment and click Launch
    await page.locator('[data-testid="card-assessment"]').click();
    await page.locator('[data-testid="btn-launch-creator"]').click();

    // Verify Test Creator Studio loaded with Assessment badge
    await expect(page).toHaveURL(/\/instructor\/test-creator\?type=assessment/);
    await expect(page.getByRole('heading', { name: 'Test Creator Studio' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Course Assessment', { exact: true }).first()).toBeVisible();

    // Fill Test Details
    const testTitle = `E2E Operating Systems Exam ${Date.now()}`;
    await page.fill('input[placeholder*="Distributed Systems"]', testTitle);

    // Verify Question #1 exists
    const q1Card = page.locator('[data-testid="question-card-0"]');
    await expect(q1Card).toBeVisible();
    await q1Card.locator('textarea').fill('What mechanism avoids race conditions in multi-threaded programs?');

    // Add Question via top button
    await page.locator('[data-testid="btn-add-question-top"]').click();
    const q2Card = page.locator('[data-testid="question-card-1"]');
    await expect(q2Card).toBeVisible();

    // Change Q2 to Coding Challenge
    const typeSelect = q2Card.locator('select').first();
    await typeSelect.selectOption('CODING');

    // Enter coding problem statement
    await q2Card.locator('textarea').first().fill('Implement a thread-safe circular buffer.');

    // Add Public Sample Case and Hidden Case
    await q2Card.getByRole('button', { name: '+ Public Sample' }).click();
    await q2Card.getByRole('button', { name: '+ Hidden Case' }).click();

    // Add Question via bottom button
    await page.locator('[data-testid="btn-add-question-bottom"]').click();
    const q3Card = page.locator('[data-testid="question-card-2"]');
    await expect(q3Card).toBeVisible();

    // Change Q3 to SQL Challenge
    await q3Card.locator('select').first().selectOption('SQL');
    await q3Card.locator('textarea').first().fill('Write a SQL query to list all active student enrollments.');

    // Check Question Count & Marks updated
    await expect(page.getByText('3 Questions', { exact: true }).first()).toBeVisible();

    // Open Student Preview
    await page.getByRole('button', { name: 'Student Preview' }).click();
    await expect(page.getByRole('heading', { name: 'Student Examination Preview' })).toBeVisible({ timeout: 5000 });

    // Verify hidden test cases are protected and not exposed
    await expect(page.getByText('HIDDEN EVALUATION CASE')).not.toBeVisible();

    // Close preview
    await page.keyboard.press('Escape');

    // Click Save Draft
    await page.locator('[data-testid="btn-save-draft"]').click();
    await expect(page.getByText(/Draft saved/i).first()).toBeVisible({ timeout: 8000 });

    // Capture Assessment Creator screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, 'faculty-test-creator-assessment.png'),
    });
  });

  test('3. Mock Test Workflow: Launch Test Creator, configure blueprint, and author questions', async () => {
    await page.goto('/instructor/create-test');

    // Select Mock Test and click Launch
    await page.locator('[data-testid="card-mock-test"]').click();
    await page.locator('[data-testid="btn-launch-creator"]').click();

    // Verify Test Creator Studio loaded with Mock Test badge
    await expect(page).toHaveURL(/\/instructor\/test-creator\?type=mock/);
    await expect(page.getByRole('heading', { name: 'Test Creator Studio' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Mock Test', { exact: true }).first()).toBeVisible();

    // Verify blueprint fields are shown
    await expect(page.getByText('Blueprint Distribution & Rules')).toBeVisible();
    await expect(page.getByText(/Easy:/)).toBeVisible();
    await expect(page.getByText(/Medium:/)).toBeVisible();
    await expect(page.getByText(/Hard:/)).toBeVisible();

    // Fill Title
    const mockTitle = `GATE 2026 CS Full-Length Mock ${Date.now()}`;
    await page.fill('input[placeholder*="Distributed Systems"]', mockTitle);

    // Save Draft for Mock Test
    await page.locator('[data-testid="btn-save-draft"]').click();
    await expect(page.getByText(/Mock test draft saved/i).first()).toBeVisible({ timeout: 8000 });

    // Capture Mock Test Creator screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, 'faculty-test-creator-mock.png'),
    });
  });

  test('4. Responsive mobile layout and dark theme verification', async () => {
    // Mobile Viewport
    await page.setViewportSize({ width: 375, height: 950 });
    await page.goto('/instructor/create-test');
    await expect(page.locator('[data-testid="faculty-create-test-hub"]')).toBeVisible({ timeout: 10000 });

    const asmtCard = page.locator('[data-testid="card-assessment"]');
    const mockCard = page.locator('[data-testid="card-mock-test"]');
    await expect(asmtCard).toBeVisible();
    await expect(mockCard).toBeVisible();

    // Capture Mobile screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, 'faculty-create-test-hub-mobile.png'),
    });

    // Dark Theme Desktop Viewport
    await page.setViewportSize({ width: 1366, height: 960 });
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });

    await page.goto('/instructor/test-creator?type=assessment');
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByRole('heading', { name: 'Test Creator Studio' })).toBeVisible();

    // Capture Dark Theme screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, 'faculty-test-creator-dark.png'),
    });
  });
});
